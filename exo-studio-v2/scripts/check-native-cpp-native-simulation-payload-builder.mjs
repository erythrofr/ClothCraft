import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'

const binary=process.env.GARMENT_NATIVE_PAYLOAD_BUILDER_TEST||'/tmp/garment-native-payload-builder-test'
if(!process.env.GARMENT_NATIVE_PAYLOAD_BUILDER_TEST){
 const r=spawnSync(process.env.CXX||'c++',['-std=c++17','-O1','-I','native_cpp/vendor',
  'native_cpp/core/native_simulation_payload_builder.cpp','native_cpp/core/assembled_cloth_snapshot.cpp',
  'native_cpp/core/cloth_meshing_pipeline.cpp','native_cpp/core/cloth_seam_constraints.cpp',
  'native_cpp/core/native_payload.cpp','native_cpp/core/simulation_quality.cpp','native_cpp/core/native_assembly_preflight.cpp','native_cpp/tests/test_native_simulation_payload_builder.cpp',
  'native_cpp/core/avatar_physics.cpp',
  '-o',binary],{encoding:'utf8',maxBuffer:4*1024*1024})
 assert.equal(r.status,0,r.error?.message||r.stderr)
}
function compare(a,b,path='',stats={total:0,matched:0,examples:[]}){
 if(Array.isArray(a)&&Array.isArray(b)){
  if(a.length!==b.length)stats.examples.push({path,expected:b.length,received:a.length})
  for(let i=0;i<Math.min(a.length,b.length);i++)compare(a[i],b[i],`${path}[${i}]`,stats)
 }else if(a&&b&&typeof a==='object'&&typeof b==='object'){
  for(const key of Object.keys(b))compare(a[key],b[key],`${path}.${key}`,stats)
 }else{
  stats.total++
  if(typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=1e-8:a===b)stats.matched++
  else if(stats.examples.length<12)stats.examples.push({path,expected:b,received:a})
 }
 return stats
}
for(const template of ['tee','pants','tee-virtual','tee-fabric-variation','pants-solver-variation','tee-split-torso','tee-fused','pants-fused','tee-fused-frozen','pants-fused-frozen','tee-two-fused','pants-two-fused','tee-fuse-custom','pants-fuse-custom','tee-optimized','pants-optimized','tee-optimized-project','pants-optimized-project','tee-sew-first','pants-sew-first-project']){
 const project=createTemplateProject(template.startsWith('pants')?'pants':'tee')
 if(template==='tee-virtual')project.seams[0].useExactCorrespondence=true
 if(template==='tee-fabric-variation'){
  project.pieces[0].grainAngleDeg=37
  project.fabrics.main.bend=.28
  project.simulation.gravity=7.5
 }
 if(template==='pants-solver-variation'){
  project.simulation.iterations=10
  project.simulation.substeps=3
 }
 if(template==='tee-split-torso')project.pieces[0].fitShoulderSides=['left']
 const fused=template.includes('-fused')||template.includes('-two-fused')
 if(fused)project.pieces[1].fusedToPieceId=project.pieces[0].id
 if(template.includes('-two-fused'))project.pieces[2].fusedToPieceId=project.pieces[0].id
 if(template.includes('-frozen'))project.pieces[1].frozen3d=true
 if(template.includes('fuse-custom')){
  project.pieces[1].fusedToPieceId=project.pieces[0].id
  project.pieces[1].fuseGapM=.0025
  project.pieces[1].fuseStiffness=.91
 }
 if(template.endsWith('-optimized-project'))project.simulation.experimentalNativeMeshOptimization=true
 if(template.endsWith('-sew-first-project'))project.simulation.experimentalNativeSewFirst=true
 const options=template.endsWith('-optimized')?{experimentalOptimizeMesh:true}:template==='tee-sew-first'?{experimentalSewFirst:true}:{}
 const original=JSON.stringify(project)
 const expected=buildNativeSimulationPayload(project,options)
 assert.equal(JSON.stringify(project),original,'JS payload mutated authored project')
 const input=JSON.stringify({project,options})
 const proc=spawnSync(binary,['--json-lines'],{input:input+'\n',encoding:'utf8',maxBuffer:32*1024*1024})
 assert.equal(proc.status,0,proc.stderr)
 const message=JSON.parse(proc.stdout.trim())
 if(options.experimentalOptimizeMesh||options.experimentalSewFirst||template.endsWith('-optimized-project')||template.endsWith('-sew-first-project')){assert.equal(message.ok,false);assert.match(message.error,/unsupported/);console.log(JSON.stringify({template,unsupported:message.error}));continue}
 assert.equal(message.ok,true,message.error)
 const actual=message.result
 assert.equal(actual.fullPayloadParity,false)
 const fields=['project','avatar','settings','particles','pieces','constraints','virtualSeams','anchors','fusedPiecePairs','collisionExclusions','initialAssembly']
 const report=Object.fromEntries(fields.map(field=>[field,compare(actual[field],expected[field],field)]))
 if(!fused)assert.equal(report.pieces.total,template.startsWith('pants')?1916:4636,`${template}: changed mesh fixture unexpectedly`)
 if(!fused){
  if(template.startsWith('pants'))assert.equal(report.pieces.matched,report.pieces.total,'pants mesh quality must match completely')
  else assert.ok(report.pieces.matched>=4620,`${template}: tee mesh quality regressed below measured baseline`)
 }
 if(report.pieces.matched!==report.pieces.total){
  const ranking=actual.pieces.flatMap((piece,pieceIndex)=>piece.meshQuality.worst.map((item,rank)=>({pieceIndex,rank,nativeIndex:item.index,jsIndex:expected.pieces[pieceIndex]?.meshQuality.worst[rank]?.index,nativeAspect:item.aspect,jsAspect:expected.pieces[pieceIndex]?.meshQuality.worst[rank]?.aspect}))).filter(item=>item.nativeIndex!==item.jsIndex)
  console.log(JSON.stringify({template,rankingDifferences:ranking,meshMismatchCount:report.pieces.total-report.pieces.matched,firstMismatches:report.pieces.examples}))
 }
 const concise=Object.fromEntries(Object.entries(report).map(([key,value])=>[key,{matched:value.matched,total:value.total,mismatches:value.examples.map(e=>e.path).slice(0,5)}]))
 console.log(JSON.stringify({template,expectedCounts:{particles:expected.particles.length,pieces:expected.pieces.length,constraints:expected.constraints.length,virtualSeams:expected.virtualSeams.length,anchors:expected.anchors.length,collisionExclusions:expected.collisionExclusions.length},receivedCounts:{particles:actual.particles.length,pieces:actual.pieces.length,constraints:actual.constraints.length,virtualSeams:actual.virtualSeams.length,anchors:actual.anchors.length,collisionExclusions:actual.collisionExclusions.length},report:concise,unsupported:actual.parityUnsupported}))
 for(const field of ['project','avatar','settings','virtualSeams','anchors','particles']){
  assert.equal(report[field].matched,report[field].total,`${template}: ${field} numeric/string parity mismatch`)
 }
 if(fused){
  assert.equal(report.fusedPiecePairs.matched,report.fusedPiecePairs.total,`${template}: fused pair mismatch`)
  for(const field of ['constraints','collisionExclusions','initialAssembly'])assert.equal(report[field].matched,report[field].total,`${template}: ${field} mismatch`)
  console.log(JSON.stringify({template,remainingFusedMismatches:{constraints:report.constraints.examples,collisionExclusions:report.collisionExclusions.examples,initialAssembly:report.initialAssembly.examples}}))
 }else for(const field of ['constraints','collisionExclusions','initialAssembly'])assert.equal(report[field].matched,report[field].total,`${template}: ${field} mismatch`)
 assert.equal(actual.fullPayloadParity,false)
}
