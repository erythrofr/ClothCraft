import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { constrainAutoFitPlacement, applyAutoFitPlacement } from '../src/core/autoFitPlacement.js'

const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const doc = { pieces: [], seams: [] }
const call = (op, args) => {
  const run = spawnSync(cli, { encoding: 'utf8', input: JSON.stringify({
    protocol: 'garment-studio.native-cad.v1', document: doc, op, args,
  }) + '\n' })
  if (run.error) throw run.error
  assert.equal(run.status, 0, run.stderr)
  const value = JSON.parse(run.stdout.trim())
  assert.equal(value.ok, true, value.error)
  return value
}
function compare(a, b, path = '') {
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), path)
  for (const key of Object.keys(a)) {
    const value = a[key]
    if (typeof value === 'number') {
      assert.ok(Math.abs(value - b[key]) < 1e-12, `${path}.${key}: ${value} !== ${b[key]}`)
    } else if (value && typeof value === 'object') compare(value, b[key], `${path}.${key}`)
    else assert.equal(value, b[key], `${path}.${key}`)
  }
}

const cases = [
  [{}, {}],
  [{ userPlacementDeltaX: 0.1, userPlacementDeltaY: -0.05, userPlacementDeltaZ: 0.03 }, {}],
  [{ userPlacementDeltaX: 3, userPlacementDeltaY: -3, userPlacementDeltaZ: 0.003 },
    { maxX: 0.002, maxY: 0.009, maxZ: 0.001, maxMagnitude: 0.008 }],
  [{ userPlacementDeltaX: '0.05', userPlacementDeltaY: '', userPlacementDeltaZ: null },
    { maxX: '0.01', maxY: null, maxZ: 0.03, maxMagnitude: '0.008' }],
  [{ userPlacementDeltaX: -0.012, userPlacementDeltaY: 0.03, userPlacementDeltaZ: 0.01 },
    { maxX: -1, maxY: -2, maxZ: -3, maxMagnitude: 0 }],
]
for (const [arrangement, options] of cases) {
  const original = structuredClone(arrangement)
  const js = constrainAutoFitPlacement(arrangement, options)
  const native = call('auto-fit-placement', { arrangement, options })
  compare(js, native.placement)
  assert.deepEqual(arrangement, original)
}
function simulationPiece() {
  return { particles: [
    { position: { x: -0.4, y: 0.9, z: 0.15 }, previous: {
      x: 1, y: 1, z: 1,
      copy(value) { this.x = value.x; this.y = value.y; this.z = value.z },
    } },
    { position: { x: -0.2, y: 1.35, z: -0.5 }, previous: {
      x: 2, y: 2, z: 2,
      copy(value) { this.x = value.x; this.y = value.y; this.z = value.z },
    } },
  ] }
}
const arrange = { userPlacementDeltaX: -0.2, userPlacementDeltaY: 0.05, userPlacementDeltaZ: 0.013 }
const jsPiece = simulationPiece()
const jsResult = applyAutoFitPlacement(jsPiece, arrange)
const native = call('apply-auto-fit-placement', { simPiece: {
  particles: simulationPiece().particles.map(({ position, previous }) => ({
    position, previous: { x: previous.x, y: previous.y, z: previous.z },
  })),
}, arrangement: arrange })
compare(jsResult, native.placement)
for (let i = 0; i < jsPiece.particles.length; i++) {
  compare(jsPiece.particles[i].position, native.simPiece.particles[i].position)
  compare({ x: jsPiece.particles[i].previous.x, y: jsPiece.particles[i].previous.y,
    z: jsPiece.particles[i].previous.z }, native.simPiece.particles[i].previous)
}
console.log(`Native auto-fit placement JS parity: ${cases.length} correction cases + rigid particle translation passed`)
