import { edgeLength, edgePointAt, samplePieceBoundary, seamAllowanceBoundary } from './project.js'

// Vector plot outputs use centimeters as document coordinates. The PDF uses
// 72 / 2.54 points per centimeter and true-size MediaBox dimensions.
const PT_PER_CM = 72 / 2.54
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char])
const plain = (value) => String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7e]/g, '?')
const number = (value) => Number(value.toFixed(4)).toString()

function annotations(marker, project) {
  if (!project) return []
  const pieces = new Map((project.pieces || []).map((piece) => [piece.id, piece]))
  return (marker.placements || []).flatMap((placement) => {
    const piece = pieces.get(placement.pieceId)
    if (!piece || !Array.isArray(piece.points) || piece.points.length < 3) return []
    const degrees = Number(placement.rotationDeg || 0) * Math.PI / 180
    const c = Math.cos(degrees)
    const s = Math.sin(degrees)
    const rotated = seamAllowanceBoundary(piece, 10).map((point) => ({ x: point.x * c - point.y * s, y: point.x * s + point.y * c }))
    if (rotated.length < 3) return []
    const minX = Math.min(...rotated.map((point) => point.x))
    const minY = Math.min(...rotated.map((point) => point.y))
    const translate = (point) => ({
      x: placement.x + point.x * c - point.y * s - minX,
      y: placement.y + point.x * s + point.y * c - minY,
    })
    const sampled = samplePieceBoundary(piece, 10).points
    if (!sampled.length) return []
    const x = sampled.reduce((sum, point) => sum + point.x, 0) / sampled.length
    const y = sampled.reduce((sum, point) => sum + point.y, 0) / sampled.length
    const ys = sampled.map((point) => point.y)
    const half = Math.max(2, (Math.max(...ys) - Math.min(...ys)) * 0.28)
    const grainAngle = Number(piece.grainAngleDeg || 0) * Math.PI / 180
    const dx = Math.sin(grainAngle) * half
    const dy = Math.cos(grainAngle) * half
    const grain = [translate({ x: x - dx, y: y - dy }), translate({ x: x + dx, y: y + dy })]
    const notches = []
    for (const notch of piece.notches || []) {
      const edgeIndex = Number(notch.edgeIndex)
      if (!Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= piece.points.length) continue
      const t = Number(notch.t ?? 0.5)
      const gap = Math.min(0.045, 0.38 / Math.max(0.1, edgeLength(piece, edgeIndex)))
      for (const fraction of (notch.type === 'double' ? [t - gap, t + gap] : [t])) {
        const located = edgePointAt(piece, edgeIndex, Math.max(0, Math.min(1, fraction)), 48)
        if (!located) continue
        const depth = Number(notch.depthCm ?? 0.45)
        notches.push([
          translate({ x: located.point.x - located.normal.x * depth * 0.15, y: located.point.y - located.normal.y * depth * 0.15 }),
          translate({ x: located.point.x + located.normal.x * depth, y: located.point.y + located.normal.y * depth }),
        ])
      }
    }
    return [{ grain, notches }]
  })
}

export function markerToSvg(marker, { size = 'BASE', fabricName = marker.fabricId || 'Fabric', project = null } = {}) {
  const width = Number(marker.width)
  const length = Math.max(1, Number(marker.length))
  if (!(width > 0) || !(length > 0) || !Number.isFinite(length)) throw new Error('Invalid marker dimensions')
  const polygons = (marker.placements || []).map((placement) => {
    const points = (placement.outline || []).map((p) => `${number(p.x)},${number(p.y)}`).join(' ')
    return `<polygon fill="none" stroke="#111" stroke-width="0.04" points="${points}"/>`
  }).join('')
  const overlay = annotations(marker, project)
  const labels = (marker.placements || []).map((placement) => `<text x="${number(placement.x + 0.5)}" y="${number(placement.y + 1.5)}" font-size="1.1" fill="#111">${safe(`${placement.name} ${size} #${placement.instance + 1}`)}</text>`).join('')
  const lines = (segments) => segments.map(([a, b]) => `<line x1="${number(a.x)}" y1="${number(a.y)}" x2="${number(b.x)}" y2="${number(b.y)}"/>`).join('')
  const grains = lines(overlay.map(({ grain }) => grain))
  const notches = lines(overlay.flatMap(({ notches }) => notches))
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}cm" height="${number(length)}cm" viewBox="0 0 ${number(width)} ${number(length)}"><title>${safe(`Marker ${fabricName} ${size}`)}</title><desc>True-size SVG; print at 100%. ${marker.unusedPieces} unplaced pieces. Cut and annotation groups remain separate.</desc><rect x="0" y="0" width="${number(width)}" height="${number(length)}" fill="white" stroke="black" stroke-width="0.05"/><g id="cut-lines">${polygons}</g><g id="grain-lines" stroke="#666" stroke-width="0.035" stroke-dasharray="0.5 0.25">${grains}</g><g id="notch-marks" stroke="red" stroke-width="0.045">${notches}</g><g id="labels">${labels}</g></svg>`
}

const pdfEscape = (input) => plain(input).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')

function pdfPage(marker, size, pageIndex, pageLengthCm, overlay) {
  const widthCm = marker.width
  const startCm = pageIndex * pageLengthCm
  const endCm = Math.min(marker.length, startCm + pageLengthCm)
  const heightCm = Math.max(1, endCm - startCm)
  const widthPt = widthCm * PT_PER_CM
  const heightPt = heightCm * PT_PER_CM
  const path = [`q`, `0 0 ${number(widthPt)} ${number(heightPt)} re W n`, '0 G', '0.45 w', `0 0 ${number(widthPt)} ${number(heightPt)} re S`]
  for (const placement of marker.placements || []) {
    const points = placement.outline || []
    if (points.length < 3 || placement.y + placement.height < startCm || placement.y > endCm) continue
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]
      const x = point.x * PT_PER_CM
      const y = (heightCm - (point.y - startCm)) * PT_PER_CM
      path.push(`${number(x)} ${number(y)} ${i ? 'l' : 'm'}`)
    }
    path.push('h S')
    if (placement.y + 1.5 >= startCm && placement.y + 1.5 <= endCm) {
      const x = (placement.x + 0.5) * PT_PER_CM
      const y = (heightCm - (placement.y + 1.5 - startCm)) * PT_PER_CM
      path.push(`BT /F1 9 Tf ${number(x)} ${number(y)} Td (${pdfEscape(`${placement.name} / ${size} / ${placement.instance + 1}`)}) Tj ET`)
    }
  }
  // Grainlines and explicit matched notches are ink annotations, not extra cut
  // paths. Cutter consumers should use the dedicated SVG/DXF geometry layers.
  const printable = (point) => ({ x: point.x * PT_PER_CM, y: (heightCm - (point.y - startCm)) * PT_PER_CM })
  for (const { grain, notches } of overlay) {
    path.push('[4 3] 0 d 0.5 w')
    const a = printable(grain[0]); const b = printable(grain[1])
    path.push(`${number(a.x)} ${number(a.y)} m ${number(b.x)} ${number(b.y)} l S`)
    path.push('[] 0 d')
    for (const notch of notches) {
      const a = printable(notch[0]); const b = printable(notch[1])
      path.push(`${number(a.x)} ${number(a.y)} m ${number(b.x)} ${number(b.y)} l S`)
    }
  }
  path.push('Q')
  return { widthPt, heightPt, content: path.join('\n') + '\n' }
}

// Zero external PDF dependencies, and every byte is ASCII so xref offsets are
// byte-exact. Long markers are divided at a deterministic 400 cm cut length.
export function markerToPdf(marker, { size = 'BASE', pageLengthCm = 400, project = null } = {}) {
  if (!Number.isFinite(marker?.width) || marker.width <= 0 || !Number.isFinite(marker?.length) || marker.length <= 0) {
    throw new Error('Cannot print an empty or invalid marker')
  }
  const maxPage = Math.min(400, Math.max(10, Number(pageLengthCm) || 400))
  const count = Math.max(1, Math.ceil(marker.length / maxPage))
  const objects = []
  // Object numbers 1 = Catalog, 2 = Pages, 3 = Font, then each page/content.
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  const pageRefs = []
  for (let index = 0; index < count; index += 1) {
    const page = pdfPage(marker, size, index, maxPage, annotations(marker, project))
    const pageNumber = 4 + index * 2
    pageRefs.push(`${pageNumber} 0 R`)
    objects[pageNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(page.widthPt)} ${number(page.heightPt)}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageNumber + 1} 0 R >>`
    objects[pageNumber + 1] = `<< /Length ${page.content.length} >>\nstream\n${page.content}endstream`
  }
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${count} >>`
  let pdf = '%PDF-1.4\n%Garment Studio marker plot\n'
  const offsets = [0]
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const startXref = pdf.length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}
