import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

const source=resolve('public/references/zozo-dress')
const binary=process.env.GARMENT_CPP_ZOZO_RUNNER||
  'native_cpp/build-cmake/native_zozo_reference_dress_tests'
const reference={
  manifest:JSON.parse(readFileSync(join(source,'manifest.json'),'utf8')),
  meshes:JSON.parse(readFileSync(join(source,'meshes.json'),'utf8'))
}
const cases=[
  {name:'tampered-accepted',change:m=>{m.manifest.accepted=true},
    expected:/unsafe-fit labels failed validation/},
  {name:'tampered-panel-index',change:m=>{m.meshes.clothPanels[0].indices[0]=-3},
    expected:/Invalid original ZOZO dress triangle index/},
  {name:'tampered-body-index',change:m=>{m.meshes.bodyIndices[0]=8},
    expected:/Invalid original pinned-body triangle index/},
]
for(const c of cases){
  const temporary=mkdtempSync(join(tmpdir(),'gs-zozo-corruption-'))
  try{
    const modified=structuredClone(reference)
    c.change(modified)
    writeFileSync(join(temporary,'manifest.json'),JSON.stringify(modified.manifest))
    writeFileSync(join(temporary,'meshes.json'),JSON.stringify(modified.meshes))
    symlinkSync(join(source,'frames.bin'),join(temporary,'frames.bin'))
    const result=spawnSync(binary,[temporary],{encoding:'utf8'})
    assert.notEqual(result.status,0,c.name+' improperly accepted')
    assert.match(result.stderr,c.expected)
  }finally{rmSync(temporary,{recursive:true,force:true})}
}
const missing=spawnSync(binary,['/nonexistent/zozo-reference'],{encoding:'utf8'})
assert.notEqual(missing.status,0)
assert.match(missing.stderr,/Original ZOZO dress reference unavailable/)
const outOfRange=spawnSync(binary,[source],{encoding:'utf8'})
assert.equal(outOfRange.status,0,outOfRange.stderr)
console.log('Native ZOZO loader tamper checks: rejected unsafe-fit manifest, invalid cloth/body indices, missing files; unchanged source passes')
