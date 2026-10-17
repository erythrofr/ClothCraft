import React from 'react'
import CadToolIcon from './CadToolIcon.jsx'
import {CLO7_3D_A,CLO7_3D_B} from '../data/clo7ToolbarOrder.js'
import {getClo7NativeCapability} from '../core/clo7NativeToolCapabilities.js'

const activeAction=(slot,{running,viewportTool,tool,sewingGuides})=>{
  switch(slot.action){
    case 'simulate': return running
    case 'transform': return ['transform','move'].includes(viewportTool)
    case 'mesh-select': return viewportTool==='mesh-select'
    case 'pin': return tool==='pin'
    case 'fastener': return tool==='fastener'
    case 'seams': return sewingGuides
    default: return false
  }
}

const handleToolbarKeyDown=event=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return
  const column=event.target.closest('.clo-left-3d-column')
  if(!column)return
  const buttons=Array.from(column.querySelectorAll('button:not(:disabled)'))
  if(!buttons.length)return
  const index=buttons.indexOf(event.target)
  if(index<0)return
  event.preventDefault()
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:
    (index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length
  buttons[next].focus()
}

/**
 * Keep the observed CLO 3D reference positions stable. Native capabilities
 * change independently of their physical order, icon and accessible label.
 * A visible button is only enabled when a real native command, inspector or
 * existing EXO draft operation is connected to its click handler.
 */
export default function Clo3DReferenceToolbar({nativeClothcraft, enabledLegacy, onActivate,
  canDraft, running=false, viewportTool='', tool='', sewingGuides=false}) {
  const renderSlot=slot=>{
    const capability=getClo7NativeCapability('3d',slot.id)
    const nativeMode=nativeClothcraft?capability?.mode:null
    const nativeCommand=nativeMode==='native'
    const inspect=nativeMode==='inspect'
    const legacyCommand=!nativeClothcraft&&Boolean(enabledLegacy?.(slot))
    const draft=!nativeClothcraft&&Boolean(canDraft?.(slot))
    const enabled=Boolean((nativeCommand||inspect||legacyCommand||draft)&&onActivate)
    const mode=nativeClothcraft?nativeMode||'unavailable':enabled?'native':'unavailable'
    const pressed=Boolean(enabled&&!inspect&&activeAction(slot,{running,viewportTool,tool,sewingGuides}))
    const status=enabled?(inspect?'Open related EXO inspector':'Run EXO action'):'Unavailable in EXO'
    const explanation=capability?.reason||(!enabled?'No implementation available for this tool':'EXO tool')
    return <button key={slot.id} type="button" data-clo-slot={`3d:${slot.id}`}
      data-clo-column={slot.id.charAt(0)} data-clo-row={Number(slot.id.slice(1))}
      data-clo-implementation={mode} data-clo-operational={Boolean(enabled&&(nativeCommand||legacyCommand||draft))}
      data-clo-group-end={slot.after?'true':undefined}
      aria-label={inspect?`Inspect ${slot.label}`:slot.label}
      aria-description={`${status}. ${explanation}`}
      title={`${slot.label} · ${status} · ${explanation}`}
      aria-pressed={enabled&&!inspect&&slot.action?pressed:undefined} disabled={!enabled}
      className={`${pressed?'active ':''}${enabled&&(nativeCommand||legacyCommand||draft)?'clo-supported-tool':enabled&&inspect?'clo-inspect-tool':'clo-tool-inquire'}`}
      onClick={enabled?()=>onActivate(slot,'3d'):undefined}>
      <CadToolIcon id={slot.icon} size={20}/>
    </button>
  }
  return <div className="clo-left-3d-double-bars" role="group" aria-label="3D reference tools: all 38 positions" data-toolbar-complete="true" onKeyDown={handleToolbarKeyDown}>
    <div className="clo-left-3d-column" role="toolbar" aria-orientation="vertical" aria-label="3D editing column A">{CLO7_3D_A.map(renderSlot)}</div>
    <div className="clo-left-3d-column" role="toolbar" aria-orientation="vertical" aria-label="3D garment column B">{CLO7_3D_B.map(renderSlot)}</div>
  </div>
}
