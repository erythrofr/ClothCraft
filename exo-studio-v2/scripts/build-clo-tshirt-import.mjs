#!/usr/bin/env node
// One-time CLO export ingestion fixture. Does not touch the user's active app.
import { readFile, writeFile } from 'node:fs/promises'
import { createDefaultProject, FABRIC_PRESETS } from '../src/data/defaultProject.js'
import { parseDxfPatterns } from '../src/core/dxf.js'
import { pieceArea } from '../src/core/project.js'

const folder = new URL('../research/clo-reference/live-audit-20261014/exports/', import.meta.url)
const dxfUrl = new URL('clo-male-tshirt-7piece-import.dxf', folder)
const pattern = parseDxfPatterns(await readFile(dxfUrl, 'utf8'))
if (pattern.pieces.length !== 7 || pattern.scaleToCm !== 0.1) throw Error('Expected seven CLO patterns at mm scale')

const ids = [
  'clo-front', 'clo-back', 'clo-right-sleeve', 'clo-left-sleeve',
  'clo-neck-a', 'clo-neck-b', 'clo-neck-c',
]
const names = ['Front', 'Back', 'Right Sleeve', 'Left Sleeve', 'Neck Piece A', 'Neck Piece B', 'Neck Piece C']
const base = createDefaultProject()
const placements = Object.fromEntries(base.pieces.map(piece => [piece.name.toLowerCase(), piece.arrangement3d]))
const project = {
  ...base,
  id: 'clo-male-tshirt-seven-piece-source-20261014',
  name: 'CLO Male T-Shirt — 7-Piece Pattern Reference',
  revision: 1,
  updatedAt: new Date().toISOString(),
  pieces: pattern.pieces.map((piece, i) => ({
    ...piece,
    id: ids[i],
    name: names[i],
    sourceLayer: piece.sourceLayer,
    sourceCloBlock: ['37_M', '7_M', '36_M', '39_M', 'Pattern2D_768516_M', 'Pattern2D_768527_M', 'Pattern2D_768528_M'][i],
    active3d: i < 4,
    // Placement is a rough app preview, NOT a simulated or accepted CLO fit.
    arrangement3d: i < 4 ? { ...(placements[names[i].toLowerCase()] || piece.arrangement3d) }
      : { x: (i - 5) * 0.22, y: 1.62, z: 0.0, flip: false },
    simulationResolution: i < 4 ? 1 : 0,
    seamAllowance: 0,
    fabricId: 'main',
  })),
  seams: [],
  fabrics: {
    main: { ...FABRIC_PRESETS.jersey, id: 'main', name: 'CLO Tee Reference — Jersey', color: '#e9e9e9' },
  },
  cloReference: {
    source: 'CLO 7.0.242 / Male_T-shirt.zpac',
    exportFormat: 'CLO DXF-ASTM, millimeters, 100% scale',
    normalizedDxf: 'clo-male-tshirt-7piece-import.dxf',
    originalDxf: 'clo-male-tshirt-pattern-20261014.dxf',
    sewnMeshSource: 'clo-reference-tee-20261014.obj',
    sewingXmlSource: 'clo-reference-tee-20261014_meta_data.xml',
    referenceStitchGroups: 23,
    referenceStitchPointCorrespondences: 182,
    importedSewing: false,
    sewnFitCertified: false,
    note: 'Actual editable CLO 2D cut contours, not a copied CLO simulation. 3D body placement is a starting heuristic; real CLO sewing maps are preserved separately, not guessed as edge-to-edge seams. Neck panels are 2D-only pending proper collar assembly.',
  },
}

for (let i = 0; i < project.pieces.length; i++) {
  const p = project.pieces[i]
  const area = pieceArea(p)
  if (!Number.isFinite(area) || area < 1) throw Error('Invalid area '+p.id)
  if (!p.points.every(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y))) throw Error('Bad vertex '+p.id)
}

const file = new URL('clo-male-tshirt-7piece.garment.json', folder)
await writeFile(file, JSON.stringify(project, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({
  created: file.pathname, pieces: project.pieces.map(p => ({name:p.name, vertices:p.points.length, areaCm2:+pieceArea(p).toFixed(2), active3d:p.active3d})),
  sewing: 'Not fabricated: original 23 CLO seam groups are in separate XML',
},null,2))
