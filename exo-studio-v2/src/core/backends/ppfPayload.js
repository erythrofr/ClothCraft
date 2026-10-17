import { buildNativeSimulationPayload } from './nativePayload.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)))

function ppfAvatarSettings(project) {
  const representation = project.simulation?.ppfAvatarRepresentation ??
    (project.avatar?.model === 'clo-thomas' ? 'pinned-shell' : 'static')
  if (!['static', 'pinned-shell'].includes(representation)) throw new Error('Invalid PPF avatar representation')
  return {
    avatarRepresentation: representation,
    avatarContactGap: clamp(project.simulation?.ppfAvatarContactGap ?? .001, .0001, .01),
    avatarContactOffset: clamp(project.simulation?.ppfAvatarContactOffset ?? 0, 0, .005),
  }
}

// Source: locally installed PPF add-on presets/materials.toml. These are
// solver-normalized starting points, not laboratory certification of a fabric.
// Previously an unset modulus/bend silently picked generic Shell defaults,
// making a jersey tee much stiffer in bending than PPF's Cotton reference.
export function ppfSolverFabricPreset(fabric = {}) {
  const text = `${fabric.id || ''} ${fabric.name || ''}`.toLowerCase()
  if (/silk/.test(text)) return { shellYoungModulus: 500, bend: 1.42, friction: .25, preset: 'Silk' }
  if (/denim|jean/.test(text)) return { shellYoungModulus: 10000, bend: 10, friction: .5, preset: 'Denim' }
  if (/wool|fleece|terry/.test(text)) return { shellYoungModulus: 2000, bend: 3.67, friction: .4, preset: 'Wool' }
  return { shellYoungModulus: 5500, bend: 4.3, friction: .35, preset: 'Cotton' }
}

function ppfFabricMaterial(fabric = {}, project = {}) {
  const override = fabric.ppf || {}
  const defaults = ppfSolverFabricPreset(fabric)
  const shrinkWarp = clamp(fabric.shrinkWarp ?? 0, 0, 0.45)
  const shrinkWeft = clamp(fabric.shrinkWeft ?? 0, 0, 0.45)
  const material = {
    shellDensity: Math.max(0.001, Number(override.shellDensity ?? (Number(fabric.gsm ?? 180) / 1000))),
    friction: clamp(override.friction ?? fabric.friction ?? 0.35, 0, 4),
    shrinkX: clamp(override.shrinkX ?? (1 - shrinkWarp), 0.2, 2),
    shrinkY: clamp(override.shrinkY ?? (1 - shrinkWeft), 0.2, 2),
    contactGap: override.contactGap ?? project.simulation?.ppfContactGap ?? .001,
    contactOffset: override.contactOffset ?? project.simulation?.ppfContactOffset ?? 0,
    shellYoungModulus: override.shellYoungModulus ?? defaults.shellYoungModulus,
    shellPoissonRatio: override.shellPoissonRatio ?? null,
    bend: override.bend ?? defaults.bend,
    stitchStiffness: override.stitchStiffness ?? project.simulation?.ppfStitchStiffness ?? null,
    strainLimitPercent: override.strainLimitPercent ?? project.simulation?.ppfStrainLimitPercent ?? 5,
  }
  return Object.fromEntries(Object.entries(material).filter(([, value]) => value !== null && value !== undefined && Number.isFinite(Number(value))))
}

function uniqueEdges(constraints = []) {
  const seen = new Set()
  const edges = []
  const stitchTypes = new Set(['seam', 'surface-stitch', 'fastener'])
  for (const constraint of constraints) {
    if (!stitchTypes.has(constraint.type)) continue
    const a = Number(constraint.a)
    const b = Number(constraint.b)
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) continue
    const key = a < b ? `${a}:${b}` : `${b}:${a}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({
      a,
      b,
      type: constraint.type,
      seamId: constraint.seamId || null,
    })
  }
  return edges
}

// Anchor only four shoulder landmarks for the initial exploded sewing phase.
// Soft PPF pulls are released early, unlike permanent hard pins that keep the
// neckline suspended and cause the very floating fit being diagnosed.
export function ppfTemporaryShoulderSupports(nativePieces = [], enabled = true, frames = 60) {
  if (!enabled) return null
  const indices = []
  for (const name of ['front', 'back']) {
    const piece = nativePieces.find(item => item.id === name)
    if (!piece?.flatVerticesM?.length) continue
    const maxY = Math.max(...piece.flatVerticesM.map(vertex => vertex[1]))
    for (const side of [-1, 1]) {
      let winner = null, score = Infinity
      for (let i = 0; i < piece.flatVerticesM.length; i++) {
        const vertex = piece.flatVerticesM[i]
        if (Math.sign(vertex[0]) !== side || vertex[1] < maxY - .16) continue
        const distance = Math.abs(Math.abs(vertex[0]) - .21) + Math.abs(vertex[1] - (maxY - .025)) * .65
        if (distance < score) { score = distance; winner = piece.particleIndices[i] }
      }
      if (Number.isInteger(winner)) indices.push(winner)
    }
  }
  if (indices.length !== 4 || new Set(indices).size !== 4) return null
  return {
    indices,
    mode: 'soft-pull',
    strength: 1.5,
    releaseAfterFrames: Math.max(2, Math.min(12, Math.round(frames * .2))),
  }
}

function translatePiece(vertices, indices, dx = 0, dy = 0, dz = 0) {
  for (const index of indices || []) {
    if (!vertices[index]) continue
    vertices[index][0] += dx
    vertices[index][1] += dy
    vertices[index][2] += dz
  }
}

function stageHoodPiece(vertices, piece, side) {
  const flat = piece?.flatVerticesM || []
  const indices = piece?.particleIndices || []
  if (!flat.length || flat.length !== indices.length) return null
  const xs = flat.map((point) => Number(point[0]))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const width = Math.max(0.001, maxX - minX)
  const baseY = 1.60
  const backZ = -0.30
  for (let localIndex = 0; localIndex < indices.length; localIndex += 1) {
    const globalIndex = indices[localIndex]
    const point = flat[localIndex]
    if (!vertices[globalIndex] || !point) continue
    const localX = Number(point[0]) - minX
    vertices[globalIndex] = [
      side < 0 ? -width + localX : width - localX,
      baseY + Number(point[1]),
      backZ,
    ]
  }
  return {
    mode: 'flat-vertical',
    side,
    width,
    baseY,
    backZ,
  }
}

function applyPpfStagingPose(project, native, vertices, options = {}) {
  if (options.staging === false) return { strategy: 'document-arrangement', pieces: {} }
  const projectPieces = new Map((project.pieces || []).map((piece) => [piece.id, piece]))
  const nativePieces = new Map((native.pieces || []).map((piece) => [piece.id, piece]))
  const staging = { strategy: 'exploded-sewing-v1', pieces: {} }

  for (const nativePiece of native.pieces || []) {
    const piece = projectPieces.get(nativePiece.id) || {}
    const wrap = piece.arrangement3d?.wrap || ''
    const role = piece.generatedRole || ''
    let transform = null

    if (wrap === 'left-arm') {
      translatePiece(vertices, nativePiece.particleIndices, -0.15, 0, 0)
      transform = { mode: 'translate', dx: -0.15, dy: 0, dz: 0 }
    } else if (wrap === 'right-arm') {
      translatePiece(vertices, nativePiece.particleIndices, 0.15, 0, 0)
      transform = { mode: 'translate', dx: 0.15, dy: 0, dz: 0 }
    } else if (wrap === 'left-wrist') {
      translatePiece(vertices, nativePiece.particleIndices, -0.15, 0, 0)
      transform = { mode: 'translate', dx: -0.15, dy: 0, dz: 0 }
    } else if (wrap === 'right-wrist') {
      translatePiece(vertices, nativePiece.particleIndices, 0.15, 0, 0)
      transform = { mode: 'translate', dx: 0.15, dy: 0, dz: 0 }
    } else if (role === 'hood-left' || wrap === 'hood-left') {
      transform = stageHoodPiece(vertices, nativePieces.get(nativePiece.id), -1)
    } else if (role === 'hood-right' || wrap === 'hood-right') {
      transform = stageHoodPiece(vertices, nativePieces.get(nativePiece.id), 1)
    } else if (role === 'kangaroo-pocket') {
      translatePiece(vertices, nativePiece.particleIndices, 0, 0, 0.12)
      transform = { mode: 'translate', dx: 0, dy: 0, dz: 0.12 }
    } else if (role === 'rib-waistband' || wrap === 'waist-band') {
      translatePiece(vertices, nativePiece.particleIndices, 0, -0.10, 0)
      transform = { mode: 'translate', dx: 0, dy: -0.10, dz: 0 }
    } else if (role === 'zip-front-left') {
      translatePiece(vertices, nativePiece.particleIndices, -0.04, 0, 0)
      transform = { mode: 'translate', dx: -0.04, dy: 0, dz: 0 }
    } else if (role === 'zip-front-right') {
      translatePiece(vertices, nativePiece.particleIndices, 0.04, 0, 0)
      transform = { mode: 'translate', dx: 0.04, dy: 0, dz: 0 }
    }

    if (transform) staging.pieces[nativePiece.id] = transform
  }
  return staging
}

export function buildPpfPayload(project, options = {}) {
  const native = buildNativeSimulationPayload(project, options)
  const vertices = native.particles.map((particle) => [...particle.position])
  const staging = applyPpfStagingPose(project, native, vertices, options)
  const faces = []
  const facePieceIds = []
  const pieceRanges = []

  for (const piece of native.pieces) {
    const startFace = faces.length
    for (const face of piece.faces || []) {
      const global = face.map((localIndex) => piece.particleIndices[localIndex])
      if (global.length === 3 && global.every(Number.isInteger)) {
        faces.push(global)
        facePieceIds.push(piece.id)
      }
    }
    pieceRanges.push({
      id: piece.id,
      name: piece.name,
      fabricId: piece.fabricId,
      faceStart: startFace,
      faceCount: faces.length - startFace,
      particleIndices: [...piece.particleIndices],
    })
  }

  const fabrics = Object.fromEntries(Object.entries(project.fabrics || {}).map(([id, fabric]) => [
    id,
    {
      id,
      name: fabric.name || id,
      material: ppfFabricMaterial(fabric, project),
    },
  ]))

  return {
    protocol: 'garment-studio.ppf-shell',
    version: 1,
    project: {
      id: project.id || null,
      name: project.name || 'Untitled Garment',
      revision: Number(project.revision || 1),
    },
    scene: {
      gravity: [0, 0, -Math.abs(Number(project.simulation?.gravity ?? 9.81))],
      ...ppfAvatarSettings(project),
      frameCount: Math.max(10, Number(options.frameCount ?? project.simulation?.ppfFrameCount ?? 90)),
      frameRate: Math.max(1, Number(options.frameRate ?? 60)),
      stepSize: Number(options.stepSize ?? project.simulation?.ppfStepSize ?? 0.004),
      contactNnz: Number(project.simulation?.ppfContactNnz ?? 4000000),
      lineSearchMaxT: Number(project.simulation?.ppfLineSearchMaxT ?? 1.25),
      staging,
    },
    shell: {
      objectName: options.objectName || 'PPF_Garment',
      vertices,
      faces,
      stitchEdges: uniqueEdges(native.constraints),
      facePieceIds,
      pieces: pieceRanges,
    },
    fabrics,
    avatar: {
      // CLO Thomas has an actual user-owned body mesh installed locally.
      // Prefer its posed skin surface over the disconnected ellipsoid proxy
      // when running Blender/PPF; neither file nor mesh bytes enter the JSON.
      mode: project.avatar?.model === 'clo-thomas' ? 'local-thomas-body-mesh' : 'garment-studio-proxy',
      measurements: { ...(project.avatar || {}) },
      objectPrefix: 'PPF_Avatar_',
    },
    source: {
      nativePayloadVersion: native.version,
      particles: native.particles.length,
      constraints: native.constraints.length,
      anchors: native.anchors.length,
    },
  }
}

export function buildDressedPpfPayload(project, nativePayload, nativeResult, options = {}) {
  if (nativePayload?.protocol !== 'garment-studio.native-xpbd') throw new Error('Dressed PPF payload requires a Garment Studio native XPBD payload')
  if (!Array.isArray(nativeResult?.pieces)) throw new Error('Dressed PPF payload requires a native simulation result with pieces')

  const resultById = new Map(nativeResult.pieces.map((piece) => [piece.id, piece]))
  const vertices = nativePayload.particles.map((particle) => [...particle.position])
  const faces = []
  const facePieceIds = []
  const pieceRanges = []

  for (const piece of nativePayload.pieces || []) {
    const resultPiece = resultById.get(piece.id)
    if (!resultPiece) throw new Error(`Native result is missing piece ${piece.id}`)
    if ((resultPiece.vertices || []).length !== (piece.particleIndices || []).length) {
      throw new Error(`Native result vertex count mismatch for ${piece.id}: ${resultPiece.vertices?.length || 0} != ${piece.particleIndices?.length || 0}`)
    }

    for (let localIndex = 0; localIndex < piece.particleIndices.length; localIndex += 1) {
      const globalIndex = piece.particleIndices[localIndex]
      const position = resultPiece.vertices[localIndex]
      if (!Number.isInteger(globalIndex) || !Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) {
        throw new Error(`Invalid dressed vertex ${piece.id}:${localIndex}`)
      }
      vertices[globalIndex] = [...position]
    }

    const startFace = faces.length
    for (const face of resultPiece.faces || piece.faces || []) {
      const global = face.map((localIndex) => piece.particleIndices[localIndex])
      if (global.length === 3 && global.every(Number.isInteger)) {
        faces.push(global)
        facePieceIds.push(piece.id)
      }
    }
    pieceRanges.push({
      id: piece.id,
      name: piece.name,
      fabricId: piece.fabricId,
      faceStart: startFace,
      faceCount: faces.length - startFace,
      particleIndices: [...piece.particleIndices],
    })
  }

  const fabrics = Object.fromEntries(Object.entries(project.fabrics || {}).map(([id, fabric]) => [
    id,
    {
      id,
      name: fabric.name || id,
      material: ppfFabricMaterial(fabric, project),
    },
  ]))

  return {
    protocol: 'garment-studio.ppf-shell',
    version: 2,
    project: {
      id: project.id || null,
      name: project.name || 'Untitled Garment',
      revision: Number(project.revision || 1),
      sourceBackend: nativeResult.backendId || 'native-pbd-xpbd',
      sourceFrames: Number(nativeResult.frames || 0),
    },
    scene: {
      gravity: [0, 0, -Math.abs(Number(project.simulation?.gravity ?? 9.81))],
      ...ppfAvatarSettings(project),
      frameCount: Math.max(10, Number(options.frameCount ?? project.simulation?.ppfFrameCount ?? 90)),
      frameRate: Math.max(1, Number(options.frameRate ?? 60)),
      stepSize: Number(options.stepSize ?? project.simulation?.ppfStepSize ?? 0.004),
      contactNnz: Number(project.simulation?.ppfContactNnz ?? 4000000),
      lineSearchMaxT: Number(project.simulation?.ppfLineSearchMaxT ?? 1.25),
    },
    shell: {
      objectName: options.objectName || 'PPF_Garment',
      vertices,
      faces,
      stitchEdges: uniqueEdges(nativePayload.constraints),
      facePieceIds,
      pieces: pieceRanges,
      dressed: true,
      welded: false,
    },
    fabrics,
    avatar: {
      mode: project.avatar?.model === 'clo-thomas' ? 'local-thomas-body-mesh' : 'garment-studio-proxy',
      measurements: { ...(project.avatar || {}) },
      objectPrefix: 'PPF_Avatar_',
    },
    source: {
      nativePayloadVersion: nativePayload.version,
      nativeBackendId: nativeResult.backendId || null,
      nativeFrames: Number(nativeResult.frames || 0),
      particles: nativePayload.particles.length,
      constraints: nativePayload.constraints.length,
      anchors: nativePayload.anchors?.length || 0,
    },
  }
}

function explodedPieceVertex(projectPiece, flatVertex, index, options = {}) {
  const x = Number(flatVertex?.[0] || 0)
  const y = Number(flatVertex?.[1] || 0)
  const baseY = Number(options.baseY ?? 1.0)
  const torsoDepth = Number(options.torsoDepth ?? 0.36)
  const armOffset = Number(options.armOffset ?? 0.72)
  const wrap = projectPiece?.arrangement3d?.wrap || ''
  const arrangementX = Number(projectPiece?.arrangement3d?.x || 0)

  if (wrap === 'front') return [x + arrangementX, baseY + y, torsoDepth]
  if (wrap === 'back') return [x + arrangementX, baseY + y, -torsoDepth]
  if (wrap === 'left-arm') return [-armOffset, baseY + y, -x]
  if (wrap === 'right-arm') return [armOffset, baseY + y, x]
  if (wrap === 'left-leg-front') return [-0.22, 0.30 + y, 0.30 + x]
  if (wrap === 'left-leg-back') return [-0.22, 0.30 + y, -0.30 - x]
  if (wrap === 'right-leg-front') return [0.22, 0.30 + y, 0.30 + x]
  if (wrap === 'right-leg-back') return [0.22, 0.30 + y, -0.30 - x]
  if (wrap === 'lower-front') return [x + arrangementX, 0.35 + y, 0.32]
  if (wrap === 'lower-back') return [x + arrangementX, 0.35 + y, -0.32]
  if (String(projectPiece?.generatedRole || '').startsWith('hood') || wrap === 'hood') {
    const side = index % 2 === 0 ? -1 : 1
    return [x + side * 0.26, 1.55 + y, side * 0.38]
  }

  // Unknown/custom pieces get deterministic slots in front of the avatar so
  // a contributor can still inspect and sew them without overlapping the
  // core garment pieces at build time.
  const column = index % 3
  const row = Math.floor(index / 3)
  return [x + (column - 1) * 0.75, baseY + y + row * 0.8, 0.72]
}

export function buildExplodedPpfPayload(project, options = {}) {
  const native = buildNativeSimulationPayload(project, options)
  const projectById = new Map((project.pieces || []).map((piece) => [piece.id, piece]))
  const frameCount = Math.max(10, Number(options.frameCount ?? project.simulation?.ppfFrameCount ?? 120))
  // The first supported 20-frame Thomas solve still had body intersections.
  // Keep temporary holds opt-in until their effect is independently verified.
  const supports = ppfTemporaryShoulderSupports(native.pieces, project.simulation?.ppfShoulderSupports === true, frameCount)
  const vertices = native.particles.map((particle) => [...particle.position])
  const faces = []
  const facePieceIds = []
  const pieceRanges = []

  for (let pieceIndex = 0; pieceIndex < native.pieces.length; pieceIndex += 1) {
    const piece = native.pieces[pieceIndex]
    const projectPiece = projectById.get(piece.id) || {}
    for (let localIndex = 0; localIndex < piece.particleIndices.length; localIndex += 1) {
      vertices[piece.particleIndices[localIndex]] = explodedPieceVertex(
        projectPiece,
        piece.flatVerticesM[localIndex],
        pieceIndex,
        options,
      )
    }
    const startFace = faces.length
    for (const face of piece.faces || []) {
      const global = face.map((localIndex) => piece.particleIndices[localIndex])
      if (global.length === 3 && global.every(Number.isInteger)) {
        faces.push(global)
        facePieceIds.push(piece.id)
      }
    }
    pieceRanges.push({
      id: piece.id,
      name: piece.name,
      fabricId: piece.fabricId,
      faceStart: startFace,
      faceCount: faces.length - startFace,
      particleIndices: [...piece.particleIndices],
    })
  }

  const fabrics = Object.fromEntries(Object.entries(project.fabrics || {}).map(([id, fabric]) => [
    id,
    { id, name: fabric.name || id, material: ppfFabricMaterial(fabric, project) },
  ]))

  return {
    protocol: 'garment-studio.ppf-shell',
    version: 3,
    project: {
      id: project.id || null,
      name: project.name || 'Untitled Garment',
      revision: Number(project.revision || 1),
      sourceBackend: 'exploded-pattern-arrangement',
      sourceFrames: 0,
    },
    scene: {
      gravity: [0, 0, -Math.abs(Number(project.simulation?.gravity ?? 9.81))],
      ...ppfAvatarSettings(project),
      frameCount,
      frameRate: Math.max(1, Number(options.frameRate ?? 60)),
      stepSize: Number(options.stepSize ?? project.simulation?.ppfStepSize ?? 0.004),
      contactNnz: Number(project.simulation?.ppfContactNnz ?? 4000000),
      lineSearchMaxT: Number(project.simulation?.ppfLineSearchMaxT ?? 1.25),
    },
    shell: {
      objectName: options.objectName || 'PPF_Garment',
      vertices,
      faces,
      stitchEdges: uniqueEdges(native.constraints),
      facePieceIds,
      pieces: pieceRanges,
      dressed: false,
      welded: false,
      arrangement: 'exploded',
      temporaryShoulderSupports: supports,
    },
    fabrics,
    avatar: {
      mode: project.avatar?.model === 'clo-thomas' ? 'local-thomas-body-mesh' : 'garment-studio-proxy',
      measurements: { ...(project.avatar || {}) },
      objectPrefix: 'PPF_Avatar_',
    },
    source: {
      nativePayloadVersion: native.version,
      particles: native.particles.length,
      constraints: native.constraints.length,
      anchors: native.anchors.length,
    },
  }
}

export function validatePpfPayload(payload) {
  const errors = []
  if (payload?.protocol !== 'garment-studio.ppf-shell') errors.push('invalid PPF payload protocol')
  if (!Array.isArray(payload?.shell?.vertices) || payload.shell.vertices.length < 3) errors.push('PPF shell needs vertices')
  if (!Array.isArray(payload?.shell?.faces) || payload.shell.faces.length < 1) errors.push('PPF shell needs triangle faces')
  const count = payload?.shell?.vertices?.length || 0
  const vertices = Array.isArray(payload?.shell?.vertices) ? payload.shell.vertices : []
  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index]
    if (!Array.isArray(vertex) || vertex.length !== 3 || !vertex.every(Number.isFinite)) {
      errors.push(`PPF vertex ${index} must contain three finite coordinates in metres`)
    }
  }
  const faceEdges = new Set()
  for (let faceIndex = 0; faceIndex < (payload?.shell?.faces || []).length; faceIndex += 1) {
    const face = payload.shell.faces[faceIndex]
    if (!Array.isArray(face) || face.length !== 3 || face.some((index) => !Number.isInteger(index) || index < 0 || index >= count) || new Set(face).size !== 3) {
      errors.push(`invalid PPF face ${faceIndex}: ${JSON.stringify(face)}`)
      continue
    }
    const [a, b, c] = face
    for (const [u, v] of [[a, b], [b, c], [c, a]]) faceEdges.add(u < v ? `${u}:${v}` : `${v}:${u}`)
    if ([a, b, c].every((i) => Array.isArray(vertices[i]) && vertices[i].length === 3 && vertices[i].every(Number.isFinite))) {
      const A = vertices[a], B = vertices[b], C = vertices[c]
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2]
      const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2]
      const area2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
      if (area2 < 1e-12) errors.push(`degenerate PPF triangle ${faceIndex}`)
    }
  }
  const seenStitches = new Set()
  for (let index = 0; index < (payload?.shell?.stitchEdges || []).length; index += 1) {
    const edge = payload.shell.stitchEdges[index]
    if (!edge || ![edge.a, edge.b].every((vertexIndex) => Number.isInteger(vertexIndex) && vertexIndex >= 0 && vertexIndex < count) || edge.a === edge.b || typeof edge.seamId !== 'string' || !edge.seamId) {
      errors.push(`invalid PPF stitch edge ${index}: ${JSON.stringify(edge)}`)
      continue
    }
    const key = edge.a < edge.b ? `${edge.a}:${edge.b}` : `${edge.b}:${edge.a}`
    if (seenStitches.has(key)) errors.push(`duplicate PPF stitch pair ${index} (${key})`)
    if (faceEdges.has(key)) errors.push(`PPF stitch pair ${index} lies on a fabric triangle edge, not a loose seam`)
    seenStitches.add(key)
  }
  if (payload?.avatar?.mode === 'local-thomas-body-mesh' && !['pinned-shell', 'static'].includes(payload?.scene?.avatarRepresentation)) {
    errors.push('Thomas PPF payload must explicitly choose pinned-shell or static avatar collision; silent static fallback is unsafe for fit comparisons')
  }
  return { ok: errors.length === 0, errors }
}

export function ppfPayloadSummary(payload) {
  return {
    pieces: payload?.shell?.pieces?.length || 0,
    vertices: payload?.shell?.vertices?.length || 0,
    faces: payload?.shell?.faces?.length || 0,
    stitchEdges: payload?.shell?.stitchEdges?.length || 0,
    fabrics: Object.keys(payload?.fabrics || {}).length,
  }
}
