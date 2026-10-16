import { sampleEdge } from './project.js'

function normalize(x, y) {
  const length = Math.hypot(x, y) || 1
  return { x: x / length, y: y / length }
}

export function offsetEdgePath(piece, edgeIndex, offsetCm = 0, segments = 28) {
  const path = sampleEdge(piece, edgeIndex, Math.max(8, segments))
  if (path.length < 2) return path
  return path.map((point, index) => {
    const previous = path[Math.max(0, index - 1)]
    const next = path[Math.min(path.length - 1, index + 1)]
    const tangent = normalize(next.x - previous.x, next.y - previous.y)
    const normal = { x: -tangent.y, y: tangent.x }
    return {
      x: point.x + normal.x * offsetCm,
      y: point.y + normal.y * offsetCm,
    }
  })
}

export function topstitchPaths(piece, topstitch) {
  const rows = Math.max(1, Math.min(3, Number(topstitch.rows || 1)))
  const baseOffset = Number(topstitch.offsetCm ?? 0.7)
  const rowGap = Number(topstitch.rowGapCm ?? 0.45)
  return Array.from({ length: rows }, (_, index) => (
    offsetEdgePath(piece, topstitch.edgeIndex, baseOffset + index * rowGap, 32)
  ))
}

export function zipperPaths(piece, zipper) {
  const offset = Number(zipper.offsetCm ?? 0)
  const halfWidth = Number(zipper.widthCm ?? 1.2) * 0.5
  return [
    offsetEdgePath(piece, zipper.edgeIndex, offset - halfWidth, 32),
    offsetEdgePath(piece, zipper.edgeIndex, offset + halfWidth, 32),
  ]
}

export function pieceCenter(piece) {
  const points = piece?.points || []
  if (!points.length) return { x: 0, y: 0 }
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
}

export function trimSummary(project) {
  let topstitchRows = 0
  let zippers = 0
  let buttons = 0
  let buttonholes = 0
  for (const piece of project.pieces || []) {
    topstitchRows += (piece.topstitches || []).reduce((sum, stitch) => sum + Math.max(1, Number(stitch.rows || 1)), 0)
    zippers += (piece.zippers || []).length
    buttons += (piece.buttons || []).length
    buttonholes += (piece.buttonholes || []).length
  }
  return { topstitchRows, zippers, buttons, buttonholes }
}
