import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'
import {CLOTHCRAFT_FABRICS,presetProperties} from '../../src/core/clothcraftFabrics.js'
const output=fs.mkdtempSync(path.join(os.tmpdir(),'exo-elastic-recovery-'))
const w=createWorkspace(output);let s
async function call(data){const r=await w.request({revision:s?.revision,...data});assert(r.ok,r.error);if(r.data?.template)s=r.data;return r.data}
const dist=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]))
function stretch(s,verts){const edges=new Set(),values=[];for(const t of s.triangles)for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3];if(!verts.has(a)&&!verts.has(b))continue;const key=[a,b].sort((x,y)=>x-y).join(':');if(edges.has(key))continue;edges.add(key);const rest=dist(s.uv[a],s.uv[b]);if(rest>1e-9)values.push(Math.max(0,dist(s.positions[a],s.positions[b])/rest-1)*100)}values.sort((a,b)=>a-b);return{p95:values[Math.floor(values.length*.95)],max:values.at(-1)}}
try{
 const project=JSON.parse(fs.readFileSync(path.join(os.homedir(),'Library/Application Support/EXO-ClothCraft-Studio/Snapshots/V1-20261016/fitting-project.json'),'utf8'))
 await call({op:'open',project})
 const p=s.template.panels.find(p=>p.id==='front')||s.template.panels[0],current=s.template.fabrics.find(f=>f.id===p.fabric)
 const jersey=CLOTHCRAFT_FABRICS.find(p=>p.id==='jersey')
 await call({op:'edit',command:{kind:'Fabric',panel:p.id,name:jersey.name,properties:presetProperties(jersey,current.properties),all_panels:true}})
 for(let i=0;i<30;i++)await call({op:'step',steps:4})
 const base=structuredClone(s),range=s.panels.find(r=>r.id===p.id).vertices
 let vertex=range[0],best=Infinity
 for(let i=range[0];i<range[1];i++){const d=dist(s.positions[i],[0,1.25,.23]);if(d<best){best=d;vertex=i}}
 const origin=s.positions[vertex],near=new Set();for(let i=range[0];i<range[1];i++)if(dist(s.positions[i],origin)<.16)near.add(i)
 const baseline=stretch(s,near)
 await call({op:'pull-panel',panel:p.id,vertex,target:origin.map((n,k)=>n+(k===2?.08:0)),radius_m:.16})
 const pulled=stretch(s,near),trace=[]
 for(let i=0;i<60;i++){await call({op:'step',steps:4});if(i%15===14){const row={seconds:(i+1)*4/60,stretch:stretch(s,near),offsetM:dist(s.positions[vertex],origin)};trace.push(row);console.log(JSON.stringify(row))}}
 const final=stretch(s,near)
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({backend:s.backend,baseline,pulled,final,trace,origin,vertex},null,2))
 console.log(JSON.stringify({output,baseline,pulled,final,trace},null,2))
 assert(final.p95<baseline.p95+2,"Released stretch must return near pre-pull strain");assert(dist(s.positions[vertex],origin)<.01,"An 8 cm pull must recover to within 1 cm");assert.deepEqual(s.uv,base.uv,"Hand must never rewrite material rest geometry");assert(s.positions.flat().every(Number.isFinite))
}finally{w.close()}
