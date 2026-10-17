import assert from 'node:assert/strict'
import {washPixelColor, washTextureImage} from '../src/core/clothWashImage.js'
import {WASH_EFFECTS} from '../src/core/clothWashProcedurals.js'

const base = [45, 78, 125]
for (const type of Object.keys(WASH_EFFECTS)) {
  const spec = {type, strength: .9, seed: 17, scale: 2, rotation: 28}
  const color = washPixelColor(base, .37, .63, spec)
  assert.equal(color.length, 3)
  assert.ok(color.every(x => Number.isInteger(x) && x >= 0 && x <= 255))
  assert.deepEqual(color, washPixelColor(base, .37, .63, spec))
  assert.deepEqual(color, washPixelColor(base, 1.37, -.37, spec))
  assert.deepEqual(washPixelColor(base, .37, .63, {...spec, strength: 0}), base)
}
assert.deepEqual(washPixelColor(base, .2, .5, 'raw'), base)
assert.deepEqual(base, [45, 78, 125])
assert.ok(washPixelColor(base, .31, .27, {type: 'bleach'})[0] > base[0])
assert.ok(washPixelColor(base, .31, .27, {type: 'garment-dye'})[0] < base[0])
const imageBaseline = {type: 'bleach', strength: .7, seed: 17}
assert.deepEqual(washPixelColor(base, .23, .41, imageBaseline), washPixelColor(base, .23, .41, {...imageBaseline, absorbency: 0, cycleDuration: 0, seamAbrasion: 0, blend: 'overlay'}))
for (const appearance of [
  {absorbency: 1}, {cycleDuration: 1}, {seamAbrasion: 1}, {blend: 'screen'}, {blend: 'soft-light'}, {blend: 'multiply'},
]) {
  const spec = {...imageBaseline, ...appearance}
  const result = washPixelColor(base, 0, .41, spec)
  assert.ok(result.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255))
  assert.deepEqual(result, washPixelColor(base, 1, .41, spec))
}
assert.ok(washPixelColor(base, 0, .41, {...imageBaseline, seamAbrasion: 1})[0] > washPixelColor(base, 0, .41, imageBaseline)[0])
assert.equal(washTextureImage(null, {type: 'stone'}), null)

const savedDocument = globalThis.document
try {
  const context = {
    fillStyle: '',
    fillRect() {},
    drawImage() {},
    getImageData() { return {data: new Uint8ClampedArray([45, 78, 125, 128, 5, 6, 7, 0])} },
    putImageData(pixels) { this.saved = pixels.data.slice() },
  }
  globalThis.document = {createElement: () => ({width: 0, height: 0, getContext: () => context})}
  const canvas = washTextureImage({width: 2, height: 1}, {type: 'bleach'})
  assert.equal(canvas.width, 2)
  assert.equal(context.saved[3], 128, 'Preserve partial alpha')
  assert.equal(context.saved[7], 0, 'Preserve transparency')
  assert.deepEqual([...context.saved.slice(4, 7)], [5, 6, 7], 'Preserve transparent RGB')
  assert.ok(context.saved[0] > 45, 'Apply faded pigment')
  assert.ok(washTextureImage(null, {type: 'stone'}, {baseColorHex: '#aabbee', width: 2, height: 1}))
  assert.equal(washTextureImage({complete: false, width: 2, height: 1}), null)
  assert.equal(washTextureImage({width: 2, height: 1}, {}, {width: -1}), null)
  globalThis.document = {createElement: () => ({getContext: () => ({drawImage() {}, getImageData() {throw new Error('SecurityError')}})})}
  assert.equal(washTextureImage({width: 2, height: 1}), null, 'Tainted canvas must fail safely')
} finally {
  if (savedDocument === undefined) delete globalThis.document
  else globalThis.document = savedDocument
}
console.log('PASS cloth wash image: 16 styles, RGB, seamless, saturation-aware fades, alpha, canvas fallback, tainted input')
