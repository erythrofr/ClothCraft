import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  seamEndpointInterval, seamEndpointOverlap, validateNewSeam, auditSewingConstruction,
} from '../src/core/sewingConstruction.js'

const cli=process.env.GARMENT_CPP_CLI||'native_cpp/build-cmake/garment_cad_cli'
const makePiece=id=>({id,points:[{x:0,y:0},{x:40,y:0},{x:40,y:20},{x:0,y:20}]})
const document={pieces:[makePiece('a'),makePiece('b')],seams:[]}
function native(op,args={}) {
  const child=spawnSync(cli,{input:JSON.stringify({
    protocol:'garment-studio.native-cad.v1',document,op,args,
  })+'\n',encoding:'utf8'})
  if(child.error)throw child.error
  assert.equal(child.status,0,child.stderr)
  const response=JSON.parse(child.stdout.trim())
  assert.equal(response.ok,true,response.error)
  return response
}
const endpoints=[
  {pieceId:'a',edgeIndex:0},
  {pieceId:'a',edgeIndex:0,startT:.2,endT:.6},
  {pieceId:'a',edgeIndex:0,startT:.6,endT:.2},
  {pieceId:'a',edgeIndex:0,startT:-.1},
]
let count=0
for(const endpoint of endpoints){
  assert.deepEqual(native('sewing-endpoint-interval',{endpoint}).interval,seamEndpointInterval(endpoint))
  count++
}
for(const a of endpoints)for(const b of endpoints) {
  assert.equal(native('sewing-endpoint-overlap',{a,b}).overlap,seamEndpointOverlap(a,b))
  count++
}
for(const a of endpoints) {
  const proposed={a,b:{...a,pieceId:'b'}}
  assert.deepEqual(native('sewing-validate',{seam:proposed}).validation,validateNewSeam(document,proposed))
  count++
}
assert.deepEqual(native('sewing-audit').audit,auditSewingConstruction(document))
count++
console.log(`C++ CLI sewing validation/audit parity passed: ${count} cases`)
