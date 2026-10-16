import { createZipHoodieTemplate } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

const snapshots = []
for (let run = 0; run < 4; run += 1) {
  const project = createZipHoodieTemplate()
  const simulation = buildSimulation(project)
  for (let frame = 0; frame < 120; frame += 1) stepSimulation(simulation, project, 1 / 60)
  const seamDistances = simulation.seamConstraints.map((constraint) => constraint.a.position.distanceTo(constraint.b.position))
  snapshots.push({
    vertices: [...simulation.pieces.values()].reduce((sum, piece) => sum + piece.particles.length, 0),
    constraints: simulation.constraints.length,
    seamConstraints: simulation.seamConstraints.length,
    averageStrain: Number(simulation.strain.average.toFixed(9)),
    maxStrain: Number(simulation.strain.max.toFixed(9)),
    averageSeam: Number((seamDistances.reduce((sum, value) => sum + value, 0) / seamDistances.length).toFixed(9)),
    maxSeam: Number(Math.max(...seamDistances).toFixed(9)),
    frontPointCount: project.pieces.find((piece) => piece.id === 'front-left')?.points.length,
    backPointCount: project.pieces.find((piece) => piece.id === 'back')?.points.length,
  })
}
const baseline = JSON.stringify(snapshots[0])
for (let index = 1; index < snapshots.length; index += 1) {
  if (JSON.stringify(snapshots[index]) !== baseline) {
    throw new Error(`Template/simulation state leaked between builds: run 1 ${baseline} vs run ${index + 1} ${JSON.stringify(snapshots[index])}`)
  }
}
console.log(JSON.stringify({ runs: snapshots.length, stable: snapshots[0] }, null, 2))
