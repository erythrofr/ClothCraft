import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { estimateFabricPbrPixels } from '../src/core/fabricPbrGenerator.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bin = resolve(mkdtempSync(resolve(tmpdir(), 'garment-pbr-pixel-parity-')), 'runner')
const build = spawnSync('c++', [
  '-std=c++17', '-O2', '-I', 'native_cpp/core', '-I', 'native_cpp/vendor',
  'native_cpp/core/fabric_pbr_pixels.cpp', 'native_cpp/tests/test_fabric_pbr_pixels.cpp',
  '-o', bin,
], { cwd: root, encoding: 'utf8' })
assert.equal(build.status, 0, build.stderr)

const image = (width, height, mode) => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4
    for (let c = 0; c < 4; c++) {
      data[i + c] = mode === 0 ? 128 :
        mode === 1 ? (x % 2 ? 255 : 0) :
        mode === 2 ? ((x * 37 + y * 41 + c * 123) % 256) :
        (x * 71 + y * 9 + c * 27 + (x * y) % 11) % 256
    }
  }
  return { width, height, data: [...data] }
}

const cases = []
for (const [w, h] of [[2, 2], [3, 4], [8, 6], [17, 9], [50, 20]]) {
  for (const mode of [0, 1, 2, 3]) {
    for (const options of [{}, { normalStrength: 0 }, { normalStrength: 0.1 },
      { normalStrength: 2 }, { normalStrength: 4.4 }, { normalStrength: 10 },
      { normalStrength: '3.25' }]) cases.push({ imageData: image(w, h, mode), options })
  }
}
cases.push({ imageData: { width: 1, height: 10, data: [] }, options: {} })
cases.push({ imageData: { width: 4, height: 4, data: [10, 20] }, options: {} })
cases.push({ imageData: { width: 2.1, height: 2, data: [1, 2, 3, 4] }, options: {} })
const child = spawnSync(bin, ['--json-lines'], {
  input: cases.map(JSON.stringify).join('\n') + '\n', cwd: root,
  encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
})
assert.equal(child.status, 0, child.stderr)
const outputs = child.stdout.trim().split('\n')
assert.equal(outputs.length, cases.length)
for (let i = 0; i < cases.length; ++i) {
  const { imageData, options } = cases[i]
  let expected, failed = false
  try {
    const x = estimateFabricPbrPixels(imageData, options)
    expected = { width: x.width, height: x.height,
      normal: [...x.normal], roughness: [...x.roughness], kind: x.kind }
  } catch (error) {
    expected = error.message
    failed = true
  }
  const actual = JSON.parse(outputs[i])
  assert.equal(actual.ok, !failed, `case ${i}: ${actual.error || ''}`)
  if (failed) assert.equal(actual.error, expected)
  else assert.deepEqual(actual.result, expected, `PBR pixel mismatch at case ${i}`)
}
console.log(`Native PBR pixel generator passed ${cases.length} JS-parity fixtures (normal, roughness, varied image dimensions, strengths, rejection)`)
