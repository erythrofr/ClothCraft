import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation} from '../src/core/physics.js'
const root=resolve(import.meta.dirname,'..'),binary=resolve(mkdtempSync(resolve(tmpdir(),'authored-builder-')),'run')
const compile=spawnSync('c++',['-std=c++17','-O1','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/authored_simulation_builder.cpp','native_cpp/core/assembled_cloth_snapshot.cpp','native_cpp/core/cloth_meshing_pipeline.cpp','native_cpp/core/cloth_seam_constraints.cpp','native_cpp/tests/test_authored_simulation_builder.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compile.status,0,compile.stderr)
const cases=[]
for(const template of ['tee','pants']){
 const base=createTemplateProject(template)
 cases.push({name:template,project:base,options:{}})
 const frozen=structuredClone(base);frozen.pieces[0].frozen3d=true;cases.push({name:`${template}-frozen`,project:frozen,options:{}})
 const optimized=structuredClone(base);cases.push({name:`${template}-optimized`,project:optimized,options:{optimizeMesh:true}})
 const fused=structuredClone(base);fused.pieces[1].fusedToPieceId=fused.pieces[0].id;cases.push({name:`${template}-fused`,project:fused,options:{}})
 const lined=structuredClone(base);lined.pieces[0].internalLines=[{id:'test-dart',type:'dart',points:[{x:0,y:0},{x:2,y:5}]}];cases.push({name:`${template}-internal`,project:lined,options:{}})
}
const run=spawnSync(binary,[],{cwd:root,input:JSON.stringify({cases}),encoding:'utf8',maxBuffer:80*1024*1024})
assert.equal(run.status,0,run.stderr)
const results=JSON.parse(run.stdout);assert.equal(results.length,cases.length)
for(let i=0;i<cases.length;i++){
 const {name,project,options}=cases[i],native=results[i]
 if(options.optimizeMesh){assert.equal(native.ok,false);assert.match(native.error,/optimizeMesh/);continue}
 assert.equal(native.ok,true,`${name}: ${native.error}`)
 const js=buildSimulation(project),pieces=[...js.pieces.values()],snapshot=native.result
 assert.equal(snapshot.adapter.fullNamedExportParity,false)
 assert.deepEqual(snapshot.pieces.map(p=>p.id),pieces.map(p=>p.id),'piece insertion order')
 assert.equal(snapshot.particles.length,pieces.reduce((n,p)=>n+p.particles.length,0))
 let maxPositionError=0,matchedFaces=0,frozenCount=0
 for(let k=0;k<pieces.length;k++){
  const a=snapshot.pieces[k],b=pieces[k];assert.equal(a.faces.length,b.faces.length)
  for(let f=0;f<b.faces.length;f++)if(JSON.stringify(a.faces[f])===JSON.stringify(b.faces[f]))matchedFaces++
  for(let j=0;j<b.particles.length;j++){
   const actual=snapshot.particles[a.particleOffset+j],wanted=b.particles[j]
   maxPositionError=Math.max(maxPositionError,Math.hypot(...actual.position.map((v,axis)=>v-wanted.position.toArray()[axis])))
   assert.equal(actual.invMass,wanted.invMass)
   assert.deepEqual(actual.previous,actual.position)
   assert.equal(actual.contactDepth,0)
   if(actual.invMass===0)frozenCount++
  }
 }
 assert.equal(matchedFaces,pieces.reduce((n,p)=>n+p.faces.length,0))
 assert.ok(maxPositionError<1e-8,`${name} initial position error: ${maxPositionError}`)
 assert.equal(snapshot.anchorConstraints.length,js.anchorConstraints.length)
 assert.equal(snapshot.seamConstraints.length,js.seamConstraints.filter(c=>['seam','seam-virtual'].includes(c.type)).length)
 console.log(JSON.stringify({name,particles:snapshot.particles.length,pieces:pieces.length,matchedFaces,anchors:snapshot.anchorConstraints.length,seams:snapshot.seamConstraints.length,frozenCount,maxPositionError,fullNamedExportParity:false}))
}
console.log('PASS authored snapshot default/frozen; optimizeMesh fails closed; live buildSimulation export remains uncounted')
