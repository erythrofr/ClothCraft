/** Typed, auditable draft-property mutation boundary.
 * No property editor control may write arbitrary project keys. Native Rust
 * properties are deliberately not routed through this EXO draft adapter. */
export const CLO_DRAFT_FIELDS = Object.freeze({
  pattern: {
    name:{type:'text',maxLength:96}, itemNo:{type:'optionalText',maxLength:96},
    grainAngleDeg:{type:'number',min:-360,max:360},
    seamAllowance:{type:'number',min:0,max:8}, cutQuantity:{type:'number',min:1,max:100,integer:true},
    layerIndex:{type:'number',min:0,max:32,integer:true}, visible3d:{type:'boolean'}, locked:{type:'boolean'},
    fabricId:{type:'fabric'},
  },
  fabric: {
    name:{type:'text',maxLength:96},
    itemNo:{type:'optionalText',maxLength:96},
    construction:{type:'optionalText',maxLength:128},
    supplier:{type:'optionalText',maxLength:128},
    owner:{type:'optionalText',maxLength:128},
    color:{type:'color'},gsm:{type:'number',min:1,max:3000},
    thickness:{type:'number',min:0.00001,max:0.03},
    stretchWarp:{type:'number',min:0,max:1},stretchWeft:{type:'number',min:0,max:1},
    bend:{type:'number',min:0,max:1},damping:{type:'number',min:0,max:1},
    friction:{type:'number',min:0,max:1.5},roughness:{type:'number',min:0,max:1},
    metalness:{type:'number',min:0,max:1},sheen:{type:'number',min:0,max:1},
  },
  button: {
    x:{type:'number',min:-500,max:500},y:{type:'number',min:-500,max:500},
    diameterCm:{type:'number',min:0.1,max:20},holes:{type:'number',min:0,max:8,integer:true},color:{type:'color'},
  },
  buttonhole: {
    x:{type:'number',min:-500,max:500},y:{type:'number',min:-500,max:500},
    lengthCm:{type:'number',min:0.1,max:30},widthCm:{type:'number',min:0.01,max:20},
    orientationDeg:{type:'number',min:-360,max:360},color:{type:'color'},
  },
  topstitch: {
    edgeIndex:{type:'number',min:0,max:10000,integer:true},offsetCm:{type:'number',min:0,max:20},
    stitchLengthMm:{type:'number',min:0.1,max:25},rows:{type:'number',min:1,max:8,integer:true},
    rowGapCm:{type:'number',min:0.01,max:10},color:{type:'color'},
  },
  graphic: {
    name:{type:'text',maxLength:96},x:{type:'number',min:-500,max:500},y:{type:'number',min:-500,max:500},
    widthCm:{type:'number',min:0.01,max:500},heightCm:{type:'number',min:0.01,max:500},
    rotationDeg:{type:'number',min:-360,max:360},opacity:{type:'number',min:0,max:1},
  },
})
const collections={button:'buttons',buttonhole:'buttonholes',topstitch:'topstitches',graphic:'graphics'}

export function resolveCloDraftTarget(project, selection) {
  if(!project || !selection || typeof selection!=='object')return null
  const kind=String(selection.type||'').toLowerCase()
  if(kind==='fabric')return project.fabrics?.[selection.id] || null
  if(kind==='pattern')return project.pieces?.find(p=>p.id===selection.pieceId) || null
  const collection=collections[kind]
  if(!collection)return null
  const piece=project.pieces?.find(p=>p.id===selection.pieceId)
  return piece?.[collection]?.find((item,i)=>String(item.id??i)===String(selection.itemId))||null
}

export function validateCloDraftProperty(project, selection, field, value) {
  const kind=String(selection?.type||'').toLowerCase()
  const schema=CLO_DRAFT_FIELDS[kind]?.[field]
  if(!schema)return {ok:false,error:`Unsupported ${kind||'object'} property: ${field}`}
  if(!resolveCloDraftTarget(project,selection))return {ok:false,error:'Selected object no longer exists'}
  let parsed=value
  if(schema.type==='number'){
    if((typeof value!=='number'&&typeof value!=='string')||value===''||!Number.isFinite(Number(value)))return {ok:false,error:'Enter a finite number'}
    parsed=Number(value)
    if(parsed<schema.min||parsed>schema.max||(schema.integer&&!Number.isSafeInteger(parsed)))return {ok:false,error:`${field} must be ${schema.min}–${schema.max}${schema.integer?' (integer)':''}`}
    if(kind==='topstitch'&&field==='edgeIndex'){
      const piece=project.pieces?.find(p=>p.id===selection.pieceId)
      if(parsed>=piece?.points?.length)return {ok:false,error:'Edge does not exist on the selected pattern'}
    }
  }else if(schema.type==='text'){
    if(typeof value!=='string'||!value.trim()||value.length>schema.maxLength)return {ok:false,error:'Invalid property name'}
    parsed=value.trim()
  }else if(schema.type==='optionalText'){
    if(typeof value!=='string'||value.length>schema.maxLength)
      return {ok:false,error:`${field} must be at most ${schema.maxLength} characters`}
    parsed=value.trim()
  }else if(schema.type==='boolean'){
    if(typeof value!=='boolean')return {ok:false,error:'Expected true or false'}
  }else if(schema.type==='color'){
    if(typeof value!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value))return {ok:false,error:'Expected a #RRGGBB color'}
  }else if(schema.type==='fabric'){
    if(typeof value!=='string'||!Object.hasOwn(project.fabrics||{},value))return {ok:false,error:'Unknown fabric reference'}
  }
  return {ok:true,kind,field,value:parsed}
}

export function applyCloDraftProperty(project,selection,field,value) {
  const check=validateCloDraftProperty(project,selection,field,value)
  if(!check.ok)return check
  const target=resolveCloDraftTarget(project,selection)
  target[field]=check.value
  return check
}
