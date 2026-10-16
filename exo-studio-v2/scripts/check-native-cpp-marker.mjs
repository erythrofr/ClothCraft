import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createTeeTemplate, createZipHoodieTemplate } from '../src/data/templates.js'
import { gradeProject } from '../src/core/grading.js'
import { buildFabricMarkers } from '../src/core/marker.js'

const bin = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
let comparedSizes = 0
let comparedPlacements = 0
let comparedOutlines = 0
let comparedRejected = 0
let alternateEquivalentPlacements = 0

function request(project, op, args = {}) {
  const result = spawnSync(bin, {
    encoding: 'utf8',
    input: JSON.stringify({ protocol: 'garment-studio.native-cad.v1', document: project, op, args }) + '\n',
    timeout: 30000,
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout.trim())
}

function near(actual, expected, label) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: finite geometry expected`)
  assert.ok(Math.abs(actual - expected) <= 0.0001, `${label}: native=${actual} JS=${expected}`)
}

function compareMarkers(native, baseline, label) {
  assert.deepEqual(Object.keys(native).sort(), Object.keys(baseline).sort(), `${label}: fabric split`)
  for (const fabricId of Object.keys(baseline)) {
    const a = baseline[fabricId]
    const b = native[fabricId]
    const context = `${label}:${fabricId}`
    assert.equal(b.fabricId, a.fabricId)
    assert.equal(b.unusedPieces, a.unusedPieces, `${context}: unplaced count`)
    assert.equal(b.requestedPieces, a.requestedPieces, `${context}: cut quantities`)
    near(b.width, a.width, `${context}:width`)
    near(b.length, a.length, `${context}:length`)
    near(b.gap, a.gap, `${context}:gap`)
    near(b.efficiency, a.efficiency, `${context}:efficiency`)
    assert.equal(b.placements.length, a.placements.length)
    assert.equal(b.unplaced.length, a.unplaced.length)
    for (let i = 0; i < a.unplaced.length; i += 1) {
      const p = a.unplaced[i], q = b.unplaced[i]
      assert.equal(q.pieceId, p.pieceId)
      assert.equal(q.reason, p.reason)
      assert.equal(q.instance, p.instance)
      near(q.minimumWidthCm, p.minimumWidthCm, `${context}:unplaced ${i}:minimumWidth`)
      comparedRejected += 1
    }
    for (let i = 0; i < a.placements.length; i += 1) {
      const p = a.placements[i]
      const q = b.placements.find(item => item.pieceId === p.pieceId && item.instance === p.instance)
      const loc = `${context}:piece ${i}:${p.pieceId}`
      assert.ok(q, `${loc}:missing piece or instance`)
      for (const key of ['pieceId', 'instance', 'name', 'rotated', 'crossGrain'])
        assert.equal(q[key], p[key], `${loc}:${key}`)
      for (const key of ['width', 'height', 'area', 'rotationDeg'])
        near(q[key], p[key], `${loc}:${key}`)
      if (Math.abs(q.x - p.x) > .0001 || Math.abs(q.y - p.y) > .0001)
        alternateEquivalentPlacements += 1
      assert.ok(q.x >= -1e-7 && q.y >= -1e-7, `${loc}:marker positions must be positive`)
      assert.ok(q.x + q.width <= b.width + 1e-6, `${loc}:crosses fabric width`)
      assert.equal(q.outline.length, p.outline.length, `${loc}:outline count`)
      for (let vertex = 0; vertex < p.outline.length; vertex += 1) {
        near(q.outline[vertex].x - q.x, p.outline[vertex].x - p.x, `${loc}:vertex ${vertex}:x`)
        near(q.outline[vertex].y - q.y, p.outline[vertex].y - p.y, `${loc}:vertex ${vertex}:y`)
        comparedOutlines += 1
      }
      comparedPlacements += 1
    }
    for (let i = 0; i < b.placements.length; i += 1) {
      const p = b.placements[i]
      for (let j = i + 1; j < b.placements.length; j += 1) {
        const q = b.placements[j]
        assert.ok(p.x + p.width + b.gap <= q.x + 1e-6 ||
          q.x + q.width + b.gap <= p.x + 1e-6 ||
          p.y + p.height + b.gap <= q.y + 1e-6 ||
          q.y + q.height + b.gap <= p.y + 1e-6,
        `${context}:marker placements overlap`)
      }
    }
  }
  comparedSizes += 1
}

const projects = [createDefaultProject(), createTeeTemplate(), createZipHoodieTemplate()]
const crossGrain = structuredClone(projects[0])
crossGrain.pieces[0].marker = { allowCrossGrain: true }
crossGrain.pieces[0].grainAngleDeg = 21
crossGrain.pieces[0].cutQuantity = 2
crossGrain.markerSettings = { fabricWidthCm: 155, gapCm: 2.5 }
projects.push(crossGrain)

const overflow = structuredClone(projects[2])
overflow.markerSettings.fabricWidthsCm = { ...(overflow.markerSettings.fabricWidthsCm || {}), rib: 90 }
projects.push(overflow)

for (const project of projects) {
  const original = structuredClone(project)
  const sizes = project.grading?.sizes?.length ? project.grading.sizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  const all = request(project, 'marker-run')
  assert.equal(all.ok, true, all.error)
  assert.equal(all.factoryCertified, false)
  assert.deepEqual(Object.keys(all.markersBySize).sort(), sizes.slice().sort())
  for (const size of sizes) {
    const native = request(project, 'marker-size', { size })
    assert.equal(native.ok, true, `${project.name}:${size}: ${native.error}`)
    assert.equal(native.factoryCertified, false)
    const graded = gradeProject(project, size)
    const width = Number(project.markerSettings?.fabricWidthCm ?? 150)
    const gap = Number(project.markerSettings?.gapCm ?? 1.5)
    const baseline = buildFabricMarkers(graded, width, gap)
    compareMarkers(native.markers, baseline, `${project.name}:${size}:single`)
    compareMarkers(all.markersBySize[size], baseline, `${project.name}:${size}:run`)
  }
  assert.deepEqual(project, original, 'marker creation must not modify source projects')
  assert.equal(request(project, 'marker-size', { size: 'INVALID-SIZE' }).ok, false)
}

// Also verify source-size marker calls without an intermediate grading step.
const reference = projects[0]
const baseMarkers = request(reference, 'marker-size')
assert.equal(baseMarkers.ok, true, baseMarkers.error)
compareMarkers(baseMarkers.markers, buildFabricMarkers(reference,
  reference.markerSettings.fabricWidthCm, reference.markerSettings.gapCm), 'ungraded')

const invalidWidth = structuredClone(reference)
invalidWidth.markerSettings.fabricWidthCm = -20
assert.equal(request(invalidWidth, 'marker-size').ok, false, 'negative fabric width must fail')
const invalidGap = structuredClone(reference)
invalidGap.markerSettings.gapCm = -1
assert.equal(request(invalidGap, 'marker-size').ok, false, 'negative gap must fail')

assert.ok(comparedOutlines > 100, 'geometric comparison must exercise curved outlines')
console.log(JSON.stringify({ pass: true, implementation: 'native C++17',
  projectsCompared: projects.length, markerSetsCompared: comparedSizes,
  placementsCompared: comparedPlacements, contourVerticesCompared: comparedOutlines,
  overflowPiecesCompared: comparedRejected, equivalentAlternateLocations: alternateEquivalentPlacements,
  untouchedSources: true, factoryCertified: false }))
