import assert from 'node:assert/strict'
import fs from 'node:fs'
import { validatePpfPayload } from '../src/core/backends/ppfPayload.js'
import { evaluatePpfAssembly } from '../ppf_backend/assemblyAcceptance.mjs'

// End-to-end fixture generated from the CURRENT Foundation Tee template with
// CLO Thomas selected, not a stale manually edited 2026-09 pattern snapshot.
const base='blender_bridge/output/sleeve-refine-20261013/'
const before=JSON.parse(fs.readFileSync(`${base}current-tee-staged.json`))
const after=JSON.parse(fs.readFileSync(`${base}current-tee-refined.json`))
const report=JSON.parse(fs.readFileSync(`${base}current-tee-refined-report.json`))
assert.equal(validatePpfPayload(after).ok,true)
assert.equal(after.avatar.mode,'local-thomas-body-mesh')
assert.equal(report.realBodyCollisionMesh,true)
assert.equal(report.bodyIntersectionPairs,0)
assert.equal(report.selfIntersectionPairs,0)
assert.ok(report.maximumRelativeIntrinsicEdgeChange<=0.05)
assert.ok(report.afterMeanSeamGapCm<report.beforeMeanSeamGapCm)
assert.ok(after.shell.vertices.length>before.shell.vertices.length)
assert.ok(after.shell.faces.length>before.shell.faces.length)
assert.equal(after.shell.vertices.length,976,'Only sleeves should be refined in the fast runtime pose')
assert.equal(after.shell.faces.length,1632,'Avoid costly, ineffective torso over-subdivision')
assert.deepEqual(after.shell.stitchEdges,before.shell.stitchEdges)
assert.equal(after.shell.facePieceIds.length,after.shell.faces.length)
for (const piece of after.shell.pieces) {
  assert.equal(after.shell.facePieceIds.slice(piece.faceStart,piece.faceStart+piece.faceCount).every(id=>id===piece.id),true)
  const set=new Set(piece.particleIndices)
  for (let k=piece.faceStart;k<piece.faceStart+piece.faceCount;k++) {
    for(const i of after.shell.faces[k]) assert.equal(set.has(i),true)
  }
}
for (const side of ['l','r']) {
  const seam=report.seamGroupsAfter[`seam-sleeve-${side}-underarm`]
  assert.ok(seam.maximumGapCm<1.5,`The ${side} underarm must begin within 1.5 cm`)
}
const gate=evaluatePpfAssembly(after,{deformation:report})
assert.equal(gate.deformationValid,true)
assert.equal(gate.mayRun,false,'Unjoined shoulder and torso must not reach production PPF')
const forgery={...report,maximumRelativeIntrinsicEdgeChange:0.08}
assert.equal(evaluatePpfAssembly(after,{deformation:forgery}).deformationValid,false)
console.log(JSON.stringify({pass:true,realThomas:true,vertices:after.shell.vertices.length,faces:after.shell.faces.length,
  meanGapBeforeCm:report.beforeMeanSeamGapCm,meanGapAfterCm:report.afterMeanSeamGapCm,
  underarmMaxCm:report.seamGroupsAfter['seam-sleeve-l-underarm'].maximumGapCm,
  maxEdgeChangePercent:100*report.maximumRelativeIntrinsicEdgeChange,fitCertified:false}))
