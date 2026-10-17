import { createDefaultProject } from '../src/data/defaultProject.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

function run(type) {
  const project = createDefaultProject()
  const front = project.pieces.find((piece) => piece.id === 'front')
  front.internalLines = type === 'fold'
    ? [{ id: 'qa-fold', type: 'fold', a: { x: 0, y: 8 }, b: { x: 0, y: 58 }, foldAngleDeg: 90 }]
    : [{ id: 'qa-dart', type: 'dart', a: { x: 0, y: 4 }, b: { x: 0, y: 38 }, widthCm: 5 }]
  const simulation = buildSimulation(project)
  for (let index = 0; index < 120; index += 1) stepSimulation(simulation, project, 1 / 60)
  const particles = [...simulation.pieces.values()].flatMap((piece) => piece.particles)
  return {
    type,
    internalConstraints: simulation.internalConstraints.length,
    constraintTypes: Object.fromEntries(
      [...new Set(simulation.internalConstraints.map((constraint) => constraint.type))]
        .map((constraintType) => [constraintType, simulation.internalConstraints.filter((constraint) => constraint.type === constraintType).length]),
    ),
    invalidParticles: particles.filter((particle) => ![
      particle.position.x,
      particle.position.y,
      particle.position.z,
    ].every(Number.isFinite)).length,
    averageStrain: Number((simulation.strain?.average || 0).toFixed(5)),
  }
}

console.log(JSON.stringify([run('fold'), run('dart')], null, 2))
