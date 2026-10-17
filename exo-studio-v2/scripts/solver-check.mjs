import { performance } from 'node:perf_hooks'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

const project = createDefaultProject()
const simulation = buildSimulation(project)
const structural = simulation.constraints.filter((constraint) => constraint.type === 'structural')
const warp = structural.filter((constraint) => (constraint.warpWeight || 0) >= (constraint.weftWeight || 0))
const weft = structural.filter((constraint) => (constraint.weftWeight || 0) > (constraint.warpWeight || 0))
const average = (items, field) => items.length
  ? items.reduce((sum, item) => sum + Number(item[field] || 0), 0) / items.length
  : 0

const started = performance.now()
for (let index = 0; index < 180; index += 1) stepSimulation(simulation, project, 1 / 60)
const elapsedMs = performance.now() - started
const particles = [...simulation.pieces.values()].flatMap((piece) => piece.particles)
const invalid = particles.filter((particle) => ![
  particle.position.x,
  particle.position.y,
  particle.position.z,
].every(Number.isFinite))

let closest = Infinity
for (let leftIndex = 0; leftIndex < particles.length; leftIndex += 1) {
  const left = particles[leftIndex]
  for (let rightIndex = leftIndex + 1; rightIndex < particles.length; rightIndex += 1) {
    const right = particles[rightIndex]
    const key = `${Math.min(left.simIndex, right.simIndex)}:${Math.max(left.simIndex, right.simIndex)}`
    if (simulation.collisionExclusions?.has(key)) continue
    closest = Math.min(closest, left.position.distanceTo(right.position))
  }
}

console.log(JSON.stringify({
  particles: particles.length,
  structuralConstraints: structural.length,
  seamConstraints: simulation.seamConstraints.length,
  selfCollision: project.simulation.selfCollision,
  warpDominantConstraints: warp.length,
  weftDominantConstraints: weft.length,
  averageWarpDominantStiffness: Number(average(warp, 'stiffness').toFixed(5)),
  averageWeftDominantStiffness: Number(average(weft, 'stiffness').toFixed(5)),
  closestNonNeighborMeters: Number(closest.toFixed(5)),
  averageStrain: Number((simulation.strain?.average || 0).toFixed(5)),
  peakStrain: Number((simulation.strain?.max || 0).toFixed(5)),
  invalidParticles: invalid.length,
  simulatedFrames: 180,
  runtimeMs: Number(elapsedMs.toFixed(2)),
}, null, 2))

if (invalid.length) process.exitCode = 2
