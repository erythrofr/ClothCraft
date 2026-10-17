#!/usr/bin/env node
// Reproducible static acceptance for the CLO male tee export and the *staged*
// partial-edge sewing map. Not a simulation or fitted-garment acceptance test.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseDxfPatterns } from '../src/core/dxf.js'
import { edgeRangeLength, pieceArea } from '../src/core/project.js'

const base = '../research/clo-reference/live-audit-20261014/exports/'
const read = async (name) => readFile(new URL(base + name, import.meta.url), 'utf8')
const json = async (name) => JSON.parse(await read(name))
const original = await json('clo-male-tshirt-7piece.garment.json')
const manifest = await json('clo-male-tshirt-7piece-import.manifest.json')
const map = await json('clo-male-tshirt-clo-sewing-to-2d-mapping.json')
const candidate = await json('clo-male-tshirt-sewn-EXPERIMENTAL.garment.json')
const report = await json('clo-male-tshirt-sewn-EXPERIMENTAL.validation.json')
const dxf = parseDxfPatterns(await read('clo-male-tshirt-7piece-import.dxf'))

assert.equal(dxf.scaleToCm, 0.1, 'CLO DXF must import as mm')
assert.equal(dxf.pieces.length, 7)
assert.equal(original.pieces.length, 7)
assert.equal(original.seams.length, 0, 'Original imported project must stay unsewn')
for (let i = 0; i < 7; i++) {
  const piece = original.pieces[i]
  assert.equal(piece.points.length, manifest.patternSummary[i].pointCount)
  assert.ok(Math.abs(pieceArea(piece) - manifest.patternSummary[i].areaCm2) < 0.015)
}

assert.equal(map.counts.sourceSeamGroups, 23)
assert.equal(map.counts.stitchedPointPairs, 182)
assert.equal(map.counts.patternPieces, 7)
assert.ok(map.maxSampleProjectionErrorMm < 2.1)
assert.equal(report.sourceGroups, 23)
assert.equal(report.sourceStitchPointPairs, 182)
assert.equal(candidate.seams.length, report.generatedPartialEdgeSeams)
assert.equal(candidate.cloReference.DO_NOT_DEPLOY_SIMULATION, true)
assert.equal(candidate.cloReference.sewnFitCertified, false)
assert.equal(new Set(candidate.seams.map(s => s.sourceCloSeamGroup)).size, 23)

const pieces = new Map(candidate.pieces.map(piece => [piece.id, piece]))
const lengthsByGroup = new Map()
const coverage = new Map()
for (const piece of candidate.pieces) {
  for (let i = 0; i < piece.points.length; i++) {
    const a = piece.points[i]
    const b = piece.points[(i + 1) % piece.points.length]
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.000001,
      `Zero-length candidate pattern edge ${piece.id}:${i}`)
  }
}
for (const seam of candidate.seams) {
  const sum = lengthsByGroup.get(seam.sourceCloSeamGroup) || [0, 0]
  for (const [index, side] of ['a', 'b'].entries()) {
    const endpoint = seam[side]
    const piece = pieces.get(endpoint.pieceId)
    assert.ok(piece, `Missing sewing piece ${endpoint.pieceId}`)
    assert.ok(endpoint.edgeIndex >= 0 && endpoint.edgeIndex < piece.points.length)
    assert.ok(endpoint.startT >= 0 && endpoint.endT <= 1 && endpoint.startT < endpoint.endT)
    const length = edgeRangeLength(piece, endpoint.edgeIndex, endpoint.startT, endpoint.endT)
    assert.ok(length > 1e-8)
    sum[index] += length
    const key = `${endpoint.pieceId}:${endpoint.edgeIndex}`
    const ranges = coverage.get(key) || []
    ranges.push({ from: endpoint.startT, to: endpoint.endT, group: seam.sourceCloSeamGroup })
    coverage.set(key, ranges)
  }
  lengthsByGroup.set(seam.sourceCloSeamGroup, sum)
}

let maxArcLoss = 0
for (const row of report.groupReports) {
  const groupNumber = Number(row.sourceGroup.split('-').at(-1)) - 1
  const lengths = lengthsByGroup.get(groupNumber)
  assert.ok(lengths)
  maxArcLoss = Math.max(maxArcLoss,
    Math.abs(lengths[0] - row.traceLengthAcm),
    Math.abs(lengths[1] - row.traceLengthBcm))
}
assert.ok(maxArcLoss < 0.05, 'Stitch subdivision lost source arclength')

let conflictingRanges = 0
for (const ranges of coverage.values()) {
  ranges.sort((a, b) => a.from - b.from)
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length && ranges[j].from < ranges[i].to; j++) {
      if (ranges[i].group !== ranges[j].group
          && Math.min(ranges[i].to, ranges[j].to) - Math.max(ranges[i].from, ranges[j].from) > 0.001) {
        conflictingRanges++
      }
    }
  }
}
assert.equal(conflictingRanges, 0, 'Conflicting sewing assignments on shared cutline intervals')

console.log(JSON.stringify({ pass: true,
  source: 'CLO 7 male T-shirt actual ASTM DXF + OBJ/XML',
  source2DCutContours: 7,
  sourceSewingGroups: 23,
  sourceStitchPointPairs: 182,
  candidatePartialEdgeSeams: candidate.seams.length,
  duplicateSourceCutlineVerticesRemovedInCandidate: Object.values(report.duplicateCutlineVerticesRemovedForExperiment).reduce((a,b) => a+b, 0),
  conflictingSewingRanges: conflictingRanges,
  maximumSourceArcLossCm: +maxArcLoss.toFixed(5),
  necklineGroupsNeedingReview: map.counts.groupsWithSampledLengthMismatchOver5Percent,
  physicalDrapeValidated: false,
}, null, 2))
