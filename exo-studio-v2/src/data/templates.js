import { createDefaultProject, FABRIC_PRESETS } from './defaultProject.js'
import { edgeLength } from '../core/project.js'
import { create501JeansTemplate } from './jeans501.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function baseFromDefault(name, templateId) {
  const base = createDefaultProject()
  base.id = `project-${templateId}`
  base.name = name
  base.templateId = templateId
  base.revision = 1
  base.updatedAt = new Date().toISOString()
  return base
}

function makePiece({
  id,
  name,
  points,
  layout2d,
  arrangement3d,
  fabricId = 'main',
  seamAllowance = 1,
  simulationResolution = 2,
  curves = undefined,
  topstitches = [],
  bindings = [],
  notches = [],
  internalLines = [],
}) {
  return {
    id,
    name,
    points,
    curves,
    layout2d,
    arrangement3d,
    simulationResolution,
    grainAngleDeg: 0,
    notches,
    topstitches,
    bindings,
    graphics: [],
    zippers: [],
    buttons: [],
    buttonholes: [],
    internalLines,
    pins: [],
    seamAllowance,
    fabricId,
    locked: false,
    frozen3d: false,
    active3d: true,
  }
}

export function createTeeTemplate() {
  const project = createDefaultProject()
  // Controlled lateral shoulder contact reduces upward launch of the torso
  // panels on the reference-sized avatar. The solver automatically falls back
  // to the established contact model on other sizes until their stress and
  // penetration checks pass; never rescale the drafted pattern to compensate.
  project.avatar.shoulderContactMode = 'adaptive-limited-lateral'
  project.avatar.shoulderMaxLateralCorrectionM = 0.006
  project.id = 'project-foundation-tee'
  project.name = 'Foundation Tee · First Fit Test'
  project.templateId = 'tee'
  project.fabrics.main = { ...FABRIC_PRESETS.jersey, id: 'main', name: 'Cotton Jersey', color: '#d9dde1' }
  // Pattern seamlines for a regular-fit size M jersey T-shirt on the 180 cm,
  // 96 cm chest sample body. This is a sampling/production-development block:
  // factory release still needs physical fit, shrinkage and wash tests.
  // The legacy shell uses an outward armhole spike (31 cm from center), which
  // looks like a sleeve extension even though sleeves are separate. Draw a
  // conventional curved armscye *inside* the underarm width instead.
  // CLO-like first test: flat front/back panels in front of and behind the
  // torso, and genuinely short sleeves on either side of the shoulders.
  // Changes stay in the T-shirt template: denim, hoodies, user projects and
  // their original saved pattern geometry are left alone.
  for (const piece of project.pieces) {
    if (piece.id === 'front' || piece.id === 'back') {
      // Move the outer biceps-level armhole control point from +/-31 to +/-23.
      // Shoulders remain +/-21, true underarm width remains +/-27. Both front
      // and back share the same sewable armscye; neck depths stay distinct.
      piece.points[2].x = -23
      piece.points[7].x = 23
      piece.curves = {
        ...piece.curves,
        1: { cx: -21.7, cy: 63.4 },
        2: { cx: -22.5, cy: 53.8 },
        6: { cx: 22.5, cy: 53.8 },
        7: { cx: 21.7, cy: 63.4 },
      }
      // 1 cm construction seam allowance, 2.5 cm turnback at the body hem,
      // and 0.7 cm along the neckline finish. The cut DXF exports these as
      // real per-edge offsets rather than graphical placeholder lines.
      piece.edgeSeamAllowances = { 4: 2.5, 9: 0.7, 10: 0.7, 11: 0.7 }
      // Preserve the existing functional neck binding; supply complete
      // shoulder-to-center-front/back neckline finish specifications.
      piece.bindings = [9, 10, 11].map(edgeIndex => ({
        id: `${piece.id}-neck-binding-${edgeIndex}`,
        edgeIndex, ratio: 0.96, stiffness: 0.78, widthCm: 1.8, color: '#d9dde1',
      }))
      piece.arrangement3d = {
        ...piece.arrangement3d,
        y: 0.89,
        stagingOffsetZ: piece.id === 'front' ? -0.10 : 0.10,
      }
    } else if (piece.id === 'sleeve-left' || piece.id === 'sleeve-right') {
      const left = piece.id === 'sleeve-left'
      // Seven points retain all existing cap/side/hem sewing edge indices.
      // Reduced cap width matches the corrected scooped armscye; cuff width
      // 32 cm allows a light taper from the upper-bicep seam (34.5 cm).
      piece.points = [
        { x: 0, y: 25 },
        { x: -11, y: 23 },
        { x: -17.25, y: 17 },
        { x: -16, y: 0 },
        { x: 16, y: 0 },
        { x: 17.25, y: 17 },
        { x: 11, y: 23 },
      ]
      piece.curves = {
        // Match sewn sleeve-cap arc length to the corrected armscye, while
        // retaining a rounded apex and true sleeve cap (not part of torso).
        0: { cx: -6.05, cy: 23.5 },
        1: { cx: -16.5, cy: 22 },
        5: { cx: 16.5, cy: 22 },
        6: { cx: 6.05, cy: 23.5 },
      }
      piece.edgeSeamAllowances = { 3: 2.5 }
      piece.arrangement3d = {
        ...piece.arrangement3d,
        y: 1.35,
        stagingOffsetX: left ? 0.11 : -0.11,
        stagingRotationY: left ? 78 : -78,
      }
    }
  }
  // Physical matching notch pairs are production metadata: the single notch
  // denotes the front armscye, double denotes the back. Preserve the original
  // positions and explicitly associate both fabric edges for DXF/tech packs.
  for (const [bodyId, sleeveId, bodyEdge, sleeveEdge, seamId] of [
    ['front', 'sleeve-left', 2, 1, 'seam-sleeve-l-front-lower'],
    ['back', 'sleeve-left', 2, 5, 'seam-sleeve-l-back-lower'],
    ['front', 'sleeve-right', 6, 1, 'seam-sleeve-r-front-lower'],
    ['back', 'sleeve-right', 6, 5, 'seam-sleeve-r-back-lower'],
  ]) {
    const group = `tee-notches-${seamId}`
    for (const [pieceId, edge] of [[bodyId, bodyEdge], [sleeveId, sleeveEdge]]) {
      const piece = project.pieces.find(item => item.id === pieceId)
      const notch = piece?.notches?.find(item => item.edgeIndex === edge)
      if (notch) { notch.matchGroupId = group; notch.matchedSeamId = seamId }
    }
  }
  const necklineLengthCm = ['front', 'back'].reduce((sum, id) => {
    const piece = project.pieces.find(item => item.id === id)
    return sum + [9, 10, 11].reduce((total, edge) => total + edgeLength(piece, edge), 0)
  }, 0)
  project.productionSpec = {
    format: 'garment-studio.tee-production-development.v1',
    approvalStatus: 'FIT_SAMPLE_AND_FACTORY_VALIDATION_REQUIRED',
    baseSize: 'M', units: 'cm', block: 'regular-fit short-sleeve jersey crew neck',
    gradingModel: 'seam-locked-affine-v1',
    referenceHalfChestCm: 54,
    referenceBodyLengthCm: 71,
    sewingLines: 'drafted geometry represents stitch lines; cut outlines include edgeSeamAllowances',
    cutQuantities: { front: 1, back: 1, 'sleeve-left': 1, 'sleeve-right': 1 },
    construction: {
      sideAndShoulder: '1.0 cm overlock seam',
      bodyHem: '2.5 cm double-needle coverstitch turnback',
      sleeveHem: '2.5 cm double-needle coverstitch turnback',
      neckline: 'rib finish must be physically sampled and added to production marker',
    },
    neckband: {
      measuredNecklineCm: Number(necklineLengthCm.toFixed(2)),
      proposedRibSewingRatio: 0.87,
      proposedCutLengthCm: Number((necklineLengthCm * .87 + 2).toFixed(2)),
      proposedCutWidthCm: 4.6,
      joinSeamAllowanceCm: 1,
      requiresSeparateNeckbandCutPattern: true,
    },
    qualityGates: ['physical body-fit sample', 'graded nest and sewability', 'wash/shrink calibration', 'factory seam and neckband approval'],
  }
  project.simulation = {
    ...project.simulation,
    substeps: 3,
    iterations: 9,
    stiffness: 0.92,
    seamStiffness: 0.97,
    collisions: true,
    selfCollision: true,
    selfCollisionMargin: 0.0025,
    // Triangle-centroid body contact reduces measured peak strain on both
    // reference T-shirt avatar sizes; leave other garment templates unchanged.
    bodyTriangleContactAssist: true,
    wind: { ...project.simulation.wind, enabled: false },
  }
  project.updatedAt = new Date().toISOString()
  return project
}

function splitTemplateEdge(piece, edgeIndex, t = 0.5) {
  const count = piece.points.length
  const a = piece.points[edgeIndex]
  const b = piece.points[(edgeIndex + 1) % count]
  const curve = piece.curves?.[edgeIndex]
  let inserted
  let leftControl = null
  let rightControl = null
  if (curve) {
    const q0 = { x: a.x + (curve.cx - a.x) * t, y: a.y + (curve.cy - a.y) * t }
    const q1 = { x: curve.cx + (b.x - curve.cx) * t, y: curve.cy + (b.y - curve.cy) * t }
    inserted = { x: q0.x + (q1.x - q0.x) * t, y: q0.y + (q1.y - q0.y) * t }
    leftControl = { cx: q0.x, cy: q0.y }
    rightControl = { cx: q1.x, cy: q1.y }
  } else {
    inserted = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }
  piece.points.splice(edgeIndex + 1, 0, inserted)
  const nextCurves = {}
  for (const [rawIndex, value] of Object.entries(piece.curves || {})) {
    const index = Number(rawIndex)
    if (index === edgeIndex) continue
    nextCurves[index > edgeIndex ? index + 1 : index] = value
  }
  if (leftControl) nextCurves[edgeIndex] = leftControl
  if (rightControl) nextCurves[edgeIndex + 1] = rightControl
  piece.curves = nextCurves
  for (const collection of ['notches', 'topstitches', 'bindings', 'zippers']) {
    piece[collection] = (piece[collection] || []).map((item) => (
      item.edgeIndex > edgeIndex ? { ...item, edgeIndex: item.edgeIndex + 1 } : item
    ))
  }
}

function addTemplateHood(project) {
  const front = project.pieces.find((piece) => piece.id === 'front')
  const back = project.pieces.find((piece) => piece.id === 'back')
  splitTemplateEdge(front, 10, 0.5)
  splitTemplateEdge(back, 10, 0.5)
  for (const bodyPiece of [front, back]) {
    bodyPiece.bindings = (bodyPiece.bindings || []).filter((item) => item.edgeIndex < 9 || item.edgeIndex > 12)
    bodyPiece.topstitches = (bodyPiece.topstitches || []).filter((item) => item.edgeIndex < 9 || item.edgeIndex > 12)
  }

  const rightAttachments = [
    { endpoint: { pieceId: front.id, edgeIndex: 10 }, reverseB: true },
    { endpoint: { pieceId: front.id, edgeIndex: 9 }, reverseB: true },
    { endpoint: { pieceId: back.id, edgeIndex: 9 }, reverseB: false },
    { endpoint: { pieceId: back.id, edgeIndex: 10 }, reverseB: false },
  ]
  const leftAttachments = [
    { endpoint: { pieceId: front.id, edgeIndex: 11 }, reverseB: false },
    { endpoint: { pieceId: front.id, edgeIndex: 12 }, reverseB: false },
    { endpoint: { pieceId: back.id, edgeIndex: 12 }, reverseB: true },
    { endpoint: { pieceId: back.id, edgeIndex: 11 }, reverseB: true },
  ]

  const build = (id, name, attachments, wrap, layoutX) => {
    const lengths = attachments.map(({ endpoint }) => edgeLength(project.pieces.find((piece) => piece.id === endpoint.pieceId), endpoint.edgeIndex))
    const bottom = [{ x: 0, y: 0 }]
    const necklineYProfile = []
    let cursor = 0
    const targetBaseY = (piece, point) => Number(piece.arrangement3d?.y || 0) + Number(point?.y || 0) * 0.01
    for (let index = 0; index < lengths.length; index += 1) {
      const { endpoint, reverseB } = attachments[index]
      const targetPiece = project.pieces.find((piece) => piece.id === endpoint.pieceId)
      const targetStart = targetPiece.points[endpoint.edgeIndex]
      const targetEnd = targetPiece.points[(endpoint.edgeIndex + 1) % targetPiece.points.length]
      const sourceStartTarget = reverseB ? targetEnd : targetStart
      const sourceEndTarget = reverseB ? targetStart : targetEnd
      if (!necklineYProfile.length) necklineYProfile.push({ x: cursor, y: targetBaseY(targetPiece, sourceStartTarget) })
      else necklineYProfile[necklineYProfile.length - 1].y = (necklineYProfile[necklineYProfile.length - 1].y + targetBaseY(targetPiece, sourceStartTarget)) * 0.5
      const length = lengths[index]
      cursor += length
      bottom.push({ x: cursor, y: 0 })
      necklineYProfile.push({ x: cursor, y: targetBaseY(targetPiece, sourceEndTarget) })
    }
    const total = Math.max(24, cursor)
    return makePiece({
      id,
      name,
      points: [...bottom, { x: total, y: 31 }, { x: total * 0.62, y: 49 }, { x: total * 0.08, y: 41 }],
      curves: {
        4: { cx: total + 3.5, cy: 16 },
        5: { cx: total * 0.93, cy: 48 },
        6: { cx: total * 0.34, cy: 55 },
        7: { cx: -2.5, cy: 21 },
      },
      layout2d: { x: layoutX, y: 52 },
      arrangement3d: { x: 0, y: 1.59, z: 0, wrap, necklineYProfile },
      simulationResolution: 1,
      topstitches: [{ id: `${id}-opening`, edgeIndex: 7, offsetCm: 2.1, rows: 2, rowGapCm: 0.5, stitchLengthMm: 3, color: '#777777' }],
      notches: [{ id: `${id}-neck-notch`, edgeIndex: 1, t: 0.5, type: 'single', depthCm: 0.45 }],
    })
  }

  const left = build('hood-left', 'Hood Left', leftAttachments, 'hood-left', 62)
  const right = build('hood-right', 'Hood Right', rightAttachments, 'hood-right', 248)
  for (const hood of [left, right]) {
    hood.generatedRole = hood.id
    hood.hoodState = 'up'
    hood.layerIndex = 1
  }
  project.pieces.push(left, right)

  const attach = (hood, attachments, side) => attachments.forEach(({ endpoint, reverseB }, index) => project.seams.push({
    id: `${hood.id}-neck-${index}`,
    name: `${side} hood neckline ${index + 1}`,
    type: 'normal',
    a: { pieceId: hood.id, edgeIndex: index },
    b: endpoint,
    reverseB,
  }))
  attach(left, leftAttachments, 'Left')
  attach(right, rightAttachments, 'Right')
  for (const edgeIndex of [4, 5, 6]) project.seams.push({
    id: `hood-center-${edgeIndex}`,
    name: `Hood center seam ${edgeIndex - 3}`,
    type: 'normal',
    a: { pieceId: left.id, edgeIndex },
    b: { pieceId: right.id, edgeIndex },
  })
}

function addTemplateRibFinishes(project) {
  const front = project.pieces.find((piece) => piece.id === 'front')
  const back = project.pieces.find((piece) => piece.id === 'back')
  const leftSleeve = project.pieces.find((piece) => piece.id === 'sleeve-left')
  const rightSleeve = project.pieces.find((piece) => piece.id === 'sleeve-right')
  if (!front || !back || !leftSleeve || !rightSleeve) return

  const makeCuff = (id, name, sleeve, wrap, layoutX) => {
    const circumference = edgeLength(sleeve, 3) * 0.92
    const half = circumference * 0.5
    const cuff = makePiece({
      id,
      name,
      points: [
        { x: -half, y: 0 },
        { x: half, y: 0 },
        { x: half, y: 9 },
        { x: -half, y: 9 },
      ],
      layout2d: { x: layoutX, y: 206 },
      arrangement3d: { x: 0, y: 0, z: 0, wrap, radius: Math.max(0.055, Math.min(0.082, (circumference / 100) / (Math.PI * 2))), alongOffsetM: 0.075 },
      fabricId: 'rib',
      seamAllowance: 0.8,
      topstitches: [{ id: `${id}-finish`, edgeIndex: 0, offsetCm: 1.2, rows: 2, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' }],
      internalLines: [{ id: `${id}-fold`, type: 'fold', a: { x: -half * 0.95, y: 4.5 }, b: { x: half * 0.95, y: 4.5 }, foldAngleDeg: 175 }],
    })
    cuff.generatedRole = id.includes('left') ? 'rib-cuff-left' : 'rib-cuff-right'
    cuff.layerIndex = 1
    project.pieces.push(cuff)
    project.seams.push(
      { id: `${id}-attach`, name: `${name} attachment`, type: 'normal', a: { pieceId: id, edgeIndex: 2 }, b: { pieceId: sleeve.id, edgeIndex: 3 }, reverseB: true },
      { id: `${id}-loop`, name: `${name} loop closure`, type: 'normal', a: { pieceId: id, edgeIndex: 1 }, b: { pieceId: id, edgeIndex: 3 }, reverseB: true },
    )
  }

  makeCuff('rib-cuff-left', 'Left Rib Cuff', leftSleeve, 'left-wrist', 52)
  makeCuff('rib-cuff-right', 'Right Rib Cuff', rightSleeve, 'right-wrist', 268)

  const frontLength = edgeLength(front, 4) * 0.94
  const backLength = edgeLength(back, 4) * 0.94
  const total = frontLength + backLength
  const half = total * 0.5
  const waistband = makePiece({
    id: 'rib-waistband',
    name: 'Rib Waistband',
    points: [
      { x: -half, y: 10 },
      { x: -half + frontLength, y: 10 },
      { x: half, y: 10 },
      { x: half, y: 0 },
      { x: -half + frontLength, y: 0 },
      { x: -half, y: 0 },
    ],
    layout2d: { x: 145, y: 238 },
    arrangement3d: { x: 0, y: 0.89, z: 0, wrap: 'waist-band', phaseDeg: 180, direction: -1, easeM: 0.018 },
    fabricId: 'rib',
    seamAllowance: 0.8,
    topstitches: [{ id: 'rib-waistband-finish', edgeIndex: 3, offsetCm: 1.2, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' }],
    internalLines: [{ id: 'rib-waistband-fold', type: 'fold', a: { x: -half * 0.96, y: 5 }, b: { x: half * 0.96, y: 5 }, foldAngleDeg: 175 }],
  })
  waistband.generatedRole = 'rib-waistband'
  waistband.layerIndex = 1
  project.pieces.push(waistband)
  project.seams.push(
    { id: 'rib-waistband-front', name: 'Waistband to front hem', type: 'normal', a: { pieceId: waistband.id, edgeIndex: 0 }, b: { pieceId: front.id, edgeIndex: 4 } },
    { id: 'rib-waistband-back', name: 'Waistband to back hem', type: 'normal', a: { pieceId: waistband.id, edgeIndex: 1 }, b: { pieceId: back.id, edgeIndex: 4 }, reverseB: true },
    { id: 'rib-waistband-loop', name: 'Waistband loop closure', type: 'normal', a: { pieceId: waistband.id, edgeIndex: 2 }, b: { pieceId: waistband.id, edgeIndex: 5 }, reverseB: true },
  )
}

function addTemplateKangarooPocket(project) {
  const front = project.pieces.find((piece) => piece.id === 'front')
  if (!front) return
  const pocket = makePiece({
    id: 'kangaroo-pocket',
    name: 'Kangaroo Pocket',
    points: [
      { x: -21, y: 0 },
      { x: 21, y: 0 },
      { x: 24, y: 14 },
      { x: 16, y: 24 },
      { x: -16, y: 24 },
      { x: -24, y: 14 },
    ],
    curves: {
      1: { cx: 23, cy: 6 },
      2: { cx: 23, cy: 19 },
      4: { cx: -23, cy: 19 },
      5: { cx: -23, cy: 6 },
    },
    layout2d: { x: 158, y: 166 },
    arrangement3d: { x: 0, y: 1.08, z: 0, wrap: 'front' },
    topstitches: [
      { id: 'kangaroo-pocket-bottom', edgeIndex: 0, offsetCm: 0.7, rows: 1, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' },
      { id: 'kangaroo-pocket-right-opening', edgeIndex: 2, offsetCm: 1.4, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' },
      { id: 'kangaroo-pocket-top', edgeIndex: 3, offsetCm: 0.7, rows: 1, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' },
      { id: 'kangaroo-pocket-left-opening', edgeIndex: 4, offsetCm: 1.4, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' },
    ],
  })
  pocket.generatedRole = 'kangaroo-pocket'
  pocket.layerIndex = 2
  pocket.surfaceAttachments = [
    { id: 'kangaroo-bottom-stitch', targetPieceId: front.id, sourceEdgeIndex: 0, targetA: { x: -21, y: 10 }, targetB: { x: 21, y: 10 }, stiffness: 0.96 },
    { id: 'kangaroo-right-lower-stitch', targetPieceId: front.id, sourceEdgeIndex: 1, targetA: { x: 21, y: 10 }, targetB: { x: 24, y: 24 }, stiffness: 0.95 },
    { id: 'kangaroo-top-stitch', targetPieceId: front.id, sourceEdgeIndex: 3, targetA: { x: 16, y: 34 }, targetB: { x: -16, y: 34 }, stiffness: 0.96 },
    { id: 'kangaroo-left-lower-stitch', targetPieceId: front.id, sourceEdgeIndex: 5, targetA: { x: -24, y: 24 }, targetB: { x: -21, y: 10 }, stiffness: 0.95 },
  ]
  project.pieces.push(pocket)
}

export function createHoodieTemplate() {
  const project = createDefaultProject()
  project.id = 'project-foundation-hoodie'
  project.name = 'Foundation Hoodie'
  project.templateId = 'hoodie'
  project.fabrics = {
    main: { ...FABRIC_PRESETS.fleece, id: 'main', name: 'Heavy French Terry' },
    rib: { ...FABRIC_PRESETS.jersey, id: 'rib', name: '1×1 Rib Knit', gsm: 360, stretchWarp: 0.22, stretchWeft: 0.42, bend: 0.68, color: FABRIC_PRESETS.fleece.color },
  }
  for (const piece of project.pieces) {
    if (['front', 'back'].includes(piece.id)) piece.fitShoulderTacks = true
    if (['sleeve-left', 'sleeve-right'].includes(piece.id)) piece.fitSleeveApexTack = true
  }
  addTemplateHood(project)
  addTemplateRibFinishes(project)
  addTemplateKangarooPocket(project)
  project.updatedAt = new Date().toISOString()
  return project
}

export function createZipHoodieTemplate() {
  const project = createHoodieTemplate()
  project.id = 'project-foundation-zip-hoodie'
  project.name = 'Foundation Zip Hoodie'
  project.templateId = 'zip-hoodie'

  // A full-width kangaroo pocket cannot survive a true center-front opening.
  // Remove it from this foundation; split welt/patch pockets can be added as
  // separate layered pieces later without crossing the zipper.
  project.pieces = project.pieces.filter((piece) => piece.generatedRole !== 'kangaroo-pocket')

  const fullFront = project.pieces.find((piece) => piece.id === 'front')
  if (!fullFront) return project

  const leftFront = makePiece({
    id: 'front-left',
    name: 'Left Front',
    points: [
      { x: 0, y: 60.75 },
      { x: -6, y: 63 },
      { x: -9, y: 71 },
      { x: -21, y: 69 },
      { x: -31, y: 58 },
      { x: -27, y: 50 },
      { x: -25, y: 0 },
      { x: 0, y: 0 },
    ],
    curves: {
      0: { cx: -3, cy: 60.75 },
      3: { cx: -28, cy: 67 },
      4: { cx: -31, cy: 53 },
    },
    layout2d: { x: 64, y: 116 },
    arrangement3d: { x: -0.125, y: 0.98, z: 0.245, wrap: 'front' },
    topstitches: [
      { id: 'zip-left-topstitch', edgeIndex: 7, offsetCm: 0.8, rows: 1, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' },
    ],
    notches: [
      { id: 'zip-left-arm-notch', edgeIndex: 4, t: 0.5, type: 'single', depthCm: 0.45 },
    ],
  })
  leftFront.generatedRole = 'zip-front-left'
  leftFront.fitShoulderSides = [-1]
  leftFront.fitNeckLocalX = 0
  leftFront.zippers = [{ id: 'zip-left-tape', edgeIndex: 7, widthCm: 1.2, offsetCm: 0, type: 'coil', color: '#777777' }]

  const rightFront = makePiece({
    id: 'front-right',
    name: 'Right Front',
    points: [
      { x: 0, y: 60.75 },
      { x: 0, y: 0 },
      { x: 25, y: 0 },
      { x: 27, y: 50 },
      { x: 31, y: 58 },
      { x: 21, y: 69 },
      { x: 9, y: 71 },
      { x: 6, y: 63 },
    ],
    curves: {
      3: { cx: 31, cy: 53 },
      4: { cx: 28, cy: 67 },
      7: { cx: 3, cy: 60.75 },
    },
    layout2d: { x: 126, y: 116 },
    arrangement3d: { x: 0.125, y: 0.98, z: 0.245, wrap: 'front' },
    topstitches: [
      { id: 'zip-right-topstitch', edgeIndex: 0, offsetCm: 0.8, rows: 1, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' },
    ],
    notches: [
      { id: 'zip-right-arm-notch', edgeIndex: 3, t: 0.5, type: 'single', depthCm: 0.45 },
    ],
  })
  rightFront.generatedRole = 'zip-front-right'
  rightFront.fitShoulderSides = [1]
  rightFront.fitNeckLocalX = 0
  rightFront.zippers = [{ id: 'zip-right-tape', edgeIndex: 0, widthCm: 1.2, offsetCm: 0, type: 'coil', color: '#777777' }]

  const frontIndex = project.pieces.findIndex((piece) => piece.id === 'front')
  project.pieces.splice(frontIndex, 1, leftFront, rightFront)

  const edgeMap = {
    0: { pieceId: 'front-left', edgeIndex: 2 },
    1: { pieceId: 'front-left', edgeIndex: 3 },
    2: { pieceId: 'front-left', edgeIndex: 4 },
    3: { pieceId: 'front-left', edgeIndex: 5 },
    5: { pieceId: 'front-right', edgeIndex: 2 },
    6: { pieceId: 'front-right', edgeIndex: 3 },
    7: { pieceId: 'front-right', edgeIndex: 4 },
    8: { pieceId: 'front-right', edgeIndex: 5 },
    9: { pieceId: 'front-right', edgeIndex: 6 },
    10: { pieceId: 'front-right', edgeIndex: 7 },
    11: { pieceId: 'front-left', edgeIndex: 0 },
    12: { pieceId: 'front-left', edgeIndex: 1 },
  }

  const remappedSeams = []
  for (const seam of project.seams) {
    if (seam.id.startsWith('rib-waistband-')) continue
    const next = clone(seam)
    let valid = true
    for (const key of ['a', 'b']) {
      const endpoint = next[key]
      if (endpoint?.pieceId !== 'front') continue
      const mapped = edgeMap[endpoint.edgeIndex]
      if (!mapped) {
        valid = false
        break
      }
      next[key] = mapped
    }
    if (valid) remappedSeams.push(next)
  }
  project.seams = remappedSeams

  const waistband = project.pieces.find((piece) => piece.id === 'rib-waistband')
  if (waistband) {
    splitTemplateEdge(waistband, 0, 0.5)
    project.seams.push(
      { id: 'rib-waistband-left-front', name: 'Waistband to left front hem', type: 'normal', a: { pieceId: waistband.id, edgeIndex: 0 }, b: { pieceId: leftFront.id, edgeIndex: 6 } },
      { id: 'rib-waistband-right-front', name: 'Waistband to right front hem', type: 'normal', a: { pieceId: waistband.id, edgeIndex: 1 }, b: { pieceId: rightFront.id, edgeIndex: 1 }, reverseB: true },
      { id: 'rib-waistband-back', name: 'Waistband to back hem', type: 'normal', a: { pieceId: waistband.id, edgeIndex: 2 }, b: { pieceId: 'back', edgeIndex: 4 }, reverseB: true },
      { id: 'rib-waistband-loop', name: 'Waistband loop closure', type: 'normal', a: { pieceId: waistband.id, edgeIndex: 3 }, b: { pieceId: waistband.id, edgeIndex: 6 }, reverseB: true },
    )
  }

  project.seams.push({
    id: 'center-front-zipper',
    name: 'Center front zipper',
    type: 'zipper',
    a: { pieceId: leftFront.id, edgeIndex: 7 },
    b: { pieceId: rightFront.id, edgeIndex: 0 },
    reverseB: true,
    openFraction: 0,
    openFrom: 'end',
  })

  project.updatedAt = new Date().toISOString()
  return project
}

export function createSkirtTemplate() {
  const project = baseFromDefault('A-Line Skirt', 'skirt')
  project.fabrics = {
    main: { ...FABRIC_PRESETS.denim, id: 'main', name: 'Midweight Woven' },
  }
  project.pieces = [
    makePiece({
      id: 'skirt-front',
      name: 'Skirt Front',
      points: [
        { x: -21, y: 56 },
        { x: -29, y: 0 },
        { x: 29, y: 0 },
        { x: 21, y: 56 },
      ],
      layout2d: { x: 92, y: 122 },
      arrangement3d: { x: 0, y: 0.55, z: 0.19, wrap: 'front' },
      topstitches: [
        { id: 'skirt-front-hem', edgeIndex: 1, offsetCm: 2.5, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3.2, color: '#8d8d8d' },
        { id: 'skirt-front-waist', edgeIndex: 3, offsetCm: 1.0, rows: 1, rowGapCm: 0.45, stitchLengthMm: 3, color: '#8d8d8d' },
      ],
      notches: [
        { id: 'skirt-front-left-notch', edgeIndex: 0, t: 0.5, type: 'single', depthCm: 0.45 },
        { id: 'skirt-front-right-notch', edgeIndex: 2, t: 0.5, type: 'single', depthCm: 0.45 },
      ],
    }),
    makePiece({
      id: 'skirt-back',
      name: 'Skirt Back',
      points: [
        { x: -21, y: 56 },
        { x: -29, y: 0 },
        { x: 29, y: 0 },
        { x: 21, y: 56 },
      ],
      layout2d: { x: 210, y: 122 },
      arrangement3d: { x: 0, y: 0.55, z: -0.19, wrap: 'back' },
      topstitches: [
        { id: 'skirt-back-hem', edgeIndex: 1, offsetCm: 2.5, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3.2, color: '#8d8d8d' },
        { id: 'skirt-back-waist', edgeIndex: 3, offsetCm: 1.0, rows: 1, rowGapCm: 0.45, stitchLengthMm: 3, color: '#8d8d8d' },
      ],
      notches: [
        { id: 'skirt-back-left-notch', edgeIndex: 0, t: 0.5, type: 'double', depthCm: 0.45 },
        { id: 'skirt-back-right-notch', edgeIndex: 2, t: 0.5, type: 'double', depthCm: 0.45 },
      ],
    }),
  ]
  project.seams = [
    { id: 'skirt-side-left', name: 'Left side seam', reverseB: false, a: { pieceId: 'skirt-front', edgeIndex: 0 }, b: { pieceId: 'skirt-back', edgeIndex: 0 } },
    { id: 'skirt-side-right', name: 'Right side seam', reverseB: false, a: { pieceId: 'skirt-front', edgeIndex: 2 }, b: { pieceId: 'skirt-back', edgeIndex: 2 } },
  ]
  project.grading = {
    baseSize: 'M',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    widthPerSizeCm: 2.6,
    lengthPerSizeCm: 0.8,
  }
  return project
}

const pantsFrontHalf = [
  { x: -24, y: 100 },
  { x: -28, y: 65 },
  { x: -24, y: 0 },
  { x: -3, y: 0 },
  { x: -2, y: 55 },
  { x: 4, y: 63 },
  { x: -1, y: 100 },
]

const pantsBackHalf = [
  { x: -26, y: 100 },
  { x: -30, y: 65 },
  { x: -25, y: 0 },
  { x: -3, y: 0 },
  { x: -3, y: 56 },
  { x: 6, y: 67 },
  { x: -1, y: 100 },
]

export function createPantsTemplate() {
  const project = baseFromDefault('Basic Straight Pants', 'pants')
  project.fabrics = {
    main: { ...FABRIC_PRESETS.denim, id: 'main', name: 'Rigid Denim' },
  }
  project.pieces = [
    makePiece({
      id: 'pants-left-front',
      name: 'Left Front Leg',
      points: clone(pantsFrontHalf),
      layout2d: { x: 64, y: 91 },
      arrangement3d: { x: -0.15, y: 0.02, z: 0.14, wrap: 'left-leg-front', flip: false },
      topstitches: [
        { id: 'pants-left-front-hem', edgeIndex: 2, offsetCm: 2.2, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3.2, color: '#9a8b70' },
      ],
      notches: [
        { id: 'pants-left-front-knee', edgeIndex: 1, t: 0.48, type: 'single', depthCm: 0.5 },
      ],
    }),
    makePiece({
      id: 'pants-left-back',
      name: 'Left Back Leg',
      points: clone(pantsBackHalf),
      layout2d: { x: 126, y: 91 },
      arrangement3d: { x: -0.15, y: 0.02, z: -0.14, wrap: 'left-leg-back', flip: false },
      topstitches: [
        { id: 'pants-left-back-hem', edgeIndex: 2, offsetCm: 2.2, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3.2, color: '#9a8b70' },
      ],
      notches: [
        { id: 'pants-left-back-knee', edgeIndex: 1, t: 0.48, type: 'double', depthCm: 0.5 },
      ],
    }),
    makePiece({
      id: 'pants-right-front',
      name: 'Right Front Leg',
      points: clone(pantsFrontHalf),
      layout2d: { x: 214, y: 91 },
      arrangement3d: { x: 0.15, y: 0.02, z: 0.14, wrap: 'right-leg-front', flip: true },
      topstitches: [
        { id: 'pants-right-front-hem', edgeIndex: 2, offsetCm: 2.2, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3.2, color: '#9a8b70' },
      ],
      notches: [
        { id: 'pants-right-front-knee', edgeIndex: 1, t: 0.48, type: 'single', depthCm: 0.5 },
      ],
    }),
    makePiece({
      id: 'pants-right-back',
      name: 'Right Back Leg',
      points: clone(pantsBackHalf),
      layout2d: { x: 276, y: 91 },
      arrangement3d: { x: 0.15, y: 0.02, z: -0.14, wrap: 'right-leg-back', flip: true },
      topstitches: [
        { id: 'pants-right-back-hem', edgeIndex: 2, offsetCm: 2.2, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3.2, color: '#9a8b70' },
      ],
      notches: [
        { id: 'pants-right-back-knee', edgeIndex: 1, t: 0.48, type: 'double', depthCm: 0.5 },
      ],
    }),
  ]
  project.seams = [
    { id: 'pants-left-outseam-upper', name: 'Left outseam upper', a: { pieceId: 'pants-left-front', edgeIndex: 0 }, b: { pieceId: 'pants-left-back', edgeIndex: 0 } },
    { id: 'pants-left-outseam-lower', name: 'Left outseam lower', a: { pieceId: 'pants-left-front', edgeIndex: 1 }, b: { pieceId: 'pants-left-back', edgeIndex: 1 } },
    { id: 'pants-left-inseam-lower', name: 'Left inseam lower', a: { pieceId: 'pants-left-front', edgeIndex: 3 }, b: { pieceId: 'pants-left-back', edgeIndex: 3 } },
    { id: 'pants-left-inseam-upper', name: 'Left inseam upper', a: { pieceId: 'pants-left-front', edgeIndex: 4 }, b: { pieceId: 'pants-left-back', edgeIndex: 4 } },
    { id: 'pants-right-outseam-upper', name: 'Right outseam upper', a: { pieceId: 'pants-right-front', edgeIndex: 0 }, b: { pieceId: 'pants-right-back', edgeIndex: 0 } },
    { id: 'pants-right-outseam-lower', name: 'Right outseam lower', a: { pieceId: 'pants-right-front', edgeIndex: 1 }, b: { pieceId: 'pants-right-back', edgeIndex: 1 } },
    { id: 'pants-right-inseam-lower', name: 'Right inseam lower', a: { pieceId: 'pants-right-front', edgeIndex: 3 }, b: { pieceId: 'pants-right-back', edgeIndex: 3 } },
    { id: 'pants-right-inseam-upper', name: 'Right inseam upper', a: { pieceId: 'pants-right-front', edgeIndex: 4 }, b: { pieceId: 'pants-right-back', edgeIndex: 4 } },
    { id: 'pants-front-rise', name: 'Center front rise', a: { pieceId: 'pants-left-front', edgeIndex: 5 }, b: { pieceId: 'pants-right-front', edgeIndex: 5 } },
    { id: 'pants-back-rise', name: 'Center back rise', a: { pieceId: 'pants-left-back', edgeIndex: 5 }, b: { pieceId: 'pants-right-back', edgeIndex: 5 } },
  ]
  for (const seam of project.seams) seam.junctionScale = 0.92
  project.grading = {
    baseSize: 'M',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    widthPerSizeCm: 2.4,
    lengthPerSizeCm: 1.5,
  }
  return project
}

// A simulation-first classic straight jean foundation. Preserve the tested
// four-panel topological layout / seams of the pants baseline while setting
// independent size-32 approximate finished-leg measurements. The full
// 24-piece construction study is registered separately as jeans-501.
export function create501BodyFitTemplate() {
  const p = createPantsTemplate()
  p.id = 'project-501-on-body-fit-w32-l32'
  p.name = '501-Style Straight Denim / Avatar Fit W32 L32'
  p.templateId = 'jeans-501-fit'
  p.description = '501-inspired rigid-denim four-panel drape prototype, on-body fit; yokes, five pockets and fly are recorded as construction details but not simulated as independently sewn layers here.'
  p.fabrics.main = { ...FABRIC_PRESETS.denim, id: 'main',
    name: 'Rigid Indigo Denim / 13.5 oz', color: '#283f5f',
    gsm: 458, stretchWarp: 0.012, stretchWeft: 0.016,
    thickness: 0.0029, friction: 0.45, bend: 0.85 }

  const f = [
    { x: -20.0, y: 107.0 },    // outer waist
    { x: -23.0, y: 80.0 },     // full thigh outer
    { x: -20.2, y: 0 },        // hem outer
    { x: -0.2, y: 0 },         // hem inseam
    { x: 0.8, y: 70.0 },       // straight leg/inner thigh
    { x: 5.4, y: 80.0 },       // center rise junction
    { x: 0.0, y: 107.0 },     // waist-front center
  ]
  const b = [
    { x: -21.0, y: 107.0 },
    { x: -24.3, y: 80.0 },
    { x: -20.5, y: 0 },
    { x: 0.0, y: 0 },
    { x: 1.3, y: 70.0 },
    { x: 5.9, y: 80.0 },
    { x: 0.0, y: 107.0 },
  ]
  for (const piece of p.pieces) {
    const front = piece.id.includes('front')
    piece.points = (front ? f : b).map(point => ({ ...point }))
    piece.simulationResolution = 1.9
    piece.seamAllowance = 1.2
    piece.name = piece.name.replace('Leg', front ? 'Straight Denim Front Leg' : 'Straight Denim Back Leg')
    piece.internalLines = front ? [
      { id: `${piece.id}-pocket-mouth-reference`, type: 'construction',
        a: { x: -19.1, y: 103 }, b: { x: -6.4, y: 97 } },
      { id: `${piece.id}-watch-pocket-outline`, type: 'construction',
        a: { x: -11, y: 102 }, b: { x: -7, y: 95 } },
    ] : [
      { id: `${piece.id}-yoke-seam-reference`, type: 'construction',
        a: { x: -20, y: 94.5 }, b: { x: 0, y: 95.5 } },
      { id: `${piece.id}-back-pocket-diagonal-reference`, type: 'construction',
        a: { x: -18.1, y: 90 }, b: { x: -4.4, y: 87 } },
    ]
  }
  p.referenceMeasurements = {
    size: 'W32 L32', intendedWaistCm: 82,
    hemTargetCm: 40.64, kneeTargetCm: 44.45,
    inseamTargetCm: 81.28, frontRiseTargetCm: 28.575,
    disclaimer: 'On-body 501-style engineering prototype; not Levi factory pattern.',
  }
  return p
}

export function createBlankTemplate() {
  const project = baseFromDefault('Blank Draft', 'blank')
  project.pieces = [
    makePiece({
      id: 'draft-1',
      name: 'Draft 1',
      points: [
        { x: -20, y: 40 },
        { x: -20, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 40 },
      ],
      layout2d: { x: 150, y: 135 },
      arrangement3d: { x: 0, y: 0.8, z: 0.3 },
      simulationResolution: 1,
    }),
  ]
  project.seams = []
  project.fabrics = {
    main: { ...FABRIC_PRESETS.jersey, id: 'main', name: 'Draft Fabric' },
  }
  return project
}

export const GARMENT_TEMPLATES = [
  { id: 'tee', name: 'Foundation Tee', description: 'Front/back + two sleeve system', create: createTeeTemplate },
  { id: 'hoodie', name: 'Foundation Hoodie', description: 'Heavy fleece shell with measured two-panel hood', create: createHoodieTemplate },
  { id: 'zip-hoodie', name: 'Zip Hoodie', description: 'Split front shell with a live openable center zipper', create: createZipHoodieTemplate },
  { id: 'skirt', name: 'A-Line Skirt', description: 'Two-panel lower-body woven foundation', create: createSkirtTemplate },
  { id: 'pants', name: 'Straight Pants', description: 'Front/back trouser block with crotch and inseams', create: createPantsTemplate },
  { id: 'jeans-501-fit', name: '501-Style / Avatar Fit', description: 'Four-panel fitted straight indigo jeans for XPBD on-avatar cloth simulation', create: create501BodyFitTemplate },
  { id: 'jeans-501', name: '501-Style Jeans', description: 'Five-pocket straight rigid denim with rear yokes, button fly, pockets and waistband', create: create501JeansTemplate },
  { id: 'blank', name: 'Blank Draft', description: 'Single editable rectangular pattern', create: createBlankTemplate },
]

export function createTemplateProject(templateId) {
  const template = GARMENT_TEMPLATES.find((item) => item.id === templateId) || GARMENT_TEMPLATES[0]
  return template.create()
}
