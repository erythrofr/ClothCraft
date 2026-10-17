// Independent Rust-only regression. No live Studio project or V1 files touched.
import assert from 'node:assert/strict'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const upstream=path.join(root,'research/oss/clothcraft')
const child=spawn(path.join(upstream,'target/debug/exo-session'),[
 path.join(upstream,'assets/makehuman/mannequin.obj'),
 path.join(root,'integrations/clothcraft/output/v2-qa-pull.native'),
],{cwd:upstream,stdio:['pipe','pipe','pipe']})
const queue=[]
let fatal=null
const output=createInterface({input:child.stdout})
output.on('line',line=>{
 const waiter=queue.shift()
 if(waiter){try{waiter.resolve(JSON.parse(line))}catch(error){waiter.reject(error)}}
})
child.on('error',error=>{fatal=error;queue.splice(0).forEach(x=>x.reject(error))})
child.on('exit',code=>{if(code!==0){fatal=new Error(`Rust process exited ${code}`);queue.splice(0).forEach(x=>x.reject(fatal))}})
const call=data=>new Promise((resolve,reject)=>{
 if(fatal)return reject(fatal)
 queue.push({resolve,reject})
 child.stdin.write(JSON.stringify(data)+'\n')
})
try{
 const initial=await call({op:'open',preset:'tshirt'})
 assert.equal(initial.ok,true,JSON.stringify(initial.error))
 const base=initial.data
 assert.ok(base.panels.length>=2)
 const stepped=await call({op:'step',steps:1,revision:base.revision})
 assert.equal(stepped.ok,true,JSON.stringify(stepped.error))
 const before=stepped.data
 const panel=before.panels[0],neighbor=before.panels[1]
 const vertex=panel.vertices[0]+Math.floor((panel.vertices[1]-panel.vertices[0])/2)
 const prior=before.positions[vertex]
 const invalid=await call({op:'pull-panel',revision:before.revision,panel:panel.id,
  vertex:neighbor.vertices[0],target:prior,radius_m:.14})
 assert.equal(invalid.ok,false,'Cannot manipulate vertex from a different panel')
 const pulled=await call({op:'pull-panel',revision:before.revision,panel:panel.id,
  vertex,target:[prior[0]+.12,prior[1]+.045,prior[2]+.22],radius_m:.16})
 assert.equal(pulled.ok,true,JSON.stringify(pulled.error))
 const after=pulled.data
 assert.equal(after.positions.length,before.positions.length)
 assert.deepEqual(after.positions.slice(neighbor.vertices[0],neighbor.vertices[1]),
  before.positions.slice(neighbor.vertices[0],neighbor.vertices[1]),'Other simulated panels must remain exactly unchanged')
 const moved=Math.hypot(...after.positions[vertex].map((n,i)=>n-prior[i]))
 assert.ok(moved>.20,`Selected stretch vertex barely moved ${moved}`)
 assert.equal(after.fitCertified,false)
 const posed=await call({op:'pose-panel',revision:after.revision,panel:panel.id,
  translation_delta:[.28,.03,-.14],rotation_delta_degrees:[0,24,0]})
 assert.equal(posed.ok,true,JSON.stringify(posed.error))
 assert.deepEqual(posed.data.positions.slice(neighbor.vertices[0],neighbor.vertices[1]),
  after.positions.slice(neighbor.vertices[0],neighbor.vertices[1]),'Rigid moving simulated cloth must not reset adjacent panels')
 assert.equal(posed.data.time,after.time,'Move of simulated cloth must preserve the current simulation clock')
 const midpoint=Math.floor((panel.vertices[0]+panel.vertices[1])/2)
 const other=panel.vertices[0]+3
 const length=(positions)=>Math.hypot(...positions[midpoint].map((value,i)=>value-positions[other][i]))
 assert.ok(Math.abs(length(posed.data.positions)-length(after.positions))<1e-9,'Rigid pose must preserve simulated folds and lengths')
 const movedRigid=Math.hypot(...posed.data.positions[midpoint].map((n,i)=>n-after.positions[midpoint][i]))
 assert.ok(movedRigid>.1,'Selected cloth should actually move away from body')
 const reset=await call({op:'reset',revision:posed.data.revision})
 assert.equal(reset.ok,true,JSON.stringify(reset.error))
 assert.equal(reset.data.time,0,'Reset must restore spaced-out pre-simulation panels')
 assert.deepEqual(reset.data.positions,base.positions,'Reset must restore original pose without changing pattern')
 assert.deepEqual(reset.data.template,base.template,'Reset should not silently alter the authored garment')
 const sourcePanel=reset.data.template.panels.find(item=>item.id===panel.id)
 const placement={...sourcePanel.placement,translation:sourcePanel.placement.translation.map((n,i)=>n+(i===0?.25:0))}
 const placed=await call({op:'edit',revision:reset.data.revision,
  command:{kind:'Place',panel:panel.id,placement}})
 assert.equal(placed.ok,true,JSON.stringify(placed.error))
 assert.deepEqual(placed.data.positions.slice(neighbor.vertices[0],neighbor.vertices[1]),
  reset.data.positions.slice(neighbor.vertices[0],neighbor.vertices[1]),'Dragging a selected panel must not reset other panels')
 assert.equal(placed.data.template.panels.find(item=>item.id===panel.id).placement.translation[0],placement.translation[0])
 console.log(JSON.stringify({passed:true,check:['native-rust-solver-step','reject-other-panel-vertex','grab-only-one-panel','preserve-other-simulated-panels-exact','pose-folded-panel-without-changing-neighbors','rigid-pose-preserves-cloth-shape-and-time','restore-pre-simulated-outside-body','preserve-template','place-single-panel-without-resetting-others'],movedMetres:moved,movedRigidMetres:movedRigid,fitCertified:false},null,2))
} finally {child.stdin.end();child.kill('SIGTERM')}
