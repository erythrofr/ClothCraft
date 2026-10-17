import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

function run(heightCm, mode) {
  const project = createTeeTemplate()
  project.avatar.heightCm = heightCm
  if (mode === 'lateral') project.avatar.shoulderContactMode = 'lateral'
  const simulation = buildSimulation(project)
  const torso = ['front', 'back'].flatMap(id => simulation.pieces.get(id).particles)
  const initialHem = Math.min(...torso.map(p => p.position.y))
  for (let i = 0; i < 180; i += 1) stepSimulation(simulation, project, 1 / 60)
  return {
    heightCm,
    mode,
    hemRiseCm: +((Math.min(...torso.map(p => p.position.y)) - initialHem) * 100).toFixed(2),
    seamGapCm: +(simulation.seamConstraints.reduce((sum, seam) => sum + seam.a.position.distanceTo(seam.b.position), 0) / simulation.seamConstraints.length * 100).toFixed(2),
    averageStrain: +simulation.strain.average.toFixed(3),
    peakStrain: +simulation.strain.max.toFixed(3),
  }
}

const results = []
for (const heightCm of [160, 180, 200]) {
  for (const mode of ['original', 'lateral']) results.push(run(heightCm, mode))
}
console.log(JSON.stringify({
  results,
  note: 'Lateral contact is an opt-in diagnostic, not certified cloth/body contact. Evaluate drift, textile strain, and triangle intersections together.',
}, null, 2))
