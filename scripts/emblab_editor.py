# EmbLab extension for AUTOMATIC1111/stable-diffusion-webui
#
# https://github.com/834t/sd-a1111-b34t-emblab
# version 0.8 - 2024-05-19
# tnx for advice with python!: https://github.com/captainzero93
#
import json
import gradio as gr
from modules import script_callbacks, devices, shared, sd_models, sd_hijack
from modules.shared import cmd_opts
import torch, os
from modules.textual_inversion.textual_inversion import Embedding
import collections, math, random


TOTAL_VECTORS = 768 #number of tokens in 
GLOBAL_MULTIPLIER = 1000.0 # maximum for positive and negative value of multyplier for vectors
MAX_NUM_MIX = 16 # number of embeddings that can be mixed
SHOW_NUM_MIX = 6 # number of mixer lines to show initially
MAX_SIMILAR_EMBS = 30 # number of similar embeddings to show
VEC_SHOW_TRESHOLD = 1 # change to 10000 to see all values
VEC_SHOW_PROFILE = 'default' #change to 'full' for more precision
SEP_STR = '-'*80 # separator string

SHOW_SIMILARITY_SCORE = False # change to True to enable

ENABLE_GRAPH = False
GRAPH_VECTOR_LIMIT = 8 # max number of vectors to draw in graph
ENABLE_SHOW_CHECKSUM = False #slows down listing loaded embeddings
REMOVE_ZEROED_VECTORS = True #optional
EMB_SAVE_EXT = '.pt' #'.bin'

EVAL_PRESETS = ['None','',
    'Boost','=v*8',
    'Digitize','=math.ceil(v*8)/8',
    'Binary','=(1*(v>=0)-1*(v<0))/50',
    'Randomize','=v*random.random()',
    'Sine','=v*math.sin(i/maxi*math.pi)',
    'Comb','=v*((i%2)==0)',
    'Crop_high','=v*(i<maxi//2)',
    'Crop_low','=v*(i>=maxi//2)'
    ]
#-------------------------------------------------------------------------------

def get_embedding_info( text ):

    text = text.lower()

    tokenizer, internal_embs, loaded_embs = get_data()

    loaded_emb = loaded_embs.get(text, None)

    if loaded_emb == None:
        for k in loaded_embs.keys():
            if text == k.lower():
                loaded_emb = loaded_embs.get(k, None)
                break

    if loaded_emb!=None:
        emb_name = loaded_emb.name
        emb_id = '['+loaded_emb.checksum()+']' # emb_id is string for loaded embeddings
        emb_vec = loaded_emb.vec
        return emb_name, emb_id, emb_vec, loaded_emb #also return loaded_emb reference

    # support for #nnnnn format
    val = None
    if text.startswith('#'):
        try:
            val = int(text[1:])
            if (val<0) or (val>=internal_embs.shape[0]): val = None
        except:
            val = None

    # obtain internal embedding ID
    if val!=None:
        emb_id = val
    else:
        emb_ids = text_to_emb_ids(text, tokenizer)
        if len(emb_ids)==0: return None, None, None, None
        emb_id = emb_ids[0] # emb_id is int for internal embeddings

    emb_name = emb_id_to_name(emb_id, tokenizer)
    emb_vec = internal_embs[emb_id].unsqueeze(0)

    return emb_name, emb_id, emb_vec, None # return embedding name, ID, vector


def determine_embedding_distribution():
    global emblab_distribution_floor, emblab_distribution_ceiling
    
    cond_model = shared.sd_model.cond_stage_model
    
    print("Conditional Model Type:", type(cond_model))
    
    emblab_distribution_floor = None
    emblab_distribution_ceiling = None

    try:
        if 'GeneralConditioner' in str(type(cond_model)):
            print("Detected SDXL model (GeneralConditioner)")
            print("EmbLab currently does not support SDXL models.")
            return False
        elif hasattr(cond_model, 'wrapped') and hasattr(cond_model.wrapped, 'transformer'):
            print("Detected SD 1.x model")
            embedding_layer = cond_model.wrapped.transformer.text_model.embeddings.token_embedding.wrapped
        elif hasattr(cond_model, 'model') and hasattr(cond_model.model, 'token_embedding'):
            print("Detected SD 2.x model")
            embedding_layer = cond_model.model.token_embedding.wrapped
        else:
            print("Unable to determine model type or find embedding layer")
            return False

        device = devices.device
        if cmd_opts.medvram or cmd_opts.lowvram:
            device = torch.device("cpu")
        
        distribution_floor = None
        distribution_ceiling = None
        
        for i in range(49405): 
            embedding = embedding_layer(torch.LongTensor([i]).to(device)).squeeze(0)
            if distribution_floor is None:
                distribution_floor = embedding.clone()
                distribution_ceiling = embedding.clone()
            else:
                distribution_floor = torch.minimum(distribution_floor, embedding)
                distribution_ceiling = torch.maximum(distribution_ceiling, embedding)
        
        emblab_distribution_floor = distribution_floor
        emblab_distribution_ceiling = distribution_ceiling

        print("Embedding distribution calculated successfully")
        return True
    except Exception as e:
        print(f"Error in determining embedding distribution: {str(e)}")
        return False
#-------------------------------------------------------------------------------

def get_data():

    loaded_embs = collections.OrderedDict(
        sorted(
            sd_hijack.model_hijack.embedding_db.word_embeddings.items(),
            key=lambda x: str(x[0]).lower()
        )
    )

    embedder = shared.sd_model.cond_stage_model.wrapped
    if embedder.__class__.__name__=='FrozenCLIPEmbedder': # SD1.x detected
        tokenizer = embedder.tokenizer
        internal_embs = embedder.transformer.text_model.embeddings.token_embedding.wrapped.weight

    elif embedder.__class__.__name__=='FrozenOpenCLIPEmbedder': # SD2.0 detected
        from modules.sd_hijack_open_clip import tokenizer as open_clip_tokenizer
        tokenizer = open_clip_tokenizer
        internal_embs = embedder.model.token_embedding.wrapped.weight

    else:
        tokenizer = None
        internal_embs = None

    return tokenizer, internal_embs, loaded_embs # return these useful references

#-------------------------------------------------------------------------------

def text_to_emb_ids(text, tokenizer):

    text = text.lower()

    if tokenizer.__class__.__name__== 'CLIPTokenizer': # SD1.x detected
        emb_ids = tokenizer(text, truncation=False, add_special_tokens=False)["input_ids"]

    elif tokenizer.__class__.__name__== 'SimpleTokenizer': # SD2.0 detected
        emb_ids =  tokenizer.encode(text)

    else:
        emb_ids = None

    return emb_ids # return list of embedding IDs for text

#-------------------------------------------------------------------------------

def emb_id_to_name(emb_id, tokenizer):

    emb_name_utf8 = tokenizer.decoder.get(emb_id)

    if emb_name_utf8 != None:
        byte_array_utf8 = bytearray([tokenizer.byte_decoder[c] for c in emb_name_utf8])
        emb_name = byte_array_utf8.decode("utf-8", errors='backslashreplace')
    else:
        emb_name = '!Unknown ID!'

    return emb_name # return embedding name for embedding ID

#-------------------------------------------------------------------------------
def token_to_vectors( text ):
    try:
        cond_model = shared.sd_model.cond_stage_model
        embedding_layer = cond_model.wrapped.transformer.text_model.embeddings
        
        pairs = [ x.strip() for x in text.split(',')]
        
        col_weights = {}
        
        for pair in pairs:
            word, col = pair.split(":")
            
            ids = cond_model.tokenizer(word, max_length=77, return_tensors="pt", add_special_tokens=False)["input_ids"]
            embedding = embedding_layer.token_embedding.wrapped(ids.to(devices.device)).squeeze(0)[0]
            weights = []
            
            for i in range(0, 768): 
                weight = embedding[i].item()
                floor = emblab_distribution_floor[i].item()
                ceiling = emblab_distribution_ceiling[i].item()
                
                weight = (weight - floor) / (ceiling - floor) # adjust to range for using as a guidance marker along the slider
                weights.append(weight)
            
            col_weights[col] = weights
        
        return col_weights
    except:
        return []
    
def get_token_data( tokenName ):
    try:
        cond_model = shared.sd_model.cond_stage_model
        embedding_layer = cond_model.wrapped.transformer.text_model.embeddings
        ids = cond_model.tokenizer( tokenName, max_length=77, return_tensors="pt", add_special_tokens=False)["input_ids"]
        embedding = embedding_layer.token_embedding.wrapped(ids.to(devices.device)).squeeze(0)[0]
        weights = []
        for i in range(0, 768): 
            weight = embedding[i].item()
            floor = emblab_distribution_floor[i].item()
            ceiling = emblab_distribution_ceiling[i].item()
            weights.append([ weight, floor, ceiling ])
        return weights
    except:
        return []
    
def LOGGING(txtToLog):
    return txtToLog
    
def do_editExistedEmbedding( embedding_name ):

    cond_model = shared.sd_model.cond_stage_model
    embedding_layer = cond_model.wrapped.transformer.text_model.embeddings
    
    device = devices.device
    if cmd_opts.medvram or cmd_opts.lowvram:
        device = torch.device("cpu")

    embedding = None

    # if hasattr( sd_hijack.model_hijack.embedding_db.word_embeddings, embedding_name ):
    try:
        embedding = sd_hijack.model_hijack.embedding_db.word_embeddings[embedding_name]
    except:
        return [ 'embedding not found', [] ]

    finally_emb_data = [ 
        embedding.name,
        embedding.vec,
        embedding.step,
        embedding.shape,
        embedding.vectors,
        embedding.cached_checksum,
        embedding.sd_checkpoint,
        embedding.sd_checkpoint_name,
        embedding.optimizer_state_dict,
        embedding.filename,
        embedding.hash,
        embedding.shorthash,
    ]

    vectors = []
    for i in range( embedding.vectors ):

        nextTensor = embedding.vec[i]
        nextVecToPush = []
        for n in range( embedding.shape ):
            floor = emblab_distribution_floor[n].item()
            ceiling = emblab_distribution_ceiling[n].item()
            nextVecToPush.append([ nextTensor[n].item(), floor, ceiling ])

        vectors.append([ '#267', 'e_token_'+str(i), nextVecToPush ])
    
    return [ finally_emb_data, vectors ]

def do_minitokenize( mini_input ):

    tokenizer, internal_embs, loaded_embs = get_data()
    
    results = []
    results_embs = []
    found_ids = text_to_emb_ids(mini_input, tokenizer)

    for i in range(len(found_ids)):
        idstr = '#'+str(found_ids[i])
        embstr = emb_id_to_name(found_ids[i],tokenizer)
        results.append(embstr+' '+idstr+'  ')
        weights = get_token_data( embstr )
        results_embs.append( [ idstr, embstr, weights ] )

    return ' '.join(results), results_embs# return everything

#-------------------------------------------------------------------------------
def approve_results():
    test = []

def save_embedding_foo( save_name, weights ):

    tokenizer, internal_embs, loaded_embs = get_data()

    results = []

    # if it is a batch processing
    if save_name == 'for_batch_processing':
        batchesAsJSON = json.loads( weights )
        for i in range( len( batchesAsJSON ) ):
            nextTask = batchesAsJSON[i]
            nextResults = save_embedding_foo( nextTask[0], nextTask[1] )
            results.append( nextResults )

        # finally changes after all saves
        return '\n'.join(results) 

    # if default saving ---
    new_emb_weights = json.loads( weights )

    # print( save_name, new_emb_weights ) 

    test = []
    # print ( save_name, new_emb_weights )
    if save_name=='':return 'Filename is empty', None


    enable_overwrite=False
    anything_saved = False
    saved_graph = None

    preset_name = ''

    save_filename = os.path.join(cmd_opts.embeddings_dir, save_name+preset_name+EMB_SAVE_EXT)
    file_exists = os.path.exists(save_filename)

    step_val = 100
    step_text = None

    try:
        step_val = int(step_text)
    except:
        step_val = None
        if (step_text!=''): results.append('Step value is invalid, ignoring')

    # calculate mixed embedding in tot_vec
    vec_size = None
    tot_vec = None
    for k in range(len(new_emb_weights)):
        weights_ = new_emb_weights[k][2]
        name = new_emb_weights[k][0]

        mixval = 1
        if (name=='') or (mixval==0): continue

        emb_name, emb_id, emb_vec, loaded_emb = get_embedding_info( name )
        mix_vec = emb_vec.to(device='cpu',dtype=torch.float32)

        # print( name, emb_name, emb_id )

        maxn = mix_vec.shape[0]
        maxi = mix_vec.shape[1]

        for n in range(maxn):
            for i in range(maxi):
                mix_vec[n][i] = weights_[i][0]

        if vec_size==None:
            vec_size = mix_vec.shape[1]
        else:
            if vec_size!=mix_vec.shape[1]:
                results.append('! Vector size is not compatible, skipping '+emb_name+'('+str(emb_id)+')')
                continue

        if tot_vec==None:
            tot_vec = mix_vec*mixval
        else:
            tot_vec = torch.cat([tot_vec,mix_vec*mixval])
        results.append('> '+emb_name+'('+str(emb_id)+')'+' x '+str(mixval))

    # save the mixed embedding
    if (tot_vec==None):
        results.append('No embeddings were mixed, nothing to save')
    else:
        if REMOVE_ZEROED_VECTORS:
            old_count = tot_vec.shape[0]
            tot_vec = tot_vec[torch.count_nonzero(tot_vec,dim=1)>0]
            new_count = tot_vec.shape[0]
            if (old_count!=new_count): results.append('Removed '+str(old_count-new_count)+' zeroed vectors, remaining vectors: '+str(new_count))

        if tot_vec.shape[0]>0:

            results.append('Final embedding size: '+str(tot_vec.shape[0])+' x '+str(tot_vec.shape[1]))

            if tot_vec.shape[0]>75:
                results.append('⚠️WARNING: vector count>75, it may not work 🛑')

            new_emb = Embedding(tot_vec, save_name)
            new_emb.step = 0

            if (step_val!=None):
                results.append('Setting step value to '+str(step_val))

            try:
                new_emb.save(save_filename)
                results.append('Saved "'+save_filename+'"')
                anything_saved = True

            except:
                results.append('🛑 Error saving "'+save_filename+'" (filename might be invalid)')

            #------------- end batch loop

    if anything_saved==True:

        results.append('Reloading all embeddings')

        try: 
            sd_hijack.model_hijack.embedding_db.load_textual_inversion_embeddings(force_reload=True)
        except: 
            sd_hijack.model_hijack.embedding_db.dir_mtime=0
            sd_hijack.model_hijack.embedding_db.load_textual_inversion_embeddings()

    return '\n'.join(results) 

def add_tab():
    embedding_distribution_success = determine_embedding_distribution()

    with gr.Blocks(analytics_enabled=False) as ui:
        with gr.Tabs():
            with gr.Row():
                with gr.Column(variant='panel'):
                    if not embedding_distribution_success:
                        gr.Markdown("⚠️ EmbLab: Unable to determine embedding distribution. Some features may not work or may be inaccurate.")
                    
                    with gr.Row():
                        with gr.Column():
                            mini_input = gr.Textbox(label="Mini tokenizer", lines=1, placeholder="Enter a short prompt (loaded embeddings or modifiers are not supported)")
                    
                            with gr.Row():
                                mini_tokenize = gr.Button(value="Tokenize", variant="primary")
                                mini_result = gr.Textbox(label="Tokens", lines=1)
                                mini_result_vectors = gr.Textbox(label="Tokens to vectors", lines=1, visible=False)
                                
                            with gr.Row():
                                apply_to_editor = gr.Button(value="Apply to editor", variant="secondary")
                            
                        with gr.Column():
                            embedding_name_input = gr.Textbox(label="Textual Inversion extractor", lines=1, placeholder="Enter an embedding name from your embeddings folder")
                                
                            with gr.Row():
                                embedding_to_vectors = gr.Button(label="Parse embedding", value="Check and parse Embedding", variant="secondary")

                            with gr.Row():
                                apply_parsed_emb_to_project = gr.Button(value="Apply parsed to editor", variant="secondary")
                                embimport_result_vectors = gr.Textbox(label="Emb Tokens to vectors", lines=1, visible=False)

                    with gr.Row():
                        logging_area = gr.Textbox(label="Logs")

                    with gr.Row():
                        combine_embedding = gr.Button(class_names="emblab_combine_embedding", value="Combine embedding", variant="secondary")
                        save_name = gr.Textbox(label="Tokens to vectors", lines=1, visible=False)
                        save_weights = gr.Textbox(label="Tokens to vectors", lines=1, visible=False)
                        save_embedding = gr.Button(value="Save embedding", variant="secondary")
                        
                    with gr.Row():
                        emblab_editor_container = gr.HTML(f"""
                            <div id="emblab_app_container" style="" width="100%" height="128"></div>
                            """)

            # embeddings parsing
            embedding_to_vectors.click(
                fn=do_editExistedEmbedding if embedding_distribution_success else lambda x: ("Embedding parsing is not available due to unsupported model type.", []),
                inputs=embedding_name_input,
                outputs=[logging_area, embimport_result_vectors]
            )
            apply_parsed_emb_to_project.click(fn=None, _js="emblab_js_update_byembvectors", inputs=embimport_result_vectors, outputs=[])

            # tokenizer processing
            mini_tokenize.click(
                fn=do_minitokenize if embedding_distribution_success else lambda x: ("Tokenization is not available due to unsupported model type.", []),
                inputs=mini_input,
                outputs=[mini_result, mini_result_vectors]
            )
            apply_to_editor.click(fn=None, _js="emblab_js_update", inputs=mini_result_vectors, outputs=[])

            # workspace combining and saving
            combine_embedding.click(fn=None, _js="emblab_js_save_embedding", inputs=None, outputs=[save_name, save_weights])
            save_embedding.click(
                fn=save_embedding_foo if embedding_distribution_success else lambda x, y: "Saving embeddings is not available due to unsupported model type.",
                inputs=[save_name, save_weights],
                outputs=logging_area
            )

    return [(ui, "EmbLab", "emblab")]

script_callbacks.on_ui_tabs(add_tab)
