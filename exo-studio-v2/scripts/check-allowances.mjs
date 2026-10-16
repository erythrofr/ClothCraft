import { getEdgeSeamAllowance, seamAllowanceBoundary } from '../src/core/project.js'
import { buildMarker } from '../src/core/marker.js'
import { projectToDxf } from '../src/core/dxf.js'
import { buildTechPack } from '../src/core/measurements.js'

const piece = {
  id: 'allowance-rect',
  name: 'Allowance Rect',
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
  curves: {},
  layout2d: { x: 0, y: 0 },
  seamAllowance: 1,
  edgeSeamAllowances: { 0: 4, 1: 0.5 },
  grainAngleDeg: 0,
  cutQuantity: 1,
  fabricId: 'main',
}
const project = {
  id: 'qa-allowance', name: 'Allowance QA', revision: 1, units: 'cm', previewSize: 'M',
  pieces: [piece], seams: [], fasteners: [], customMeasurements: [],
  fabrics: { main: { id: 'main', name: 'QA Fabric', color: '#888888', gsm: 200, thickness: 0.002, stretchWarp: 0.05, stretchWeft: 0.05 } },
  grading: { baseSize: 'M', sizes: ['M'], widthPerSizeCm: 0, lengthPerSizeCm: 0 },
  markerSettings: { fabricWidthCm: 100, gapCm: 1.5 },
  avatar: { heightCm: 180, chestCm: 96, waistCm: 78, hipCm: 94, armAngleDeg: 6 },
}

const boundary = seamAllowanceBoundary(piece, 2)
const xs = boundary.map((point) => point.x)
const ys = boundary.map((point) => point.y)
const expected = { minX: -1, maxX: 10.5, minY: -4, maxY: 11 }
const actual = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
for (const key of Object.keys(expected)) if (Math.abs(actual[key] - expected[key]) > 1e-6) throw new Error(`Variable allowance ${key} ${actual[key]} != ${expected[key]}`)
if (getEdgeSeamAllowance(piece, 0) !== 4 || getEdgeSeamAllowance(piece, 1) !== 0.5 || getEdgeSeamAllowance(piece, 2) !== 1) throw new Error('Effective edge allowances are incorrect')

const marker = buildMarker(project, 100, 1.5)
const placement = marker.placements[0]
if (!placement || Math.abs(placement.width - 11.5) > 1e-6 || Math.abs(placement.height - 15) > 1e-6) throw new Error(`Marker ignored variable allowance: ${placement?.width} x ${placement?.height}`)

const dxf = projectToDxf(project, 'M')
if (/NaN|Infinity/.test(dxf) || !dxf.includes('SA_ALLOWANCE_RECT') || !dxf.trim().endsWith('EOF')) throw new Error('Variable seam allowance DXF is invalid')
const tech = buildTechPack(project)
if (Number(tech.patternPieces[0].edgeSeamAllowancesCm?.[0]) !== 4 || Number(tech.patternPieces[0].edgeSeamAllowancesCm?.[1]) !== 0.5) throw new Error('Tech pack lost edge seam allowances')

console.log(JSON.stringify({ effective: [0,1,2,3].map((index) => getEdgeSeamAllowance(piece, index)), bounds: actual, marker: { width: placement.width, height: placement.height, efficiency: marker.efficiency } }, null, 2))
