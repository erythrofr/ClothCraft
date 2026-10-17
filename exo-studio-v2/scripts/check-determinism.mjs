import { createZipHoodieTemplate } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

function snapshot() {
  const project = createZipHoodieTemplate()
  const simulation = buildSimulation(project)
  for (let frame = 0; frame < 120; frame += 1) stepSimulation(simulation, project, 1 / 60)
  const seamDistances = simulation.seamConstraints.map((constraint) => constraint.a.position.distanceTo(constraint.b.position))
  return {
    frontPoints: project.pieces.find((piece) => piece.id === 'front-left')?.points.length,
    backPoints: project.pieces.find((piece) => piece.id === 'back')?.points.length,
    vertices: [...simulation.pieces.values()].reduce((sum, piece) => sum + piece.particles.length, 0),
    constraints: simulation.constraints.length,
    seams: simulation.seamConstraints.length,
    strainAverage: Number(simulation.strain.average.toFixed(9)),
    strainMax: Number(simulation.strain.max.toFixed(9)),
    seamAverage: Number((seamDistances.reduce((sum, value) => sum + value, 0) / seamDistances.length).toFixed(9)),
    seamMax: Number(Math.max(...seamDistances).toFixed(9)),
  }
}

const runs = Array.from({ length: 4 }, snapshot)
const baseline = JSON.stringify(runs[0])
for (const [index, run] of runs.entries()) {
  if (JSON.stringify(run) !== baseline) throw new Error(`Template/solver state leaked between builds at run ${index + 1}: ${JSON.stringify(run)} != ${baseline}`)
}
console.log(JSON.stringify({ deterministicRuns: runs.length, baseline: runs[0] }, null, 2))
