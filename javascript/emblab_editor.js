// EmbLab extension for AUTOMATIC1111/stable-diffusion-webui
//
// https://github.com/834t/sd-a1111-b34t-emblab
// version 0.8 - 2024-05-19
//

// util
function toHTML(htmlString) {
	const div = document.createElement('div');
	div.innerHTML = htmlString.trim();
	return div.firstChild;
}

function dateNow(){
	const date = new Date();
	let year = date.getFullYear();
	let month = ( date.getMonth() + '' ).length === 1 ? '0' + ( date.getMonth() + 1 ) : date.getMonth() + 1;
	let day = ( date.getDate() + '' ).length === 1 ? '0' + date.getDate(): date.getDate();
	let hours = ( date.getHours() + '' ).length === 1 ? '0' + date.getHours(): date.getHours();
	let minutes = ( date.getMinutes() + '' ).length === 1 ? '0' + date.getMinutes(): date.getMinutes();
	let seconds = ( date.getSeconds() + '' ).length === 1 ? '0' + date.getSeconds(): date.getSeconds();
	const combined_string = `${year}${month}${day}-${hours}${minutes}${seconds}`;
	return combined_string;
}

const EmbLab_JSON_weights = {
	loadInput: document.createElement('input'),
	saveA: document.createElement( "a" ),
	fr: new FileReader(),
	dataMark: 'emblab_token_weights',
	load: function( callback ){
		this.loadCallback = callback;
		this.loadInput.click();
	},
	loadCallback: function(){},
	save: function( JSON_DATA, name = 'EmbLab_data.json' ){
		const __a = this.saveA;
		__a.href = URL.createObjectURL( new Blob( [ JSON.stringify( {
			data: JSON_DATA,
			type: this.dataMark,
		} ) ], { type: "application/json" } ) );
		__a.download = dateNow() + '_' + name;
		__a.click();
	},
	init: function(){
		const loadInput = this.loadInput;
		const fr = this.fr;
		loadInput.type = 'file';
		loadInput.accept = 'application/json';
		loadInput.addEventListener( 'change', ( e ) => {
			const file = loadInput.files[0];
			if(!file) return null;
			fr.readAsText( file );
		} );
		fr.onload = () => {
			let nextJSON = null;
			try {
				nextJSON = JSON.parse( this.fr.result );
			} catch( err ){
				console.warn( err );
				return null;
			}
			if(!nextJSON) return null;
			const { data, type } = nextJSON;
			if( type != this.dataMark ) return null;
			this.loadCallback( data );
		}
	}
}
EmbLab_JSON_weights.init();

const EmblabStyles = `
	// #emblab_workspace {
	// 	background-color: #ffffff;
	// }

	#emblab_workspace_rowsholder,
	#emblab_workspace_rowsholder_combined {
		float: left;
		width: 770px;
		display: inline-block;
		min-height: 64px;
		border: 1px #666666 solid;
		margin: 5px;
	}

	#emblab_workspace input {
		height: 16px;
		color: #666666; 
	}

	#emblab_workspace_menu div{
		display: inline-block;
	}

	.emblab_workspace_row{
		margin: 15px 0px;
	}

	.emblab_workspace_row_menu{
		background-color: #333333;
	}

	.emblab_workspace_row_menu div{
		display: inline-block;
	}
	
	.emblab_row_menu_leftmodule{
		float: left;
	}
	.emblab_row_menu_leftmodule .emblab_row_menu_info{
		width: 100px;
	}

	.emblab_row_menu_leftmodule input {
		max-width: 65px;
	}

	.emblab_row_menu_rightmodule{
		float: right;
		margin-right: 10px;
	}

	button.selected_row_button{
		color: #00FF00 !important;
	}

	.emblab_editor_context_menu{
		border: 1px #5a5b5a solid;
		background: #373636;
		position: absolute;
		z-index: 100000;
	}

	.emblab_editor_context_menu .emblab_editor_context_menu_option {
		background: #444;
		color: #f5f5f5;
		margin: 2px 3px;
		padding: 3px;
		font-family: monospace;
		cursor: pointer;
	}
	.emblab_editor_context_menu .emblab_editor_context_menu_option:hover {
		background: #777;
	}

	#emblab_app_container button {
		border: 1px #373737 solid;
		padding: 0px 1px;
		border-radius: 7px;
	}

	#emblab_app_container button:hover {
		border: 1px #5a5b5a solid;
	}
`;

const EMBLAB_PROJECT_TYPE = 'EMBLAB_PROJECT';
const EMBLAB_MIN_CAN_HEIGHT = 32;
let EMBLAB_CURRENT_CAN_HEIGHT = EMBLAB_MIN_CAN_HEIGHT;
const EMBLAB_MAX_CAN_HEIGHT = 256;

const EMBLAB_ROW_PENCIL_MODE = 'pencil';
const EMBLAB_ROW_ZONAL_MODE = 'zonal';

let EmbLabEditor = null;
let EmbLabEditorContextMenu = null;
let EmbLabEditor_MousedownEventHolder = null;
// let TokensCombinerEventListener = null;
// let LIST_OF_TOKENS = {};

const EMBLAB_EMBSURFING_TASKS_LIST = [];

class EmblabAppContextMenu {

	constructor( element ){

		this.container = element;
		this.tempContainer = document.createElement('div');
		this.el = toHTML( `
			<div class="emblab_editor_context_menu"></div>
		`);


		this.el.addEventListener( 'mouseleave', () => {
			this.hide();
		} );

		this.el.addEventListener( 'contextmenu', ( event ) => {
			event.preventDefault();
			event.stopPropagation();
		} );
	}

	show(){ 
		this.container.appendChild( this.el );
	}

	hide(){ 
		this.tempContainer.appendChild( this.el );
	}

	init(){
		this.tempContainer.appendChild( this.el );
	}

	renderOption( nextOption ){
		const nextElement = document.createElement('div');
		nextElement.className = 'emblab_editor_context_menu_option';
		nextElement.innerText = nextOption.title;
		nextElement.addEventListener( 'click', ( event ) => {
			event.preventDefault();
			event.stopPropagation();
			nextOption.callback();
			this.hide();
		} );
		return nextElement;
	}

	clearOptions(){
		this.el.innerHTML = ``;
	}

	renderMenu( event, options ){
		const { pageX, pageY } = event;
		this.show();
		this.el.style = `top:${pageY}px;left:${pageX}px;`;
		this.clearOptions();
		for( const nextOption of options ){
			const nextElement = this.renderOption( nextOption );
			this.el.appendChild( nextElement );
		}
	}

}

class EmblabApp{
	constructor( appContainerElement ){
		this.appContainer = appContainerElement;

		this.el = toHTML( `<div id="emblab_workspace"></div> `);
		this.el_menu = toHTML( `<div id="emblab_workspace_menu"></div>`);
		this.el_rowsholder_container = toHTML( `<div id="emblab_workspace_rowsholder">source tokens:<br/></div>`);
		this.el_rowsholder = toHTML( `<div></div>`);
		this.el_rowsholder_container.appendChild( this.el_rowsholder );
		this.el_rowsholder_combined_container = toHTML( `<div id="emblab_workspace_rowsholder_combined">combined tokens:<br/></div>`);
		this.el_rowsholder_combined = toHTML( `<div></div>`);
		this.el_rowsholder_combined_container.appendChild( this.el_rowsholder_combined );

		this.isEmbSurfingState = false;

		this.rows = [];
		this.rows_modifyed = [];
		this.mixed_data = [];

		this.clipboard = {
			start: 0,
			end: 0,
			width: 0,
			weights: [],
			accent: 1,
		};

		this.init();
	}

	getEmbSurfingData(){
		let data = [
			'for_batch_processing',
			[]
		];
		this.API.forEachRows( ( i, row ) => {
			const nextTestEmbSave = [
				this.getEmbeddingNameForCreation() + '_' + row.tagname.replace('</w>', '_w'),
				JSON.stringify([[
					row.tagname,
					row.tagid,
					row.weights
				]])
			];
			data[1].push( nextTestEmbSave );
		});
		data[1] = JSON.stringify( data[1] );
		return data;
	}

	serializeProjectData(){
		const data = {
			type: EMBLAB_PROJECT_TYPE, 
			name: this.getEmbeddingNameForCreation(),
			step: this.getEmbeddingStepForCreation(),
			rows: [] 
		}
		for( const nextRow of this.rows ) data.rows.push( nextRow.serializeRowData() );
		return data;
	}

	autoLoad(){
		const autosavedProjectData_asText = localStorage.getItem('EMBLAB_PROJECT');
		let autosavedProjectData;
		try{
			autosavedProjectData = JSON.parse( autosavedProjectData_asText );
		} catch( err ){
			console.warn( err );
		}
		if( !autosavedProjectData )return false;
		if( autosavedProjectData ){
			this.setEmbeddingNameForCreation( autosavedProjectData.name || '' );
			this.setEmbeddingStepForCreation( autosavedProjectData.step || 0 );
			const rows = autosavedProjectData.rows;
			this.applyLoadedData( rows );
		}
	}

	autosaveProjectData(){
		const serializedData = this.serializeProjectData();
		localStorage.setItem('EMBLAB_PROJECT', JSON.stringify( serializedData ));
	}

	buildMenu(){
		this.el_new_embedding_name = toHTML( `<div>new embedding name: <input id="emblab_editor_new_embedding_name" type="text" /></div>`);
		this.el_menu.appendChild( this.el_new_embedding_name );
		this.el_new_embedding_step = toHTML( `<div>| new embedding step: <input title="for training" id="emblab_editor_new_embedding_step" type="number" min="0" step="1" value="0"/></div>`);
		this.el_menu.appendChild( this.el_new_embedding_step );
		this.el_menu_buttons_line = toHTML(`
			<div>
				<button title="Save project" class="emblab_menu_save">💾 save project</button>
				<button title="Load project" class="emblab_menu_load">📁 load project</button>
				<button title="Merge loaded project tokens to current tokens" class="emblab_menu_merge">📁+ merge project</button>
				<button title="save every token of embeding as separate embedding for analize it" class="emblab_menu_embsurfing">@ emb surfing</button>
			</div>
		`);
		this.el_menu_save_button = this.el_menu_buttons_line.querySelector('.emblab_menu_save');
		this.el_menu_save_button.addEventListener( 'click', () => {
			const data = { 
				type: EMBLAB_PROJECT_TYPE, 
				name: this.getEmbeddingNameForCreation(),
				step: this.getEmbeddingStepForCreation(),
				rows: [] 
			}
			for( const nextRow of this.rows ) data.rows.push( nextRow.serializeRowData() );
			EmbLab_JSON_weights.save( data, this.getEmbeddingNameForCreation() );
		});

		this.el_menu_load_button = this.el_menu_buttons_line.querySelector('.emblab_menu_load');
		this.el_menu_load_button.addEventListener( 'click', () => {
			EmbLab_JSON_weights.load( ( data ) => {
				if( data.type === EMBLAB_PROJECT_TYPE ){
					this.setEmbeddingNameForCreation( data.name || '' );
					this.setEmbeddingStepForCreation( data.step || 0 );
					const rows = data.rows;
					this.applyLoadedData( rows );
				}
			} );
		});

		this.el_menu_merge_button = this.el_menu_buttons_line.querySelector('.emblab_menu_merge');
		this.el_menu_merge_button.addEventListener( 'click', () => {
			EmbLab_JSON_weights.load( ( data ) => {
				const isTagData = data.tagname && data.tagid;
				if( data.type === EMBLAB_PROJECT_TYPE || isTagData ){
					const rows = [];
					this.API.forEachRows( ( i, row ) => {
						rows.push( {
							accent: row.getAccent(),
							group_index: rows.length,
							tagid: row.tagid,
							tagname: row.tagname,
							weights: JSON.parse( JSON.stringify( row.weights ) ),
						} );
					} );
					const rows_for_merge = isTagData ? [ data ] : data.rows || [];
					for( let i = 0; i < rows_for_merge.length; i++){ 
						rows_for_merge[i].group_index = i + rows.length;
						rows.push( rows_for_merge[i] );
					 }
					this.applyLoadedData( rows );
				}
			} );
		});

		this.el_menu_embsurf_button = this.el_menu_buttons_line.querySelector('.emblab_menu_embsurfing');
		this.el_menu_embsurf_button.addEventListener( 'click', () => {
			this.isEmbSurfingState = !this.isEmbSurfingState;
			if( this.isEmbSurfingState ){ 
				this.el_menu_embsurf_button.style.border = '1px #00ff00 solid' 
			} else {
				this.el_menu_embsurf_button.style.border = '0px #00ff00 solid' 
			}
		});

		this.el_menu.appendChild( this.el_menu_buttons_line );

		this.el_menu_autogroup_line = toHTML(`
			<div width="100%" style="display: block;">
				<div title="autuogrouping by token semilarities">
					<span title="The higher the value, the lower the accuracy. More tokens will be merged.">
						preccision:<input width="70" class="emblab_menu_autogrouping_precision" type="number" min="0" max="1" step="0.01" value="0.2" />
					</span>
					<span title="The smaller the value, the lower the threshold for entering the mix zone. A smaller value means more tokens will be mixed.">
						min_limits:<input width="70" class="emblab_menu_autogrouping_minlimits" type="number" min="0" max="3" step="0.01" value="0.75"/>
					</span>
					<button class="emblab_menu_autogroup_button">autogroup</button>
				</div>	
			</div>
		`);
		this.el_menu_autogrouping_precision = this.el_menu_autogroup_line.querySelector('.emblab_menu_autogrouping_precision');
		this.el_menu_autogrouping_minlimits = this.el_menu_autogroup_line.querySelector('.emblab_menu_autogrouping_minlimits');
		this.el_menu_autogroup_button = this.el_menu_autogroup_line.querySelector('.emblab_menu_autogroup_button');
		this.el_menu_autogroup_button.addEventListener( 'click', () => {
			const preccision = this.el_menu_autogrouping_precision.value || 0.1;
			const min_limits = this.el_menu_autogrouping_minlimits.value || 0.75;
			this.groupRowsBySimilarities( preccision, min_limits );
		});
		this.el_menu.appendChild( this.el_menu_autogroup_line );
	}

	init(){

		this.el.appendChild( this.el_menu );
		this.el.appendChild( this.el_rowsholder_container );
		this.el.appendChild( this.el_rowsholder_combined_container );

		// append app element to container
		this.appContainer.appendChild( this.el );

		this.buildMenu();

		this.autoLoad();

	}

	setEmbeddingStepForCreation( step = 0){
		const el = this.el_new_embedding_step.querySelector('#emblab_editor_new_embedding_step');
		el.value = step;	
	}

	getEmbeddingStepForCreation(){
		const el = this.el_new_embedding_step.querySelector('#emblab_editor_new_embedding_step');	
		const name = parseInt(el.value);	
		return name;
	}

	setEmbeddingNameForCreation( name = ''){
		const el = this.el_new_embedding_name.querySelector('#emblab_editor_new_embedding_name');
		el.value = name;	
	}

	getEmbeddingNameForCreation(){
		const el = this.el_new_embedding_name.querySelector('#emblab_editor_new_embedding_name');	
		const name = el.value;	
		return name;
	}

	resetRowsHTML(){
		this.el_rowsholder.innerHTML = '';
	}

	resetMixedRowsHTML(){
		this.el_rowsholder_combined.innerHTML = '';
	}

	createRow(){

	}

	get API(){

		return {
			autoSave: () => {
				this.autosaveProjectData();
			},
			forEachRows: ( callback ) => {
				for( let i = 0; i < this.rows.length; i++ ){
					callback( i, this.rows[i] );
				}
			},
			removeRow: ( row ) => {

				if( !confirm( 'r u sure to delete this row?' ) ){
					return null;
				}

				const isSourceRow = row.rowsholder === this.el_rowsholder;
				const isCombinedRow = row.rowsholder === this.el_rowsholder_combined;
				if( isSourceRow ){
					const nextRows = [];
					for( const nextRow of this.rows ){
						if( nextRow != row ) nextRows.push( nextRow );
					}
					this.rows = nextRows;
					this.el_rowsholder.removeChild( row.el );
				}

				if( isCombinedRow ){
					const nextRows = [];
					for( const nextRow of this.rows_modifyed ){
						if( nextRow != row ) nextRows.push( nextRow );
					}
					this.rows_modifyed = nextRows;
					this.el_rowsholder_combined.removeChild( row.el );
				}
				this.API.autoSave();
			},
			isASourceRow: ( row ) => {
				return row.rowsholder === this.el_rowsholder;
			},
			setClipboard: ( nextClipboardData ) => {
				this.clipboard = nextClipboardData;
			},
			getClipboard: () => {
				return this.clipboard;
			},
			duplicate: ( row ) => {
				const duplicatedRow = new EmblabTokenRow( 
					this.el_rowsholder, 
					{
						tagid: row.tagid, 
						tagname: row.tagname, 
						weights: JSON.parse(JSON.stringify( row.weights )), 
						group_index: row.group_index, 
					},
					this.API,
				);
				this.el_rowsholder.insertBefore( duplicatedRow.el, row.el.nextSibling );
				const nextRows = [];
				for( const nextRow of this.rows ){
					nextRows.push( nextRow );
					if( nextRow === row ){
						nextRows.push( duplicatedRow );
					}
				}
			}
		}
	}
	
	groupRowsBySimilarities( precision_alpha = 0.3, min_limits = 0.75 ){
		const rows = [];
		this.API.forEachRows( ( i, row ) => {
			rows.push( [ i, row ] );
		} );

		const getDiff = ( v1, v2 ) => { return  Math.max( v1, v2 ) - Math.min( v1, v2 ); }

		const semilarities_table = [];
		for( const rowC of rows ){
			const row_attracted_to = [];
			for( const rowT of rows ){
				if( rowT != rowC ){
					let dist_to = 0;
					for( let i = 0; i < 768; i++ ) dist_to += getDiff( rowC[1].weights[i][0], rowT[1].weights[i][0] );
					row_attracted_to.push( [ rowT[0], dist_to ] );
				}
			}
			let min = Infinity;
			let max = -Infinity;
			for( const r of row_attracted_to ) min=r[1]<min?r[1]:min, max=r[1]>max?r[1]:max;
			row_attracted_to.sort( ( a, b ) => { return a[1] - b[1]; } );
			semilarities_table.push( { index: rowC[0], sims: row_attracted_to, min, max, range: max - min } );
		}
		semilarities_table.sort( ( a, b ) => { return b.range - a.range; });

		const byGroups = {};
		const usedGroups = {};

		// console.log( semilarities_table );
		// console.log( byGroups );

		for( const nextGroup of semilarities_table ) {
			if( nextGroup.index in usedGroups ) continue;
			const nextPack = { index: nextGroup.index, forMerge: [] };
			byGroups[ nextGroup.index ] = nextPack;
			usedGroups[ nextGroup.index ] = true;
			const { min, max, range } = nextGroup;
			if( range < ( min * min_limits ) ){ continue; }
			for( const nextSim of nextGroup.sims ){
				const distAlpha = (nextSim[1] - min ) / range;
				if( distAlpha < precision_alpha ){
					nextPack.forMerge.push( nextSim[0] );
					usedGroups[ nextSim[0] ] = true;
				}
			}
		}

		for( const groupLeaderID in byGroups ){
			const grp = byGroups[ groupLeaderID ]; 
			rows[groupLeaderID][1].setGroupIndex( groupLeaderID );
			for( const toChange of grp.forMerge ){
				rows[toChange][1].setGroupIndex( groupLeaderID );
			}
		}

	}

	applyData_modifyed( tokensArray ){
		this.resetMixedRowsHTML();
		this.rows_modifyed = [];
		let group_index = 0;
		for( const nextToken of tokensArray ){
			const nextRow = new EmblabTokenRow( 
				this.el_rowsholder_combined, 
				{
					tagid: nextToken[0], 
					tagname: nextToken[1], 
					weights: nextToken[2],
					group_index
				},
				this.API, 
			);
			this.rows_modifyed.push( nextRow );
			group_index++;
		}
	}


	applyLoadedData( tokensArray ){
		this.resetRowsHTML();
		this.rows = [];
		let group_index = 0;
		for( const nextToken of tokensArray ){
			const nextRow = new EmblabTokenRow( 
				this.el_rowsholder, 
				{
					tagid: nextToken.tagid,
					tagname: nextToken.tagname,
					weights: nextToken.weights,
					group_index: nextToken.group_index || group_index,
					accent: nextToken.accent || 1
				}, 
				this.API,  
			);
			this.rows.push( nextRow );
			group_index++;
		}
	}

	applyData( tokensArray ){
		this.resetRowsHTML();
		this.rows = [];
		let group_index = 0;
		for( const nextToken of tokensArray ){
			const nextRow = new EmblabTokenRow( 
				this.el_rowsholder, 
				{
					tagid: nextToken[0], 
					tagname: nextToken[1], 
					weights: nextToken[2],
					group_index
				}, 
				this.API,  
			);
			this.rows.push( nextRow );
			group_index++;
		}
		this.API.autoSave();
	}

	combineData(){
		const filteredByGroup = {};

		for( const nextRow of this.rows ){
			const groupID = nextRow.getGroupIndex();
			const weights = nextRow.getWeights();
			const token = nextRow.tagname;
			const tokenID = nextRow.tagid;
			if(!( groupID in filteredByGroup ) ) filteredByGroup[ groupID ] = [];

			filteredByGroup[ groupID ].push( [ groupID, weights, token, tokenID ] );
		}

		const mixedForModifyed = [];

		for( const nextKey in filteredByGroup ){

			const nextGroup = filteredByGroup[ nextKey ];
			const token = nextGroup[0][2];
			const tokenID = nextGroup[0][3];
  
			const mixedGroup = [];

			const dictionary = {  };// { gid: tag }

			for( let i = 0; i < 768; i++ ){
				let min = Infinity;
				let max = -Infinity;
				let val = 0;
				let count = 0;
				for( let n = 0; n < nextGroup.length; n++ ){
					const current_weights = nextGroup[n][1][i];
					val += current_weights[0];
					min = current_weights[1] < min ? current_weights[1] : min;
					max = current_weights[2] > max ? current_weights[2] : max;
					count++;
				}
				val = val / count;
				mixedGroup[i] = [ val, min, max ];
			}

			mixedForModifyed.push( [ tokenID, token, mixedGroup ] );
		}

		this.mixed_data = mixedForModifyed;
		this.applyData_modifyed( this.mixed_data );

		return mixedForModifyed;
	}

	serializeData(){
		const combined_data = JSON.stringify(this.combineData());
		const name = this.getEmbeddingNameForCreation();
		return [ name, combined_data ];
	}

}

class EmblabTokenRow {
	constructor( EmblabRowsHolder, { tagname, tagid, weights, group_index, accent }, EMBLAB_API ){

		this.EMBLAB_API = EMBLAB_API;
			
		this.rowsholder = EmblabRowsHolder;

		this.tagname = tagname;
		this.tagid = tagid;
		this.weights = weights;
		this.initWeights = JSON.parse( JSON.stringify( weights ) );
		this.group_index = group_index || 1;
		this.initAccent = accent || 1;
		
		this.el = toHTML( `<div class="emblab_workspace_row" title="${tagname}:${tagid}"></div>`);
		this.el_menu = toHTML(`<div class="emblab_workspace_row_menu" style="width:100%"></div>`);
		this.el_canvasholder = toHTML(`<div class="emblab_workspace_row_canvasholder" style="width:100%"></div>`);

		this.EXRECTED_CAN_HEIGHT = 32;
		this.can = document.createElement('canvas');
		this.can.width = 768;
		this.can.height = this.EXRECTED_CAN_HEIGHT;
		this.can.style = 'display:inline-block;background-color:#000000;';
		this.ctx = this.can.getContext('2d');

		this.options = {
			can_heigh: EMBLAB_MIN_CAN_HEIGHT,
		};

		this.selectorStart = 0;
		this.selectorEnd = 0;

		this.editState = null;
			
		this.init();
	}

	restoreInitWeights(){
		this.weights = JSON.parse( JSON.stringify( this.initWeights ) );
	}

	vector_floorceiling_to_weight( weight, floor, ceiling ){
		return (weight - floor) / (ceiling - floor);
	}

	setDataByIndexAndAlpha( i, a ){
		const min = parseFloat( this.weights[i][1] );
		const max = parseFloat( this.weights[i][2] );
		const range = max - min;
		this.weights[i][0] = min + range * a;
	}

	getDataByIndexAsAlpha( i ){
		const min = parseFloat( this.weights[i][1] );
		const max = parseFloat( this.weights[i][2] );
		const val = parseFloat( this.weights[i][0] );
		const range = max - min;
		const val_to_get = ( val - min ) / range;
		return val_to_get;
	}

	forEachWeights( callBack ){
		for( let i = 0; i < 768; i++ ){
			const min = parseFloat( this.weights[i][1] );
			const max = parseFloat( this.weights[i][2] );
			const val = parseFloat( this.weights[i][0] );
			const range = max - min;
			callBack( 
				i,
				() => {
					return this.getDataByIndexAsAlpha( i );
				}, 
				( a ) => {
					this.setDataByIndexAndAlpha( i, a );
				}
			);
		}
	}

	contextmenu_for_canvas(){
		let CONTEXT_MENU_OPTIONS = [
			{
				title: 'copy to clipboard',
				callback: () => {
					const weights_to_clipboard = {
						start: this.selectorStart,
						end: this.selectorEnd,
						width: this.selectorEnd - this.selectorStart,
						weights: [],
						accent: this.getAccent(),
					};
					if( weights_to_clipboard.width > 0 ){
						for( let i = this.selectorStart; i < this.selectorEnd; i++ ){
							weights_to_clipboard.weights.push( 
								JSON.parse( JSON.stringify( this.weights[ i ] ) )
							);
						}
						this.EMBLAB_API.setClipboard( weights_to_clipboard );
					}
				}
			},
			{
				title: 'replace at clipboard position',
				callback: () => {
					const currentClipboard = this.EMBLAB_API.getClipboard();
					for( let i = 0; i < currentClipboard.weights.length; i++ ){
						const nextPosition = i + currentClipboard.start;
						if( this.weights[ nextPosition ] ){
							this.weights[ nextPosition ] = JSON.parse( JSON.stringify( currentClipboard.weights[ i ] ) )
						}
					}
					this.drawWeights();
					this.EMBLAB_API.autoSave();
				}
			},
			{
				title: 'replace at selector position',
				callback: () => {
					const currentClipboard = this.EMBLAB_API.getClipboard();
					for( let i = 0; i < currentClipboard.weights.length; i++ ){
						const nextPosition = i + this.selectorStart;
						if( this.weights[ nextPosition ] ){
							this.weights[ nextPosition ] = JSON.parse( JSON.stringify( currentClipboard.weights[ i ] ) )
						}
					}
					this.drawWeights();
					this.EMBLAB_API.autoSave();
				}
			},
			{
				title: 'mix at clipboard position',
				callback: () => {
					const currentClipboard = this.EMBLAB_API.getClipboard();
					for( let i = 0; i < currentClipboard.weights.length; i++ ){
						const nextPosition = i + currentClipboard.start;
						if( this.weights[ nextPosition ] ){
							const currentVal = this.weights[ nextPosition ];
							const clipboardVal = JSON.parse( JSON.stringify( currentClipboard.weights[ i ] ) );
							const finallyVal = [
								( currentVal[ 0 ] + ( clipboardVal[0] * currentClipboard.accent ) ) / 2,
								( currentVal[ 1 ] + ( clipboardVal[1] * currentClipboard.accent ) ) / 2,
								( currentVal[ 2 ] + ( clipboardVal[2] * currentClipboard.accent ) ) / 2,
							];
		
							this.weights[ nextPosition ] = finallyVal;
						}
					}
					this.drawWeights();
					this.EMBLAB_API.autoSave();
				}
			},
			{
				title: 'mix at selector position',
				callback: () => {
					const currentClipboard = this.EMBLAB_API.getClipboard();
					for( let i = 0; i < currentClipboard.weights.length; i++ ){
						const nextPosition = i + this.selectorStart;
						if( this.weights[ nextPosition ] ){
							const currentVal = this.weights[ nextPosition ];
							const clipboardVal = JSON.parse( JSON.stringify( currentClipboard.weights[ i ] ) );
							const finallyVal = [
								( currentVal[ 0 ] + ( clipboardVal[0] * currentClipboard.accent ) ) / 2,
								( currentVal[ 1 ] + ( clipboardVal[1] * currentClipboard.accent ) ) / 2,
								( currentVal[ 2 ] + ( clipboardVal[2] * currentClipboard.accent ) ) / 2,
							];
		
							this.weights[ nextPosition ] = finallyVal;
						}
					}
					this.drawWeights();
					this.EMBLAB_API.autoSave();
				}
			},
			{
				title: 'reverse token horizontal',
				callback: () => {
					const nextWeights = [];
					while( this.weights.length ){
						nextWeights.push( this.weights.pop() );
					}
					this.weights = nextWeights;
					this.drawWeights();
					this.EMBLAB_API.autoSave();
				}
			},
			{
				title: 'reverse token vertical',
				callback: () => {
					for( const nextW of this.weights ){
						const val = nextW[0];
						const min = nextW[1];
						const max = nextW[2];
						nextW[0] = -val;
						nextW[1] = -max;
						nextW[2] = -min;
					}
					this.drawWeights();
					this.EMBLAB_API.autoSave();
				}
			} ,
		];

		if( this.editState == EMBLAB_ROW_PENCIL_MODE ){
			CONTEXT_MENU_OPTIONS.push( {
				title: 'all weights to mid',
				callback: () => {
					for( const nextW of this.weights ){
						nextW[0] = nextW[1] + ( ( nextW[2] - nextW[1] ) / 2 )
					} 
					this.drawWeights();
					this.EMBLAB_API.autoSave();
				}
			} );
			CONTEXT_MENU_OPTIONS.push( {
				title: 'all weights absolute [0,-1, 1]',
				callback: () => {
					for( const nextW of this.weights ){
						nextW[0] = 0;
						nextW[1] = -1;
						nextW[2] = 1;
					} 
					this.drawWeights();
					this.EMBLAB_API.autoSave();
				}
			} );
		}

		// pencil tool additional options
		if( this.editState == EMBLAB_ROW_ZONAL_MODE ){
			CONTEXT_MENU_OPTIONS.push( {
				title: 'zone weights to mid',
				callback: () => {
					const _W = this.weights;
					for( let i = 0; i < _W.length; i++ ){
						if( i <= this.selectorEnd && i >= this.selectorStart ){
							_W[i][0] = _W[i][1] + ( ( _W[i][2] - _W[i][1] ) / 2 );
						}
					}
					this.drawWeights();
					this.EMBLAB_API.autoSave();
				}
			} );
			CONTEXT_MENU_OPTIONS.push( {
				title: 'zone weights to absolute [0,-1, 1]',
				callback: () => {
					const _W = this.weights;
					for( let i = 0; i < _W.length; i++ ){
						if( i <= this.selectorEnd && i >= this.selectorStart ){
							_W[i][0] = 0;
							_W[i][1] = -1;
							_W[i][2] = 1;
						}
					}
					this.drawWeights();
					this.EMBLAB_API.autoSave();
				}
			} );
		}

		return CONTEXT_MENU_OPTIONS;
	}

	contextmenu_for_rowmenu(){
		let CONTEXT_MENU_OPTIONS = [];

		CONTEXT_MENU_OPTIONS.push( {
			title: 'set current group index to all tokens',
			callback: () => {
				const currentGroup = this.getGroupIndex();
				this.EMBLAB_API.forEachRows( ( i, row ) => {
					row.setGroupIndex( currentGroup );
				} );
				this.EMBLAB_API.autoSave();
			}
		} );
		CONTEXT_MENU_OPTIONS.push( {
			title: 'set current accent to all tokens',
			callback: () => {
				const currentAccent = this.getAccent();
				this.EMBLAB_API.forEachRows( ( i, row ) => {
					row.setAccent( currentAccent );
				} );
				this.EMBLAB_API.autoSave();
			}
		} );
		CONTEXT_MENU_OPTIONS.push( {
			title: 'restore init weights',
			callback: () => {
				this.restoreInitWeights();
				this.EMBLAB_API.autoSave();
				this.drawWeights();
			}
		} );

		return CONTEXT_MENU_OPTIONS;
	}

	processContextMenu( event, special_element ){
		let CONTEXT_MENU_OPTIONS = [];
		if( !special_element ){
			CONTEXT_MENU_OPTIONS = this.contextmenu_for_canvas( event );
		} if ( special_element === 'row_menu' ) {
			CONTEXT_MENU_OPTIONS = this.contextmenu_for_rowmenu( event );
		}
		EmbLabEditorContextMenu.renderMenu( event, CONTEXT_MENU_OPTIONS );
	}

	bindCanvasEvents(){
		
		const isASourceRow = this.EMBLAB_API.isASourceRow( this );

		if(!isASourceRow) return false;

		const XY_by_event = ( event ) => {
			const { offsetX, offsetY } = event;
			return { x: parseInt( offsetX ), y: parseInt( offsetY ) };
		};

		const setSelectorStart = ( event ) => {
			if( this.editState == EMBLAB_ROW_PENCIL_MODE ) return;
			const { x, y } = XY_by_event( event );
			this.selectorStart = x;
			this.updateSelectionMonitor();
			this.drawWeights();
		};

		const setSelectorEnd = ( event ) => {
			const { x, y } = XY_by_event( event );
			if( x < this.selectorStart ){ 
				this.selectorStart = x;
			} else {
				this.selectorEnd = x;
			}
			this.updateSelectionMonitor();
			this.drawWeights();
		};

		const processEditEvent = ( event ) => {
			const currentCanHeight = this.options.can_heigh;
			if( this.editState == EMBLAB_ROW_PENCIL_MODE ){
				const { x, y } = XY_by_event( event );
				const value = ( currentCanHeight - y ) / currentCanHeight;
				this.setDataByIndexAndAlpha( x, 1 - value );
				this.drawWeights();
			}
			if( this.editState == EMBLAB_ROW_ZONAL_MODE ){
				setSelectorEnd( event );
			}
		};

		const mouseMoveEvent = ( event ) => {
			processEditEvent( event );
		}
		const mouseUpEvent = () => {
			this.can.removeEventListener( 'pointermove', mouseMoveEvent );
			document.removeEventListener( 'pointerup', mouseUpEvent );
			this.EMBLAB_API.autoSave();
		}
		const mousDownEvent = ( event ) => {
			// // set ui line to zero
			// if( event.button == 1 ){}
			// // set mid data between tokens
			// if( event.button == 2 ){}
			
			EmbLabEditor_MousedownEventHolder = event;

			if( event.button == 2 ){	
				event.preventDefault();
				event.stopPropagation();
				this.processContextMenu( event );
				return null;
			}

			setSelectorStart( event );
			processEditEvent( event );
			this.can.addEventListener( 'pointermove', mouseMoveEvent );
			document.addEventListener( 'pointerup', mouseUpEvent );
		}	
		this.can.addEventListener( 'pointerdown', mousDownEvent );

		this.can.addEventListener( 'contextmenu', ( event ) => {
			event.preventDefault();
			event.stopPropagation();
		} );
	}

	downsampleWeights( currentWeights ){
		const data = []; 
		for( const w of currentWeights ) data.push( w );
		const numGroups = 48;
		const groupSize = 16;
		const result = [];
		for (let i = 0; i < numGroups; i++) {
			const start = i * groupSize;
			const end = start + groupSize;
			const group = data.slice(start, end);
			const average = ( group.reduce((sum, value) => sum + value, 0) / groupSize * 2 ) - 0.5;
			result.push(average);
		}
		return { data: result, numGroups, groupSize };
	}

	drawLineByXY( lineValues = [], color = '#FFFFFF', lineWidth = 1 ){
		const currentCanHeight = this.options.can_heigh;
		const getY = ( a ) => { return a * currentCanHeight; };
		const ctx = this.ctx;
		ctx.beginPath(); // 
		ctx.lineWidth = lineWidth;
		ctx.moveTo( 0, getY( lineValues[0] )); // 
		ctx.strokeStyle = color;
		for( const nextXY of lineValues ){
			ctx.lineTo( nextXY.x, getY( nextXY.y ) ); // Draw a line to (150, 100)
		}
		ctx.stroke(); // Render the path
	}

	drawLine( lineValues = this.data, color = '#FFFFFF', lineWidth = 1 ) {
		const currentCanHeight = this.options.can_heigh;
		const getY = ( a ) => { return a * currentCanHeight; };
		const ctx = this.ctx;
		ctx.beginPath(); // 
		ctx.lineWidth = lineWidth;
		ctx.moveTo( 0, getY( lineValues[0] )); // 
		ctx.strokeStyle = color;
		for( let i = 1; i < 768; i++ ){
			ctx.lineTo( i, getY( lineValues[i]) ); // Draw a line to (150, 100)
		}
		ctx.stroke(); // Render the path
	}

	drawWeights(){
		const currentCanHeight = this.options.can_heigh;
		const getY = ( a ) => { return currentCanHeight - ( a * ( currentCanHeight / 2) ); };
		const ctx = this.ctx;
		ctx.clearRect( 0, 0, 768, currentCanHeight );

		if( this.editState == EMBLAB_ROW_ZONAL_MODE ){
			ctx.fillStyle = '#777799';
			let _zoneWidth = Math.abs(this.selectorEnd - this.selectorStart);
			ctx.fillRect( this.selectorStart, 0, _zoneWidth, currentCanHeight );
		}
		
		const currentWeights = [];
		this.forEachWeights( ( index, getVal, setVal ) => {
			currentWeights[index] = getVal();
		} );
		this.drawLine( currentWeights, '#FF0000', 1 );


		const whiteZeroLine = [];
		for( let i = 0; i < 768; i++ ){
			whiteZeroLine.push(0.5);
		}
		this.drawLine( whiteZeroLine, '#cccccc', 0.5 );

		if( this.editState != EMBLAB_ROW_PENCIL_MODE ){
			// draw Selector Start => 
			ctx.beginPath(); // 
			ctx.lineWidth = 1;
			ctx.strokeStyle = '#00FF00';
			ctx.moveTo( this.selectorStart, 0 ); // 
			ctx.lineTo( this.selectorStart, currentCanHeight ); // Draw a line to (150, 100)
			ctx.stroke(); // Render the path
		}

		if( this.editState == EMBLAB_ROW_ZONAL_MODE ){
			ctx.beginPath(); // 
			ctx.lineWidth = 1;
			ctx.strokeStyle = '#0000FF';
			ctx.moveTo( this.selectorEnd, 0 ); // 
			ctx.lineTo( this.selectorEnd, currentCanHeight ); // Draw a line to (150, 100)
			ctx.stroke(); // Render the path
		}

		const downsampledLine = this.downsampleWeights( currentWeights );
		const forDraw = [];
		for( let i = 0; i <= downsampledLine.numGroups; i++ ) {
			forDraw.push( { 
				x: i * downsampledLine.groupSize, 
				y: downsampledLine.data[i] 
			} );
		}
		forDraw.push( { x: 768, y: 0.5 } );
		this.drawLineByXY( forDraw, '#00cccc', 1 );
		
		// ctx.beginPath(); // 
		// ctx.lineWidth = 1;
		// ctx.moveTo( 0,  getY( this.vector_floorceiling_to_weight( this.weights[0][0], this.weights[0][1], this.weights[0][2] ) ) ); // 
		// ctx.strokeStyle = '#FF0000';
		// for( let i = 1; i < 768; i++ ){
		// 	ctx.lineTo( i, getY( this.vector_floorceiling_to_weight( this.weights[i][0], this.weights[i][1], this.weights[i][2] ) ) ); // Draw a line to (150, 100)
		// }
		// ctx.stroke(); // Render the path
	}

	getGroupIndex(){
		const groupInput = this.el_menu_left_module.querySelector('.emblab_row_group');		
		return parseInt( groupInput.value );
	}

	setGroupIndex( i ){
		const groupInput = this.el_menu_left_module.querySelector('.emblab_row_group');		
		groupInput.value = i;
	}

	getAccent(){
		const asccentInput = this.el_menu_left_module.querySelector('.emblab_row_accent');
		return asccentInput ? parseFloat( asccentInput.value ) : 1;
	}

	setAccent( i ){
		const asccentInput = this.el_menu_left_module.querySelector('.emblab_row_accent');
		asccentInput.value = i;
	}

	getWeights(){
		const nextWeights = [];
		const accent = this.getAccent();
		for( const nextW of this.weights ){
			const w = nextW[0] * accent;
			nextWeights.push( [ w, nextW[1], nextW[2] ] );
		}
		return nextWeights;
		// return parseFloat( this.el_menu_group.querySelector('.emblab_row_accent').value );
	}

	serializeRowData(){
		return {
			tagid: this.tagid, 
			tagname: this.tagname, 
			weights: JSON.parse(JSON.stringify( this.weights )), 
			group_index: this.group_index, 
			accent: this.getAccent(),
		};
	}

	bindMenuButtonsControl(){

		const emblab_rowmenu_save_w_button = this.el_menu_right_module.querySelector('.emblab_rowmenu_save_w');
		const emblab_rowmenu_load_w_button = this.el_menu_right_module.querySelector('.emblab_rowmenu_load_w');
		const canHeightUp_button = this.el_menu_right_module.querySelector('.emblab_rowmenu_height_up');
		const canHeightDown_button = this.el_menu_right_module.querySelector('.emblab_rowmenu_height_down');
		const pencilDrawMode_button = this.el_menu_right_module.querySelector('.emblab_rowmenu_pencil_edit');
		const zonalEditMode_button = this.el_menu_right_module.querySelector('.emblab_rowmenu_zonal_edit');
		const removeRow_button = this.el_menu_right_module.querySelector('.emblab_rowmenu_remove_row');
		// const duplicate_button = this.el_menu_right_module.querySelector('.emblab_rowmenu_duplicate');


		canHeightUp_button.addEventListener( 'click', () => {
			if( this.options.can_heigh < EMBLAB_MAX_CAN_HEIGHT ){
				this.options.can_heigh += EMBLAB_MIN_CAN_HEIGHT;
				this.can.height = this.options.can_heigh;
				this.drawWeights();
			}
		} );

		canHeightDown_button.addEventListener( 'click', () => {
			if( this.options.can_heigh > EMBLAB_MIN_CAN_HEIGHT ){
				this.options.can_heigh -= EMBLAB_MIN_CAN_HEIGHT;
				this.can.height = this.options.can_heigh;
				this.drawWeights();
			}
		} );

		emblab_rowmenu_save_w_button.addEventListener( 'click', () => {
			EmbLab_JSON_weights.save( this.serializeRowData(), this.tagname );
			this.EMBLAB_API.autoSave();
		} );

		const isASourceRow = this.EMBLAB_API.isASourceRow( this );
		if(!isASourceRow) return false;

		this.el_menu.addEventListener( 'contextmenu', ( event ) => {
			event.preventDefault();
			event.stopPropagation();
		} );
		this.el_menu.addEventListener( 'mousedown', ( event ) => {
			if( event.button === 2 ){
				this.processContextMenu( event, 'row_menu' );
			}
		} );

		emblab_rowmenu_load_w_button.addEventListener( 'click', (  ) => {
			EmbLab_JSON_weights.load( ( data ) => {
				this.weights = data.weights;
				this.drawWeights();
				this.EMBLAB_API.autoSave();
			} );
		} );

		const removeSelections = () => {
			pencilDrawMode_button.classList.remove('selected_row_button');
			zonalEditMode_button.classList.remove('selected_row_button');
			this.drawWeights();
		};

		pencilDrawMode_button.addEventListener( 'click', () => {
			this.editState = ( this.editState === EMBLAB_ROW_PENCIL_MODE ) ? null : EMBLAB_ROW_PENCIL_MODE;
			removeSelections();
			if( this.editState === EMBLAB_ROW_PENCIL_MODE ) pencilDrawMode_button.classList.add('selected_row_button');
		} );

		zonalEditMode_button.addEventListener( 'click', () => {
			this.editState = ( this.editState === EMBLAB_ROW_ZONAL_MODE ) ? null : EMBLAB_ROW_ZONAL_MODE;
			removeSelections();
			if( this.editState === EMBLAB_ROW_ZONAL_MODE ) zonalEditMode_button.classList.add('selected_row_button');
		} );

		removeRow_button.addEventListener( 'click', () => {
			this.EMBLAB_API.removeRow( this );
		} );

		// duplicate_button.addEventListener( 'click', () => {
		// 	this.EMBLAB_API.duplicate( this );
		// } );

	}

	updateSelectionMonitor(){		
		const selection_monitor = this.el_menu_left_module.querySelector('.selection_monitor');
		const s = this.selectorStart;
		const e = this.selectorEnd;
		const w = this.selectorEnd - this.selectorStart;
		selection_monitor.innerText = `[ start: ${s} | end ${e} | width: ${w} ]`;
	}

	buildMenu(){

		const isASourceRow = this.EMBLAB_API.isASourceRow( this );

		if( isASourceRow ){
			this.el_menu_left_module = toHTML(`
				<div class="emblab_row_menu_leftmodule">
					<div class="emblab_row_menu_info">${this.tagname}:${this.tagid}</div>
					<div>group: | <input class="emblab_row_group" type="number" min="0" max="150" step="1" value="${this.group_index || 0 }"/></div>
					<div>accent: | <input class="emblab_row_accent" type="number" min="0.1" max="10" step="0.1" value="1"/></div>
					<div class="selection_monitor"></div>
				</div>
			`);
			this.el_menu_left_module.querySelector('.emblab_row_accent').value = this.initAccent;
		} else {
			this.el_menu_left_module = toHTML(`
				<div class="emblab_row_menu_leftmodule">
					<div class="emblab_row_menu_info">${this.tagname}:${this.tagid}</div>
				</div>
			`);
		}

		this.el_menu.appendChild( this.el_menu_left_module );

		// this.el_menu_lable = toHTML(`<div>${this.tagname}:${this.tagid}</div>`);
		// this.el_menu.appendChild( this.el_menu_lable );
		// this.el_menu_group = toHTML(`<div> | group: <input class="emblab_row_group" type="number" min="0" max="150" step="1" value="${this.group_index || 0 }"/></div>`);
		// this.el_menu.appendChild( this.el_menu_group );
		// this.el_menu_accent = toHTML(`<div> | accent: <input class="emblab_row_accent" type="number" min="0.1" max="10" step="0.1" value="1"/></div>`);
		// this.el_menu.appendChild( this.el_menu_accent );

		if( isASourceRow ){
			this.el_menu_right_module = toHTML(`
				<div class="emblab_row_menu_rightmodule">
					<button title="Zoom in" class="emblab_rowmenu_height_up">&#x1F50D;+</button>
					<button title="Zoom out" class="emblab_rowmenu_height_down">&#x1F50D;-</button> || 
					<button title="Save weights" class="emblab_rowmenu_save_w">💾</button>
					<button title="Load weight" class="emblab_rowmenu_load_w">📁</button> || 
					<button title="Duplicate row" class="emblab_rowmenu_duplicate">&#x2398;</button> ||
					<button title="Pencil edit mode" class="emblab_rowmenu_pencil_edit">&#x270E;</button>
					<button title="Zonal edit mode" class="emblab_rowmenu_zonal_edit">&#x2334;</button> ||
					<button title="Remove row" class="emblab_rowmenu_remove_row"> X </button>
				</div>
			`);
		} else {
			this.el_menu_right_module = toHTML(`
				<div class="emblab_row_menu_rightmodule">
					<button title="Zoom in" class="emblab_rowmenu_height_up">&#x1F50D;+</button>
					<button title="Zoom out" class="emblab_rowmenu_height_down">&#x1F50D;-</button> || 
					<button title="Save weights" class="emblab_rowmenu_save_w">💾</button>
				</div>
			`);
		}
		this.el_menu.appendChild( this.el_menu_right_module );

		this.bindMenuButtonsControl();
		this.bindCanvasEvents();
	}

	init(){
		this.el.appendChild( this.el_menu );
		this.el.appendChild( this.el_canvasholder );
		this.el_canvasholder.appendChild( this.can );
		this.rowsholder.appendChild( this.el );
		this.buildMenu();
		this.update();
	}

	update(){
		this.drawWeights();
	}
}

let message_1 = 'test test test ';

function emblab_js_update_byembvectors( tokensArray ){
	let parsedTokenised = [];
	let error__ = null;
	try {
		tokensArray = tokensArray.replaceAll("'",'"');
		parsedTokenised = JSON.parse( tokensArray );
	} catch( err ){
		error__ = err;
		console.warn( err );
	}
	if(error__) return false;
	if(parsedTokenised.length < 1) return false;
	for( const nextT of parsedTokenised ){
		const weights = nextT[2];
		let min = Infinity, max = -Infinity;
		const checkMinMax = ( n ) => { min = min < n ? min : n; max = max > n ? max : n; }
		for( const nextW of weights ) checkMinMax( nextW[0] );
		for( const nextW of weights ) nextW[1] = min, nextW[2] = max;
	}
	EmbLabEditor.applyData( parsedTokenised );
}

function emblab_js_update( tokensArray ){
	let parsedTokenised = [];
	let error__ = null;
	try {
		tokensArray = tokensArray.replaceAll("'",'"');
		parsedTokenised = JSON.parse( tokensArray );
	} catch( err ){
		error__ = err;
		console.warn( err );
	}
	if(error__) return false;
	if(parsedTokenised.length < 1) return false;
	EmbLabEditor.applyData( parsedTokenised );

}

function send_to_py(){
	return message_1;
}

function receive( somethin ){

}

function emblab_js_save_embedding() {
	let forSave = ['err','[]'];
	if( EmbLabEditor.isEmbSurfingState ){
		forSave = EmbLabEditor.getEmbSurfingData();
	} else {
		forSave = EmbLabEditor.serializeData();
	}
	// console.log( { forSave } );
	// return forSave;
	return forSave;
}

onUiUpdate(function(){

})

onUiTabChange(function(){
	const activeTab = get_uiCurrentTab();
	const currentTab = get_uiCurrentTabContent();
	if( currentTab.id != 'tab_emblab' ) return;
	if( !EmbLabEditor ){
		const emblab_app = document.querySelector("#emblab_app_container");
		EmbLabEditor = new EmblabApp( emblab_app );
		EmbLabEditorContextMenu = new EmblabAppContextMenu( document.body );
	}
})

onUiLoaded(function(){
	if(!document.querySelector("#EmblabStyles")){
		const EmbLabStylesTag = document.createElement('style');
		EmbLabStylesTag.id = 'EmblabStyles';
		EmbLabStylesTag.innerHTML = EmblabStyles.replaceAll('\n', '\r');
		document.head.appendChild( EmbLabStylesTag );
	}
});
