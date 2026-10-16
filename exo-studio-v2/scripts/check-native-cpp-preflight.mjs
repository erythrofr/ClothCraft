import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { inspectProduction } from '../src/core/productionPreflight.js'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'

const root = resolve(import.meta.dirname, '..')
const temporary = mkdtempSync(join(tmpdir(), 'garment-preflight-'))
const binary = join(temporary, 'preflight')
try {
  const compile = spawnSync('c++', ['-std=c++17', '-O2', '-I'+join(root,'native_cpp/vendor'), '-I'+join(root,'native_cpp/core'),
    join(root,'native_cpp/core/production_preflight.cpp'),
    join(root,'native_cpp/core/garment_document.cpp'),
    join(root,'native_cpp/core/grading.cpp'),
    join(root,'native_cpp/core/marker_layout.cpp'),
    join(root,'native_cpp/core/cutting_geometry.cpp'),
    join(root,'native_cpp/tests/test_production_preflight.cpp'), '-o', binary], { encoding:'utf8' })
  assert.equal(compile.status, 0, compile.stderr)
  const unit = spawnSync(binary, [], { encoding:'utf8' })
  assert.equal(unit.status,0,unit.stderr)
  const piece = () => ({id:'front',points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]})
  const base = () => ({pieces:[piece()],fabrics:{main:{name:'Cotton'}},grading:{sizes:['M']}})
  const narrow = createZipHoodieTemplate()
  narrow.markerSettings = {...narrow.markerSettings, fabricWidthCm: 150, fabricWidthsCm: {rib: 1}}
  assert.ok(inspectProduction(narrow).issues.some(issue=>issue.code==='MARKER_OVERFLOW' && issue.scope.endsWith(' · rib')), 'narrow rib fixture must actually overflow')
  const cases = [
    base(),
    {...base(), pieces:[]},
    {...base(), fabrics:{}},
    {...base(),pieces:[{...piece(),cutQuantity:0,seamAllowance:-1}]},
    {...base(),pieces:[{...piece(),points:[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0}]}]},
    {...base(),pieces:[{...piece(),notches:[{edgeIndex:99}]}]},
    {...base(),seams:[{id:'bad',a:{pieceId:'front',edgeIndex:0},b:{pieceId:'missing',edgeIndex:1}}]},
    {...base(),grading:{sizes:['S','S']}},
    {...base(),pieces:[piece(),{...piece(),id:'back',points:[{x:0,y:0},{x:12,y:0},{x:12,y:10},{x:0,y:10}]}],
      seams:[{id:'long',a:{pieceId:'front',edgeIndex:0},b:{pieceId:'back',edgeIndex:0}}]},
    createDefaultProject(),createZipHoodieTemplate(),narrow,
    {...createDefaultProject(), previewSize:'L'}
  ]
  for (const [index,project] of cases.entries()) {
    const allSizes=index!==cases.length-1
    const native = spawnSync(binary,['--json'],{input:JSON.stringify({project,allSizes}),encoding:'utf8'})
    assert.equal(native.status,0,`case ${index}: ${native.stderr}`)
    const result=JSON.parse(native.stdout), js=inspectProduction(project,{allSizes})
    const strictMarkerParity = ![3,6,7].includes(index)
    if (strictMarkerParity) assert.deepEqual(result.issues, js.issues, `case ${index} issues`)
    else assert.deepEqual(result.issues.filter(issue=>issue.code!=='MARKER_GENERATION'),js.issues,`case ${index} static issues`)
    if (strictMarkerParity) assert.equal(result.status,js.status,`case ${index} status`)
    assert.deepEqual(result.sizes,js.sizes,`case ${index} sizes`)
    if (!strictMarkerParity) continue
    assert.equal(result.markerSummary.length,js.markerSummary.length,`case ${index} marker count`)
    for (const [markerIndex,marker] of result.markerSummary.entries()) {
      const expected=js.markerSummary[markerIndex]
      for (const key of ['size','fabricId','requested','placed','unplaced'])
        assert.deepEqual(marker[key],expected[key],`case ${index} marker ${markerIndex} ${key}`)
      for (const key of ['lengthCm','efficiency'])
        assert.ok(Math.abs(marker[key]-expected[key])<1e-5,`case ${index} marker ${markerIndex} ${key}: ${marker[key]} vs ${expected[key]}`)
    }
    assert.equal(result.factoryCertified,false)
  }
  console.log(`Native production preflight: ${cases.length} JS marker and structural parity cases + C++ unit checks passed`)
} finally {
  rmSync(temporary,{recursive:true,force:true})
}
