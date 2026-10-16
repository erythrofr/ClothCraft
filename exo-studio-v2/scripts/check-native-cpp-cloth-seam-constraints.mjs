import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation,boundaryIndicesForEdge} from '../src/core/physics.js'

const cases=[]
const mesher=process.env.GARMENT_CLOTH_MESH_TEST||'/tmp/garment-cloth-meshing-pipeline-test'
for(const name of ['tee','pants','tee-virtual']){
 const project=createTemplateProject(name==='tee-virtual'?'tee':name)
 if(name==='tee-virtual')project.seams[0].useExactCorrespondence=true
 const js=buildSimulation(project)
 const nativeMesher=spawnSync(mesher,['--json-lines'],{input:JSON.stringify(project)+'\n',encoding:'utf8',maxBuffer:32*1024*1024})
 if(nativeMesher.error)throw nativeMesher.error
 assert.equal(nativeMesher.status,0,nativeMesher.stderr)
 const meshed=JSON.parse(nativeMesher.stdout.trim());assert.equal(meshed.ok,true,meshed.error)
 const mesh=meshed.result
 const refs=new Map([...js.pieces.values()].flatMap(p=>p.particles.map((q,i)=>[q,{pieceId:p.id,index:i}])))
 const expected=js.seamConstraints.filter(c=>['seam','seam-virtual'].includes(c.type)).map(c=>c.type==='seam'?({type:c.type,aPieceId:refs.get(c.a).pieceId,bPieceId:refs.get(c.b).pieceId,aIndex:refs.get(c.a).index,bIndex:refs.get(c.b).index,rest:c.rest,stiffness:c.stiffness,seamId:c.seamId,seamType:c.seamType,junctionScale:c.junctionScale}):({type:c.type,aPieceId:refs.get(c.a).pieceId,bPieceId:refs.get(c.b).pieceId,aIndex:refs.get(c.a).index,bIndex:refs.get(c.b).index,sourceIndices:c.sourceParticles.map(p=>refs.get(p).index),sourceWeights:c.sourceWeights,targetIndices:c.targetParticles.map(p=>refs.get(p).index),targetWeights:c.targetWeights,progress:c.progress,arclengthWeight:c.arclengthWeight,rest:c.rest,stiffness:c.stiffness,seamId:c.seamId,seamType:c.seamType,sourceCloSeamGroup:c.sourceCloSeamGroup}))
 const expectedAnchors=js.anchorConstraints.map(c=>({type:c.type,pieceId:c.pieceId,particleIndex:refs.get(c.particle).index,target:c.target.toArray(),stiffness:c.stiffness,...(c.axes?{axes:c.axes}:{})}))
 cases.push({name,project,mesh,expected,expectedAnchors,js})
}
const bin=process.env.GARMENT_CLOTH_SEAM_TEST||'/tmp/garment-cloth-seam-constraints-test'
const result=spawnSync(bin,['--json-lines'],{input:cases.map(({project,mesh})=>JSON.stringify({project,mesh})).join('\n')+'\n',encoding:'utf8',maxBuffer:32*1024*1024})
if(result.error)throw result.error
assert.equal(result.status,0,result.stderr)
const outputs=result.stdout.trim().split('\n').map(JSON.parse)
assert.equal(outputs.length,cases.length)
for(let i=0;i<cases.length;i++){
 const c=cases[i],actual=outputs[i];assert.equal(actual.ok,true,actual.error)
 const projectBefore=JSON.stringify(c.project),meshBefore=JSON.stringify(c.mesh)
 const received=actual.result.seamConstraints
 let matched=0
 let maxNumericError=0
 for(let j=0;j<Math.min(received.length,c.expected.length);j++){
  const compare=(a,b)=>{if(typeof a==='number'&&typeof b==='number'){maxNumericError=Math.max(maxNumericError,Math.abs(a-b));return Math.abs(a-b)<1e-8}if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,k)=>compare(v,b[k]));return a===b}
  if(Object.keys(c.expected[j]).every(key=>compare(received[j][key],c.expected[j][key])))matched++
 }
 const missing=c.expected.length-received.length
 const anchors=c.expectedAnchors.length
 const nativeAnchors=actual.result.anchorConstraints
 let matchedAnchors=0,maxAnchorTargetError=0
 for(let j=0;j<Math.min(anchors,nativeAnchors.length);j++){
  const a=c.expectedAnchors[j],b=nativeAnchors[j]
  const same=['type','pieceId','particleIndex','stiffness','axes'].every(key=>a[key]===b[key])
  const error=Math.max(...a.target.map((v,k)=>Math.abs(v-b.target[k])))
  maxAnchorTargetError=Math.max(maxAnchorTargetError,error)
  if(same&&error<1e-10)matchedAnchors++
 }
 console.log(JSON.stringify({template:c.name,jsSeams:c.expected.length,nativeSeams:received.length,orderedExact:matched,maxNumericError,missingSeams:missing,jsAnchors:anchors,nativeAnchors:nativeAnchors.length,orderedExactAnchors:matchedAnchors,maxAnchorTargetError,unsupported:actual.result.unsupportedSeams}))
 assert.equal(received.length,c.expected.length,'seam count must match')
 assert.equal(matched,c.expected.length,'ordered seam constraints must match')
 assert.equal(nativeAnchors.length,anchors,'anchor count must match')
 assert.equal(matchedAnchors,anchors,'ordered anchors must match')
 assert.equal(JSON.stringify(c.project),projectBefore,'authored project must remain unchanged')
 assert.equal(JSON.stringify(c.mesh),meshBefore,'native mesh snapshot must remain unchanged')
}
