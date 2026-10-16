import assert from 'node:assert/strict'
import fs from 'node:fs'
import { validatePpfPayload } from '../src/core/backends/ppfPayload.js'
import { decodePpfAssemblyPreview } from '../ppf_backend/previewFrames.mjs'
import { evaluatePpfAssembly } from '../ppf_backend/assemblyAcceptance.mjs'

const base='blender_bridge/output/rigid-postalign-20261013/'
const previous=JSON.parse(fs.readFileSync('blender_bridge/output/sleeve-refine-20261013/shoulder-fold-pose.json','utf8'))
const updated=JSON.parse(fs.readFileSync(base+'pose-final.json','utf8'))
const details=JSON.parse(fs.readFileSync(base+'report-final.json','utf8'))
const contact=JSON.parse(fs.readFileSync(base+'contact-report.json','utf8'))
const normals=JSON.parse(fs.readFileSync(base+'signed-report.json','utf8'))
assert.equal(validatePpfPayload(updated).ok,true)
assert.equal(updated.avatar.mode,'local-thomas-body-mesh')
assert.deepEqual(updated.shell.stitchEdges,previous.shell.stitchEdges)
assert.deepEqual(updated.shell.faces,previous.shell.faces)
assert.deepEqual(updated.shell.pieces,previous.shell.pieces)
assert.ok(details.acceptedMoves>0)
assert.ok(details.outputMeanGapCm<details.inputMeanGapCm)
assert.ok(details.outputMaximumGapCm<details.inputMaximumGapCm)
assert.ok(details.maximumIntrinsicEdgeChange<=.05)
assert.equal(details.bodyIntersectionPairs,0)
assert.equal(details.selfIntersectionPairs,0)
assert.equal(details.signedSkinClear,true)
assert.equal(normals.nontriviallyNegativeVertices,0)
assert.equal(contact.allFramesAvatarIntersectionFree,true)
assert.equal(contact.allFramesSelfIntersectionFree,true)
assert.equal(updated.shell.vertices.length,976)
assert.equal(updated.shell.faces.length,1632)
assert.equal(updated.shell.stitchEdges.length,98)
assert.equal(decodePpfAssemblyPreview(updated,{jobId:'independent-postalign-test'}).accepted,false)
const verdict=evaluatePpfAssembly(updated,{deformation:{
  maximumRelativeIntrinsicEdgeChange:details.maximumIntrinsicEdgeChange,
  geometryPreservedOrWithinLimit:true,
  bodyAndSelfIntersectionFreeAtInitialPose:true,
  bodyIntersectionPairs:details.bodyIntersectionPairs,
  selfIntersectionPairs:details.selfIntersectionPairs,
}})
assert.equal(verdict.deformationValid,true)
assert.equal(verdict.mayRun,false,'Still-separated sewn panels must not pass final PPF preassembly gate')
assert.ok(verdict.maximumInitialSeamGapCm>3)
console.log(JSON.stringify({
  pass:true,
  previousMeanSeamGapCm:details.inputMeanGapCm,
  newMeanSeamGapCm:details.outputMeanGapCm,
  previousMaximumSeamGapCm:details.inputMaximumGapCm,
  newMaximumSeamGapCm:details.outputMaximumGapCm,
  patternEdgeChangePct:details.maximumIntrinsicEdgeChange*100,
  bodyContactPass:contact.allFramesAvatarIntersectionFree,
  garmentContactPass:contact.allFramesSelfIntersectionFree,
  initialSkinNormalPass:normals.nontriviallyNegativeVertices===0,
  certifiedFit:false,
}))
