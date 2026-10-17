import assert from 'node:assert/strict'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

const seamId = 'qa-two-way-zipper'

function simulate(options = {}, virtual = false) {
  const project = createDefaultProject()
  // Start with real production pattern pieces and one existing longitudinal seam.
  const original = project.seams.find((seam) => seam.id === 'seam-side-l')
  assert.ok(original, 'default project longitudinal seam is available')
  project.seams = [{ ...original, id: seamId, type: 'zipper', ...options,
    ...(virtual ? { useExactCorrespondence: true } : {}) }]
  project.simulation.adaptiveCutlineMeshing = false
  const simulation = buildSimulation(project)
  const stations = simulation.seamConstraints.filter((constraint) => constraint.seamId === seamId)
  return { project, simulation, stations }
}

for (const virtual of [false, true]) {
  const mode = virtual ? 'virtual' : 'vertex'
  const baseline = simulate({}, virtual)
  const allClosed = baseline.stations.length
  assert.ok(allClosed >= 3, `${mode}: usable seam stations, got ${allClosed}`)
  const fromStart = simulate({ openStartFraction: 0.3, openEndFraction: 0 }, virtual)
  const fromEnd = simulate({ openStartFraction: 0, openEndFraction: 0.3 }, virtual)
  const both = simulate({ openStartFraction: 0.3, openEndFraction: 0.3 }, virtual)
  const more = simulate({ openStartFraction: 0.45, openEndFraction: 0.4 }, virtual)
  const half = simulate({ openStartFraction: 0.5, openEndFraction: 0.5 }, virtual)
  const full = simulate({ openStartFraction: 0.7, openEndFraction: 0.7 }, virtual)
  const clipped = simulate({ openStartFraction: 9, openEndFraction: -10 }, virtual)
  assert.ok(fromStart.stations.length < allClosed, `${mode}: start release removes stations`)
  assert.ok(fromEnd.stations.length < allClosed, `${mode}: end release removes stations`)
  assert.ok(both.stations.length < fromStart.stations.length, `${mode}: releasing other end decreases constraints`)
  assert.ok(more.stations.length <= both.stations.length, `${mode}: larger opening monotonic`)
  assert.equal(half.stations.length, 0, `${mode}: half + half fully released`)
  assert.equal(full.stations.length, 0, `${mode}: overlapping openings fully released`)
  assert.equal(clipped.stations.length, 0, `${mode}: range clamp applies`)
  assert.equal(simulate({ openStartFraction: 0, openEndFraction: 0 }, virtual).stations.length, allClosed)
  assert.equal(simulate({ openStartFraction: 0, openEndFraction: 0, openFraction: 1 }, virtual).stations.length, allClosed,
    `${mode}: explicit two-end fields supersede legacy slider`)
  assert.equal(simulate({ openFraction: 1 }, virtual).stations.length, 0, `${mode}: legacy fully open`)
  assert.equal(simulate({ openFraction: 0 }, virtual).stations.length, allClosed, `${mode}: legacy fully closed`)
  assert.equal(simulate({ openFraction: 0.3, openFrom: 'start' }, virtual).stations.length, fromStart.stations.length)
  assert.equal(simulate({ openFraction: 0.3, openFrom: 'end' }, virtual).stations.length, fromEnd.stations.length)

  if (virtual) {
    const positions = (result) => result.stations.map((station) => station.progress)
    assert.ok(positions(fromStart).every((progress) => progress > 0.3), 'start must release the low-progress stations')
    assert.ok(positions(fromEnd).every((progress) => progress < 0.7), 'end must release the high-progress stations')
    assert.ok(positions(both).every((progress) => progress > 0.3 && progress < 0.7), 'both openings preserve only center')
  }

  // Exercise actual solver iteration with the surviving two-way seam constraints.
  stepSimulation(both.simulation, both.project, 1 / 60)
  assert.ok(both.stations.every((station) => Number.isFinite(station.a.position.x) && Number.isFinite(station.b.position.y)),
    `${mode}: solver keeps constrained particles finite`)
  console.log(`${mode}: closed=${allClosed}, start=${fromStart.stations.length}, end=${fromEnd.stations.length}, both=${both.stations.length}, wider=${more.stations.length}, full=0 PASS`)
}
