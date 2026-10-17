// Regression: Fabric Hand's native spring must not remain attached across
// Pause and the next simulation session. Never touches installed V2 saves.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {setTimeout as sleep} from 'node:timers/promises'
import {createWorkspace} from './workspace.mjs'

const output=fs.mkdtempSync(path.join(os.tmpdir(),'exo-hand-pause-'))
const projectPath=path.join(os.homedir(),'Library/Application Support/EXO-ClothCraft-Studio/Snapshots/V1-20261016/fitting-project.json')
const w=createWorkspace(output)
const project=JSON.parse(fs.readFileSync(projectPath,'utf8'))
const call=async data=>{
 const result=await w.request(data)
 assert(result.ok,result.error||'Failed '+data.op)
 return result.data
}
const waitFor=async predicate=>{
 for(let i=0;i<150;i++){
  const r=await call({op:'snapshot'})
  if(predicate(r))return r
  await sleep(100)
 }
 throw Error('Timed out waiting for Rust fabric state')
}
try{
 let s=await call({op:'open',project})
 const vertices=s.triangles[40]
 assert(vertices?.length===3,'Expected a valid cloth face')
 const weights=[0.25,0.35,0.4]
 for(let cycle=0;cycle<3;cycle++){
  s=await call({op:'play'})
  assert.equal(s.running,true)
  const origin=[0,1,2].map(axis=>vertices.reduce((sum,index,k)=>sum+s.positions[index][axis]*weights[k],0))
  await call({op:'grab',grab:{vertices,weights,target:[origin[0],origin[1],origin[2]+.04]}})
  const held=await waitFor(x=>x.grabActive&&x.time>s.time)
  assert.equal(held.grabStiffness,150)
  const paused=await call({op:'pause'})
  assert.equal(paused.running,false)
  assert.equal(paused.grabActive,false,'Invisible spring remained attached after Pause (cycle '+cycle+')')
  const snapshot=await call({op:'snapshot'})
  assert.equal(snapshot.grabActive,false)
  s=snapshot
 }
 console.log(JSON.stringify({passed:true,cycles:3,pausedSpringsReleased:true,backend:s.backend,physicsTime:s.time,output}))
}finally{w.close()}
