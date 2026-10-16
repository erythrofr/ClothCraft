import { createDefaultProject } from '../src/data/defaultProject.js'
import { parseDxfPatterns, projectToDxf } from '../src/core/dxf.js'
import { pieceArea } from '../src/core/project.js'

const project = createDefaultProject()
const dxf = projectToDxf(project, 'M')
const imported = parseDxfPatterns(dxf)
const sourceAreas = project.pieces.map((piece) => pieceArea(piece))
const importedAreas = imported.pieces.map((piece) => pieceArea(piece))

const lwPolylineFixture = [
  '0', 'SECTION', '2', 'HEADER',
  '9', '$INSUNITS', '70', '4',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'LWPOLYLINE', '8', 'TEST_FRONT', '70', '1', '90', '4',
  '10', '0', '20', '0',
  '10', '500', '20', '0',
  '10', '500', '20', '700',
  '10', '0', '20', '700',
  '0', 'ENDSEC', '0', 'EOF',
].join('\n')
const lwImported = parseDxfPatterns(lwPolylineFixture)

console.log(JSON.stringify({
  roundTrip: {
    sourcePieces: project.pieces.length,
    importedPieces: imported.pieces.length,
    names: imported.pieces.map((piece) => piece.name),
    sourceAreas: sourceAreas.map((area) => Number(area.toFixed(2))),
    importedAreas: importedAreas.map((area) => Number(area.toFixed(2))),
    areaRatios: importedAreas.map((area, index) => Number((area / sourceAreas[index]).toFixed(4))),
    notchCounts: imported.pieces.map((piece) => piece.notches.length),
    grainAngles: imported.pieces.map((piece) => Number(piece.grainAngleDeg.toFixed(2))),
    scaleToCm: imported.scaleToCm,
  },
  lwPolyline: {
    pieces: lwImported.pieces.length,
    name: lwImported.pieces[0]?.name,
    areaCm2: lwImported.pieces[0] ? Number(pieceArea(lwImported.pieces[0]).toFixed(2)) : 0,
    scaleToCm: lwImported.scaleToCm,
  },
}, null, 2))

if (imported.pieces.length !== project.pieces.length || lwImported.pieces.length !== 1) process.exitCode = 2
