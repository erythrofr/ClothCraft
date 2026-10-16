import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  pointFromPolar, precisePointEdit, quadraticArcLength, quadraticAtLengthFraction,
} from '../src/core/draftingPrecision.js'
import { preciseConstructionEdit, lineIntersection } from '../src/core/draftingConstructions.js'

const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const piece = { id: 'front', points: [
  { x: 0, y: 0, id: 'a' }, { x: 10, y: 0, id: 'b' },
  { x: 10, y: 10, id: 'c' }, { x: 0, y: 10, id: 'd' },
] }
const document = { pieces: [piece], seams: [] }
function native(op, args) {
  const result = spawnSync(cli, { input: JSON.stringify({
    protocol: 'garment-studio.native-cad.v1', document, op, args,
  }) + '\n', encoding: 'utf8' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr)
  const response = JSON.parse(result.stdout.trim())
  assert.equal(response.ok, true, response.error)
  return response.value
}
function same(a, b) {
  if (typeof a === 'number') return assert.ok(Math.abs(a - b) < 1e-8, `${a} vs ${b}`)
  if (a && typeof a === 'object') {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort())
    for (const key of Object.keys(a)) same(a[key], b[key])
  } else assert.equal(a, b)
}
const a = { x: 0, y: 0 }, control = { x: 4, y: 12 }, b = { x: 10, y: 0 }
same(native('draft-precision', { method: 'pointFromPolar', anchor: a, lengthCm: 12, angleDeg: 35 }),
  pointFromPolar(a, 12, 35))
same(native('draft-precision', { method: 'precisePointEdit', piece, index: 2,
  options: { x: 9, y: 9 } }), precisePointEdit(piece, 2, { x: 9, y: 9 }))
same(native('draft-precision', { method: 'quadraticArcLength', a, control, b }),
  quadraticArcLength(a, control, b))
same(native('draft-precision', { method: 'quadraticAtLengthFraction', a, control, b, fraction: 0.35 }),
  quadraticAtLengthFraction(a, control, b, 0.35))
same(native('draft-construction', { method: 'lineIntersection', a: { x: 0, y: 0 }, b: { x: 5, y: 5 },
  c: { x: 0, y: 5 }, d: { x: 5, y: 0 } }), lineIntersection({ x: 0, y: 0 },
  { x: 5, y: 5 }, { x: 0, y: 5 }, { x: 5, y: 0 }))
same(native('draft-construction', { method: 'preciseConstructionEdit', piece, pointIndex: 2,
  options: { construction: 'line', a: 1, b: 2, distanceCm: 12 } }),
preciseConstructionEdit(piece, 2, { construction: 'line', a: 1, b: 2, distanceCm: 12 }))
console.log('Native CLI drafting precision/construction integration: 6 JS parity cases passed')
