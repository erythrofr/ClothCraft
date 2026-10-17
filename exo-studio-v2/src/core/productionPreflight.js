import { buildFabricMarkers } from './marker.js'
import { gradeProject } from './grading.js'
import { edgeLength, polygonArea, samplePieceBoundary, seamLengthReport } from './project.js'

// Document checks, not a substitute for factory CAD import, physical samples,
// independent seam verification, or graded marker/cutter acceptance testing.
const finite = (value) => typeof value === 'number' && Number.isFinite(value)

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function intersects(a, b, c, d) {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)
  // Collinear/touching segments are not enough evidence for a crossing.
  return abC * abD < -1e-9 && cdA * cdB < -1e-9
}

function hasCrossing(piece) {
  const points = samplePieceBoundary(piece, 6).points
  const count = points.length
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 2; j < count; j += 1) {
      if (i === 0 && j === count - 1) continue
      if (intersects(points[i], points[(i + 1) % count], points[j], points[(j + 1) % count])) return true
    }
  }
  return false
}

export function inspectProduction(project, { allSizes = true } = {}) {
  const issues = []
  const add = (severity, code, scope, message) => issues.push({ severity, code, scope, message })
  const pieces = project?.pieces || []
  const fabrics = project?.fabrics || {}
  const ids = new Set()
  const validPieces = new Set()
  if (!pieces.length) add('blocker', 'NO_PATTERNS', 'Pattern', 'There are no pattern pieces to manufacture.')

  for (const piece of pieces) {
    const scope = `Pattern · ${piece.name || piece.id || 'unnamed'}`
    if (!piece.id || ids.has(piece.id)) add('blocker', 'DUPLICATE_ID', scope, 'Pattern ID is missing or duplicated.')
    ids.add(piece.id)
    if (!Array.isArray(piece.points) || piece.points.length < 3 || piece.points.some((point) => !finite(point.x) || !finite(point.y))) {
      add('blocker', 'INVALID_GEOMETRY', scope, 'Pattern has fewer than three valid finite points.')
      continue
    }
    const cutQty = Number(piece.cutQuantity ?? 1)
    if (!Number.isInteger(cutQty) || cutQty < 1 || cutQty > 99) add('blocker', 'CUT_QUANTITY', scope, 'Cut quantity must be an integer from 1 to 99.')
    const fabricId = piece.fabricId || 'main'
    if (!fabrics[fabricId]) add('blocker', 'MISSING_FABRIC', scope, `Fabric '${fabricId}' is not present in the material library.`)
    const allowance = Number(piece.seamAllowance ?? 0)
    if (!finite(allowance) || allowance < 0) add('blocker', 'SEAM_ALLOWANCE', scope, 'Invalid seam allowance.')
    const invalidEdge = piece.points.some((_, index) => edgeLength(piece, index) < 0.05 || !Number.isFinite(edgeLength(piece, index)))
    if (invalidEdge) add('blocker', 'ZERO_LENGTH_EDGE', scope, 'Pattern has an extremely short or invalid edge (under 0.5 mm).')
    const boundary = samplePieceBoundary(piece, 6).points
    if (polygonArea(boundary) < 0.1) add('blocker', 'ZERO_AREA', scope, 'Pattern area is too small (under 0.1 cm²).')
    if (hasCrossing(piece)) add('blocker', 'SELF_INTERSECTION', scope, 'Cut outline crosses itself. Repair the drafting topology before production.')
    for (const notch of piece.notches || []) {
      if (!Number.isInteger(Number(notch.edgeIndex)) || notch.edgeIndex < 0 || notch.edgeIndex >= piece.points.length || !finite(Number(notch.t ?? 0.5)) || Number(notch.t ?? 0.5) < 0 || Number(notch.t ?? 0.5) > 1) {
        add('warning', 'NOTCH_INVALID', scope, 'A notch has an invalid edge or position and could be dropped by DXF export.')
      }
    }
    validPieces.add(piece.id)
  }

  for (const seam of project?.seams || []) {
    const scope = `Seam · ${seam.name || seam.id || 'unnamed'}`
    const valid = [seam.a, seam.b].every((side) => {
      const piece = pieces.find((p) => p.id === side?.pieceId)
      return piece && validPieces.has(piece.id) && Number.isInteger(side.edgeIndex) && side.edgeIndex >= 0 && side.edgeIndex < piece.points.length
    })
    if (!valid) {
      add('blocker', 'BROKEN_SEAM', scope, 'Sewing references a missing pattern or edge.')
      continue
    }
    const report = seamLengthReport(project, seam)
    if (!Number.isFinite(report.mismatchPercent) || report.lengthA <= 0 || report.lengthB <= 0) {
      add('blocker', 'INVALID_SEAM_LENGTH', scope, 'Seam endpoints have invalid lengths.')
    } else if (report.status !== 'good') {
      add('warning', 'SEAM_MISMATCH', scope, `Edge length mismatch ${report.mismatchPercent.toFixed(1)}%. Review ease, gathering and construction.`)
    }
  }

  const sizes = allSizes
    ? (project?.grading?.sizes?.length ? project.grading.sizes : [project?.grading?.baseSize || 'M'])
    : [project?.previewSize || project?.grading?.baseSize || 'M']
  if (new Set(sizes).size !== sizes.length) add('blocker', 'DUPLICATE_SIZE', 'Grading', 'Size run contains duplicate size names.')
  const validGeometry = !issues.some((issue) => issue.severity === 'blocker' &&
    ['NO_PATTERNS', 'INVALID_GEOMETRY', 'ZERO_LENGTH_EDGE', 'ZERO_AREA', 'SELF_INTERSECTION'].includes(issue.code))
  const markerSummary = []
  if (validGeometry) {
    for (const size of [...new Set(sizes)]) {
      try {
        const graded = gradeProject(project, size)
        const markers = buildFabricMarkers(graded, Number(project.markerSettings?.fabricWidthCm ?? 150), Number(project.markerSettings?.gapCm ?? 1.5))
        for (const [fabricId, marker] of Object.entries(markers)) {
          markerSummary.push({ size, fabricId, requested: marker.requestedPieces, placed: marker.placements.length, unplaced: marker.unusedPieces, lengthCm: marker.length, efficiency: marker.efficiency })
          if (marker.unusedPieces) add('blocker', 'MARKER_OVERFLOW', `${size} · ${fabricId}`, `${marker.unusedPieces} cut piece(s) could not fit the configured fabric width (${marker.width} cm).`)
          if (!Number.isFinite(marker.length) || !Number.isFinite(marker.efficiency)) add('blocker', 'INVALID_MARKER', `${size} · ${fabricId}`, 'Marker layout contains invalid dimensions.')
        }
      } catch (error) {
        add('blocker', 'MARKER_GENERATION', `Size · ${size}`, `Could not generate size marker: ${error.message}`)
      }
    }
  }
  const blockers = issues.filter((issue) => issue.severity === 'blocker').length
  const warnings = issues.filter((issue) => issue.severity === 'warning').length
  return {
    status: blockers ? 'BLOCKED' : warnings ? 'REVIEW' : 'STRUCTURAL_CHECK_PASS',
    blockers, warnings, issues, sizes: [...new Set(sizes)], markerSummary,
    // A structurally valid export is NEVER an independently certified factory file.
    factoryCertified: false,
  }
}
