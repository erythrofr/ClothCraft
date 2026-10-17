import { createDefaultProject } from '../src/data/defaultProject.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

function summary(simulation) {
  const particles = [...simulation.pieces.values()].flatMap((piece) => piece.particles)
  const structural = simulation.constraints.filter((constraint) => constraint.type === 'structural')
  const structuralStrain = structural.map((constraint) => {
    const length = constraint.a.position.distanceTo(constraint.b.position)
    return Math.abs(length - constraint.rest) / Math.max(constraint.rest, 1e-6)
  })
  const sorted = [...structuralStrain].sort((a, b) => a - b)
  const byPiece = Object.fromEntries([...simulation.pieces.entries()].map(([id, piece]) => {
    const ys = piece.particles.map((particle) => particle.position.y)
    const lowest = piece.particles.reduce((best, particle) => particle.position.y < best.position.y ? particle : best, piece.particles[0])
    const center = piece.particles.reduce((best, particle) => {
      const score = Math.abs(particle.patternU || 0) + Math.abs(particle.position.y - 1.3)
      const bestScore = Math.abs(best.patternU || 0) + Math.abs(best.position.y - 1.3)
      return score < bestScore ? particle : best
    }, piece.particles[0])
    return [id, {
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      centerY: ys.reduce((sum, value) => sum + value, 0) / ys.length,
      lowestPosition: lowest.position.toArray(),
      centerPosition: center.position.toArray(),
    }]
  }))
  return {
    minY: Math.min(...particles.map((particle) => particle.position.y)),
    maxY: Math.max(...particles.map((particle) => particle.position.y)),
    averageStrain: structuralStrain.reduce((sum, value) => sum + value, 0) / Math.max(1, structuralStrain.length),
    p95Strain: sorted[Math.floor(sorted.length * 0.95)] || 0,
    maxStrain: Math.max(0, ...structuralStrain),
    averageSeamDistance: simulation.seamConstraints.reduce((sum, constraint) => sum + constraint.a.position.distanceTo(constraint.b.position), 0) / Math.max(1, simulation.seamConstraints.length),
    byPiece,
  }
}

const project = createDefaultProject()
if (process.env.SIM_RESOLUTION !== undefined) project.simulation.resolution = Number(process.env.SIM_RESOLUTION)
if (process.env.SIM_CURVE_SEGMENTS !== undefined) project.simulation.curveSegments = Number(process.env.SIM_CURVE_SEGMENTS)
const simulation = buildSimulation(project)
console.log('initial', JSON.stringify(summary(simulation), null, 2))

for (let frame = 0; frame < 240; frame += 1) stepSimulation(simulation, project, 1 / 60)
const settled = summary(simulation)
console.log('settled', JSON.stringify(settled, null, 2))

if (settled.averageStrain > 0.35) throw new Error(`Average textile strain regression: ${(settled.averageStrain * 100).toFixed(1)}%`)
if (settled.p95Strain > 1.0) throw new Error(`P95 textile strain regression: ${(settled.p95Strain * 100).toFixed(1)}%`)
if (settled.maxStrain > 2.5) throw new Error(`Peak textile strain regression: ${(settled.maxStrain * 100).toFixed(1)}%`)
if (settled.averageSeamDistance > 0.025) throw new Error(`Seam closure regression: ${(settled.averageSeamDistance * 100).toFixed(2)} cm average gap`)

const worst = simulation.constraints
  .filter((constraint) => constraint.type === 'structural')
  .map((constraint) => {
    const length = constraint.a.position.distanceTo(constraint.b.position)
    const [pieceAId, indexA] = constraint.a.id.split(':')
    const [pieceBId, indexB] = constraint.b.id.split(':')
    const flatA = simulation.pieces.get(pieceAId)?.flatVertices?.[Number(indexA)]
    const flatB = simulation.pieces.get(pieceBId)?.flatVertices?.[Number(indexB)]
    return {
      a: constraint.a.id,
      b: constraint.b.id,
      flatA: flatA ? [flatA.x, flatA.y] : null,
      flatB: flatB ? [flatB.x, flatB.y] : null,
      posA: constraint.a.position.toArray(),
      posB: constraint.b.position.toArray(),
      rest: constraint.rest,
      length,
      strain: Math.abs(length - constraint.rest) / Math.max(constraint.rest, 1e-6),
    }
  })
  .sort((a, b) => b.strain - a.strain)
  .slice(0, 12)

if (!process.env.COMPACT) console.log('worst', JSON.stringify(worst, null, 2))
