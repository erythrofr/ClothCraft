// Explicit hardware integration experiment. Not part of default CPU tests.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'
if(process.env.EXO_CLOTHCRAFT_GPU!=='1')throw Error('Explicit EXO_CLOTHCRAFT_GPU=1 required')
const output=path.resolve('integrations/clothcraft/output/workspace-fit-20261016')
fs.mkdirSync(output,{recursive:true})
const results=[]
for(const preset of ['tshirt','dress']){
 const workspace=createWorkspace(path.join(output,preset));const rows=[];let s
 try{
  let r=await workspace.request({op:'open',preset});assert(r.ok,r.error);s=r.data
  const avatar=s.avatar
  for(let i=0;i<360;i++){
   r=await workspace.request({op:'step',steps:1,revision:s.revision});assert(r.ok,r.error);s=r.data;rows.push(s.metrics)
   if((i+1)%120===0)console.log(JSON.stringify({preset,steps:i+1,gapMm:s.metrics.max_seam_gap_m*1000,p95:s.metrics.extension_p95_percent,contacts:s.metrics.contacts}))
  }
  await workspace.request({op:'save'});fs.writeFileSync(path.join(output,preset,'final-snapshot.json'),JSON.stringify({...s,avatar}));fs.writeFileSync(path.join(output,preset,'metrics.json'),JSON.stringify(rows,null,2))
  results.push({preset,steps:rows.length,time:s.time,final:s.metrics,maxP95:Math.max(...rows.map(m=>m.extension_p95_percent)),minimumDistanceM:Math.min(...rows.map(m=>m.minimum_distance_m)),meanStepMs:rows.reduce((a,m)=>a+m.step_ms,0)/rows.length,fitCertified:false})
 }finally{workspace.close()}
}
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2))
