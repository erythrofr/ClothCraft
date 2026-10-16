import { createDefaultProject } from '../src/data/defaultProject.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

function run(type, ratio, gatherSide = 'a') {
  const project = createDefaultProject()
  const seam = project.seams.find((item) => item.id === 'seam-side-l')
  seam.type = type
  if (ratio !== undefined) seam.ratio = ratio
  seam.gatherSide = gatherSide
  const simulation = buildSimulation(project)
  for (let index = 0; index < 120; index += 1) stepSimulation(simulation, project, 1 / 60)
  const particles = [...simulation.pieces.values()].flatMap((piece) => piece.particles)
  const targetSeams = simulation.seamConstraints.filter((constraint) => constraint.seamId === seam.id)
  const treatments = simulation.treatmentConstraints.filter((constraint) => constraint.seamId === seam.id)
  return {
    type,
    ratio: seam.ratio ?? 1,
    seamLinks: targetSeams.length,
    treatmentConstraints: treatments.length,
    averageTreatmentRatio: treatments.length ? treatments.reduce((sum, constraint) => sum + constraint.ratio, 0) / treatments.length : null,
    averageClosureDistance: targetSeams.length ? targetSeams.reduce((sum, constraint) => sum + constraint.a.position.distanceTo(constraint.b.position), 0) / targetSeams.length : null,
    invalidParticles: particles.filter((particle) => ![
      particle.position.x,
      particle.position.y,
      particle.position.z,
    ].every(Number.isFinite)).length,
  }
}

console.log(JSON.stringify([
  run('normal'),
  run('zipper'),
  run('elastic', 0.82),
  run('gather', 0.68, 'a'),
  run('gather', 0.68, 'b'),
], null, 2))
