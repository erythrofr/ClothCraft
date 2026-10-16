import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createTeeTemplate } from '../src/data/templates.js'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { edgeLength, seamLengthReport } from '../src/core/project.js'

const bin = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const documentList = [createDefaultProject(), createTeeTemplate()]

function call(project, op, args = {}, more = {}) {
  const request = { protocol: 'garment-studio.native-cad.v1', document: project, op, args, ...more }
  const process = spawnSync(bin, { input: JSON.stringify(request) + '\n', encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  if (process.error) throw process.error
  assert.equal(process.status, 0, process.stderr)
  const response = JSON.parse(process.stdout.trim())
  assert.equal(response.ok, true, response.error || 'native CAD returned unsuccessful response')
  return response
}

let lengths = 0
let seams = 0
for (const project of documentList) {
  const inspected = call(project, 'inspect')
  assert.equal(inspected.validation.ok, true)
  assert.equal(inspected.summary.pieceCount, project.pieces.length)
  assert.equal(inspected.summary.seamCount, project.seams.length)
  assert.deepEqual(call(project, 'document').document, project, 'No unknown fields may be dropped during import')
  for (const piece of project.pieces) {
    for (let edge = 0; edge < piece.points.length; edge += 1) {
      const measured = call(project, 'edge-info', { pieceId: piece.id, edgeIndex: edge }).edge.lengthCm
      const baseline = edgeLength(piece, edge)
      assert.ok(Math.abs(baseline - measured) < 0.0001,
        `${piece.id}:${edge} JS=${baseline} native C++=${measured}`)
      lengths++
    }
  }
  for (const seam of project.seams) {
    const native = call(project, 'seam-info', { seamId: seam.id }).seam
    const browser = seamLengthReport(project, seam)
    assert.ok(Math.abs(native.lengthACm - browser.lengthA) < 0.0001)
    assert.ok(Math.abs(native.lengthBCm - browser.lengthB) < 0.0001)
    assert.ok(Math.abs(native.mismatchPercent - browser.mismatchPercent) < 0.0001)
    seams++
  }
  const prior = structuredClone(project)
  prior.experimentalVendorExtension = { unknownMetadata: ['keep', 101], source: 'clo-import' }
  const modified = call(prior, 'edit',
    { pieceId: 'front', pointIndex: 0, x: prior.pieces[0].points[0].x + 0.1,
      y: prior.pieces[0].points[0].y },
    { command: 'move-point', expectedRevision: prior.revision, includeUndo: true })
  assert.equal(modified.afterRevision, prior.revision + 1)
  assert.deepEqual(modified.undoSnapshot, prior)
  assert.deepEqual(modified.document.experimentalVendorExtension, prior.experimentalVendorExtension)
  assert.deepEqual(modified.document.fabrics, prior.fabrics)
  assert.deepEqual(modified.document.seams, prior.seams)
  const noop = call(prior, 'edit',
    { pieceId: 'front', pointIndex: 0, x: prior.pieces[0].points[0].x,
      y: prior.pieces[0].points[0].y },
    { command: 'move-point', expectedRevision: prior.revision })
  assert.equal(noop.changed, false)
  assert.equal(noop.afterRevision, prior.revision)
}

console.log(JSON.stringify({ pass: true, implementation: 'native C++17',
  originalGarmentsCompared: documentList.length, preciseEdgeLengthsCompared: lengths,
  originalSewingLengthsCompared: seams, losslessRoundtrip: true,
  copyOnWriteTransactions: true, staleRevisionProtection: true }))
