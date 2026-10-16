import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createTemplateProject} from '../src/data/templates.js'
import {buildSimulation,boundaryIndicesForEdge} from '../src/core/physics.js'

const tee=createTemplateProject('tee')
const rectangle={id:'rect',points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],arrangement3d:{x:0,y:0,z:0}}
const projects=[{label:'tee',project:tee},{label:'pants',project:createTemplateProject('pants')},{label:'rectangle',project:{pieces:[rectangle],fabrics:{main:{}},simulation:{resolution:1},avatar:{}}}]
const exe=process.env.GARMENT_CLOTH_MESH_TEST||'/tmp/garment-cloth-meshing-pipeline-test'
const run=spawnSync(exe,['--json-lines'],{input:projects.map(x=>JSON.stringify(x.project)).join('\n')+'\n',encoding:'utf8',maxBuffer:16*1024*1024})
if(run.error)throw run.error
assert.equal(run.status,0,run.stderr)
const results=run.stdout.trim().split('\n').map(JSON.parse)
for(let i=0;i<projects.length;i++){
 const {label,project}=projects[i],native=results[i]
 assert.equal(native.ok,true,native.error)
 const js=buildSimulation(project)
 const expected=[...js.pieces.values()]
 assert.equal(native.result.pieces.length,expected.length)
 let exactVertices=0,exactFaces=0,maxFlatDeviation=0,maxPositionDeviation=0,matchingBoundaryEdges=0,totalBoundaryEdges=0,maxNearestFlatCm=0,maxNearestPositionM=0,matchedFacesByCoordinates=0,totalFaces=0,exactIndexedFaces=0
 for(let j=0;j<expected.length;j++){
  const a=native.result.pieces[j],b=expected[j]
  assert.equal(a.id,b.id)
  if(a.flatVertices.length===b.flatVertices.length)exactVertices++
  if(a.faces.length===b.faces.length)exactFaces++
  const count=Math.min(a.flatVertices.length,b.flatVertices.length)
  for(let k=0;k<count;k++){
   maxFlatDeviation=Math.max(maxFlatDeviation,Math.hypot(a.flatVertices[k].x-b.flatVertices[k].x,a.flatVertices[k].y-b.flatVertices[k].y))
   const p=b.particles[k].position,q=a.positions[k]
   maxPositionDeviation=Math.max(maxPositionDeviation,Math.hypot(q[0]-p.x,q[1]-p.y,q[2]-p.z))
  }
  const key=p=>`${p.x.toFixed(7)},${p.y.toFixed(7)}`
  const remap=a.flatVertices.map(p=>b.flatVertices.findIndex(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-7))
  for(let k=0;k<a.flatVertices.length;k++){
   const p=a.flatVertices[k]
   maxNearestFlatCm=Math.max(maxNearestFlatCm,Math.min(...b.flatVertices.map(q=>Math.hypot(p.x-q.x,p.y-q.y))))
   if(remap[k]>=0){const q=b.particles[remap[k]].position,v=a.positions[k];maxNearestPositionM=Math.max(maxNearestPositionM,Math.hypot(v[0]-q.x,v[1]-q.y,v[2]-q.z))}
  }
  const jsFaces=new Set(b.faces.map(face=>face.map(k=>key(b.flatVertices[k])).sort().join('|')))
  for(let k=0;k<a.faces.length;k++){const face=a.faces[k];totalFaces++;if(JSON.stringify(face)===JSON.stringify(b.faces[k]))exactIndexedFaces++;if(face.every(idx=>idx<a.flatVertices.length)&&jsFaces.has(face.map(idx=>key(a.flatVertices[idx])).sort().join('|')))matchedFacesByCoordinates++}
  for(let k=0;k<a.boundaryIndices.length;k++){totalBoundaryEdges++;if(JSON.stringify(a.boundaryIndices[k])===JSON.stringify(boundaryIndicesForEdge(b,k)))matchingBoundaryEdges++}
 }
 console.log(JSON.stringify({label,pieces:expected.length,equalVertexCounts:exactVertices,equalFaceCounts:exactFaces,maxIndexFlatDeviationCm:maxFlatDeviation,maxIndexPositionDeviationM:maxPositionDeviation,maxNearestFlatCm,maxMappedInitialPositionDeviationM:maxNearestPositionM,matchingTriangleCoordinateSets:matchedFacesByCoordinates,exactIndexedFaces,totalFaces,exactBoundaryEdges:matchingBoundaryEdges,totalBoundaryEdges}))
 assert.equal(exactVertices,expected.length,'native mesh must preserve each piece vertex count')
 assert.equal(exactFaces,expected.length,'native mesh must preserve each piece triangle count')
 if(label==='tee'||label==='pants'){assert.equal(exactIndexedFaces,totalFaces,'triangle indices must match JS');assert.equal(matchingBoundaryEdges,totalBoundaryEdges,'all sampled seam boundary indices must match JS');assert.ok(maxFlatDeviation<1e-9,'flat vertices must match JS')}
 assert.ok(maxNearestPositionM<1e-10,'initial placement must agree for tested wrap modes')
 assert.ok(Number.isFinite(maxNearestFlatCm)&&Number.isFinite(maxPositionDeviation))
 if(label==='rectangle'){
  assert.equal(exactVertices,1)
  assert.equal(exactFaces,1)
 }
}
