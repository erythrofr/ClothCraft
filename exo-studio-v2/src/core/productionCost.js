import { gradeProject } from './grading.js'
import { buildFabricMarkers } from './marker.js'

function suppliedPrice(fabric) {
  const value = fabric?.pricePerMeter
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

// Each marker represents the complete cut-piece set for ONE finished garment
// of the given size. This is a cutting-layout estimate, not a purchase order.
export function buildFabricCostRun(project) {
  const sizes = project.grading?.sizes?.length ? project.grading.sizes : [project.grading?.baseSize || 'M']
  const currency = project.productionSpec?.currency || 'USD'
  const rows = []
  for (const size of sizes) {
    const graded = gradeProject(project, size)
    const markers = buildFabricMarkers(graded,
      Number(project.markerSettings?.fabricWidthCm ?? 150),
      Number(project.markerSettings?.gapCm ?? 1.5))
    for (const [fabricId, marker] of Object.entries(markers)) {
      const fabric = project.fabrics?.[fabricId]
      const price = suppliedPrice(fabric)
      const complete = marker.unusedPieces === 0 && marker.placements.length === marker.requestedPieces
      const lengthMeters = marker.length / 100
      rows.push({
        size, fabricId, material: fabric?.name || fabricId, currency,
        widthCm: marker.width, lengthMeters, efficiency: marker.efficiency,
        pricePerMeter: price, cutPiecesRequested: marker.requestedPieces,
        cutPiecesPlaced: marker.placements.length, complete,
        extendedCost: complete && price !== null ? Number((lengthMeters * price).toFixed(4)) : null,
        status: !complete ? 'INCOMPLETE_MARKER' : price === null ? 'PRICE_NOT_SET' : 'ESTIMATED',
      })
    }
  }
  const totals = sizes.map((size) => {
    const entries = rows.filter((row) => row.size === size)
    const ready = entries.length > 0 && entries.every((row) => row.status === 'ESTIMATED')
    return { size, currency, ready, materialCost: ready ? Number(entries.reduce((sum, row) => sum + row.extendedCost, 0).toFixed(4)) : null }
  })
  return { currency, rows, totals, basis: 'one cut-piece set per size; fabric only; excludes waste allowance beyond marker and labor, shipping, dyeing, taxes and trim costs', factoryCertified: false }
}

function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"` }

export function fabricCostRunToCsv(report) {
  const rows = [[
    'Size', 'Fabric ID', 'Material', 'Currency', 'Fabric width cm',
    'Marker length m', 'Marker efficiency %', 'Price per meter',
    'Pieces requested', 'Pieces placed', 'Estimated fabric cost', 'Status',
  ]]
  for (const row of report.rows) {
    rows.push([
      row.size, row.fabricId, row.material, row.currency, row.widthCm.toFixed(2),
      row.lengthMeters.toFixed(4), (row.efficiency * 100).toFixed(1),
      row.pricePerMeter === null ? '' : row.pricePerMeter.toFixed(2),
      row.cutPiecesRequested, row.cutPiecesPlaced,
      row.extendedCost === null ? '' : row.extendedCost.toFixed(2), row.status,
    ])
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}
