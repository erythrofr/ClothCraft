import assert from 'node:assert/strict'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation } from '../src/core/physics.js'
import { applyAutoFitPlacement, constrainAutoFitPlacement } from '../src/core/autoFitPlacement.js'

const small = constrainAutoFitPlacement({ userPlacementDeltaX: 0.008, userPlacementDeltaY: -0.004 })
assert.ok(Math.abs(small.applied.x - 0.008) < 1e-12)
assert.ok(Math.abs(small.applied.y + 0.004) < 1e-12)
assert.equal(small.correctedMagnitudeM, 0)
const large = constrainAutoFitPlacement({ userPlacementDeltaX: 0.5, userPlacementDeltaY: -0.18, userPlacementDeltaZ: 0.3 })
assert.ok(large.appliedMagnitudeM <= 0.02700001)
assert.ok(large.correctedMagnitudeM > 0.5, 'Large manual placement error must be corrected, not copied into solver')
const invalid = constrainAutoFitPlacement({ userPlacementDeltaX: 'invalid', userPlacementDeltaY: Number.NaN })
assert.equal(invalid.appliedMagnitudeM, 0)

const project = createTeeTemplate()
const shapesBefore = JSON.stringify(project.pieces.map(({ points, curves }) => ({ points, curves })))
const seamsBefore = JSON.stringify(project.seams)
const simulation = buildSimulation(project)
const piece = simulation.pieces.get('front')
const initial = piece.particles.map(particle => particle.position.clone())
const result = applyAutoFitPlacement(piece, { userPlacementDeltaX: 0.4, userPlacementDeltaY: -0.2, userPlacementDeltaZ: 0.3 })
assert.ok(result.appliedMagnitudeM <= 0.02700001)
for (let i = 0; i < piece.particles.length; i += 1) {
  for (let j = i + 1; j < piece.particles.length; j += 19) {
    const originalDistance = initial[i].distanceTo(initial[j])
    assert.ok(Math.abs(piece.particles[i].position.distanceTo(piece.particles[j].position) - originalDistance) < 1e-8,
      'Auto-fit hint must preserve pattern shape and every physical edge length')
  }
  assert.ok(piece.particles[i].position.distanceTo(piece.particles[i].previous) < 1e-10,
    'Rigid placement corrections cannot add phantom Verlet velocity')
}
assert.equal(JSON.stringify(project.pieces.map(({ points, curves }) => ({ points, curves }))), shapesBefore)
assert.equal(JSON.stringify(project.seams), seamsBefore)
console.log(JSON.stringify({
  ok: true,
  smallManualHintM: small.appliedMagnitudeM,
  largeRequestedM: large.requestedMagnitudeM,
  largeRetainedM: large.appliedMagnitudeM,
  largeCorrectedM: large.correctedMagnitudeM,
  garmentVerticesChecked: piece.particles.length,
  patternMeasurementsPreserved: true,
  seamGraphPreserved: true,
}, null, 2))
