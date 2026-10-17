import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'
import { simplifiedClothBoundary, measureClothBoundaryDeviation } from '../src/core/clothMeshing.js'

const source = JSON.parse(fs.readFileSync(
  'research/clo-reference/live-audit-20261014/exports/clo-male-tshirt-sewn-EXPERIMENTAL.garment.json', 'utf8'))
assert.equal(source.cloReference.DO_NOT_DEPLOY_SIMULATION, true)
const originalGeometry = source.pieces.map(({ id, points, curves }) => ({ id, points, curves }))
function run(adaptive) {
  const project = structuredClone(source)
  for (const piece of project.pieces) piece.active3d = true
  project.simulation = {
    ...project.simulation, adaptiveCutlineMeshing: adaptive, cutlineToleranceCm: 0.08,
    gravity: 0, collisions: false, selfCollision: false,
    autoFitTacks: false, autoFitPlacement: false, stabilizeSeamPairs: false,
    iterations: 5, substeps: 1,
  }
  const sim = buildSimulation(project)
  const summary = {
    sourcePoints: originalGeometry.reduce((count, piece) => count + piece.points.length, 0),
    simulationParticles: [...sim.pieces.values()].reduce((count, piece) => count + piece.particles.length, 0),
    virtualStitches: sim.seamConstraints.filter((constraint) => constraint.type === 'seam-virtual').length,
  }
  for (let frame = 0; frame < 12; frame++) stepSimulation(sim, project, 1 / 60)
  summary.finalStrainPercent = sim.quality.structural.maxStrainPercent
  summary.finalSeamMeanMm = sim.quality.sewing.meanGapMm
  summary.finalSeamP95Mm = sim.quality.sewing.p95GapMm
  summary.finite = [...sim.pieces.values()].every((piece) => piece.particles.every((particle) =>
    [particle.position.x, particle.position.y, particle.position.z].every(Number.isFinite)))
  assert.deepEqual(project.pieces.map(({id,points,curves}) => ({id,points,curves})), originalGeometry,
    'Simulation mesh must never rewrite the authored CLO source cutlines')
  return summary
}

let largestDeviationMm = 0
for (const piece of source.pieces) {
  const boundary = simplifiedClothBoundary(piece.points, 0.08)
  largestDeviationMm = Math.max(largestDeviationMm, 10 * measureClothBoundaryDeviation(piece.points, boundary))
}
assert.ok(largestDeviationMm < 0.81, `Simulation cutline deviates ${largestDeviationMm} mm from original DXF`)
const direct = run(false)
const adaptive = run(true)
assert.ok(direct.finite && adaptive.finite)
assert.equal(direct.virtualStitches, adaptive.virtualStitches)
assert.equal(adaptive.virtualStitches, 988)
assert.ok(adaptive.simulationParticles < direct.simulationParticles * 0.35,
  'Adaptive contour must materially reduce ill-conditioned tiny physics edges')
assert.ok(adaptive.finalStrainPercent < direct.finalStrainPercent * 0.55,
  'Adaptive simulation mesh must reduce extreme deformation compared to using the dense DXF contour directly')
// A geometry improvement does not certify fit. Keep rejecting overstretched
// garments even when their relative improvement is significant.
assert.ok(adaptive.finalStrainPercent > 100, 'This experimental CLO assembly still requires a proper coupled contact/strain solve')
console.log(JSON.stringify({ pass: true, largestDeviationMm, direct, adaptive,
  originalCutlinesUnmodified: true, contactCertified: false, completeCloFit: false }, null, 2))
