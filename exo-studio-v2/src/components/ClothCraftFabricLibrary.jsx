import React,{useState} from 'react'
import {CLOTHCRAFT_FABRICS,FABRIC_FIELDS,presetProperties,presetForFabric,validFabric} from '../core/clothcraftFabrics.js'
import {fabricSwatchStyle} from '../core/fabricSwatchStyle.js'
import {estimateTensileStiffness} from '../core/fabricCalibration.js'
import './ClothCraftFabricLibrary.css'
export default function ClothCraftFabricLibrary({snapshot,panel,busy,onEdit}) {
 const [query,setQuery]=useState(''),[all,setAll]=useState(false),[error,setError]=useState('')
 const [family,setFamily]=useState('all')
 const [test,setTest]=useState({
  widthMm:30,gaugeLengthMm:200,warpExtensionMm:4,warpForceN:1.5,
  weftExtensionMm:6,weftForceN:1.1,
 })
 const [testResult,setTestResult]=useState('')
 const fabric=snapshot?.template.fabrics.find(f=>f.id===panel?.fabric)
 const active=presetForFabric(fabric)
 async function apply(name,properties){if(!validFabric(properties)){setError('Enter a positive, finite value.');return}setError('');await onEdit({kind:'Fabric',panel:panel.id,name,properties,all_panels:all})}
 async function applyTensileTest(){
  if(!fabric||!panel||busy)return
  try{
   const common={widthMm:test.widthMm,gaugeLengthMm:test.gaugeLengthMm}
   const warp=estimateTensileStiffness({...common,observations:[{
    extensionMm:test.warpExtensionMm,forceN:test.warpForceN,
   }]})
   const weft=estimateTensileStiffness({...common,observations:[{
    extensionMm:test.weftExtensionMm,forceN:test.weftForceN,
   }]})
   await apply(fabric.name.replace(/ · tensile estimate$/,'')+' · tensile estimate',{
    ...fabric.properties,warp:warp.stiffnessNPerM,weft:weft.stiffnessNPerM,
   })
   setTestResult(`Estimated membrane response: warp ${warp.stiffnessNPerM.toFixed(1)} N/m, weft ${weft.stiffnessNPerM.toFixed(1)} N/m.`)
  }catch(error){setError(error.message);setTestResult('')}
 }
 return <section className="cc-fabric-library" aria-label="Native fabric library">
 <h3>FABRIC LIBRARY <small>{CLOTHCRAFT_FABRICS.length} EXAMPLES</small></h3>
 <p>{panel?panel.name:'Select a pattern in either viewport to assign fabric.'}</p>
 <label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Apply to all garment panels</label>
 <input aria-label="Search native fabrics" placeholder="Search fabric or construction…" value={query} onChange={e=>setQuery(e.target.value)}/>
 <select aria-label="Filter native fabrics by family" value={family} onChange={event=>setFamily(event.target.value)}>
  <option value="all">All fabric constructions · {CLOTHCRAFT_FABRICS.length}</option>
  {[...new Set(CLOTHCRAFT_FABRICS.map(p=>p.appearance.weave))].sort().map(name=><option key={name} value={name}>{name}</option>)}
 </select>
 <div className="cc-fabric-swatches">{CLOTHCRAFT_FABRICS.filter(p=>(family==='all'||p.appearance.weave===family)&&(p.name+' '+p.appearance.weave+' '+(p.construction||'')).toLowerCase().includes(query.toLowerCase())).map(p=><button key={p.id} data-fabric-preset={p.id} disabled={!fabric||busy} onClick={()=>apply(p.name,presetProperties(p,fabric.properties))} title={p.evidence}><i data-weave={p.appearance.weave} style={fabricSwatchStyle({name:p.name,color:p.appearance.color,surfaceFamily:p.appearance.weave})}/><span>{p.name}<small>{p.gsm.toFixed(1)} g/m² · {p.thicknessMm.toFixed(3)} mm · {p.appearance.weave}</small></span></button>)}</div>
 {fabric&&<><h4>Assigned: {fabric.name}</h4><p>Values below are the live solver material. Preset selection replaces them; custom edits preserve the surface style.</p>
 {FABRIC_FIELDS.map(([key,label,unit,scale])=><label className="cc-fabric-field" key={`${panel.id}-${key}-${fabric.properties[key]}`}><span>{label} <small>{unit}</small></span><input aria-label={`${label} (${unit})`} type="number" min="0" step="any" disabled={busy} defaultValue={Number((fabric.properties[key]*scale).toPrecision(7))} onBlur={e=>{const v=e.target.value.trim()===''?NaN:Number(e.target.value)/scale;if(v!==fabric.properties[key])apply(fabric.name,{...fabric.properties,[key]:v})}}/></label>)}
 <details className="cc-fabric-calibration">
  <summary>Physical swatch force/extension calculator</summary>
  <p>Measure one strip in the warp direction and one in the weft direction. Width and gauge length use mm; applied tensile force uses newtons. The result is a linear small-strain N/m estimate for the native solver, not a complete CLO Emulator or certified fabric model.</p>
  {[
    ['widthMm','Strip width','mm'],['gaugeLengthMm','Gauge length','mm'],
    ['warpForceN','Warp force','N'],['warpExtensionMm','Warp extension','mm'],
    ['weftForceN','Weft force','N'],['weftExtensionMm','Weft extension','mm'],
  ].map(([key,label,unit])=><label className="cc-fabric-field" key={key}>
    <span>{label} <small>{unit}</small></span>
    <input aria-label={`${label} (${unit})`} type="number" min="0" step="any" disabled={busy}
      value={test[key]} onChange={e=>setTest(current=>({...current,[key]:e.target.value}))}/>
  </label>)}
  <button disabled={busy} onClick={applyTensileTest}>Apply estimated warp/weft stiffness</button>
  {testResult&&<p role="status">{testResult}</p>}
 </details>
 {active&&<p><a href={active.source} target="_blank" rel="noreferrer">Specimen source</a> · {active.evidence}</p>}</>}
 {error&&<p role="alert">{error}</p>}
 <p className="cc-fabric-evidence">Textile examples mix referenced mass/thickness specimens and unmeasured apparel construction estimates. Selection updates the live Rust tensile, shear, bend, mass and thickness properties. Fabric friction and individual yarn/knit-loop physics are not implemented; cloth thickness does not change collision clearance. Validate real materials with swatch tests.</p>
 </section>
}
