import fs from 'node:fs'
import path from 'node:path'
import { createTemplateProject } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

const template = process.argv[2] || 'tee'
const output = process.argv[3] || `native_backend/output/${template}.browser-result.json`
const frames = Math.max(1, Number(process.argv[4] || 240))
const project = createTemplateProject(template)
project.simulation.selfCollision = true
const simulation = buildSimulation(project)
for (let frame = 0; frame < frames; frame += 1) stepSimulation(simulation, project, 1 / 60)

const pieces = []
for (const [pieceId, simPiece] of simulation.pieces.entries()) {
  pieces.push({
    id: pieceId,
    name: simPiece.piece?.name || pieceId,
    vertices: simPiece.particles.map((particle) => [particle.position.x, particle.position.y, particle.position.z]),
    faces: simPiece.faces.map((face) => [...face]),
  })
}
const seamDistances = simulation.seamConstraints.map((constraint) => constraint.a.position.distanceTo(constraint.b.position))
const allParticles = [...simulation.pieces.values()].flatMap((piece) => piece.particles)
const ys = allParticles.map((particle) => particle.position.y)
const result = {
  protocol: 'garment-studio.browser-pbd-result',
  version: 1,
  backendId: 'browser-pbd',
  frames,
  pieces,
  stats: {
    particles: allParticles.length,
    constraints: simulation.constraints.length,
    anchors: simulation.anchorConstraints.length,
    finite: allParticles.every((particle) => particle.position.toArray().every(Number.isFinite)),
    strainAverage: Number(simulation.strain?.average || 0),
    strainMax: Number(simulation.strain?.max || 0),
    seamAverageDistance: seamDistances.reduce((sum, value) => sum + value, 0) / Math.max(1, seamDistances.length),
    seamMaxDistance: seamDistances.length ? Math.max(...seamDistances) : 0,
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  },
}
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ template, output, frames, ...result.stats }, null, 2))
