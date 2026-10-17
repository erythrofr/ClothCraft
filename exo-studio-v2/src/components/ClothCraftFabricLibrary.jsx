import React,{useEffect,useMemo,useState} from 'react'
import {CLOTHCRAFT_FABRICS,FABRIC_FIELDS,presetProperties,presetForFabric,validFabric} from '../core/clothcraftFabrics.js'
import {fabricSwatchStyle} from '../core/fabricSwatchStyle.js'
import {estimateTensileStiffness} from '../core/fabricCalibration.js'
import FabricDrapeBallPreview from './FabricDrapeBallPreview.jsx'
import './ClothCraftFabricLibrary.css'

const OPTICAL_FIELDS=[
  ['roughness','Roughness',.04,1,.01],
  ['sheen','Fabric sheen',0,1,.01],
  ['reflectivity','Finish reflectivity',0,1,.01],
  ['normalStrength','Yarn relief',0,3,.05],
]
const RANGES={density:[20,1600,1],thickness:[.03,6,.01],warp:[.1,25000,5],weft:[.1,25000,5],shear:[.1,2000,1],bend_warp:[.1,2500,.5],bend_weft:[.1,2500,.5]}
const numeric=v=>Number.isFinite(Number(v))?Number(v):0
const valueString=value=>Number(value.toPrecision(6)).toString()
const isColor=value=>/^#[0-9a-f]{6}$/i.test(value||'')

function NumericControl({label,value,min,max,step,disabled,onCommit,unit='',precision=3}){
  const [draft,setDraft]=useState(valueString(numeric(value)))
  useEffect(()=>setDraft(valueString(numeric(value))),[value])
  const actual=Number(draft),display=Number.isFinite(actual)?actual:numeric(value)
  const ceiling=Math.max(max,numeric(value)*1.5)
  const commit=()=>{
    if(draft.trim()===''||!Number.isFinite(actual)||actual<min||actual>ceiling){setDraft(valueString(numeric(value)));return}
    if(Math.abs(actual-numeric(value))>1e-9)onCommit(actual)
  }
  return <div className="cc-fabric-adjust" data-property-label={label}>
    <label><span>{label}</span>{unit&&<small>{unit}</small>}</label>
    <div className="cc-fabric-adjust-controls">
      <input aria-label={`${label} slider`} type="range" min={min} max={ceiling} step={step} disabled={disabled} value={Math.max(min,Math.min(ceiling,display))} onChange={event=>setDraft(event.target.value)} onPointerUp={commit} onKeyUp={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))commit()}} onBlur={commit}/>
      <input aria-label={`${label}${unit?` (${unit})`:''}`} type="number" min={min} max={ceiling} step="any" disabled={disabled} value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}} onBlur={commit}/>
    </div>
  </div>
}

function MetadataControl({fabricId,label,field,value,disabled}){
  const [draft,setDraft]=useState(value||'')
  const [status,setStatus]=useState('')
  useEffect(()=>{setDraft(value||'');setStatus('')},[value,fabricId])
  const save=()=>{
    const next=draft.trim()
    if(next===(value||''))return
    if(!fabricId||disabled)return
    const requestId=`fabric-${field}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
    setStatus('Saving…')
    const handle=event=>{
      if(event.detail?.requestId!==requestId)return
      window.removeEventListener('exo-clothcraft-property-result',handle)
      setStatus(event.detail.ok?'Saved':event.detail.error||'Could not save')
    }
    window.addEventListener('exo-clothcraft-property-result',handle)
    window.dispatchEvent(new CustomEvent('exo-clothcraft-edit-property',{detail:{requestId,kind:'fabric',id:fabricId,field,value:next}}))
  }
  return <label className="cc-fabric-metadata-edit"><span>{label}</span><input aria-label={`Fabric ${label.toLowerCase()}`} value={draft} disabled={disabled} maxLength={180} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}} onBlur={save}/>{status&&<small role="status">{status}</small>}</label>
}

export default function ClothCraftFabricLibrary({snapshot,panel,busy,onEdit,showPresets=true}){
  const [query,setQuery]=useState(''),[family,setFamily]=useState('all')
  const [all,setAll]=useState(false),[error,setError]=useState('')
  const [inspected,setInspected]=useState(null)
  const [optical,setOptical]=useState({}),[testResult,setTestResult]=useState('')
  const [test,setTest]=useState({widthMm:30,gaugeLengthMm:200,warpExtensionMm:4,warpForceN:1.5,weftExtensionMm:6,weftForceN:1.1})
  const fabric=snapshot?.template?.fabrics?.find(item=>item.id===panel?.fabric)
  const active=presetForFabric(fabric)
  const inspectedPreset=CLOTHCRAFT_FABRICS.find(item=>item.id===inspected)||active||CLOTHCRAFT_FABRICS[0]
  const metadata=fabric?snapshot?.propertyMetadata?.fabrics?.[fabric.id]||{}:{}
  // Native assignment and selected pattern drive the inspector. Browsing a
  // catalog sample is a temporary comparison; the next assignment resets it.
  useEffect(()=>{setInspected(null);setOptical({});setError('')},[panel?.fabric,fabric?.name])
  useEffect(()=>setOptical({}),[inspectedPreset.id])
  const appearance=inspectedPreset.appearance
  const previewFabric=useMemo(()=>({
    id:inspectedPreset.id,name:inspectedPreset.name,
    color:optical.color||appearance.color,
    surfaceFamily:appearance.weave,
    texture:inspectedPreset.photoScan||undefined,
    roughness:optical.roughness??appearance.roughness,
    sheen:optical.sheen??appearance.sheen,
    reflectivity:optical.reflectivity??.04,
    normalStrength:optical.normalStrength??.85,
    thickness:inspectedPreset.thicknessMm/1000,
    gsm:inspectedPreset.gsm,
    bend:Math.min(1.65,Math.max(.12,Math.sqrt(inspectedPreset.bending[0]*2500))),
    weaveScaleCm:3,wash:inspectedPreset.wash||null,
  }),[inspectedPreset,appearance,optical])
  const flatStyle=fabricSwatchStyle({name:previewFabric.name,color:previewFabric.color,
    surfaceFamily:previewFabric.surfaceFamily,texture:previewFabric.texture})
  const filtered=showPresets?CLOTHCRAFT_FABRICS.filter(item=>(family==='all'||item.appearance.weave===family)&&
    [item.name,item.appearance.weave,item.construction,item.composition].join(' ').toLowerCase().includes(query.toLowerCase())):[]
  async function apply(name,properties){
    if(!panel||!fabric||busy)return
    if(!validFabric(properties)){setError('Every native physical property must be a positive, finite value.');return}
    setError('')
    try{await onEdit({kind:'Fabric',panel:panel.id,name,properties,all_panels:all})}
    catch(cause){setError(cause.message||'Could not apply material')}
  }
  async function applyTensileTest(){
    if(!fabric||!panel||busy)return
    try{
      const common={widthMm:test.widthMm,gaugeLengthMm:test.gaugeLengthMm}
      const warp=estimateTensileStiffness({...common,observations:[{extensionMm:test.warpExtensionMm,forceN:test.warpForceN}]})
      const weft=estimateTensileStiffness({...common,observations:[{extensionMm:test.weftExtensionMm,forceN:test.weftForceN}]})
      await apply(fabric.name.replace(/ · tensile estimate$/,'')+' · tensile estimate',{
        ...fabric.properties,warp:warp.stiffnessNPerM,weft:weft.stiffnessNPerM,
      })
      setTestResult(`Linear strip estimate: warp ${warp.stiffnessNPerM.toFixed(1)} N/m; weft ${weft.stiffnessNPerM.toFixed(1)} N/m.`)
    }catch(cause){setError(cause.message);setTestResult('')}
  }
  const activeName=inspectedPreset.id===active?.id?'Assigned specimen':'Catalog specimen'
  return <section className="cc-fabric-library" aria-label="Native fabric library" data-native-fabric-id={fabric?.id||''}>
    <h3>{showPresets?'FABRIC LIBRARY':'SELECTED FABRIC'} {showPresets&&<small>{CLOTHCRAFT_FABRICS.length} EXAMPLES</small>}</h3>
    <p className="cc-fabric-panel-name">{panel?`${panel.name} · ${fabric?.name||'Unassigned fabric'}`:'Select a pattern in the 2D or 3D viewport to edit its fabric.'}</p>
    {showPresets&&<>
      <label className="cc-fabric-all"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Apply to all garment panels</label>
      <input aria-label="Search native fabrics" placeholder="Search fabric or construction…" value={query} onChange={e=>setQuery(e.target.value)}/>
      <select aria-label="Filter native fabrics by family" value={family} onChange={event=>setFamily(event.target.value)}>
        <option value="all">All fabric constructions · {CLOTHCRAFT_FABRICS.length}</option>
        {[...new Set(CLOTHCRAFT_FABRICS.map(item=>item.appearance.weave))].sort().map(name=><option key={name} value={name}>{name}</option>)}
      </select>
      <div className="cc-fabric-swatches" aria-label="Fabric specimen choices">
        {filtered.map(item=><div className={`cc-fabric-choice ${inspectedPreset.id===item.id?'is-inspected':''}`} key={item.id}>
          <button type="button" className="cc-fabric-inspect" aria-pressed={inspectedPreset.id===item.id} onClick={()=>setInspected(item.id)} title={`Inspect ${item.name}`}>
            <i data-weave={item.appearance.weave} style={fabricSwatchStyle({name:item.name,color:item.appearance.color,surfaceFamily:item.appearance.weave,texture:item.photoScan})}/>
            <span>{item.name}<small>{item.gsm.toFixed(0)} g/m² · {item.thicknessMm.toFixed(2)} mm · {item.appearance.weave}</small></span>
          </button>
          <button type="button" className="cc-fabric-apply" data-fabric-preset={item.id} disabled={!fabric||busy} onClick={()=>apply(item.name,presetProperties(item,fabric.properties))} aria-label={`Assign ${item.name}`}>Apply</button>
        </div>)}
      </div>
    </>}
    <div className="cc-fabric-specimen-heading"><strong>{inspectedPreset.name}</strong><span>{activeName}</span></div>
    <div className="cc-fabric-showcase" aria-label={`Side by side flat swatch and draped sample: ${inspectedPreset.name}`}>
      <div className="cc-fabric-flat" style={flatStyle}><span>FLAT SWATCH</span></div>
      <div className="cc-fabric-fold"><FabricDrapeBallPreview fabric={previewFabric} compact height={212}/><span>OVER THE BALL · DRAG</span></div>
    </div>
    <p className="cc-fabric-sample-note">{appearance.weave} construction · {inspectedPreset.gsm.toFixed(1)} g/m² · {inspectedPreset.thicknessMm.toFixed(3)} mm. The draped sheet uses a deterministic fold model informed by estimated bend and mass. The garment uses the native solver.</p>
    <div className="cc-fabric-optics" aria-label="Specimen optical finish controls">
      <h4>Appearance study <small>Preview only</small></h4>
      <label className="cc-fabric-color-control"><span>Color</span><input aria-label="Preview fabric color" type="color" value={isColor(previewFabric.color)?previewFabric.color:'#777777'} onChange={event=>setOptical(current=>({...current,color:event.target.value}))}/><output>{previewFabric.color}</output></label>
      {OPTICAL_FIELDS.map(([key,label,min,max,step])=><NumericControl key={`${inspectedPreset.id}:${key}`} label={label} value={previewFabric[key]} min={min} max={max} step={step} onCommit={value=>setOptical(current=>({...current,[key]:value}))}/>)}
      <button type="button" className="cc-fabric-reset-optics" onClick={()=>setOptical({})} disabled={!Object.keys(optical).length}>Reset preview finish</button>
      <p className="cc-fabric-optical-note">Color, roughness, sheen and reflectivity here adjust the inspection sample. Native garment shading comes from its assigned material preset; these optical adjustments are not saved into the Rust fabric.</p>
    </div>
    <details className="cc-fabric-source" open={!showPresets}>
      <summary>Material specification and provenance</summary>
      <dl>
        <dt>Construction</dt><dd>{inspectedPreset.construction||appearance.weave}</dd>
        <dt>Composition</dt><dd>{inspectedPreset.composition||'Unverified'}</dd>
        <dt>Texture / finish</dt><dd>{appearance.weave} · {inspectedPreset.photoScan?.scanAssetId?'licensed scan':'procedural study'}</dd>
        <dt>Color</dt><dd>{appearance.color}</dd>
        <dt>Weight</dt><dd>{inspectedPreset.gsm.toFixed(1)} g/m²</dd>
        <dt>Thickness</dt><dd>{inspectedPreset.thicknessMm.toFixed(3)} mm</dd>
        <dt>Supplier</dt><dd>{inspectedPreset.supplier||'Not recorded'}</dd>
        <dt>Owner</dt><dd>{inspectedPreset.owner||'Not recorded'}</dd>
      </dl>
      <p>{inspectedPreset.evidence}</p>
      {inspectedPreset.source&&<a href={inspectedPreset.source} target="_blank" rel="noreferrer">Specimen reference</a>}
    </details>
    {fabric&&<>
      <div className="cc-fabric-assigned-heading"><h4>Native assigned fabric</h4><span>{fabric.name}</span></div>
      <div className="cc-fabric-metadata" aria-label="Editable native fabric records">
        <h4>Manufacturing record <small>Saved in project metadata</small></h4>
        {['construction','supplier','owner'].map(field=><MetadataControl key={`${fabric.id}:${field}`} fabricId={fabric.id} field={field} label={field[0].toUpperCase()+field.slice(1)} value={metadata[field]||''} disabled={busy||showPresets}/>)}
        <p>Composition: {inspectedPreset.composition||'Not verified'}. Native project metadata currently stores construction, supplier and owner; composition is catalog reference information.</p>
      </div>
      <div className="cc-fabric-physics" aria-label="Editable native cloth physics">
        <h4>Physical simulation <small>Live native Rust material</small></h4>
        {FABRIC_FIELDS.map(([key,label,unit,scale])=><NumericControl key={`${fabric.id}:${key}`} label={label} unit={unit} value={numeric(fabric.properties[key])*scale} min={RANGES[key][0]} max={RANGES[key][1]} step={RANGES[key][2]} disabled={busy} onCommit={value=>apply(fabric.name,{...fabric.properties,[key]:value/scale})}/>)}
        <p>These seven coefficients are saved in the native project and drive the garment simulation. Surface mass and thickness are not optical roughness or collision offset.</p>
      </div>
      <details className="cc-fabric-calibration"><summary>Force / extension swatch calibration</summary>
        <p>Measure two strips independently in warp and weft. This linear approximation does not replace calibrated cloth tests.</p>
        {[
          ['widthMm','Strip width','mm'],['gaugeLengthMm','Gauge length','mm'],
          ['warpForceN','Warp force','N'],['warpExtensionMm','Warp extension','mm'],
          ['weftForceN','Weft force','N'],['weftExtensionMm','Weft extension','mm'],
        ].map(([key,label,unit])=><label className="cc-fabric-field" key={key}><span>{label} <small>{unit}</small></span>
          <input aria-label={`${label} (${unit})`} type="number" min="0" step="any" disabled={busy} value={test[key]} onChange={event=>setTest(current=>({...current,[key]:event.target.value}))}/>
        </label>)}
        <button type="button" disabled={busy} onClick={applyTensileTest}>Apply estimated stiffness</button>
        {testResult&&<p role="status">{testResult}</p>}
      </details>
    </>}
    {error&&<p role="alert" className="cc-fabric-error">{error}</p>}
    <p className="cc-fabric-evidence">Specimen construction and reference weight are documented when available. Bending, shear, and stretching remain estimates unless measured. Yarn-level contact, friction calibration and fabric-thickness collision clearance are outside this optical preview.</p>
  </section>
}
