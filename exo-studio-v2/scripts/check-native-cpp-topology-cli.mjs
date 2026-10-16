import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { inspectDraftTopology, isDraftEditValid } from '../src/core/draftingTopology.js'
import { unfoldDraftPiece } from '../src/core/draftingUnfold.js'

const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const doc = { pieces: [], seams: [] }
function native(op, args) {
  const r = spawnSync(cli, {
    input: JSON.stringify({ protocol: 'garment-studio.native-cad.v1', document: doc, op, args }) + '\n',
    encoding: 'utf8',
  })
  if (r.error) throw r.error
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout.trim())
}
function compare(a, b, path = 'root') {
  if (typeof a === 'number' && typeof b === 'number')
    return assert.ok(Math.abs(a-b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b)), path)
  if (Array.isArray(a) && Array.isArray(b)) {
    assert.equal(a.length, b.length, path)
    return a.forEach((v,i) => compare(v,b[i],path+'.'+i))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path)
    return Object.keys(a).forEach(k=>compare(a[k],b[k],path+'.'+k))
  }
  assert.equal(a,b,path)
}
const pieces = [
  { name: 'square', points: [{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}] },
  { name: 'bowtie', points: [{x:0,y:0},{x:8,y:8},{x:0,y:8},{x:8,y:0}] },
  { name: 'curved', points: [{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}],
    curves: { 0: { cx:4,cy:-2 } } },
]
let count=0
for(const piece of pieces) {
  for(const samples of [4,16,24]) {
    const options={curveSamples:samples}
    const cpp=native('draft-inspect-topology',{piece,options})
    assert.equal(cpp.ok,true,cpp.error)
    compare(inspectDraftTopology(piece,options),cpp.topology)
    count++
  }
  const edit={pointIndex:1,point:{x:7,y:1}}
  const cpp=native('draft-is-edit-valid',{piece,edit})
  assert.equal(cpp.ok,true,cpp.error)
  assert.equal(cpp.valid,isDraftEditValid(piece,edit))
  count++
}
const half={
  id:'half',name:'Vest (half)',
  points:[{id:'a',x:0,y:0,gradeRule:{enabled:true,dxPerSize:1,dyPerSize:2}},
    {id:'b',x:0,y:12},{id:'c',x:8,y:12},{id:'d',x:8,y:0}],
  edgeSeamAllowances:{1:1.2,2:2},notches:[{id:'n',edgeIndex:1,t:.3}],
  internalLines:[{id:'line',a:{x:2,y:2},b:{x:6,y:9}}],
}
for (const edge of [0,1,2,3]) {
  let js
  try { js={ok:true,unfold:unfoldDraftPiece(half,edge)} }
  catch(error) { js={ok:false,error:error.message} }
  const cpp=native('draft-unfold',{piece:half,foldEdgeIndex:edge})
  assert.equal(cpp.ok,js.ok)
  if(js.ok)compare(js.unfold,cpp.unfold)
  else assert.match(cpp.error,new RegExp(js.error.slice(0,10).replace(/[.*+?^$()|[\]{}]/g,'\\$&')))
  count++
}
console.log(`Native C++ CLI topology/edit/unfold parity: ${count} cases passed`)
