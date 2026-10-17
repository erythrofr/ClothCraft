import { cloneProject, edgeLength } from './project.js'

export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export function sizeOffset(grading, size) {
  const sizes = grading?.sizes?.length ? grading.sizes : DEFAULT_SIZES
  const baseSize = grading?.baseSize || 'M'
  const baseIndex = Math.max(0, sizes.indexOf(baseSize))
  const sizeIndex = Math.max(0, sizes.indexOf(size))
  return sizeIndex - baseIndex
}

export function gradePointForPiece(piece, grading, size, point) {
  const offset = sizeOffset(grading, size)
  if (!offset) return { ...point }
  const widthPerSize = Number(grading?.widthPerSizeCm ?? 3)
  const lengthPerSize = Number(grading?.lengthPerSizeCm ?? 1.2)
  const pieceBounds = bounds(piece.points)
  const centerX = (pieceBounds.minX + pieceBounds.maxX) * 0.5
  const height = Math.max(1, pieceBounds.maxY - pieceBounds.minY)
  const halfWidthDelta = (widthPerSize * offset) * 0.5
  const lengthDelta = lengthPerSize * offset
  const side = Math.sign(point.x - centerX)
  const normalizedY = (point.y - pieceBounds.minY) / height
  const widthInfluence = 0.55 + 0.45 * (1 - normalizedY)
  const lengthInfluence = 1 - normalizedY
  const automatic = {
    x: point.x + side * halfWidthDelta * widthInfluence,
    y: point.y - lengthDelta * lengthInfluence,
  }
  const rule = point.gradeRule
  if (!rule?.enabled) return automatic
  return {
    x: Number.isFinite(Number(rule.dxPerSize)) ? point.x + Number(rule.dxPerSize) * offset : automatic.x,
    y: Number.isFinite(Number(rule.dyPerSize)) ? point.y + Number(rule.dyPerSize) * offset : automatic.y,
  }
}

function bounds(points = []) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

// Preserve a graded stitch-arc length by reshaping its quadratic control.
// Evaluate a few smooth, nearby controls rather than trying to mask the
// geometric mismatch with sleeve easing or a solver constraint.
function fitGradedSleeveArc(piece, edge, target, preferred) {
  let best = { error: Infinity, cost: Infinity, control: preferred }
  const evaluate = (cx, cy) => {
    piece.curves[edge] = { cx, cy }
    const error = Math.abs(edgeLength(piece, edge) - target)
    const cost = error * 400 + Math.hypot(cx - preferred.cx, cy - preferred.cy) * 0.07
    if (cost < best.cost) best = { error, cost, control: { cx, cy } }
    return edgeLength(piece, edge) - target
  }
  for (let column = -7; column <= 7; column++) {
    const cx = preferred.cx + column * .35
    let prior = null
    for (let row = -30; row <= 30; row++) {
      const cy = preferred.cy + row * .25
      const difference = evaluate(cx, cy)
      if (prior && prior.difference * difference < 0) {
        let lo = prior.cy, hi = cy, flo = prior.difference
        for (let i=0; i<19; i++) {
          const mid=(lo+hi)*.5, fmid=evaluate(cx,mid)
          if (fmid*flo<=0) hi=mid
          else { lo=mid; flo=fmid }
        }
      }
      prior = { cy, difference }
    }
  }
  piece.curves[edge] = best.control
  return best.error
}

export function gradePiece(piece, grading, size) {
  const offset = sizeOffset(grading, size)
  if (!offset) {
    return {
      ...piece,
      points: piece.points.map((point) => ({ ...point })),
      curves: piece.curves ? Object.fromEntries(Object.entries(piece.curves).map(([key, curve]) => [key, { ...curve }])) : undefined,
      internalLines: (piece.internalLines || []).map((line) => ({
        ...line,
        a: { ...line.a },
        b: { ...line.b },
      })),
    }
  }
  const transform = (point) => gradePointForPiece(piece, grading, size, point)

  const points = piece.points.map(transform)
  const curves = piece.curves
    ? Object.fromEntries(Object.entries(piece.curves).map(([edgeIndex, curve]) => {
      const transformed = transform({ x: curve.cx, y: curve.cy })
      return [edgeIndex, { cx: transformed.x, cy: transformed.y }]
    }))
    : undefined
  const internalLines = (piece.internalLines || []).map((line) => ({
    ...line,
    a: transform(line.a),
    b: transform(line.b),
  }))

  return {
    ...piece,
    points,
    curves,
    internalLines,
    gradeSize: size,
  }
}

export function gradeProject(project, size) {
  // The regular T-shirt's 14 true stitch-seam pairs must remain geometrically
  // matched throughout XS–XXL. A generic per-piece normalized-Y grader changes
  // sleeve caps and armscyes by different proportions, resulting in >10%
  // stitching mismatch for XS/XXL. Apply one affine stitchline transform to
  // every piece and curve as a controlled development-grade starting point.
  // Explicit designer grade rules continue to use the general grader.
  const specialTee = project.productionSpec?.gradingModel === 'seam-locked-affine-v1'
    && !(project.pieces || []).some(piece => piece.points?.some(point => point.gradeRule?.enabled))
  if (specialTee) {
    const graded = cloneProject(project)
    graded.previewSize = size
    const offset = sizeOffset(project.grading, size)
    const stepWidth = Number(project.grading?.widthPerSizeCm ?? 3)
    const stepLength = Number(project.grading?.lengthPerSizeCm ?? 1.2)
    const referenceWidth = Math.max(1, Number(project.productionSpec.referenceHalfChestCm ?? 54))
    const referenceLength = Math.max(1, Number(project.productionSpec.referenceBodyLengthCm ?? 71))
    const sx = 1 + offset * stepWidth / referenceWidth
    const sy = 1 + offset * stepLength / referenceLength
    if (!(sx > .4 && sy > .4)) throw new Error('Unsupported T-shirt grading factors')
    const scale = point => ({...point, x: point.x * sx, y: point.y * sy})
    graded.pieces = project.pieces.map(piece => ({
      ...cloneProject(piece),
      points: piece.points.map(scale),
      curves: piece.curves ? Object.fromEntries(Object.entries(piece.curves).map(([key, curve]) => [key, { cx: curve.cx * sx, cy: curve.cy * sy }])) : undefined,
      internalLines: (piece.internalLines || []).map(line => ({ ...cloneProject(line), a: scale(line.a), b: scale(line.b) })),
      gradeSize: size,
    }))
    if (offset) {
      const front = graded.pieces.find(piece => piece.id === 'front')
      const leftSleeve = graded.pieces.find(piece => piece.id === 'sleeve-left')
      const rightSleeve = graded.pieces.find(piece => piece.id === 'sleeve-right')
      if (front && leftSleeve?.points.length === 7 && rightSleeve?.points.length === 7) {
        const upper = edgeLength(front, 1)
        const lower = edgeLength(front, 2)
        const capRise = (project.pieces.find(piece => piece.id === 'sleeve-left').points[0].y
          - project.pieces.find(piece => piece.id === 'sleeve-left').points[1].y) * sy
        const capWidth = Math.sqrt(Math.max(0, upper**2 - capRise**2)) - .2
        const underarmWidth = 17.25 + offset * .5
        for (const sleeve of [leftSleeve, rightSleeve]) {
          sleeve.points[1].x = -capWidth
          sleeve.points[6].x = capWidth
          sleeve.points[2].x = -underarmWidth
          sleeve.points[5].x = underarmWidth
          const preferredUpper = { cx: -capWidth*.55, cy: 23.5*sy }
          const preferredLower = { cx: -underarmWidth + .75, cy: 22*sy }
          fitGradedSleeveArc(sleeve, 0, upper, preferredUpper)
          fitGradedSleeveArc(sleeve, 1, lower, preferredLower)
          // Mirror the left cap into the right half of the SAME sleeve piece.
          // The armholes on both body sides remain exact mirrors as well.
          sleeve.curves[6] = { cx: -sleeve.curves[0].cx, cy: sleeve.curves[0].cy }
          sleeve.curves[5] = { cx: -sleeve.curves[1].cx, cy: sleeve.curves[1].cy }
        }
      }
    }
    graded.customMeasurements = (project.customMeasurements || []).map(measurement => ({
      ...cloneProject(measurement),
      a: measurement.a ? scale(measurement.a) : measurement.a,
      b: measurement.b ? scale(measurement.b) : measurement.b,
    }))
    return graded
  }
  const graded = cloneProject(project)
  graded.previewSize = size
  graded.pieces = project.pieces.map((piece) => gradePiece(piece, project.grading, size))
  graded.customMeasurements = (project.customMeasurements || []).map((measurement) => {
    const piece = project.pieces.find((item) => item.id === measurement.pieceId)
    if (!piece) return cloneProject(measurement)
    return {
      ...cloneProject(measurement),
      a: gradePointForPiece(piece, project.grading, size, measurement.a),
      b: gradePointForPiece(piece, project.grading, size, measurement.b),
    }
  })
  return graded
}

export function buildSizeRun(project) {
  const sizes = project.grading?.sizes?.length ? project.grading.sizes : DEFAULT_SIZES
  return Object.fromEntries(sizes.map((size) => [size, gradeProject(project, size)]))
}
