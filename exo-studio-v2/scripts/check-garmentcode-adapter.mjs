import { createDefaultProject } from '../src/data/defaultProject.js'
import { garmentCodeToProject, projectToGarmentCode } from '../src/core/garmentCode.js'

const project = createDefaultProject()
const spec = projectToGarmentCode(project)
if (Object.keys(spec.pattern.panels).length !== project.pieces.length) throw new Error('GarmentCode export lost panels')
if (spec.pattern.stitches.length !== project.seams.length) throw new Error('GarmentCode export lost stitches')
if (spec.properties.units_in_meter !== 100) throw new Error('GarmentCode export units mismatch')

const frontName = Object.keys(spec.pattern.panels).find((name) => name === 'Front')
const frontPanel = spec.pattern.panels[frontName]
if (frontPanel.edges[1]?.curvature?.type !== 'quadratic') throw new Error('GarmentCode export lost quadratic curve')

const imported = garmentCodeToProject(spec, createDefaultProject())
if (imported.pieces.length !== project.pieces.length || imported.seams.length !== project.seams.length) throw new Error('GarmentCode round trip changed topology')
const originalFront = project.pieces.find((piece) => piece.id === 'front')
const importedFront = imported.pieces.find((piece) => piece.id === 'front')
if (!importedFront) throw new Error('GarmentCode round trip lost stable piece IDs')
for (const edgeIndex of Object.keys(originalFront.curves || {})) {
  const a = originalFront.curves[edgeIndex]
  const b = importedFront.curves[edgeIndex]
  if (!b || Math.hypot(a.cx - b.cx, a.cy - b.cy) > 1e-7) throw new Error(`Curve ${edgeIndex} changed during GarmentCode round trip`)
}
if (importedFront.seamAllowance !== originalFront.seamAllowance || importedFront.notches?.length !== originalFront.notches?.length) throw new Error('Garment Studio production metadata was not preserved in extension')

console.log(JSON.stringify({
  panels: Object.keys(spec.pattern.panels).length,
  stitches: spec.pattern.stitches.length,
  curvedFrontEdges: Object.keys(importedFront.curves || {}).length,
  extensionVersion: spec.garment_studio.version,
}, null, 2))
