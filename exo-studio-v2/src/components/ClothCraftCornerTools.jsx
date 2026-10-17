import React, {useState} from 'react'
import ViewportQuickTools from './ViewportQuickTools.jsx'
import './ClothCraftCornerTools.css'

// Reuse Garment Studio's real CAD widget/icon system. Map only the commands
// available in the Rust-linked ClothCraft canvas to working V2 interactions.
const MODE_BY_TOOL = {
  '2d': {select:'edit',point:'edit',split:'edit',curve:'edit',polygon:'pen',measure:'edit',sew:'sew',internal:'line',notch:'edit',allowance:'edit'},
  '3d': {orbit:'edit',transform:'move3d',move:'move3d',rotate:'rotate3d',hand:'stretch3d'},
}
const ACTIVE_TOOL = {
  '2d': {edit:'select',sew:'sew',line:'internal',pen:'polygon'},
  '3d': {edit:'orbit',move3d:'move',rotate3d:'rotate',stretch3d:'hand'},
}

export default function ClothCraftCornerTools({dimension,mode,activeTool:controlledTool,onChangeMode,onChangeTool,disabled=false}) {
  const tools = MODE_BY_TOOL[dimension] || {}
  const [lastTool,setLastTool] = useState(null)
  const activeTool = controlledTool && tools[controlledTool] === mode ? controlledTool : lastTool && tools[lastTool] === mode
    ? lastTool : (ACTIVE_TOOL[dimension]?.[mode] || 'select')
  return <div className="cc-corner-tool-host">
    <ViewportQuickTools dimension={dimension}
      activeTool={activeTool}
      availableTools={Object.keys(tools)}
      disabled={disabled}
      onChangeTool={name => {
        if (tools[name]) {
          setLastTool(name)
          onChangeTool?.(name)
          onChangeMode?.(tools[name])
        }
      }}/>
  </div>
}
