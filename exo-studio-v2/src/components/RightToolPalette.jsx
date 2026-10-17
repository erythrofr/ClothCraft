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
  ['seam-allowance','Seam allowance cutting guide','allowance'],
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
  ['annotation-add','Add persistent pattern annotation','annotation-add'],
  ['annotation-edit','Edit persistent pattern annotation','annotation-edit'],
]

// Workflows affect the *layout*, not the underlying editing actions. Every
// original command remains accessible in All tools, including planned/disabled
// functionality. An action appears in exactly one group within a workflow.
const FOCUSED_GROUPS = {
  Pattern: [
    ['DRAFT', ['select-2d','points','split','curve','internal','annotation-add','annotation-edit','notch','seam-allowance','measure','mirror']],
    ['ON BODY', ['select-3d','move-3d','rotate-3d','hand','camera']],
    ['DISPLAY', ['scene','seam-links','surface','wireframe']],
  ],
  Sewing: [
    ['SEW & ATTACH', ['sew','seam-links','pin','fastener','buttons','buttonholes','topstitch','trim']],
    ['PATTERN', ['select-2d','points','notch','seam-allowance','measure','scene']],
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
    ['DRAFT', ['select-2d','points','split','curve','notch','seam-allowance','mirror']],
    ['SCENE', ['scene','camera']],
  ],
  Render: [
    ['CAMERA & VIEW', ['select-3d','hand','camera','surface','wireframe']],
    ['PROJECT', ['scene','fabric','graphics','export']],
  ],
}
const ALL_GROUPS = [
  ['3D GARMENT', ['select-3d','move-3d','rotate-3d','hand','surface','wireframe','seam-links']],
  ['2D PATTERN', ['select-2d','points','split','curve','internal','annotation-add','annotation-edit','notch','seam-allowance','measure','pin','mirror']],
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
// Exclude only actions genuinely present in the rendered reference map.
// Old column arrays listed Split/Curve although the new CLO inventory did not,
// which made those working EXO actions disappear from All tools entirely.
const REFERENCE_NATIVE_ACTION_IDS = new Set(['select-2d','points','polygon-tool','internal','notch','seam-allowance','sew'])
const EXO_EXTRA_TOOL_IDS = RIGHT_PALETTE_TOOLS.map(([id])=>id)
  .filter(id=>!REFERENCE_NATIVE_ACTION_IDS.has(id))
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
// New persisted key intentionally resets older focused-only layouts once, so
// returning users see the restored complete CLO tool strips on first launch.
const MODE_KEY = 'garment-studio-right-tools-mode-v3'
const NATIVE_2D_SLOT_BY_ID = new Map([...CLO7_2D_A,...CLO7_2D_B].map(slot => [slot.id,slot]))
const UNSUPPORTED_NATIVE_ACTIONS = new Set(['pin','fastener'])
// The supplemental strip shares native authoring commands with the CLO strip.
// Resolve through one verified capability so these shortcuts cannot drift into
// a different editor or offer an operation that Rust does not support.
const NATIVE_EXTRA_CAPABILITIES = Object.freeze({
  select: 'A01', point: 'A02', 'create-polygon': 'A04', internal: 'A05',
  notch: 'A08', allowance: 'A09', sew: 'B03', measure: 'A11',
  'annotation-add':'A14', 'annotation-edit':'A13',
})
// Every slot's artwork must be an identified CAD symbol. These supplemental
// commands have no dedicated asset and previously fell back to the generic
// cursor, making distinct authoring operations look like placeholders.
const EXTRA_ICON_ALIASES = Object.freeze({
  'seam-allowance':'internal',
  'annotation-add':'pattern-properties',
  'annotation-edit':'pattern-properties',
})
const nativeExtraCapability = action => NATIVE_EXTRA_CAPABILITIES[action]
  ? getClo7NativeCapability('2d', NATIVE_EXTRA_CAPABILITIES[action]) : null
const canInvokeNativeCapability = capability => ['native','inspect'].includes(capability?.mode)
// App's native command dispatcher stores the selected tool using these names.
// Keep the highlight synchronized with the command actually sent to the editor.
const NATIVE_SELECTED_TOOLS = Object.freeze({
  'create-polygon':'polygon', 'annotation-add':'annotation',
  'annotation-edit':'annotation-edit', 'allowance':'allowance',
})
const NATIVE_SLOT_SELECTED_TOOLS = Object.freeze({
  A01:'select', A02:'point', A04:'polygon', A05:'internal', A06:'base-polygon',
  A07:'trace', A08:'notch', A09:'allowance', A13:'annotation-edit',
  A14:'annotation', B02:'sew', B03:'sew',
})

export default function RightToolPalette({ activeSection, viewportTool, tool, setViewportTool, setTool, setActiveSection, setObjectTab, onRevealBrowser, showSewingGuides, setShowSewingGuides, wireframe, setWireframe, analysisMode, setAnalysisMode, toggleSimulation, resetSimulation, onReset2d, exportProject, onFitCamera, onMirrorSelected, onCreatePolygon, onCloTool, nativeClothcraft=false, running }) {
  const [showAll, setShowAll] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) !== 'focused' } catch { return true }
  })
  // Match the observed dual CLO strip without collapsing unimplemented slots
  // and shifting the remaining icons into misleading row positions.
  const [showExtras, setShowExtras] = useState(true)
  const [feedback, setFeedback] = useState('')
  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, showAll ? 'all' : 'focused') } catch { /* private mode */ }
  }, [showAll])
  const activateWorkflow = (section) => {
    setActiveSection(section)
    setObjectTab(section === 'Fabric' ? 'Fabric' : 'Scene')
    onRevealBrowser?.()
  }
  const click = (action) => {
    setFeedback('')
    if (nativeClothcraft && NATIVE_EXTRA_CAPABILITIES[action] && typeof onCloTool === 'function') {
      const position=NATIVE_EXTRA_CAPABILITIES[action]
      const capability=nativeExtraCapability(action)
      if (canInvokeNativeCapability(capability))
        return onCloTool(NATIVE_2D_SLOT_BY_ID.get(position),'2d')
      setFeedback(`${capability?.label||action} is unavailable in the native editor.`)
      return
    }
    if (nativeClothcraft && ['notch','allowance'].includes(action)) {
      setFeedback('This native tool requires the CLO 2D command handler.')
      return
    }
    if (nativeClothcraft && (action === 'split' || action === 'curve')) {
      setTool(action)
      setActiveSection('Pattern')
      window.dispatchEvent(new CustomEvent('exo-clothcraft-select-2d-tool',{detail:{tool:action}}))
      return
    }
    if (action === 'mirror-pattern') return onMirrorSelected?.()
    if (nativeClothcraft && UNSUPPORTED_NATIVE_ACTIONS.has(action)) {
      setFeedback(`${RIGHT_PALETTE_TOOLS.find(item => item[2] === action)?.[1] || action} is not yet supported by the native V2 editor.`)
      return
    }
    if (action === 'create-polygon') return onCreatePolygon?.()
    if (['orbit','transform','move','rotate','hand'].includes(action)) return setViewportTool(action)
    if (['select','point','split','curve','internal','notch','measure','pin','sew','fastener'].includes(action)) {
      setTool(action)
      if (nativeClothcraft && ['select','point','split','curve','sew','internal','measure'].includes(action))
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
    if (action === 'reset') return nativeClothcraft ? onReset2d?.() : resetSimulation()
    if (action === 'export') return exportProject()
    if (action === 'camera') return onFitCamera?.()
  }
  const active = (action) => Boolean(action) && ((action === viewportTool) || ((nativeClothcraft ? NATIVE_SELECTED_TOOLS[action] || action : action) === tool && (activeSection === 'Pattern' || activeSection === 'Sewing')) || (action === 'wireframe' && wireframe) || (action === 'seams' && showSewingGuides) || (action === 'analysis' && analysisMode === 'strain') || (action === 'simulate' && running))
  // Only advertise actions with a command or a functioning native workspace
  // callback. Planned tooling stays in the source inventory for future releases.
  const availableAction = (action) => {
    if (!action) return false
    if (nativeClothcraft && UNSUPPORTED_NATIVE_ACTIONS.has(action)) return false
    if (nativeClothcraft && NATIVE_EXTRA_CAPABILITIES[action]) {
      return typeof onCloTool==='function' && canInvokeNativeCapability(nativeExtraCapability(action))
    }
    if (nativeClothcraft && ['split','curve'].includes(action)) return typeof setTool==='function' && typeof setActiveSection==='function'
    if (action==='mirror-pattern') return typeof onMirrorSelected==='function'
    if (action==='create-polygon') return typeof onCreatePolygon==='function'
    if (action==='camera') return typeof onFitCamera==='function'
    if (action==='reset') return typeof (nativeClothcraft?onReset2d:resetSimulation)==='function'
    if (action==='simulate') return typeof toggleSimulation==='function'
    if (action==='export') return typeof exportProject==='function'
    if (['wireframe','analysis','seams'].includes(action)) return typeof ({wireframe:setWireframe,analysis:setAnalysisMode,seams:setShowSewingGuides}[action])==='function'
    if (['transform','move','rotate','hand'].includes(action)) return typeof setViewportTool==='function'
    if (['select','point','internal','measure','sew'].includes(action)) return typeof setTool==='function'
    if (['Scene','Fabric','Graphic','Button','Buttonhole','Topstitch','Trim','Grading','POM','fabric-edit'].includes(action)) return typeof setObjectTab==='function' && typeof setActiveSection==='function'
    if (action==='fit') return typeof setActiveSection==='function'
    return false
  }
  const groups = showAll ? ALL_GROUPS : (FOCUSED_GROUPS[activeSection] || FOCUSED_GROUPS.Pattern)
  const renderAction = (id) => {
    const item = TOOL_BY_ID.get(id)
    if (!item) return null
    const [itemId, label, action] = item
    const nativeCapability = nativeClothcraft ? nativeExtraCapability(action) : null
    const unavailable = nativeClothcraft && (UNSUPPORTED_NATIVE_ACTIONS.has(action) || nativeCapability?.mode==='unavailable')
    const missingHandler = nativeClothcraft && Boolean(nativeCapability) && typeof onCloTool !== 'function'
    const disabled = !availableAction(action) || !action || unavailable || missingHandler || (!nativeClothcraft && action==='allowance')
    const nativeReason = nativeCapability?.reason || ''
    const actionButton=<button key={itemId} type="button" title={!action ? `${label} · planned` : unavailable ? `${label} · unavailable in native V2` : missingHandler ? `${label} · native command handler unavailable` : nativeReason && nativeClothcraft ? `${label} · ${nativeReason}` : action==='reset' && nativeClothcraft ? 'Reset 2D panel arrangement; preserve authored geometry' : label} aria-label={label} aria-description={disabled ? nativeReason || 'This command is not available in the current editor.' : nativeReason || undefined} aria-pressed={Boolean(!disabled && active(action))} aria-disabled={disabled} disabled={disabled} data-native-availability={disabled?'unavailable':'available'} data-exo-action={action || 'unavailable'} className={!disabled && active(action) ? 'active' : ''} onClick={disabled ? undefined : () => click(action)}><CadToolIcon id={EXTRA_ICON_ALIASES[itemId] || itemId} size={20}/></button>
    return actionButton
  }
  const mappedReferenceAction=slot=>{
    if(nativeClothcraft)return getClo7NativeCapability('2d',slot.id)?.mode==='native'
    const action=TOOL_BY_ID.get(slot.icon)?.[2]
    // Do not expose legacy V1-only CAD edits as operational in the Rust V2
    // pattern viewport. That editor has its own validated command surface.
    return Boolean(slot.action && slot.action===action)
  }
  const supportedReference = slot => nativeClothcraft
    ? typeof onCloTool==='function' && canInvokeNativeCapability(getClo7NativeCapability('2d',slot.id))
    : mappedReferenceAction(slot)
  const visibleReferenceCount = [...CLO7_2D_A,...CLO7_2D_B]
    .filter(supportedReference).length
  const availableExtraCount=EXO_EXTRA_TOOL_IDS.filter(id=>availableAction(TOOL_BY_ID.get(id)?.[2])).length
  const visibleCount = showAll
    ? visibleReferenceCount + (showExtras?availableExtraCount:0)
    : groups.reduce((count, [, ids]) => count + ids.filter(id=>availableAction(TOOL_BY_ID.get(id)?.[2])).length, 0)
  const referenceTotal = CLO7_2D_A.length+CLO7_2D_B.length
  const totalCount = showAll?visibleCount:RIGHT_PALETTE_TOOLS.filter(([, ,action])=>availableAction(action)).length
  const renderCloReference = slot => {
    const capability=getClo7NativeCapability('2d',slot.id)
    const mapped=mappedReferenceAction(slot)
    const handlerAvailable=typeof onCloTool==='function'
    const supported= nativeClothcraft
      ? handlerAvailable && canInvokeNativeCapability(capability)
      : mapped && (handlerAvailable || Boolean(slot.action))
    const inspect=nativeClothcraft && capability?.mode==='inspect'
    const unavailableReason=capability?.mode==='unavailable'?'Native tool unavailable':!handlerAvailable&&nativeClothcraft?'Native handler unavailable':'Tool unavailable'
    const pressedAction=nativeClothcraft ? NATIVE_SLOT_SELECTED_TOOLS[slot.id] : slot.action
    const slotActive=Boolean(supported && !inspect && pressedAction && active(pressedAction))
    return <button key={slot.id} data-clo-slot={`2d:${slot.id}`}
      type="button" aria-label={inspect?`Inspect ${slot.label}`:slot.label}
      title={`${slot.label} · ${supported?(inspect?'Open related EXO inspector (CLO command unavailable)':capability?.reason||'Run EXO action'):`${unavailableReason}: ${capability?.reason||'No supported command'}`}`}
      disabled={!supported}
      aria-disabled={!supported}
      data-clo-operational={supported&&(!nativeClothcraft||capability?.mode==='native')?'true':'false'}
      aria-description={supported?(capability?.reason||'Run tool'): `${unavailableReason}. ${capability?.reason||'No supported command.'}`}
      data-clo-details-only={inspect?'true':'false'}
      data-clo-implementation={capability?.mode||'unavailable'}
      aria-pressed={slotActive}
      className={`${supported?'clo-supported-tool':'clo-tool-inquire'} ${slotActive?'active':''}`}
      style={slot.after?{marginBottom:9}:undefined}
      onClick={supported?(handlerAvailable?()=>onCloTool(slot,'2d'):()=>click(slot.action)):undefined}>
      <CadToolIcon id={slot.icon} size={20}/>
    </button>
  }
  return <nav className={`clo-right-tool-palette ${showAll ? 'all-tools' : 'focused-tools'}`} aria-label="Right workspace tools">
    <div className="clo-palette-workflows" aria-label="Quick workflow switching">
      {WORKFLOW_TABS.map(([section, iconId]) => <button key={section} type="button" aria-label={`Switch to ${section} tools`} aria-pressed={activeSection === section} title={`${section} tools`} className={activeSection === section ? 'active' : ''} onClick={() => activateWorkflow(section)}><CadToolIcon id={iconId} size={19}/></button>)}
    </div>
    <div className="clo-palette-scroll" aria-live="off">
      {showAll ? <>
        <div className="clo-tool-palette-group-divider" aria-label="CLO version 7 two-column pattern reference">2D TOOLS</div>
        <div className="clo-reference-dual-bars" aria-label="CLO-inspired independent drafting and sewing tool columns">
        <div className="clo-reference-column clo-right-tool-grid" aria-label="CLO 2D column A">{CLO7_2D_A.map(renderCloReference)}</div>
        <div className="clo-reference-column clo-right-tool-grid" aria-label="CLO 2D column B">{CLO7_2D_B.map(renderCloReference)}</div>
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
    {feedback && <div role="status" className="clo-palette-feedback" style={{fontSize:10,lineHeight:1.35,padding:'6px 5px',color:'#c7cad1'}}>{feedback}</div>}
    <button type="button" className="clo-reset-fabric-panels" disabled={typeof resetSimulation!=='function'} aria-disabled={typeof resetSimulation!=='function'} aria-label={nativeClothcraft?'Reset 3D fabric arrangement':'Reset fabric panels'} title={nativeClothcraft?'Reset the 3D fabric arrangement to its initial pose; preserve authored patterns, sewing and materials':'Reset fabric panels to their initial arrangement; preserve patterns, sewing and materials'} onClick={typeof resetSimulation==='function'?resetSimulation:undefined} style={{alignSelf:"flex-end",margin:"6px 3px",padding:"6px 2px",fontSize:8,width:"calc(100% - 6px)",minHeight:54,display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"#32373d",color:"#e6edf3"}}><RotateCcw size={18}/><span>RESET<br/>{nativeClothcraft?'3D':'PANELS'}</span></button>
    <div className="clo-palette-count"
      title={showAll?
        `${visibleReferenceCount} actionable CLO reference positions of ${referenceTotal}, including related inspectors; unsupported slots remain visible and disabled. ${showExtras?availableExtraCount:0} additional EXO buttons available.`:
        `${visibleCount} operational buttons in this focused workspace group, ${totalCount} available EXO actions.`}>
      {visibleCount}<span>/{totalCount}</span>
    </div>
  </nav>
}
