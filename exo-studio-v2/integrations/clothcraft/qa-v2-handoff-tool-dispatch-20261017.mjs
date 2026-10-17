// Isolated callback-level integration proof; no server, native app or GPU required.
// Executes the actual RightToolPalette component with a small React host shim.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {fileURLToPath} from 'node:url'
import {CLO7_NATIVE_TOOL_CAPABILITIES, getClo7NativeCapability} from '../../src/core/clo7NativeToolCapabilities.js'
import {CLO7_2D_A,CLO7_2D_B,CLO7_3D_A,CLO7_3D_B} from '../../src/data/clo7ToolbarOrder.js'

const source=fileURLToPath(new URL('../../src/components/RightToolPalette.jsx',import.meta.url))
const virtual={
  react:`export const createElement=(type,props,...children)=>({type,props:{...props,children}});export const useState=initial=>[typeof initial==='function'?initial():initial,()=>{}];export const useEffect=()=>{};export default {createElement};`,
  'lucide-react':`export const RotateCcw=()=>null;`,
  icon:`export default function CadToolIcon(){return null};`,
}
const {outputFiles}=await build({entryPoints:[source],bundle:true,write:false,platform:'neutral',format:'esm',jsx:'transform',logLevel:'silent',plugins:[{
  name:'qa-host-shim',
  setup(b){
    b.onResolve({filter:/^(react|lucide-react)$/},args=>({path:args.path,namespace:'qa'}))
    b.onResolve({filter:/^\.\/CadToolIcon\.jsx$/},()=>({path:'icon',namespace:'qa'}))
    b.onLoad({filter:/.*/,namespace:'qa'},args=>({contents:virtual[args.path],loader:'js'}))
  }
}]})
const bundled=outputFiles[0].text
const {default:RightToolPalette}=await import('data:text/javascript;base64,'+Buffer.from(bundled).toString('base64'))
const slots=[...CLO7_3D_A,...CLO7_3D_B,...CLO7_2D_A,...CLO7_2D_B]
assert.equal(slots.length,70)
const counts=Object.fromEntries(['native','inspect','unavailable'].map(mode=>[mode,CLO7_NATIVE_TOOL_CAPABILITIES.filter(x=>x.mode===mode).length]))
assert.equal(Object.values(counts).reduce((sum,count)=>sum+count,0),70)
assert.equal(new Set(CLO7_NATIVE_TOOL_CAPABILITIES.map(x=>x.id)).size,70)
for(const entry of CLO7_NATIVE_TOOL_CAPABILITIES){
 assert(['native','inspect','unavailable'].includes(entry.mode),entry.id)
 assert.equal(typeof entry.reason,'string',entry.id)
 assert(entry.reason.length>0,entry.id)
 assert.equal(Boolean(entry.nativeAction),entry.mode==='native',entry.id)
 assert.equal(Boolean(entry.inspectionAction),entry.mode==='inspect',entry.id)
}

function walk(node,found=[]){
  if(Array.isArray(node)){for(const child of node)walk(child,found);return found}
  if(node && typeof node==='object'){
    if(node.type==='button')found.push(node)
    walk(node.props?.children,found)
  }
  return found
}
function render({handler=true}={}){
  const calls=[]
  const record=name=>(...args)=>{calls.push({name,args})}
  const props={
    activeSection:'Pattern',viewportTool:'orbit',tool:'select',nativeClothcraft:true,
    setViewportTool:record('setViewportTool'),setTool:record('setTool'),
    setActiveSection:record('setActiveSection'),setObjectTab:record('setObjectTab'),
    onRevealBrowser:record('onRevealBrowser'),setShowSewingGuides:record('setShowSewingGuides'),
    setWireframe:record('setWireframe'),setAnalysisMode:record('setAnalysisMode'),
    toggleSimulation:record('toggleSimulation'),resetSimulation:record('resetSimulation'),
    onReset2d:record('onReset2d'),exportProject:record('exportProject'),
    onFitCamera:record('onFitCamera'),onMirrorSelected:record('onMirrorSelected'),
    onCreatePolygon:record('onCreatePolygon'),onCloTool:handler?record('onCloTool'):undefined,
    showSewingGuides:false,wireframe:false,analysisMode:'surface',running:false,
  }
  const buttons=walk(RightToolPalette(props))
  const find=label=>{const match=buttons.find(b=>b.props['aria-label']===label);assert(match,'Missing '+label);return match}
  return {calls,buttons,find}
}
const assertions=[]
function verify(name,fn){fn();assertions.push(name)}
const nativeAliases={
  '2D pattern select':'A01',
  'Edit pattern points':'A02',
  'Create polygon pattern':'A04',
  'Internal line / dart':'A05',
  'Pattern notch':'A08',
  'Seam allowance cutting guide':'A09',
  'Free sewing':'B03',
  'Tape measure / ruler':'A11',
}
verify('all 70 slots resolve to explicit capability states',()=>{
  for(const entry of CLO7_NATIVE_TOOL_CAPABILITIES)assert(getClo7NativeCapability(entry.dimension,entry.position)===entry)
})
verify('2D slot availability preserves native, inspect, and unavailable semantics',()=>{
 const ui=render()
 for(const entry of CLO7_NATIVE_TOOL_CAPABILITIES.filter(x=>x.dimension==='2d')){
  const button=ui.buttons.find(b=>b.props['data-clo-slot']===entry.id)
  assert(button,'Missing original slot '+entry.id)
  assert.equal(button.props['data-clo-implementation'],entry.mode,entry.id)
  assert.equal(button.props['data-clo-operational'],entry.mode==='native'?'true':'false',entry.id)
  assert.equal(button.props.disabled,entry.mode==='unavailable',entry.id)
  assert.equal(Boolean(button.props.onClick),entry.mode!=='unavailable',entry.id)
  assert.equal(button.props['data-clo-details-only'],entry.mode==='inspect'?'true':'false',entry.id)
 }
})
verify('native 2D supplemental shortcuts dispatch exact slot and dimension',()=>{
  for(const [label,id] of Object.entries(nativeAliases)){
    const ui=render()
    const button=ui.buttons.find(b=>b.props['aria-label']===label) || ui.buttons.find(b=>b.props['data-clo-slot']===`2d:${id}`)
    assert(button,'Missing shortcut/reference '+label)
    assert.equal(button.props.disabled,false,label)
    button.props.onClick()
    assert.deepEqual(ui.calls.map(c=>c.name),['onCloTool'],label)
    assert.equal(ui.calls[0].args[0]?.id,id,label)
    assert.equal(ui.calls[0].args[1],'2d',label)
  }
})
verify('unsupported shortcut buttons cannot edit or dispatch',()=>{
  for(const label of ['Cloth pin','Button or snap fastener','Physical seam-closure tool']){
    const ui=render()
    const button=ui.find(label)
    assert.equal(button.props.disabled,true,label)
    // Browser cannot activate disabled buttons. Even a direct callback on the
    // unsupported native pin/fastener path must never reach editor mutations.
    if(button.props.onClick)button.props.onClick()
    assert.equal(ui.calls.length,0,label)
  }
})
verify('unsupported reference slots stay visible and disabled',()=>{
  const ui=render()
  const button=ui.buttons.find(b=>b.props['data-clo-slot']==='2d:A03')
  assert(button)
  assert.equal(button.props['data-clo-implementation'],'unavailable')
  assert.equal(button.props['data-clo-operational'],'false')
  assert.equal(button.props.disabled,true)
  assert.equal(button.props.onClick,undefined)
  assert.match(button.props['aria-description'],/unavailable/i)
  assert.deepEqual(ui.calls,[])
})
verify('inspection reference slot retains native inspection callback',()=>{
  const ui=render()
  const button=ui.buttons.find(b=>b.props['data-clo-slot']==='2d:A11')
  assert.equal(button.props.disabled,false)
  assert.equal(button.props['data-clo-implementation'],'inspect')
  assert.equal(button.props['data-clo-operational'],'false')
  button.props.onClick()
  assert.deepEqual(ui.calls.map(c=>c.name),['onCloTool'])
  assert.equal(ui.calls[0].args[0].id,'A11')
})
verify('no handler leaves unsupported reference disabled and native alias disabled',()=>{
  const ui=render({handler:false})
  assert.equal(ui.buttons.find(b=>b.props['data-clo-slot']==='2d:A01').props.disabled,true)
  const unsupported=ui.buttons.find(b=>b.props['data-clo-slot']==='2d:A03')
  assert(unsupported.props.disabled)
  assert.equal(unsupported.props.onClick,undefined)
})
verify('native supported reference slots dispatch their slot with handler',()=>{
  const ui=render()
  const button=ui.buttons.find(b=>b.props['data-clo-slot']==='2d:A04')
  assert(button)
  assert.equal(button.props['data-clo-operational'],'true')
  button.props.onClick()
  assert.deepEqual(ui.calls.map(c=>c.name),['onCloTool'])
  assert.equal(ui.calls[0].args[0].id,'A04')
})
verify('trace reference is native and dispatches its distinct A07 operation',()=>{
 const capability=getClo7NativeCapability('2d','A07')
 assert.equal(capability.mode,'native')
 assert.equal(capability.nativeAction,'pattern2d.traceContour')
 assert.match(capability.reason,/straight.*contour|straight-edge outer contour/i)
 assert.match(capability.reason,/holes/i)
 const ui=render()
 const button=ui.buttons.find(b=>b.props['data-clo-slot']==='2d:A07')
 assert(button)
 assert.equal(button.props.disabled,false)
 assert.equal(button.props['data-clo-operational'],'true')
 button.props.onClick()
 assert.deepEqual(ui.calls.map(call=>call.name),['onCloTool'])
 assert.equal(ui.calls[0].args[0].id,'A07')
 assert.equal(ui.calls[0].args[1],'2d')
})
console.log(JSON.stringify({passed:true,kind:'real component callbacks with mocked React host',capabilities:counts,slots:70,checks:assertions,limitations:'Does not establish Rust edit, Undo, Save/reopen, or native-window Playwright behavior.'},null,2))
