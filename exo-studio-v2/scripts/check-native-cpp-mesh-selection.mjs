import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mergeMeshFaceSelection } from '../src/core/meshSelection.js'

const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const document = { pieces: [], seams: [] }
function native(args) {
  const process = spawnSync(cli, { input: JSON.stringify({
    protocol: 'garment-studio.native-cad.v1', document,
    op: 'merge-mesh-face-selection', args,
  }) + '\n', encoding: 'utf8' })
  if (process.error) throw process.error
  assert.equal(process.status, 0, process.stderr)
  const value = JSON.parse(process.stdout.trim())
  assert.equal(value.ok, true, value.error)
  return value.selection
}
const first = { a: 0, b: 1, c: 2 }
const second = { a: 1, b: 3, c: 4 }
let js = null
let cpp = null
let checked = 0
for (const { id, index, face, additive } of [
  { id: 'front', index: 3, face: first, additive: false },
  { id: 'front', index: 7, face: second, additive: true },
  { id: 'front', index: 3, face: first, additive: true },
  { id: 'front', index: 7, face: second, additive: true },
  { id: 'front', index: 1, face: first, additive: false },
  { id: 'back', index: 4, face: second, additive: true },
  { id: 'back', index: -1, face: second, additive: false },
  { id: 'front', index: 5, face: first, additive: true },
]) {
  js = mergeMeshFaceSelection(js, id, index, face, additive)
  cpp = native({ previous: cpp, pieceId: id, faceIndex: index, face, additive })
  assert.deepEqual(cpp, js)
  checked++
}
console.log(`C++ mesh selection parity passed: ${checked} state transitions with add/remove, switch and rejection`)
