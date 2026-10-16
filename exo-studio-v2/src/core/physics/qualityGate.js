// Explicitly separate solver telemetry from garment approval. A finite
// simulation and small mean seam gap do not establish penetration-free fit.
export function assessSimulationFit(quality = {}, options = {}) {
  const limits = {
    maximumStructuralStrainPercent: Number(options.maximumStructuralStrainPercent ?? 15),
    maximumSeamGapMm: Number(options.maximumSeamGapMm ?? 5),
    maximumPenetrationMm: Number(options.maximumPenetrationMm ?? 0.5),
  }
  const failures = []
  const unknown = []
  const strain = Number(quality.structural?.maxStrainPercent)
  const seam = Number(quality.sewing?.maxGapMm)
  const collision = quality.collision || {}
  if (!Number.isFinite(strain)) unknown.push('structural-strain-not-measured')
  else if (strain > limits.maximumStructuralStrainPercent) failures.push('excessive-structural-strain')
  if (!Number.isFinite(seam)) unknown.push('seam-gap-not-measured')
  else if (seam > limits.maximumSeamGapMm) failures.push('open-sewing-seams')
  if (collision.triangleCcdVerified !== true || collision.allFrameIntersectionFree !== true) {
    unknown.push('triangle-ccd-and-entire-trajectory-not-certified')
  }
  const intrusion = collision.maximumIntrusionMm
  if (intrusion == null || !Number.isFinite(Number(intrusion))) unknown.push('avatar-intrusion-not-measured')
  else if (Number(intrusion) > limits.maximumPenetrationMm) failures.push('avatar-surface-penetration')
  return {
    status: failures.length ? 'FAILED' : unknown.length ? 'UNVERIFIED' : 'MEASURED_PASS',
    factoryApproved: false, // requires physical fit/sample/quality inspection.
    failures,
    unknown,
    limits,
  }
}
