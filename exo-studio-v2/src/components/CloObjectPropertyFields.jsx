import React,{useEffect,useState} from 'react'
import {CLO_DRAFT_FIELDS,resolveCloDraftTarget} from '../core/cloPropertyCommands.js'
import {listHardwarePresets} from '../data/hardwarePresets.js'

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
  button:{
    information:[['name','Name']],
    button:[['hardwarePresetId','Button Style'],['diameterCm','Width','mm',10],['thicknessMm','Thickness','mm'],['weightGrams','Weight','g'],['holes','Sewing Holes'],['holeDiameterMm','Hole Diameter','mm'],['holeSpacingMm','Hole Spacing','mm'],['angleDeg','Angle','°'],['threadType','Thread Type'],['threadLengthMm','Thread Length','mm'],['threadColor','Thread Color']],
    'button-material':[['color','Base Color'],['roughness','Roughness'],['metalness','Metalness'],['reflectionIntensity','Reflection Intensity'],['clearcoat','Clearcoat']],
    position:[['x','Position X','cm'],['y','Position Y','cm']],
  },
  buttonhole:{buttonhole:[['lengthCm','Length','cm'],['widthCm','Width','cm'],['orientationDeg','Angle','°'],['color','Thread Color']],position:[['x','Position X','cm'],['y','Position Y','cm']]},
  zipper:{
    'zipper-style':[['name','Name'],['hardwarePresetId','Zipper Style'],['edgeIndex','Pattern Edge'],['openFrom','Opening Direction']],
    'zipper-mechanics':[['twoWay','Two-way Zipper'],['fastened','Fasten Zipper'],['offsetCm','Edge Offset','cm']],
    'zipper-extension':[['startExtensionMm','Start Extension','mm'],['endExtensionMm','End Extension','mm']],
    'zipper-specification':[['chainWidthMm','Chain Width','mm'],['tapeWidthMm','Tape Width / Side','mm'],['tapeThicknessMm','Tape Thickness','mm'],['toothPitchMm','Tooth Pitch','mm'],['widthCm','Legacy Tape Width','cm']],
    'zipper-material':[['tapeColor','Tape Color'],['teethColor','Teeth Color'],['sliderColor','Slider Color'],['pullerColor','Puller Color'],['stopperColor','Stopper Color'],['metalness','Metalness'],['roughness','Roughness']],
  },
  topstitch:{topstitch:[['stitchLengthMm','Stitch Length','mm'],['offsetCm','Offset','cm'],['rows','Number of Lines'],['rowGapCm','Line Distance','cm'],['color','Thread Color']]},
  puckering:{puckering:[['edgeIndex','Pattern Edge'],['amplitudeMm','Visual Amplitude','mm'],['spacingMm','Wave Spacing','mm'],['widthCm','Band Width','cm'],['strength','Visual Strength'],['color','Appearance Color'],['visible','Show in Draft']]},
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
   :schema.type==='hardwarePreset'||schema.type==='zipperPreset'?<select id={`clo-field-${selection.type}-${field}`} aria-label={label} value={value??''} onChange={e=>submit(e.target.value)}>{listHardwarePresets(schema.type==='zipperPreset'?'zipper':'button').map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
   :schema.type==='enum'?<select id={`clo-field-${selection.type}-${field}`} aria-label={label} value={value??schema.values[0]} onChange={e=>submit(e.target.value)}>{schema.values.map(option=><option key={option} value={option}>{option}</option>)}</select>
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
  {kind==='button'&&group==='button'&&<p className="clo-pe-note">Width, thickness and thread parameters update the visible 3D button. Button/cloth collisions and thread tension are not yet solved by the native engine.</p>}
  {kind==='zipper'&&group==='zipper-mechanics'&&<p className="clo-pe-note">Slider and Fasten control the zipper appearance and, when a compatible sewn edge pair is linked, the EXO draft zipper seam open fraction. Native Rust zipper contact still needs integration.</p>}
  {kind==='topstitch'&&group==='topstitch'&&<p className="clo-pe-note">These values update actual annotated stitch rows and appearance. Full CLO stitch-object physics is not implemented.</p>}
  {kind==='puckering'&&group==='puckering'&&<p className="clo-pe-note">EXO draft puckering annotation: edge, width, frequency, color and amplitude are editable. The native Rust simulation has no puckering force or material displacement for this annotation.</p>}
 </div>
}
