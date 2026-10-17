import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { analyzePpfStagingSeams } from '../ppf_backend/stagingDiagnostics.mjs'

const root = path.resolve('research/clo-reference/live-audit-20261014/exports')
const observed = JSON.parse(fs.readFileSync(path.join(root, 'clo-reference-sewing-metrics.json'), 'utf8'))
const ppf = JSON.parse(fs.readFileSync('blender_bridge/output/rigid-postalign-20261013/pose-final.json', 'utf8'))
assert.equal(observed.schema, 'garment-studio.clo-observed-assembly.v1')
assert.equal(observed.vertexCount, 3661)
assert.equal(observed.patternGroupCount, 7)
assert.equal(observed.sewingPairCount, 23)
assert.equal(observed.correspondenceCount, 182)
assert.equal(observed.referencePoseOnly, true)
assert.equal(observed.notAnAcceptedFittedGarment, true)
assert.ok(observed.meanCurrentGapCm > 3, 'Open CLO example is not a physical close-sewn reference')
assert.ok(observed.maximumCurrentGapCm > 3)
assert.ok(observed.seamPairs.every(pair => pair.sourcePointIndices.length === 2 &&
  pair.sourcePointIndices.every(points => points.length === pair.correspondenceCount)))
const ppfMetrics = analyzePpfStagingSeams(ppf)
assert.equal(ppf.shell.pieces.length, 4)
assert.equal(ppf.shell.stitchEdges.length, 98)
assert.equal(ppfMetrics.nearAssembled, false)
assert.ok(ppfMetrics.maximumInitialSeamGapCm > 3)

// A reference shirt may have different pattern counts and avatar proportions.
// The correct transferable signal is which regions belong around each body
// landmark, NOT positional copying or equal-count stitch adjacency.
const roleMap = {
  front: '37',
  back: '7',
  'sleeve-left': '39',
  'sleeve-right': '36',
  collar: ['Pattern2D_768516', 'Pattern2D_768527', 'Pattern2D_768528'],
}
const cloGroups = new Set(observed.patterns.map(p => p.id))
assert.ok(Object.values(roleMap).flat().every(name => cloGroups.has(name)))
const report = {
  reference: 'CLO7 Male_T-shirt.zpac OBJ+XML unwelded export',
  observed: {
    patterns: observed.patternGroupCount,
    seamGroups: observed.sewingPairCount,
    sampledCorrespondences: observed.correspondenceCount,
    seamGapMeanCm: observed.meanCurrentGapCm,
    seamGapMaxCm: observed.maximumCurrentGapCm,
    note: 'This CLO pose is arranged for sewing, NOT physically accepted or fully closed; its gaps are not a target for PPF.',
  },
  target: {
    name: ppf.project?.name,
    patterns: ppf.shell.pieces.length,
    seamPairs: ppf.shell.stitchEdges.length,
    meanGapCm: Number((ppf.shell.stitchEdges.reduce((sum, edge) => {
      const a = ppf.shell.vertices[edge.a], b = ppf.shell.vertices[edge.b]
      return sum + 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    }, 0) / ppf.shell.stitchEdges.length).toFixed(3)),
    maximumGapCm: ppfMetrics.maximumInitialSeamGapCm,
    worstGroups: ppfMetrics.worstSeams,
    readyForPpf: ppfMetrics.nearAssembled,
  },
  bodyRelativeRoleMap: roleMap,
  requiredCorrections: [
    'Wrap both torso panels in a continuous body-relative coordinate frame so left/right side edges converge without skin crossing',
    'Fold shoulder zones toward their matching front/back seam partners while preserving pattern mesh rest-edge lengths',
    'Align sleeve local frames with upper arm and cap arcs, rather than shifting flat sleeves around the torso',
    'Retain source seam IDs, allow independent collar pieces, verify every PPF stitch gap ≤3 cm and all initial body/self contact checks',
  ],
  claim: 'Comparison audit only; no correct T-shirt fit has yet been produced',
}
const output = path.join(root, 'comparison-to-garment-studio-ppf.json')
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
