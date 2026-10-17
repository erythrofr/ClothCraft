import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { draftingSplitFractions, splitParameterAtArcFraction, SPLIT_MODES } from '../src/core/draftingSplit.js'

const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const rectangle = {
  id: 'front', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 0, y: 12 }],
  curves: {},
}
const curved = { ...rectangle, curves: { 0: { cx: 18, cy: 20 } } }
const document = { pieces: [rectangle], seams: [] }
function native(op, args = {}) {
  const run = spawnSync(cli, {
    input: JSON.stringify({ protocol: 'garment-studio.native-cad.v1', document, op, args }) + '\n',
    encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })
  if (run.error) throw run.error
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout.trim())
}
let passing = 0
for (const piece of [rectangle, curved]) {
  for (const options of [
    { method: 'uniform', count: 2 }, { method: 'uniform', count: 4 },
    { method: 'uniform', count: '6' }, { method: 'uniform', count: 12 },
    { method: 'length', lengthCm: 5 }, { method: 'ratio', ratioPercent: 30 },
    { method: 'ratio', ratioPercent: '50' },
  ]) {
    const js = draftingSplitFractions(piece, 0, options)
    const cpp = native('draft-split-fractions', { piece, edgeIndex: 0, options })
    assert.equal(cpp.ok, true, cpp.error)
    assert.equal(cpp.fractions.length, js.length)
    for (let i = 0; i < js.length; i++) assert.ok(Math.abs(js[i] - cpp.fractions[i]) < 1e-10)
    passing++
  }
  for (const fraction of [.05, .15, .25, .5, .75, .95]) {
    const js = splitParameterAtArcFraction(piece, 0, fraction)
    const cpp = native('draft-split-parameter', { piece, edgeIndex: 0, fraction })
    assert.equal(cpp.ok, true, cpp.error)
    assert.ok(Math.abs(js - cpp.parameter) < 1e-8, `JS ${js} native ${cpp.parameter}`)
    passing++
  }
}
for (const options of [
  { method: 'uniform', count: 13 }, { method: 'length', lengthCm: '' },
  { method: 'length', lengthCm: 200 }, { method: 'ratio', ratioPercent: 0 },
  { method: 'nonsense' }, { method: 'uniform', count: 1 },
]) {
  assert.throws(() => draftingSplitFractions(rectangle, 0, options))
  const cpp = native('draft-split-fractions', { piece: rectangle, edgeIndex: 0, options })
  assert.equal(cpp.ok, false, `Expected native rejection: ${JSON.stringify(options)}`)
  passing++
}
const modes = native('draft-split-modes')
assert.equal(modes.ok, true, modes.error)
assert.deepEqual(modes.modes, SPLIT_MODES)
console.log(`Native precise drafting split JS parity passed: ${passing} geometry and rejection cases, mode metadata`)
