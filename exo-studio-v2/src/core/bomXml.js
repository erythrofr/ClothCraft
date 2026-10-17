import { pieceArea } from './project.js'
import { buildFabricCostRun } from './productionCost.js'

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch])
const attr = (key, value) => ` ${key}="${esc(value)}"`
const element = (name, attributes, contents = '') => `<${name}${Object.entries(attributes).map(([key, value]) => attr(key, value)).join('')}>${contents}</${name}>`
const dec = (value, places = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(places) : ''
const count = (value) => Math.max(1, Math.round(Number(value ?? 1)))

// Open Garment Studio manufacturing interchange schema, intentionally NOT a
// proprietary CLO BOM schema. External importers should use our XML fields.
export function projectToBomXml(project) {
  const costRun = buildFabricCostRun(project)
  const fabrics = Object.entries(project.fabrics || {}).map(([id, fabric]) => {
    const cutPieces = (project.pieces || []).filter((piece) => (piece.fabricId || 'main') === id)
    const totalCuts = cutPieces.reduce((sum, piece) => sum + count(piece.cutQuantity), 0)
    const totalArea = cutPieces.reduce((sum, piece) => sum + pieceArea(piece) * count(piece.cutQuantity), 0)
    return element('Fabric', {
      id, name: fabric.name || id, color: fabric.color || '', gsm: fabric.gsm ?? '',
      thicknessMm: dec(Number(fabric.thickness ?? 0) * 1000, 2),
      cutQuantityPerGarment: totalCuts, patternAreaCm2: dec(totalArea, 2),
      pricePerMeter: fabric.pricePerMeter == null ? '' : dec(fabric.pricePerMeter, 2),
      priceCurrency: costRun.currency,
      stretchWarpPct: dec(Number(fabric.stretchWarp ?? 0) * 100, 2),
      stretchWeftPct: dec(Number(fabric.stretchWeft ?? 0) * 100, 2),
      shrinkWarpPct: dec(Number(fabric.shrinkWarp ?? 0) * 100, 2),
      shrinkWeftPct: dec(Number(fabric.shrinkWeft ?? 0) * 100, 2),
    }, cutPieces.map((piece) => element('Pattern', {
      id: piece.id, name: piece.name || piece.id, cutQuantity: count(piece.cutQuantity),
      seamAllowanceCm: dec(piece.seamAllowance ?? 0, 2),
    })).join(''))
  }).join('')

  const trims = []
  for (const item of project.fasteners || []) trims.push(element('Trim', { type: item.type || 'fastener', id: item.id || '', quantityPerGarment: 1, specification: item.name || '' }))
  for (const piece of project.pieces || []) {
    const qty = count(piece.cutQuantity)
    for (const kind of ['zippers', 'buttons', 'buttonholes', 'bindings', 'topstitches']) {
      for (const item of piece[kind] || []) {
        trims.push(element('Trim', {
          type: kind, id: item.id || '', patternId: piece.id,
          quantityPerGarment: qty, description: item.name || item.type || '',
          lengthCm: item.lengthCm ?? '',
        }))
      }
    }
  }
  const fabricCosts = costRun.rows.map((row) => element('EstimatedFabricCost', {
    size: row.size, fabricId: row.fabricId, lengthMeters: dec(row.lengthMeters, 4),
    pricePerMeter: row.pricePerMeter == null ? '' : dec(row.pricePerMeter, 2),
    currency: row.currency, amount: row.extendedCost == null ? '' : dec(row.extendedCost, 2),
    status: row.status,
  })).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n${element('GarmentStudioBOM', {
    schemaVersion: '1.0', projectId: project.id || '', projectName: project.name || '',
    revision: project.revision ?? 1, baseSize: project.grading?.baseSize || 'M',
    patternUnits: 'cm', usageBasis: 'one finished garment',
  }, element('Fabrics', {}, fabrics) + element('TrimsAndConstruction', {}, trims.join('')) + element('FabricCostEstimates', { currency: costRun.currency, basis: 'per garment, excludes trims and labor' }, fabricCosts))}\n`
}
