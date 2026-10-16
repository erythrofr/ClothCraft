import assert from 'node:assert/strict'
import {createTeeTemplate} from '../src/data/templates.js'
import {buildSimulation} from '../src/core/physics.js'
import {inspectClothMesh} from '../src/core/physics/meshQuality.js'
import {optimizeTriangleQuality} from '../src/core/physics/qualityTriangulation.js'

function boundaryEdges(faces) {
  const edges=new Map()
  for(const face of faces)for(let i=0;i<3;i++){
    const a=face[i],b=face[(i+1)%3],k=a<b?`${a}:${b}`:`${b}:${a}`
    edges.set(k,(edges.get(k)||0)+1)
  }
  return [...edges].filter(([_,n])=>n===1).map(([k])=>k).sort()
}

const project=createTeeTemplate()
const sim=buildSimulation(project)
const rows=[]
for(const piece of sim.pieces.values()){
  const source={vertices:piece.flatVertices,faces:piece.faces}
  const area=(faces)=>faces.reduce((total,face)=>{
    const [a,b,c]=face.map(i=>piece.flatVertices[i])
    return total+Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2
  },0)
  const original=inspectClothMesh(source.vertices,source.faces)
  const optimized=optimizeTriangleQuality(source,{passes:12})
  const after=inspectClothMesh(optimized.vertices,optimized.faces)
  assert.deepEqual(boundaryEdges(source.faces),boundaryEdges(optimized.faces),`${piece.id} altered a cut edge`)
  assert.ok(Math.abs(area(source.faces)-area(optimized.faces))<1e-5,`${piece.id} changed cut area`)
  assert.equal(optimized.vertices.length,source.vertices.length)
  assert.equal(optimized.faces.length,source.faces.length)
  assert.ok(after.maximumAspect<=original.maximumAspect+1e-4,`${piece.id} made aspect worse`)
  rows.push({piece:piece.id,flips:optimized.flips,beforeWorst:original.maximumAspect,afterWorst:after.maximumAspect,beforeSlivers:original.slenderFaces,afterSlivers:after.slenderFaces})
}
const again=optimizeTriangleQuality({vertices:sim.pieces.get('front').flatVertices,faces:sim.pieces.get('front').faces},{passes:12})
assert.deepEqual(again.faces,optimizeTriangleQuality({vertices:sim.pieces.get('front').flatVertices,faces:sim.pieces.get('front').faces},{passes:12}).faces,'must be deterministic')
console.log(JSON.stringify({pass:true,boundariesPreserved:true,areasPreserved:true,deterministic:true,rows},null,2))
