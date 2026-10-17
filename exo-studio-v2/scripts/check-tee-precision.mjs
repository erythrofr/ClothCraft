import { createTeeTemplate } from '../src/data/templates.js'
import { seamLengthReport, edgeLength } from '../src/core/project.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

const project = createTeeTemplate()
if (project.pieces.length !== 4 || project.seams.length !== 14) throw new Error('Tee changed four-panel/fourteen-seam topology')
const sleeves = project.pieces.filter(piece => piece.id.startsWith('sleeve-'))
if (sleeves.length !== 2 || sleeves.some(piece => piece.points.length !== 7)) throw new Error('Expected symmetrical seven-point short sleeves')
for (const sleeve of sleeves) {
  if (Math.max(...sleeve.points.map(point => point.y)) !== 25) throw new Error(sleeve.name + ': not a short sleeve')
  for (let i = 0; i < sleeve.points.length; i++) {
    const length = edgeLength(sleeve,i)
    if (!Number.isFinite(length) || length <= 0) throw new Error(sleeve.name + ': invalid edge ' + i)
  }
}
const front = project.pieces.find(p => p.id === 'front')
const back = project.pieces.find(p => p.id === 'back')
if (front.curves?.[10]?.cy >= back.curves?.[10]?.cy) throw new Error('Front neck must be deeper than back neck')
const mismatches = project.seams.map(seam => {
  const report = seamLengthReport(project,seam)
  return {name:seam.name,mismatch:report.mismatchPercent,status:report.status}
})
const worst = Math.max(...mismatches.map(item => item.mismatch))
if (worst > 1 || mismatches.some(item => item.status !== 'good')) throw new Error('Seam lengths not within 1%: ' + JSON.stringify(mismatches))
const simulation = buildSimulation(project)
for (let frame=0; frame<50; frame++) stepSimulation(simulation,project,1/60)
for (const piece of simulation.pieces.values()) {
  for (const particle of piece.particles) {
    if (!['x','y','z'].every(axis=>Number.isFinite(particle.position[axis]))) throw new Error('Nonfinite particle after tee correction')
  }
}
console.log(JSON.stringify({project:project.name,pieces:project.pieces.length,seams:project.seams.length,
  maxSeamMismatchPercent:Number(worst.toFixed(3)),poorSeamCount:0,physicsFrames:50,finite:true}))
