/**
 * Turn a manual 3D staging translation into a small, safe *rigid* hint on the
 * canonical body-fitted solver pose. The input is recorded separately from
 * template staging offsets, which may intentionally start far from the body.
 *
 * The correction neither resizes the pattern nor changes seam rest lengths.
 * Large mistakes are automatically discarded instead of driving a loose-edge
 * sewing solve through the avatar. This is only a staging stabilizer; it is
 * not a penetration-free nonlinear cloth contact solver.
 */
export function constrainAutoFitPlacement(arrangement = {}, options = {}) {
  const limits = {
    x: Number.isFinite(options.maxX) ? Math.max(0, options.maxX) : 0.024,
    y: Number.isFinite(options.maxY) ? Math.max(0, options.maxY) : 0.016,
    z: Number.isFinite(options.maxZ) ? Math.max(0, options.maxZ) : 0.016,
  }
  const maxMagnitude = Number.isFinite(options.maxMagnitude)
    ? Math.max(0, options.maxMagnitude)
    : 0.027
  const requested = {}
  const applied = {}
  for (const axis of ['x', 'y', 'z']) {
    const key = `userPlacementDelta${axis.toUpperCase()}`
    const value = Number(arrangement[key])
    requested[axis] = Number.isFinite(value) ? Math.max(-2, Math.min(2, value)) : 0
    applied[axis] = Math.max(-limits[axis], Math.min(limits[axis], requested[axis]))
  }
  const magnitude = Math.hypot(applied.x, applied.y, applied.z)
  if (magnitude > maxMagnitude && magnitude > 1e-12) {
    for (const axis of ['x', 'y', 'z']) applied[axis] *= maxMagnitude / magnitude
  }
  return {
    requested,
    applied,
    requestedMagnitudeM: Math.hypot(requested.x, requested.y, requested.z),
    appliedMagnitudeM: Math.hypot(applied.x, applied.y, applied.z),
    correctedMagnitudeM: Math.hypot(requested.x - applied.x, requested.y - applied.y, requested.z - applied.z),
  }
}

export function applyAutoFitPlacement(simPiece, arrangement = {}, options = {}) {
  const result = constrainAutoFitPlacement(arrangement, options)
  if (!simPiece?.particles?.length || result.appliedMagnitudeM <= 1e-12) return result
  // Preserve every pairwise vertex distance: translation is rigid and the
  // subsequent cloth deformation is governed solely by the physical solver.
  for (const particle of simPiece.particles) {
    particle.position.x += result.applied.x
    particle.position.y += result.applied.y
    particle.position.z += result.applied.z
    particle.previous.copy(particle.position)
  }
  return result
}
