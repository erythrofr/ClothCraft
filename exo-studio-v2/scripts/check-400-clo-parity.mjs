import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {FABRIC_PRESETS} from '../src/data/defaultProject.js'
import {auditCatalogCloParity,CLO_FABRIC_FIELD_MATRIX} from '../src/core/fabricCloParityAudit.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const output=path.join(root,'docs/reports/EXO_400_CLO_PROPERTY_PARITY.json')
const result=auditCatalogCloParity(FABRIC_PRESETS)
assert.equal(result.total,400,'Catalog must contain 400 presets')
assert.equal(new Set(result.records.map(record=>record.id)).size,400,'Stable IDs unique')
assert.equal(result.fieldCount,CLO_FABRIC_FIELD_MATRIX.length)
assert.deepEqual(new Set(result.records.map(record=>record.id)),new Set(Object.keys(FABRIC_PRESETS)),'No IDs lost')
assert.equal(Object.values(result.counts).reduce((a,b)=>a+b,0),400*result.fieldCount)
for(const record of result.records){
  assert.equal(Object.keys(record.fields).length,result.fieldCount)
  assert.equal(record.counts.supported+record.counts.approximation+record.counts.missing,result.fieldCount)
  for(const [fieldId,field] of Object.entries(record.fields)){
    assert.ok(['supported','approximation','missing'].includes(field.status),fieldId)
    if(fieldId==='customPhysics'||fieldId==='collision')assert.equal(field.status,'missing')
  }
  if(record.finishId!=='reference') {
    assert.equal(record.fields.measurementProvenance.provenanceStatus,'estimated')
    assert.notEqual(record.fields.measurementProvenance.status,'supported')
  }
}
// A regression fixture proves missing keys are diagnosed instead of silently treated as parity.
const empty=auditCatalogCloParity({unmeasured:{id:'unmeasured',name:'Unmeasured'}}).records[0]
assert.equal(empty.fields.arealMass.status,'missing')
assert.equal(empty.fields.textureMaps.status,'missing')
assert.equal(empty.fields.measurementProvenance.status,'missing')
if(process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(output),{recursive:true})
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n')
} else {
  assert.deepEqual(JSON.parse(fs.readFileSync(output,'utf8')),result,'Report is stale; run --write')
}
console.log('PASS: 400 fabric IDs × '+result.fieldCount+' fields; statuses '+JSON.stringify(result.counts))
