import assert from 'node:assert/strict'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

function run(heightCm, contactMode) {
  const project = createTeeTemplate()
  project.avatar.heightCm = heightCm
  project.avatar.shoulderContactMode = contactMode
  const simulation = buildSimulation(project)
  const torso = ['front', 'back'].flatMap(id => simulation.pieces.get(id).particles)
  const initialHem = Math.min(...torso.map(p => p.position.y))
  let maxSeamGapM = 0
  let maxContactDepthM = 0
  for (let frame = 0; frame < 180; frame++) {
    stepSimulation(simulation, project, 1 / 60)
    for (const piece of simulation.pieces.values()) {
      for (const p of piece.particles) {
        assert.ok(Number.isFinite(p.position.x) && Number.isFinite(p.position.y) && Number.isFinite(p.position.z), 'Non-finite cloth vertex')
        maxContactDepthM = Math.max(maxContactDepthM, p.contactDepth || 0)
      }
    }
    for (const seam of simulation.seamConstraints) maxSeamGapM = Math.max(maxSeamGapM, seam.a.position.distanceTo(seam.b.position))
  }
  const finalSeamGapM = simulation.seamConstraints.reduce((total, seam) => total + seam.a.position.distanceTo(seam.b.position), 0) / Math.max(1, simulation.seamConstraints.length)
  return {
    heightCm, contactMode,
    hemRiseCm: +((Math.min(...torso.map(p => p.position.y)) - initialHem) * 100).toFixed(2),
    meanFinalSeamGapCm: +(finalSeamGapM * 100).toFixed(2),
    maxSeamGapCm: +(maxSeamGapM * 100).toFixed(2),
    peakContactCorrectionCm: +(maxContactDepthM * 100).toFixed(2),
    peakStrainPercent: +(simulation.strain.max * 100).toFixed(1),
    status: 'diagnostic-only: triangle-level body/self contact not certified',
  }
}

const results = [160, 180, 200].flatMap(height => ['original', 'adaptive-limited-lateral'].map(mode => run(height, mode)))
for (const height of [160, 180, 200]) {
  const [baseline, adaptive] = results.filter(result => result.heightCm === height)
  if (height === 180) assert.ok(adaptive.hemRiseCm < baseline.hemRiseCm, 'Adaptive contact must reduce reference-size hem rise')
  if (height !== 180) assert.deepEqual(
    [adaptive.hemRiseCm, adaptive.meanFinalSeamGapCm, adaptive.peakStrainPercent],
    [baseline.hemRiseCm, baseline.meanFinalSeamGapCm, baseline.peakStrainPercent],
    'Non-reference avatar must retain original collision behavior',
  )
}
console.log(JSON.stringify({passed:true, results},null,2))
