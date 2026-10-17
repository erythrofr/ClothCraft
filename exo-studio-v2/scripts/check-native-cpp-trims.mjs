import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { offsetEdgePath, topstitchPaths, zipperPaths, pieceCenter, trimSummary } from '../src/core/trims.js'

const runner = process.env.GARMENT_TRIMS_TEST || '/tmp/garment-native-trims-test'
const straight = { id: 'front', points: [
  { x: 0, y: 0, notch: 'a' }, { x: 14, y: 0, notch: 'b' },
  { x: 14, y: 22 }, { x: 0, y: 22 },
] }
const curved = { ...straight, curves: { '0': { cx: 8, cy: -7 }, '1': { cx: 18, cy: 11 } } }
const examples = [
  ...[straight, curved].flatMap(piece => [
    ...[0, 1, 3, 4].flatMap(edgeIndex => [0, 0.75, -1.25].map(offsetCm =>
      ({ op: 'offsetEdgePath', piece, options: { edgeIndex, offsetCm, segments: 32 } }))),
    ...[1, 2, 3, 4, 0, 2.5].map(rows =>
      ({ op: 'topstitchPaths', piece, options: { edgeIndex: 1, rows, offsetCm: 0, rowGapCm: .3 } })),
    ...[0, 1.8, 3].map(widthCm =>
      ({ op: 'zipperPaths', piece, options: { edgeIndex: 0, widthCm, offsetCm: -.4 } })),
    { op: 'pieceCenter', piece },
  ]),
  { op: 'pieceCenter', piece: { points: [] } },
  { op: 'trimSummary', project: { pieces: [straight, {
    topstitches: [{ rows: 2 }, { rows: 0 }, { rows: 2.5 }],
    zippers: [{ id: 'zip', edgeIndex: 1 }, {}],
    buttons: [{ x: 1 }, { x: 2 }],
    buttonholes: [{ x: 3 }],
  }] } },
]
const js = c => {
  const o = c.options || {}
  switch (c.op) {
    case 'offsetEdgePath': return offsetEdgePath(c.piece, o.edgeIndex, o.offsetCm, o.segments)
    case 'topstitchPaths': return topstitchPaths(c.piece, o)
    case 'zipperPaths': return zipperPaths(c.piece, o)
    case 'pieceCenter': return pieceCenter(c.piece)
    case 'trimSummary': return trimSummary(c.project)
    default: throw new Error(c.op)
  }
}
function equal(actual, expected, label) {
  if (typeof expected === 'number') {
    assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-8,
      `${label}: expected ${expected}, got ${actual}`)
  } else if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), label)
    assert.equal(actual.length, expected.length, label)
    expected.forEach((v, i) => equal(actual[i], v, `${label}[${i}]`))
  } else if (expected && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), label)
    for (const k of Object.keys(expected)) equal(actual[k], expected[k], `${label}.${k}`)
  } else assert.deepEqual(actual, expected, label)
}
const result = spawnSync(runner, ['--json-lines'], {
  input: examples.map(v => JSON.stringify(v)).join('\n') + '\n',
  encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
})
if (result.error) throw result.error
assert.equal(result.status, 0, result.stderr)
const lines = result.stdout.trim().split('\n')
assert.equal(lines.length, examples.length)
examples.forEach((example, i) => equal(JSON.parse(lines[i]), js(example), `${example.op} case ${i}`))
console.log(`native trims parity passed: ${examples.length} JS/C++ cases across all 5 exports`)
