import { createDefaultProject, FABRIC_PRESETS } from './defaultProject.js'

// Original 501-style jeans study, drafted independently from published finished-
// garment fit measurements. Not an official Levi Strauss pattern or tech pack.
// Dimensions are centimetres; W32/L32 is the reference block.
const P = (x, y) => ({ x, y })
const gold = '#c8a273'

function part(id, name, points, options = {}) {
  return {
    id, name, points, curves: options.curves || {},
    layout2d: options.layout2d || { x: 0, y: 0 },
    arrangement3d: options.arrangement3d || { x: 0, y: 0, z: 0 },
    grainAngleDeg: 0,
    simulationResolution: options.simulationResolution || 2,
    seamAllowance: options.seamAllowance ?? 1,
    edgeSeamAllowances: options.edgeSeamAllowances || {},
    fabricId: options.fabricId || 'main',
    active3d: options.active3d ?? true,
    locked: false,
    notches: options.notches || [],
    topstitches: options.topstitches || [],
    internalLines: options.internalLines || [],
    graphics: [], buttons: options.buttons || [],
    buttonholes: options.buttonholes || [],
    zippers: [], bindings: [], pins: [],
    surfaceAttachments: options.surfaceAttachments || [],
    patternRole: options.patternRole || 'cut',
  }
}

const stitch = (id, edgeIndex, offsetCm = 0.7, rows = 2) => ({
  id, edgeIndex, offsetCm, rows, rowGapCm: 0.42,
  stitchLengthMm: 3.2, color: gold,
})

function seam(id, a, ai, b, bi, reverseB = false) {
  return { id, name: id.replaceAll('-', ' '), type: 'normal',
    a: { pieceId: a, edgeIndex: ai },
    b: { pieceId: b, edgeIndex: bi }, reverseB, junctionScale: 0.96 }
}

const FRONT = [
  P(0, 106.4), P(-2.1, 94), P(-2.5, 73), P(-0.7, 40.64),
  P(0.1, 0), P(19.7, 0), P(20.7, 40.64), P(24.05, 73),
  P(25.8, 81.3), P(20.25, 86.5), P(20.3, 106.4),
]
const FRONT_CURVES = {
  0: { cx: -0.5, cy: 100.0 },
  1: { cx: -2.7, cy: 84 },
  6: { cx: 21.4, cy: 62 },
  7: { cx: 26.7, cy: 79 },
  8: { cx: 20.4, cy: 81.2 },
}

// Split yoke is a real cut/sew piece, not simply a cosmetic graphic.
const BACK = [
  P(-1.2, 94), P(-3.75, 73), P(-1.65, 40.64),
  P(-0.25, 0), P(20.79, 0), P(21.4, 40.64), P(26.75, 73),
  P(29.0, 81.3), P(23.8, 87.3), P(23.35, 94),
]
const BACK_CURVES = {
  0: { cx: -3.7, cy: 83 },
  5: { cx: 22.0, cy: 61 },
  6: { cx: 28.54, cy: 77.8 },
  7: { cx: 24.0, cy: 81.4 },
}
const YOKE = [P(0, 106.4), P(21.6, 108.4), P(23.35, 94), P(-1.2, 94)]

function backPocket(x = 0) {
  return [P(x + 0, 15.5), P(x + 14.2, 15.5), P(x + 13.9, 3.3),
    P(x + 7.05, 0), P(x + 0.15, 3.3)]
}

export function create501JeansTemplate({ waist = 32, inseam = 32 } = {}) {
  const project = createDefaultProject()
  project.id = 'mikristian-501-original-straight-w32l32'
  project.name = `501-Style Straight Jeans W${waist} L${inseam}`
  project.templateId = 'jeans-501'
  project.revision = 1
  project.description = 'Independent size-32 classic five-pocket, button-fly straight-leg jean block. Draft / virtual prototyping; not an original manufacturer pattern.'
  project.referenceMeasurements = {
    units: 'cm', waistLabelIn: waist, inseamLabelIn: inseam,
    publishedFrontRiseIn: 11.25, publishedKneeCircumferenceIn: 17.5,
    publishedHemCircumferenceIn: 16,
    inseamTargetCm: inseam * 2.54,
    reference: 'Levi 501 Original published fit / size 32; independent pattern geometry',
  }
  project.fabrics = {
    main: { ...FABRIC_PRESETS.denim, id: 'main', name: '13.5 oz Rigid Indigo Twill',
      color: '#2c4259', gsm: 458, stretchWarp: 0.008,
      stretchWeft: 0.012, bend: 0.93, roughness: 0.89,
      textureDescription: '3/1 right-hand cotton denim, raw indigo face' },
    pocket: { ...FABRIC_PRESETS.jersey, id: 'pocket', name: 'Unbleached Cotton Pocketing',
      color: '#e3dcc5', gsm: 150, stretchWarp: 0.01, stretchWeft: 0.015 },
  }
  // Horizontal scaling is intentionally conservative: grade waist without
  // accidentally changing the historically recognizable straight leg opening.
  const waistDelta = (waist - 32) * 2.54 / 4
  const lengthDelta = (inseam - 32) * 2.54
  function grade(source) {
    return source.map(p => ({ x: p.x + (p.x > 8 ? waistDelta * Math.min(1, p.y / 80) : 0),
      y: p.y + (p.y < 81.3 ? lengthDelta * (1 - p.y / 81.3) : 0) }))
  }
  const pieces = []
  for (const side of ['left', 'right']) {
    const s = side === 'left' ? -1 : 1
    const frontID = `${side}-front-leg`
    const backID = `${side}-back-leg`
    const yokeID = `${side}-back-yoke`
    const frontPocket = [
      { id: `${side}-front-pocket-curve-upper`, type: 'construction',
        a: P(-0.65, 99.4), b: P(5.9, 94.2) },
      { id: `${side}-front-pocket-curve-lower`, type: 'construction',
        a: P(5.9, 94.2), b: P(14.45, 93.7) },
      { id: `${side}-front-pocket-bag-outline`, type: 'construction',
        a: P(14.45, 93.7), b: P(16.9, 76.3) },
      { id: `${side}-front-pocket-bag-bottom`, type: 'construction',
        a: P(16.9, 76.3), b: P(-2.4, 77.8) },
      { id: `${side}-front-rivet-station`, type: 'construction',
        a: P(14.1, 94.1), b: P(14.3, 94.4) },
    ]
    pieces.push(part(frontID, `${side.toUpperCase()} Front Leg / Jeans`, grade(FRONT), {
      curves: FRONT_CURVES,
      layout2d: { x: side === 'left' ? 42 : 145, y: 140 },
      arrangement3d: { x: s * 0.155, y: 0.01, z: 0.17,
        wrap: `${side}-leg-front`, flip: side === 'right' },
      seamAllowance: 1.2,
      edgeSeamAllowances: { 4: 2.6, 10: 1.0 },
      topstitches: [stitch(`${side}-front-inseam`, 6),
        stitch(`${side}-front-hem`, 4, 2.0),
        stitch(`${side}-front-pocket-rim`, 0, 1.1, 1),
        stitch(`${side}-fly-placket`, 9, 3.1, 1)],
      notches: [{ id: `${side}-front-knee`, edgeIndex: 2, t: 0.75, type: 'single' },
        { id: `${side}-front-hip`, edgeIndex: 1, t: 0.65, type: 'single' }],
      internalLines: frontPocket,
      buttons: side === 'right' ? [
        { id: 'top-shank', x: 19.3, y: 104.0, diameterCm: 1.7, color: '#b58250' },
        ...[100, 95, 90, 85].map((y, i) => ({ id: `fly-button-${i}`, x: 18.7, y,
          diameterCm: 1.3, color: '#b58250' }))] : [],
    }))
    pieces.push(part(backID, `${side.toUpperCase()} Back Leg / Jeans`, grade(BACK), {
      curves: BACK_CURVES,
      layout2d: { x: side === 'left' ? 92 : 196, y: 140 },
      arrangement3d: { x: s * 0.155, y: 0.01, z: -0.17,
        wrap: `${side}-leg-back`, flip: side === 'right' },
      seamAllowance: 1.2, edgeSeamAllowances: { 3: 2.6 },
      topstitches: [stitch(`${side}-back-inseam`, 5),
        stitch(`${side}-back-hem`, 3, 2.0),
        stitch(`${side}-back-yoke-line`, 9, 0.8)],
      notches: [{ id: `${side}-back-knee`, edgeIndex: 1, t: 0.76, type: 'double' },
        { id: `${side}-back-seat`, edgeIndex: 0, t: 0.54, type: 'double' }],
    }))
    pieces.push(part(yokeID, `${side.toUpperCase()} Back Yoke`, grade(YOKE), {
      layout2d: { x: side === 'left' ? 258 : 298, y: 115 },
      arrangement3d: { x: s * 0.15, y: 0.94, z: -0.16, wrap: 'back', flip: side === 'right' },
      topstitches: [stitch(`${side}-yoke-double`, 2, 0.7)],
    }))
    pieces.push(part(`${side}-back-pocket`, `${side.toUpperCase()} Back Patch Pocket`, backPocket(), {
      layout2d: { x: side === 'left' ? 250 : 285, y: 70 },
      arrangement3d: { x: s * 0.15, y: 0.83, z: -0.22, wrap: 'back' },
      active3d: false, seamAllowance: 1,
      edgeSeamAllowances: { 0: 2.0 },
      topstitches: [stitch(`${side}-pocket-hem`, 0, 1.2, 2),
        stitch(`${side}-pocket-outer`, 2, 0.6, 2),
        stitch(`${side}-pocket-bottom`, 3, 0.6, 2)],
      internalLines: [
        { id: `${side}-arcuate-left`, type: 'construction', a: P(1.5, 10.8), b: P(7.1, 6.4) },
        { id: `${side}-arcuate-right`, type: 'construction', a: P(7.1, 6.4), b: P(12.6, 10.8) },
      ],
    }))
    pieces.push(part(`${side}-front-pocket-bag`, `${side.toUpperCase()} Front Pocket Bag`,
      [P(0, 18), P(15.6, 18), P(17.2, 2.8), P(7.8, 0), P(0, 3)], {
      layout2d: { x: side === 'left' ? 235 : 278, y: 45 },
      fabricId: 'pocket', active3d: false, seamAllowance: 0.8,
      arrangement3d: { x: s * 0.16, y: 0.93, z: 0.18 },
    }))
    pieces.push(part(`${side}-front-pocket-facing`, `${side.toUpperCase()} Pocket Denim Facing`,
      [P(0, 16.6), P(16.4, 16.6), P(17.3, 6), P(0, 6)], {
      layout2d: { x: side === 'left' ? 234 : 278, y: 21 },
      active3d: false, seamAllowance: 0.8,
    }))
    const w = 20.3 + waistDelta
    pieces.push(part(`${side}-front-waistband`, `${side.toUpperCase()} Front Waistband`,
      [P(0, 0), P(w, 0), P(w, 3.6), P(0, 3.6)], {
      layout2d: { x: side === 'left' ? 40 : 148, y: 20 },
      arrangement3d: { x: s * 0.115, y: 1.075, z: 0.1, wrap: 'waist-band' },
      seamAllowance: 1, topstitches: [stitch(`${side}-wb-upper`, 2, 0.6, 1)],
    }))
    pieces.push(part(`${side}-back-waistband`, `${side.toUpperCase()} Back Waistband`,
      [P(0, 0), P(21.7 + waistDelta, 0), P(21.7 + waistDelta, 3.6), P(0, 3.6)], {
      layout2d: { x: side === 'left' ? 88 : 196, y: 20 },
      arrangement3d: { x: s * 0.115, y: 1.095, z: -0.1, wrap: 'waist-band' },
      seamAllowance: 1, topstitches: [stitch(`${side}-back-wb-upper`, 2, 0.6, 1)],
    }))
  }
  pieces.push(part('coin-pocket', 'Watch / Coin Pocket',
    [P(0, 10), P(8.0, 10), P(8.0, 1.1), P(4.7, 0), P(0, 1.1)], {
    layout2d: { x: 340, y: 60 }, active3d: false,
    seamAllowance: 0.8, edgeSeamAllowances: { 0: 1.7 },
    topstitches: [stitch('coin-pocket-rim', 0, 0.7)],
  }))
  pieces.push(part('button-fly-facing', 'Button Fly Placket',
    [P(0, 25.2), P(5.2, 25.2), P(6.0, 1.5), P(4.8, 0), P(0, 0)], {
    layout2d: { x: 342, y: 100 }, active3d: false,
    buttonholes: [6.3, 11.0, 15.7, 20.4].map((y, i) => ({
      id: `fly-bh-${i}`, x: 2.1, y, lengthCm: 1.8, orientationDeg: 0 }))
  }))
  pieces.push(part('button-fly-shield', 'Button Fly Shield',
    [P(0, 26), P(7.1, 26), P(7.1, 0), P(0, 0)], {
    layout2d: { x: 355, y: 100 }, active3d: false,
  }))
  // Traditional five-loop placement (two front, two side and one centre back).
  for (let n = 0; n < 5; n += 1) pieces.push(part(`belt-loop-${n + 1}`, `Belt Loop ${n + 1}`,
    [P(0, 9.4), P(1.4, 9.4), P(1.4, 0), P(0, 0)], {
      layout2d: { x: 392 + n * 4, y: 35 }, active3d: false,
      seamAllowance: 0.7,
    }))

  const seams = []
  for (const side of ['left', 'right']) {
    const f = `${side}-front-leg`, b = `${side}-back-leg`, y = `${side}-back-yoke`
    seams.push(seam(`${side}-outseam-yoke`, f, 0, y, 3, true))
    for (const edge of [1, 2, 3]) seams.push(seam(`${side}-outseam-${edge}`, f, edge, b, edge - 1))
    for (const edge of [5, 6, 7]) seams.push(seam(`${side}-inseam-${edge}`, f, edge, b, edge - 1))
    seams.push(seam(`${side}-yoke-join`, b, 9, y, 2, true))
    seams.push(seam(`${side}-front-waist`, f, 10, `${side}-front-waistband`, 0))
    seams.push(seam(`${side}-back-waist`, y, 0, `${side}-back-waistband`, 0))
    seams.push(seam(`${side}-waist-side-join`, `${side}-front-waistband`, 1, `${side}-back-waistband`, 3))
  }
  seams.push(seam('front-center-rise-lower', 'left-front-leg', 8, 'right-front-leg', 8, true))
  seams.push(seam('front-center-rise-upper', 'left-front-leg', 9, 'right-front-leg', 9, true))
  seams.push(seam('back-center-rise-lower', 'left-back-leg', 7, 'right-back-leg', 7, true))
  seams.push(seam('back-center-rise-upper', 'left-back-leg', 8, 'right-back-leg', 8, true))
  seams.push(seam('back-center-yoke', 'left-back-yoke', 1, 'right-back-yoke', 1, true))
  seams.push(seam('waistband-back-center', 'left-back-waistband', 1, 'right-back-waistband', 1, true))
  project.pieces = pieces
  project.seams = seams
  project.grading = { baseSize: 'W32', sizes: ['W28', 'W30', 'W32', 'W34', 'W36', 'W38'],
    widthPerSizeCm: 2.54, lengthPerSizeCm: 0 }
  project.previewSize = `W${waist}L${inseam}`
  project.updatedAt = new Date().toISOString()
  return project
}
