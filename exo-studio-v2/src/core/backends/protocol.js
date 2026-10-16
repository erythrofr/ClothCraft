import { cloneProject, samplePieceBoundary } from '../project.js'

export const SIMULATION_PROTOCOL = 'garment-studio.simulation'
export const SIMULATION_PROTOCOL_VERSION = 1

function finite(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizedFabric(id, fabric = {}) {
  return {
    id,
    name: fabric.name || id,
    densityGsm: finite(fabric.gsm, 180),
    thicknessM: Math.max(0.0001, finite(fabric.thickness, 0.002)),
    stretchWarp: Math.max(0, finite(fabric.stretchWarp, 0.08)),
    stretchWeft: Math.max(0, finite(fabric.stretchWeft, 0.12)),
    shrinkWarp: Math.max(0, finite(fabric.shrinkWarp, 0)),
    shrinkWeft: Math.max(0, finite(fabric.shrinkWeft, 0)),
    bend: Math.max(0, finite(fabric.bend, 0.65)),
    damping: Math.max(0, finite(fabric.damping, 0.985)),
    friction: Math.max(0, finite(fabric.friction, 0.35)),
  }
}

function normalizedPiece(piece) {
  const boundary = samplePieceBoundary(piece, 12).points
  return {
    id: piece.id,
    name: piece.name || piece.id,
    fabricId: piece.fabricId || 'main',
    layerIndex: Math.round(finite(piece.layerIndex, 0)),
    cutQuantity: Math.max(1, Math.round(finite(piece.cutQuantity, 1))),
    simulationResolution: Math.max(0, Math.min(3, Math.round(finite(piece.simulationResolution, 1)))),
    strengthened: Boolean(piece.strengthened),
    locked: Boolean(piece.locked),
    arrangement3d: cloneProject(piece.arrangement3d || {}),
    pattern: {
      pointsCm: (piece.points || []).map((point) => [finite(point.x), finite(point.y)]),
      boundaryCm: boundary.map((point) => [finite(point.x), finite(point.y)]),
      curves: cloneProject(piece.curves || {}),
      internalLines: cloneProject(piece.internalLines || []),
      grainAngleDeg: finite(piece.grainAngleDeg, 0),
    },
    attachments: {
      pins: cloneProject(piece.pins || []),
      surface: cloneProject(piece.surfaceAttachments || []),
      fusedToPieceId: piece.fusedToPieceId || null,
      fuseStiffness: finite(piece.fuseStiffness, 0.985),
      fuseGapM: finite(piece.fuseGapM, 0.001),
    },
  }
}

function normalizedSeam(seam) {
  return {
    id: seam.id,
    name: seam.name || seam.id,
    type: seam.type || 'normal',
    a: cloneProject(seam.a || {}),
    b: cloneProject(seam.b || {}),
    reverseB: Boolean(seam.reverseB),
    ratio: finite(seam.ratio, 1),
    easeSide: seam.easeSide || null,
    gatherSide: seam.gatherSide || null,
    elasticRatio: seam.elasticRatio == null ? null : finite(seam.elasticRatio, 1),
    openFraction: seam.openFraction == null ? null : finite(seam.openFraction, 0),
    junctionScale: seam.junctionScale == null ? null : finite(seam.junctionScale, 1),
  }
}

export function buildSimulationRequest(project, options = {}) {
  const fabrics = Object.fromEntries(
    Object.entries(project.fabrics || {}).map(([id, fabric]) => [id, normalizedFabric(id, fabric)]),
  )
  return {
    protocol: SIMULATION_PROTOCOL,
    version: SIMULATION_PROTOCOL_VERSION,
    requestId: options.requestId || `sim-${Date.now()}`,
    project: {
      id: project.id || null,
      name: project.name || 'Untitled Garment',
      revision: finite(project.revision, 1),
      units: 'cm',
    },
    avatar: cloneProject(project.avatar || {}),
    fabrics,
    pieces: (project.pieces || []).map(normalizedPiece),
    seams: (project.seams || []).map(normalizedSeam),
    fasteners: cloneProject(project.fasteners || []),
    settings: cloneProject(project.simulation || {}),
    requestedOutputs: options.requestedOutputs || ['positions', 'normals', 'strain', 'contact'],
  }
}

export function validateSimulationRequest(request) {
  const errors = []
  if (request?.protocol !== SIMULATION_PROTOCOL) errors.push(`protocol must be ${SIMULATION_PROTOCOL}`)
  if (Number(request?.version) !== SIMULATION_PROTOCOL_VERSION) errors.push(`version must be ${SIMULATION_PROTOCOL_VERSION}`)
  if (!Array.isArray(request?.pieces) || request.pieces.length === 0) errors.push('pieces must contain at least one pattern piece')
  const pieceIds = new Set()
  for (const piece of request?.pieces || []) {
    if (!piece?.id) errors.push('every piece requires an id')
    if (pieceIds.has(piece?.id)) errors.push(`duplicate piece id: ${piece.id}`)
    pieceIds.add(piece?.id)
    if (!Array.isArray(piece?.pattern?.pointsCm) || piece.pattern.pointsCm.length < 3) errors.push(`${piece?.id || 'piece'} requires at least 3 pattern points`)
  }
  for (const seam of request?.seams || []) {
    if (!pieceIds.has(seam?.a?.pieceId)) errors.push(`${seam?.id || 'seam'} references missing piece ${seam?.a?.pieceId}`)
    if (!pieceIds.has(seam?.b?.pieceId)) errors.push(`${seam?.id || 'seam'} references missing piece ${seam?.b?.pieceId}`)
  }
  return { ok: errors.length === 0, errors }
}

export function serializeSimulationRequest(request) {
  const validation = validateSimulationRequest(request)
  if (!validation.ok) throw new Error(`Invalid simulation request: ${validation.errors.join('; ')}`)
  return JSON.stringify(request, null, 2)
}

export function backendResultSummary(result = {}) {
  const pieceCount = Array.isArray(result.pieces) ? result.pieces.length : result.pieces instanceof Map ? result.pieces.size : 0
  return {
    backendId: result.backendId || 'unknown',
    protocolVersion: Number(result.protocolVersion || SIMULATION_PROTOCOL_VERSION),
    pieceCount,
    frame: Number(result.frame || 0),
    stats: cloneProject(result.stats || {}),
  }
}
