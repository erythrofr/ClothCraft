// Independent CLO-style 2D drafting geometry. Coordinates are centimeters.
// CLO reference: Snap to Grid and Snap to Pattern are independent preferences.
import { sampleEdge } from './project.js'

const finitePoint = p => !!p && Number.isFinite(p.x) && Number.isFinite(p.y)

export function snapDraftGrid(point, spacingCm = 1, origin = { x: 0, y: 0 }) {
  if (!finitePoint(point) || !finitePoint(origin) || !Number.isFinite(spacingCm) || spacingCm <= 0) {
    throw new Error('Invalid 2D drafting grid')
  }
  return {
    x: origin.x + Math.round((point.x - origin.x) / spacingCm) * spacingCm,
    y: origin.y + Math.round((point.y - origin.y) / spacingCm) * spacingCm,
  }
}

export function nearestOnDraftSegment(point, a, b) {
  if (![point, a, b].every(finitePoint)) throw new Error('Invalid drafting segment')
  const dx = b.x - a.x, dy = b.y - a.y
  const squared = dx * dx + dy * dy
  const t = squared < 1e-12 ? 0
    : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared))
  return { x: a.x + t * dx, y: a.y + t * dy, t }
}

// Input/output are *global* SVG coordinates (Y down). Translate each piece's
// local drafting vertices through layout2d before testing candidates.
export function snapDraftPattern(point, pieces, {
  toleranceCm = 1, excludedPieceId = null, excludedPoint = null,
  allowEdges = true, samplesPerCurve = 16,
} = {}) {
  if (!finitePoint(point) || !Number.isFinite(toleranceCm) || toleranceCm <= 0) {
    throw new Error('Invalid drafting snap point or tolerance')
  }
  let nearestVertex = null
  let nearestEdge = null
  let nearestVertexSq = toleranceCm * toleranceCm
  let nearestEdgeSq = toleranceCm * toleranceCm
  const consider = (candidate, info) => {
    if (!finitePoint(candidate)) return
    const distanceSq = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2
    if (info.kind === 'vertex') {
      if (distanceSq > nearestVertexSq) return
      nearestVertexSq = distanceSq
      nearestVertex = { x: candidate.x, y: candidate.y, distanceCm: Math.sqrt(distanceSq), ...info }
    } else {
      if (distanceSq > nearestEdgeSq) return
      nearestEdgeSq = distanceSq
      nearestEdge = { x: candidate.x, y: candidate.y, distanceCm: Math.sqrt(distanceSq), ...info }
    }
  }
  for (const piece of pieces || []) {
    if (!piece || piece.id === excludedPieceId || !Array.isArray(piece.points)
        || !finitePoint(piece.layout2d)) continue
    const { x: left, y: top } = piece.layout2d
    for (let index = 0; index < piece.points.length; index++) {
      if (excludedPoint?.pieceId === piece.id && (
        excludedPoint.pointIndex === index
        || (excludedPoint.pointIndex + 1) % piece.points.length === index
        || (excludedPoint.pointIndex - 1 + piece.points.length) % piece.points.length === index
      )) continue
      const vertex = piece.points[index]
      consider({ x: left + vertex.x, y: top - vertex.y },
        { kind: 'vertex', pieceId: piece.id, pointIndex: index })
    }
    if (!allowEdges) continue
    for (let edgeIndex = 0; edgeIndex < piece.points.length; edgeIndex++) {
      // Never snap a point to its own adjacent edge: that collapses the cutline.
      if (excludedPoint?.pieceId === piece.id && (
        edgeIndex === excludedPoint.pointIndex
        || (edgeIndex + 1) % piece.points.length === excludedPoint.pointIndex
      )) continue
      const path = sampleEdge(piece, edgeIndex, Math.max(2, samplesPerCurve))
      for (let j = 0; j < path.length - 1; j++) {
        const a = { x: left + path[j].x, y: top - path[j].y }
        const b = { x: left + path[j + 1].x, y: top - path[j + 1].y }
        consider(nearestOnDraftSegment(point, a, b),
          { kind: 'edge', pieceId: piece.id, edgeIndex })
      }
    }
  }
  // Give explicit pattern corners a small magnetic capture zone; otherwise
  // curves and straight edge projections would steal almost every near-
  // corner cursor position and precise vertex snapping would be unusable.
  if (nearestVertex && (nearestVertexSq <= toleranceCm * toleranceCm * 0.36 || !nearestEdge)) return nearestVertex
  return nearestEdge
}

// CLO Shift guidelines: constrain drags to a horizontal, vertical or diagonal
// axis. Project movement onto that ray instead of rotating at equal radius.
export function constrainDraftAxis(start, destination, incrementDegrees = 45) {
  if (!finitePoint(start) || !finitePoint(destination)
    || !Number.isFinite(incrementDegrees) || incrementDegrees <= 0
    || 360 % incrementDegrees !== 0) throw new Error('Invalid drafting guideline')
  const dx = destination.x - start.x, dy = destination.y - start.y
  if (Math.hypot(dx, dy) < 1e-10) return { ...destination }
  const increment = incrementDegrees * Math.PI / 180
  const angle = Math.round(Math.atan2(dy, dx) / increment) * increment
  const travel = dx * Math.cos(angle) + dy * Math.sin(angle)
  return { x: start.x + travel * Math.cos(angle), y: start.y + travel * Math.sin(angle) }
}
