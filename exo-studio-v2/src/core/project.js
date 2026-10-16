import { quadraticArcLength, quadraticAtLengthFraction } from './draftingPrecision.js'

export function cloneProject(project) {
  return typeof structuredClone === 'function'
    ? structuredClone(project)
    : JSON.parse(JSON.stringify(project))
}

export function touchProject(project) {
  project.revision = (project.revision || 0) + 1
  project.updatedAt = new Date().toISOString()
  return project
}

export function polygonArea(points = []) {
  if (points.length < 3) return 0
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return Math.abs(area) / 2
}

export function sampleEdge(piece, edgeIndex, segments = 8) {
  const points = piece?.points || []
  const a = points[edgeIndex]
  const b = points[(edgeIndex + 1) % points.length]
  if (!a || !b) return []
  const curve = piece.curves?.[edgeIndex]
  if (!curve) return [{ ...a }, { ...b }]

  const count = Math.max(2, segments)
  const samples = []
  for (let step = 0; step <= count; step += 1) {
    const t = step / count
    const u = 1 - t
    samples.push({
      x: u * u * a.x + 2 * u * t * curve.cx + t * t * b.x,
      y: u * u * a.y + 2 * u * t * curve.cy + t * t * b.y,
    })
  }
  return samples
}

export function samplePieceBoundary(piece, segments = 8) {
  const points = []
  const edgePaths = []
  for (let edgeIndex = 0; edgeIndex < (piece?.points?.length || 0); edgeIndex += 1) {
    const edge = sampleEdge(piece, edgeIndex, segments)
    edgePaths.push(edge)
    if (!edge.length) continue
    points.push(...edge.slice(0, -1))
  }
  return { points, edgePaths }
}

function signedPolygonArea(points = []) {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return area * 0.5
}

function normalizedVector(x, y) {
  const length = Math.hypot(x, y) || 1
  return { x: x / length, y: y / length }
}

function lineIntersection(a, aDirection, b, bDirection) {
  const denominator = aDirection.x * bDirection.y - aDirection.y * bDirection.x
  if (Math.abs(denominator) < 1e-7) return null
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = (dx * bDirection.y - dy * bDirection.x) / denominator
  return { x: a.x + aDirection.x * t, y: a.y + aDirection.y * t }
}

export function getEdgeSeamAllowance(piece, edgeIndex) {
  const override = piece?.edgeSeamAllowances?.[edgeIndex]
  if (override !== undefined && override !== null && Number.isFinite(Number(override))) return Math.max(0, Number(override))
  return Math.max(0, Number(piece?.seamAllowance || 0))
}

export function seamAllowanceBoundary(piece, segments = 8) {
  const pointCount = piece?.points?.length || 0
  if (pointCount < 3) return []
  const sampled = []
  const segmentAllowances = []
  for (let edgeIndex = 0; edgeIndex < pointCount; edgeIndex += 1) {
    const path = sampleEdge(piece, edgeIndex, Math.max(2, segments))
    const allowance = getEdgeSeamAllowance(piece, edgeIndex)
    for (let index = 0; index < Math.max(0, path.length - 1); index += 1) {
      sampled.push({ ...path[index] })
      segmentAllowances.push(allowance)
    }
  }
  if (sampled.length < 3 || segmentAllowances.every((amount) => amount <= 0)) return sampled
  const ccw = signedPolygonArea(sampled) > 0
  return sampled.map((point, index) => {
    const previousIndex = (index - 1 + sampled.length) % sampled.length
    const nextIndex = (index + 1) % sampled.length
    const previous = sampled[previousIndex]
    const next = sampled[nextIndex]
    const incoming = normalizedVector(point.x - previous.x, point.y - previous.y)
    const outgoing = normalizedVector(next.x - point.x, next.y - point.y)
    const incomingNormal = ccw
      ? { x: incoming.y, y: -incoming.x }
      : { x: -incoming.y, y: incoming.x }
    const outgoingNormal = ccw
      ? { x: outgoing.y, y: -outgoing.x }
      : { x: -outgoing.y, y: outgoing.x }
    const incomingAllowance = segmentAllowances[previousIndex] || 0
    const outgoingAllowance = segmentAllowances[index] || 0
    const incomingOffset = {
      x: point.x + incomingNormal.x * incomingAllowance,
      y: point.y + incomingNormal.y * incomingAllowance,
    }
    const outgoingOffset = {
      x: point.x + outgoingNormal.x * outgoingAllowance,
      y: point.y + outgoingNormal.y * outgoingAllowance,
    }
    let result = lineIntersection(incomingOffset, incoming, outgoingOffset, outgoing)
    if (!result) {
      result = {
        x: point.x + (incomingNormal.x * incomingAllowance + outgoingNormal.x * outgoingAllowance) * 0.5,
        y: point.y + (incomingNormal.y * incomingAllowance + outgoingNormal.y * outgoingAllowance) * 0.5,
      }
    }
    const maxAllowance = Math.max(incomingAllowance, outgoingAllowance, 0.001)
    const dx = result.x - point.x
    const dy = result.y - point.y
    const distance = Math.hypot(dx, dy)
    const limit = maxAllowance * 3.5
    if (distance > limit) {
      result = { x: point.x + dx / distance * limit, y: point.y + dy / distance * limit }
    }
    return result
  })
}

export function pieceArea(piece) {
  return polygonArea(samplePieceBoundary(piece, 12).points)
}

export function projectArea(project) {
  return project.pieces.reduce((sum, piece) => sum + pieceArea(piece), 0)
}

export function edgeLength(piece, edgeIndex) {
  const a = piece?.points?.[edgeIndex]
  const b = piece?.points?.[(edgeIndex + 1) % piece?.points?.length]
  if (!a || !b) return 0
  const curve = piece.curves?.[edgeIndex]
  return curve
    ? quadraticArcLength(a, { x: curve.cx, y: curve.cy }, b)
    : Math.hypot(b.x - a.x, b.y - a.y)
}

export function edgeRangeLength(piece, edgeIndex, startT = 0, endT = 1) {
  const start = Math.max(0, Math.min(1, Number(startT ?? 0)))
  const end = Math.max(0, Math.min(1, Number(endT ?? 1)))
  return edgeLength(piece, edgeIndex) * Math.abs(end - start)
}

function seamEndpointRange(endpoint) {
  const start = Math.max(0, Math.min(1, Number(endpoint?.startT ?? 0)))
  const end = Math.max(0, Math.min(1, Number(endpoint?.endT ?? 1)))
  return start <= end ? { start, end } : { start: end, end: start }
}

export function edgePointAt(piece, edgeIndex, fraction = 0.5, segments = 32) {
  const a = piece?.points?.[edgeIndex]
  const b = piece?.points?.[(edgeIndex + 1) % piece?.points?.length]
  if (!a || !b) return null
  const curve = piece.curves?.[edgeIndex]
  if (curve) return quadraticAtLengthFraction(a, { x: curve.cx, y: curve.cy }, b, fraction)
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const t = Math.max(0, Math.min(1, fraction))
  return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
    tangent: { x: (b.x - a.x) / length, y: (b.y - a.y) / length },
    normal: { x: -(b.y - a.y) / length, y: (b.x - a.x) / length },
    fraction: t }
}

export function facingGeometryForEdge(piece, edgeIndex, widthCm = 5) {
  const points = piece?.points || []
  const a = points[edgeIndex]
  const b = points[(edgeIndex + 1) % points.length]
  if (!a || !b || points.length < 3) return null
  const width = Math.max(0.8, Math.min(20, Number(widthCm || 5)))
  const center = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
  const inwardNormal = (fraction) => {
    const located = edgePointAt(piece, edgeIndex, fraction, 48)
    if (!located) return { x: 0, y: -1 }
    let { x, y } = located.normal
    const toCenterX = center.x - located.point.x
    const toCenterY = center.y - located.point.y
    if (x * toCenterX + y * toCenterY < 0) {
      x *= -1
      y *= -1
    }
    return { x, y }
  }
  const startNormal = inwardNormal(0.015)
  const endNormal = inwardNormal(0.985)
  const midNormal = inwardNormal(0.5)
  const innerA = { x: a.x + startNormal.x * width, y: a.y + startNormal.y * width }
  const innerB = { x: b.x + endNormal.x * width, y: b.y + endNormal.y * width }
  const curves = {}
  const sourceCurve = piece.curves?.[edgeIndex]
  if (sourceCurve) {
    curves[0] = { cx: sourceCurve.cx, cy: sourceCurve.cy }
    curves[2] = {
      cx: sourceCurve.cx + midNormal.x * width,
      cy: sourceCurve.cy + midNormal.y * width,
    }
  }
  return {
    points: [{ ...a }, { ...b }, innerB, innerA],
    curves,
    widthCm: width,
  }
}

export function closestEdgeFraction(piece, edgeIndex, point, segments = 40) {
  const path = sampleEdge(piece, edgeIndex, Math.max(10, segments))
  if (path.length < 2) return 0.5
  const segmentLengths = []
  let total = 0
  for (let index = 0; index < path.length - 1; index += 1) {
    const length = Math.hypot(path[index + 1].x - path[index].x, path[index + 1].y - path[index].y)
    segmentLengths.push(length)
    total += length
  }
  let bestDistance = Infinity
  let bestAlong = total * 0.5
  let walked = 0
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const a = path[index]
    const b = path[index + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const denominator = dx * dx + dy * dy
    const t = denominator > 0
      ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / denominator))
      : 0
    const x = a.x + dx * t
    const y = a.y + dy * t
    const distance = Math.hypot(point.x - x, point.y - y)
    if (distance < bestDistance) {
      bestDistance = distance
      bestAlong = walked + segmentLengths[index] * t
    }
    walked += segmentLengths[index]
  }
  return total > 0 ? bestAlong / total : 0.5
}

export function seamLengthReport(project, seam) {
  const pieceA = getPiece(project, seam?.a?.pieceId)
  const pieceB = getPiece(project, seam?.b?.pieceId)
  const rangeA = seamEndpointRange(seam?.a)
  const rangeB = seamEndpointRange(seam?.b)
  const lengthA = edgeRangeLength(pieceA, seam?.a?.edgeIndex, rangeA.start, rangeA.end)
  const lengthB = edgeRangeLength(pieceB, seam?.b?.edgeIndex, rangeB.start, rangeB.end)
  const difference = Math.abs(lengthA - lengthB)
  const average = (lengthA + lengthB) * 0.5
  const mismatchPercent = average > 0 ? (difference / average) * 100 : 0
  return {
    lengthA,
    lengthB,
    difference,
    mismatchPercent,
    status: mismatchPercent <= 2 ? 'good' : mismatchPercent <= 6 ? 'warning' : 'error',
  }
}

function normalizeWalkPath(points = []) {
  if (points.length < 2) return points.map((point) => ({ ...point }))
  const origin = points[0]
  const end = points[points.length - 1]
  const dx = end.x - origin.x
  const dy = end.y - origin.y
  const angle = Math.atan2(dy, dx)
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return points.map((point) => {
    const localX = point.x - origin.x
    const localY = point.y - origin.y
    return {
      x: localX * cosine + localY * sine,
      y: -localX * sine + localY * cosine,
    }
  })
}

export function seamWalkReport(project, seam, sampleCount = 25) {
  const pieceA = getPiece(project, seam?.a?.pieceId)
  const pieceB = getPiece(project, seam?.b?.pieceId)
  if (!pieceA || !pieceB) return null
  const rangeA = seamEndpointRange(seam.a)
  const rangeB = seamEndpointRange(seam.b)
  const lengthA = edgeRangeLength(pieceA, seam.a.edgeIndex, rangeA.start, rangeA.end)
  const lengthB = edgeRangeLength(pieceB, seam.b.edgeIndex, rangeB.start, rangeB.end)
  const count = Math.max(5, Math.min(81, Math.round(sampleCount)))
  const sourceA = []
  const sourceB = []
  for (let index = 0; index < count; index += 1) {
    const fraction = count === 1 ? 0 : index / (count - 1)
    const fractionA = rangeA.start + (rangeA.end - rangeA.start) * fraction
    const pointA = edgePointAt(pieceA, seam.a.edgeIndex, fractionA, 96)?.point
    const fractionB = seam.reverseB
      ? rangeB.end - (rangeB.end - rangeB.start) * fraction
      : rangeB.start + (rangeB.end - rangeB.start) * fraction
    const pointB = edgePointAt(pieceB, seam.b.edgeIndex, fractionB, 96)?.point
    if (!pointA || !pointB) continue
    sourceA.push(pointA)
    sourceB.push(pointB)
  }
  if (sourceA.length < 2 || sourceB.length < 2) return null
  const pathA = normalizeWalkPath(sourceA)
  const normalizedB = normalizeWalkPath(sourceB)
  const directError = normalizedB.reduce((sum, point, index) => {
    const a = pathA[index] || pathA[pathA.length - 1]
    return sum + Math.hypot(a.x - point.x, a.y - point.y)
  }, 0)
  const reflectedError = normalizedB.reduce((sum, point, index) => {
    const a = pathA[index] || pathA[pathA.length - 1]
    return sum + Math.hypot(a.x - point.x, a.y + point.y)
  }, 0)
  const reflectB = reflectedError < directError
  const pathB = normalizedB.map((point) => ({ x: point.x, y: reflectB ? -point.y : point.y }))
  const deviations = pathA.map((point, index) => {
    const target = pathB[index] || pathB[pathB.length - 1]
    return Math.hypot(point.x - target.x, point.y - target.y)
  })
  const averageShapeDeviationCm = deviations.reduce((sum, value) => sum + value, 0) / Math.max(1, deviations.length)
  const maxShapeDeviationCm = deviations.length ? Math.max(...deviations) : 0
  const difference = Math.abs(lengthA - lengthB)
  const average = (lengthA + lengthB) * 0.5
  const mismatchPercent = average > 0 ? difference / average * 100 : 0
  return {
    seamId: seam.id,
    name: seam.name || seam.id,
    pieceAId: pieceA.id,
    pieceBId: pieceB.id,
    edgeA: seam.a.edgeIndex,
    edgeB: seam.b.edgeIndex,
    lengthA,
    lengthB,
    difference,
    mismatchPercent,
    pathA,
    pathB,
    reflectB,
    averageShapeDeviationCm,
    maxShapeDeviationCm,
    samples: pathA.map((point, index) => {
      const fraction = pathA.length <= 1 ? 0 : index / (pathA.length - 1)
      const target = pathB[index] || pathB[pathB.length - 1]
      return {
        fraction,
        distanceA: lengthA * fraction,
        distanceB: lengthB * fraction,
        cumulativeDeltaCm: (lengthA - lengthB) * fraction,
        shapeDeviationCm: Math.hypot(point.x - target.x, point.y - target.y),
      }
    }),
  }
}

export function getPiece(project, id) {
  return project.pieces.find((piece) => piece.id === id)
}

export function uniqueId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function makeRectanglePiece(index = 0) {
  const id = uniqueId('piece')
  return {
    id,
    name: `Pattern ${index + 1}`,
    points: [
      { x: -18, y: 0 },
      { x: 18, y: 0 },
      { x: 18, y: 36 },
      { x: -18, y: 36 },
    ],
    layout2d: { x: 250, y: 112 },
    arrangement3d: { x: 0.72, y: 0.55, z: 0.1, flip: false },
    seamAllowance: 1,
    fabricId: 'main',
    locked: false,
  }
}
