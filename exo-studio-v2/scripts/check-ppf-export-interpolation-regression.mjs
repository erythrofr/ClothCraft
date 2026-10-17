// Reproducible read-only regression of the original ZOZO reference and the
// experimentally smoothed-body run. This is a diagnostic, never an acceptance
// gate that turns a crossing into a permitted physical fit.
import assert from 'node:assert/strict'
import fs from 'node:fs'

const output = JSON.parse(fs.readFileSync('logs/ppf-output-interpolation-audit-20261014.json', 'utf8'))
const temporal = JSON.parse(fs.readFileSync('logs/ppf-interframe-linear-vs-smooth96-20261014.json', 'utf8'))
const original = JSON.parse(fs.readFileSync('logs/ppf-upstream-full-audit-20261014.json', 'utf8'))
const smoothed = JSON.parse(fs.readFileSync('logs/ppf-upstream-smooth96-ab-audit-20261014.json', 'utf8'))

assert.equal(output.schema, 'garment-studio.ppf-frame-interpolation-audit.v1')
assert.equal(output.fullPhysicalFitVerified, false)
assert.equal(temporal.schema, 'garment-studio.ppf-interframe-sampling.v1')
assert.equal(temporal.fullPhysicalFitVerified, false)
assert.equal(temporal.fractionsPerInterval, 8)
assert.deepEqual(Object.keys(temporal.experiments).sort(), ['linear', 'smooth'])

for (const policy of ['linear', 'smooth']) {
  const engine = output.sessions[policy]
  assert.equal(engine.outputFPS, 60)
  assert.ok(engine.loggedSolverSteps >= 500)
  assert.equal(engine.terminalIntersectionMessages, 0,
    'Native solver did not report any committed-step intersection')
  const a = engine.samples.find(item => item.frame === 90)
  assert.ok(a)
  assert.equal(a.isInterpolatedFreeCloth, true)
  assert.equal(a.bodyPosAtExactExportTime, true)
  assert.ok(a.exportInterpolationAlpha > .4 && a.exportInterpolationAlpha < .7,
    'Frame 90 is output between checked solver steps, not an exact committed state')
}

assert.equal(original.perFrame[90].bodyCrossings, 492)
assert.equal(smoothed.perFrame[90].bodyCrossings, 4)

for (const policy of ['linear', 'smooth']) {
  const experiment = temporal.experiments[policy]
  assert.ok(experiment.positiveOnlyBetweenSavedFrames > 0,
    'Interpolated subframe samples show crossings not visible in output-only QA')
  const frame92 = experiment.samples.filter(item => item.fromFrame === 92 &&
    item.toFrame === 93 && item.clothBodyIntersectionPairs > 0)
  assert.ok(frame92.some(item => !item.sampleIsSavedOutput))
  const savedEnds = experiment.samples.filter(item =>
    (item.estimatedTimeSeconds === 92 / 60 || item.estimatedTimeSeconds === 93 / 60) &&
    item.sampleIsSavedOutput)
  // Output-only classification of both endpoints was zero before this audit.
  assert.equal(original.perFrame[92].bodyCrossings, 0)
  assert.equal(original.perFrame[93].bodyCrossings, 0)
  assert.equal(smoothed.perFrame[92].bodyCrossings, 0)
  assert.equal(smoothed.perFrame[93].bodyCrossings, 0)
  assert.ok(savedEnds.every(item => item.clothBodyIntersectionPairs === 0))
}

const hidden = temporal.experiments.smooth.samples.filter(item =>
  item.fromFrame === 92 && item.toFrame === 93 && item.clothBodyIntersectionPairs > 0)
const peak = Math.max(...hidden.map(row => row.clothBodyIntersectionPairs))
assert.equal(peak, 11)

console.log(JSON.stringify({
  pass: true,
  solverCommittedStepGateReportedIntersection: false,
  originalFrame90Crossings: 492,
  smoothFrame90Crossings: 4,
  frame90OriginalOutputInterpolationAlpha: output.sessions.linear.samples.find(x => x.frame === 90).exportInterpolationAlpha,
  frame90SmoothOutputInterpolationAlpha: output.sessions.smooth.samples.find(x => x.frame === 90).exportInterpolationAlpha,
  smoothUnsavedFrame92to93SampleCrossingsPeak: peak,
  physicalFitAccepted: false,
  limitations: 'Linear interframe sampling is not swept CCD or the actual solver substep trajectory; output interpolation is a plausible cause, not proven alone',
}))
