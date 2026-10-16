import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { evaluatePpfFitAcceptance } from '../ppf_backend/fitAcceptance.mjs'

// Audits a real saved solver run, not an imagined output or a synthetic
// acceptance fixture. Read-only: never runs a solver or touches a user project.
const folder = path.resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || 'blender_bridge/output/ppf-fit-tuning-20261013')
const data = name => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'))
const payload = data('tee-input.json')
const solver = data('solver-report.json')
const sewing = data('sewing-report.json')
const contact = data('contact-report.json')
const ipcCcd = data('ipc-ccd.json')
const clearance = data('clearance-report.json')
const nativeGeometry = data('native-geometry-audit.json')
const requiredPhases = ['connect', 'start_server', 'encode', 'build', 'run', 'fetch', 'saved']
const actualPhases = solver.phases || []
const simClaim = solver.ok === true && solver.device === 'GPU' && solver.backendType === 'mac_native' &&
  requiredPhases.every(phase => actualPhases.includes(phase)) && solver.pc2?.finite === true
assert.ok(simClaim, 'Evidence does not establish a completed native Metal PPF simulation')
const pc2Path = solver.pc2.path
const pc2 = fs.readFileSync(pc2Path)
assert.equal(pc2.toString('ascii', 0, 11), 'POINTCACHE2', 'Saved frames must be an actual PPF PC2 cache')
const vertexCount = pc2.readInt32LE(16)
const frameCount = pc2.readInt32LE(28)
assert.equal(vertexCount, payload.shell.vertices.length, 'Native solver vertices must map to source garment vertices')
assert.equal(vertexCount, solver.pc2.vertices)
assert.equal(frameCount, solver.pc2.samples)
assert.equal(pc2.length, 32 + vertexCount * frameCount * 12, 'Every frame must have complete 3D coordinates')
assert.ok(frameCount >= 2, 'A trajectory requires at least two frames')
assert.equal(frameCount, contact.frames)
assert.equal(frameCount, contact.perFrame.length)
assert.equal(frameCount, sewing.framesAnalyzed)
assert.equal(frameCount, nativeGeometry.frames.length)
assert.equal(frameCount, ipcCcd.framesAudited)
assert.equal(ipcCcd.steps.length, frameCount - 1)
assert.equal(frameCount, clearance.framesMeasured)
assert.equal(payload.shell.stitchEdges.length, sewing.stitchedPairs)
assert.ok(sewing.seamGroups >= 1)
for (let frame = 0; frame < frameCount; frame += 1) {
  const measured = nativeGeometry.frames[frame]
  const rendered = contact.perFrame[frame]
  assert.equal(measured.frame, frame)
  assert.equal(rendered.frame, frame)
  assert.equal(measured.nativeBodyCrossings, rendered.avatarTriangleIntersectionPairs,
    'Raw native solver output and Blender output disagree about body intersections')
  assert.ok(measured.cacheMaxErrorM <= 1e-6,
    'PC2 coordinate conversion/export does not preserve the raw solver result')
}
const fit = evaluatePpfFitAcceptance({
  contact, sewing, requiresIpcCcd: true, ipcCcd,
  requiresShoulderFit: true, clearance,
})
const report = {
  source: folder,
  actualPpfExecuted: true,
  solver: {device: solver.device, transport: solver.backendType, frames: frameCount,
    vertices: vertexCount, stitchedPairs: sewing.stitchedPairs, seamGroups: sewing.seamGroups},
  contact: {firstAvatarCrossingFrame: contact.firstAvatarCrossingFrame,
    maxAvatarIntersectionPairs: contact.maxAvatarIntersectionPairs,
    maxSelfIntersectionPairs: contact.maxSelfIntersectionPairs,
    rawSolverToExportCrossingsAgree: true},
  sewing: {initialMeanGapCm: sewing.initialMeanGapCm, finalMeanGapCm: sewing.finalMeanGapCm,
    finalMaxGapCm: sewing.finalMaxGapCm, closurePercent: sewing.closurePercent},
  material: {maxPrincipalStretch: contact.maxPrincipalStretch},
  fittedClearance: {shoulderMeanCm: clearance.final?.shoulder?.meanCm,
    shoulderP90Cm: clearance.final?.shoulder?.p90Cm, torsoMeanCm: clearance.final?.torso?.meanCm},
  trajectoryCcd: {firstBlockedFrame: ipcCcd.firstBlockedFrame,
    collisionFree: ipcCcd.allTestedStepsCollisionFree},
  fitQuality: fit.accepted ? 'PASS' : 'FAILED',
  fitGate: fit,
}
console.log(JSON.stringify(report, null, 2))
if (process.argv.includes('--expect-failed')) {
  assert.equal(fit.accepted, false, 'Historical rejected garment unexpectedly passed; review regression fixture')
  assert.ok(contact.maxAvatarIntersectionPairs > 0, 'Historical fixture should demonstrate real avatar crossings')
  assert.equal(ipcCcd.allTestedStepsCollisionFree, false)
  console.log('PASS: Real solver run remains correctly classified as an unacceptable garment fit')
} else if (!fit.accepted) {
  process.exitCode = 2
  console.error('PPF RAN, BUT THE GARMENT DID NOT PASS FIT ACCEPTANCE; DO NOT SHOW AS A FINISHED FIT')
}
