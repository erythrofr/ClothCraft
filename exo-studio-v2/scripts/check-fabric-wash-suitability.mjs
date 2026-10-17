import assert from 'node:assert/strict'
import {FABRIC_PRESETS} from '../src/data/defaultProject.js'
import {
 classifyDigitalWashSubstrate,digitalWashSuitability,suggestedSoftHandVisualWash,
} from '../src/core/fabricWashSuitability.js'
import {WASH_EFFECTS,normalizeWashSpec} from '../src/core/clothWashProcedurals.js'

const items=Object.values(FABRIC_PRESETS)
assert.equal(items.length,400)
const original=items.filter(item=>!item.materialFamilyId)
const softened=items.filter(item=>item.finishId==='softened')
assert.equal(original.length,80)
assert.equal(softened.length,80)
let cautionCount=0
const byFamily={}
for(const fabric of items){
 const substrate=classifyDigitalWashSubstrate(fabric)
 byFamily[substrate]=(byFamily[substrate]||0)+1
 assert.match(substrate,/^(sturdy-cellulosic|cellulosic|animal|delicate|skin|synthetic|pile|unverified)$/)
 for(const name of Object.keys(WASH_EFFECTS)){
  const result=digitalWashSuitability(fabric,{type:name,strength:.4})
  assert.equal(result.effect,name)
  assert.ok(['none','illustrative-reference','specialty-review'].includes(result.status))
  assert.equal(result.chemistryMeasured,false)
  assert.ok(result.recommendation.length>20)
  if(result.status==='specialty-review'){
   cautionCount++
   assert.ok(result.caution?.includes('visual preview only'))
  }
 }
 if(fabric.finishId==='softened'){
  const auto=suggestedSoftHandVisualWash(fabric)
  assert.equal(normalizeWashSpec(fabric.wash).type,auto.type)
  assert.equal(normalizeWashSpec(fabric.wash).strength,auto.strength)
  assert.notEqual(digitalWashSuitability(fabric,auto).status,'specialty-review',
    `Soft-hand preset ${fabric.id} cannot be assigned an inappropriate default chemical effect`)
 }
}
assert.equal(digitalWashSuitability(FABRIC_PRESETS.lambskin,{type:'pp'}).status,'specialty-review')
assert.equal(digitalWashSuitability(FABRIC_PRESETS.rawDenim,{type:'pp'}).status,'illustrative-reference')
assert.equal(digitalWashSuitability(FABRIC_PRESETS.silkCharmeuse,{type:'stone'}).status,'specialty-review')
assert.equal(suggestedSoftHandVisualWash(FABRIC_PRESETS.nappaLeather).type,'vintage')
assert.ok(cautionCount>0)
console.log(JSON.stringify({pass:true,fabrics:items.length,autoSoftHandLooks:softened.length,
 washEffects:Object.keys(WASH_EFFECTS).length,diagnosticCombinations:items.length*Object.keys(WASH_EFFECTS).length,
 specialistCautions:cautionCount,familyDistribution:byFamily},null,2))
