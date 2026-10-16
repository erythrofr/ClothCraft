import { analyzePpfStagingSeams } from './stagingDiagnostics.mjs'

// A zero-intersection exploded pattern is not a fitting-ready garment.
// This preflight is deliberately independent of the final PPF fit gate.
export function evaluatePpfAssembly(payload, { allowExplodedExperimental = false, deformation = null } = {}) {
  const seams = analyzePpfStagingSeams(payload)
  // Near seam endpoints alone cannot certify a warped pattern. A deformed
  // initial arrangement must also satisfy the explicit fabric distortion
  // bound before it is eligible for a native PPF job.
  const deformationValid = deformation == null || (
    deformation.geometryPreservedOrWithinLimit === true &&
    deformation.bodyAndSelfIntersectionFreeAtInitialPose === true &&
    Number.isFinite(Number(deformation.maximumRelativeIntrinsicEdgeChange)) &&
    Number(deformation.maximumRelativeIntrinsicEdgeChange) <= 0.05 &&
    Number(deformation.bodyIntersectionPairs) === 0 &&
    Number(deformation.selfIntersectionPairs) === 0
  )
  const accepted = seams.nearAssembled && deformationValid
  return {
    ...seams,
    deformationValid,
    accepted,
    experimentalOverride: !accepted && allowExplodedExperimental === true,
    mayRun: accepted || allowExplodedExperimental === true,
    reason: accepted ? null : !deformationValid
      ? 'Nonrigid arrangement failed fabric deformation or initial body/self collision validation.'
      : `Pattern pieces are not near-assembled: maximum stitch gap ${seams.maximumInitialSeamGapCm.toFixed(1)} cm (limit 3 cm).`,
  }
}
