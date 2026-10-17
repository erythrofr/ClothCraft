import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation} from '../src/core/physics.js'

const binary=process.env.GARMENT_ASSEMBLED_CLOTH_TEST||'/tmp/garment-assembled-cloth-snapshot-test'
if(!process.env.GARMENT_ASSEMBLED_CLOTH_TEST){
 const compile=spawnSync(process.env.CXX||'c++',['-std=c++17','-O1','-I','native_cpp/vendor',
  'native_cpp/core/assembled_cloth_snapshot.cpp','native_cpp/core/cloth_meshing_pipeline.cpp',
  'native_cpp/core/cloth_seam_constraints.cpp','native_cpp/tests/test_assembled_cloth_snapshot.cpp','-o',binary],{encoding:'utf8',maxBuffer:4*1024*1024})
 assert.equal(compile.status,0,compile.error?.message||compile.stderr)
}
const names=['tee','pants','tee-virtual']
for(const name of names){
 const project=createTemplateProject(name==='tee-virtual'?'tee':name)
 if(name==='tee-virtual')project.seams[0].useExactCorrespondence=true
 const before=JSON.stringify(project)
 const js=buildSimulation(project)
 const run=spawnSync(binary,['--json-lines'],{input:before+'\n',encoding:'utf8',maxBuffer:32*1024*1024})
 assert.equal(run.status,0,run.error?.message||run.stderr)
 const response=JSON.parse(run.stdout.trim());assert.equal(response.ok,true,response.error)
 const native=response.result, jsPieces=[...js.pieces.values()]
 assert.equal(native.pieces.length,jsPieces.length)
 const references=new Map()
 let expectedFaces=0,maxPositionError=0,matchingFaces=0
 for(let k=0;k<jsPieces.length;k++){
  const a=native.pieces[k],b=jsPieces[k]
  assert.equal(a.id,b.id)
  assert.equal(a.particleCount,b.particles.length)
  assert.equal(a.faces.length,b.faces.length)
  for(let i=0;i<b.particles.length;i++){
   references.set(b.particles[i],{pieceId:b.id,index:i})
   const p=b.particles[i].position,q=a.positions[i]
   maxPositionError=Math.max(maxPositionError,Math.hypot(q[0]-p.x,q[1]-p.y,q[2]-p.z))
   assert.equal(native.particles[a.particleOffset+i].simIndex,b.particles[i].simIndex)
  }
  for(let i=0;i<b.faces.length;i++){
   expectedFaces++
   if(JSON.stringify(a.faces[i])===JSON.stringify(b.faces[i]))matchingFaces++
  }
 }
 assert.equal(native.particleCount,[...js.pieces.values()].reduce((n,p)=>n+p.particles.length,0))
 assert.equal(native.faceCount,expectedFaces)
 assert.ok(maxPositionError<1e-8,`initial positions differ: ${maxPositionError}`)
 assert.equal(matchingFaces,expectedFaces,'ordered face index parity')
 const jsSeams=js.seamConstraints.filter(c=>['seam','seam-virtual'].includes(c.type))
 assert.equal(native.seamConstraints.length,jsSeams.length)
 let matchedSeams=0
 const near=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<1e-8:Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&a.every((v,i)=>near(v,b[i])):a===b
 for(let i=0;i<jsSeams.length;i++){
  const c=jsSeams[i],a=native.seamConstraints[i]
  const left=references.get(c.a),right=references.get(c.b)
  assert.ok(left&&right)
  const fields={type:c.type,aPieceId:left.pieceId,bPieceId:right.pieceId,aIndex:left.index,bIndex:right.index,rest:c.rest,stiffness:c.stiffness,seamId:c.seamId,seamType:c.seamType}
  if(c.type==='seam')fields.junctionScale=c.junctionScale
  else Object.assign(fields,{sourceIndices:c.sourceParticles.map(p=>references.get(p).index),sourceWeights:c.sourceWeights,targetIndices:c.targetParticles.map(p=>references.get(p).index),targetWeights:c.targetWeights,progress:c.progress,arclengthWeight:c.arclengthWeight})
  if(Object.entries(fields).every(([key,val])=>near(a[key],val)))matchedSeams++
 }
 assert.equal(matchedSeams,jsSeams.length)
 assert.equal(native.anchorConstraints.length,js.anchorConstraints.length)
 let matchedAnchors=0
 for(let i=0;i<js.anchorConstraints.length;i++){
  const c=js.anchorConstraints[i],a=native.anchorConstraints[i],ref=references.get(c.particle)
  if(ref&&a.type===c.type&&a.pieceId===c.pieceId&&a.particleIndex===ref.index&&near(a.target,c.target.toArray())&&near(a.stiffness,c.stiffness)&&a.axes===c.axes)matchedAnchors++
 }
 assert.equal(matchedAnchors,js.anchorConstraints.length)
 const expectedCloth=js.clothConstraints.filter(c=>c.type!=='seam-virtual')
 const virtualCloth=js.clothConstraints.filter(c=>c.type==='seam-virtual')
 assert.equal(virtualCloth.length,native.seamConstraints.filter(c=>c.type==='seam-virtual').length)
 assert.equal(native.clothConstraints.length,expectedCloth.length,'ordered cloth constraint count')
 let matchedCloth=0,maxClothNumericError=0
 for(let i=0;i<expectedCloth.length;i++){
  const e=expectedCloth[i],n=native.clothConstraints[i],left=references.get(e.a),right=references.get(e.b)
  const fields={type:e.type,pieceId:left.pieceId,aIndex:left.index,bIndex:right.index,rest:e.rest,stiffness:e.stiffness}
  if(e.type==='structural')Object.assign(fields,{warpWeight:e.warpWeight,weftWeight:e.weftWeight})
  if(e.trimId!==undefined)fields.trimId=e.trimId
  if(e.seamId!==undefined)fields.seamId=e.seamId
  if(e.ratio!==undefined)fields.ratio=e.ratio
  for(const [key,value] of Object.entries(fields))if(typeof value==='number'&&typeof n[key]==='number')maxClothNumericError=Math.max(maxClothNumericError,Math.abs(value-n[key]))
  if(Object.entries(fields).every(([key,value])=>near(n[key],value)))matchedCloth++
 }
 assert.equal(matchedCloth,expectedCloth.length,'ordered structural/bend numeric parity')
 assert.equal(JSON.stringify(project),before,'source project mutation')
 assert.equal(native.fullSolverParity,false)
 console.log(JSON.stringify({name,particles:native.particleCount,faces:expectedFaces,orderedMatchingFaces:matchingFaces,maxInitialPositionErrorM:maxPositionError,seams:matchedSeams,anchors:matchedAnchors,jsPhysicalConstraints:expectedCloth.length,nativePhysicalConstraints:matchedCloth,virtualConstraintsAlsoInJsCloth:virtualCloth.length,maxClothNumericError,fullSolverParity:false}))
}
const pinned=createTemplateProject('tee');pinned.pieces[0].pins=[{id:'test',x:0,y:0}]
const check=spawnSync(binary,['--json-lines'],{input:JSON.stringify(pinned)+'\n',encoding:'utf8'})
assert.equal(check.status,0,check.stderr)
assert.equal(JSON.parse(check.stdout.trim()).result.manualPinsUnsupported,true)
console.log('manual pins explicitly unsupported; assembled snapshot parity verified')
