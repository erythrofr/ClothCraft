import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'
import {CLOTHCRAFT_FABRICS,presetProperties} from '../../src/core/clothcraftFabrics.js'
const output=fs.mkdtempSync(path.join(os.tmpdir(),'exo-live-grab-')),w=createWorkspace(output)
let s
async function call(data){const r=await w.request({revision:s?.revision,...data});assert(r.ok,r.error);if(r.data?.template)s=r.data;return r.data}
const project=JSON.parse(fs.readFileSync(path.join(os.homedir(),'Library/Application Support/EXO-ClothCraft-Studio/Snapshots/V1-20261016/fitting-project.json'),'utf8'))
const distance=(a,b)=>Math.hypot(...a.map((n,k)=>n-b[k]))
const weighted=(vertices,weights,s)=>[0,1,2].map(k=>vertices.reduce((sum,v,i)=>sum+s.positions[v][k]*weights[i],0))
const results=[]
try{
 for(const id of ['jersey','denim','stretch']){
  await call({op:'open',project})
  const panel=s.template.panels.find(p=>p.id==='front'),fabric=s.template.fabrics.find(f=>f.id===panel.fabric),preset=CLOTHCRAFT_FABRICS.find(p=>p.id===id)
  await call({op:'edit',command:{kind:'Fabric',panel:panel.id,name:preset.name,properties:presetProperties(preset,fabric.properties),all_panels:true}})
  for(let i=0;i<15;i++)await call({op:'step',steps:4})
  const range=s.panels.find(p=>p.id==='front'),weights=[.2,.3,.5]
  const vertices=s.triangles.slice(...range.triangles).sort((a,b)=>distance(weighted(a,weights,s),[0,1.25,.23])-distance(weighted(b,weights,s),[0,1.25,.23]))[0]
  const origin=weighted(vertices,weights,s),rest=structuredClone(s.uv),target=origin.map((n,k)=>n+(k===2?.08:0))
  await call({op:'step',steps:1,grab:{vertices,weights,target}})
  assert(s.grabActive);assert.equal(s.grabStiffness,150,'Exact upstream spring stiffness')
  for(let i=0;i<15;i++){await call({op:'step',steps:4});assert(s.grabActive,'Constraint persists while held')}
  const held=weighted(vertices,weights,s),heldDistance=distance(held,origin)
  assert(heldDistance>.002,'Live native spring must deform cloth')
  await call({op:'step',steps:1,grab:null});assert.equal(s.grabActive,false)
  for(let i=0;i<60;i++)await call({op:'step',steps:4})
  const releasedDistance=distance(weighted(vertices,weights,s),origin)
  assert(releasedDistance<heldDistance,'Released cloth recovers from live spring deformation')
  assert.deepEqual(s.uv,rest);assert(s.positions.flat().every(Number.isFinite))
  results.push({id,heldDistanceM:heldDistance,releasedDistanceM:releasedDistance,targetErrorM:distance(held,target),stiffness:150,backend:s.backend});console.log(JSON.stringify(results.at(-1)))
 }
 assert(Math.abs(results[0].heldDistanceM-results[1].heldDistanceM)>.001,'Different fabric coefficients must change response')
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({passed:true,output,results}))
}finally{w.close()}
