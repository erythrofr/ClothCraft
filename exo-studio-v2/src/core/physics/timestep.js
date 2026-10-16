// Pure solver scheduling. Reject non-finite inputs before they can write NaN
// into every particle and corrupt a live garment document's fitting pose.
export function resolveSolverTimestep(settings = {}, dt = 1 / 60, maxThickness = 0.002) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError(`Invalid simulation dt: ${dt}`)
  if (dt === 0) return null // A paused/no-op frame cannot advance the solver.
  if (!Number.isFinite(maxThickness) || maxThickness < 0) throw new RangeError(`Invalid maximum cloth thickness: ${maxThickness}`)
  const safeDt = Math.min(dt, 1 / 30)
  const gravity = settings.gravity ?? 9.81
  if (!Number.isFinite(gravity) || gravity < 0) throw new RangeError(`Invalid simulation gravity: ${gravity}`)
  const substeps = Math.max(1, Math.min(4, Math.round(settings.substeps || 1)))
  const subDt = safeDt / substeps
  const gravityStep = gravity * subDt * subDt
  const requestedIterations = Math.max(2, Math.min(14, settings.iterations || 7))
  const iterations = Math.max(2, Math.ceil(requestedIterations / substeps))
  const selfCollisionMargin = settings.selfCollisionMargin ?? 0.002
  if (!Number.isFinite(selfCollisionMargin) || selfCollisionMargin < 0) throw new RangeError(`Invalid self-collision margin: ${selfCollisionMargin}`)
  const selfCollisionDistance = Math.max(0.004, maxThickness * 2 + selfCollisionMargin)
  return { safeDt, gravity, substeps, subDt, gravityStep, requestedIterations, iterations, selfCollisionDistance }
}
