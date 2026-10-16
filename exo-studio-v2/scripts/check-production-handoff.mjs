import assert from 'node:assert/strict'
import { XMLParser } from 'fast-xml-parser'
import { unzipSync, strFromU8 } from 'fflate'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { buildFabricMarkers } from '../src/core/marker.js'
import { inspectProduction } from '../src/core/productionPreflight.js'
import { markerToPdf, markerToSvg } from '../src/core/markerArtifacts.js'
import { projectToBomXml } from '../src/core/bomXml.js'
import { buildFactoryPackageZip } from '../src/core/factoryPackage.js'
import { parseDxfPatterns, projectToDxf } from '../src/core/dxf.js'
import { buildFabricCostRun, fabricCostRunToCsv } from '../src/core/productionCost.js'

const project = createDefaultProject()
let materialCosts = buildFabricCostRun(project)
assert.ok(materialCosts.rows.every((item) => item.pricePerMeter === null && item.extendedCost === null), 'Missing supplier price must never be zero-cost')
assert.ok(materialCosts.totals.every((item) => item.ready === false))
const pricedProject = structuredClone(project)
pricedProject.fabrics.main.pricePerMeter = 19.75
materialCosts = buildFabricCostRun(pricedProject)
assert.ok(materialCosts.rows.every((item) => item.extendedCost !== null && item.status === 'ESTIMATED'))
assert.ok(Math.abs(materialCosts.rows[0].extendedCost - materialCosts.rows[0].lengthMeters * 19.75) < .0001)
assert.ok(fabricCostRunToCsv(materialCosts).includes('19.75'))
const onePieceDxf = projectToDxf({ ...project, pieces: [project.pieces[0]] }, project.grading.baseSize)
assert.equal(parseDxfPatterns(onePieceDxf).pieces.length, 1, 'Selected-pattern export must produce exactly one closed CAD piece')
const initial = inspectProduction(project)
assert.equal(initial.blockers, 0, `Default project should not contain hard production blockers: ${JSON.stringify(initial.issues)}`)
assert.equal(initial.factoryCertified, false)
assert.equal(initial.markerSummary.length, (project.grading.sizes || []).length)
assert.ok(initial.warnings >= 0)

const broken = structuredClone(project)
broken.pieces[0].fabricId = 'fabric-does-not-exist'
broken.pieces[0].cutQuantity = 0
broken.seams[0].a.pieceId = 'missing'
let issues = inspectProduction(broken)
for (const code of ['MISSING_FABRIC', 'CUT_QUANTITY', 'BROKEN_SEAM']) {
  assert.ok(issues.issues.some((issue) => issue.code === code), `${code} not detected`)
}

const crossing = structuredClone(project)
crossing.pieces[0].points = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }]
crossing.pieces[0].curves = {}
issues = inspectProduction(crossing)
assert.ok(issues.issues.some((issue) => issue.code === 'SELF_INTERSECTION'))

const invalid = structuredClone(project)
invalid.pieces[0].points[0].x = Number.NaN
issues = inspectProduction(invalid)
assert.ok(issues.issues.some((issue) => issue.code === 'INVALID_GEOMETRY'))

const hoodie = createZipHoodieTemplate()
hoodie.markerSettings = { fabricWidthCm: 165, gapCm: 2, fabricWidthsCm: { main: 165, rib: 90 } }
const narrow = inspectProduction(hoodie)
assert.ok(narrow.issues.some((issue) => issue.code === 'MARKER_OVERFLOW' && issue.scope.includes('rib')))
const markers = buildFabricMarkers(project, 150, 1.5)
const marker = markers.main
const pdf = markerToPdf(marker, { size: 'M', project })
const pdfText = new TextDecoder().decode(pdf)
assert.ok(pdfText.startsWith('%PDF-1.4\n'))
assert.ok(pdfText.includes(`/MediaBox [0 0 ${Number((marker.width * 72 / 2.54).toFixed(4))}`))
assert.ok(pdfText.includes('xref\n') && pdfText.endsWith('%%EOF\n'))
const svg = markerToSvg(marker, { size: 'M', fabricName: 'Test & Co', project })
assert.ok(svg.includes(`width="${marker.width}cm"`))
assert.ok(svg.includes('&amp; Co') && svg.includes('<polygon'))
assert.ok(svg.includes('id="grain-lines"') && svg.includes('id="notch-marks"'))
assert.ok(svg.includes('<line '), 'Grainline must be physically placed on the fabric marker')

const longMarker = { ...marker, length: 920 }
const longPdf = new TextDecoder().decode(markerToPdf(longMarker, { size: 'M' }))
assert.ok(longPdf.includes('/Count 3'), 'Long plot should be divided into 3 full-size pages')

const xml = projectToBomXml(hoodie)
const bom = new XMLParser({ ignoreAttributes: false }).parse(xml).GarmentStudioBOM
assert.equal(bom['@_schemaVersion'], '1.0')
assert.ok(bom.Fabrics.Fabric.length >= 2)
assert.ok(bom.TrimsAndConstruction)
assert.ok(bom.FabricCostEstimates)
assert.ok(xml.includes('cutQuantityPerGarment'))

const files = unzipSync(buildFactoryPackageZip(hoodie))
const preflight = JSON.parse(strFromU8(files['production-preflight.json']))
assert.equal(preflight.status, 'BLOCKED')
assert.ok(files['bom.xml'] && files['materials-bom.csv'])
assert.ok(files['fabric-costing.csv'])
assert.ok(Object.keys(files).filter((file) => file.endsWith('.svg') && file.startsWith('markers/')).length >= 12)
assert.ok(Object.keys(files).filter((file) => file.endsWith('.pdf') && file.startsWith('markers/')).length >= 12)
assert.ok(strFromU8(files['README.txt']).includes('print at 100%'))
console.log(JSON.stringify({ defaultPreflight: { blockers: initial.blockers, warnings: initial.warnings }, overflowBlockers: narrow.blockers, markerPDFBytes: pdf.length, packagedFiles: Object.keys(files).length }, null, 2))
