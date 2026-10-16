import { strFromU8 } from 'fflate'
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildFactoryPackageFiles } from '../src/core/factoryPackage.js'
import { buildFabricMarkers } from '../src/core/marker.js'
import { buildTechPack } from '../src/core/measurements.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'

const project = createTeeTemplate()
const shell = project.pieces.find((piece) => piece.id === 'front')
const interfacing = structuredClone(shell)
interfacing.id = 'qa-interfacing'
interfacing.name = 'Front Interfacing'
interfacing.generatedRole = 'interfacing'
interfacing.interfacingForPieceId = shell.id
interfacing.fusedToPieceId = shell.id
interfacing.fuseStiffness = 0.985
interfacing.fuseGapM = 0.001
interfacing.fabricId = 'interfacing'
interfacing.layerIndex = shell.layerIndex || 0
interfacing.layout2d = { x: shell.layout2d.x + 76, y: shell.layout2d.y + 18 }
interfacing.arrangement3d = { ...(shell.arrangement3d || {}), surfaceOffsetM: Number(shell.arrangement3d?.surfaceOffsetM || 0) - 0.002 }
interfacing.graphics = []
interfacing.topstitches = []
interfacing.bindings = []
interfacing.zippers = []
interfacing.buttons = []
interfacing.buttonholes = []
interfacing.surfaceAttachments = []
interfacing.pins = []
interfacing.strengthened = false
project.fabrics.interfacing = { ...structuredClone(FABRIC_PRESETS.interfacing), id: 'interfacing', name: 'Fusible Interfacing' }
project.pieces.push(interfacing)

const simulation = buildSimulation(project)
const interfacingSim = simulation.pieces.get(interfacing.id)
if (!interfacingSim || simulation.fuseConstraints.length !== interfacingSim.particles.length) throw new Error('Interfacing fuse coverage is incomplete')
if (!simulation.fusedPiecePairs.has('front|qa-interfacing')) throw new Error('Shell/interfacing collision exclusion is missing')
for (let frame = 0; frame < 120; frame += 1) stepSimulation(simulation, project, 1 / 60)
const gaps = simulation.fuseConstraints.map((constraint) => constraint.a.position.distanceTo(constraint.b.position))
const averageGap = gaps.reduce((sum, value) => sum + value, 0) / gaps.length
const maxGap = Math.max(...gaps)
if (averageGap > 0.0035 || maxGap > 0.012) throw new Error(`Interfacing delaminated: avg=${averageGap}, max=${maxGap}`)

const markers = buildFabricMarkers(project, 150, 1.5)
if (!markers.interfacing?.placements.length) throw new Error('Interfacing is missing from the cutting marker')
const techPack = buildTechPack(project)
const exportedPiece = techPack.patternPieces.find((piece) => piece.id === interfacing.id)
if (exportedPiece?.role !== 'interfacing' || exportedPiece.fusedToPieceId !== 'front') throw new Error('Tech pack lost the interfacing relationship')
const packageFiles = buildFactoryPackageFiles(project)
const bom = strFromU8(packageFiles['materials-bom.csv'])
if (!bom.includes('Fusible Interfacing')) throw new Error('Factory BOM is missing interfacing material')

console.log(JSON.stringify({
  fuseConstraints: simulation.fuseConstraints.length,
  averageGapMm: Number((averageGap * 1000).toFixed(2)),
  maxGapMm: Number((maxGap * 1000).toFixed(2)),
  interfacingMarkerLengthCm: Number(markers.interfacing.length.toFixed(2)),
  interfacingMarkerEfficiency: Number((markers.interfacing.efficiency * 100).toFixed(1)),
}, null, 2))
