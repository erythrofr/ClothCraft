// Confirm the exact saved two-run experiment without mislabeling its four
// remaining intersections as a collision-safe garment fitting result.
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'))
const originalRun = read('logs/ppf-upstream-fitting-full-20261014.json')
const originalAudit = read('logs/ppf-upstream-full-audit-20261014.json')
const experiment = read('logs/ppf-upstream-smooth96-20261014.json')
const audit = read('logs/ppf-upstream-smooth96-ab-audit-20261014.json')
const independent = read('logs/ppf-upstream-smooth96-independent-crossings-20261014.json')

assert.equal(originalRun.ok, true)
assert.equal(originalAudit.completeNativeTrajectory, true)
assert.equal(experiment.policy, 'smooth')
assert.equal(experiment.framesRequested, 96)
assert.equal(experiment.inputSha256.dress,
  originalRun.assetSha256['Projects/FEMShell/input/dress_knife/stage.obj'])
assert.equal(experiment.inputSha256.body0,
  originalRun.assetSha256['Projects/FEMShell/input/Rumba_Dancing/shell0.obj'])
assert.equal(experiment.inputSha256.notebook, originalRun.notebookSha256)
assert.equal(experiment.originalRandomSeed, 0)
assert.equal(experiment.pinMoveOperations, 120)

assert.equal(audit.schema, 'garment-studio.ppf-pin-policy-ab-audit.v1')
assert.equal(audit.policy, 'smooth')
assert.equal(audit.nativeCompletionMarkerValid, true)
assert.equal(audit.nativeSolverFinishedInLog, true)
assert.equal(audit.nativeSolverErrorLogEmpty, true)
assert.equal(audit.completeTrajectory, true, 'Native 0..96 output and finish marker must be complete')
assert.equal(audit.wrapperCompletionDisagreement, true,
  'Preserve wrapper timeout provenance; do not silently rewrite an original report')
assert.equal(audit.framesAudited, 97)
assert.equal(audit.lastFrame, 96)
assert.equal(audit.fullPhysicalFitVerified, false)
assert.equal(audit.allObservedContactFree, false)
assert.deepEqual(audit.perFrame.map(f => f.frame), Array.from({length: 97}, (_, i) => i))

const near = [87, 90].map(i => ({
  frame: i,
  linear: originalAudit.perFrame[i].bodyCrossings,
  smooth: audit.perFrame[i].bodyCrossings,
}))
assert.deepEqual(near, [{frame:87,linear:2,smooth:0}, {frame:90,linear:492,smooth:4}])
assert.equal(audit.perFrame[90].uniqueInvolvedClothFaces, 1)
assert.equal(audit.perFrame[90].uniqueInvolvedBodyFaces, 4)
assert.deepEqual(independent.frames.map(f => f.frame), [0, 89, 90, 96])
for (const frame of independent.frames) {
  assert.equal(frame.bvhPairs, frame.strictBodyCrossings)
  assert.equal(frame.strictBodyCrossings, frame.upstreamKernelPairs)
  assert.equal(frame.strictBodyCrossings, audit.perFrame[frame.frame].bodyCrossings)
}
assert.equal(independent.fullPhysicalFitVerified, false)

console.log(JSON.stringify({
  pass: true,
  experiment: 'Rust PPF 96-frame linear vs smooth pin-body interpolation',
  actualNativeOutputComplete: true,
  wrapperHadTimeoutRace: true,
  originalFrame87Crossings: 2,
  smoothFrame87Crossings: 0,
  originalFrame90Crossings: 492,
  smoothFrame90Crossings: 4,
  reductionAtFrame90Percent: +(100 * (1 - 4 / 492)).toFixed(3),
  independentStrictBlenderCrossingAgreement: true,
  physicallyAccepted: false,
  caution: 'Smooth interpolation reduces discrete crossings but does not eliminate them or certify full CCD, cloth fit, or frame 174',
}))
