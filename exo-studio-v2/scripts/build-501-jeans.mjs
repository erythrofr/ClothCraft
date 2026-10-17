import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { create501JeansTemplate } from '../src/data/jeans501.js'
import { projectToDxf, parseDxfPatterns } from '../src/core/dxf.js'
import { pieceArea, samplePieceBoundary, edgeLength } from '../src/core/project.js'

const project = create501JeansTemplate({ waist: 32, inseam: 32 })
const out = process.argv[2] || path.join(homedir(), 'Documents', 'CLO_Automation', '501_Original_Jeans_W32L32')
await mkdir(out, { recursive: true })

// CLO-first DXF has ONE contour per cut piece. Garment Studio factory DXF
// additionally carries seam allowances, internal lines, grain, notches, etc.
const lines = ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009',
  '9','$INSUNITS','70','4','9','$MEASUREMENT','70','1','0','ENDSEC',
  '0','SECTION','2','ENTITIES']
let xOffset = 0
const lengths = {}
for (const piece of project.pieces) {
  const outline = samplePieceBoundary(piece, 8).points
  const minX = Math.min(...outline.map(p => p.x))
  const maxX = Math.max(...outline.map(p => p.x))
  const layer = piece.id.toUpperCase().replace(/[^A-Z0-9_-]/g,'_')
  lines.push('0','POLYLINE','8',layer,'66','1','70','1')
  for (const p of outline) {
    lines.push('0','VERTEX','8',layer,'10',((p.x-minX+xOffset)*10).toFixed(3),
      '20',(p.y*10).toFixed(3),'30','0')
  }
  lines.push('0','SEQEND','8',layer)
  xOffset += maxX-minX+9
  lengths[piece.id] = {
    name:piece.name, areaCm2:+pieceArea(piece).toFixed(1),
    perimeterCm:+piece.points.reduce((v,p,i)=>v+edgeLength(piece,i),0).toFixed(1),
  }
}
lines.push('0','ENDSEC','0','EOF')
const cloDxf = lines.join('\n')
const factoryDxf = projectToDxf(project, 'W32L32')
const imported = parseDxfPatterns(cloDxf)
const errors = []
if (imported.pieces.length !== project.pieces.length)
  errors.push(`CLO export round-trip piece count: ${imported.pieces.length} vs ${project.pieces.length}`)
for (const [i, piece] of project.pieces.entries()) {
  if (!Number.isFinite(pieceArea(piece)) || pieceArea(piece) < 0.5) errors.push(`Invalid area: ${piece.id}`)
  if (imported.pieces[i] && Math.abs(pieceArea(piece)-pieceArea(imported.pieces[i]))/pieceArea(piece) > 0.01)
    errors.push(`Area mismatch: ${piece.id}`)
}
const pieceIds = new Set(project.pieces.map(p=>p.id))
for (const seam of project.seams) for (const endpoint of [seam.a, seam.b]) {
  const part = project.pieces.find(p=>p.id===endpoint.pieceId)
  if (!part || endpoint.edgeIndex < 0 || endpoint.edgeIndex >= part.points.length)
    errors.push(`Broken seam: ${seam.id} -> ${JSON.stringify(endpoint)}`)
}
for (const seam of project.seams) {
  const a=project.pieces.find(p=>p.id===seam.a.pieceId)
  const b=project.pieces.find(p=>p.id===seam.b.pieceId)
  if (!a || !b) continue
  const ratio=edgeLength(a,seam.a.edgeIndex)/edgeLength(b,seam.b.edgeIndex)
  if (!Number.isFinite(ratio) || ratio<0.8 || ratio>1.2)
    errors.push(`Seam mismatch over 20%: ${seam.id}, ratio ${ratio.toFixed(3)}`)
}
const front = project.pieces.find(p=>p.id==='left-front-leg')
const back = project.pieces.find(p=>p.id==='left-back-leg')
const finishedKneeCm = (front.points[6].x-front.points[3].x)+(back.points[5].x-back.points[2].x)
const finishedHemCm = (front.points[5].x-front.points[4].x)+(back.points[4].x-back.points[3].x)
const frontRiseCm = 3.6+front.points[0].y-front.points[8].y
if (Math.abs(finishedKneeCm-17.5*2.54)>0.02) errors.push('Knee does not match reference')
if (Math.abs(finishedHemCm-16*2.54)>0.02) errors.push('Hem does not match reference')
if (Math.abs(frontRiseCm-11.25*2.54)>0.5) errors.push('Rise deviates more than 5 mm from reference')

const decorative = project.pieces.filter(p=>!p.active3d).length
const docs = `# 501-style Original Straight Jeans – W32 L32\n\n`+
`**Status:** editable pattern draft built for CLO3D DXF import and Garment Studio. Not a completed CLO3D sewn/simulated project.\n\n`+
`**Reference:** Levi's 501 Original size 32 published fit (not a proprietary pattern).\n`+
`Regular through thigh, waist-height fit, straight leg, traditional button fly and five-pocket layout.\n\n`+
`## Reference finished measurements\n`+
`- Front rise: 11.25 in / 28.575 cm, including waistband (source-reported).\n`+
`- Knee circumference: 17.5 in / 44.45 cm.\n`+
`- Leg opening: 16 in / 40.64 cm.\n`+
`- Inseam: size-label 32 in / 81.28 cm (target; physical denim wash shrinkage not modeled).\n`+
`- Waist: 32 in label; finished ease and rise are construction assumptions, not brand factory data.\n\n`+
`## Construction\n`+
`- Four distinct leg panels: front left/right and back left/right.\n`+
`- Independent curved back yokes and four waistband segments.\n`+
`- Two back pointed patch pockets, two front pocket bags + facings, and one coin pocket.\n`+
`- Button-fly shield / placket and five belt-loop templates.\n`+
`- Indigo 13.5 oz / 458 gsm rigid cotton-twill simulation preset; unbleached pocketing.\n`+
`- Antique-gold double-needle topstitch specs, 1.2 cm main seams, 2.6 cm turned hems.\n`+
`- Pattern shapes drafted as original approximations, **not a 1:1 factory pattern**.\n\n`+
`## Files\n`+
`- 501_Original_Straight_CLO_Import.dxf: one mm-scale closed polyline per cutting component.\n`+
`- 501_Original_Straight_Factory.dxf: additional grain, notches, labels, seam allowances and construction marks.\n`+
`- 501_Original_Straight_GarmentStudio.json: full editable sewing graph, fabrics and trims.\n`+
`- 501_Original_Straight_Pattern_Layout.svg: sheet illustration.\n`+
`- validation.json: DXF round-trip and component checks.\n\n`+
`## CLO3D finishing steps\n`+
`1. File > Import > DXF(AAMA/ASTM); import CLO_Import.dxf with millimetres (not centimetres).\n`+
`2. Place four leg panels around a W32 male avatar, front panels facing forward.\n`+
`3. Sew outer + inner leg seams, center-front/back rise, and independently attach rear yokes to rear panels.\n`+
`4. Sew waistband sections; add fly placket/buttonholes, bags and pockets as layered details.\n`+
`5. Fabric thickness and friction: 458 gsm non-stretch denim; check pressure, intersections and hem drag; save .zprj.\n\n`+
`**Limit:** DXF imports geometry, not automatic sewing, placed trim/hardware or finished 3D drape.\n`+
`Those steps require native CLO interaction; this export should not be described as fully sewn.\n`

// Preview uses the same sampled curves as the actual CLO import.
const spacing = 26
const svgPieces = []
let ox = 26
const sy = 1240
const scale = 2.0
for (const p of project.pieces) {
  const sample = samplePieceBoundary(p, 10).points
  const minX=Math.min(...sample.map(q=>q.x)), maxX=Math.max(...sample.map(q=>q.x))
  const points=sample.map(q=>`${(ox+(q.x-minX)*scale).toFixed(2)},${(sy-q.y*scale).toFixed(2)}`).join(' ')
  const stroke=p.active3d?'#26374e':'#8a919d'
  svgPieces.push(`<polygon points="${points}" fill="${p.fabricId==='pocket'?'#e8dfc9':'#e0e8ee'}" stroke="${stroke}" stroke-width="1.2"/>`)
  svgPieces.push(`<text x="${ox+6}" y="${sy+19}" fill="#172637" font-size="10">${p.name}</text>`)
  ox+=(maxX-minX)*scale+spacing
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(ox+10)}" height="1278" viewBox="0 0 ${Math.ceil(ox+10)} 1278"><rect width="100%" height="100%" fill="#f7f8fa"/><text x="26" y="54" font-size="28" fill="#172637" font-family="Arial" font-weight="700">MIKRISTIAN / 501-STYLE STRAIGHT JEANS — W32 L32</text><text x="26" y="78" font-size="14" fill="#637080" font-family="Arial">CLO3D cutting geometry  •  cm drafting / mm DXF  •  independent study</text><g font-family="Arial">${svgPieces.join('')}</g></svg>`

await Promise.all([
  writeFile(path.join(out,'501_Original_Straight_CLO_Import.dxf'),cloDxf),
  writeFile(path.join(out,'501_Original_Straight_Factory.dxf'),factoryDxf),
  writeFile(path.join(out,'501_Original_Straight_GarmentStudio.json'),JSON.stringify(project,null,2)),
  writeFile(path.join(out,'501_Original_Straight_Pattern_Layout.svg'),svg),
  writeFile(path.join(out,'README_CONSTRUCTION.md'),docs),
  writeFile(path.join(out,'validation.json'),JSON.stringify({
    status: errors.length?'FAIL':'PASS', errors,
    pieces:project.pieces.length, active3D:project.pieces.length-decorative,
    detailOnly:decorative, seams:project.seams.length,
    importRoundTripPieces:imported.pieces.length, sizes:'W32 L32',
    draftedMeasurementsCm: { finishedKneeCm, finishedHemCm, frontRiseCm,
      inseamTargetCm:81.28 },
    parts:lengths,
  },null,2))
])
console.log(JSON.stringify({ output:out, status:errors.length?'FAIL':'PASS',
  pieces:project.pieces.length, seams:project.seams.length,
  imported:imported.pieces.length, errors },null,2))
if (errors.length) process.exitCode=2
