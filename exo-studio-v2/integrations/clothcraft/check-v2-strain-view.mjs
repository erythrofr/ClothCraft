import assert from 'node:assert/strict'
import {triangleExtension,vertexExtensions} from '../../src/core/clothcraftStrainView.js'
const uv=[[0,0],[1,0],[0,1]],flat=uv.map(([x,y])=>[x,y,0])
assert.equal(triangleExtension(uv,flat),0)
assert(Math.abs(triangleExtension(uv,[[0,0,0],[1.2,0,0],[0,1,0]])-.2)<1e-12)
assert(Math.abs(triangleExtension(uv,[[5,4,3],[5,4,4],[4,4,3]]))<1e-12)
assert.equal(triangleExtension([[0,0],[0,0],[0,0]],flat),0)
assert.deepEqual(vertexExtensions({uv,positions:flat,triangles:[[0,1,2]]}),[0,0,0])
console.log('PASS: physical units, rest state, 20% extension, rigid rotation/translation invariance, degenerate triangle, vertex averaging')
