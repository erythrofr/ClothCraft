import assert from 'node:assert/strict'
import { inspectDraftTopology, isDraftEditValid } from '../src/core/draftingTopology.js'
import { createDefaultProject } from '../src/data/defaultProject.js'

const square = {
  id:'s', points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],
}
const result=inspectDraftTopology(square)
assert.equal(result.valid,true)
assert.ok(Math.abs(result.areaCm2-100)<1e-8)
assert.equal(result.winding,'counterclockwise')
assert.equal(inspectDraftTopology({ ...square,points:[...square.points].reverse() }).valid,true)
const bowtie={...square,points:[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0}]}
assert.equal(inspectDraftTopology(bowtie).valid,false,'Crossing center is invalid')
assert.ok(inspectDraftTopology(bowtie).intersections.length>0)
const overlap={...square,points:[{x:0,y:0},{x:10,y:0},{x:4,y:0},{x:10,y:10},{x:0,y:10}]}
assert.equal(inspectDraftTopology(overlap).valid,false,'Backtracking along cutting outline is invalid')
const tiny={...square,points:[{x:0,y:0},{x:0.00001,y:0},{x:1,y:1},{x:0,y:1}]}
assert.equal(inspectDraftTopology(tiny).valid,false,'Coincident points are invalid')
const invalid={...square,points:[{x:Infinity,y:0},...square.points.slice(1)]}
assert.equal(inspectDraftTopology(invalid).valid,false,'No infinite pattern coordinates')
assert.equal(isDraftEditValid(square,{pointIndex:1,point:{x:10,y:1}}),true)
assert.equal(isDraftEditValid(square,{pointIndex:1,point:{x:0,y:10}}),false,'Reject vertex edit that folds contour')
assert.equal(isDraftEditValid(square,{edgeIndex:0,curve:{cx:5,cy:-2}}),true)
assert.equal(isDraftEditValid(square,{edgeIndex:0,curve:null}),true)
const actual=createDefaultProject()
const checks=(actual.pieces||[]).map(piece=>({id:piece.id,result:inspectDraftTopology(piece)}))
assert.ok(checks.every(item=>item.result.valid),
  'Default garment must have sound cutlines: '+JSON.stringify(checks.filter(x=>!x.result.valid)))
console.log('2D geometry topology: valid, crossed, overlapping, duplicate, nonfinite, vertex and Bézier edits, '+checks.length+' real garment pieces PASS')
