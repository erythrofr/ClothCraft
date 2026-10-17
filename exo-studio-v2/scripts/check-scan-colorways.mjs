import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { regradeScannedPixel, tintLicensedFabricScan } from '../src/core/photographicScanToning.js'
import { validateFabricAsset, createFabricAssetRegistry } from '../src/core/fabricAssetRegistry.js'
import manifest from '../src/data/polyhavenVerifiedRegistry.generated.json' with { type: 'json' }

const pixel = [150, 141, 132]
const mean = .54
const cases = [
  ['brown denim', [116, 73, 44]],
  ['dark denim', [28, 35, 48]],
  ['light denim', [173, 189, 205]],
]
for (const [name, color] of cases) {
  const result = regradeScannedPixel(pixel, mean, color)
  assert.equal(result.length, 3, name)
  assert.ok(result.every(n => Number.isInteger(n) && n >= 0 && n <= 255), name)
  assert.ok(result.every((n, i) => Math.abs(n - color[i]) < 45), `${name}: source dye dominates requested shade`)
  const dark = regradeScannedPixel([60, 56, 52], mean, color)
  const light = regradeScannedPixel([225, 215, 205], mean, color)
  assert.ok(dark.reduce((a,b)=>a+b) < light.reduce((a,b)=>a+b), `${name}: yarn contrast preserved`)
  assert.deepEqual(regradeScannedPixel(pixel, mean, color), result, `${name}: deterministic pixels`)
}
assert.deepEqual(regradeScannedPixel([255, 255, 255], .001, [250, 250, 250]), [255,255,255], 'bright clamping')
assert.ok(regradeScannedPixel([0,0,0], 1, [0,0,0]).every(v=>v>=0&&v<=255))

// Exercise the real image toning path, including unchanged alpha, failed loading,
// canvas security errors, and missing source. No browser or native canvas needed.
const previousDocument = globalThis.document
const sourceImage = { complete: true, naturalWidth: 2, naturalHeight: 1 }
let drawn = null
let pixelData = null
try {
  globalThis.document = { createElement: () => {
    const canvas = { width: 0, height: 0 }
    const ctx = {
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray([150,141,132,255,40,60,80,0]) }),
      putImageData: pixels => { pixelData = pixels.data },
    }
    canvas.getContext = () => ctx
    drawn = canvas
    return canvas
  } }
  for(const [name, color] of cases){
    const hex='#'+color.map(v=>v.toString(16).padStart(2,'0')).join('')
    const result=tintLicensedFabricScan(sourceImage,{color:hex,wash:{type:'raw'}},{width:2,height:1})
    assert.equal(result,drawn,name)
    assert.equal(pixelData[3],255,name)
    assert.deepEqual([...pixelData.slice(4,8)],[40,60,80,0],`${name}: fully transparent pixel remains untouched`)
    assert.ok(color.every((v,i)=>Math.abs(pixelData[i]-v)<45),`${name}: generated pixel color`)
  }
  assert.equal(tintLicensedFabricScan(null),null,'missing source returns null')
  assert.equal(tintLicensedFabricScan({ ...sourceImage, complete:false }),null,'dirty incomplete source returns null')
  assert.equal(tintLicensedFabricScan({ ...sourceImage, naturalWidth:0 }),null,'zero width source returns null')
  globalThis.document = { createElement: () => ({getContext:()=>({drawImage(){throw new Error('tainted image')}})}) }
  assert.equal(tintLicensedFabricScan(sourceImage),null,'origin-dirty canvas returns null')
} finally {
  if(previousDocument===undefined) delete globalThis.document
  else globalThis.document=previousDocument
}

const example=manifest.assets[0]
assert.throws(()=>validateFabricAsset({...example,colorSpace:'linear'}),/color map must use sRGB/)
assert.throws(()=>validateFabricAsset({...example,uri:'/outside/color.jpg'}),/URI must be/)
assert.throws(()=>validateFabricAsset({...example,sha256:'dirty'}),/valid SHA-256/)
assert.throws(()=>readFileSync(resolve('public/fabric-scans/__missing_source__/color.jpg')),/ENOENT/)
const actualFile=readFileSync(resolve('public',example.uri.slice(1)))
assert.equal(createHash('sha256').update(actualFile).digest('hex'),example.sha256,'source bytes verified')
const wrongFile=Buffer.from(actualFile)
wrongFile[0]^=0xff
assert.notEqual(createHash('sha256').update(wrongFile).digest('hex'),example.sha256,'dirty source bytes detected')
assert.throws(()=>createFabricAssetRegistry({sample:{id:'sample'}},{assets:[example],assignments:{sample:{color:'nonexistent'}}}),/Unavailable or mismatched asset/)

console.log(JSON.stringify({ok:true,colorwayCases:cases.map(x=>x[0]),scanSourceNegativeTests:7,alphaPreserved:true,contrastPreserved:true},null,2))
