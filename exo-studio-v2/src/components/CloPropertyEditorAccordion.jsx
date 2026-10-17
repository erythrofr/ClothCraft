import React, {useEffect, useRef, useState} from 'react'
import {ChevronDown, ChevronRight} from 'lucide-react'
import CloObjectPropertyFields from './CloObjectPropertyFields.jsx'
import CloEditableIdentity from './CloEditableIdentity.jsx'
import {resolveCloDraftTarget} from '../core/cloPropertyCommands.js'
import {CLO_LENGTH_UNITS,fromCentimetres,toCentimetresValue,formatPropertyLength} from '../core/cloPropertyUnits.js'
import {getHardwarePreset} from '../data/hardwarePresets.js'
import './CloPropertyEditorAccordion.css'

// Mirror the grouping of CLO's context-sensitive pattern Property Editor.
// This is an EXO UI shell. A setting is editable only when its underlying
// native/project command really exists; Bond and Solidify are not fake toggles.
export const CLO_PROPERTY_GROUPS = [
  ['information','Information'],
  ['selected-line','Selected Line'],
  ['simulation','Simulation Properties'],
  ['fabric','Fabric'],
  ['bond','Bond'],
  ['solidify','Solidify'],
  ['arrange','Arrange'],
  ['miscellaneous','Miscellaneous'],
]

// These are real selection classes, not extra accordion headings shown for
// every pattern. CLO's Fabric asset and a fabric assigned to a pattern have
// different editors; the same is true of topstitch and hardware instances.
const CONTEXT_GROUPS={
  fabric:[['information','Information'],['material','Material'],['physical','Physical Property'],['fabric','Fabric Library & Texture'],['miscellaneous','Miscellaneous']],
  sewing:[['information','Information'],['sewing','Sewing'],['miscellaneous','Miscellaneous']],
  button:[['information','Information'],['button','Button Style & Dimensions'],['button-material','Material · Basic Parameters & Reflection'],['position','2D Placement'],['miscellaneous','Miscellaneous']],
  zipper:[['information','Information'],['zipper-style','Zipper Style'],['zipper-mechanics','Fastening & Sliders'],['zipper-extension','Start & End Extension'],['zipper-specification','Chain, Tape & Dimensions'],['zipper-material','Component Materials & Reflection'],['miscellaneous','Miscellaneous']],
  hardware:[['information','Information'],['hardware','Shape & Specifications'],['hardware-material','Material · Basic Parameters & Reflection'],['construction','Construction & Placement']],
  buttonhole:[['information','Information'],['buttonhole','Buttonhole'],['position','2D Placement'],['miscellaneous','Miscellaneous']],
  topstitch:[['information','Information'],['topstitch','Stitch'],['miscellaneous','Miscellaneous']],
  graphic:[['information','Information'],['graphic','Graphic'],['position','2D Placement'],['miscellaneous','Miscellaneous']],
  avatar:[['information','Information'],['miscellaneous','Miscellaneous']],
  grading:[['information','Information'],['grading','Grading'],['miscellaneous','Miscellaneous']],
  pom:[['information','Information'],['pom','POM'],['miscellaneous','Miscellaneous']],
  puckering:[['information','Information'],['puckering','Puckering'],['miscellaneous','Miscellaneous']],
}

const EDITOR_GROUP_FOR_SECTION = {
  Pattern:'arrange',
  Sewing:'selected-line',
  Fit:'simulation',
  Fabric:'fabric',
  Render:'miscellaneous',
  Avatar:'miscellaneous',
  Production:'miscellaneous',
}

function Readout({label,value}) {
  return <div className="clo-pe-readout"><span>{label}</span><strong>{value ?? '—'}</strong></div>
}

export default function CloPropertyEditorAccordion({
  activeSection,selectedPiece,project,fabric,clothcraftHybrid,clothcraftLive,
  selectedArea,onSwitchSection,onShowFabric,onSimulate,onReset,onSetLineTarget,objectTab='Scene',draftLineSelection,objectSelection,onPropertyEdit,onNativePropertyEdit,onSelectNativeSeam,onPlaceHardwarePreset,onPairZipperToSeam,
  children,
}) {
  const accessoryKinds=['button','buttonhole','zipper','topstitch','puckering']
  const accessoryTab=accessoryKinds.includes(String(objectTab).toLowerCase())
    ? String(objectTab).toLowerCase():null
  const selectedDraftAccessory=objectSelection?.source==='draft' &&
    accessoryKinds.includes(String(objectSelection.type).toLowerCase())
  const selection=clothcraftHybrid?clothcraftLive?.selection:null
  const nativeLine=clothcraftHybrid?(selection?.kind==='line'?selection:null):draftLineSelection
  const nativeSewing=selection?.kind==='sewing'?selection:null
  const nativePattern=selection?.kind==='pattern'?selection:null
  const referencedNativePanel=clothcraftLive?.panelRefs?.find(p=>p.id===nativePattern?.panelId)
  const nativeObject=clothcraftHybrid&&objectSelection?.source==='native'
    ? (objectSelection.type==='fabric'
      ?clothcraftLive?.fabricRefs?.find(f=>f.id===objectSelection.id)||objectSelection
      :clothcraftLive?.panelRefs?.find(p=>p.id===objectSelection.id)||objectSelection)
    :clothcraftHybrid&&activeSection==='Fabric'&&objectTab==='Fabric'
      ?clothcraftLive?.fabricRefs?.[0]||null:null
  const selectedObjectKind=objectSelection?.source==='library'?'hardware':selectedDraftAccessory
    ?String(objectSelection.type).toLowerCase():clothcraftHybrid && accessoryTab && !objectSelection
      ?accessoryTab:clothcraftHybrid
    ? nativeObject?.type?.toLowerCase() || (objectTab==='Fabric'&&activeSection==='Fabric'?'none'
      : nativeLine?'line':nativeSewing?'sewing':nativePattern?'pattern':'none')
    : (objectSelection?.type==='Scene'&&objectSelection?.pieceId?'pattern':objectSelection?.type?.toLowerCase())
      ||(accessoryTab && !objectSelection ? accessoryTab :null)
      ||(selectedPiece&&objectTab==='Scene'?'pattern':'none')
  const visibleGroups=selectedObjectKind==='none'?[]:CONTEXT_GROUPS[selectedObjectKind] || (selectedObjectKind==='pattern'||selectedObjectKind==='line'||selectedObjectKind==='project'
      ? CLO_PROPERTY_GROUPS
      : CLO_PROPERTY_GROUPS.filter(([id])=>['information','miscellaneous'].includes(id)))
  const draftSelection=(!clothcraftHybrid||selectedDraftAccessory)?(objectSelection?.type==='Scene'&&objectSelection.pieceId
    ? {...objectSelection,type:'pattern'}
    : objectSelection|| (selectedPiece ? {type:'pattern',id:selectedPiece.id,pieceId:selectedPiece.id,name:selectedPiece.name}:null)):null
  const draftObject=resolveCloDraftTarget(project,draftSelection)
  const hardwarePreset=getHardwarePreset(objectSelection?.source==='library'?objectSelection.id:draftObject?.hardwarePresetId)
  const propertySubject=(selectedDraftAccessory?objectSelection.name:null)||(objectSelection?.source==='library'?objectSelection.name:null)||nativeObject?.name||
    (accessoryTab && !objectSelection ? `Choose a ${objectTab.toLowerCase()} · EXO draft`:null)||
    (clothcraftHybrid?(selection?.panelName||'Select a pattern or fabric')
      :(draftObject?.name||objectSelection?.name||selectedPiece?.name||'Select an object'))
  const identityKind=selectedObjectKind==='fabric'?'Fabric':selectedObjectKind==='pattern'?'Pattern Piece':
    selectedObjectKind==='line'?'Pattern Line':selectedObjectKind==='sewing'?'Sewing':
    selectedObjectKind==='none'?'':selectedObjectKind[0].toUpperCase()+selectedObjectKind.slice(1)
  const identityId=nativeObject?.id||nativePattern?.panelId||selection?.panelId||draftSelection?.id||selectedPiece?.id||null
  const identityName=nativeObject?.name||nativePattern?.panelName||selection?.panelName||draftObject?.name||objectSelection?.name||null
  const identityItemNo=nativeObject?.itemNo??referencedNativePanel?.itemNo??nativePattern?.itemNo??draftObject?.itemNo??''
  const commitIdentity=(field,value)=>{
    if(clothcraftHybrid){
      if(!identityId||!['pattern','fabric'].includes(selectedObjectKind))return {ok:false,error:'Select a native pattern or fabric'}
      return onNativePropertyEdit?.({kind:selectedObjectKind,id:identityId,field,value,revision:clothcraftLive?.revision})
        ||{ok:false,error:'Native editor unavailable'}
    }
    if(!draftSelection||!['pattern','fabric'].includes(selectedObjectKind))return {ok:false,error:'Select a pattern or fabric'}
    return onPropertyEdit?.(draftSelection,field,value)||{ok:false,error:'Editor unavailable'}
  }
  // A selected Fabric asset has CLO-style Material and Physical Property
  // accordions, not the generic Pattern "Fabric" accordion. Attach EXO's
  // existing live fabric controls to that visible Physical Property region.
  // Otherwise they were silently portaled into hidden Miscellaneous when
  // switching from the 400-fabric catalog, making the inspector look empty.
  const contextGroup=selectedObjectKind==='fabric'
    ?'physical':EDITOR_GROUP_FOR_SECTION[activeSection]||'miscellaneous'
  const [open,setOpen]=useState(()=>['information'])
  const [materialDetails,setMaterialDetails]=useState({basic:true,reflection:true})
  const toggleMaterialDetail=key=>setMaterialDetails(previous=>({...previous,[key]:!previous[key]}))
  const [lengthUnit,setLengthUnit]=useState('cm')
  const length=cm=>formatPropertyLength(cm,lengthUnit)
  const previousSection=useRef(activeSection)
  useEffect(()=>{
    // Start compact like CLO's category accordion. When the user actually
    // changes workspaces, reveal its relevant advanced fields automatically.
    // Keeping collapsed bodies mounted preserves PatternEditor's portal host.
    if(previousSection.current===activeSection)return
    previousSection.current=activeSection
    setOpen(previous=>previous.includes(contextGroup)?previous:[...previous,contextGroup])
  },[activeSection,contextGroup])
  useEffect(()=>{
    if(activeSection!=='Fabric'||selectedObjectKind!=='fabric')return
    setOpen(previous=>previous.includes('physical')?previous:[...previous,'physical'])
  },[activeSection,selectedObjectKind,fabric?.id])
  const toggle=id=>setOpen(previous=>previous.includes(id)?previous.filter(item=>item!==id):[...previous,id])
  useEffect(()=>{
    // CLO changes its Property Editor schema with the selection, not merely
    // with the top-level workspace tab. Never reuse stale expanded pattern
    // controls for a newly selected Fabric (or vice versa).
    if(selectedObjectKind==='fabric')setOpen(['information','material','physical','fabric'])
    else if(selectedObjectKind==='pattern')setOpen(['information'])
    else if(selectedObjectKind==='line')setOpen(['information','selected-line'])
    else if(selectedObjectKind==='button')setOpen(['information','button','button-material','position'])
    else if(selectedObjectKind==='zipper')setOpen(['information','zipper-style','zipper-mechanics','zipper-extension','zipper-specification','zipper-material'])
    else if(selectedObjectKind==='hardware')setOpen(['information','hardware','hardware-material','construction'])
    else if(selectedObjectKind==='topstitch'||selectedObjectKind==='puckering'||selectedObjectKind==='buttonhole')
      setOpen(['information',selectedObjectKind,...(selectedObjectKind==='buttonhole'?['position']:[])])
    else if(selectedObjectKind==='none')setOpen(['information'])
    else setOpen(['information'])
  },[selectedObjectKind,identityId,objectTab])
  useEffect(()=>{
    if(nativeLine)setOpen(previous=>previous.includes('selected-line')?previous:[...previous,'selected-line'])
  },[nativeLine?.panelId,nativeLine?.edgeId])
  useEffect(()=>{
    if(!objectSelection)return
    const relevant={fabric:'material',button:'button',zipper:'zipper-mechanics',hardware:'hardware',buttonhole:'buttonhole',topstitch:'topstitch',graphic:'graphic',grading:'grading',pom:'pom',puckering:'puckering'}[selectedObjectKind]
    if(relevant)setOpen(previous=>previous.includes(relevant)?previous:[...previous,relevant])
  },[objectSelection?.id,selectedObjectKind])
  const selectedSeams=selectedPiece
    ? (project?.seams||[]).filter(seam=>seam.a?.pieceId===selectedPiece.id||seam.b?.pieceId===selectedPiece.id).length
    : 0
  const selectedFabric=selectedPiece?.fabricId
    ? project?.fabrics?.[selectedPiece.fabricId]
    : fabric

  const overview=id=>{
    switch(id){
      case 'information':
        return <>
          {['pattern','fabric'].includes(selectedObjectKind)&&<>
            <CloEditableIdentity field="name" label="Name" value={identityName||''}
              kind={selectedObjectKind} objectId={identityId||'none'}
              editable={Boolean(identityId)} onCommit={commitIdentity}/>
            <CloEditableIdentity field="itemNo" label="Item No." value={identityItemNo}
              kind={selectedObjectKind} objectId={identityId||'none'}
              editable={Boolean(identityId)} onCommit={commitIdentity}/>
            <CloEditableIdentity field="type" label="Type" value={identityKind}
              kind={selectedObjectKind} objectId={identityId||'none'} editable={false}/>
          </>}
          {!['pattern','fabric'].includes(selectedObjectKind)&&<>
            <Readout label="Name" value={propertySubject}/>
            <Readout label="Type" value={selectedObjectKind==='line'?'Pattern Line':selectedObjectKind==='pattern'?'Pattern Piece':selectedObjectKind==='project'?'Garment Project':selectedObjectKind[0].toUpperCase()+selectedObjectKind.slice(1)}/>
            <Readout label="Item No." value={objectSelection?.id||(clothcraftHybrid?(selection?.edgeId||selection?.panelId||'—'):(selectedPiece?.id||'—'))}/>
            <Readout label="Pattern Pieces" value={clothcraftHybrid?(clothcraftLive?.panels??'Loading'):(project?.pieces?.length??0)}/>
            {!clothcraftHybrid&&selectedPiece&&<Readout label="Area" value={`${selectedArea.toFixed(1)} cm²`}/>}
          </>}
          {nativePattern&&selectedObjectKind==='pattern'&&<><Readout label="2D Perimeter" value={length(nativePattern.length2DCm)}/><Readout label="3D Perimeter" value={length(nativePattern.length3DCm)}/><Readout label="Boundary Count" value={nativePattern.edgeCount}/></>}
          {draftObject&&<CloObjectPropertyFields group="information" selection={draftSelection} project={project}
            onEdit={onPropertyEdit} omitFields={['name','itemNo']}/>}
          {hardwarePreset&&<><Readout label="Style" value={hardwarePreset.name}/><Readout label="Category" value={hardwarePreset.kind}/><Readout label="Finish" value={hardwarePreset.finish}/></>}
          {selectedObjectKind==='fabric'&&clothcraftHybrid&&['construction','supplier','owner'].map(field=>
            <CloEditableIdentity key={field} field={field}
              label={field==='construction'?'Construction':field==='supplier'?'Supplier':'Owner'}
              value={nativeObject?.[field]||''}
              kind="fabric" objectId={identityId||'none'} editable={Boolean(identityId)}
              onCommit={commitIdentity}/>)}
          {clothcraftHybrid&&selectedDraftAccessory&&<p className="clo-pe-note">EXO draft construction annotation. These appearance properties are saved with the EXO draft; buttons, zippers and puckering do not create physical hardware or puckering forces in the live Rust cloth solver.</p>}
          {clothcraftHybrid&&!selectedDraftAccessory&&<p className="clo-pe-note">Native records are edited in ClothCraft; EXO draft values are not substituted. Object Type is structural and cannot be changed with a text edit.</p>}
        </>
      case 'selected-line':
        return <>
          <Readout label="Selected Pattern" value={clothcraftHybrid?(selection?.panelName||'No pattern selected'):(selectedPiece?.name||'No pattern selected')}/>
          <Readout label="Selected Line" value={nativeLine?.edgeId||'Select a line in the 2D or 3D view'}/>
          <Readout label="2D Line Length" value={length(nativeLine?.length2DCm)}/>
          <Readout label="3D Line Length" value={length(nativeLine?.length3DCm)}/>
          <Readout label="3D Stretch" value={nativeLine?.elongationPercent!=null?`${nativeLine.elongationPercent>=0?'+':''}${nativeLine.elongationPercent.toFixed(2)}%`:'—'}/>
          <Readout label="Sewing Links" value={nativeLine?nativeLine.seamIds.join(', ')||'None':selectedSeams}/>
          {nativeLine&&<form className="clo-pe-line-target" onSubmit={event=>{event.preventDefault();const value=toCentimetresValue(Number(event.currentTarget.elements.namedItem('targetLength')?.value),lengthUnit);if(Number.isFinite(value)&&value>=0.01&&value<=1000&&nativeLine.source==='rust')onSetLineTarget?.(nativeLine.panelId,nativeLine.edgeId,value)}}>
            <label htmlFor="clo-pe-target-length">Target 2D length ({lengthUnit})</label>
            <input id="clo-pe-target-length" key={`${nativeLine.panelId}:${nativeLine.edgeId}:${nativeLine.revision}:${lengthUnit}`} name="targetLength" type="number" min={fromCentimetres(.01,lengthUnit)} max={fromCentimetres(1000,lengthUnit)} step="any" defaultValue={fromCentimetres(nativeLine.targetLengthCm??nativeLine.length2DCm,lengthUnit)?.toFixed(lengthUnit==='in'?3:lengthUnit==='mm'?1:2)||''} disabled={nativeLine.source!=='rust'||!onSetLineTarget}/>
            <button type="submit" disabled={nativeLine.source!=='rust'||!onSetLineTarget}>SET LENGTH SPEC</button>
          </form>}
          <div className="clo-pe-line-settings" aria-label="Elastic and seam taping properties">
            <div className="clo-pe-line-subheading">ELASTIC</div>
            <label><span>Elastic</span><input type="checkbox" disabled aria-label="Elastic physical simulation not yet implemented"/></label>
            <Readout label="Strength" value="10 (not simulated)"/>
            <Readout label="Ratio" value="100% (not simulated)"/>
            <Readout label="Segment Length" value={length(nativeLine?.length2DCm)}/>
            <div className="clo-pe-line-subheading">SEAM TAPING</div>
            <label><span>Seam Taping</span><input type="checkbox" disabled aria-label="Seam taping physical simulation not yet implemented"/></label>
            <Readout label="Width" value="— mm"/>
            <Readout label="Preset" value="Not assigned"/>
            <Readout label="Extend" value="None"/>
          </div>
          <p className="clo-pe-note">{nativeLine?.source==='rust'?'2D and 3D lengths come from the same selected Rust boundary, using pattern UVs and live simulated vertices. The editable target length is a drafting specification, not an elastic force.':'2D length comes from the selected EXO draft segment. A corresponding measured 3D simulated boundary is not yet mapped, so no 3D length is invented.'} Elastic and Seam Taping have no physical Rust solver support yet.</p>
          {activeSection!=='Sewing'&&<button className="clo-pe-action" onClick={()=>onSwitchSection('Sewing')}>OPEN SEWING PROPERTIES</button>}
        </>
      case 'sewing':
        return <>
          <Readout label="Sewing Relationship" value={nativeSewing?.seamId||'Select sewing in the native seam list'}/>
          {nativeSewing&&<>
            <Readout label="First Edge" value={`${nativeSewing.first.panel} · ${nativeSewing.first.edge}`}/>
            <Readout label="First 2D Line Length" value={length(nativeSewing.first.length2DCm)}/>
            <Readout label="First 3D Line Length" value={length(nativeSewing.first.length3DCm)}/>
            <Readout label="Second Edge" value={`${nativeSewing.second.panel} · ${nativeSewing.second.edge}`}/>
            <Readout label="Second 2D Line Length" value={length(nativeSewing.second.length2DCm)}/>
            <Readout label="Second 3D Line Length" value={length(nativeSewing.second.length3DCm)}/>
            <Readout label="Measured 3D Seam Gap" value={nativeSewing.gapMm!=null?`${nativeSewing.gapMm.toFixed(2)} mm`:'Not simulated'}/>
            <Readout label="Reverse Orientation" value={nativeSewing.reversed?'Yes':'No'}/>
            <Readout label="Ease Allowed" value={nativeSewing.allowEase?'Yes':'No'}/>
            <Readout label="Native Seam Stiffness" value={nativeSewing.nativeStiffnessNPerM2!=null?`${nativeSewing.nativeStiffnessNPerM2.toFixed(0)} N/m²`:'—'}/>
          </>}
          <div className="clo-pe-line-settings"><div className="clo-pe-line-subheading">SEWING TENSION</div>
          <Readout label="Strength" value="Not implemented"/><Readout label="Ratio" value="Not implemented"/>
          <div className="clo-pe-line-subheading">FOLD</div><Readout label="Turned" value="Not implemented"/>
          <Readout label="Fold Angle" value="Not implemented"/><Readout label="Fold Strength" value="Not implemented"/></div>
          <p className="clo-pe-note">Native Rust reports real paired sewing lengths, seam geometry and correspondence. CLO-style tension and fold controls require new solver constraints; they cannot be emulated by an appearance-only toggle.</p>
        </>
      case 'simulation':
        return <>
          {draftObject&&<CloObjectPropertyFields group="simulation" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          {nativePattern&&selectedObjectKind==='pattern'&&<>
            <Readout label="Actual Rust vertices" value={nativePattern.meshVertexCount}/>
            <Readout label="Actual Rust triangles" value={nativePattern.meshTriangleCount}/>
            <Readout label="Mesh edge target" value={nativePattern.meshTargetEdgeMm!=null?`${nativePattern.meshTargetEdgeMm.toFixed(2)} mm`:'Mesh preset · not specified'}/>
            <Readout label="Material thickness" value={nativePattern.materialThicknessMm!=null?`${nativePattern.materialThicknessMm.toFixed(3)} mm`:'—'}/>
          </>}
          <Readout label="Engine" value={clothcraftHybrid?'ClothCraft · Rust VBD + OGC':'EXO Cloth Simulation'}/>
          <Readout label="Status" value={clothcraftLive?.running?'Running':'Ready / Paused'}/>
          <div className="clo-pe-actions">
            <button type="button" onClick={onSimulate}>SIMULATE / PAUSE</button>
            <button type="button" onClick={onReset}>RESET PANELS</button>
          </div>
          {activeSection!=='Fit'&&<button className="clo-pe-action" onClick={()=>onSwitchSection('Fit')}>OPEN FIT SETTINGS</button>}
          {clothcraftHybrid&&<p className="clo-pe-note">Rust collision and cloth fitting remain experimental, not production certified.</p>}
        </>
      case 'fabric':
        return <>
          <Readout label="Assigned Fabric" value={clothcraftHybrid?(selection?.fabricName||'Select a native panel'):(selectedFabric?.name||'Not assigned')}/>
          {draftObject&&<CloObjectPropertyFields group="fabric" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          {!clothcraftHybrid&&<div className="clo-pe-fabric"><span aria-hidden="true" style={{background:selectedFabric?.color||'#818a96'}}/>
            <strong>{selectedFabric?.name||'Fabric'}</strong>
            <small>{Number.isFinite(selectedFabric?.gsm)?`${selectedFabric.gsm} gsm`:'Material'}</small></div>}
          {clothcraftHybrid&&<p className="clo-pe-note">The native Rust fabric library is available in the Fabric workspace. Draft swatches are not substituted for native physical material properties.</p>}
          {activeSection!=='Fabric'&&<button className="clo-pe-action" onClick={onShowFabric}>OPEN FABRIC PROPERTIES</button>}
        </>
      case 'material':
        return <>
          <Readout label="Material" value="PBR · EXO physically based shading"/>
          <div className="clo-pe-material-faces" role="tablist" aria-label="Material faces">
            <button type="button" role="tab" aria-selected="true">Front</button>
            <button type="button" role="tab" aria-selected="false" disabled title="Independent back-side material not yet supported">Back</button>
            <button type="button" role="tab" aria-selected="false" disabled title="Independent side material not yet supported">Side</button>
          </div>
          <Readout label="Texture Mapping" value="Repeat · project UV"/>
          <Readout label="Type" value="Fabric_Matte · EXO appearance approximation"/>
          <button type="button" className="clo-pe-subtrigger" aria-expanded={materialDetails.basic} aria-controls="clo-pe-material-basic" onClick={()=>toggleMaterialDetail('basic')}>
            {materialDetails.basic?<ChevronDown size={12}/>:<ChevronRight size={12}/>} BASIC PARAMETERS
          </button>
          <div id="clo-pe-material-basic" role="region" aria-label="Basic Parameters" hidden={!materialDetails.basic}>
            <Readout label="Texture" value="Project fabric texture; see Fabric workspace"/>
            <Readout label="Normal Map" value="Material preview; see Fabric workspace"/>
            <Readout label="Displacement Map" value="Not independently assigned"/>
            {draftObject&&<CloObjectPropertyFields group="material" selection={draftSelection} project={project} onEdit={onPropertyEdit} includeFields={['color']}/>}
            <Readout label="Opacity" value="100% · renderer-controlled"/>
            <Readout label="Opacity Map" value="Not assigned"/>
          </div>
          <button type="button" className="clo-pe-subtrigger" aria-expanded={materialDetails.reflection} aria-controls="clo-pe-material-reflection" onClick={()=>toggleMaterialDetail('reflection')}>
            {materialDetails.reflection?<ChevronDown size={12}/>:<ChevronRight size={12}/>} REFLECTION
          </button>
          <div id="clo-pe-material-reflection" role="region" aria-label="Reflection" hidden={!materialDetails.reflection}>
            {draftObject&&<CloObjectPropertyFields group="material" selection={draftSelection} project={project} onEdit={onPropertyEdit} includeFields={['roughness','metalness','sheen']}/>}
            {clothcraftHybrid&&selectedObjectKind==='fabric'&&<p className="clo-pe-note">This Rust material stores physical cloth parameters; independent optical reflection properties are not yet available for this native fabric. No simulated property is changed here.</p>}
          </div>
          <p className="clo-pe-note">Color, roughness, metalness and sheen edit real EXO appearance values. CLO's per-face texture maps, displacement and opacity require additional renderer support; those controls are not falsely enabled.</p>
        </>
      case 'button-material':
        return <>
          {draftObject&&<CloObjectPropertyFields group="button-material" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          <Readout label="Material Type" value={hardwarePreset?.material||'Custom'}/>
          <Readout label="Surface" value={hardwarePreset?.finish||'Custom PBR'}/>
          <p className="clo-pe-note">These values drive the button's 3D appearance. Reflection intensity changes environment reflection and roughness determines highlight spread.</p>
        </>
      case 'zipper-style':
        return <>
          {draftObject&&<CloObjectPropertyFields group="zipper-style" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          <Readout label="Construction" value={hardwarePreset?.zipperType||draftObject?.type||'coil'}/>
          <Readout label="Closure" value={hardwarePreset?.separating?'Separating':'Closed end'}/>
          <Readout label="Components" value="Tape · chain/teeth · slider · puller · end stops"/>
        </>
      case 'zipper-mechanics': {
        const candidates=(project.seams||[]).filter(seam=>['normal','zipper',undefined].includes(seam.type)&&[seam.a,seam.b].some(edge=>edge?.pieceId===draftSelection?.pieceId&&edge.edgeIndex===draftObject?.edgeIndex))
        const linked=(project.seams||[]).find(seam=>seam.id===draftObject?.pairedSeamId)
        const primaryClosed=Math.max(0,Math.min(1,Number(draftObject?.sliderFraction??1)))
        const oppositeOpen=draftObject?.twoWay?Math.max(0,Math.min(1,Number(draftObject.bottomSliderFraction??0))):0
        const middleClosed=Math.max(0,primaryClosed-oppositeOpen)
        return <>
          {draftObject&&<CloObjectPropertyFields group="zipper-mechanics" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          {draftObject&&<label className="clo-pe-zipper-slider"><span>{draftObject.twoWay?'Primary slider · closes from selected opening end':'Drag Zipper Pull'}</span><input type="range" aria-label="Drag Zipper Pull" min="0" max="100" step="1" value={Math.round(primaryClosed*100)} onChange={event=>onPropertyEdit?.(draftSelection,'sliderFraction',Number(event.target.value)/100)}/><strong>{Math.round(primaryClosed*100)}% primary closed</strong></label>}
          {draftObject?.twoWay&&<label className="clo-pe-zipper-slider"><span>Secondary slider · opens from opposite end</span><input type="range" aria-label="Drag Bottom Zipper Pull" min="0" max="100" step="1" value={Math.round(oppositeOpen*100)} onChange={event=>onPropertyEdit?.(draftSelection,'bottomSliderFraction',Number(event.target.value)/100)}/><strong>{Math.round(oppositeOpen*100)}% opposite end open</strong></label>}
          {draftObject?.twoWay&&<div className="clo-pe-zipper-closure" aria-label="Two-way zipper locked chain"><span>Chain engaged</span><strong>{draftObject.fastened===false?0:Math.round(middleClosed*100)}%</strong><div className="clo-pe-zipper-closure-bar"><span style={{width:`${draftObject.fastened===false?0:middleClosed*100}%`}}/></div></div>}
          {draftObject&&<label className="clo-pe-zipper-seam"><span>Sewn Edge Pair</span><select aria-label="Pair zipper with sewn edge" value={linked?.id||''} onChange={event=>onPairZipperToSeam?.(draftSelection.pieceId,draftSelection.itemId,event.target.value)}><option value="">Unpaired (visual hardware only)</option>{candidates.map(seam=><option key={seam.id} value={seam.id}>{seam.name||seam.id}</option>)}</select></label>}
          <p className="clo-pe-note">{linked?`Connected to ${linked.name||linked.id}. ${draftObject?.twoWay?'Both sliders update the EXO draft seam’s independently open ends.':'The slider updates the EXO draft seam opening.'} Full rigid slider collisions and physical tooth interlock are not in the native Rust solver.`:'Create or select a sewing relationship between matching garment edges to enable draft cloth closure. A single-edge zipper remains visual.'}</p>
        </>
      }
      case 'zipper-extension':
        return <>
          {draftObject&&<CloObjectPropertyFields group="zipper-extension" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          <p className="clo-pe-note">Start and end distances extend their respective rendered zipper terminals along the garment edge direction. Legacy zippers without a Start Extension setting continue to use End Extension for both ends until customized.</p>
        </>
      case 'zipper-specification':
        return <>
          {draftObject&&<CloObjectPropertyFields group="zipper-specification" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          <Readout label="Supplier gauge" value={hardwarePreset?.sizeCode||'Illustrative'}/>
          <Readout label="Slider reference length" value={`${hardwarePreset?.dimensionsMm?.sliderLength??'—'} mm`}/>
          <p className="clo-pe-note">Component dimensions are visual millimetre values; select a sewn edge pair to couple the Draft cloth opening.</p>
        </>
      case 'zipper-material':
        return <>
          {draftObject&&<CloObjectPropertyFields group="zipper-material" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          <Readout label="Tape Fabric" value={hardwarePreset?.material||'Custom'}/>
          <p className="clo-pe-note">Separate chain, tape, slider, puller and stopper colors are rendered using PBR values. Per-component texture maps and measured physical textile behavior remain future renderer and solver work.</p>
        </>
      case 'hardware':
        return <>
          <Readout label="Mount" value={hardwarePreset?.mount||hardwarePreset?.zipperType||hardwarePreset?.kind||'—'}/>
          {Object.entries(hardwarePreset?.dimensionsMm||{}).map(([key,value])=><Readout key={key} label={key.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase())} value={`${value} mm`}/>)}
          {hardwarePreset?.holes!=null&&<Readout label="Sewing Holes" value={hardwarePreset.holes}/>}
          {hardwarePreset?.components&&<Readout label="Components" value={hardwarePreset.components.join(', ')}/>}
        </>
      case 'hardware-material':
        return <>
          <Readout label="Base Material" value={hardwarePreset?.material||'—'}/>
          <Readout label="Finish" value={hardwarePreset?.finish||'—'}/>
          <div className="clo-pe-fabric"><span style={{background:hardwarePreset?.pbr.baseColor||'#888888'}}/><strong>Base Color</strong><small>{hardwarePreset?.pbr.baseColor||'—'}</small></div>
          <Readout label="Metalness" value={hardwarePreset?.pbr.metalness?.toFixed(2)||'—'}/>
          <Readout label="Roughness" value={hardwarePreset?.pbr.roughness?.toFixed(2)||'—'}/>
          <p className="clo-pe-note">Library reference values; place a supported style on a draft pattern to edit its individual optical and size parameters.</p>
        </>
      case 'construction':
        return <>
          <p className="clo-pe-note">{hardwarePreset?.construction||'No construction instructions available.'}</p>
          <Readout label="Measurement Status" value={hardwarePreset?.measurementStatus||'—'}/>
          {['button','buttonhole','zipper'].includes(hardwarePreset?.kind)&&<button type="button" className="clo-pe-action" disabled={clothcraftHybrid||!selectedPiece} onClick={()=>onPlaceHardwarePreset?.(hardwarePreset.id)}>PLACE {hardwarePreset.kind.toUpperCase()} ON SELECTED PATTERN</button>}
          {clothcraftHybrid&&<p className="clo-pe-note">Library reference only in native mode; draft button hardware is not installed into the Rust garment.</p>}
          {!['button','buttonhole','zipper'].includes(hardwarePreset?.kind)&&<p className="clo-pe-note">Detailed placement and physical attachment for this hardware family are in development.</p>}
        </>
      case 'physical':
        return <>
          {draftObject&&<CloObjectPropertyFields group="physical" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          <p className="clo-pe-note">Real-world fabric calibration requires measured specimens. These are EXO draft approximations; native Rust fabric physics is managed separately.</p>
        </>
      case 'bond':
        return <>
          <Readout label="Bond" value="Not configured"/>
          <p className="clo-pe-note">Bond/Skive is a separate physical reinforcement property in CLO. No equivalent native Rust bonding command is connected yet.</p>
        </>
      case 'solidify':
        return <>
          <Readout label="Solidify" value="Not enabled"/>
          <p className="clo-pe-note">CLO Solidify maintains a selected pattern’s simulated 3D shape. This Rust solver has no equivalent Solidify strength property yet; the UI does not change physics.</p>
        </>
      case 'arrange':
        return <>
          {draftObject&&<CloObjectPropertyFields group="arrange" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          {selectedObjectKind==='pattern'&&nativePattern?.grainAngleDeg!=null&&<Readout label="Native Grain Direction" value={`${nativePattern.grainAngleDeg.toFixed(2)}°`}/>}
          {selectedObjectKind==='pattern'&&nativePattern?.rotationDeg?.map((deg,index)=><Readout key={`rot-${index}`} label={`3D Rotation ${'XYZ'[index]}`} value={`${deg.toFixed(2)}°`}/>)}
          <Readout label="Pattern" value={clothcraftHybrid?(selection?.panelName||'No pattern selected'):(selectedPiece?.name||'No pattern selected')}/>
          {clothcraftHybrid&&selection?.positionCm?.map((cm,index)=><Readout key={index} label={`Position ${'XYZ'[index]}`} value={`${cm.toFixed(1)} cm`}/>)}
          {!clothcraftHybrid&&selectedPiece&&['X','Y','Z'].map(axis=><Readout key={axis} label={`Position ${axis}`}
            value={`${(Number(selectedPiece.arrangement3d?.[`stagingOffset${axis}`]||0)*100).toFixed(1)} cm`}/>)}
          {activeSection!=='Pattern'&&<button className="clo-pe-action" onClick={()=>onSwitchSection('Pattern')}>OPEN PATTERN ARRANGEMENT</button>}
          <p className="clo-pe-note">Use the Move tool in 3D to reposition a draped panel; reset to arrange the starting pattern.</p>
          {/* PatternEditor portals precision controls here. Its target must
              remain the SAME DOM node as workspaces change or accordions
              collapse, or the drafting controls would become detached. */}
          <div id="clo-pattern-properties-host" className="clo-pattern-properties-host"
            hidden={!['Pattern','Sewing','Production'].includes(activeSection)}/>
        </>
      case 'miscellaneous':
        return <>
          <Readout label="Workspace" value={activeSection}/>
          {!draftObject&&objectSelection&&<p className="clo-pe-note">Selected {selectedObjectKind} has no validated editable settings in this session. Its unavailable CLO properties are documented in the property parity audit.</p>}
          {activeSection!=='Render'&&<button className="clo-pe-action" onClick={()=>onSwitchSection('Render')}>RENDER / ENVIRONMENT SETTINGS</button>}
        </>
      case 'button':case 'buttonhole':case 'topstitch':case 'graphic':case 'position':
        return draftObject?<CloObjectPropertyFields group={id} selection={draftSelection} project={project} onEdit={onPropertyEdit}/>:<p className="clo-pe-note">Select an EXO draft object to edit these properties. Rust garment objects have separate schemas and must not inherit EXO draft values.</p>
      case 'grading':
        return <><Readout label="Size" value={objectSelection?.id||'—'}/><Readout label="Available Sizes" value={project.grading?.sizes?.join(', ')||'—'}/><p className="clo-pe-note">Grading rules and size deltas are authored in the Production workspace. Selection does not mutate the base pattern.</p></>
      case 'pom': {
        const pom=project.customMeasurements?.find((m,i)=>String(m.id??i)===String(objectSelection?.id))
        return <><Readout label="Measurement" value={pom?.name||'—'}/><Readout label="Draft Value" value={typeof pom?.valueCm==='number'?`${pom.valueCm.toFixed(2)} cm`:'Not independently measured'}/><p className="clo-pe-note">See Production for traced 2D/3D POM construction and size grading. Unmapped 3D length is never copied from the 2D value.</p></>
      }
      case 'puckering':return draftObject?<CloObjectPropertyFields group="puckering" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>:<p className="clo-pe-note">Select or add an EXO draft puckering annotation in Object Browser to edit its visible construction specifications. The native Rust solver does not currently implement fabric puckering forces.</p>
      default:return null
    }
  }

  return <>
    <div className="inspector-head clo-pe-header"><span>PROPERTY EDITOR</span><strong>{propertySubject}</strong></div>
    <label className="clo-pe-unit-selection">Measurement Display
      <select aria-label="Property Editor length unit" value={lengthUnit} onChange={event=>setLengthUnit(event.target.value)}>
        {CLO_LENGTH_UNITS.map(unit=><option key={unit} value={unit}>{unit}</option>)}
      </select>
    </label>
    {clothcraftHybrid&&activeSection==='Sewing'&&!accessoryTab&&!selectedDraftAccessory&&clothcraftLive?.seamRefs?.length>0&&
      <label className="clo-pe-native-seam-picker">Sewing Relationship
        <select aria-label="Select native sewing relationship" value={nativeSewing?.seamId||''}
          onChange={event=>onSelectNativeSeam?.(event.target.value)}>
          <option value="">Select a sewn edge pair…</option>
          {clothcraftLive.seamRefs.map(ref=><option key={ref.id} value={ref.id}>{ref.id} · {ref.first} ↔ {ref.second}</option>)}
        </select>
      </label>}
    <div className="clo-pe-list" aria-label="Property Editor sections">
      {selectedObjectKind==='none'&&<div className="clo-pe-empty" role="status">
        Select a pattern in the 2D or 3D viewport, or select a fabric in Object Browser, to edit its properties.
      </div>}
      {visibleGroups.map(([id,title])=>{
        const expanded=open.includes(id)
        return <section key={id} className={`clo-pe-section ${expanded?'expanded':''}`}>
          <button type="button" className="clo-pe-trigger" aria-expanded={expanded}
            aria-controls={`clo-pe-section-${id}`} onClick={()=>toggle(id)}>
            {expanded?<ChevronDown size={13}/>:<ChevronRight size={13}/>}
            <span>{title}</span>
          </button>
          <div id={`clo-pe-section-${id}`} role="region" hidden={!expanded}
            aria-label={`${title} properties`} className="clo-pe-content">
            {overview(id)}
            {(id===contextGroup||(!visibleGroups.some(([key])=>key===contextGroup)&&id==='miscellaneous'))&&<div className="clo-pe-existing-properties" aria-label={`${title} advanced settings`}>{children}</div>}
          </div>
        </section>
      })}
    </div>
    {!visibleGroups.some(([id])=>id==='arrange')&&<div id="clo-pattern-properties-host" className="clo-pattern-properties-host" hidden/>}
  </>
}
