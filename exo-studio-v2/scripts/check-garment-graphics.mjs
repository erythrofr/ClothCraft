import assert from 'node:assert/strict'
import {importGarmentArtwork,createGarmentGraphic,normalizeGarmentGraphic,serializeGarmentGraphics,deserializeGarmentGraphics,graphicPlacementInUV} from '../src/core/nativeGarmentGraphics.js'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
let revoked = 0
globalThis.URL.createObjectURL = () => 'blob:test-graphic'
globalThis.URL.revokeObjectURL = () => {revoked++}
globalThis.Image = class {
  naturalWidth = 120
  naturalHeight = 60
  set src(value) {assert.equal(value, 'blob:test-graphic'); queueMicrotask(() => this.onload())}
}
globalThis.document = {createElement(name) {
  assert.equal(name, 'canvas')
  return {getContext: () => ({drawImage: () => {}}), toDataURL: () => png}
}}

for (const type of ['image/png', 'image/jpeg']) {
  const imported = await importGarmentArtwork({name:`art.${type.split('/')[1]}`,type,size:200})
  assert.equal(imported.dataUrl, png)
  assert.equal(imported.width, 120)
  assert.equal(imported.height, 60)
  const record = normalizeGarmentGraphic(createGarmentGraphic(imported, 'front-panel'))
  const document = serializeGarmentGraphics([record])
  assert.deepEqual(deserializeGarmentGraphics(JSON.parse(JSON.stringify(document)), {panels:[{id:'front-panel'}]}),[record])
  assert.deepEqual(graphicPlacementInUV(record),{u:.5,v:.5,widthUV:.42,rotationRadians:-0})
}
assert.equal(revoked,2)
await assert.rejects(importGarmentArtwork({name:'attack.gif',type:'image/gif',size:1}), /SVG, PNG or JPEG/)
await assert.rejects(importGarmentArtwork({name:'huge.png',type:'image/png',size:9_000_000}), /8 MB/)
assert.throws(() => normalizeGarmentGraphic({panel:'front-panel',dataUrl:'javascript:alert(1)'}), /embedded PNG/)
console.log('PASS: PNG + JPEG upload data URL, offline JSON roundtrip, placement, MIME and data URL validation')
