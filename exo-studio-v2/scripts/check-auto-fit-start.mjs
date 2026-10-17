import assert from 'node:assert/strict'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'
import { stagedPanelPositions } from '../src/core/staging.js'

const project = createTeeTemplate()
const originalShapes = JSON.stringify(project.pieces.map(({ id, points, curves }) => ({ id, points, curves })))
const originalSeams = JSON.stringify(project.seams)
const simulation = buildSimulation(project)
const fittedMeanGap = simulation.seamConstraints.reduce(
  (sum, seam) => sum + seam.a.position.distanceTo(seam.b.position), 0,
) / simulation.seamConstraints.length
const stageByParticle = new Map()
for (const piece of simulation.pieces.values()) {
  const positions = stagedPanelPositions(piece, project.avatar)
  piece.particles.forEach((particle, index) => stageByParticle.set(particle.id, positions[index]))
}
const rawStageMeanGap = simulation.seamConstraints.reduce(
  (sum, seam) => sum + stageByParticle.get(seam.a.id).distanceTo(stageByParticle.get(seam.b.id)), 0,
) / simulation.seamConstraints.length
assert.ok(rawStageMeanGap > fittedMeanGap * 2, 'Regression: the pre-fit canonical pose must avoid excessive exploded-stage seam travel')

// Placement follows the avatar, but physical flat-pattern distances cannot
// expand or shrink as the avatar height changes. Every pairwise vertex length
// in a rigid staged panel must match the original centimeter pattern.
for (const heightCm of [160, 180, 200]) {
  for (const piece of simulation.pieces.values()) {
    const staged = stagedPanelPositions(piece, { ...project.avatar, heightCm })
    for (let i = 0; i < piece.flatVertices.length; i += 7) {
      for (let j = i + 1; j < piece.flatVertices.length; j += 11) {
        const drafted = piece.flatVertices[i].distanceTo(piece.flatVertices[j]) * 0.01
        const stagedLength = staged[i].distanceTo(staged[j])
        assert.ok(Math.abs(drafted - stagedLength) < 1e-6,
          `Physical staging length changed for ${piece.id} at ${heightCm} cm avatar height`)
      }
    }
  }
}

// A user can position a panel incorrectly in the flat staging viewer. The
// auto-fit physical starting pose remains scaled to the avatar; the manual
// offset is visually preserved during the dressing animation only.
project.pieces[0].arrangement3d.stagingOffsetX = 0.27
project.pieces[0].arrangement3d.stagingOffsetY = -0.16
project.pieces[0].arrangement3d.stagingRotationZ = 22
const adjusted = buildSimulation(project)
for (const [id, piece] of simulation.pieces.entries()) {
  const other = adjusted.pieces.get(id)
  assert.equal(piece.particles.length, other.particles.length)
  for (let i = 0; i < piece.particles.length; i += 1) {
    assert.ok(piece.particles[i].position.distanceTo(other.particles[i].position) < 1e-8,
      `Auto-fit starting pose unexpectedly changed with staged offset for ${id}:${i}`)
  }
}
for (let frame = 0; frame < 120; frame += 1) stepSimulation(adjusted, project, 1 / 60)
const finalMeanGap = adjusted.seamConstraints.reduce((sum, seam) => sum + seam.a.position.distanceTo(seam.b.position), 0) / adjusted.seamConstraints.length
assert.ok(finalMeanGap < 0.025, `Auto-fit seam closure failed: ${finalMeanGap} m`)
assert.equal(JSON.stringify(project.pieces.map(({ id, points, curves }) => ({ id, points, curves }))), originalShapes, 'The fitter must not resize or rewrite pattern geometry')
assert.equal(JSON.stringify(project.seams), originalSeams, 'The fitter must not modify seam relationships')
console.log(JSON.stringify({
  ok: true,
  pieces: project.pieces.length,
  seams: project.seams.length,
  canonicalStartingSeamGapCm: Number((fittedMeanGap * 100).toFixed(2)),
  explodedStartingSeamGapCm: Number((rawStageMeanGap * 100).toFixed(2)),
  settledSeamGapCm: Number((finalMeanGap * 100).toFixed(2)),
  stagingErrorCorrectedWithoutPatternResize: true,
  stagedPatternLengthsConstantAcrossAvatarHeightsCm: [160, 180, 200],
}, null, 2))
