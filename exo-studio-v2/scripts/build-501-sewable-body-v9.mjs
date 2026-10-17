import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { create501JeansTemplate } from '../src/data/jeans501.js'
import { parseDxfPatterns } from '../src/core/dxf.js'
import { pieceArea } from '../src/core/project.js'

// V9 is a NEW export, not a replacement for V6 or any saved .zprj.
// Important repair: the older easy-sew back-leg exporter accidentally skipped
// a back outseam point at y=73cm (BACK[1]), creating an inappropriate long
// segment even though the total side seam was approximately correct.
const project = create501JeansTemplate({ waist: 32, inseam: 32 })
// CLO_501_VARIANT=v10 creates a separate, per-segment-aligned successor.
// The default retains the original V9 construction so old output is reproducible.
const v10 = process.env.CLO_501_VARIANT === 'v10'
const ids = ['left-front-leg', 'left-back-leg', 'right-front-leg', 'right-back-leg']
const panels = ids.map(id => structuredClone(project.pieces.find(p => p.id === id)))
for (const panel of panels) {
  if (!panel) throw new Error('Missing required jean panel')
  // This sewing scaffold is intentionally made from original straight corner
  // segments; carrying template Bezier controls into reindexed points would
  // make validation inspect different geometry from the exported DXF.
  panel.curves = {}
  if (panel.id.endsWith('back-leg')) {
    panel.points = [
      { x: 0, y: 106.4 },
      { x: -2.1, y: v10 ? 94 : 91 },
      ...panel.points.slice(1, 10), // retain knee/outseam point y=73cm
      { x: 21.6, y: 111.7 },
    ]
  }
}

const length = (panel, edges) => edges.reduce((sum, i) => {
  const a = panel.points[i], b = panel.points[(i + 1) % panel.points.length]
  if (!a || !b) throw Error(`Missing edge ${panel.id}:${i}`)
  return sum + Math.hypot(a.x - b.x, a.y - b.y)
}, 0)
const sewing = []
for (const side of ['left', 'right']) {
  const front = panels.find(p => p.id === `${side}-front-leg`)
  const back = panels.find(p => p.id === `${side}-back-leg`)
  for (const [seam, aEdges, bEdges] of [
    ['outseam', [0, 1, 2, 3], [0, 1, 2, 3]],
    ['inseam', [5, 6, 7], [5, 6, 7]],
  ]) {
    const frontCm = length(front, aEdges), backCm = length(back, bEdges)
    const differenceCm = Math.abs(frontCm - backCm)
    if (differenceCm > 1) throw Error(`${side} ${seam} is ${differenceCm.toFixed(2)}cm mismatched`)
    const segments = aEdges.map((a, i) => {
      const b = bEdges[i]
      const f = length(front, [a]), k = length(back, [b])
      return { frontEdge: a, backEdge: b,
        frontCm: +f.toFixed(3), backCm: +k.toFixed(3),
        mismatchCm: +Math.abs(f - k).toFixed(3),
        sewingDirection: 'VERIFY_IN_CLO' }
    })
    if (v10 && segments.some(s => s.mismatchCm > 0.6))
      throw Error(`${side} ${seam}: individual segment mismatch > 0.6 cm`)
    sewing.push({ side, seam, frontId: front.id, backId: back.id,
      frontEdges: aEdges, backEdges: bEdges,
      frontCm: +frontCm.toFixed(3), backCm: +backCm.toFixed(3),
      mismatchCm: +differenceCm.toFixed(3), segments,
      note: 'CLO requires manually validated sewing direction/arrangement; not auto-sewn by DXF' })
  }
}

let x = 5
const entities = ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009',
  '9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES']
const metadata = []
for (const panel of panels) {
  const minX = Math.min(...panel.points.map(v => v.x))
  const maxX = Math.max(...panel.points.map(v => v.x))
  const layer = panel.id.replaceAll('-', '_').toUpperCase()
  const offsetPoints = panel.points.map(v => ({ x: v.x - minX + x, y: v.y + 3 }))
  entities.push('0','POLYLINE','8',layer,'66','1','70','1')
  for (const point of offsetPoints) entities.push('0','VERTEX','8',layer,
    '10',(point.x * 10).toFixed(4),'20',(point.y * 10).toFixed(4),'30','0')
  entities.push('0','SEQEND','8',layer)
  metadata.push({ id: panel.id, points: panel.points.length,
    windingAreaCm2: +pieceArea(panel).toFixed(2), contour: offsetPoints })
  x += maxX - minX + 9
}
entities.push('0','ENDSEC','0','EOF')
const dxf = entities.join('\n')
const reimport = parseDxfPatterns(dxf)
if (reimport.pieces.length !== 4) throw Error(`DXF roundtrip failed: ${reimport.pieces.length} pieces`)
for (const [i, source] of panels.entries()) {
  const ratio = Math.abs(pieceArea(source) - pieceArea(reimport.pieces[i])) / pieceArea(source)
  if (ratio > 0.01) throw Error(`DXF roundtrip area mismatch: ${source.id}: ${ratio}`)
}

const output = process.argv[2] || path.join(homedir(), 'Documents', 'CLO_Automation', '501_Original_Jeans_W32L32')
await mkdir(output, { recursive: true })
const prefix = v10 ? '501_Body4_V10_SEGMENTS_ALIGNED' : '501_Body4_V9_OUTSEAM_POINT_FIXED'
await writeFile(path.join(output, `${prefix}.dxf`), dxf, { flag: 'wx' })
const result = { status: 'PATTERN_VALIDATED_NOT_CLO_SEWN', style: 'Original 501-inspired prototype',
  size: 'W32 L32', variant: v10 ? 'V10 segment-aligned' : 'V9 breakpoint-recovered',
  source: 'src/data/jeans501.js', corrections: [
    'Restored the missing back outseam/knee breakpoint at approximately y=73cm',
    ...(v10 ? ['Aligned back outseam upper breakpoint at y=94cm for individual seam pairings'] : []),
    'Kept four separate body panels for the first native CLO sewing and fit test',
  ], counts: metadata.map(m => ({ id: m.id, points: m.points })), sewing, metadata }
await writeFile(path.join(output, `${prefix}.json`), JSON.stringify(result, null, 2), { flag: 'wx' })
await writeFile(path.join(output, `${prefix}.md`), [
  `# 501 Body4 ${v10 ? 'V10 — segment-aligned sewing prototype' : 'V9 — corrected outseam geometry'}`,
  '',
  '**State:** four DXF cutting contours with matched side and inseam lengths. Not native-sewn or simulated.',
  `Do not replace earlier CLO projects. Import ${v10 ? 'V10' : 'V9'} only into a new working copy.`,
  '',
  '| Side | Seam | Front (cm) | Back (cm) | Difference (cm) |',
  '|---|---|---:|---:|---:|',
  ...sewing.map(s => `| ${s.side} | ${s.seam} | ${s.frontCm} | ${s.backCm} | ${s.mismatchCm} |`),
  ...(v10 ? ['', 'All individual outseam and inseam segments are within 0.6 cm. ',
    'Sewing orientation and line-index mapping must still be verified in native CLO before applying the newer AddSeamlinePairGroup API.'] : []),
  '',
  'CLO workflow: import the DXF in millimeters; inspect each 2D contour; place panels on the correct legs;',
  'sew outseams and inseams while confirming direction guides; sew front and rear center rise segments;',
  'then run a short simulation on a saved **copy**. The crotch and fabric drape require visual validation.',
].join('\n'), { flag: 'wx' })
console.log(JSON.stringify({ success: true, output, prefix, sewing, roundTripPieces: reimport.pieces.length }, null, 2))
