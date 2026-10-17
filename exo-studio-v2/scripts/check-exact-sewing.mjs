import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createTemplateProject } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'
import { buildNativeSimulationPayload } from '../src/core/backends/nativePayload.js'
import { edgePointAt } from '../src/core/project.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = path.join(root, 'research/clo-reference/live-audit-20261014/exports/clo-male-tshirt-sewn-EXPERIMENTAL.garment.json')
assert.ok(fs.existsSync(fixture), 'Expected locally exported seven-piece CLO source')
const clo = JSON.parse(fs.readFileSync(fixture, 'utf8'))
assert.equal(clo.cloReference.DO_NOT_DEPLOY_SIMULATION, true)
assert.equal(clo.pieces.length, 7)
assert.equal(clo.seams.length, 947)
// Run source-pattern representation with all pieces for coverage inspection.
// The three original neckline pieces are 2D-only: change a TEST COPY, not
// the user's staged experimental project or imported authoritative DXF.
for (const piece of clo.pieces) piece.active3d = true
const simulation = buildSimulation(clo)
assert.equal(simulation.pieces.size, 7)
const sourceById = new Map(clo.seams.map((seam) => [seam.id, seam]))
const assembled = simulation.seamConstraints.filter((seam) => seam.type === 'seam-virtual')
assert.ok(assembled.length >= 947)
assert.equal(new Set(assembled.map((seam) => seam.seamId)).size, 947, 'All original partial cutline intervals must have an actual sewing constraint')
assert.equal(new Set(assembled.map((seam) => seam.sourceCloSeamGroup)).size, 23)
let maxReferenceErrorCm = 0
for (const stitch of assembled) {
  const seam = sourceById.get(stitch.seamId)
  assert.ok(seam)
  for (const [endpoint, particles, weights, direction] of [
    [seam.a, stitch.sourceParticles, stitch.sourceWeights, stitch.progress],
    [seam.b, stitch.targetParticles, stitch.targetWeights, seam.reverseB ? 1 - stitch.progress : stitch.progress],
  ]) {
    const piece = simulation.pieces.get(endpoint.pieceId)
    const t = Number(endpoint.startT ?? 0) + (Number(endpoint.endT ?? 1) - Number(endpoint.startT ?? 0)) * direction
    const expected = edgePointAt(piece.piece, endpoint.edgeIndex, t)?.point
    assert.ok(expected, `Missing authored CLO cutline anchor on ${endpoint.pieceId}:${endpoint.edgeIndex}`)
    const sum = weights.reduce((value, weight) => value + weight, 0)
    assert.ok(Math.abs(sum - 1) < 1e-8, 'Virtual seam weights must sum to one')
    const actual = { x: 0, y: 0 }
    for (let i = 0; i < particles.length; i++) {
      const index = piece.particles.indexOf(particles[i])
      assert.ok(index >= 0, 'Stitch references an active mesh vertex on the intended source pattern')
      actual.x += weights[i] * piece.flatVertices[index].x
      actual.y += weights[i] * piece.flatVertices[index].y
    }
    maxReferenceErrorCm = Math.max(maxReferenceErrorCm, Math.hypot(actual.x - expected.x, actual.y - expected.y))
  }
}
assert.ok(maxReferenceErrorCm < 0.002, `Exact CLO cutline correspondence shifted ${maxReferenceErrorCm} cm`)

// A separately constructed minimal partial seam verifies that both the JS
// and native XPBD solvers MOVE weighted points, rather than merely serializing
// metadata or snapping to an unrelated edge vertex.
const example = createTemplateProject('blank')
const left = example.pieces[0]
left.id = 'test-left'
left.name = 'Left half'
left.points = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }]
left.curves = {}
left.active3d = true
left.simulationResolution = 1
left.arrangement3d = { x: -0.35, y: 1.3, z: 0.2 }
const right = structuredClone(left)
right.id = 'test-right'
right.name = 'Right half'
right.arrangement3d = { x: 0.35, y: 1.3, z: 0.2 }
example.pieces = [left, right]
example.seams = [{
  id: 'one-partial-exact-seam',
  name: 'Fractional cutline seam',
  useExactCorrespondence: true,
  a: { pieceId: left.id, edgeIndex: 1, startT: 0.333, endT: 0.347 },
  b: { pieceId: right.id, edgeIndex: 3, startT: 0.601, endT: 0.615 },
  reverseB: true,
}]
example.simulation = {
  ...example.simulation, autoFitTacks: false, autoFitPlacement: false,
  gravity: 0, collisions: false, selfCollision: false, seamStiffness: 0.65,
}
const interactive = buildSimulation(example)
const constraint = interactive.seamConstraints[0]
assert.equal(interactive.seamConstraints.length, 1)
assert.equal(constraint.type, 'seam-virtual')
const virtualPoint = (particles, weights) => particles.reduce((point, p, i) => {
  point.x += p.position.x * weights[i]
  point.y += p.position.y * weights[i]
  point.z += p.position.z * weights[i]
  return point
}, { x: 0, y: 0, z: 0 })
const gap = (stitch) => {
  const a = virtualPoint(stitch.sourceParticles, stitch.sourceWeights)
  const b = virtualPoint(stitch.targetParticles, stitch.targetWeights)
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}
const initialGapM = gap(constraint)
for (let step = 0; step < 30; step++) stepSimulation(interactive, example, 1 / 60)
const interactiveGapM = gap(constraint)
assert.ok(Number.isFinite(interactiveGapM) && interactiveGapM < initialGapM * 0.65, `Interactive virtual seam failed to close ${initialGapM} -> ${interactiveGapM}`)

const payload = buildNativeSimulationPayload(example)
assert.equal(payload.virtualSeams.length, 1)
assert.equal(payload.virtualSeams[0].sourceIndices.length, constraint.sourceParticles.length)
const exe = path.join(root, 'native_backend/bin/garment_xpbd_cli')
assert.ok(fs.existsSync(exe), 'Compile the native garment solver before running sewing acceptance')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-exact-sewing-'))
let nativeGapM = null
try {
  const input = path.join(temp, 'input.json')
  const output = path.join(temp, 'output.json')
  fs.writeFileSync(input, JSON.stringify(payload))
  const run = spawnSync(exe, [input, output, '30'], { cwd: root, encoding: 'utf8', timeout: 60000 })
  assert.equal(run.status, 0, `Native sewing solve failed: ${run.stderr}`)
  const result = JSON.parse(fs.readFileSync(output, 'utf8'))
  assert.equal(result.stats.virtualSeams, 1)
  assert.equal(result.stats.finite, true)
  const seam = payload.virtualSeams[0]
  const position = (indices, weights) => indices.reduce((point, index, i) => {
    const v = result.state.particles[index].position
    for (let j = 0; j < 3; j++) point[j] += v[j] * weights[i]
    return point
  }, [0, 0, 0])
  const a = position(seam.sourceIndices, seam.sourceWeights)
  const b = position(seam.targetIndices, seam.targetWeights)
  nativeGapM = Math.hypot(...a.map((value, i) => value - b[i]))
  assert.ok(Number.isFinite(nativeGapM) && nativeGapM < initialGapM * 0.65, `Native virtual seam failed to close ${initialGapM} -> ${nativeGapM}`)
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}

console.log(JSON.stringify({
  pass: true,
  comparison: 'actual CLO-exported 7-piece DXF + seam OBJ/XML metadata',
  activeSourcePatterns: simulation.pieces.size,
  sourceSeamGroups: 23,
  sourcePartialSeams: clo.seams.length,
  representedPartialSeams: new Set(assembled.map((seam) => seam.seamId)).size,
  virtualStitchSamples: assembled.length,
  maximumCutlineRegistrationErrorMm: maxReferenceErrorCm * 10,
  syntheticPartialSeam: { initialGapM, interactiveGapM, nativeGapM },
  fittedGarmentCertified: false,
}, null, 2))
