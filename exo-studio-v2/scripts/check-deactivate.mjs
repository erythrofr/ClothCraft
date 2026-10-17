import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation } from '../src/core/physics.js'
import { buildMarker } from '../src/core/marker.js'
import { projectToDxf } from '../src/core/dxf.js'
import { buildTechPack } from '../src/core/measurements.js'

const project = createTeeTemplate()
const baseline = buildSimulation(project)
if (baseline.pieces.size !== 4) throw new Error(`Expected 4 active tee pieces, got ${baseline.pieces.size}`)
const sleeve = project.pieces.find((piece) => piece.id === 'sleeve-left')
sleeve.active3d = false
const deactivated = buildSimulation(project)
if (deactivated.pieces.has('sleeve-left') || deactivated.pieces.size !== 3) throw new Error('Deactivated pattern remained in 3D solver')
if (deactivated.seamConstraints.some((constraint) => constraint.a.pieceId === 'sleeve-left' || constraint.b.pieceId === 'sleeve-left')) throw new Error('Deactivated pattern still created seam constraints')

const marker = buildMarker(project, 150, 1.5)
if (!marker.placements.some((placement) => placement.pieceId === 'sleeve-left')) throw new Error('Deactivated 3D pattern disappeared from production marker')
const dxf = projectToDxf(project, 'M')
if (!dxf.includes('CUT_LEFT_SLEEVE')) throw new Error('Deactivated 3D pattern disappeared from DXF')
const tech = buildTechPack(project)
if (!tech.patternPieces.some((piece) => piece.id === 'sleeve-left')) throw new Error('Deactivated 3D pattern disappeared from tech pack')

sleeve.active3d = true
const reactivated = buildSimulation(project)
if (!reactivated.pieces.has('sleeve-left') || reactivated.pieces.size !== 4) throw new Error('Reactivated pattern did not return to 3D solver')

console.log(JSON.stringify({
  baselinePieces: baseline.pieces.size,
  deactivatedPieces: deactivated.pieces.size,
  deactivatedSeamLinks: deactivated.seamConstraints.length,
  markerStillIncludesSleeve: true,
  dxfStillIncludesSleeve: true,
  reactivatedPieces: reactivated.pieces.size,
}, null, 2))
