import assert from 'node:assert/strict'
import {constructDraftHardware,applyDraftHardwareAction,DRAFT_HARDWARE_COMMANDS} from '../../src/core/clo7NativeHardwareActions.js'
import {trimSummary,topstitchPaths,zipperPaths} from '../../src/core/trims.js'
import {readFileSync} from 'node:fs'

const original={pieces:[{id:'front',name:'Front',points:[{x:0,y:0},{x:30,y:0},{x:30,y:50},{x:0,y:50}],seamAllowance:1}],seams:[]}
let project=structuredClone(original)
for(const kind of DRAFT_HARDWARE_COMMANDS){
  const result=constructDraftHardware(project,{kind,pieceId:'front',edgeIndex:1})
  assert.equal(result.engine,'exo-draft')
  assert.equal(result.kind,kind)
  assert.equal(result.project.pieces[0][result.collection].length,1)
  assert.equal(project.pieces[0][result.collection],undefined,'immutable command must preserve undo snapshot')
  project=result.project
}
assert.equal(topstitchPaths(project.pieces[0],project.pieces[0].topstitches[0]).length,1)
assert.equal(zipperPaths(project.pieces[0],project.pieces[0].zippers[0]).length,2)
assert.deepEqual(trimSummary(project),{topstitchRows:1,zippers:1,buttons:1,buttonholes:1})
const factorySource=readFileSync(new URL('../../src/core/factoryPackage.js',import.meta.url),'utf8')
for(const key of ['buttons','buttonholes','zippers','bindings','topstitches'])
  assert.match(factorySource,new RegExp(`${key}: \\(project\\.pieces`),`${key} must be wired to factory export`)
assert.deepEqual(JSON.parse(JSON.stringify(project)).pieces[0].bindings,project.pieces[0].bindings)
for(const command of [
  {kind:'zipper',pieceId:'front',edgeIndex:99},
  {kind:'topstitch',pieceId:'front',edgeIndex:1,rows:4},
  {kind:'button',pieceId:'front',x:Infinity},
  {kind:'binding',pieceId:'missing',edgeIndex:1},
  {kind:'made-up',pieceId:'front'}
]){
  const before=JSON.stringify(project)
  assert.throws(()=>applyDraftHardwareAction(project,command))
  assert.equal(JSON.stringify(project),before,'rejected command must not mutate draft')
}
assert.deepEqual(original.pieces[0].points,project.pieces[0].points,'hardware annotations must not alter pattern boundary')
console.log('PASS: 5 persisted draft construction kinds; geometry sampling, BOM, immutable undo snapshots, validation and serialization')
