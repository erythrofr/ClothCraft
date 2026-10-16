// Precision drafting operations in centimeters. These are independent of
// React, the renderer, simulation, and any private Seamly/CLO implementation.
const EPSILON = 1e-9

export function assertDraftCoordinate(value, label = 'coordinate') {
  const number = Number(value)
  if (value === '' || value == null || !Number.isFinite(number) || Math.abs(number) > 100000) {
    throw new Error(`${label} must be a finite length in centimeters`)
  }
  return number
}

export function pointFromPolar(anchor, lengthCm, angleDeg) {
  const length = assertDraftCoordinate(lengthCm, 'Length')
  const angle = assertDraftCoordinate(angleDeg, 'Angle')
  if (length < 0) throw new Error('Length must not be negative')
  const radians = angle * Math.PI / 180
  return {
    x: assertDraftCoordinate(anchor.x, 'Anchor X') + length * Math.cos(radians),
    y: assertDraftCoordinate(anchor.y, 'Anchor Y') + length * Math.sin(radians),
  }
}

export function polarFromPoints(anchor, point) {
  const dx = point.x - anchor.x
  const dy = point.y - anchor.y
  return { lengthCm: Math.hypot(dx, dy), angleDeg: Math.atan2(dy, dx) * 180 / Math.PI }
}

export function precisePointEdit(piece, pointIndex, { x, y, lengthCm, angleDeg, mode = 'absolute' }) {
  if (!piece || !Array.isArray(piece.points) || piece.points.length < 3) throw new Error('A closed pattern must contain at least three points')
  if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= piece.points.length) throw new Error('Invalid pattern point')
  if (piece.locked) throw new Error('Unlock the pattern before editing')
  const prior = piece.points[pointIndex]
  const anchor = piece.points[(pointIndex - 1 + piece.points.length) % piece.points.length]
  const next = mode === 'polar'
    ? pointFromPolar(anchor, lengthCm, angleDeg)
    : { x: assertDraftCoordinate(x, 'X'), y: assertDraftCoordinate(y, 'Y') }
  if (Math.hypot(next.x - anchor.x, next.y - anchor.y) < 0.001) throw new Error('Adjacent pattern points must be at least 0.001 cm apart')
  const following = piece.points[(pointIndex + 1) % piece.points.length]
  if (Math.hypot(next.x - following.x, next.y - following.y) < 0.001) throw new Error('Adjacent pattern points must be at least 0.001 cm apart')
  // All other point metadata (including grading and parametric IDs) survives.
  return { ...prior, ...next }
}

// Express the quadratic control handle either in local XY coordinates or in
// the edge's own chord coordinate system. The latter is useful when drafting
// smooth necklines/armholes to a numeric perpendicular depth; the control
// point is not itself a point on the curve.
export function curveChordCoordinates(a, control, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length < 0.001) throw new Error('Curve endpoints must be at least 0.001 cm apart')
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  return {
    alongCm: ((control.x - mx) * dx + (control.y - my) * dy) / length,
    depthCm: (-(control.x - mx) * dy + (control.y - my) * dx) / length,
  }
}

export function preciseCurveEdit(piece, edgeIndex, { cx, cy, alongCm, depthCm, mode = 'absolute' }) {
  if (!piece || !Array.isArray(piece.points) || piece.points.length < 3) throw new Error('A closed pattern must contain at least three points')
  if (!Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= piece.points.length) throw new Error('Invalid pattern edge')
  if (piece.locked) throw new Error('Unlock the pattern before editing')
  const a = piece.points[edgeIndex]
  const b = piece.points[(edgeIndex + 1) % piece.points.length]
  if (mode === 'absolute') return { cx: assertDraftCoordinate(cx, 'Handle X'), cy: assertDraftCoordinate(cy, 'Handle Y') }
  if (mode !== 'chord') throw new Error('Unknown curve coordinate system')
  const along = assertDraftCoordinate(alongCm, 'Along chord')
  const depth = assertDraftCoordinate(depthCm, 'Curve depth')
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length < 0.001) throw new Error('Curve endpoints must be at least 0.001 cm apart')
  return {
    cx: assertDraftCoordinate((a.x + b.x) / 2 + (along * dx - depth * dy) / length, 'Handle X'),
    cy: assertDraftCoordinate((a.y + b.y) / 2 + (along * dy + depth * dx) / length, 'Handle Y'),
  }
}

// Exact quadratic Bézier derivative at parameter t; the arc-length integral
// is evaluated with adaptive Simpson quadrature, not a fixed 16-chord
// approximation that changes sewing lengths under extreme curvature.
export function quadraticAt(a, control, b, t) {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * control.y + t * t * b.y }
}

export function quadraticDerivative(a, control, b, t) {
  return { x: 2 * ((1 - t) * (control.x - a.x) + t * (b.x - control.x)),
    y: 2 * ((1 - t) * (control.y - a.y) + t * (b.y - control.y)) }
}

export function quadraticArcLength(a, control, b, start = 0, end = 1, tolerance = 1e-7) {
  // Pattern vertices carry IDs, grading metadata and other non-coordinate
  // properties. Only validate the six geometric components, never the whole
  // vertex object, or precision reports fail on correctly annotated patterns.
  if (![a?.x, a?.y, control?.x, control?.y, b?.x, b?.y, start, end].every(Number.isFinite)) throw new Error('Non-finite Bézier curve')
  const begin = Math.max(0, Math.min(1, start))
  const finish = Math.max(0, Math.min(1, end))
  if (Math.abs(finish - begin) <= EPSILON) return 0
  const lo = Math.min(begin, finish), hi = Math.max(begin, finish)
  const speed = t => {
    const v = quadraticDerivative(a, control, b, t)
    return Math.hypot(v.x, v.y)
  }
  const simpson = (x, y, fx, fm, fy) => (y - x) * (fx + 4 * fm + fy) / 6
  const recurse = (x, y, fx, fm, fy, integral, error, depth) => {
    const center = (x + y) / 2
    const leftMid = (x + center) / 2
    const rightMid = (center + y) / 2
    const flm = speed(leftMid), frm = speed(rightMid)
    const left = simpson(x, center, fx, flm, fm)
    const right = simpson(center, y, fm, frm, fy)
    if (depth >= 20 || Math.abs(left + right - integral) <= error * 15) return left + right + (left + right - integral) / 15
    return recurse(x, center, fx, flm, fm, left, error / 2, depth + 1) +
      recurse(center, y, fm, frm, fy, right, error / 2, depth + 1)
  }
  const fx = speed(lo), fy = speed(hi), fm = speed((lo + hi) / 2)
  return recurse(lo, hi, fx, fm, fy, simpson(lo, hi, fx, fm, fy), Math.max(1e-11, tolerance), 0)
}

export function quadraticAtLengthFraction(a, control, b, fraction) {
  const f = Math.max(0, Math.min(1, Number(fraction)))
  if (!Number.isFinite(f)) throw new Error('Invalid curve length fraction')
  const total = quadraticArcLength(a, control, b)
  if (total < EPSILON) return { point: { ...a }, tangent: { x: 1, y: 0 }, fraction: f }
  const target = f * total
  let low = 0, high = 1
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2
    const walked = quadraticArcLength(a, control, b, 0, mid)
    if (walked < target) low = mid
    else high = mid
  }
  const t = f === 0 ? 0 : f === 1 ? 1 : (low + high) / 2
  const point = quadraticAt(a, control, b, t)
  const derivative = quadraticDerivative(a, control, b, t)
  const magnitude = Math.hypot(derivative.x, derivative.y)
  const tangent = magnitude > EPSILON ? { x: derivative.x / magnitude, y: derivative.y / magnitude } :
    { x: (b.x - a.x) / total, y: (b.y - a.y) / total }
  return { point, tangent, normal: { x: -tangent.y, y: tangent.x }, fraction: f, parameter: t }
}
