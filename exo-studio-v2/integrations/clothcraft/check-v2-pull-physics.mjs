// Run against a freshly rebuilt exo-session binary to exercise the native
// Fabric Hand brush followed by real VBD/OGC steps.
import assert from 'node:assert/strict'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const upstream=path.join(root,'research/oss/clothcraft')
const child=spawn(path.join(upstream,'target/debug/exo-session'),[
 path.join(upstream,'assets/makehuman/mannequin.obj')
],{cwd:upstream,stdio:['pipe','pipe','inherit']})
const pending=[]
createInterface({input:child.stdout}).on('line',line=>{
 const handler=pending.shift()
 if(handler)try{handler.resolve(JSON.parse(line))}catch(error){handler.reject(error)}
})
child.on('error',error=>pending.splice(0).forEach(p=>p.reject(error)))
child.on('exit',code=>pending.splice(0).forEach(p=>p.reject(new Error(`session exited ${code}`))))
const send=value=>new Promise((resolve,reject)=>{
 pending.push({resolve,reject})
 child.stdin.write(`${JSON.stringify(value)}\n`)
})
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]))
try{
 const opened=await send({op:'open',preset:'tshirt'})
 assert.equal(opened.ok,true,opened.error)
 const base=opened.data
 const stepped=await send({op:'step',revision:base.revision,steps:1})
 assert.equal(stepped.ok,true,stepped.error)
 const before=stepped.data
 const panel=before.panels[0]
 const other=before.panels[1]
 const vertex=panel.vertices[0]+Math.floor((panel.vertices[1]-panel.vertices[0])/2)
 const original=before.positions[vertex]
 const target=[original[0]+0.08,original[1]+0.03,original[2]+0.10]
 const pulled=await send({op:'pull-panel',revision:before.revision,panel:panel.id,vertex,target,radius_m:0.15})
 assert.equal(pulled.ok,true,pulled.error)
 const p=pulled.data
 assert.ok(distance(p.positions[vertex],target)<1e-9,'Picked vertex should reach target')
 assert.deepEqual(p.positions.slice(...other.vertices),before.positions.slice(...other.vertices),'Other panels stay exact during manipulation')
 let unaffected=0
 for(let i=panel.vertices[0];i<panel.vertices[1];i++){
  if(distance(original,before.positions[i])>=0.15){
   assert.deepEqual(p.positions[i],before.positions[i],`Vertex ${i} outside brush changed`)
   unaffected++
  }
 }
 assert.ok(unaffected>0,'Verify at least one unmodified remote vertex')
 const simulated=await send({op:'step',revision:p.revision,steps:1})
 assert.equal(simulated.ok,true,`Native solver rejected cloth grab: ${simulated.error}`)
 assert.ok(simulated.data.time>p.time,'Pull must advance native simulation')
 assert.ok(simulated.data.positions.flat().every(Number.isFinite),'No NaN/Infinity after native grab')
 const released=await send({op:'step',revision:simulated.data.revision,steps:1})
 assert.equal(released.ok,true,`Release into ongoing cloth dynamics failed: ${released.error}`)
 assert.ok(released.data.time>simulated.data.time)
 console.log(JSON.stringify({passed:true,remoteVerticesUnchanged:unaffected,nativeStepAfterPull:true,nativeStepAfterRelease:true,fitCertified:false}))
}finally{child.stdin.end();child.kill('SIGTERM')}
