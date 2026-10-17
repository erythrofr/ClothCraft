import assert from 'node:assert/strict'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation, measureAvatarSurfaceIntrusion, stepSimulation } from '../src/core/physics.js'

const frames = Math.max(1, Math.min(240, Number(process.env.FRAMES ?? 90)))
const results = []
for (const heightCm of [160, 180, 200]) {
  for (const assist of [false, true]) {
    const project = createTeeTemplate()
    project.avatar.heightCm = heightCm
    project.simulation.bodyTriangleContactAssist = assist
    const simulation = buildSimulation(project)
    const initial = measureAvatarSurfaceIntrusion(simulation, project.avatar)
    for (let i = 0; i < frames; i++) stepSimulation(simulation, project, 1 / 60)
    const final = measureAvatarSurfaceIntrusion(simulation, project.avatar)
    assert.ok(Number.isFinite(final.maximumIntrusionMm))
    assert.ok(final.samplesChecked > 0)
    const result = {
      heightCm, triangleContactAssist: assist, frames,
      initialIntrudingSamples: initial.penetratingSamples,
      finalIntrudingSamples: final.penetratingSamples,
      finalIntrudingFaces: final.penetratingFaces,
      finalMaxIntrusionMm: final.maximumIntrusionMm,
      finalAverageStrain: +simulation.strain.average.toFixed(4),
      finalPeakStrain: +simulation.strain.max.toFixed(4),
      collisionFree: final.penetratingSamples === 0,
    }
    results.push(result)
  }
}
console.log(JSON.stringify({ diagnostics: results, caveat: 'Surface sample diagnostic against analytic proxy only; not exact body triangle CCD' }, null, 2))
