// Verify the important negative result: changing only the run duration cannot
// explain the divergence, because two independent 96-frame runs ALSO disagree
// while consuming byte-identical encoded solver inputs and parameter files.
import assert from 'node:assert/strict'
import fs from 'node:fs'

const load = path => JSON.parse(fs.readFileSync(path,'utf8'))
const repeatability=load('logs/ppf-smooth-multirun-repeatability-20261014.json')
const smooth96=load('logs/ppf-upstream-smooth96-ab-audit-20261014.json')
const repeated=load('logs/ppf-upstream-smooth96-repeat-ab-audit-20261014.json')
const long=load('logs/ppf-upstream-smooth180-ab-audit-20261014.json')

assert.equal(repeatability.schema,'garment-studio.ppf-native-repeatability.v1')
assert.equal(repeatability.fullPhysicalFitVerified,false)
assert.equal(repeatability.comparisons.length,2)
const same=repeatability.comparisons.find(c=>c.sameAdvertisedSolverParameters)
assert.ok(same,'Need true A/A control with identical solver params and horizon')
assert.deepEqual(same.solverParametersDifferent,{})
assert.equal(same.firstNonidenticalFrame,1)
assert.ok(same.peakClothDifferenceMm>10)
assert.ok(same.peakPinnedDifferenceMm>0)
assert.equal(same.lastComparedFrame,96)

for (const report of [smooth96,repeated,long]) {
  assert.equal(report.completeTrajectory,true)
  assert.equal(report.fullPhysicalFitVerified,false)
  assert.equal(report.allObservedContactFree,false)
  assert.ok(report.maxPrincipalStretch<=1.10001)
  assert.equal(report.maxFacesAbove10PercentStretch,0)
  assert.ok(report.finalMaxSeamGapCm<1)
}
assert.deepEqual(smooth96.perFrame.filter(x=>x.bodyCrossings>0).map(x=>[x.frame,x.bodyCrossings]),[[90,4]])
assert.deepEqual(repeated.perFrame.filter(x=>x.bodyCrossings>0).map(x=>[x.frame,x.bodyCrossings]),[[95,4]])
assert.deepEqual(long.perFrame.filter(x=>x.bodyCrossings>0).map(x=>[x.frame,x.bodyCrossings]),[[138,2]])
assert.equal(smooth96.perFrame[90].bodyCrossings,4)
assert.equal(repeated.perFrame[90].bodyCrossings,0)
assert.equal(long.perFrame[90].bodyCrossings,0)

console.log(JSON.stringify({
  pass:true,
  inputScenario:'Identical encoded PPF input across all smooth Metal runs',
  exactSolverParametersRepeat: 'two independent 96-frame runs',
  firstDifferentOutputFrame:same.firstNonidenticalFrame,
  maxClothDifferenceMm:same.peakClothDifferenceMm,
  independentFittedRunAccepted:false,
  collisionFrames:{first96:[90],repeat96:[95],long180:[138]},
  caution:'The source of run-to-run variation is not isolated; collision-free output and swept CCD remain unproven'
}))
