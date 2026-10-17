import assert from 'node:assert/strict'
import {FABRIC_PRESETS} from '../src/data/defaultProject.js'
import review from '../src/data/scanOpticalReview.generated.json' with {type:'json'}

const fabrics=Object.values(FABRIC_PRESETS)
assert.equal(fabrics.length,400)
assert.equal(Object.keys(review.sources).length,67)
let mapped=0,flagged=0,unknownScale=0,procedural=0
const flagsByChannel={}
for(const fabric of fabrics){
 const source=fabric.texture?.scanAssetId
 const photo=fabric.photoReference
 if(!source){
  procedural++
  assert.equal(photo.status,'procedural-no-suitable-photo')
  continue
 }
 mapped++
 const record=review.sources[`${fabric.texture.scanSource}:${source}`]
 assert.ok(record,`${fabric.id}: lost CC0 source QA metadata`)
 assert.equal(photo.provider,record.provider)
 assert.equal(photo.assetId,source)
 assert.equal(fabric.texture.physicalScaleStatus,photo.physicalScaleStatus)
 const expected=Object.entries(record.channels).flatMap(([kind,item])=>
  item.flags.map(flag=>`${kind}:${flag}`))
 assert.deepEqual(photo.visualReviewFlags,expected)
 if(expected.length)flagged++
 for(const type of expected)flagsByChannel[type]=(flagsByChannel[type]||0)+1
 if(photo.physicalScaleStatus==='unknown-illustrative-20cm')unknownScale++
}
assert.equal(mapped,385)
assert.equal(procedural,15)
assert.ok(flagged>0)
assert.ok(unknownScale>0)
assert.ok(!('calibrated' in review)||review.calibrated===false)
console.log(JSON.stringify({
  pass:true,reviewedFabricPresets:fabrics.length,
  licensedAppearancePresets:mapped,proceduralFallbacks:procedural,
  referenceReviewFlags:flagged,unknownPhysicalScalePresets:unknownScale,
  flagsByChannel,
  noPhysicalMeasurementInferred:true,
},null,2))
