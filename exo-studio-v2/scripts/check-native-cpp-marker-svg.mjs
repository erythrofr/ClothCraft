import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { markerToSvg } from '../src/core/markerArtifacts.js'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { gradeProject } from '../src/core/grading.js'
import { buildFabricMarkers } from '../src/core/marker.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const binary = process.env.MARKER_SVG_TEST_BIN || '/tmp/garment-marker-svg-unit'
const marker = {
  width: 150, length: 20, fabricId: 'cotton&silk', unusedPieces: 0,
  placements: [{ pieceId: 'p', instance: 0, name: 'A<&"\'B', x: 2, y: 3,
    rotationDeg: 0, outline: [{ x: 2, y: 3 }, { x: 12, y: 3 },
      { x: 12, y: 23 }, { x: 2, y: 23 }] }],
}
const project = { pieces: [{ id: 'p', grainAngleDeg: 0,
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }, { x: 0, y: 20 }] }] }
execFileSync('clang++', ['-std=c++17', '-O0', '-I', 'native_cpp/core', '-I',
  'native_cpp/vendor', 'native_cpp/tests/test_marker_svg.cpp',
  'native_cpp/core/marker_svg.cpp', 'native_cpp/core/cutting_geometry.cpp',
  '-o', binary], { cwd: root, stdio: 'inherit' })
execFileSync(binary, [], { cwd: root, stdio: 'inherit' })
const native = execFileSync(binary, ['--stdout'], { cwd: root, encoding: 'utf8' }).trimEnd()
const js = markerToSvg(marker, { size: 'M<&', project })
assert.equal(native, js, 'native marker SVG matches JS byte-for-byte on the rectangular fixture')
assert.match(native, /width="150cm" height="20cm"/)
assert.match(native, /<g id="grain-lines"[^>]*><line /)
console.log('PASS native marker SVG JavaScript parity: exact SVG fixture and physical centimeter dimensions')

let validated = 0
let curved = 0
let notches = 0
let rotations = 0
const defaultProject = createDefaultProject()
for (const size of ['XS', 'S', 'M', 'L', 'XL', 'XXL']) {
  const graded = gradeProject(defaultProject, size)
  const width = graded.markerSettings?.fabricWidthCm ?? 150
  const gap = graded.markerSettings?.gapCm ?? 1.5
  const markers = buildFabricMarkers(graded, width, gap)
  for (const [fabricId, realMarker] of Object.entries(markers)) {
    const options = { size, fabricName: graded.fabrics?.[fabricId]?.name ?? fabricId, project: graded }
    const input = { marker: realMarker, ...options }
    const actual = execFileSync(binary, ['--json'], { cwd: root, input: JSON.stringify(input), encoding: 'utf8' }).trimEnd()
    const expected = markerToSvg(realMarker, options)
    if (actual !== expected) {
      let at = 0
      while (at < Math.min(actual.length, expected.length) && actual[at] === expected[at]) at++
      throw new Error(`SVG parity failed size=${size} fabric=${fabricId} offset=${at}\nNative: ${actual.slice(at, at + 180)}\nJS: ${expected.slice(at, at + 180)}`)
    }
    validated++
    for (const p of realMarker.placements) {
      const piece = graded.pieces.find(piece => piece.id === p.pieceId)
      if (piece?.curves && Object.keys(piece.curves).length) curved++
      if (piece?.notches?.length) notches++
      if (p.rotationDeg) rotations++
    }
  }
}
assert.ok(curved > 0, 'real sample must exercise curved edges')
assert.ok(notches > 0, 'real sample must exercise notches')
// The default project uses zero-degree grain. Rotate its real pattern geometry
// through the normal marker-packing path to cover non-axis-aligned annotations.
const rotatedProject = gradeProject(defaultProject, 'M')
for (const piece of rotatedProject.pieces) piece.grainAngleDeg = 31
const rotatedMarkers = buildFabricMarkers(rotatedProject, 180, 1.5)
for (const [fabricId, realMarker] of Object.entries(rotatedMarkers)) {
  const options = { size: 'M', fabricName: fabricId, project: rotatedProject }
  const actual = execFileSync(binary, ['--json'], {
    cwd: root, input: JSON.stringify({ marker: realMarker, ...options }), encoding: 'utf8',
  }).trimEnd()
  const expected = markerToSvg(realMarker, options)
  if (actual !== expected) {
    let at = 0
    while (at < Math.min(actual.length, expected.length) && actual[at] === expected[at]) at++
    throw new Error(`Rotated SVG parity failed fabric=${fabricId} offset=${at}\nNative: ${actual.slice(at, at + 180)}\nJS: ${expected.slice(at, at + 180)}`)
  }
  validated++
  rotations += realMarker.placements.filter(p => p.rotationDeg !== 0).length
}
assert.ok(rotations > 0, 'real graded sample must exercise grainline rotation')
console.log(`PASS real default project 6-size marker SVG parity: ${validated} markers, ${curved} curved placements, ${notches} notched placements, ${rotations} rotated placements`)
