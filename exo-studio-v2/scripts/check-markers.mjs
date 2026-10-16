import { createHoodieTemplate } from '../src/data/templates.js'
import { gradeProject } from '../src/core/grading.js'
import { buildFabricMarkers } from '../src/core/marker.js'
import { buildTechPack } from '../src/core/measurements.js'

const project = createHoodieTemplate()
project.markerSettings = { fabricWidthCm: 165, gapCm: 2, fabricWidthsCm: { main: 165, rib: 90 } }
const graded = gradeProject(project, 'M')
const narrow = buildFabricMarkers(graded, 165, 2)
if (narrow.main.width !== 165 || narrow.rib.width !== 90) throw new Error('Per-fabric marker widths were not applied')
if (narrow.main.placements.some((entry) => entry.pieceId.startsWith('rib-'))) throw new Error('Rib piece leaked into main marker')
if (narrow.rib.placements.some((entry) => !entry.pieceId.startsWith('rib-'))) throw new Error('Main piece leaked into rib marker')
if (narrow.rib.requestedPieces !== 3 || narrow.rib.placements.length !== 2 || narrow.rib.unusedPieces !== 1) throw new Error('Narrow rib marker overflow accounting is wrong')
if (narrow.rib.unplaced?.[0]?.pieceId !== 'rib-waistband' || narrow.rib.unplaced?.[0]?.reason !== 'too-wide') throw new Error('Narrow rib marker did not identify the waistband overflow')
const requiredRibWidth = narrow.rib.unplaced[0].minimumWidthCm
if (!(requiredRibWidth > 90)) throw new Error('Rib waistband minimum width is invalid')

project.markerSettings.fabricWidthsCm.rib = Math.ceil(requiredRibWidth + 1)
const wide = buildFabricMarkers(gradeProject(project, 'M'), 165, 2)
if (wide.rib.unusedPieces !== 0 || wide.rib.placements.length !== 3) throw new Error('Wider rib marker did not place all rib pieces')
if (Math.abs(wide.main.length - narrow.main.length) > 1e-9 || Math.abs(wide.main.efficiency - narrow.main.efficiency) > 1e-9) throw new Error('Changing rib width changed the independent main marker')

const tech = buildTechPack(project)
if (tech.markers.M.byFabric.rib.unusedPieces !== 0 || tech.markers.M.byFabric.main.fabricWidthCm !== 165) throw new Error('Tech pack marker split is inconsistent')

console.log(JSON.stringify({
  narrow: {
    main: { width: narrow.main.width, lengthCm: Number(narrow.main.length.toFixed(2)), efficiency: Number((narrow.main.efficiency * 100).toFixed(1)) },
    rib: { width: narrow.rib.width, requested: narrow.rib.requestedPieces, placed: narrow.rib.placements.length, unplaced: narrow.rib.unplaced },
  },
  wide: {
    ribWidth: wide.rib.width,
    ribLengthCm: Number(wide.rib.length.toFixed(2)),
    placed: wide.rib.placements.length,
  },
}, null, 2))
