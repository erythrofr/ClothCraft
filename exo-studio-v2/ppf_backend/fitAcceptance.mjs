// Pure acceptance gate shared by the PPF service and offline regression QA.
// In particular, a collision-free snapshot is *not* enough to certify a
// trajectory on the real Thomas mesh: IPC swept CCD must pass as well.
export function evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd = false, ipcCcd = null,
  requiresShoulderFit = false, clearance = null }) {
  // An allFrames... boolean without evidence for every exported frame must
  // never be enough to declare that an actual garment fits. We also require
  // independent sewing reports to cover the exact same native PC2 frames.
  const frames = Number(contact?.frames)
  const completeTrajectoryEvidence = Number.isInteger(frames) && frames >= 2 &&
    Array.isArray(contact?.perFrame) && contact.perFrame.length === frames &&
    contact.perFrame.every((item, i) => item?.frame === i &&
      Number.isFinite(item.avatarTriangleIntersectionPairs) &&
      Number.isFinite(item.clothSelfIntersectionPairs) &&
      Number.isFinite(item.maxPrincipalStretch) &&
      Number.isFinite(item.strainLimitViolatingFaces)) &&
    sewing?.framesAnalyzed === frames && Number.isInteger(sewing?.stitchedPairs) && sewing.stitchedPairs > 0 &&
    Array.isArray(sewing?.samples) && sewing.samples.length === frames &&
    sewing.samples.every((item, i) => item?.frame === i &&
      Number.isFinite(item.meanCm) && Number.isFinite(item.maxCm)) &&
    Math.abs(sewing.samples[frames - 1].meanCm - sewing.finalMeanGapCm) <= 0.001 &&
    Math.abs(sewing.samples[frames - 1].maxCm - sewing.finalMaxGapCm) <= 0.001
  const collisionPass = contact?.allFramesAvatarIntersectionFree === true &&
    contact?.allFramesSelfIntersectionFree === true &&
    Array.isArray(contact.perFrame) && contact.perFrame.every(item =>
      item.avatarTriangleIntersectionPairs === 0 && item.clothSelfIntersectionPairs === 0)
  const strainPass = contact?.allFramesWithinStrainLimit === true &&
    Array.isArray(contact.perFrame) && contact.perFrame.every(item => item.strainLimitViolatingFaces === 0)
  const seamPass = Number.isFinite(sewing?.finalMeanGapCm) &&
    Number.isFinite(sewing?.finalMaxGapCm) &&
    sewing.finalMeanGapCm <= 0.2 && sewing.finalMaxGapCm <= 1.0
  const ipcCcdPass = !requiresIpcCcd || (
    ipcCcd?.allTestedStepsCollisionFree === true &&
    Number(contact?.frames) >= 2 &&
    ipcCcd.framesAudited === contact.frames &&
    ipcCcd.steps?.length === contact.frames - 1 &&
    ipcCcd.steps.every((step, i) => step?.fromFrame === i &&
      step?.toFrame === i + 1 && step?.collisionFree === true)
  )
  // Initial engineering thresholds, not a certified CLO comparison. A shirt
  // can be intersection-free yet hover away from shoulders or torso.
  const shoulderFitPass = !requiresShoulderFit || (
    Number.isFinite(clearance?.final?.shoulder?.meanCm) &&
    Number.isFinite(clearance?.final?.shoulder?.p90Cm) &&
    Number.isFinite(clearance?.final?.torso?.meanCm) &&
    clearance.final.shoulder.meanCm <= 1.5 &&
    clearance.final.shoulder.p90Cm <= 3 &&
    clearance.final.torso.meanCm <= 2 &&
    Number(clearance?.framesMeasured) === Number(contact?.frames) &&
    clearance.final.frame === frames - 1
  )
  return {
    accepted: completeTrajectoryEvidence && collisionPass && strainPass && seamPass && ipcCcdPass && shoulderFitPass,
    completeTrajectoryEvidence, collisionPass, strainPass, seamPass, ipcCcdPass, shoulderFitPass,
    seamMeanGapLimitCm: 0.2, seamMaxGapLimitCm: 1.0,
    shoulderMeanClearanceLimitCm: 1.5,
    shoulderP90ClearanceLimitCm: 3.0,
    torsoMeanClearanceLimitCm: 2.0,
  }
}
