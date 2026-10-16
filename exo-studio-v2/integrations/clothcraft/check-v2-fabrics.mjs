import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'
import {CLOTHCRAFT_FABRICS,presetProperties,presetForFabric,validFabric} from '../../src/core/clothcraftFabrics.js'
// Full 405-material simulation regression may take several minutes on a local
// workstation. Set EXO_FABRIC_QA_LIMIT=24 for a deterministic spread plus
// denim/terry/leather/suede edge cases. The default remains exhaustive.
const qaLimit=Number(process.env.EXO_FABRIC_QA_LIMIT || CLOTHCRAFT_FABRICS.length)
const limited=Number.isInteger(qaLimit) && qaLimit>0 && qaLimit<CLOTHCRAFT_FABRICS.length
const representativeIds=['denim','frenchTerryHeavy','rawDenim__softened','lambskin__crisp','suedeLambskin','cottonHeavyJersey','cottonCanvas']
const selectedPresets=limited ? [...new Map([
 ...Array.from({length:qaLimit},(_,i)=>CLOTHCRAFT_FABRICS[Math.round(i*(CLOTHCRAFT_FABRICS.length-1)/Math.max(1,qaLimit-1))]),
 ...representativeIds.map(id=>CLOTHCRAFT_FABRICS.find(p=>p.id===id)),
].filter(Boolean).map(item=>[item.id,item])).values()] : CLOTHCRAFT_FABRICS
const output=fs.mkdtempSync(path.join(os.tmpdir(),'exo-v2-fabrics-')),w=createWorkspace(output)
let s
async function request(data){const r=await w.request({revision:s?.revision,...data});assert(r.ok,r.error);if(r.data?.template)s=r.data;return r.data}
try{
 await request({op:'open',preset:'tshirt'})
 const initial=structuredClone(s),panel=s.template.panels[0],original=s.template.fabrics.find(f=>f.id===panel.fabric),results=[]
 for(const p of selectedPresets){
  const properties=presetProperties(p,original.properties);assert(validFabric(properties));assert.equal(properties.density,p.gsm/1000);assert.equal(properties.thickness,p.thicknessMm/1000)
  // Independent finite-difference of the native smooth Green-strain energy.
  for(const [i,k] of ['warp','weft'].entries()){
   const energy=l=>{const e=(l*l-1)/2,pos=(e+Math.hypot(e,properties.compression_transition)-properties.compression_transition)/2;return properties[k]/2*(properties.compression_ratio*e*e+(1-properties.compression_ratio)*pos*pos)}
   const l=1+p.extension[i]/100,h=1e-6,t=(energy(l+h)-energy(l-h))/(2*h);assert(Math.abs(t-100)<.001)
  }
  await request({op:'edit',command:{kind:'Fabric',panel:panel.id,name:p.name,properties,all_panels:false}})
  assert.deepEqual(s.positions,initial.positions);assert.deepEqual(s.uv,initial.uv)
  const current=s.template.panels[0],f=s.template.fabrics.find(f=>f.id===current.fabric);assert.deepEqual(f.properties,properties);assert.equal(presetForFabric(f).id,p.id)
  for(const other of s.template.panels.slice(1)){assert.deepEqual(s.template.fabrics.find(f=>f.id===other.fabric).properties,original.properties)}
  const saved=await request({op:'save'});await request({op:'open',project:saved.project});assert.equal(presetForFabric(s.template.fabrics.find(f=>f.id===s.template.panels[0].fabric)).id,p.id)
  await request({op:'edit',command:{kind:'Fabric',panel:panel.id,name:p.name,properties,all_panels:true}})
  assert(s.template.panels.every(panel=>s.template.fabrics.find(f=>f.id===panel.fabric).properties.density===properties.density))
  await request({op:'undo'});assert.deepEqual(s.template.fabrics.find(f=>f.id===s.template.panels[1].fabric).properties,original.properties)
  await request({op:'redo'});await request({op:'step',steps:2});assert(s.positions.flat().every(Number.isFinite))
  results.push({id:p.id,density:properties.density,thickness:properties.thickness,finiteStep:true})
  await request({op:'open',preset:'tshirt'})
 }
 assert(!validFabric({...original.properties,density:NaN}));assert(!validFabric({...original.properties,thickness:0}))
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({passed:true,presets:results.length,totalAvailable:CLOTHCRAFT_FABRICS.length,sampled:limited,checks:['SI units','constitutive traction','selected-only isolation','geometry preservation','native save/reopen','apply-all','undo/redo','finite native solver steps'],output},null,2))
}finally{w.close()}
