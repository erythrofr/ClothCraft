import { strToU8, zipSync } from 'fflate'
import { buildSizeRun, gradeProject } from './grading.js'
import { buildFabricMarkers } from './marker.js'
import { buildTechPack, measurementRunToCSV } from './measurements.js'
import { projectToDxf } from './dxf.js'
import { pieceArea, seamLengthReport } from './project.js'
import { inspectProduction } from './productionPreflight.js'
import { projectToBomXml } from './bomXml.js'
import { markerToPdf, markerToSvg } from './markerArtifacts.js'
import { buildFabricCostRun, fabricCostRunToCsv } from './productionCost.js'
import { normalizeWashSpec } from './clothWashProcedurals.js'

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function csv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function slug(value) {
  return String(value || 'garment').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'garment'
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function htmlTable(rows, options = {}) {
  const [header = [], ...body] = rows
  return `<table class="${options.className || ''}"><thead><tr>${header.map((cell) => `<th>${htmlEscape(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${htmlEscape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

function materialRows(project) {
  const rows = [[
    'Fabric ID', 'Material', 'Color', 'GSM', 'Thickness mm',
    'Warp stretch %', 'Weft stretch %', 'Warp shrink %', 'Weft shrink %',
    'Bending', 'Friction', 'Damping', 'Roughness', 'Sheen', 'Opacity', 'Surface family', 'Visual displacement mm',
    'Color map', 'Normal map', 'Roughness map', 'Metalness map', 'Opacity map', 'Displacement map',
    'Digital wash effect', 'Digital wash strength', 'Visual blend', 'Absorbency look', 'Wear cycle look',
    'UV-edge fade', 'Digital wash placement', 'Wash reference disclaimer',
    'Cut pieces', 'Approx pattern area cm2',
  ]]
  for (const [fabricId, fabric] of Object.entries(project.fabrics || {})) {
    const pieces = (project.pieces || []).filter((piece) => (piece.fabricId || 'main') === fabricId)
    const cutPieces = pieces.reduce((sum, piece) => sum + Math.max(1, Math.round(Number(piece.cutQuantity || 1))), 0)
    const area = pieces.reduce((sum, piece) => sum + pieceArea(piece) * Math.max(1, Math.round(Number(piece.cutQuantity || 1))), 0)
    rows.push([
      fabricId,
      fabric.name || fabricId,
      fabric.color || '',
      fabric.gsm ?? '',
      Number.isFinite(Number(fabric.thickness)) ? (Number(fabric.thickness) * 1000).toFixed(2) : '',
      Number.isFinite(Number(fabric.stretchWarp)) ? (Number(fabric.stretchWarp) * 100).toFixed(1) : '',
      Number.isFinite(Number(fabric.stretchWeft)) ? (Number(fabric.stretchWeft) * 100).toFixed(1) : '',
      Number.isFinite(Number(fabric.shrinkWarp)) ? (Number(fabric.shrinkWarp) * 100).toFixed(1) : '',
      Number.isFinite(Number(fabric.shrinkWeft)) ? (Number(fabric.shrinkWeft) * 100).toFixed(1) : '',
      Number.isFinite(Number(fabric.bend)) ? Number(fabric.bend).toFixed(3) : '',
      Number.isFinite(Number(fabric.friction)) ? Number(fabric.friction).toFixed(3) : '',
      Number.isFinite(Number(fabric.damping)) ? Number(fabric.damping).toFixed(4) : '',
      Number.isFinite(Number(fabric.roughness)) ? Number(fabric.roughness).toFixed(3) : '',
      Number.isFinite(Number(fabric.sheen)) ? Number(fabric.sheen).toFixed(3) : '',
      Number.isFinite(Number(fabric.opacity ?? 1)) ? Number(fabric.opacity ?? 1).toFixed(3) : '',
      fabric.surfaceFamily || 'auto',
      Number.isFinite(Number(fabric.displacementMm ?? 0)) ? Number(fabric.displacementMm ?? 0).toFixed(2) : '',
      fabric.texture?.name || '',
      fabric.texture?.normalName || '',
      fabric.texture?.roughnessName || '',
      fabric.texture?.metalnessName || '',
      fabric.texture?.opacityName || '',
      fabric.texture?.displacementName || '',
      normalizeWashSpec(fabric.wash).type,
      normalizeWashSpec(fabric.wash).strength.toFixed(2),
      normalizeWashSpec(fabric.wash).blend,
      normalizeWashSpec(fabric.wash).absorbency.toFixed(2),
      normalizeWashSpec(fabric.wash).cycleDuration.toFixed(2),
      normalizeWashSpec(fabric.wash).seamAbrasion.toFixed(2),
      JSON.stringify({scale:normalizeWashSpec(fabric.wash).scale,placement:normalizeWashSpec(fabric.wash).placement,rotation:normalizeWashSpec(fabric.wash).rotation,seed:normalizeWashSpec(fabric.wash).seed}),
      'Digital appearance target only; manufacturer must physically sample and approve',
      cutPieces,
      area.toFixed(1),
    ])
  }
  return rows
}

function pieceRows(project) {
  const rows = [[
    'Piece ID', 'Pattern piece', 'Role', 'Attached / fused to', 'Fabric ID', 'Cut quantity', 'Seam allowance cm',
    'Grain angle deg', 'Layer', 'Area cm2', 'Notches', 'Internal lines',
    'Topstitch specs', 'Bindings', 'Graphics', 'Custom grade points', 'Custom edge allowances', 'Matched notches',
  ]]
  for (const piece of project.pieces || []) {
    rows.push([
      piece.id,
      piece.name,
      piece.generatedRole || 'shell',
      piece.fusedToPieceId || piece.liningForPieceId || '',
      piece.fabricId || 'main',
      Math.max(1, Math.round(Number(piece.cutQuantity || 1))),
      Number(piece.seamAllowance || 0).toFixed(2),
      Number(piece.grainAngleDeg || 0).toFixed(1),
      Math.round(Number(piece.layerIndex || 0)),
      pieceArea(piece).toFixed(1),
      (piece.notches || []).length,
      (piece.internalLines || []).length,
      (piece.topstitches || []).length,
      (piece.bindings || []).length,
      (piece.graphics || []).length,
      (piece.points || []).filter((point) => point.gradeRule?.enabled).length,
      Object.keys(piece.edgeSeamAllowances || {}).length,
      (piece.notches || []).filter((notch) => notch.matchGroupId).length,
    ])
  }
  return rows
}

function constructionRows(project) {
  const rows = [[
    'Seam ID', 'Construction', 'Type', 'A piece', 'A edge', 'B piece', 'B edge',
    'A start %', 'A end %', 'B start %', 'B end %',
    'Reverse B', 'Treatment ratio', 'Ease/gather side', 'Open fraction',
    'A length cm', 'B length cm', 'Difference cm', 'Mismatch %', 'Status',
  ]]
  for (const seam of project.seams || []) {
    const report = seamLengthReport(project, seam)
    rows.push([
      seam.id,
      seam.name || seam.id,
      seam.type || 'normal',
      seam.a?.pieceId || '',
      seam.a?.edgeIndex ?? '',
      seam.b?.pieceId || '',
      seam.b?.edgeIndex ?? '',
      ((seam.a?.startT ?? 0) * 100).toFixed(1),
      ((seam.a?.endT ?? 1) * 100).toFixed(1),
      ((seam.b?.startT ?? 0) * 100).toFixed(1),
      ((seam.b?.endT ?? 1) * 100).toFixed(1),
      seam.reverseB ? 'yes' : 'no',
      seam.ratio ?? '',
      seam.easeSide || seam.gatherSide || '',
      seam.openFraction ?? '',
      report.lengthA.toFixed(2),
      report.lengthB.toFixed(2),
      report.difference.toFixed(2),
      report.mismatchPercent.toFixed(2),
      report.status,
    ])
  }
  return rows
}

function markerRows(project) {
  const width = project.markerSettings?.fabricWidthCm ?? 150
  const gap = project.markerSettings?.gapCm ?? 1.5
  const sizes = project.grading?.sizes || [project.grading?.baseSize || 'M']
  const rows = [['Size', 'Fabric ID', 'Material', 'Fabric width cm', 'Gap cm', 'Marker length cm', 'Efficiency %', 'Requested pieces', 'Placed pieces', 'Unplaced pieces', 'Unplaced detail']]
  for (const size of sizes) {
    const graded = gradeProject(project, size)
    const markers = buildFabricMarkers(graded, width, gap)
    for (const [fabricId, marker] of Object.entries(markers)) {
      rows.push([
        size,
        fabricId,
        project.fabrics?.[fabricId]?.name || fabricId,
        marker.width.toFixed(1),
        marker.gap.toFixed(1),
        marker.length.toFixed(2),
        (marker.efficiency * 100).toFixed(1),
        marker.requestedPieces,
        marker.placements.length,
        marker.unusedPieces,
        (marker.unplaced || []).map((item) => `${item.name}${item.minimumWidthCm ? ` needs >=${item.minimumWidthCm.toFixed(1)} cm` : ''}`).join('; '),
      ])
    }
  }
  return rows
}

function trimHardware(project) {
  return {
    pointFasteners: project.fasteners || [],
    zippers: (project.pieces || []).flatMap((piece) => (piece.zippers || []).map((zipper) => ({ pieceId: piece.id, ...zipper }))),
    buttons: (project.pieces || []).flatMap((piece) => (piece.buttons || []).map((button) => ({ pieceId: piece.id, ...button }))),
    buttonholes: (project.pieces || []).flatMap((piece) => (piece.buttonholes || []).map((buttonhole) => ({ pieceId: piece.id, ...buttonhole }))),
    bindings: (project.pieces || []).flatMap((piece) => (piece.bindings || []).map((binding) => ({ pieceId: piece.id, ...binding }))),
    topstitches: (project.pieces || []).flatMap((piece) => (piece.topstitches || []).map((stitch) => ({ pieceId: piece.id, ...stitch }))),
  }
}

function factorySpecHtml(project) {
  const techPack = buildTechPack(project)
  const sizes = project.grading?.sizes || [project.grading?.baseSize || 'M']
  const measurements = techPack.sizeMeasurements || {}
  const pomIds = measurements[sizes[0]]?.map((measurement) => measurement.id) || []
  const pomRows = [['POM', 'Tolerance', ...sizes]]
  for (const id of pomIds) {
    const first = measurements[sizes[0]]?.find((measurement) => measurement.id === id)
    pomRows.push([
      first?.label || id,
      `±${first?.toleranceCm ?? ''} cm`,
      ...sizes.map((size) => `${measurements[size]?.find((measurement) => measurement.id === id)?.cm ?? ''}`),
    ])
  }
  const seamRows = constructionRows(project)
  const markerSummary = markerRows(project)
  const fabricCostReport = buildFabricCostRun(project)
  const costRows = [['Size', 'Fabric', 'Length m', 'Unit price/m', 'Fabric cost', 'Status'], ...fabricCostReport.rows.map((row) => [
    row.size, row.material, row.lengthMeters.toFixed(2), row.pricePerMeter === null ? 'Not set' : `${row.currency} ${row.pricePerMeter.toFixed(2)}`,
    row.extendedCost === null ? 'Not available' : `${row.currency} ${row.extendedCost.toFixed(2)}`, row.status,
  ])]
  const materials = materialRows(project)
  const pieces = pieceRows(project)
  const warnings = (project.seams || [])
    .map((seam) => ({ seam, report: seamLengthReport(project, seam) }))
    .filter(({ report }) => report.status !== 'good')
  const markerWarnings = []
  for (const [size, markerSet] of Object.entries(techPack.markers || {})) {
    for (const [fabricId, marker] of Object.entries(markerSet.byFabric || {})) {
      if (!marker.unusedPieces) continue
      markerWarnings.push({
        size,
        fabricId,
        material: project.fabrics?.[fabricId]?.name || fabricId,
        unplaced: marker.unplaced || [],
      })
    }
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${htmlEscape(project.name)} · Factory Spec</title><style>
@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:10px}h1{font-size:24px;margin:0 0 3px}h2{font-size:14px;margin:22px 0 7px;border-bottom:1px solid #111;padding-bottom:4px}.meta{display:flex;gap:28px;margin:0 0 18px;color:#444}.meta strong{color:#111}.notice{padding:8px 10px;border:1px solid #ccc;background:#f6f6f6;margin:8px 0}.warning{border-color:#b67a28;background:#fff8ea}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}table{width:100%;border-collapse:collapse;margin:0 0 12px;page-break-inside:auto}th,td{border:1px solid #bbb;padding:4px 5px;vertical-align:top;text-align:left}th{background:#efefef;font-size:9px}td{font-size:9px}tr{page-break-inside:avoid}.small td,.small th{font-size:8px}.footer{margin-top:18px;font-size:8px;color:#666}.page-break{page-break-before:always}@media print{h2{page-break-after:avoid}}
</style></head><body>
<h1>${htmlEscape(project.name)}</h1>
<div class="meta"><span><strong>Revision:</strong> ${htmlEscape(project.revision ?? 1)}</span><span><strong>Base size:</strong> ${htmlEscape(project.grading?.baseSize || 'M')}</span><span><strong>Size range:</strong> ${htmlEscape(sizes.join(' / '))}</span><span><strong>Units:</strong> ${htmlEscape(project.units || 'cm')}</span></div>
<div class="notice">This sheet is generated from the editable Garment Studio document. Verify physical samples, material lots, seam construction, shrinkage, and tolerances before bulk production.</div>
${warnings.length ? `<div class="notice warning"><strong>Seam review:</strong> ${warnings.length} seam${warnings.length === 1 ? '' : 's'} exceed the 2% matched-edge threshold. Review the Construction table before sewing.</div>` : ''}
${markerWarnings.length ? `<div class="notice warning"><strong>Marker review:</strong> ${htmlEscape(markerWarnings.map((item) => `${item.size} ${item.material}: ${item.unplaced.map((entry) => `${entry.name}${entry.minimumWidthCm ? ` needs ≥${entry.minimumWidthCm.toFixed(1)} cm` : ''}`).join(', ')}`).join(' · '))}. These marker lengths are incomplete until every requested piece is placed.</div>` : ''}
<h2>Point of Measurement · Full Size Run</h2>${htmlTable(pomRows)}
<div class="page-break"></div><h2>Materials / BOM</h2>${htmlTable(materials)}
<h2>Pattern Pieces</h2>${htmlTable(pieces, { className: 'small' })}
<div class="page-break"></div><h2>Construction / Seam Diagnostics</h2>${htmlTable(seamRows, { className: 'small' })}
<h2>Marker Summary</h2>${htmlTable(markerSummary)}
<h2>Estimated Fabric Consumption & Costs</h2><div class="notice">Per garment size, from the current cutting marker. Missing prices and incomplete markers are not assumed free. Excludes trims, labor, taxes, shipping, shrinkage allowance and physical sampling.</div>${htmlTable(costRows)}
<h2>Avatar / Fit Reference</h2>${htmlTable([
    ['Height cm', 'Chest cm', 'Waist cm', 'Hip cm', 'Shoulder width cm', 'Neck cm', 'Bicep cm', 'Arm length cm', 'Arm pose deg'],
    [project.avatar?.heightCm ?? '', project.avatar?.chestCm ?? '', project.avatar?.waistCm ?? '', project.avatar?.hipCm ?? '', project.avatar?.shoulderWidthCm ?? 46, project.avatar?.neckCm ?? 38, project.avatar?.bicepCm ?? 32, project.avatar?.armLengthCm ?? Number((72 * Number(project.avatar?.heightCm ?? 180) / 180).toFixed(1)), project.avatar?.armAngleDeg ?? ''],
  ])}
<div class="footer">DXF files, trims/hardware data, graded source data, and the editable garment document are included alongside this sheet in the factory package.</div>
</body></html>`
}

export function buildFactoryPackageFiles(project) {
  const nameSlug = slug(project.name)
  const sizes = project.grading?.sizes || [project.grading?.baseSize || 'M']
  const files = {}
  const addText = (path, text) => { files[path] = strToU8(text) }
  const markerWidth = project.markerSettings?.fabricWidthCm ?? 150
  const markerGap = project.markerSettings?.gapCm ?? 1.5

  addText('README.txt', [
    `GARMENT STUDIO FACTORY PACKAGE`,
    `Project: ${project.name}`,
    `Revision: ${project.revision ?? 1}`,
    `Units: ${project.units || 'cm'}`,
    `Base size: ${project.grading?.baseSize || 'M'}`,
    `Sizes: ${sizes.join(', ')}`,
    '',
    'CONTENTS',
    '- tech-pack.json: structured production specification and full POM size run',
    '- factory-spec.html: print-ready human-readable factory sheet',
    '- pom-spec.csv: point-of-measurement table with tolerances across sizes',
    '- materials-bom.csv: materials, physical properties, cut quantities, and approximate usage area',
    '- fabric-costing.csv: graded fabric meter consumption and optional supplier prices (null until entered)',
    '- bom.xml: open Garment Studio XML BOM (not proprietary CLO XML)',
    '- production-preflight.json: structural checks and all-size marker overflow report',
    '- pattern-pieces.csv: pattern production metadata and custom grading rule counts',
    '- construction-seams.csv: sewing graph, treatment settings, edge lengths, and mismatch diagnostics',
    '- marker-summary.csv: marker length and efficiency for every graded size',
    '- trims-hardware.json: fasteners, zippers, buttons, buttonholes, bindings, and topstitch specifications',
    '- size-run.json: complete graded garment data for every configured size',
    '- garment-source.json: editable Garment Studio source document',
    '- patterns/*.dxf: production DXF for every configured size',
    '- markers/*.svg: true-size vector print-layout drawings',
    '- markers/*.pdf: true-size plotter PDF (when any pattern fits; print at 100%)',
    '',
    `Marker settings: ${markerWidth} cm default fabric width, ${markerGap} cm gap. Per-fabric widths: ${JSON.stringify(project.markerSettings?.fabricWidthsCm || {})}.`,
    'Review seam mismatch warnings/errors and marker overflow before bulk production. Sample physically before bulk production.',
  ].join('\n'))

  addText('tech-pack.json', JSON.stringify(buildTechPack(project), null, 2))
  addText('factory-spec.html', factorySpecHtml(project))
  addText('pom-spec.csv', measurementRunToCSV(project))
  addText('materials-bom.csv', csv(materialRows(project)))
  addText('fabric-costing.csv', fabricCostRunToCsv(buildFabricCostRun(project)))
  addText('bom.xml', projectToBomXml(project))
  addText('production-preflight.json', JSON.stringify(inspectProduction(project), null, 2))
  addText('pattern-pieces.csv', csv(pieceRows(project)))
  addText('construction-seams.csv', csv(constructionRows(project)))
  addText('marker-summary.csv', csv(markerRows(project)))
  addText('trims-hardware.json', JSON.stringify(trimHardware(project), null, 2))
  addText('size-run.json', JSON.stringify(buildSizeRun(project), null, 2))
  addText('garment-source.json', JSON.stringify(project, null, 2))

  for (const size of sizes) {
    const graded = gradeProject(project, size)
    addText(`patterns/${nameSlug}-${String(size).toLowerCase()}.dxf`, projectToDxf(graded, size))
    const markerSet = buildFabricMarkers(graded, markerWidth, markerGap)
    for (const [fabricId, marker] of Object.entries(markerSet)) {
      const filename = `markers/${nameSlug}-${slug(fabricId)}-${slug(size)}`
      addText(`${filename}.svg`, markerToSvg(marker, { size, fabricName: project.fabrics?.[fabricId]?.name || fabricId, project: graded }))
      if (marker.placements.length && marker.length > 0) files[`${filename}.pdf`] = markerToPdf(marker, { size, project: graded })
    }
  }

  const manifest = {
    format: 'garment-studio-factory-package',
    version: 1,
    project: { id: project.id, name: project.name, revision: project.revision, units: project.units || 'cm' },
    grading: { baseSize: project.grading?.baseSize || 'M', sizes },
    marker: { fabricWidthCm: markerWidth, gapCm: markerGap, fabricWidthsCm: { ...(project.markerSettings?.fabricWidthsCm || {}) } },
    files: [...Object.keys(files), 'manifest.json'].sort(),
  }
  addText('manifest.json', JSON.stringify(manifest, null, 2))
  return files
}

export function buildFactoryPackageZip(project) {
  return zipSync(buildFactoryPackageFiles(project), { level: 6 })
}
