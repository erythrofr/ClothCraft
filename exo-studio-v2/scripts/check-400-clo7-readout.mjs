import assert from 'node:assert/strict'
import {FABRIC_PRESETS} from '../src/data/defaultProject.js'
import {clo7FabricReadout,CLO7_FABRIC_REFERENCE_URLS} from '../src/core/clo7FabricReadout.js'

assert.equal(Object.keys(FABRIC_PRESETS).length,400)
const ids=new Set()
const statuses={};
const missing={};
let total=0
for(const [id,fabric] of Object.entries(FABRIC_PRESETS)){
 assert.ok(!ids.has(id));ids.add(id)
 const readout=clo7FabricReadout(fabric)
 assert.equal(readout.sections.length,3)
 assert.ok(readout.reference.includes('live UI access unverified'))
 assert.ok(readout.referenceUrls.physical.startsWith('https://support.clo3d.com/'))
 const fields=readout.sections.flatMap(section=>section.rows)
 assert.ok(fields.length>=25)
 assert.equal(new Set(fields.map(field=>field.id)).size,fields.length)
 total+=fields.length
 const lookup=Object.fromEntries(fields.map(item=>[item.id,item]))
 assert.equal(lookup.mass.value,fabric.gsm)
 assert.equal(lookup.thickness.value,Number((fabric.thickness*1000).toFixed(3)))
 assert.equal(lookup.warpStretch.value,Number((fabric.stretchWarp*100).toFixed(2)))
 assert.equal(lookup.weftStretch.value,Number((fabric.stretchWeft*100).toFixed(2)))
 assert.equal(lookup.bend.value,Number(fabric.bend.toFixed(3)))
 assert.ok(lookup.bendWarp.value===null && lookup.bendWeft.value===null)
 assert.equal(lookup.bucklingRatio.value,null)
 assert.equal(lookup.shear.status,'not-implemented')
 assert.ok(!lookup.warpStretch.note.includes('measured force-extension curve.')||lookup.warpStretch.note.includes('not a'))
 for(const field of fields){
  assert.ok(['solver-input','optical-only','source-only','not-implemented'].includes(field.status))
  if(field.status==='not-implemented'){
    missing[field.id]=(missing[field.id]||0)+1
    assert.equal(field.value,null,'Missing CLO concept must not fabricate EXO value')
  }
  if(typeof field.value==='number')assert.ok(Number.isFinite(field.value))
  statuses[field.status]=(statuses[field.status]||0)+1
 }
}
assert.equal(ids.size,400)
assert.equal(missing.bucklingStiffness,400)
assert.equal(missing.bendBias,400)
assert.equal(missing.frontBackSide,400)
assert.ok(total>=10000)
assert.equal(Object.keys(CLO7_FABRIC_REFERENCE_URLS).length,7)
console.log(JSON.stringify({pass:true,libraryPresets:400,
  evaluatedFields:total,fieldStatuses:statuses,nonFabricatedGaps:missing,
  physicalComparisonsNotMeasured:true},null,2))
