import assert from 'node:assert/strict'
import {
  lineIntersection, pointAlongLine, projectOntoLine,
  mirrorPointAcrossLine, preciseConstructionEdit,
} from '../src/core/draftingConstructions.js'

const near=(value,wanted)=>assert.ok(Math.abs(value-wanted)<1e-10,`${value} vs ${wanted}`)
const a={x:0,y:0},b={x:10,y:0},c={x:10,y:10},d={x:0,y:10}
const polygon={points:[a,b,c,d,{x:3,y:4,id:'control'}],curves:{},id:'test-pattern'}
assert.deepEqual(lineIntersection(a,c,b,d),{x:5,y:5})
assert.deepEqual(pointAlongLine(a,b,5),{x:5,y:0})
assert.deepEqual(pointAlongLine(a,b,2,{perpendicular:true}),{x:0,y:2})
assert.deepEqual(projectOntoLine({x:3,y:4},a,b),{x:3,y:0})
assert.deepEqual(mirrorPointAcrossLine({x:3,y:4},a,b),{x:3,y:-4})
const old=JSON.stringify(polygon)
const edited=preciseConstructionEdit(polygon,4,{construction:'intersection',a:1,b:3,c:2,d:4})
near(edited.x,5);near(edited.y,5)
assert.equal(edited.id,'control')
assert.equal(JSON.stringify(polygon),old,'Construction must not modify authored source')
const walked=preciseConstructionEdit(polygon,4,{construction:'line',a:1,b:2,distanceCm:5})
near(walked.x,5);near(walked.y,0)
const lifted=preciseConstructionEdit(polygon,4,{construction:'normal',a:1,b:2,distanceCm:2})
near(lifted.x,0);near(lifted.y,2)
const projected=preciseConstructionEdit(polygon,4,{construction:'foot',a:1,b:2})
near(projected.x,3);near(projected.y,0)
const mirrored=preciseConstructionEdit(polygon,4,{construction:'mirror',a:1,b:2})
near(mirrored.x,3);near(mirrored.y,-4)
assert.throws(()=>lineIntersection(a,b,{x:0,y:1},{x:1,y:1}),/parallel/)
assert.throws(()=>preciseConstructionEdit(polygon,4,{construction:'line',a:1,b:1,distanceCm:10}),/zero length/)
assert.throws(()=>preciseConstructionEdit(polygon,4,{construction:'intersection',a:1,b:2,c:1,d:2}),/parallel/)
assert.throws(()=>preciseConstructionEdit(polygon,4,{construction:'foot',a:0,b:2}),/Reference index/)
assert.throws(()=>preciseConstructionEdit(polygon,4,{construction:'unsafe',a:1,b:2}),/Unsupported/)
assert.throws(()=>preciseConstructionEdit({...polygon,locked:true},4,{construction:'line',a:1,b:2,distanceCm:2}),/Unlock/)
console.log(JSON.stringify({
  pass:true,operations:['line','normal','foot','mirror','intersection'],
  analyticPrecisionCm:'1e-10',metadataPreserved:true,
  authoredPatternUnmodified:true,invalidGeometryRejected:true,
}))
