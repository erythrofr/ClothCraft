import assert from 'node:assert/strict'
import {WASH_EFFECTS, normalizeWashSpec, washRgbMultiplier, sampleWashColor} from '../src/core/clothWashProcedurals.js'

const types = Object.keys(WASH_EFFECTS)
assert.equal(types.length, 16, 'Expected 16 digital wash styles')
const positions = Array.from({length: 144}, (_, i) => [(i % 12 + .31) / 12, (Math.floor(i / 12) + .47) / 12])
const signature = new Map()
const tolerance = 1e-10

for (const type of types) {
  const s = normalizeWashSpec({type, strength: .85, scale: 1.7, seed: 42, rotation: 33, placement: {x: .28, y: .76}})
  const values = []
  for (const [u, v] of positions) {
    const m = washRgbMultiplier(u, v, s)
    const repeated = washRgbMultiplier(u, v, s)
    const shiftedU = washRgbMultiplier(u + 1, v, s)
    const shiftedV = washRgbMultiplier(u, v - 1, s)
    assert.deepEqual(m, repeated, `${type} must be deterministic`)
    for (let i = 0; i < 3; i++) {
      assert.ok(Number.isFinite(m[i]) && m[i] >= .25 && m[i] <= 1.5, `${type}: RGB multiplier bounds`)
      assert.ok(Math.abs(m[i] - shiftedU[i]) < tolerance, `${type}: wrap U`)
      assert.ok(Math.abs(m[i] - shiftedV[i]) < tolerance, `${type}: wrap V`)
    }
    assert.ok(sampleWashColor([.43, .57, .82], u, v, s).every(c => c >= 0 && c <= 1))
    values.push(...m)
  }
  signature.set(type, values)
  assert.deepEqual(washRgbMultiplier(.3, .6, {...s, strength: 0}), [1, 1, 1], `${type} zero strength`)
}

for (const a of types) for (const b of types) {
  if (a >= b) continue
  const av = signature.get(a), bv = signature.get(b)
  const meanDifference = av.reduce((sum, value, i) => sum + Math.abs(value - bv[i]), 0) / av.length
  assert.ok(meanDifference > .001, `Styles ${a} and ${b} are visually indistinguishable`)
}

assert.deepEqual(washRgbMultiplier(.45, .51, 'raw'), [1, 1, 1])
assert.equal(normalizeWashSpec({type: 'stone-wash'}).type, 'stone')
assert.equal(normalizeWashSpec({type: 'unsupported'}).type, 'raw')
assert.deepEqual(normalizeWashSpec({type: 'bleach', strength: Infinity, scale: -5, seed: NaN}).strength, 1)
assert.ok(washRgbMultiplier(NaN, Infinity, {type: 'acid'}).every(Number.isFinite), 'Must handle invalid UVs')
const baseline = {type: 'stone', strength: .75, seed: 4, scale: 1.5}
assert.deepEqual(washRgbMultiplier(.2, .3, baseline), washRgbMultiplier(.2, .3, {...baseline, absorbency: 0, cycleDuration: 0, seamAbrasion: 0, blend: 'overlay'}), 'Neutral controls preserve legacy output')
assert.deepEqual(Object.fromEntries(['absorbency', 'cycleDuration', 'seamAbrasion', 'blend'].map(k => [k, normalizeWashSpec({})[k]])), {absorbency: 0, cycleDuration: 0, seamAbrasion: 0, blend: 'overlay'})
const normalized = normalizeWashSpec({absorbency: 3, cycleDuration: -.1, seamAbrasion: NaN, blend: 'unsupported'})
assert.deepEqual([normalized.absorbency, normalized.cycleDuration, normalized.seamAbrasion, normalized.blend], [1, 0, 0, 'overlay'])
const distance = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0)
for (const field of ['absorbency', 'cycleDuration']) {
  const modified = {...baseline, [field]: 1}
  assert.ok(distance(washRgbMultiplier(.24, .36, baseline), washRgbMultiplier(.24, .36, modified)) > 1e-4, field + ' changes pigment response')
}
const edgeSpec = {...baseline, seamAbrasion: 1}
assert.ok(washRgbMultiplier(0, .5, edgeSpec)[0] > washRgbMultiplier(0, .5, baseline)[0] + .1, 'Seam abrasion visibly lightens tile edges')
assert.deepEqual(washRgbMultiplier(.5, .5, edgeSpec), washRgbMultiplier(.5, .5, baseline), 'Seam abrasion does not affect tile center')
for (const blend of ['overlay', 'soft-light', 'screen', 'multiply']) {
  const spec = {...baseline, blend, absorbency: .7, cycleDuration: .9, seamAbrasion: .8}
  for (const [u, v] of positions) {
    const sample = washRgbMultiplier(u, v, spec)
    assert.ok(sample.every(c => Number.isFinite(c) && c >= .25 && c <= 1.5))
    assert.ok(distance(sample, washRgbMultiplier(u + 1, v - 1, spec)) < tolerance, blend + ' seamless')
    assert.deepEqual(sample, washRgbMultiplier(u, v, spec), blend + ' deterministic')
  }
}
const blendOutputs = ['overlay', 'soft-light', 'screen', 'multiply'].map(blend => washRgbMultiplier(.27, .33, {...baseline, blend}))
assert.equal(new Set(blendOutputs.map(x => x.join(','))).size, 4, 'Blend choices alter sampled result')

const base = [.4, .5, .6]
const original = [...base]
sampleWashColor(base, .25, .75, {type: 'stone'})
assert.deepEqual(base, original, 'Original pigment must remain unchanged')

console.log(`PASS: ${types.length} deterministic, seamless, bounded, distinct digital wash styles; editable parameters and non-destructive RGB`)
