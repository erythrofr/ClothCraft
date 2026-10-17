import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {analyzePpfStagingSeams} from '../ppf_backend/stagingDiagnostics.mjs'
import {evaluatePpfAssembly} from '../ppf_backend/assemblyAcceptance.mjs'

const base=JSON.parse(readFileSync('blender_bridge/output/ppf-native-contact-ab/pinned-long.json'))
const updated=JSON.parse(readFileSync('blender_bridge/output/assembly-validation-20261013/staged.json'))
const report=JSON.parse(readFileSync('blender_bridge/output/assembly-validation-20261013/assembly.json'))
const before=analyzePpfStagingSeams(base)
const after=analyzePpfStagingSeams(updated)
assert.equal(report.bodyAndSelfIntersectionFreeAtInitialPose,true)
assert.equal(report.fabricRestGeometryPreserved,true)
assert.ok(report.afterMeanGapCm<report.beforeMeanGapCm)
assert.ok(after.maximumInitialSeamGapCm<=before.maximumInitialSeamGapCm)
assert.deepEqual(updated.shell.faces,base.shell.faces)
assert.deepEqual(updated.shell.stitchEdges,base.shell.stitchEdges)
for(const piece of base.shell.pieces){
  const ids=piece.particleIndices
  for(let i=1;i<ids.length;i++){
    const a=base.shell.vertices[ids[0]], b=base.shell.vertices[ids[i]]
    const c=updated.shell.vertices[ids[0]], d=updated.shell.vertices[ids[i]]
    const oldDist=Math.hypot(...a.map((x,j)=>x-b[j]))
    const newDist=Math.hypot(...c.map((x,j)=>x-d[j]))
    assert.ok(Math.abs(oldDist-newDist)<1e-6,'Pattern rest-geometry changed')
  }
}
assert.equal(evaluatePpfAssembly(updated).accepted,false,'Do not promote unassembled cloth')
console.log(JSON.stringify({pass:true,meanGapBeforeCm:report.beforeMeanGapCm,meanGapAfterCm:report.afterMeanGapCm,maximumGapCm:report.afterMaximumGapCm,nearAssembled:false}))
