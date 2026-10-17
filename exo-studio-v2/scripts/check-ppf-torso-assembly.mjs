import assert from 'node:assert/strict'
import fs from 'node:fs'
import { validatePpfPayload } from '../src/core/backends/ppfPayload.js'
import { decodePpfAssemblyPreview } from '../ppf_backend/previewFrames.mjs'
import { evaluatePpfAssembly } from '../ppf_backend/assemblyAcceptance.mjs'

const root = 'blender_bridge/output/sleeve-refine-20261013/'
const read = name => JSON.parse(fs.readFileSync(root + name, 'utf8'))
// All files are from the CURRENT tee template with the user's real Thomas
// local body, not an old exploded mockup. The source sewing graph is immutable.
const sleeve = read('current-tee-refined.json')
const torso = read('torso-bend-pose.json')
const shoulder = read('shoulder-fold-pose.json')
const bendReport = read('torso-bend-report.json')
const shoulderReport = read('shoulder-fold-report.json')
const sleeveReport = read('current-tee-refined-report.json')
for (const p of [torso, shoulder]) {
  assert.equal(validatePpfPayload(p).ok, true)
  assert.deepEqual(p.shell.faces, sleeve.shell.faces)
  assert.deepEqual(p.shell.stitchEdges, sleeve.shell.stitchEdges)
  assert.deepEqual(p.shell.facePieceIds, sleeve.shell.facePieceIds)
}
assert.equal(shoulder.avatar.mode, 'local-thomas-body-mesh')
assert.equal(bendReport.bodyIntersectionPairs, 0)
assert.equal(bendReport.selfIntersectionPairs, 0)
assert.equal(shoulderReport.bodyHits, 0)
assert.equal(shoulderReport.selfHits, 0)
assert.ok(bendReport.maxRelativeIntrinsicEdgeChange <= .05)
assert.ok(shoulderReport.maximumEdgeChange <= .05)
assert.ok(sleeveReport.maximumRelativeIntrinsicEdgeChange <= .05)
assert.ok(bendReport.afterMeanSeamGapCm < sleeveReport.afterMeanSeamGapCm)
assert.ok(shoulderReport.afterMeanCm < bendReport.afterMeanSeamGapCm)
assert.ok(shoulderReport.afterMaxCm < bendReport.afterMaxSeamGapCm)
const preview = decodePpfAssemblyPreview(shoulder, {jobId: 'fixture-current-tee'})
assert.equal(preview.stage, 'initial-assembly')
assert.equal(preview.format, 'garment-studio.ppf-preview.v1')
assert.equal(preview.accepted, false)
assert.equal(preview.experimental, true)
assert.equal(preview.frames, 1)
assert.equal(preview.frame, 0)
assert.equal(preview.pieces.length, 4)
assert.equal(preview.pieces.reduce((sum,p)=>sum+p.faces.length,0),shoulder.shell.faces.length)
assert.throws(()=>decodePpfAssemblyPreview({
  ...shoulder, shell:{...shoulder.shell,vertices:[[Infinity,0,0],...shoulder.shell.vertices.slice(1)]},
}))
const finalDeformation = {
  maximumRelativeIntrinsicEdgeChange: Math.max(
    sleeveReport.maximumRelativeIntrinsicEdgeChange,
    bendReport.maxRelativeIntrinsicEdgeChange,
    shoulderReport.maximumEdgeChange,
  ),
  geometryPreservedOrWithinLimit: true,
  bodyAndSelfIntersectionFreeAtInitialPose: true,
  bodyIntersectionPairs: 0,
  selfIntersectionPairs: 0,
}
const assembly = evaluatePpfAssembly(shoulder,{deformation:finalDeformation})
assert.equal(assembly.deformationValid,true)
assert.equal(assembly.mayRun,false,'A partially joined garment must never advance as production fit')
assert.ok(assembly.maximumInitialSeamGapCm > 3)
const signedBodyReport = fs.readFileSync(root+'signed-contact.log','utf8')
assert.ok(signedBodyReport.includes('PPF_SIGNED_NEAREST'))
const signedLine=signedBodyReport.split('\n').find(line=>line.startsWith('PPF_SIGNED_NEAREST '))
const signed=JSON.parse(signedLine.slice('PPF_SIGNED_NEAREST '.length))
for(const part of Object.values(signed)){
  assert.equal(part.negativeGreaterThan2mm,0,'Initial garment patch behind Thomas skin')
}
const blenderReport=read('shoulder-fold-contact.json')
assert.equal(blenderReport.allFramesAvatarIntersectionFree,true)
assert.equal(blenderReport.allFramesSelfIntersectionFree,true)
console.log(JSON.stringify({
  pass:true,realThomas:true,
  vertices:shoulder.shell.vertices.length,faces:shoulder.shell.faces.length,stitchedPairs:shoulder.shell.stitchEdges.length,
  startMeanCm:sleeveReport.beforeMeanSeamGapCm,
  sleeveMeanCm:sleeveReport.afterMeanSeamGapCm,
  torsoMeanCm:bendReport.afterMeanSeamGapCm,
  finalMeanCm:shoulderReport.afterMeanCm,
  maxSeamCm:shoulderReport.afterMaxCm,
  maxFabricEdgeChangePct:finalDeformation.maximumRelativeIntrinsicEdgeChange*100,
  fullSimulationCertified:false,
}))
