import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation} from '../src/core/physics.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
const binary=process.env.GARMENT_OPTIMIZED_SNAPSHOT_TEST||'/tmp/garment-optimized-authored-snapshot-test'
if(!process.env.GARMENT_OPTIMIZED_SNAPSHOT_TEST){
 const c=spawnSync(process.env.CXX||'c++',['-std=c++17','-O1','-I','native_cpp/vendor','-I','native_cpp/core',
  'native_cpp/core/optimized_authored_snapshot.cpp','native_cpp/core/assembled_cloth_snapshot.cpp',
  'native_cpp/core/quality_triangulation.cpp','native_cpp/core/cloth_meshing_pipeline.cpp',
  'native_cpp/core/cloth_seam_constraints.cpp','native_cpp/core/native_simulation_payload_builder.cpp',
  'native_cpp/core/native_payload.cpp','native_cpp/core/simulation_quality.cpp',
  'native_cpp/core/native_assembly_preflight.cpp','native_cpp/core/avatar_physics.cpp',
  'native_cpp/tests/test_optimized_authored_snapshot.cpp','-o',binary],{encoding:'utf8'})
 assert.equal(c.status,0,c.stderr)
}
const tags=['tee','pants','tee-virtual','pants-virtual','tee-fused','pants-fused']
const projects=tags.map(tag=>{
 const p=createTemplateProject(tag.startsWith('pants')?'pants':'tee')
 if(tag.endsWith('virtual'))p.seams[0].useExactCorrespondence=true
 if(tag.endsWith('fused'))p.pieces[1].fusedToPieceId=p.pieces[0].id
 return p
})
const before=projects.map(p=>JSON.stringify(p))
const r=spawnSync(binary,[],{input:JSON.stringify({projects}),encoding:'utf8',maxBuffer:96*1024*1024})
assert.equal(r.status,0,r.stderr)
const results=JSON.parse(r.stdout)
let allStrict=true
for(let k=0;k<projects.length;k++){
 const project=projects[k],tag=tags[k],response=results[k]
 assert.equal(response.ok,true,response.error)
 const native=response.snapshot,js=buildSimulation(project,{optimizeMesh:true}),payload=buildNativeSimulationPayload(project,{experimentalOptimizeMesh:true})
 const xpbd=response.payload
 assert.equal(xpbd.fullPayloadParity,false)
 const compare=(a,b,path,stats)=>{
  if(Array.isArray(b)){if(!Array.isArray(a)||a.length!==b.length)stats.push({path,expectedLength:b.length,actualLength:a?.length});for(let i=0;i<Math.min(a?.length??0,b.length);i++)compare(a[i],b[i],`${path}[${i}]`,stats)}
  else if(b!==null&&typeof b==='object'){for(const key of Object.keys(b))compare(a?.[key],b[key],`${path}.${key}`,stats)}
  else if(typeof a==='number'&&typeof b==='number'?Math.abs(a-b)>1e-8:a!==b)stats.push({path,expected:b,actual:a})
 }
 const payloadMismatches={}
 for(const field of ['project','avatar','settings','particles','pieces','constraints','virtualSeams','anchors','collisionExclusions','fusedPiecePairs','initialAssembly']){
  const stats=[];compare(xpbd[field],payload[field],field,stats);payloadMismatches[field]={count:stats.length,first:stats.slice(0,5)}
 }
 console.log(JSON.stringify({template:tag,payloadMismatches}))
 const unexpected=Object.entries(payloadMismatches).filter(([field,result])=>result.count&&field!=='pieces'&&!((tag.endsWith('virtual'))&&['virtualSeams','collisionExclusions'].includes(field)))
 assert.equal(unexpected.length,0,`${tag} unexpected optimized payload mismatches: ${JSON.stringify(unexpected)}`)
 if(tag.endsWith('virtual'))assert.ok(payloadMismatches.virtualSeams.count>0,'optimized virtual seam parity must not be silently claimed')
 assert.equal(native.fullPayloadParity,false)
 assert.equal(native.pieces.length,js.pieces.size)
 let faceMismatch=0,positionError=0,structuralMismatch=0,bendMismatch=0
 const referenceConstraints=js.clothConstraints.filter(c=>c.type==='structural'||c.type==='bend')
 const actualConstraints=native.clothConstraints.filter(c=>c.type==='structural'||c.type==='bend')
 const expectedSeams=js.seamConstraints.filter(c=>c.type==='seam'||c.type==='seam-virtual')
 const expectedAnchors=js.anchorConstraints
 const refs=new Map()
 for(let i=0;i<native.pieces.length;i++){
  const a=native.pieces[i],b=[...js.pieces.values()][i]
  assert.equal(a.id,b.id)
  assert.equal(a.faces.length,b.faces.length)
  assert.equal(a.positions.length,b.particles.length)
  for(let f=0;f<a.faces.length;f++)if(a.faces[f].some((v,j)=>v!==b.faces[f][j]))faceMismatch++
  for(let j=0;j<b.particles.length;j++){
   refs.set(b.particles[j],{pieceId:b.id,index:j})
   positionError=Math.max(positionError,...a.positions[j].map((v,axis)=>Math.abs(v-b.particles[j].position.toArray()[axis])))
  }
 }
 for(let i=0;i<Math.max(actualConstraints.length,referenceConstraints.length);i++){
  const a=actualConstraints[i],b=referenceConstraints[i]
  if(!a||!b){structuralMismatch++;continue}
  const ra=refs.get(b.a),rb=refs.get(b.b)
  const same=a.type===b.type&&a.pieceId===ra?.pieceId&&a.aIndex===ra?.index&&a.bIndex===rb?.index&&Math.abs(a.rest-b.rest)<1e-8&&Math.abs(a.stiffness-b.stiffness)<1e-8
  if(!same){if(b.type==='bend')bendMismatch++;else structuralMismatch++}
 }
 let seamMismatch=0,anchorMismatch=0
 for(let i=0;i<Math.max(native.seamConstraints.length,expectedSeams.length);i++){
  const a=native.seamConstraints[i],b=expectedSeams[i]
  if(!a||!b){seamMismatch++;continue}
  const x=refs.get(b.a),y=refs.get(b.b)
  if(a.type!==b.type||a.aPieceId!==x?.pieceId||a.bPieceId!==y?.pieceId||a.aIndex!==x?.index||a.bIndex!==y?.index||Math.abs(a.rest-b.rest)>1e-8||Math.abs(a.stiffness-b.stiffness)>1e-8)seamMismatch++
 }
 for(let i=0;i<Math.max(native.anchorConstraints.length,expectedAnchors.length);i++){
  const a=native.anchorConstraints[i],b=expectedAnchors[i]
  if(!a||!b){anchorMismatch++;continue}
  const x=refs.get(b.particle)
  if(a.type!==b.type||a.pieceId!==x?.pieceId||a.particleIndex!==x?.index||Math.max(...a.target.map((v,j)=>Math.abs(v-b.target.toArray()[j])))>1e-8||Math.abs(a.stiffness-b.stiffness)>1e-8)anchorMismatch++
 }
 const report={template:tag,faces:native.faceCount,faceMismatch,positionError,structuralMismatch,bendMismatch,seamMismatch,anchorMismatch,nativeSeams:native.seamConstraints.length,jsSeams:expectedSeams.length,nativeAnchors:native.anchorConstraints.length,jsAnchors:expectedAnchors.length,nativeConstraints:actualConstraints.length,jsConstraints:referenceConstraints.length,jsPayloadConstraints:payload.constraints.length,jsPayloadExclusions:payload.collisionExclusions.length,jsPayloadParticles:payload.particles.length,jsPayloadFaceCount:payload.pieces.reduce((n,p)=>n+p.faces.length,0),fullPayloadParity:false}
 console.log(JSON.stringify(report))
 allStrict&&=faceMismatch===0&&positionError<1e-8&&structuralMismatch===0&&bendMismatch===0&&seamMismatch===0&&anchorMismatch===0&&actualConstraints.length===referenceConstraints.length
 assert.equal(JSON.stringify(project),before[k],'source project mutation')
}
if(!allStrict){console.log('PARTIAL parity: optimized native snapshot remains uncounted; diagnostic mismatches above');process.exitCode=2}
else console.log('PASS optimized faces, initial particles, ordered structural/bend constraints; complete native payload still unverified')
