import React,{useEffect,useState} from 'react'
import {CLO_DRAFT_FIELDS,resolveCloDraftTarget} from '../core/cloPropertyCommands.js'

// All editable values in this component resolve to existing EXO draft keys.
// The separate native Rust material/physics editor is not emulated here.
const GROUP_FIELDS={
  pattern:{information:[['name','Name'],['itemNo','Item No.']],simulation:[['layerIndex','Layer'],['visible3d','Show in 3D'],['locked','Lock Pattern']],fabric:[['fabricId','Assigned Fabric']],arrange:[['grainAngleDeg','Grainline Angle','°'],['seamAllowance','Seam Allowance','cm'],['cutQuantity','Cut Quantity']]},
  fabric:{
    information:[['name','Name'],['itemNo','Item No.'],['construction','Construction'],['supplier','Supplier'],['owner','Owner']],
    physical:[['gsm','Weight','g/m²'],['thickness','Thickness','mm',1000],['stretchWarp','Warp Stretch','%',100],['stretchWeft','Weft Stretch','%',100],['bend','Bend Parameter'],['damping','Damping'],['friction','Friction']],
    material:[['color','Color'],['roughness','Roughness'],['metalness','Metalness'],['sheen','Sheen']],
    // Backward-compatible data selectors for existing property consumers.
    simulation:[['gsm','Weight','g/m²'],['thickness','Thickness','mm',1000],['stretchWarp','Warp Stretch','%',100],['stretchWeft','Weft Stretch','%',100],['bend','Bend Parameter'],['damping','Damping'],['friction','Friction']],
    fabric:[['color','Color'],['roughness','Roughness'],['metalness','Metalness'],['sheen','Sheen']],
  },
  button:{button:[['diameterCm','Diameter','cm'],['holes','Holes'],['color','Color']],position:[['x','Position X','cm'],['y','Position Y','cm']]},
  buttonhole:{buttonhole:[['lengthCm','Length','cm'],['widthCm','Width','cm'],['orientationDeg','Angle','°'],['color','Thread Color']],position:[['x','Position X','cm'],['y','Position Y','cm']]},
  topstitch:{topstitch:[['stitchLengthMm','Stitch Length','mm'],['offsetCm','Offset','cm'],['rows','Number of Lines'],['rowGapCm','Line Distance','cm'],['color','Thread Color']]},
  graphic:{graphic:[['name','Name'],['opacity','Opacity','%',100],['rotationDeg','Rotation','°']],position:[['x','Position X','cm'],['y','Position Y','cm'],['widthCm','Width','cm'],['heightCm','Height','cm']]},
}

function EditorInput({field,label,unit='',factor=1,schema,value,selection,project,onEdit}){
 const displayed=schema.type==='number'&&typeof value==='number'?Number((value*factor).toFixed(5)):value
 const [draft,setDraft]=useState(String(displayed??''))
 const [error,setError]=useState('')
 useEffect(()=>{setDraft(String(displayed??''));setError('')},[displayed,selection?.id,selection?.itemId,field])
 const submit=value=>{
  const converted=schema.type==='number'?Number(value)/factor:value
  const result=onEdit?.(selection,field,converted)
  if(result?.ok===false){setError(result.error);return}
  setError('')
 }
 return <div className="clo-pe-edit-field" data-property-field={field}>
   <label htmlFor={`clo-field-${selection.type}-${field}`}>{label}</label>
   {schema.type==='boolean'?<input id={`clo-field-${selection.type}-${field}`} type="checkbox" checked={Boolean(value)} onChange={e=>submit(e.target.checked)} aria-label={label}/>
   :schema.type==='fabric'?<select id={`clo-field-${selection.type}-${field}`} aria-label={label} value={value??''} onChange={e=>submit(e.target.value)}>{Object.entries(project.fabrics||{}).map(([id,material])=><option key={id} value={id}>{material.name||id}</option>)}</select>
   :schema.type==='color'?<input id={`clo-field-${selection.type}-${field}`} aria-label={label} type="color" value={typeof value==='string'&&/^#[\da-fA-F]{6}$/.test(value)?value:'#888888'} onChange={e=>submit(e.target.value)}/>
   :<div className="clo-pe-edit-input"><input id={`clo-field-${selection.type}-${field}`} aria-label={label}
      type={schema.type==='number'?'number':'text'} value={draft}
      {...(schema.type==='number'?{min:schema.min*factor,max:schema.max*factor,step:schema.integer?'1':'any'}:{maxLength:schema.maxLength})}
      onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}
      onBlur={()=>{if(String(draft)!==String(displayed??''))submit(draft)}}/>{unit&&<span>{unit}</span>}</div>}
   {error&&<small role="alert" className="clo-pe-field-error">{error}</small>}
 </div>
}

export default function CloObjectPropertyFields({group,selection,project,onEdit,omitFields=[],includeFields=null}){
 const kind=String(selection?.type||'').toLowerCase()
 const target=resolveCloDraftTarget(project,selection)
 const fields=GROUP_FIELDS[kind]?.[group]||[]
 if(!target||!fields.length)return null
 return <div className="clo-pe-typed-fields" aria-label={`${kind} ${group} editable properties`}>
  {fields.filter(([field])=>!omitFields.includes(field)&&(!includeFields||includeFields.includes(field))).map(([field,label,unit,factor=1])=>{
   const schema=CLO_DRAFT_FIELDS[kind]?.[field]
   if(!schema)return null
   return <EditorInput key={`${selection.id}:${field}`} field={field} label={label} unit={unit} factor={factor} schema={schema}
      value={target[field]} selection={selection} project={project} onEdit={onEdit}/>
  })}
  {kind==='topstitch'&&group==='topstitch'&&Number(target.stitchLengthMm)>0&&<div className="clo-pe-readout"><span>Stitches per Inch (derived)</span><strong>{(25.4/target.stitchLengthMm).toFixed(1)} SPI</strong></div>}
  {kind==='fabric'&&['simulation','physical'].includes(group)&&<p className="clo-pe-note">Draft material estimates, not CLO fabric lab calibration. Native Rust physical parameters are edited in the separate native Fabric workspace.</p>}
  {kind==='button'&&group==='button'&&<p className="clo-pe-note">Button geometry is a draft hardware annotation. CLO thread-length forces and rigid button collisions are not simulated.</p>}
  {kind==='topstitch'&&group==='topstitch'&&<p className="clo-pe-note">These values update actual annotated stitch rows and appearance. Full CLO stitch-object physics is not implemented.</p>}
 </div>
}
