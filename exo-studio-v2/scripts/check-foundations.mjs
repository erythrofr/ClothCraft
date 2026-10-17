import { GARMENT_TEMPLATES, createTemplateProject } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

function finiteSimulation(simulation) {
  return [...simulation.pieces.values()].every((piece) => piece.particles.every((particle) => (
    Number.isFinite(particle.position.x) &&
    Number.isFinite(particle.position.y) &&
    Number.isFinite(particle.position.z)
  )))
}

function seamStats(simulation) {
  const distances = simulation.seamConstraints.map((constraint) => constraint.a.position.distanceTo(constraint.b.position))
  return {
    average: distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : 0,
    max: distances.length ? Math.max(...distances) : 0,
  }
}

function maxRadius(simulation) {
  let value = 0
  for (const piece of simulation.pieces.values()) {
    for (const particle of piece.particles) value = Math.max(value, particle.position.length())
  }
  return value
}

const reports = []
for (const template of GARMENT_TEMPLATES) {
  const project = createTemplateProject(template.id)
  const simulation = buildSimulation(project)
  for (let frame = 0; frame < 120; frame += 1) stepSimulation(simulation, project, 1 / 60)

  if (!finiteSimulation(simulation)) throw new Error(`${template.id}: non-finite particle state`)
  const seams = seamStats(simulation)
  const radius = maxRadius(simulation)
  if (radius > 4.5) throw new Error(`${template.id}: garment escaped simulation bounds (${radius.toFixed(2)} m)`)
  if (seams.average > 0.05) throw new Error(`${template.id}: average seam gap regression (${(seams.average * 100).toFixed(2)} cm)`)
  if (simulation.strain.average > 0.8) throw new Error(`${template.id}: average strain exploded (${(simulation.strain.average * 100).toFixed(1)}%)`)
  if (simulation.strain.max > 10) throw new Error(`${template.id}: local structural strain exploded (${(simulation.strain.max * 100).toFixed(1)}%)`)

  reports.push({
    template: template.id,
    pieces: project.pieces.length,
    vertices: [...simulation.pieces.values()].reduce((sum, piece) => sum + piece.particles.length, 0),
    seams: project.seams.length,
    averageSeamGapCm: Number((seams.average * 100).toFixed(2)),
    maxSeamGapCm: Number((seams.max * 100).toFixed(2)),
    averageStrainPercent: Number((simulation.strain.average * 100).toFixed(1)),
    peakStrainPercent: Number((simulation.strain.max * 100).toFixed(1)),
    maxRadiusM: Number(radius.toFixed(2)),
  })
}

// Zipper closure must release progressively.
{
  const project = createTemplateProject('zip-hoodie')
  const zipper = project.seams.find((seam) => seam.id === 'center-front-zipper')
  const counts = []
  for (const openFraction of [0, 0.5, 1]) {
    zipper.openFraction = openFraction
    const simulation = buildSimulation(project)
    counts.push(simulation.seamConstraints.filter((constraint) => constraint.seamId === zipper.id).length)
  }
  if (!(counts[0] > counts[1] && counts[1] > counts[2] && counts[2] === 0)) {
    throw new Error(`Zipper release regression: ${counts.join(' -> ')}`)
  }
}

// Closed point fasteners must constrain; open fasteners must release.
{
  const project = createTemplateProject('blank')
  const first = project.pieces[0]
  first.id = 'fastener-a'
  const second = structuredClone(first)
  second.id = 'fastener-b'
  second.name = 'Fastener B'
  second.arrangement3d = { ...second.arrangement3d, z: (second.arrangement3d?.z || 0.3) + 0.12 }
  project.pieces.push(second)
  project.fasteners = [{
    id: 'qa-snap',
    name: 'QA snap',
    type: 'snap',
    closed: true,
    a: { pieceId: first.id, x: 0, y: 20 },
    b: { pieceId: second.id, x: 0, y: 20 },
  }]
  const closed = buildSimulation(project)
  if (closed.fastenerConstraints.length !== 1) throw new Error('Closed snap did not create a physical fastener constraint')
  project.fasteners[0].closed = false
  const open = buildSimulation(project)
  if (open.fastenerConstraints.length !== 0) throw new Error('Open snap still created a physical fastener constraint')
}

// Ease treatment must create take-up constraints without destabilizing the seam.
{
  const project = createTemplateProject('blank')
  const a = project.pieces[0]
  a.id = 'ease-a'
  a.points = [{ x: -20, y: 40 }, { x: -20, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 40 }]
  const b = structuredClone(a)
  b.id = 'ease-b'
  b.points = [{ x: -15, y: 40 }, { x: -15, y: 0 }, { x: 15, y: 0 }, { x: 15, y: 40 }]
  b.arrangement3d = { ...b.arrangement3d, z: (b.arrangement3d?.z || 0.3) + 0.08 }
  project.pieces = [a, b]
  project.seams = [{
    id: 'qa-ease',
    name: 'QA ease',
    type: 'ease',
    easeSide: 'a',
    ratio: 0.75,
    a: { pieceId: a.id, edgeIndex: 2 },
    b: { pieceId: b.id, edgeIndex: 2 },
  }]
  const simulation = buildSimulation(project)
  for (let frame = 0; frame < 60; frame += 1) stepSimulation(simulation, project, 1 / 60)
  if (!simulation.treatmentConstraints.length) throw new Error('Ease seam did not create treatment constraints')
  if (!finiteSimulation(simulation)) throw new Error('Ease seam destabilized the solver')
}

// Moderate wind must remain finite on sewn/anchored garments.
for (const templateId of ['tee', 'hoodie']) {
  const project = createTemplateProject(templateId)
  project.simulation.wind = { enabled: true, speed: 4, directionDeg: 0, turbulence: 0.18, response: 0.025 }
  const simulation = buildSimulation(project)
  for (let frame = 0; frame < 120; frame += 1) stepSimulation(simulation, project, 1 / 60)
  if (!finiteSimulation(simulation)) throw new Error(`${templateId}: wind produced non-finite particles`)
  if (maxRadius(simulation) > 3) throw new Error(`${templateId}: wind detached garment from fitting region`)
}

console.log(JSON.stringify({ foundations: reports }, null, 2))
