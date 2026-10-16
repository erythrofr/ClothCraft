import { edgeRangeLength, seamLengthReport } from './project.js'

// Both Segment Sewing (complete edge) and Free Sewing (fractional cutline)
// use the same source-topology rules. This runs before changing a garment and
// never mutates its 2D cut geometry or existing construction relationships.
export function seamEndpointInterval(endpoint) {
  const start = Number(endpoint?.startT ?? 0)
  const end = Number(endpoint?.endT ?? 1)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1 || start >= end) return null
  return { start, end }
}

function endpointIdentity(endpoint) {
  return `${endpoint?.pieceId}:${endpoint?.edgeIndex}`
}

export function seamEndpointOverlap(a, b, epsilon = 1e-5) {
  if (endpointIdentity(a) !== endpointIdentity(b)) return false
  const ar = seamEndpointInterval(a)
  const br = seamEndpointInterval(b)
  return Boolean(ar && br && Math.min(ar.end, br.end) - Math.max(ar.start, br.start) > epsilon)
}

export function validateNewSeam(project, proposed, { allowOverlappingLayers = false, excludeSeamId = null } = {}) {
  const messages = []
  const pieces = new Map((project.pieces || []).map((piece) => [piece.id, piece]))
  const endpoints = [proposed?.a, proposed?.b]
  for (const [index, endpoint] of endpoints.entries()) {
    const label = index === 0 ? 'A' : 'B'
    const piece = pieces.get(endpoint?.pieceId)
    if (!piece) { messages.push(`Side ${label} references a missing pattern`); continue }
    if (!Number.isInteger(endpoint.edgeIndex) || endpoint.edgeIndex < 0 || endpoint.edgeIndex >= piece.points.length) {
      messages.push(`Side ${label} references an invalid cutline edge`)
      continue
    }
    const range = seamEndpointInterval(endpoint)
    if (!range) { messages.push(`Side ${label} has an invalid sewing range`); continue }
    if (edgeRangeLength(piece, endpoint.edgeIndex, range.start, range.end) < 0.01) {
      messages.push(`Side ${label} is shorter than 0.1 mm; expand the selection`)
    }
  }
  if (endpoints[0] && endpoints[1] && endpointIdentity(endpoints[0]) === endpointIdentity(endpoints[1])) {
    messages.push('A seam must connect two distinct cutline edges')
  }
  if (!messages.length && !allowOverlappingLayers) {
    for (const previous of project.seams || []) {
      if (excludeSeamId && previous.id === excludeSeamId) continue
      if (endpoints.some((endpoint) => seamEndpointOverlap(endpoint, previous.a) || seamEndpointOverlap(endpoint, previous.b))) {
        messages.push(`Selected cutline interval is already sewn by ${previous.name || previous.id}`)
        break
      }
    }
  }
  const lengths = messages.length ? null : seamLengthReport(project, proposed)
  return {
    ok: messages.length === 0,
    messages,
    lengths,
    warning: lengths && lengths.mismatchPercent > 6
      ? `The selected edges differ by ${lengths.mismatchPercent.toFixed(1)}%; review easing or gathering.`
      : null,
  }
}

export function auditSewingConstruction(project, { maxExamples = 12 } = {}) {
  const pieces = new Map((project.pieces || []).map((piece) => [piece.id, piece]))
  const intervals = new Map()
  const issues = []
  const categories = { invalidEndpoints: 0, inactive3d: 0, overlappingRanges: 0, lengthMismatch: 0 }
  const add = (kind, seamId, detail) => {
    categories[kind] += 1
    if (issues.length < maxExamples) issues.push({ kind, seamId, detail })
  }
  let validSewingLinks = 0
  for (const seam of project.seams || []) {
    let invalid = false
    for (const endpoint of [seam.a, seam.b]) {
      const piece = pieces.get(endpoint?.pieceId)
      if (!piece || !Number.isInteger(endpoint?.edgeIndex) || endpoint.edgeIndex < 0 || endpoint.edgeIndex >= piece.points.length || !seamEndpointInterval(endpoint)) {
        add('invalidEndpoints', seam.id, `${endpoint?.pieceId || '?'}:${endpoint?.edgeIndex ?? '?'}`)
        invalid = true
        continue
      }
      const key = endpointIdentity(endpoint)
      if (!intervals.has(key)) intervals.set(key, [])
      intervals.get(key).push({ ...seamEndpointInterval(endpoint), seamId: seam.id })
      if (piece.active3d === false) add('inactive3d', seam.id, `The source pattern ${piece.name || piece.id} is excluded from simulation`)
    }
    if (invalid) continue
    validSewingLinks++
    const report = seamLengthReport(project, seam)
    if (report.mismatchPercent > 6) add('lengthMismatch', seam.id, `${report.mismatchPercent.toFixed(1)}% edge length mismatch`)
  }
  for (const [key, ranges] of intervals) {
    ranges.sort((a, b) => a.start - b.start)
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length && ranges[j].start < ranges[i].end; j++) {
        if (ranges[i].seamId !== ranges[j].seamId && Math.min(ranges[i].end, ranges[j].end) - ranges[j].start > 1e-5) {
          add('overlappingRanges', ranges[j].seamId, `Conflict on ${key} with ${ranges[i].seamId}`)
        }
      }
    }
  }
  return {
    sourceSeams: (project.seams || []).length,
    validSewingLinks,
    issues,
    categories,
    usableForLiveAssembly: categories.invalidEndpoints === 0 && categories.inactive3d === 0 && categories.overlappingRanges === 0,
    certifiedPhysicalFit: false,
  }
}
