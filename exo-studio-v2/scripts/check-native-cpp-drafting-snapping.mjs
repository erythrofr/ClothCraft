import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  snapDraftGrid, nearestOnDraftSegment, snapDraftPattern, constrainDraftAxis,
} from '../src/core/draftingSnapping.js'

const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const piece = {
  id: 'front', layout2d: { x: 100, y: 20 },
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  curves: { '1': { cx: 13, cy: 5 } },
}
const document = { pieces: [piece], seams: [] }
function native(op, args) {
  const process = spawnSync(cli, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    input: JSON.stringify({ protocol: 'garment-studio.native-cad.v1', document, op, args }) + '\n' })
  if (process.error) throw process.error
  assert.equal(process.status, 0, process.stderr)
  return JSON.parse(process.stdout.trim())
}
let comparisons = 0
function compare(actual, expected) {
  assert.equal(actual == null, expected == null)
  if (expected == null) { comparisons++; return }
  for (const [field, value] of Object.entries(expected)) {
    if (typeof value === 'number') {
      assert.ok(Math.abs(value - actual[field]) < 1e-8,
        `${field}: JS ${value}, C++ ${actual[field]}`)
    } else assert.equal(actual[field], value, field)
  }
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort())
  comparisons++
}
for (const { point, spacingCm, origin } of [
  { point: { x: 13.23, y: -6.62 }, spacingCm: 0.25 },
  { point: { x: -0.5, y: 0.5 }, spacingCm: 1 },
  { point: { x: 13.1, y: -5.8 }, spacingCm: 2, origin: { x: 0.5, y: 0.5 } },
  { point: { x: -19.7, y: 7.91 }, spacingCm: 0.1 },
]) {
  const options = { point, spacingCm, ...(origin ? { origin } : {}) }
  const result = native('draft-snap-grid', options)
  assert.equal(result.ok, true, result.error)
  compare(result.point, snapDraftGrid(point, spacingCm, origin))
}
for (const { point, a, b } of [
  { point: { x: 7, y: 4 }, a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
  { point: { x: 12, y: 4 }, a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
  { point: { x: -2, y: 15 }, a: { x: 4, y: 5 }, b: { x: 4, y: 5 } },
]) {
  const result = native('draft-nearest-segment', { point, a, b })
  assert.equal(result.ok, true, result.error)
  compare(result.point, nearestOnDraftSegment(point, a, b))
}
for (const { point, options } of [
  { point: { x: 92, y: 1 }, options: {} },
  { point: { x: 100.2, y: 19.85 }, options: { toleranceCm: 0.5 } },
  { point: { x: 105, y: 19.5 }, options: { toleranceCm: 1 } },
  { point: { x: 112.46, y: 15.2 }, options: { toleranceCm: 1 } },
  { point: { x: 105, y: 19.5 }, options: { excludedPieceId: 'front' } },
  { point: { x: 100.01, y: 19.99 }, options: { excludedPoint: { pieceId: 'front', pointIndex: 0 },
    allowEdges: false, toleranceCm: 0.5 } },
  { point: { x: 112.1, y: 15.75 }, options: { samplesPerCurve: 3, toleranceCm: 2 } },
]) {
  const result = native('draft-snap-pattern', { point, ...options })
  assert.equal(result.ok, true, result.error)
  compare(result.snap, snapDraftPattern(point, [piece], options))
}
for (const { start, destination, incrementDegrees } of [
  { start: { x: 0, y: 0 }, destination: { x: 10, y: 1 } },
  { start: { x: 0, y: 0 }, destination: { x: 5, y: 4 } },
  { start: { x: 2, y: 3 }, destination: { x: -3, y: -2 } },
  { start: { x: 0, y: 0 }, destination: { x: -3, y: 1 }, incrementDegrees: 90 },
]) {
  const result = native('draft-constrain-axis', { start, destination, ...(incrementDegrees ? { incrementDegrees } : {}) })
  assert.equal(result.ok, true, result.error)
  compare(result.point, constrainDraftAxis(start, destination, incrementDegrees))
}
assert.throws(() => snapDraftGrid({ x: 0, y: 0 }, 0), /grid/)
const bad = native('draft-snap-grid', { point: { x: 0, y: 0 }, spacingCm: 0 })
assert.equal(bad.ok, false)
assert.match(bad.error, /grid/)
console.log(`C++ vs JavaScript drafting snapping parity passed (${comparisons} behavior comparisons, 1 rejection)`)
