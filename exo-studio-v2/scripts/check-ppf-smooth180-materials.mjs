// Contract/regression for the separate native Rust/Metal smooth-body run.
// It measures cloth stretching and sewn constraints as well as intersections;
// reduced penetration is not a contact-safe accepted fitting trajectory.
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = file => JSON.parse(fs.readFileSync(file,'utf8'))
const baseline = read('logs/ppf-upstream-full-audit-20261014.json')
const run = read('logs/ppf-upstream-smooth180-20261014.json')
const output = read('logs/ppf-upstream-smooth180-ab-audit-20261014.json')
const blender = read('logs/ppf-upstream-smooth180-independent-selected-20261014.json')

assert.equal(run.ok, true)
assert.equal(run.framesRequested,180)
assert.equal(run.pinMoveOperations,120)
assert.equal(output.completeTrajectory,true)
assert.equal(output.nativeSolverFinishedInLog,true)
assert.equal(output.framesAudited,181)
assert.equal(output.originalStitchConstraintCount,851)
assert.equal(output.maxFacesAbove10PercentStretch,0)
assert.ok(output.maxPrincipalStretch <=1.10001)
assert.ok(output.finalMeanSeamGapCm <=.2)
assert.ok(output.finalMaxSeamGapCm <=1)
assert.equal(output.fullPhysicalFitVerified,false)
assert.equal(output.allObservedContactFree,false)
assert.deepEqual(output.perFrame.filter(x=>x.bodyCrossings>0).map(x=>[x.frame,x.bodyCrossings]),[[138,2]])
assert.equal(output.perFrame[87].bodyCrossings,0)
assert.equal(output.perFrame[90].bodyCrossings,0)
assert.equal(output.perFrame[174].bodyCrossings,0)
assert.deepEqual(baseline.perFrame.filter(x=>x.bodyCrossings>0).map(x=>[x.frame,x.bodyCrossings]),
  [[87,2],[90,492],[174,2]])

assert.equal(blender.allMatched,true)
assert.equal(blender.physicalFitVerified,false)
for (const item of blender.frames) {
  assert.equal(item.independentStrictCrossings,item.rustCheckerCrossings)
  assert.equal(item.independentStrictCrossings,output.perFrame[item.frame].bodyCrossings)
}

console.log(JSON.stringify({pass:true,framesAudited:output.framesAudited,
  fitAccepted:false,finalMeanSeamGapCm:output.finalMeanSeamGapCm,
  finalMaxSeamGapCm:output.finalMaxSeamGapCm,
  maxPrincipalStretch:output.maxPrincipalStretch,
  strictCollisionFrames:[138],remainingStrictCollisionPairs:2,
  independentBlenderConfirmed:true,
  note:'Discrete frames, cloth strain and sewing constraints checked; swept CCD and all frames safe are NOT satisfied'}))
