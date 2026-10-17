import { createDefaultProject } from '../src/data/defaultProject.js'
import { buildSizeRun, gradeProject } from '../src/core/grading.js'
import { buildMarker } from '../src/core/marker.js'
import { projectToDxf } from '../src/core/dxf.js'
import { buildTechPack, measurementRunToCSV } from '../src/core/measurements.js'

const project = createDefaultProject()
project.pieces[0].points[0].gradeRule = { enabled: true, dxPerSize: 2, dyPerSize: -0.5 }
const matchedFrontNotch = project.pieces.find((piece) => piece.id === 'front')?.notches?.find((notch) => notch.id === 'front-right-armhole-notch')
const matchedSleeveNotch = project.pieces.find((piece) => piece.id === 'sleeve-right')?.notches?.find((notch) => notch.id === 'right-sleeve-front-notch')
if (matchedFrontNotch && matchedSleeveNotch) {
  matchedFrontNotch.matchGroupId = 'qa-notch-match'
  matchedFrontNotch.matchedSeamId = 'seam-sleeve-r-front-lower'
  matchedSleeveNotch.matchGroupId = 'qa-notch-match'
  matchedSleeveNotch.matchedSeamId = 'seam-sleeve-r-front-lower'
}
project.customMeasurements = [{
  id: 'qa-custom-pom',
  pieceId: project.pieces[0].id,
  label: 'QA custom POM',
  a: { x: -18, y: 52 },
  b: { x: 18, y: 28 },
  toleranceCm: 0.4,
}]
project.pieces[0].internalLines = [
  { id: 'qa-fold', type: 'fold', a: { x: -12, y: 8 }, b: { x: -12, y: 46 } },
  { id: 'qa-dart', type: 'dart', widthCm: 2.5, a: { x: 10, y: 4 }, b: { x: 7, y: 28 } },
]
const sizeRun = buildSizeRun(project)

if (Object.keys(sizeRun).length !== project.grading.sizes.length) {
  throw new Error('Size run did not generate every configured size')
}

const measurementCsv = measurementRunToCSV(project)
if (!measurementCsv.includes('Body length') || !measurementCsv.includes('Sleeve length') || !measurementCsv.includes('QA custom POM') || !measurementCsv.includes('XXL')) {
  throw new Error('Measurement CSV is missing required POM or size data')
}

const techPack = buildTechPack(project)
if (!techPack.sizeMeasurements?.M?.length || techPack.patternPieces.length !== project.pieces.length || techPack.construction.length !== project.seams.length) {
  throw new Error('Tech pack is missing measurements, pattern pieces, or construction data')
}
if (techPack.patternPieces[0]?.gradePoints?.[0]?.rule?.dxPerSize !== 2 || techPack.customMeasurements?.[0]?.label !== 'QA custom POM') {
  throw new Error('Tech pack is missing custom grade-point or custom measurement data')
}
const exportedMatchedNotches = techPack.patternPieces.flatMap((piece) => piece.notches || []).filter((notch) => notch.matchGroupId === 'qa-notch-match')
if (exportedMatchedNotches.length !== 2 || exportedMatchedNotches.some((notch) => notch.matchedSeamId !== 'seam-sleeve-r-front-lower')) {
  throw new Error('Tech pack lost matched seam-notch metadata')
}
const gradedL = gradeProject(project, 'L')
const gradedXL = gradeProject(project, 'XL')
if (Math.abs(gradedL.pieces[0].points[0].x - (project.pieces[0].points[0].x + 2)) > 1e-6) {
  throw new Error('Per-point grading did not apply one size step to L')
}
if (Math.abs(gradedXL.pieces[0].points[0].x - (project.pieces[0].points[0].x + 4)) > 1e-6) {
  throw new Error('Per-point grading did not accumulate two size steps to XL')
}

const reports = []
for (const size of project.grading.sizes) {
  const graded = gradeProject(project, size)
  const marker = buildMarker(graded, 150, 1.5)
  const dxf = projectToDxf(graded, size)
  const badNumber = /(?:NaN|Infinity)/.test(dxf)
  const hasCut = dxf.includes('CUT_')
  const hasAllowance = dxf.includes('SA_')
  const hasNotch = dxf.includes('NOTCH_')
  const hasGrain = dxf.includes('GRAIN_')
  const hasInternal = dxf.includes('INTERNAL_FOLD_') && dxf.includes('INTERNAL_DART_') && dxf.includes('DART_CENTER_')
  const hasEOF = dxf.trim().endsWith('EOF')
  if (badNumber || !hasCut || !hasAllowance || !hasNotch || !hasGrain || !hasInternal || !hasEOF) {
    throw new Error(`Production export failed validation for size ${size}`)
  }
  reports.push({
    size,
    markerLengthCm: Number(marker.length.toFixed(2)),
    markerEfficiency: Number((marker.efficiency * 100).toFixed(1)),
    dxfBytes: Buffer.byteLength(dxf),
  })
}

console.log(JSON.stringify({ sizes: reports }, null, 2))
