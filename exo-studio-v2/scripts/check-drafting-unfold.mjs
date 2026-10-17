import assert from 'node:assert/strict'
import { unfoldDraftPiece } from '../src/core/draftingUnfold.js'
import { inspectDraftTopology } from '../src/core/draftingTopology.js'
import { edgeLength } from '../src/core/project.js'

const half={
  id:'half',name:'Half bodice',locked:false,seamAllowance:1,
  points:[{x:0,y:0},{x:10,y:0},{x:10,y:20},{x:0,y:20}],
  curves:{1:{cx:13,cy:10}},edgeSeamAllowances:{1:1.5},
  notches:[{id:'n',edgeIndex:1,t:.3,depthCm:.45}],
  internalLines:[{id:'dart',name:'Dart guide',type:'construction',
    a:{x:3,y:5},b:{x:8,y:15}}],
}
const result=unfoldDraftPiece(half,3)
assert.equal(result.piece.id,'half','Preserve stable piece identity')
assert.equal(result.piece.points.length,6,'4 vertices must unfold to 6')
assert.ok(inspectDraftTopology(result.piece).valid)
assert.equal(result.piece.curves[1].cx,13)
assert.ok(Number.isFinite(result.piece.curves[4].cx),'Reflected curve control survives')
assert.ok(Math.abs(edgeLength(result.piece,1)-edgeLength(result.piece,4))<.00001)
assert.equal(result.piece.notches.length,2)
assert.equal(result.piece.notches[1].t,.7)
assert.equal(result.piece.internalLines.length,2)
assert.equal(result.edgeMap[0],0)
assert.equal(result.edgeMap[1],1)
assert.equal(result.edgeMap[2],2)
assert.ok(Math.abs(result.areaCm2 - inspectDraftTopology(half,{curveSamples:24}).areaCm2*2)<.025)
assert.equal(half.points.length,4,'Do not mutate original half-pattern')
assert.throws(()=>unfoldDraftPiece({...half,locked:true},3),/Unlock/)
assert.throws(()=>unfoldDraftPiece({...half,curves:{...half.curves,3:{cx:0,cy:10}}},3),/straight fold/)
const crossed={...half,points:[{x:0,y:0},{x:10,y:10},{x:10,y:0},{x:0,y:20}]}
assert.throws(()=>unfoldDraftPiece(crossed,3),/Unfold|original/)
console.log('2D symmetric unfold: doubled true curve area, reflected armhole, notch, internal line, sewing map and invalid fold guards PASS')
