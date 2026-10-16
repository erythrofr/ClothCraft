import React, { useEffect, useState } from 'react'
import CadToolIcon from './CadToolIcon.jsx'
import { RotateCcw } from 'lucide-react'
import {CLO7_2D_A,CLO7_2D_B} from '../data/clo7ToolbarOrder.js'
import {getClo7NativeCapability} from '../core/clo7NativeToolCapabilities.js'

// Original EXO workspace actions plus a 2D polygon creation shortcut. This inventory is not a claim
// that the proprietary CLO toolbar contains exactly these controls, nor that
// unfinished features work. Planned commands are explicitly disabled.
export const RIGHT_PALETTE_TOOLS = [
  ['select-3d','Select and transform 3D fabric','transform'],
  ['move-3d','Move 3D fabric','move'],
  ['rotate-3d','Rotate 3D fabric','rotate'],
  ['hand','Fabric hand','hand'],
  ['surface','Surface / strain view','analysis'],
  ['wireframe','Toggle mesh wireframe','wireframe'],
  ['seam-links','3D sewing correspondence','seams'],
  ['select-2d','2D pattern select','select'],
  ['points','Edit pattern points','point'],
  ['split','Split pattern edge','split'],
  ['curve','Adjust pattern curve','curve'],
  ['internal','Internal line / dart','internal'],
  ['notch','Pattern notch','notch'],
  ['measure','Tape measure / ruler','measure'],
  ['pin','Cloth pin','pin'],
  ['sew','Free sewing','sew'],
  ['fastener','Button or snap fastener','fastener'],
  ['fabric','Fabric browser','Fabric'],
  ['graphics','Graphic browser','Graphic'],
  ['buttons','Button browser','Button'],
  ['buttonholes','Buttonhole browser','Buttonhole'],
  ['topstitch','Topstitch browser','Topstitch'],
  ['trim','Trims / zipper','Trim'],
  ['grading','Grading browser','Grading'],
  ['pom','Points of measure','POM'],
  ['scene','Scene hierarchy','Scene'],
  ['material','Fabric physical properties','fabric-edit'],
  ['fit','Fit analysis','fit'],
  ['simulate','Simulate / pause','simulate'],
  ['reset','Reset flat arrangement','reset'],
  ['camera','Fit 3D view','camera'],
  ['mirror','Create mirrored pattern copy','mirror-pattern'],
  ['export','Export garment file','export'],
  ['seam-weld','Physical seam-closure tool',null],
  ['polygon-tool','Create polygon pattern','create-polygon'],
]

// Workflows affect the *layout*, not the underlying editing actions. Every
// original command remains accessible in All tools, including planned/disabled
// functionality. An action appears in exactly one group within a workflow.
const FOCUSED_GROUPS = {
  Pattern: [
    ['DRAFT', ['select-2d','points','split','curve','internal','notch','measure','mirror']],
    ['ON BODY', ['select-3d','move-3d','rotate-3d','hand','camera']],
    ['DISPLAY', ['scene','seam-links','wireframe']],
  ],
  Sewing: [
    ['SEW & ATTACH', ['sew','seam-links','pin','fastener','buttons','buttonholes','topstitch','trim']],
    ['PATTERN', ['select-2d','points','measure','scene']],
    ['SIMULATION', ['simulate','reset','camera']],
  ],
  Fabric: [
    ['MATERIALS', ['fabric','material','graphics','trim','scene']],
    ['INSPECT', ['select-3d','hand','surface','wireframe','camera']],
    ['SIMULATION', ['simulate','reset']],
  ],
  Avatar: [
    ['VIEW AVATAR', ['select-3d','move-3d','rotate-3d','hand','camera']],
    ['DISPLAY', ['scene','surface','wireframe','seam-links']],
    ['FIT', ['fit','simulate','reset']],
  ],
  Fit: [
    ['ANALYZE', ['surface','wireframe','seam-links','fit']],
    ['SIMULATION', ['simulate','reset']],
    ['VIEW', ['select-3d','move-3d','hand','camera','scene']],
  ],
  Production: [
    ['PRODUCTION', ['grading','pom','measure','export']],
    ['DRAFT', ['select-2d','points','split','curve','mirror']],
    ['SCENE', ['scene','camera']],
  ],
  Render: [
    ['CAMERA & VIEW', ['select-3d','hand','camera','surface','wireframe']],
    ['PROJECT', ['scene','fabric','graphics','export']],
  ],
}
const ALL_GROUPS = [
  ['3D GARMENT', ['select-3d','move-3d','rotate-3d','hand','surface','wireframe','seam-links']],
  ['2D PATTERN', ['select-2d','points','split','curve','internal','notch','measure','pin','mirror']],
  ['SEWING', ['sew','fastener','buttons','buttonholes','topstitch','trim','seam-weld']],
  ['BROWSERS', ['fabric','graphics','grading','pom','scene','material','fit']],
  ['RUN & EXPORT', ['simulate','reset','camera','export']],
]
// CLO 7.0.242 screenshot (2026-10-12): the strip to the RIGHT of the 2D
// viewport consists of two independent vertical columns, reading A1, B1,
// A2, B2 by row. Place only semantically corresponding *functional* EXO tools
// in this reference section. CLO-specific missing tools remain catalogued in
// docs/CLO_V7_EXACT_DUAL_TOOLBAR_ORDER_2026-10-16.md rather than faked.
// The remaining EXO actions are retained in a separate, labelled section.
export const CLO_REFERENCE_LEFT_COLUMN = [
  'select-2d','points','split','polygon-tool','internal','measure','grading',
]
export const CLO_REFERENCE_RIGHT_COLUMN = [
  'curve','graphics','topstitch','seam-links',
]
const EXO_EXTRA_TOOL_IDS = RIGHT_PALETTE_TOOLS.map(([id])=>id)
  .filter(id=>!CLO_REFERENCE_LEFT_COLUMN.includes(id) && !CLO_REFERENCE_RIGHT_COLUMN.includes(id))
export const EXO_EXTRA_LEFT_COLUMN = EXO_EXTRA_TOOL_IDS.filter((_,i)=>i%2===0)
export const EXO_EXTRA_RIGHT_COLUMN = EXO_EXTRA_TOOL_IDS.filter((_,i)=>i%2===1)
const TOOL_BY_ID = new Map(RIGHT_PALETTE_TOOLS.map(item => [item[0], item]))
const WORKFLOW_TABS = [
  ['Pattern', 'select-2d'],
  ['Sewing', 'sew'],
  ['Fabric', 'fabric'],
  ['Fit', 'fit'],
]
// EXO defaults to the complete action palette, matching the
// requested desktop workspace. Compact workflow subsets remain optional.
const MODE_KEY = 'garment-studio-right-tools-mode-v2'

export default function RightToolPalette({ activeSection, viewportTool, tool, setViewportTool, setTool, setActiveSection, setObjectTab, onRevealBrowser, showSewingGuides, setShowSewingGuides, wireframe, setWireframe, analysisMode, setAnalysisMode, toggleSimulation, resetSimulation, exportProject, onFitCamera, onMirrorSelected, onCreatePolygon, onCloTool, nativeClothcraft=false, running }) {
  const [showAll, setShowAll] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) !== 'focused' } catch { return true }
  })
  const [showReferenceMap, setShowReferenceMap] = useState(true)
  const [showExtras, setShowExtras] = useState(false)
  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, showAll ? 'all' : 'focused') } catch { /* private mode */ }
  }, [showAll])
  const activateWorkflow = (section) => {
    setActiveSection(section)
    setObjectTab(section === 'Fabric' ? 'Fabric' : 'Scene')
    onRevealBrowser?.()
  }
  const click = (action) => {
    if (action === 'create-polygon') return onCreatePolygon?.()
    if (['orbit','transform','move','rotate','hand'].includes(action)) return setViewportTool(action)
    if (['select','point','split','curve','internal','notch','measure','pin','sew','fastener'].includes(action)) {
      setTool(action)
      if (nativeClothcraft && ['select','point','curve','sew','internal'].includes(action))
        window.dispatchEvent(new CustomEvent('exo-clothcraft-select-2d-tool',{detail:{tool:action}}))
      if (action === 'sew' || action === 'fastener') setActiveSection('Sewing')
      else setActiveSection('Pattern')
      return
    }
    if (['Scene','Fabric','Graphic','Button','Buttonhole','Topstitch','Trim','Grading','POM'].includes(action)) {
      setObjectTab(action)
      onRevealBrowser?.()
      setActiveSection(action === 'Fabric' || action === 'Graphic' ? 'Fabric' : ['Button','Buttonhole','Topstitch','Trim'].includes(action) ? 'Sewing' : ['Grading','POM'].includes(action) ? 'Production' : 'Pattern')
      return
    }
    if (action === 'analysis') return setAnalysisMode(analysisMode === 'strain' ? 'surface' : 'strain')
    if (action === 'wireframe') return setWireframe(!wireframe)
    if (action === 'seams') return setShowSewingGuides(!showSewingGuides)
    if (action === 'fabric-edit') { setObjectTab('Fabric'); onRevealBrowser?.(); return setActiveSection('Fabric') }
    if (action === 'fit') return setActiveSection('Fit')
    if (action === 'simulate') return toggleSimulation()
    if (action === 'reset') return resetSimulation()
    if (action === 'export') return exportProject()
    if (action === 'camera') return onFitCamera?.()
    if (action === 'mirror-pattern') return onMirrorSelected?.()
  }
  const active = (action) => action === viewportTool || (action === tool && (activeSection === 'Pattern' || activeSection === 'Sewing')) || (action === 'wireframe' && wireframe) || (action === 'seams' && showSewingGuides) || (action === 'analysis' && analysisMode === 'strain') || (action === 'simulate' && running)
  const groups = showAll ? ALL_GROUPS : (FOCUSED_GROUPS[activeSection] || FOCUSED_GROUPS.Pattern)
  const renderAction = (id) => {
    const item = TOOL_BY_ID.get(id)
    if (!item) return null
    const [itemId, label, action] = item
    const actionButton=<button key={itemId} type="button" title={action ? label : `${label} · planned`} aria-label={label} aria-pressed={Boolean(action && active(action))} disabled={!action} className={active(action) ? 'active' : ''} onClick={() => click(action)}><CadToolIcon id={itemId} size={20}/></button>
    return actionButton
  }
  const mappedReferenceAction=slot=>{
    if(nativeClothcraft)return getClo7NativeCapability('2d',slot.id)?.mode==='native'
    const action=TOOL_BY_ID.get(slot.icon)?.[2]
    // Do not expose legacy V1-only CAD edits as operational in the Rust V2
    // pattern viewport. That editor has its own validated command surface.
    if(nativeClothcraft && !['select','point','curve','internal','seams','sew'].includes(slot.action))return false
    return Boolean(slot.action && slot.action===action)
  }
  const visibleReferenceCount = [...CLO7_2D_A,...CLO7_2D_B]
    .filter(slot=>showReferenceMap || mappedReferenceAction(slot)).length
  const visibleCount = showAll
    ? visibleReferenceCount + (showExtras?EXO_EXTRA_TOOL_IDS.length:0)
    : groups.reduce((count, [, ids]) => count + ids.length, 0)
  const referenceTotal = CLO7_2D_A.length+CLO7_2D_B.length
  const totalCount = showAll?referenceTotal+(showExtras?EXO_EXTRA_TOOL_IDS.length:0):RIGHT_PALETTE_TOOLS.length
  const renderCloReference = slot => {
    const mapped=mappedReferenceAction(slot)
    const offersDetails=typeof onCloTool==='function'
    return <button key={slot.id} data-clo-slot={`2d:${slot.id}`}
      type="button" aria-label={slot.label}
      title={`${slot.label} · Click for tool actions and implementation details`}
      disabled={!mapped&&!offersDetails}
      data-clo-implementation={getClo7NativeCapability('2d',slot.id)?.mode||'unavailable'}
      aria-pressed={Boolean(mapped && active(slot.action))}
      className={`${mapped?'clo-supported-tool':'clo-tool-inquire'} ${mapped&&active(slot.action)?'active':''}`}
      style={slot.after?{marginBottom:9}:undefined}
      onClick={offersDetails?()=>onCloTool(slot,'2d'):(mapped?()=>click(slot.action):undefined)}>
      <CadToolIcon id={slot.icon} size={20}/>
    </button>
  }
  return <nav className={`clo-right-tool-palette ${showAll ? 'all-tools' : 'focused-tools'}`} aria-label="Right workspace tools">
    <div className="clo-tool-palette-label">
      <button type="button" className="clo-palette-mode-text"
        aria-label={showAll ? 'Switch to focused workspace tools' : 'Show CLO-ordered 2D tools'}
        aria-pressed={showAll}
        title={showAll?'CLO-ordered 2D tools · select for focused workspace mode':'Focused tools · select for CLO-ordered tools'}
        onClick={()=>setShowAll(value=>!value)}>{showAll?'TOOLS':'FOCUS'}</button>
      {showAll && <button type="button" className="clo-palette-mode-text"
        aria-label={showReferenceMap?'Hide unfinished CLO 2D reference tools':'Show complete CLO 2D reference map'}
        aria-pressed={showReferenceMap} title={showReferenceMap?'Hide unfinished reference icons':'Show all CLO reference positions, including unimplemented tools'}
        onClick={()=>setShowReferenceMap(value=>!value)}>{showReferenceMap?'HIDE':'MAP'}</button>}
    </div>
    <div className="clo-palette-workflows" aria-label="Quick workflow switching">
      {WORKFLOW_TABS.map(([section, iconId]) => <button key={section} type="button" aria-label={`Switch to ${section} tools`} aria-pressed={activeSection === section} title={`${section} tools`} className={activeSection === section ? 'active' : ''} onClick={() => activateWorkflow(section)}><CadToolIcon id={iconId} size={19}/></button>)}
    </div>
    <div className="clo-palette-scroll" aria-live="off">
      {showAll ? <>
        <div className="clo-tool-palette-group-divider" aria-label="CLO version 7 two-column pattern reference">2D TOOLS</div>
        <div className="clo-reference-dual-bars" aria-label="CLO-inspired independent drafting and sewing tool columns">
        <div className="clo-reference-column clo-right-tool-grid" aria-label="CLO 2D column A">{(showReferenceMap?CLO7_2D_A:CLO7_2D_A.filter(mappedReferenceAction)).map(renderCloReference)}</div>
        <div className="clo-reference-column clo-right-tool-grid" aria-label="CLO 2D column B">{(showReferenceMap?CLO7_2D_B:CLO7_2D_B.filter(mappedReferenceAction)).map(renderCloReference)}</div>
        </div>
        <button type="button" className="clo-tool-palette-group-divider clo-extra-group-toggle"
          aria-label={showExtras?'Collapse additional EXO tools':'Expand additional EXO tools'}
          aria-expanded={showExtras}
          onClick={()=>setShowExtras(value=>!value)}>EXO TOOLS {showExtras?'▾':'▸'}</button>
        {showExtras && <div className="clo-reference-dual-bars" aria-label="Additional EXO tools not assigned to the CLO 7 2D reference strips">
          <div className="clo-reference-column clo-right-tool-grid" aria-label="EXO additional column A">{EXO_EXTRA_LEFT_COLUMN.map(renderAction)}</div>
          <div className="clo-reference-column clo-right-tool-grid" aria-label="EXO additional column B">{EXO_EXTRA_RIGHT_COLUMN.map(renderAction)}</div>
        </div>}
      </> : groups.map(([name, ids]) => <div className="clo-palette-group" key={name}>
        <div className="clo-palette-group-label" title={name}>{name}</div>
        <div className="clo-right-tool-grid">{ids.map(renderAction)}</div>
      </div>)}
    </div>
    <button type="button" className="clo-reset-fabric-panels" aria-label="Reset fabric panels" title="Reset fabric panels to their initial arrangement; preserve patterns, sewing and materials" onClick={resetSimulation} style={{alignSelf:"flex-end",margin:"6px 3px",padding:"6px 2px",fontSize:8,width:"calc(100% - 6px)",minHeight:54,display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"#32373d",color:"#e6edf3"}}><RotateCcw size={18}/><span>RESET<br/>PANELS</span></button>
    <div className="clo-palette-count"
      title={showAll?
        `${visibleReferenceCount} CLO reference positions displayed out of ${referenceTotal}; ${showExtras?EXO_EXTRA_TOOL_IDS.length:0} additional EXO buttons expanded. Inactive reference tools are only visible in MAP mode.`:
        `${visibleCount} buttons in this focused workspace group, ${RIGHT_PALETTE_TOOLS.length} total EXO actions.`}>
      {visibleCount}<span>/{totalCount}</span>
    </div>
  </nav>
}
