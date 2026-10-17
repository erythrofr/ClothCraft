// Keep the geometry/order-of-magnitude evidence distinct from the actual
// contact-depth and swept-CCD certification metrics.
import assert from 'node:assert/strict'
import fs from 'node:fs'

const report = JSON.parse(fs.readFileSync('logs/ppf-pin-chord-vs-exact-frame90-20261014.json', 'utf8'))
assert.equal(report.schema, 'garment-studio.ppf-pin-frame-chord-audit.v1')
assert.equal(report.fullPhysicalFitVerified, false)
for (const policy of ['linear', 'smooth']) {
  const result = report.results[policy]
  assert.equal(result.frame, 90)
  assert.equal(result.timeSeconds, 1.5)
  assert.ok(result.outputFractionWithinBracket > .4 && result.outputFractionWithinBracket < .7)
  assert.ok(result.allPinnedBodyChordMismatch.maxMm > 0)
  assert.ok(result.intersectingBodyVertexChordMismatch.medianMm > 0)
}
assert.ok(report.results.smooth.allPinnedBodyChordMismatch.maxMm <
          report.results.linear.allPinnedBodyChordMismatch.maxMm)
assert.ok(report.results.smooth.intersectingBodyVertexChordMismatch.medianMm <
          report.results.linear.intersectingBodyVertexChordMismatch.medianMm)

console.log(JSON.stringify({
  pass: true,
  metric: 'Exact-time body pin versus linearly interpolated body chord',
  frame90LinearContactRegionMismatchMedianMm: report.results.linear.intersectingBodyVertexChordMismatch.medianMm,
  frame90SmoothContactRegionMismatchMedianMm: report.results.smooth.intersectingBodyVertexChordMismatch.medianMm,
  physicalFitAccepted: false,
  warning: 'Chord mismatch is not penetration depth and does not prove sole collision cause',
}))
