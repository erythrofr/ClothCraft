import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'
import { FABRIC_REALISM_SHOWCASE, createFabricRealismShowcase, getFabricRealismShowcase, fabricRealismPreviewProps } from '../src/core/fabricRealismShowcase.js'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = resolve(projectRoot, 'public')

function jpegDimensions(path) {
  const data = readFileSync(path)
  assert.equal(data.readUInt16BE(0), 0xffd8, `Invalid JPEG: ${path}`)
  let offset = 2
  while (offset < data.length - 10) {
    if (data[offset] !== 0xff) { offset++; continue }
    const marker = data[offset + 1]
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue }
    if (marker === 0xda) break
    const length = data.readUInt16BE(offset + 2)
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))
      return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) }
    assert.ok(length >= 2, `Invalid JPEG segment: ${path}`)
    offset += 2 + length
  }
  throw new Error(`No JPEG dimensions found: ${path}`)
}

assert.equal(FABRIC_REALISM_SHOWCASE.length, 5)
assert.deepEqual(FABRIC_REALISM_SHOWCASE.map(x => x.presetId), ['fleece','rawDenim','ribKnit','softLeather','nylonRipstop'])
assert.deepEqual(createFabricRealismShowcase(), FABRIC_REALISM_SHOWCASE)
const summaries = []
for (const item of FABRIC_REALISM_SHOWCASE) {
  const preset = FABRIC_PRESETS[item.presetId]
  assert.ok(preset)
  assert.equal(item.color, preset.color)
  assert.equal(getFabricRealismShowcase(item.id), item)
  assert.equal(getFabricRealismShowcase(item.presetId), item)
  assert.equal(fabricRealismPreviewProps(item.id).maps.color.uri, preset.texture.src)
  assert.equal(item.physics.status, 'estimated')
  assert.match(item.physics.source, /no sample laboratory measurements/i)
  assert.equal(item.physics.gsm, preset.gsm)
  assert.equal(item.texture.license, 'CC0')
  assert.match(item.texture.sourceUrl, /^https:\/\/(polyhaven\.com\/a\/|ambientcg\.com\/a\/)/)
  assert.equal(item.texture.scanAssetId, preset.texture.scanAssetId)
  assert.ok(['construction-reference','proxy'].includes(item.visualMatch))
  for (const dimension of [item.texture.repeatCm.width, item.texture.repeatCm.height]) assert.ok(Number.isFinite(dimension) && dimension > 0)
  const dims = {}
  for (const kind of ['color','normal','roughness']) {
    const map = item.material.maps[kind]
    assert.equal(map.origin, 'scan')
    assert.equal(map.license, 'CC0')
    assert.equal(map.colorSpace, kind === 'color' ? 'sRGB' : 'linear')
    assert.match(map.uri, /^\/(fabric-scans|fabric-scans-ambientcg)\/[a-zA-Z0-9_-]+\/(color|normal|roughness)\.jpg$/)
    const path = resolve(publicRoot, map.uri.slice(1))
    assert.ok(path.startsWith(publicRoot + sep))
    assert.ok(statSync(path).size > 1024, `Missing or empty map: ${map.uri}`)
    const size = jpegDimensions(path)
    assert.ok(size.width >= 512 && size.height >= 512, `Insufficient ${kind} resolution: ${map.uri}`)
    dims[kind] = size
  }
  assert.deepEqual(dims.normal, dims.color, `${item.presetId}: normal dimensions mismatch`)
  assert.deepEqual(dims.roughness, dims.color, `${item.presetId}: roughness dimensions mismatch`)
  summaries.push({ presetId:item.presetId, scan:item.texture.scanAssetId, match:item.visualMatch, dimensions:dims.color, repeatCm:item.texture.repeatCm, physics:item.physics.status })
}
assert.equal(getFabricRealismShowcase('unknown'), null)
assert.equal(fabricRealismPreviewProps('unknown'), null)
console.log(JSON.stringify({ checked:summaries.length, examples:summaries }, null, 2))
