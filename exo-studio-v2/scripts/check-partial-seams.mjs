import { strFromU8 } from 'fflate'
import { createTemplateProject } from '../src/data/templates.js'
import { cloneProject, seamLengthReport, seamWalkReport } from '../src/core/project.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'
import { buildTechPack } from '../src/core/measurements.js'
import { buildFactoryPackageFiles } from '../src/core/factoryPackage.js'

function makeProject(partial = true) {
  const project = createTemplateProject('blank')
  const a = project.pieces[0]
  a.id = 'partial-a'
  a.name = 'Partial A'
  a.points = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }]
  a.curves = {}
  a.layout2d = { x: 60, y: 80 }
  a.arrangement3d = { x: -0.24, y: 1.1, z: 0.1 }
  const b = cloneProject(a)
  b.id = 'partial-b'
  b.name = 'Partial B'
  b.layout2d = { x: 150, y: 80 }
  b.arrangement3d = { x: 0.24, y: 1.1, z: 0.1 }
  project.pieces = [a, b]
  project.seams = [{
    id: 'partial-qa',
    name: 'Partial QA seam',
    reverseB: true,
    a: { pieceId: a.id, edgeIndex: 0, ...(partial ? { startT: 0.25, endT: 0.75 } : {}) },
    b: { pieceId: b.id, edgeIndex: 0, ...(partial ? { startT: 0.10, endT: 0.60 } : {}) },
  }]
  return project
}

const partial = makeProject(true)
const full = makeProject(false)
const seam = partial.seams[0]
const report = seamLengthReport(partial, seam)
if (Math.abs(report.lengthA - 20) > 0.05 || Math.abs(report.lengthB - 20) > 0.05 || report.mismatchPercent > 0.01) {
  throw new Error(`Partial seam length diagnostics are wrong: ${JSON.stringify(report)}`)
}

const walk = seamWalkReport(partial, seam, 21)
if (!walk || Math.abs(walk.lengthA - 20) > 0.05 || Math.abs(walk.lengthB - 20) > 0.05 || walk.samples.length < 5) {
  throw new Error('Partial seam walk did not stay inside the sewn range')
}
if (Math.abs(walk.samples.at(-1).distanceA - 20) > 0.05 || Math.abs(walk.samples.at(-1).distanceB - 20) > 0.05) {
  throw new Error('Partial seam-walk distances are not range-relative')
}

const partialSimulation = buildSimulation(partial)
const fullSimulation = buildSimulation(full)
if (!(partialSimulation.seamConstraints.length < fullSimulation.seamConstraints.length) || partialSimulation.seamConstraints.length < 2) {
  throw new Error(`Partial seam constraint count is invalid: partial=${partialSimulation.seamConstraints.length} full=${fullSimulation.seamConstraints.length}`)
}
for (let frame = 0; frame < 90; frame += 1) stepSimulation(partialSimulation, partial, 1 / 60)
const seamGaps = partialSimulation.seamConstraints.map((constraint) => constraint.a.position.distanceTo(constraint.b.position))
if (!seamGaps.every(Number.isFinite) || Math.max(...seamGaps) > 0.03) throw new Error('Partial seam became unstable in simulation')

const techPack = buildTechPack(partial)
const exported = techPack.construction.find((item) => item.id === seam.id)
if (exported?.from?.startT !== 0.25 || exported?.from?.endT !== 0.75 || exported?.to?.startT !== 0.10 || exported?.to?.endT !== 0.60 || exported.reverseB !== true) {
  throw new Error('Tech pack lost partial seam endpoints')
}
const files = buildFactoryPackageFiles(partial)
const constructionCsv = strFromU8(files['construction-seams.csv'])
for (const token of ['A start %', 'A end %', 'B start %', 'B end %', '25.0', '75.0', '10.0', '60.0']) {
  if (!constructionCsv.includes(token)) throw new Error(`Factory seam CSV missing ${token}`)
}

console.log(JSON.stringify({
  lengthsCm: { a: report.lengthA, b: report.lengthB },
  seamConstraints: { partial: partialSimulation.seamConstraints.length, full: fullSimulation.seamConstraints.length },
  settledGapCm: {
    average: Number((seamGaps.reduce((sum, value) => sum + value, 0) / seamGaps.length * 100).toFixed(3)),
    max: Number((Math.max(...seamGaps) * 100).toFixed(3)),
  },
  exportedRanges: { a: exported.from, b: exported.to },
}, null, 2))
