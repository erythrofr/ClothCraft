// Regression guard for Jarvis's real upstream Rust/Metal reference trajectory.
// This is intentionally a *failed physical-fit* fixture, not a passed fit.
import assert from 'node:assert/strict'
import fs from 'node:fs'

const full = JSON.parse(fs.readFileSync('logs/ppf-upstream-full-audit-20261014.json', 'utf8'))
const focused = JSON.parse(fs.readFileSync('logs/ppf-upstream-motion-contact-localization-20261014.json', 'utf8'))
const captured = JSON.parse(fs.readFileSync('logs/ppf-upstream-fitting-full-20261014.json', 'utf8'))

assert.equal(captured.ok, true)
assert.equal(full.completeNativeTrajectory, true)
assert.equal(full.framesAudited, 241)
assert.equal(full.fullPhysicalFitVerified, false)
assert.equal(focused.schema, 'garment-studio.ppf-upstream-motion-contact-audit.v1')
assert.equal(focused.fullPhysicalFitVerified, false)
assert.equal(focused.run.sessionName, captured.sessionName)
assert.equal(focused.run.originalNotebookSha256, captured.notebookSha256)
assert.equal(focused.run.pinOperationCount, 120)
assert.equal(focused.run.clothTriangles, full.clothTriangles)
assert.equal(focused.run.bodyTriangles, full.bodyTriangles)
assert.equal(focused.run.pinVertices, 12811)

const actual = full.perFrame.filter(row => row.bodyCrossings > 0)
const localized = focused.collisionFramesInAnalyzedWindows
assert.deepEqual(localized.map(row => row.frame), actual.map(row => row.frame),
  'Contact localization windows must cover every actually failing frame')
for (let i = 0; i < actual.length; i++) {
  assert.equal(localized[i].pairCount, actual[i].bodyCrossings)
  const frame = focused.frameRows.find(row => row.frame === localized[i].frame)
  assert.ok(frame)
  assert.ok(frame.isPinKeyframeBoundary)
  assert.ok(frame.pinnedBodyVelocityJump?.p95PercentileAmongBoundaries > 0)
  assert.ok(frame.pinVertexTargetDeviationMm?.max < 1.5,
    'Pinned body is expected to arrive near the encoded target at the keyframe')
  assert.ok(frame.uniqueClothTriangles >= 1)
  assert.ok(frame.uniqueBodyTriangles >= 1)
  assert.equal(frame.allConnectedComponentPairCount,
    frame.clothBodyIntersectionPairs)
  assert.ok(frame.faceConnectedComponentCount >= frame.faceConnectedHotspots.length)
  assert.ok(frame.clothHitArea && frame.bodyHitArea)
  assert.ok(Math.abs(frame.elapsedSecondsSincePreviousFrame - 1 / 60) < 1e-7,
    'Expected fixed 60fps output timestamps')
}
assert.equal(focused.allCollisionsInRequestedWindowsOnPinKeyframes, true)
assert.deepEqual(actual.map(row => row.frame), [87, 90, 174])
assert.deepEqual(actual.map(row => row.bodyCrossings), [2, 492, 2])
assert.ok(full.finalMaxSeamGapCm < 1, 'Historic fit has closed seams but is not safe in time')
assert.equal(full.maxSelfCrossings, 0)
assert.equal(full.maxBodyCrossings, 492)

console.log(JSON.stringify({
  pass: true,
  physicalFitAccepted: false,
  frames: full.framesAudited,
  failingFrames: localized,
  verified: 'All known reference crossings reproduced and localized at pin keyframe times; no CCD or causal claim',
}))
