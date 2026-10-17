import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHoodieTemplate } from '../src/data/templates.js'
import { gradeProject } from '../src/core/grading.js'
import { buildFabricMarkers } from '../src/core/marker.js'

const executable = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const original = createHoodieTemplate()
original.markerSettings = { fabricWidthCm: 165, gapCm: 2, fabricWidthsCm: { main: 165, rib: 90 } }

function native(project, op, args = {}) {
  const run = spawnSync(executable, { input: JSON.stringify({
    protocol: 'garment-studio.native-cad.v1', document: project, op, args,
  }) + '\n', encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024 })
  assert.equal(run.status, 0, run.stderr || run.error?.message)
  const answer = JSON.parse(run.stdout)
  assert.equal(answer.ok, true, answer.error)
  return answer
}

function approx(a, b, label) {
  assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < .0001,
    `${label}: ${a} vs ${b}`)
}

let markerSets = 0
let inspectedPieces = 0
function compare(actual, expected, context) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${context}: fabrics`)
  for (const fabric of Object.keys(expected)) {
    const a = actual[fabric], b = expected[fabric]
    assert.equal(a.fabricId, fabric)
    assert.equal(a.requestedPieces, b.requestedPieces)
    assert.equal(a.unusedPieces, b.unusedPieces)
    approx(a.width, b.width, `${context}:width`)
    approx(a.length, b.length, `${context}:length`)
    approx(a.efficiency, b.efficiency, `${context}:efficiency`)
    const id = p => `${p.pieceId}:${p.instance}`
    const expectedItems = [...b.placements, ...b.unplaced].map(id).sort()
    const actualItems = [...a.placements, ...a.unplaced].map(id).sort()
    assert.deepEqual(actualItems, expectedItems, `${context}:pieces/instances`)
    for (const piece of b.placements) {
      const result = a.placements.find(item => id(item) === id(piece))
      assert.ok(result, `${context}:missing ${id(piece)}`)
      for (const property of ['rotationDeg', 'width', 'height', 'area'])
        approx(result[property], piece[property], `${context}:${id(piece)}:${property}`)
      assert.equal(result.crossGrain, piece.crossGrain)
      assert.equal(result.rotated, piece.rotated)
      assert.ok(result.x >= 0 && result.y >= 0 && result.x + result.width <= a.width + .000001)
      assert.equal(result.outline.length, piece.outline.length)
      for (let i = 0; i < piece.outline.length; i++) {
        approx(result.outline[i].x - result.x, piece.outline[i].x - piece.x,
          `${context}:${id(piece)}:outline x:${i}`)
        approx(result.outline[i].y - result.y, piece.outline[i].y - piece.y,
          `${context}:${id(piece)}:outline y:${i}`)
      }
      inspectedPieces++
    }
    for (let i = 0; i < a.placements.length; i++) for (let j = i + 1; j < a.placements.length; j++) {
      const p = a.placements[i], q = a.placements[j]
      assert.ok(p.x + p.width + a.gap <= q.x + .000001 ||
        q.x + q.width + a.gap <= p.x + .000001 ||
        p.y + p.height + a.gap <= q.y + .000001 ||
        q.y + q.height + a.gap <= p.y + .000001, `${context}:overlap`)
    }
  }
  markerSets++
}

const scenarios = [original]
const rotated = structuredClone(original)
rotated.pieces[0].grainAngleDeg = 34
rotated.pieces[0].marker = { allowCrossGrain: true }
rotated.pieces[0].cutQuantity = 3
rotated.pieces[1].cutQuantity = 2
scenarios.push(rotated)
const emptyFabric = structuredClone(rotated)
emptyFabric.pieces[0].fabricId = '' // JS uses 'main' for empty fabric IDs.
scenarios.push(emptyFabric)
const narrow = structuredClone(rotated)
narrow.markerSettings.fabricWidthsCm.rib = 35
scenarios.push(narrow)

for (const project of scenarios) {
  const snapshot = structuredClone(project)
  const sizes = project.grading.sizes
  const run = native(project, 'marker-run').markersBySize
  assert.deepEqual(Object.keys(run).sort(), [...sizes].sort())
  for (const size of sizes) {
    const graded = gradeProject(project, size)
    const baseline = buildFabricMarkers(graded, project.markerSettings.fabricWidthCm,
      project.markerSettings.gapCm)
    compare(native(project, 'marker-size', { size }).markers, baseline, `${size}:single`)
    compare(run[size], baseline, `${size}:run`)
  }
  assert.deepEqual(project, snapshot, 'marker run mutated source document')
}

assert.ok(markerSets >= 20 && inspectedPieces > 50)
console.log(JSON.stringify({ pass: true, scenarios: scenarios.length, markerSets,
  inspectedPieces, sourcePreserved: true, factoryCertified: false }))
