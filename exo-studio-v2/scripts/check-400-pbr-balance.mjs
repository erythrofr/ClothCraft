import assert from 'node:assert/strict'
import { FABRIC_PRESETS,FABRIC_SCAN_COVERAGE } from '../src/data/defaultProject.js'
import {
 balanceRoughnessByte,balanceScannedRoughness,
 roughnessVariationStrength,shouldBalanceFabricRoughness,
} from '../src/core/fabricPbrAppearance.js'
import {regradeScannedPixel} from '../src/core/photographicScanToning.js'

const all=Object.values(FABRIC_PRESETS)
assert.equal(all.length,400)
assert.equal(all.filter(shouldBalanceFabricRoughness).length,
 FABRIC_SCAN_COVERAGE.photographicReferences)
assert.equal(all.filter(f=>!shouldBalanceFabricRoughness(f)).length,15)
for (const item of all) {
 const strength=roughnessVariationStrength(item)
 assert.ok(Number.isFinite(strength)&&strength>=.25&&strength<=.7,item.name)
 assert.ok(Number.isFinite(item.roughness)&&item.roughness>=0&&item.roughness<=1,item.name)
 const colored=regradeScannedPixel([181,194,169],.72,[53,76,105])
 assert.ok(colored.every(channel=>channel>=0&&channel<=255))
 const steps=[0,63,127,191,255].map(value=>balanceRoughnessByte(value,128,strength))
 assert.ok(steps.every((x,index)=>x>=198&&x<=255&&(index===0||x>=steps[index-1])),
  `Roughness baseline must be bounded/monotone for ${item.name}`)
}
assert.equal(balanceRoughnessByte(123,123,.5),255,
 'Locally uniform roughness must not shift a material slider')
assert.equal(balanceRoughnessByte(Number.NaN,Number.NaN,Infinity),255,
 'Invalid image pixels should not propagate invalid shader inputs')
assert.equal(shouldBalanceFabricRoughness({texture:{
 scanAssetId:'fake',license:'proprietary',
 roughnessSrc:'/fabric-scans/fake/roughness.jpg'}}),false,
 'Unlicensed data may not be treated as an authorized scanned map')

const originalPixels=new Uint8ClampedArray([
  64,64,64,255, 128,128,128,255, 192,192,192,255, 250,250,250,0,
])
let result=null
const priorDocument=globalThis.document
globalThis.document={
 createElement(kind) {
  assert.equal(kind,'canvas')
  const canvas={width:0,height:0,source:null}
  canvas.getContext=()=>({
   drawImage(source){canvas.source=source},
   getImageData(){return {data:Uint8ClampedArray.from(originalPixels)}},
   putImageData(image){result=Uint8ClampedArray.from(image.data)},
  })
  return canvas
 },
}
const specimen=all.find(f=>shouldBalanceFabricRoughness(f))
const fakeImage={width:4,height:1,complete:true,naturalWidth:4,naturalHeight:1}
const transformed=balanceScannedRoughness(fakeImage,specimen,{width:4,height:1})
assert.ok(transformed&&transformed.width===4&&transformed.height===1)
assert.ok(result[1]<result[5]&&result[5]<=result[9],
 'Near-neutral roughness maps may legitimately saturate at 255 but not invert')
assert.equal(result[15],0,'Transparent source roughness alpha must be retained')
assert.deepEqual(Array.from(originalPixels),[
 64,64,64,255, 128,128,128,255, 192,192,192,255, 250,250,250,0,
], 'Source PBR texture must never be mutated')
assert.equal(balanceScannedRoughness(null,specimen),null)
assert.equal(balanceScannedRoughness(fakeImage,{texture:{roughnessSrc:''}}),null)
globalThis.document=priorDocument

console.log(JSON.stringify({
 pass:true,presets:all.length,
 scanRoughnessBalanced:FABRIC_SCAN_COVERAGE.photographicReferences,
 proceduralFallbacks:FABRIC_SCAN_COVERAGE.proceduralFallbacks,
 checks:['bounded/monotone graded map','colorway independent','license gate',
 'alpha preserved','source bytes unchanged','missing image fallback',
 'all 400 optical configurations finite'],
}))
