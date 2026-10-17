import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync } from 'node:fs'
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'
import { diagnoseFabricCatalog, diagnoseFabricConstruction, constructionFamily } from '../src/core/fabricConstructionDiagnostics.js'

const result=diagnoseFabricCatalog(FABRIC_PRESETS)
assert.equal(result.total,400,'Must inspect exactly 400 material presets')
assert.equal(result.uniqueIds,400,'Material identifiers must be unique')
assert.equal(result.summary.bySeverity.error,0,'Catalog contains invalid numeric fields')
assert.equal(result.summary.physicalCalibrationConfirmed,0,'Do not promote estimated presets to calibrated')
for(const family of ['mesh/open','leather/suede','silk/sheer','terry','fleece/pile','denim/twill','coated/composite','cotton/woven','knit/stretch'])
  assert.ok(result.summary.byFamily[family]>0,`Missing construction group: ${family}`)
assert.equal(constructionFamily({id:'powerMesh',name:'Power Mesh'}),'mesh/open')
assert.equal(constructionFamily({id:'frenchTerryHeavy',name:'French Terry'}),'terry')
assert.equal(constructionFamily({id:'nappaLeather',name:'Nappa Leather'}),'leather/suede')
const test = diagnoseFabricConstruction({id:'testMesh',name:'Open Mesh',gsm:100,thickness:.001,stretchWarp:.1,stretchWeft:.2,bend:.3,roughness:.8,sheen:.1,opacity:1,calibration:{status:'estimated'}})
assert.equal(test.meshCutout.renderPath,'none')
assert.ok(test.warnings.some(w=>w.code==='OPEN_STRUCTURE_CUTOUT_MISSING'))
for(const [id,topology] of [['polyMesh','athletic-mesh'],['powerMesh','power-mesh'],['polyTulle','tulle-net']]) {
 const preset=FABRIC_PRESETS[id]
 assert.ok(preset,`Missing ${id}`)
 const mesh=diagnoseFabricConstruction(preset,id)
 assert.equal(mesh.meshCutout?.topology,topology)
 assert.equal(mesh.meshCutout?.renderPath,'generated-alphaMap')
 assert.ok(mesh.warnings.some(w=>w.code==='OPEN_STRUCTURE_PROCEDURAL_CUTOUT'))
 assert.ok(!mesh.warnings.some(w=>w.code==='OPEN_STRUCTURE_OPACITY'||w.code==='OPEN_STRUCTURE_CUTOUT_MISSING'))
}
const overridden=diagnoseFabricConstruction({...FABRIC_PRESETS.powerMesh,texture:{...FABRIC_PRESETS.powerMesh.texture,opacitySrc:'/custom-alpha.png'}},'powerMesh')
assert.equal(overridden.meshCutout.renderPath,'uploaded-opacity-override')
assert.ok(overridden.warnings.some(w=>w.code==='OPEN_STRUCTURE_UPLOADED_OPACITY'))
assert.equal(result.summary.byCode.OPEN_STRUCTURE_OPACITY||0,0)
const broken = diagnoseFabricConstruction({...FABRIC_PRESETS.denim,gsm:-2,stretchWarp:-.3},'broken')
assert.ok(broken.warnings.some(w=>w.severity==='error'))
assert.ok(result.fabrics.every(f=>f.warnings.every(w=>w.code&&w.field&&w.action)))
const path='docs/reports/EXO_400_CONSTRUCTION_DIAGNOSTICS.json'
mkdirSync('docs/reports',{recursive:true})
writeFileSync(path,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({pass:true,total:result.total,summary:result.summary,report:path},null,2))
