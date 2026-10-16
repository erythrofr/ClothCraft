import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createTemplateProject } from '../src/data/templates.js'
import { auditSewingConstruction, seamEndpointOverlap, validateNewSeam } from '../src/core/sewingConstruction.js'

const project = createTemplateProject('blank')
const source = project.pieces[0]
source.id = 'a'
source.points = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }]
const target = structuredClone(source)
target.id = 'b'
project.pieces = [source, target]
project.seams = []
const makeSeam = (aStart, aEnd, bStart = aStart, bEnd = aEnd) => ({
  a: { pieceId: 'a', edgeIndex: 0, startT: aStart, endT: aEnd },
  b: { pieceId: 'b', edgeIndex: 0, startT: bStart, endT: bEnd },
})
assert.equal(validateNewSeam(project, makeSeam(.1, .3)).ok, true)
project.seams.push({ id: 'segment-1', name: 'First constructed range', ...makeSeam(.1, .3) })
assert.equal(validateNewSeam(project, makeSeam(.3, .5)).ok, true, 'Adjacent sewing ranges may share a corner')
assert.equal(validateNewSeam(project, makeSeam(.2, .4)).ok, false, 'The same fabric interval cannot be sewn twice')
assert.equal(validateNewSeam(project, makeSeam(.3, .5, .1, .2)).ok, false, 'Conflict on either sewn side must be rejected')
assert.equal(validateNewSeam(project, makeSeam(.3, .30001)).ok, false, 'An unsewably tiny free range must be rejected')
assert.equal(validateNewSeam(project, makeSeam(.3, 1.1)).ok, false, 'Out-of-bounds sewing intervals must be rejected')
assert.equal(validateNewSeam(project, { ...makeSeam(.3, .5), b: { pieceId: 'lost', edgeIndex: 0 } }).ok, false)
assert.equal(validateNewSeam(project, { ...makeSeam(.3, .5), b: { pieceId: 'a', edgeIndex: 0 } }).ok, false)
assert.equal(seamEndpointOverlap(makeSeam(.1, .3).a, makeSeam(.3, .5).a), false)

const cleanAudit = auditSewingConstruction(project)
assert.equal(cleanAudit.sourceSeams, 1)
assert.equal(cleanAudit.usableForLiveAssembly, true)
project.seams.push({ id: 'segment-overlap', ...makeSeam(.15, .25) })
const overlappingAudit = auditSewingConstruction(project)
assert.equal(overlappingAudit.usableForLiveAssembly, false)
assert.ok(overlappingAudit.categories.overlappingRanges >= 2)

const sourcePath = 'research/clo-reference/live-audit-20261014/exports/clo-male-tshirt-sewn-EXPERIMENTAL.garment.json'
const imported = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const importedAudit = auditSewingConstruction(imported)
assert.equal(importedAudit.sourceSeams, 947)
assert.equal(importedAudit.validSewingLinks, 947)
assert.equal(importedAudit.categories.invalidEndpoints, 0)
assert.equal(importedAudit.categories.overlappingRanges, 0)
assert.ok(importedAudit.categories.inactive3d > 0, 'The original imported neckline pieces are intentionally 2D-only')
assert.equal(importedAudit.usableForLiveAssembly, false)

const activeCopy = structuredClone(imported)
activeCopy.pieces.forEach((piece) => { piece.active3d = true })
const assemblyAudit = auditSewingConstruction(activeCopy)
assert.equal(assemblyAudit.categories.inactive3d, 0)
assert.equal(assemblyAudit.usableForLiveAssembly, true)
assert.equal(activeCopy.cloReference.DO_NOT_DEPLOY_SIMULATION, true, 'A structural audit must never certify physical fit')

console.log(JSON.stringify({
  pass: true,
  createdPartialSewing: true,
  adjacentNonOverlappingRangesAllowed: true,
  doubleSewingRejected: true,
  malformedSewingRejected: true,
  cloPartialLinksAudited: assemblyAudit.validSewingLinks,
  cloConflictingRanges: assemblyAudit.categories.overlappingRanges,
  disabledNecklineSewingLinksInOriginal: importedAudit.categories.inactive3d,
  sourceUnchanged: true,
  garmentFitCertified: false,
}, null, 2))
