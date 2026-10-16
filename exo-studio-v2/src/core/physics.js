import { resolveSelfCollisions } from './physics/selfCollision.js'
import { avatarContactParameters, projectAvatarContacts } from './physics/avatarContactPass.js'
import { resolveSolverTimestep } from './physics/timestep.js'
import { assessSimulationFit } from './physics/qualityGate.js'
import { inspectClothMesh } from './physics/meshQuality.js'
import { optimizeTriangleQuality } from './physics/qualityTriangulation.js'
import * as THREE from 'three'
import { edgePointAt, edgeRangeLength, samplePieceBoundary } from './project.js'
import { simplifiedClothBoundary } from './clothMeshing.js'

// Three.js world units are meters throughout the solver. Pattern geometry is
// authored in centimeters, so 1 cm must equal 0.01 world units.
const CM_TO_WORLD = 0.01
const EPSILON = 1e-6

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function subdivide(vertices, faces, levels) {
  let verts = vertices.map((v) => v.clone())
  let tris = faces.map((face) => [...face])

  for (let level = 0; level < levels; level += 1) {
    const midpointCache = new Map()
    const midpoint = (a, b) => {
      const key = edgeKey(a, b)
      if (midpointCache.has(key)) return midpointCache.get(key)
      const next = verts[a].clone().add(verts[b]).multiplyScalar(0.5)
      const index = verts.length
      verts.push(next)
      midpointCache.set(key, index)
      return index
    }

    const nextFaces = []
    for (const [a, b, c] of tris) {
      const ab = midpoint(a, b)
      const bc = midpoint(b, c)
      const ca = midpoint(c, a)
      nextFaces.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca])
    }
    tris = nextFaces
  }

  return { vertices: verts, faces: tris }
}

function triangulate(points, resolution) {
  const boundary = points.map((point) => new THREE.Vector2(point.x, point.y))
  const faces = THREE.ShapeUtils.triangulateShape(boundary, [])
  return subdivide(boundary, faces, Math.max(0, Math.min(3, resolution || 0)))
}

function pointOnSegment(point, a, b, tolerance = 0.0015) {
  const ab = b.clone().sub(a)
  const ap = point.clone().sub(a)
  const lenSq = ab.lengthSq()
  if (lenSq < EPSILON) return null
  const t = ap.dot(ab) / lenSq
  if (t < -tolerance || t > 1 + tolerance) return null
  const closest = a.clone().addScaledVector(ab, t)
  if (closest.distanceTo(point) > tolerance) return null
  return Math.max(0, Math.min(1, t))
}

export function boundaryIndicesForEdge(pieceSim, edgeIndex) {
  const edgePath = pieceSim.edgePaths?.[edgeIndex]
  if (!edgePath?.length) return []
  const hits = []
  pieceSim.flatVertices.forEach((point, index) => {
    let distanceAlong = 0
    let hitT = null
    for (let segmentIndex = 0; segmentIndex < edgePath.length - 1; segmentIndex += 1) {
      const a = edgePath[segmentIndex]
      const b = edgePath[segmentIndex + 1]
      const aVec = new THREE.Vector2(a.x, a.y)
      const bVec = new THREE.Vector2(b.x, b.y)
      const localT = pointOnSegment(point, aVec, bVec, 0.003)
      const segmentLength = aVec.distanceTo(bVec)
      if (localT !== null) {
        hitT = distanceAlong + localT * segmentLength
        break
      }
      distanceAlong += segmentLength
    }
    if (hitT !== null) hits.push({ index, t: hitT })
  })
  hits.sort((left, right) => left.t - right.t)
  return hits.map((hit) => hit.index)
}

function boundaryIndicesForSeamEndpoint(pieceSim, endpoint) {
  const indices = boundaryIndicesForEdge(pieceSim, endpoint?.edgeIndex)
  if (indices.length < 2) return indices
  let start = Math.max(0, Math.min(1, Number(endpoint?.startT ?? 0)))
  let end = Math.max(0, Math.min(1, Number(endpoint?.endT ?? 1)))
  if (start > end) [start, end] = [end, start]
  if (start <= 0.0001 && end >= 0.9999) return indices
  let first = Math.round(start * (indices.length - 1))
  let last = Math.round(end * (indices.length - 1))
  first = Math.max(0, Math.min(indices.length - 1, first))
  last = Math.max(first, Math.min(indices.length - 1, last))
  if (first === last) {
    if (last < indices.length - 1) last += 1
    else if (first > 0) first -= 1
  }
  return indices.slice(first, last + 1)
}

function patternBounds(points) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

export function getAvatarHeightScale(avatar) {
  return Math.max(0.78, Math.min(1.22, Number(avatar?.heightCm ?? 180) / 180))
}

export function getAvatarUpperBodyDimensions(avatar) {
  const heightScale = getAvatarHeightScale(avatar)
  const chestScale = Math.max(0.72, Math.min(1.42, Number(avatar?.chestCm ?? 96) / 96))
  const shoulderWidthCm = Math.max(34, Math.min(62, Number(avatar?.shoulderWidthCm ?? 46)))
  const neckCm = Math.max(28, Math.min(58, Number(avatar?.neckCm ?? 38)))
  const bicepCm = Math.max(20, Math.min(60, Number(avatar?.bicepCm ?? 32)))
  const armLengthCm = Math.max(42, Math.min(86, Number(avatar?.armLengthCm ?? (72 * heightScale))))
  const shoulderHalfWidth = shoulderWidthCm * 0.005
  const neckScale = neckCm / 38
  const bicepScale = bicepCm / 32
  const armRadius = 0.065 * bicepScale
  const armHalfLength = armLengthCm * 0.005
  return {
    heightScale,
    chestScale,
    shoulderWidthCm,
    shoulderHalfWidth,
    shoulderCapRadiusX: shoulderHalfWidth + 0.01,
    shoulderCapRadiusY: 0.15 * heightScale,
    shoulderCapRadiusZ: 0.135 * chestScale,
    shoulderCenterY: 1.57 * heightScale,
    shoulderJointY: 1.54 * heightScale,
    neckCm,
    neckRadius: 0.075 * neckScale,
    neckRadiusY: 0.14 * heightScale,
    neckCenterY: 1.72 * heightScale,
    bicepCm,
    armRadius,
    armLengthCm,
    armHalfLength,
  }
}

function bodyY(avatar, baseY) {
  return baseY * getAvatarHeightScale(avatar)
}

function wrappedWorldY(arrangementY, pointY, bounds, avatar) {
  const topAtBaseHeight = Number(arrangementY || 0) + bounds.maxY * CM_TO_WORLD
  return topAtBaseHeight * getAvatarHeightScale(avatar) - (bounds.maxY - pointY) * CM_TO_WORLD
}

function shoulderSurfaceBlend(worldY, avatar) {
  // Torso panels live on the front/back body surface through the chest, but
  // the upper shoulder construction must roll toward the top plane so front
  // and back shoulder edges meet around the body instead of sewing straight
  // through it. 1 = full front/back surface, 0 = shoulder plane.
  const baseY = worldY / getAvatarHeightScale(avatar)
  return 1 - THREE.MathUtils.smoothstep(baseY, 1.54, 1.685)
}

export function getAvatarArmPose(avatar, side = 1) {
  const safeSide = side < 0 ? -1 : 1
  const upper = getAvatarUpperBodyDimensions(avatar)
  const angle = THREE.MathUtils.degToRad(Math.max(0, Math.min(80, Number(avatar?.armAngleDeg ?? 6))))
  // Local -Y is the lower arm direction on the capsule. Matching the sign to
  // the body side makes the lower left arm travel left/outward and the lower
  // right arm travel right/outward as the pose angle increases.
  const rotationZ = safeSide * angle
  const axis = new THREE.Vector3(-Math.sin(rotationZ), Math.cos(rotationZ), 0).normalize()
  const shoulderJoint = new THREE.Vector3(
    safeSide * (upper.shoulderHalfWidth + upper.armRadius * 0.26),
    upper.shoulderJointY,
    0,
  )
  const center = shoulderJoint.clone().addScaledVector(axis, -upper.armHalfLength)
  return {
    side: safeSide,
    angle,
    rotationZ,
    center,
    axis,
    halfLength: upper.armHalfLength,
    radius: upper.armRadius,
    shoulderJoint,
  }
}

function legSectionAtY(worldY, avatar) {
  const baseY = worldY / getAvatarHeightScale(avatar)
  const normalizedY = (baseY - 0.24) / 0.48
  const factor = Math.sqrt(Math.max(0.08, 1 - normalizedY * normalizedY))
  return {
    centerX: 0.105,
    radiusX: 0.09 * factor,
    radiusZ: 0.10 * factor,
  }
}

function hipSectionAtY(worldY, avatar) {
  const hipScale = Math.max(0.82, Math.min(1.24, (avatar?.hipCm || 94) / 94))
  const baseY = worldY / getAvatarHeightScale(avatar)
  const normalizedY = (baseY - 0.78) / 0.28
  const factor = Math.sqrt(Math.max(0.10, 1 - normalizedY * normalizedY))
  return {
    radiusX: 0.20 * hipScale * factor,
    radiusZ: 0.14 * hipScale * factor,
  }
}

function initialPosition(piece, point, bounds, avatar) {
  const arrangement = piece.arrangement3d || {}
  const flip = arrangement.flip ? -1 : 1
  if (arrangement.wrap === 'front' || arrangement.wrap === 'back') {
    const centerX = (bounds.minX + bounds.maxX) * 0.5
    const worldY = wrappedWorldY(arrangement.y || 0, point.y, bounds, avatar)
    const radii = getAvatarTorsoRadii(avatar, worldY)
    const sideZ = arrangement.wrap === 'back' ? -1 : 1
    const worldX = (arrangement.x || 0) + (point.x - centerX) * CM_TO_WORLD * flip
    const normalizedX = Math.max(-0.999, Math.min(0.999, worldX / (radii.x + 0.018)))
    const surfaceEase = Math.max(0.006, 0.018 + Number(arrangement.surfaceOffsetM || 0))
    const surfaceZ = (radii.z + surfaceEase) * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX)) * shoulderSurfaceBlend(worldY, avatar)
    return new THREE.Vector3(
      worldX,
      worldY,
      sideZ * surfaceZ,
    )
  }
  if (arrangement.wrap === 'lower-front' || arrangement.wrap === 'lower-back') {
    const centerX = (bounds.minX + bounds.maxX) * 0.5
    const localX = (point.x - centerX) * (flip || 1)
    const worldY = wrappedWorldY(arrangement.y || 0, point.y, bounds, avatar)
    const sideZ = arrangement.wrap === 'lower-back' ? -1 : 1
    let worldX
    let surfaceZ

    if (worldY >= bodyY(avatar, 0.62)) {
      const hipScale = Math.max(0.82, Math.min(1.24, (avatar?.hipCm || 94) / 94))
      const radiusX = 0.205 * hipScale
      const radiusZ = 0.145 * hipScale
      worldX = THREE.MathUtils.clamp(localX * 0.0084, -radiusX * 0.98, radiusX * 0.98)
      const normalizedX = worldX / radiusX
      surfaceZ = sideZ * (radiusZ + 0.018) * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX))
    } else {
      const legSide = localX < 0 ? -1 : 1
      const center = legSide * 0.15
      const patternCenter = legSide * 13.5
      worldX = center + (localX - patternCenter) * 0.0082
      const radius = 0.13
      const normalizedX = THREE.MathUtils.clamp((worldX - center) / radius, -0.98, 0.98)
      surfaceZ = sideZ * (radius + 0.014) * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX))
    }
    return new THREE.Vector3(worldX, worldY, surfaceZ)
  }
  if (arrangement.wrap === 'neck') {
    const minX = bounds.minX
    const spanX = Math.max(1e-5, bounds.maxX - bounds.minX)
    const t = THREE.MathUtils.clamp((point.x - minX) / spanX, 0, 1)
    // Neck strips are authored from left shoulder -> front -> right shoulder
    // -> back -> left shoulder. Match that sewing path in 3D instead of
    // starting at back-center, otherwise the ring twists the whole bodice.
    const phase = THREE.MathUtils.degToRad(Number(arrangement.phaseDeg ?? 180))
    const direction = Number(arrangement.direction ?? -1) < 0 ? -1 : 1
    const angle = phase + direction * t * Math.PI * 2
    const radius = Number(arrangement.radius || 0.094)
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      bodyY(avatar, arrangement.y || 1.595) + point.y * CM_TO_WORLD,
      Math.sin(angle) * radius,
    )
  }
  if (arrangement.wrap === 'waist-band') {
    const spanX = Math.max(1e-5, bounds.maxX - bounds.minX)
    const t = THREE.MathUtils.clamp((point.x - bounds.minX) / spanX, 0, 1)
    const phase = THREE.MathUtils.degToRad(Number(arrangement.phaseDeg ?? 180))
    const direction = Number(arrangement.direction ?? -1) < 0 ? -1 : 1
    const angle = phase + direction * t * Math.PI * 2
    const worldY = bodyY(avatar, arrangement.y || 0.90) + (point.y - bounds.minY) * CM_TO_WORLD
    const radii = getAvatarTorsoRadii(avatar, worldY)
    const ease = Number(arrangement.easeM ?? 0.018)
    return new THREE.Vector3(
      Math.cos(angle) * (radii.x + ease),
      worldY,
      Math.sin(angle) * (radii.z + ease),
    )
  }
  if (arrangement.wrap === 'left-wrist' || arrangement.wrap === 'right-wrist') {
    const side = arrangement.wrap === 'left-wrist' ? -1 : 1
    const pose = getAvatarArmPose(avatar, side)
    const spanX = Math.max(1e-5, bounds.maxX - bounds.minX)
    const t = THREE.MathUtils.clamp((point.x - bounds.minX) / spanX, 0, 1)
    const angle = t * Math.PI * 2
    const along = Number(arrangement.alongOffsetM ?? 0.08) + (point.y - bounds.minY) * CM_TO_WORLD
    const center = pose.center.clone().addScaledVector(pose.axis, -pose.halfLength + along)
    const radialXY = new THREE.Vector3(Math.cos(pose.rotationZ), Math.sin(pose.rotationZ), 0).normalize()
    const radialZ = new THREE.Vector3(0, 0, 1)
    const radius = Number(arrangement.radius ?? 0.074)
    center.addScaledVector(radialXY, Math.cos(angle) * radius)
    center.addScaledVector(radialZ, Math.sin(angle) * radius)
    return center
  }
  if (arrangement.wrap === 'hood-left' || arrangement.wrap === 'hood-right') {
    const side = arrangement.wrap === 'hood-left' ? -1 : 1
    const spanX = Math.max(1e-5, bounds.maxX - bounds.minX)
    const t = THREE.MathUtils.clamp((point.x - bounds.minX) / spanX, 0, 1)
    const height = Math.max(1e-5, bounds.maxY - bounds.minY)
    const hoodY = THREE.MathUtils.clamp((point.y - bounds.minY) / height, 0, 1)
    if (piece.hoodState === 'down') {
      // A lowered hood should start as a folded shell behind the neckline,
      // not as a head-wrapped hood with its pins removed. Keep the neckline
      // edge high and let the crown/back fall toward the upper back.
      const angle = t * Math.PI
      const shoulderWidth = 0.185
      const foldDepth = 0.055
      return new THREE.Vector3(
        side * Math.sin(angle) * shoulderWidth,
        bodyY(avatar, 1.595) - hoodY * 0.235,
        -0.15 + Math.cos(angle) * foldDepth - hoodY * 0.045,
      )
    }
    const necklineProfile = Array.isArray(arrangement.necklineYProfile) ? arrangement.necklineYProfile : []
    let necklineBaseY = Number(arrangement.y || 1.59)
    if (necklineProfile.length) {
      const clampedX = THREE.MathUtils.clamp(point.x, necklineProfile[0].x, necklineProfile[necklineProfile.length - 1].x)
      let left = necklineProfile[0]
      let right = necklineProfile[necklineProfile.length - 1]
      for (let index = 0; index < necklineProfile.length - 1; index += 1) {
        if (clampedX >= necklineProfile[index].x && clampedX <= necklineProfile[index + 1].x) {
          left = necklineProfile[index]
          right = necklineProfile[index + 1]
          break
        }
      }
      const span = Math.max(1e-5, right.x - left.x)
      necklineBaseY = THREE.MathUtils.lerp(left.y, right.y, THREE.MathUtils.clamp((clampedX - left.x) / span, 0, 1))
    }
    const worldY = bodyY(avatar, necklineBaseY) + (point.y - bounds.minY) * CM_TO_WORLD
    const sampleBaseY = THREE.MathUtils.clamp(worldY / getAvatarHeightScale(avatar), 1.70, 2.07)
    const normalizedY = THREE.MathUtils.clamp((sampleBaseY - 1.88) / 0.22, -0.98, 0.98)
    const headSection = Math.sqrt(Math.max(0.04, 1 - normalizedY * normalizedY))
    const headRadiusX = 0.16 * headSection + 0.018
    const headRadiusZ = 0.17 * headSection + 0.018
    const neckBlend = THREE.MathUtils.smoothstep(worldY / getAvatarHeightScale(avatar), 1.58, 1.74)
    const radiusX = THREE.MathUtils.lerp(0.105, headRadiusX, neckBlend)
    const radiusZ = THREE.MathUtils.lerp(0.095, headRadiusZ, neckBlend)
    const angle = t * Math.PI
    return new THREE.Vector3(
      side * Math.sin(angle) * radiusX,
      worldY,
      Math.cos(angle) * radiusZ,
    )
  }
  if (['left-leg-front', 'left-leg-back', 'right-leg-front', 'right-leg-back'].includes(arrangement.wrap)) {
    const legSide = arrangement.wrap.startsWith('left-') ? -1 : 1
    const frontSide = arrangement.wrap.endsWith('-front') ? 1 : -1
    const worldY = wrappedWorldY(arrangement.y || 0, point.y, bounds, avatar)
    const t = THREE.MathUtils.clamp((point.x - bounds.minX) / Math.max(1e-5, bounds.maxX - bounds.minX), 0, 1)
    const leg = legSectionAtY(worldY, avatar)
    const legRadiusX = leg.radiusX + 0.012
    const legRadiusZ = leg.radiusZ + 0.012
    const legAngle = frontSide > 0
      ? (legSide < 0 ? THREE.MathUtils.lerp(-Math.PI / 2, Math.PI / 2, t) : THREE.MathUtils.lerp(Math.PI / 2, -Math.PI / 2, t))
      : (legSide < 0 ? THREE.MathUtils.lerp(-Math.PI / 2, -3 * Math.PI / 2, t) : THREE.MathUtils.lerp(Math.PI / 2, 3 * Math.PI / 2, t))
    const legX = legSide * leg.centerX + Math.sin(legAngle) * legRadiusX
    const legZ = Math.cos(legAngle) * legRadiusZ

    const hip = getAvatarTorsoRadii(avatar, worldY)
    const hipRadiusX = hip.x + 0.014
    const hipRadiusZ = hip.z + 0.014
    const hipAngle = frontSide > 0
      ? (legSide < 0 ? THREE.MathUtils.lerp(-Math.PI / 2, 0, t) : THREE.MathUtils.lerp(Math.PI / 2, 0, t))
      : (legSide < 0 ? THREE.MathUtils.lerp(-Math.PI / 2, -Math.PI, t) : THREE.MathUtils.lerp(Math.PI / 2, Math.PI, t))
    const hipX = Math.sin(hipAngle) * hipRadiusX
    const hipZ = Math.cos(hipAngle) * hipRadiusZ

    // Blend through the upper-thigh/crotch zone. A hard switch between the
    // leg and pelvis surfaces creates enormous artificial strain on tiny
    // triangles that happen to cross the transition height.
    const heightScale = getAvatarHeightScale(avatar)
    const pelvisBlend = THREE.MathUtils.smoothstep(worldY, 0.54 * heightScale, 0.74 * heightScale)
    return new THREE.Vector3(
      THREE.MathUtils.lerp(legX, hipX, pelvisBlend),
      worldY,
      THREE.MathUtils.lerp(legZ, hipZ, pelvisBlend),
    )
  }
  if (arrangement.wrap === 'left-arm' || arrangement.wrap === 'right-arm') {
    const centerX = (bounds.minX + bounds.maxX) * 0.5
    const halfWidth = Math.max(1, (bounds.maxX - bounds.minX) * 0.5)
    const normalizedX = Math.max(-1, Math.min(1, ((point.x - centerX) / halfWidth) * flip))
    const angle = normalizedX * Math.PI
    const outerSign = arrangement.wrap === 'left-arm' ? -1 : 1
    const radius = Math.max(0.05, 0.066 + Number(arrangement.surfaceOffsetM || 0))
    const armCenterX = arrangement.x || 0
    const cylinderX = armCenterX + outerSign * Math.cos(angle) * radius
    const cylinderZ = (arrangement.z || 0) + Math.sin(angle) * radius
    const height = Math.max(1, bounds.maxY - bounds.minY)
    const normalizedY = Math.max(0, Math.min(1, (point.y - bounds.minY) / height))
    // The sleeve body wraps around the arm with its center grain on the outer
    // arm. Near the cap apex, however, that same grain must land on the
    // shoulder seam rather than remain on the outer cylinder. Fade only the
    // central cap region toward the shoulder so the front/back cap quadrants
    // keep their cylindrical placement and underarm topology.
    const capT = THREE.MathUtils.smoothstep(normalizedY, 0.78, 1)
    const centerWeight = 1 - Math.min(1, Math.abs(normalizedX))
    const shoulderInfluence = capT * centerWeight
    const shoulderX = outerSign * 0.205
    const base = new THREE.Vector3(
      THREE.MathUtils.lerp(cylinderX, shoulderX, shoulderInfluence),
      wrappedWorldY(arrangement.y || 0, point.y, bounds, avatar),
      THREE.MathUtils.lerp(cylinderZ, 0, shoulderInfluence),
    )
    const pose = getAvatarArmPose(avatar, arrangement.wrap === 'left-arm' ? -1 : 1)
    const dx = base.x - pose.center.x
    const dy = base.y - pose.center.y
    // The sleeve body should follow the posed arm, but the cap apex is sewn to
    // the shoulder and must remain at that shoulder location. Fade the pose
    // rotation out using the same cap/center influence that places the apex.
    const effectiveRotation = pose.rotationZ * (1 - shoulderInfluence)
    const cosine = Math.cos(effectiveRotation)
    const sine = Math.sin(effectiveRotation)
    base.x = pose.center.x + dx * cosine - dy * sine
    base.y = pose.center.y + dx * sine + dy * cosine
    return base
  }
  return new THREE.Vector3(
    (arrangement.x || 0) + point.x * CM_TO_WORLD * flip,
    (arrangement.y || 0) + point.y * CM_TO_WORLD,
    arrangement.z || 0,
  )
}

function structuralDirectionStiffness(pieceSim, left, right, baseStiffness, fabric) {
  const a = pieceSim.flatVertices[left]
  const b = pieceSim.flatVertices[right]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const angle = THREE.MathUtils.degToRad(pieceSim.piece.grainAngleDeg || 0)
  const warp = { x: Math.sin(angle), y: Math.cos(angle) }
  const weft = { x: Math.cos(angle), y: -Math.sin(angle) }
  const warpWeight = Math.abs(ux * warp.x + uy * warp.y)
  const weftWeight = Math.abs(ux * weft.x + uy * weft.y)
  const warpStretch = Math.max(0, Number(fabric.stretchWarp ?? 0.05))
  const weftStretch = Math.max(0, Number(fabric.stretchWeft ?? 0.05))
  const directionalStretch = warpWeight * warpWeight * warpStretch + weftWeight * weftWeight * weftStretch
  return {
    stiffness: Math.max(0.42, Math.min(0.997, baseStiffness * (1 - directionalStretch * 0.55))),
    warpWeight,
    weftWeight,
  }
}

function addStructuralConstraints(pieceSim, constraints, stiffness, bendStiffness, fabric) {
  const seen = new Set()
  const edgeOpposites = new Map()
  for (const [a, b, c] of pieceSim.faces) {
    const registrations = [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ]
    for (const [left, right, opposite] of registrations) {
      const key = edgeKey(left, right)
      if (!edgeOpposites.has(key)) edgeOpposites.set(key, [])
      edgeOpposites.get(key).push(opposite)
    }
    for (const [left, right] of [[a, b], [b, c], [c, a]]) {
      const key = edgeKey(left, right)
      if (seen.has(key)) continue
      seen.add(key)
      const pa = pieceSim.particles[left]
      const pb = pieceSim.particles[right]
      const directional = structuralDirectionStiffness(pieceSim, left, right, stiffness, fabric)
      const warpShrink = Number(fabric.shrinkWarp ?? 0)
      const weftShrink = Number(fabric.shrinkWeft ?? 0)
      const directionalShrink = (
        directional.warpWeight * directional.warpWeight * warpShrink +
        directional.weftWeight * directional.weftWeight * weftShrink
      )
      const shrinkFactor = Math.max(0.65, Math.min(1.35, 1 - directionalShrink))
      constraints.push({
        type: 'structural',
        a: pa,
        b: pb,
        rest: pieceSim.flatVertices[left].distanceTo(pieceSim.flatVertices[right]) * CM_TO_WORLD * shrinkFactor,
        stiffness: directional.stiffness,
        warpWeight: directional.warpWeight,
        weftWeight: directional.weftWeight,
      })
    }
  }

  for (const opposites of edgeOpposites.values()) {
    if (opposites.length !== 2 || opposites[0] === opposites[1]) continue
    const pa = pieceSim.particles[opposites[0]]
    const pb = pieceSim.particles[opposites[1]]
    constraints.push({
      type: 'bend',
      a: pa,
      b: pb,
      rest: pieceSim.flatVertices[opposites[0]].distanceTo(pieceSim.flatVertices[opposites[1]]) * CM_TO_WORLD,
      stiffness: bendStiffness,
    })
  }
}

function lineFrame(line) {
  const dx = line.b.x - line.a.x
  const dy = line.b.y - line.a.y
  const length = Math.hypot(dx, dy) || 1
  return {
    length,
    tx: dx / length,
    ty: dy / length,
    nx: -dy / length,
    ny: dx / length,
  }
}

function lineCoordinates(point, line, frame) {
  const px = point.x - line.a.x
  const py = point.y - line.a.y
  return {
    t: (px * frame.tx + py * frame.ty) / frame.length,
    signedDistance: px * frame.nx + py * frame.ny,
  }
}

function nearestFlatParticle(pieceSim, target, predicate = null) {
  let best = -1
  let bestDistance = Infinity
  pieceSim.flatVertices.forEach((point, index) => {
    if (predicate && !predicate(point, index)) return
    const distance = Math.hypot(point.x - target.x, point.y - target.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}

function barycentricWeights2d(point, a, b, c) {
  const v0x = b.x - a.x
  const v0y = b.y - a.y
  const v1x = c.x - a.x
  const v1y = c.y - a.y
  const v2x = point.x - a.x
  const v2y = point.y - a.y
  const denominator = v0x * v1y - v1x * v0y
  if (Math.abs(denominator) <= EPSILON) return null
  const wb = (v2x * v1y - v1x * v2y) / denominator
  const wc = (v0x * v2y - v2x * v0y) / denominator
  const wa = 1 - wb - wc
  return [wa, wb, wc]
}

function nearestSurfaceTarget(pieceSim, target) {
  const tolerance = 1e-5
  for (const face of pieceSim.faces || []) {
    const [ia, ib, ic] = face
    const weights = barycentricWeights2d(target, pieceSim.flatVertices[ia], pieceSim.flatVertices[ib], pieceSim.flatVertices[ic])
    if (!weights) continue
    if (weights.every((weight) => weight >= -tolerance && weight <= 1 + tolerance)) {
      const normalized = weights.map((weight) => Math.max(0, weight))
      const total = normalized.reduce((sum, weight) => sum + weight, 0) || 1
      return {
        indices: [ia, ib, ic],
        weights: normalized.map((weight) => weight / total),
      }
    }
  }

  let best = null
  const seenEdges = new Set()
  for (const face of pieceSim.faces || []) {
    for (const [left, right] of [[face[0], face[1]], [face[1], face[2]], [face[2], face[0]]]) {
      const key = left < right ? `${left}:${right}` : `${right}:${left}`
      if (seenEdges.has(key)) continue
      seenEdges.add(key)
      const a = pieceSim.flatVertices[left]
      const b = pieceSim.flatVertices[right]
      const abx = b.x - a.x
      const aby = b.y - a.y
      const lengthSq = abx * abx + aby * aby
      if (lengthSq <= EPSILON) continue
      const t = THREE.MathUtils.clamp(((target.x - a.x) * abx + (target.y - a.y) * aby) / lengthSq, 0, 1)
      const x = a.x + abx * t
      const y = a.y + aby * t
      const distanceSq = (target.x - x) ** 2 + (target.y - y) ** 2
      if (!best || distanceSq < best.distanceSq) best = { indices: [left, right], weights: [1 - t, t], distanceSq }
    }
  }
  return best || { indices: [nearestFlatParticle(pieceSim, target)], weights: [1] }
}

function surfaceTargetPosition(constraint, previous = false) {
  if (!constraint.targetParticles?.length) return previous ? constraint.b.previous.clone() : constraint.b.position.clone()
  const result = new THREE.Vector3()
  constraint.targetParticles.forEach((particle, index) => {
    result.addScaledVector(previous ? particle.previous : particle.position, constraint.targetWeights[index] ?? 0)
  })
  return result
}

function satisfySurfaceAttachment(constraint) {
  const source = constraint.a
  const targets = constraint.targetParticles
  if (!source || !targets?.length) return
  const targetPosition = surfaceTargetPosition(constraint)
  const delta = targetPosition.sub(source.position)
  const length = delta.length()
  if (length <= EPSILON) return
  const sourceMass = source.invMass || 0
  let targetMass = 0
  targets.forEach((particle, index) => {
    const weight = constraint.targetWeights[index] ?? 0
    targetMass += weight * weight * (particle.invMass || 0)
  })
  const total = sourceMass + targetMass
  if (total <= EPSILON) return
  const error = (length - constraint.rest) / length
  const correction = delta.multiplyScalar(error * constraint.stiffness)
  if (sourceMass > 0) source.position.addScaledVector(correction, sourceMass / total)
  targets.forEach((particle, index) => {
    const invMass = particle.invMass || 0
    const weight = constraint.targetWeights[index] ?? 0
    if (invMass > 0 && weight > 0) particle.position.addScaledVector(correction, -(weight * invMass) / total)
  })
}

function addInternalGeometryConstraints(pieceSim, constraints) {
  const internalConstraints = []
  const addFoldCrease = (foldLine, constraintType, restFactor, stiffness, internalLineId, bandCm = 14) => {
    const foldFrame = lineFrame(foldLine)
    if (foldFrame.length < 0.5) return
    const positive = []
    const negative = []
    pieceSim.flatVertices.forEach((point, index) => {
      const coords = lineCoordinates(point, foldLine, foldFrame)
      if (coords.t < 0.03 || coords.t > 0.97) return
      const distance = Math.abs(coords.signedDistance)
      if (distance < 0.35 || distance > bandCm) return
      const entry = { index, t: coords.t, distance }
      if (coords.signedDistance > 0) positive.push(entry)
      else negative.push(entry)
    })

    const usedPairs = new Set()
    for (const left of positive) {
      let winner = null
      let winnerScore = Infinity
      for (const right of negative) {
        const score = Math.abs(left.t - right.t) * 8 + Math.abs(left.distance - right.distance)
        if (score < winnerScore) {
          winner = right
          winnerScore = score
        }
      }
      if (!winner || winnerScore > bandCm * 0.9) continue
      const key = edgeKey(left.index, winner.index)
      if (usedPairs.has(key)) continue
      usedPairs.add(key)
      const a = pieceSim.particles[left.index]
      const b = pieceSim.particles[winner.index]
      const flatRest = pieceSim.flatVertices[left.index].distanceTo(pieceSim.flatVertices[winner.index]) * CM_TO_WORLD
      const constraint = {
        type: constraintType,
        a,
        b,
        rest: Math.max(0.002, flatRest * restFactor),
        stiffness,
        internalLineId,
      }
      constraints.push(constraint)
      internalConstraints.push(constraint)
    }
  }

  for (const line of pieceSim.piece.internalLines || []) {
    if (!line?.a || !line?.b || !['fold', 'dart', 'pleat'].includes(line.type)) continue
    const frame = lineFrame(line)
    if (frame.length < 0.5) continue

    if (line.type === 'fold') {
      const bandCm = Math.max(4, Math.min(24, line.bandCm ?? 14))
      const foldAngle = Math.max(0, Math.min(180, Number(line.foldAngleDeg ?? 135)))
      const restFactor = Math.max(0.08, Math.sin(THREE.MathUtils.degToRad(foldAngle * 0.5)))
      addFoldCrease(
        line,
        'fold',
        restFactor,
        Math.max(0.08, Math.min(0.9, Number(line.stiffness ?? 0.36))),
        line.id,
        bandCm,
      )
    }

    if (line.type === 'pleat') {
      const count = Math.max(1, Math.min(16, Math.round(Number(line.count ?? 5))))
      const spacingCm = Math.max(1, Math.min(20, Number(line.spacingCm ?? 4)))
      const depthCm = Math.max(0.5, Math.min(12, Number(line.depthCm ?? 3)))
      const stiffness = Math.max(0.12, Math.min(0.92, Number(line.stiffness ?? 0.48)))
      const restFactor = Math.max(0.12, Math.min(0.92, 1 - depthCm / Math.max(2, spacingCm * 2)))
      const bandCm = Math.max(2.5, Math.min(12, spacingCm * 0.9 + depthCm))
      for (let foldIndex = 0; foldIndex < count; foldIndex += 1) {
        const offset = (foldIndex - (count - 1) * 0.5) * spacingCm
        const foldLine = {
          a: { x: line.a.x + frame.nx * offset, y: line.a.y + frame.ny * offset },
          b: { x: line.b.x + frame.nx * offset, y: line.b.y + frame.ny * offset },
        }
        addFoldCrease(
          foldLine,
          'pleat',
          restFactor,
          stiffness,
          `${line.id}:${foldIndex}`,
          bandCm,
        )
      }
    }

    if (line.type === 'dart') {
      const widthCm = Math.max(0.5, Math.min(12, Number(line.widthCm ?? 2.5)))
      const usedPairs = new Set()
      for (const t of [0.08, 0.26, 0.44, 0.62, 0.80]) {
        const center = {
          x: line.a.x + (line.b.x - line.a.x) * t,
          y: line.a.y + (line.b.y - line.a.y) * t,
        }
        const halfWidth = widthCm * 0.5 * (1 - t)
        const leftTarget = { x: center.x + frame.nx * halfWidth, y: center.y + frame.ny * halfWidth }
        const rightTarget = { x: center.x - frame.nx * halfWidth, y: center.y - frame.ny * halfWidth }
        const leftIndex = nearestFlatParticle(pieceSim, leftTarget, (point) => {
          const coords = lineCoordinates(point, line, frame)
          return coords.signedDistance > 0.15 && Math.abs(coords.t - t) < 0.32
        })
        const rightIndex = nearestFlatParticle(pieceSim, rightTarget, (point) => {
          const coords = lineCoordinates(point, line, frame)
          return coords.signedDistance < -0.15 && Math.abs(coords.t - t) < 0.32
        })
        if (leftIndex < 0 || rightIndex < 0 || leftIndex === rightIndex) continue
        const key = edgeKey(leftIndex, rightIndex)
        if (usedPairs.has(key)) continue
        usedPairs.add(key)
        const flatRest = pieceSim.flatVertices[leftIndex].distanceTo(pieceSim.flatVertices[rightIndex]) * CM_TO_WORLD
        const closeFactor = Math.max(0.08, Math.min(0.65, t * 0.55 + 0.08))
        const constraint = {
          type: 'dart',
          a: pieceSim.particles[leftIndex],
          b: pieceSim.particles[rightIndex],
          rest: Math.max(0.002, flatRest * closeFactor),
          stiffness: Math.max(0.2, Math.min(0.95, Number(line.stiffness ?? 0.68))),
          internalLineId: line.id,
        }
        constraints.push(constraint)
        internalConstraints.push(constraint)
      }
    }
  }
  return internalConstraints
}

function pairEdgeParticles(aIndices, bIndices, pieceA, pieceB, reverseOverride = undefined) {
  if (!aIndices.length || !bIndices.length) return []
  const aStart = pieceA.particles[aIndices[0]].position
  const aEnd = pieceA.particles[aIndices[aIndices.length - 1]].position
  const bStart = pieceB.particles[bIndices[0]].position
  const bEnd = pieceB.particles[bIndices[bIndices.length - 1]].position
  const straightCost = aStart.distanceTo(bStart) + aEnd.distanceTo(bEnd)
  const reversedCost = aStart.distanceTo(bEnd) + aEnd.distanceTo(bStart)
  const reverseB = typeof reverseOverride === 'boolean' ? reverseOverride : reversedCost < straightCost
  // Pair at the lower boundary resolution. Using the larger count duplicates
  // particles on the coarser edge (for example 5 hood particles against 9
  // neckline particles), creating a fan of seam constraints that can pull
  // neighboring structural vertices apart. Evenly sample both edges with a
  // unique correspondence and let each edge's structural network interpolate
  // the unsampled boundary vertices.
  const count = Math.min(aIndices.length, bIndices.length)
  const pairs = []
  for (let i = 0; i < count; i += 1) {
    const ta = count === 1 ? 0 : i / (count - 1)
    const ai = aIndices[Math.round(ta * (aIndices.length - 1))]
    const tb = reverseB ? 1 - ta : ta
    const bi = bIndices[Math.round(tb * (bIndices.length - 1))]
    pairs.push([ai, bi])
  }
  return pairs
}

// Microscopic/partial CLO-style stitching must be attached to the original
// cutline position, not snapped to the nearest simulation vertex. Snapping a
// 0.2 mm segment onto a 10 mm mesh can miss the seam entirely or attach it
// outside its authored interval. Barycentric samples make the relationship
// independent of simulation tessellation while preserving exact 2D topology.
function buildVirtualSeamSamples(seam, pieceA, pieceB) {
  const sourceA = pieceA.piece
  const sourceB = pieceB.piece
  const lengthA = edgeRangeLength(sourceA, seam.a.edgeIndex, seam.a.startT, seam.a.endT)
  const lengthB = edgeRangeLength(sourceB, seam.b.edgeIndex, seam.b.startT, seam.b.endT)
  if (!Number.isFinite(lengthA) || !Number.isFinite(lengthB) || lengthA <= 1e-8 || lengthB <= 1e-8) return []
  const startA = THREE.MathUtils.clamp(Number(seam.a.startT ?? 0), 0, 1)
  const endA = THREE.MathUtils.clamp(Number(seam.a.endT ?? 1), 0, 1)
  const startB = THREE.MathUtils.clamp(Number(seam.b.startT ?? 0), 0, 1)
  const endB = THREE.MathUtils.clamp(Number(seam.b.endT ?? 1), 0, 1)
  const samples = Math.max(1, Math.min(25, Math.ceil(Math.max(lengthA, lengthB) / 1.0)))
  // Physical sewing strength must not grow 20x just because a CLO/DXF source
  // curve was split into 20 micro-segments. Each stitch station represents
  // only its share of approximately 1cm of sewn cutline arclength.
  const arclengthWeight = Math.max(0.001, Math.min(1, Math.max(lengthA, lengthB) / samples))
  const result = []
  for (let index = 0; index < samples; index++) {
    // Centers avoid double-weighting endpoints shared by adjacent authored
    // partial segments. Longer cutline intervals are sampled every ~1 cm.
    const progress = (index + 0.5) / samples
    const tA = THREE.MathUtils.lerp(startA, endA, progress)
    const tB = THREE.MathUtils.lerp(startB, endB, seam.reverseB ? 1 - progress : progress)
    const pointA = edgePointAt(sourceA, seam.a.edgeIndex, tA)?.point
    const pointB = edgePointAt(sourceB, seam.b.edgeIndex, tB)?.point
    if (!pointA || !pointB) continue
    const anchorA = nearestSurfaceTarget(pieceA, pointA)
    const anchorB = nearestSurfaceTarget(pieceB, pointB)
    if (!anchorA?.indices.length || !anchorB?.indices.length) continue
    result.push({
      sourceParticles: anchorA.indices.map((particleIndex) => pieceA.particles[particleIndex]),
      sourceWeights: anchorA.weights,
      targetParticles: anchorB.indices.map((particleIndex) => pieceB.particles[particleIndex]),
      targetWeights: anchorB.weights,
      progress,
      arclengthWeight,
    })
  }
  return result
}

function virtualSeamPosition(particles, weights, previous = false) {
  const position = new THREE.Vector3()
  for (let index = 0; index < particles.length; index++) {
    position.addScaledVector(previous ? particles[index].previous : particles[index].position, weights[index] ?? 0)
  }
  return position
}

function seamGap(constraint) {
  if (constraint.type === 'seam-virtual' && constraint.sourceParticles?.length && constraint.targetParticles?.length) {
    return virtualSeamPosition(constraint.sourceParticles, constraint.sourceWeights)
      .distanceTo(virtualSeamPosition(constraint.targetParticles, constraint.targetWeights))
  }
  return constraint.a.position.distanceTo(constraint.b.position)
}

function satisfyVirtualSeam(constraint) {
  const source = virtualSeamPosition(constraint.sourceParticles, constraint.sourceWeights)
  const target = virtualSeamPosition(constraint.targetParticles, constraint.targetWeights)
  const delta = target.sub(source)
  const length = delta.length()
  if (length <= EPSILON) return
  const gradients = new Map()
  for (const [particles, weights, sign] of [
    [constraint.sourceParticles, constraint.sourceWeights, 1],
    [constraint.targetParticles, constraint.targetWeights, -1],
  ]) {
    for (let index = 0; index < particles.length; index++) {
      const particle = particles[index]
      gradients.set(particle, (gradients.get(particle) || 0) + sign * (weights[index] ?? 0))
    }
  }
  let denominator = 0
  for (const [particle, gradient] of gradients) denominator += particle.invMass * gradient * gradient
  if (denominator <= EPSILON) return
  const correction = ((length - constraint.rest) / length) * constraint.stiffness / denominator
  for (const [particle, gradient] of gradients) {
    if (particle.invMass > 0) particle.position.addScaledVector(delta, correction * gradient * particle.invMass)
  }
}

function addEdgeTreatmentConstraints(pieceSim, indices, ratio, stiffness, seamId, constraints, treatmentConstraints) {
  if (!pieceSim || indices.length < 2) return
  const safeRatio = Math.max(0.3, Math.min(1.2, Number(ratio ?? 1)))
  for (let index = 0; index < indices.length - 1; index += 1) {
    const leftIndex = indices[index]
    const rightIndex = indices[index + 1]
    if (leftIndex === rightIndex) continue
    const flatRest = pieceSim.flatVertices[leftIndex].distanceTo(pieceSim.flatVertices[rightIndex]) * CM_TO_WORLD
    if (flatRest <= EPSILON) continue
    const constraint = {
      type: 'edge-treatment',
      a: pieceSim.particles[leftIndex],
      b: pieceSim.particles[rightIndex],
      rest: flatRest * safeRatio,
      stiffness: Math.max(0.1, Math.min(0.98, stiffness)),
      seamId,
      ratio: safeRatio,
    }
    constraints.push(constraint)
    treatmentConstraints.push(constraint)
  }
}

function addPieceTrimConstraints(pieceSim, constraints) {
  const trimConstraints = []
  const addReinforcement = (edgeIndex, stiffness, type, trimId) => {
    const indices = boundaryIndicesForEdge(pieceSim, edgeIndex)
    if (indices.length < 2) return
    for (let index = 0; index < indices.length - 1; index += 1) {
      const leftIndex = indices[index]
      const rightIndex = indices[index + 1]
      if (leftIndex === rightIndex) continue
      const rest = pieceSim.flatVertices[leftIndex].distanceTo(pieceSim.flatVertices[rightIndex]) * CM_TO_WORLD
      if (rest <= EPSILON) continue
      const constraint = {
        type,
        a: pieceSim.particles[leftIndex],
        b: pieceSim.particles[rightIndex],
        rest,
        stiffness: Math.max(0.1, Math.min(0.995, stiffness)),
        trimId,
      }
      constraints.push(constraint)
      trimConstraints.push(constraint)
    }
  }

  for (const stitch of pieceSim.piece.topstitches || []) {
    const rows = Math.max(1, Math.min(3, Number(stitch.rows || 1)))
    const base = 0.48 + rows * 0.08
    addReinforcement(stitch.edgeIndex, base, 'topstitch', stitch.id)
  }

  for (const zipper of pieceSim.piece.zippers || []) {
    addReinforcement(zipper.edgeIndex, 0.91, 'zipper-tape', zipper.id)
  }

  for (const binding of pieceSim.piece.bindings || []) {
    const ratio = Math.max(0.6, Math.min(1.1, Number(binding.ratio ?? 0.96)))
    const indices = boundaryIndicesForEdge(pieceSim, binding.edgeIndex)
    addEdgeTreatmentConstraints(
      pieceSim,
      indices,
      ratio,
      Math.max(0.4, Math.min(0.96, Number(binding.stiffness ?? 0.72))),
      binding.id,
      constraints,
      trimConstraints,
    )
  }
  return trimConstraints
}

export function buildSimulation(project, { optimizeMesh = false } = {}) {
  const pieces = new Map()
  const constraints = []
  const anchorConstraints = []
  const manualPinConstraints = []
  const internalConstraints = []
  const trimConstraints = []
  const defaultFabric = project.fabrics?.main || {}
  const maxThickness = Math.max(
    0.001,
    ...Object.values(project.fabrics || {}).map((item) => Number(item?.thickness ?? 0.002)),
  )
  const structuralStiffness = Math.min(0.995, Math.max(0.55, project.simulation?.stiffness || 0.9))
  const avatarHeightScale = getAvatarHeightScale(project.avatar)
  const avatarUpper = getAvatarUpperBodyDimensions(project.avatar)
  const fusedReinforcement = new Map()
  for (const follower of project.pieces || []) {
    if (follower.active3d === false) continue
    if (!follower.fusedToPieceId) continue
    const fabric = project.fabrics?.[follower.fabricId] || {}
    const averageStretch = (Number(fabric.stretchWarp ?? 0.04) + Number(fabric.stretchWeft ?? 0.04)) * 0.5
    const bend = Number(fabric.bend ?? 0.7)
    const structuralBoost = 1 + THREE.MathUtils.clamp((0.08 - averageStretch) * 0.6 + (bend - 0.5) * 0.05, 0.025, 0.10)
    const bendBoost = 1 + THREE.MathUtils.clamp((bend - 0.5) * 0.35 + Number(fabric.gsm ?? 50) / 1000 * 0.2, 0.08, 0.28)
    const current = fusedReinforcement.get(follower.fusedToPieceId) || { structural: 1, bend: 1 }
    fusedReinforcement.set(follower.fusedToPieceId, {
      structural: Math.min(1.15, current.structural * structuralBoost),
      bend: Math.min(1.4, current.bend * bendBoost),
    })
  }
  let particleIndex = 0

  for (const piece of project.pieces) {
    if (piece.active3d === false) continue
    const pieceFabric = project.fabrics?.[piece.fabricId] || defaultFabric
    const strengthened = piece.strengthened === true
    const laminate = fusedReinforcement.get(piece.id) || { structural: 1, bend: 1 }
    const pieceStructuralStiffness = Math.min(0.997, structuralStiffness * (strengthened ? 1.06 : 1) * laminate.structural)
    // Bending remains fabric-dependent: silk stays fluid while fleece/denim
    // resist the needle-like folds that appear around armholes and hems.
    const bendStiffness = Math.max(0.08, Math.min(0.92, (0.10 + (pieceFabric.bend ?? 0.65) * 0.65) * (strengthened ? 1.22 : 1) * laminate.bend))
    // CAD display curves can be sampled densely, but feeding those same tiny
    // boundary segments into PBD creates sliver triangles and unstable local
    // strain. Keep the simulation boundary deliberately coarser and let the
    // render layer carry the higher visual fidelity.
    const simulationCurveSegments = Math.max(2, Math.min(4, project.simulation?.curveSegments ?? 2))
    const originalSampled = samplePieceBoundary(piece, simulationCurveSegments)
    const adaptedCutline = project.simulation?.adaptiveCutlineMeshing === true &&
      originalSampled.points.length > 48
    const sampled = adaptedCutline
      ? { ...originalSampled, points: simplifiedClothBoundary(originalSampled.points,
          Math.max(0.02, Math.min(0.18, Number(project.simulation?.cutlineToleranceCm ?? 0.08)))) }
      : originalSampled
    const sourcePoints = sampled.points.map((point) => new THREE.Vector2(point.x, point.y))
    const edgePaths = sampled.edgePaths.map((path) => path.map((point) => new THREE.Vector2(point.x, point.y)))
    const hasPhysicalInternalGeometry = (piece.internalLines || []).some((line) => ['fold', 'dart', 'pleat'].includes(line.type))
    const requestedResolution = piece.simulationResolution ?? project.simulation?.resolution ?? 1
    const effectiveResolution = hasPhysicalInternalGeometry ? Math.max(2, requestedResolution) : requestedResolution
    const baseMesh = triangulate(sampled.points, effectiveResolution)
    // Quality-level native strain models require well-shaped rest triangles.
    // The interactive PBD path intentionally preserves legacy topology and
    // its saved drape. Optimizing interior edges does not alter cut boundaries
    // or user patterns; the remaining slivers are filtered by the native
    // strain safety gate while keeping their distance-edge constraints.
    const mesh = optimizeMesh ? optimizeTriangleQuality(baseMesh) : baseMesh
    const meshQuality = inspectClothMesh(mesh.vertices, mesh.faces)
    const bounds = patternBounds(sampled.points)
    const centerX = (bounds.minX + bounds.maxX) * 0.5
    const halfWidth = Math.max(1, (bounds.maxX - bounds.minX) * 0.5)
    const patternHeight = Math.max(1, bounds.maxY - bounds.minY)
    const particles = mesh.vertices.map((point, index) => {
      const position = initialPosition(piece, point, bounds, project.avatar)
      const wrapMode = piece.arrangement3d?.wrap || null
      const localPatternU = Math.max(-1, Math.min(1, (point.x - centerX) / halfWidth))
      const localPatternV = Math.max(0, Math.min(1, (point.y - bounds.minY) / patternHeight))
      const splitTorsoPanel = ['front', 'back'].includes(wrapMode) && (
        (Array.isArray(piece.fitShoulderSides) && piece.fitShoulderSides.length === 1) ||
        String(piece.generatedRole || '').startsWith('zip-front')
      )
      const torsoPatternU = splitTorsoPanel
        ? Math.max(-1, Math.min(1, position.x / Math.max(0.12, getAvatarTorsoRadii(project.avatar, Math.max(0.60, Math.min(1.58, position.y))).x)))
        : localPatternU
      return {
        id: `${piece.id}:${index}`,
        pieceId: piece.id,
        position,
        previous: position.clone(),
        collisionSideZ: Math.sign(piece.arrangement3d?.z || 0) || 1,
        patternU: torsoPatternU,
        patternV: localPatternV,
        patternOffsetX: (point.x - centerX) * CM_TO_WORLD,
        patternOffsetY: (point.y - bounds.minY) * CM_TO_WORLD,
        wrapMode,
        avatarHeightScale,
        fabricId: piece.fabricId || 'main',
        layerIndex: Math.max(0, Math.min(8, Math.round(piece.layerIndex || 0))),
        thickness: Number(pieceFabric.thickness ?? 0.002),
        friction: Number(pieceFabric.friction ?? 0.3),
        damping: Number(pieceFabric.damping ?? 0.985),
        simIndex: particleIndex++,
        invMass: piece.frozen3d ? 0 : 1,
      }
    })
    const simPiece = {
      id: piece.id,
      piece,
      meshQuality,
      sourcePoints,
      edgePaths,
      flatVertices: mesh.vertices,
      faces: mesh.faces,
      particles,
      fabric: pieceFabric,
      layerIndex: Math.max(0, Math.min(8, Math.round(piece.layerIndex || 0))),
    }
    const sewnEdges = new Set()
    const seamIdsByEdge = new Map()
    for (const seam of project.seams || []) {
      if (seam.a?.pieceId === piece.id) {
        sewnEdges.add(seam.a.edgeIndex)
        if (!seamIdsByEdge.has(seam.a.edgeIndex)) seamIdsByEdge.set(seam.a.edgeIndex, new Set())
        seamIdsByEdge.get(seam.a.edgeIndex).add(seam.id)
      }
      if (seam.b?.pieceId === piece.id) {
        sewnEdges.add(seam.b.edgeIndex)
        if (!seamIdsByEdge.has(seam.b.edgeIndex)) seamIdsByEdge.set(seam.b.edgeIndex, new Set())
        seamIdsByEdge.get(seam.b.edgeIndex).add(seam.id)
      }
    }
    for (const edgeIndex of sewnEdges) {
      for (const particleIndex of boundaryIndicesForEdge(simPiece, edgeIndex)) {
        const particle = particles[particleIndex]
        if (!particle) continue
        particle.seamBoundary = true
        particle.seamIds = particle.seamIds || new Set()
        for (const seamId of seamIdsByEdge.get(edgeIndex) || []) particle.seamIds.add(seamId)
        if ([...(particle.seamIds || [])].some((seamId) => /sleeve-[lr]-back-lower/i.test(seamId))) {
          particle.constructionSideZ = -1
        }
      }
    }
    if (['left-arm', 'right-arm'].includes(piece.arrangement3d?.wrap)) {
      for (const particle of particles) {
        const seamIds = [...(particle.seamIds || [])]
        const hasFrontArmhole = seamIds.some((seamId) => /sleeve-[lr]-front/i.test(seamId))
        const hasBackArmhole = seamIds.some((seamId) => /sleeve-[lr]-back/i.test(seamId))
        if (hasFrontArmhole === hasBackArmhole) continue
        // Keep the wrapped position intact. Earlier versions flipped particles
        // across Z=0 here, which could turn an ~11 mm local mesh edge into a
        // ~28 mm edge before frame one. The seam side is only a collision hint;
        // sewing constraints are responsible for bringing the cap together.
        if (Math.abs(particle.position.z) > 0.014) continue
        const sideZ = hasFrontArmhole ? 1 : -1
        particle.collisionSideZ = sideZ
      }
    }
    addStructuralConstraints(simPiece, constraints, pieceStructuralStiffness, bendStiffness, pieceFabric)
    internalConstraints.push(...addInternalGeometryConstraints(simPiece, constraints))
    trimConstraints.push(...addPieceTrimConstraints(simPiece, constraints))

    for (const pin of piece.pins || []) {
      const pinIndex = nearestFlatParticle(simPiece, pin)
      if (pinIndex < 0) continue
      const particle = particles[pinIndex]
      const constraint = {
        type: 'manual-pin',
        particle,
        target: particle.position.clone(),
        stiffness: Math.max(0.1, Math.min(1, Number(pin.stiffness ?? 1))),
        pieceId: piece.id,
        pinId: pin.id,
      }
      anchorConstraints.push(constraint)
      manualPinConstraints.push(constraint)
    }

    const isFusedFollower = Boolean(piece.fusedToPieceId)
    const isBodyPanel = ['front', 'back'].includes(piece.arrangement3d?.wrap)
    if (project.simulation?.autoFitTacks !== false && isBodyPanel && !isFusedFollower && !piece.frozen3d && mesh.vertices.length) {
      const maxY = Math.max(...mesh.vertices.map((point) => point.y))
      const topWorldY = Math.max(...particles.map((particle) => particle.position.y))
      if (topWorldY < 1.42 * avatarHeightScale) {
        const upperIndices = mesh.vertices
          .map((point, index) => ({ point, index }))
          .filter(({ point }) => point.y >= maxY - 3)
          .sort((a, b) => a.point.x - b.point.x)
        for (const candidate of [upperIndices[0], upperIndices[upperIndices.length - 1]]) {
          if (!candidate) continue
          const particle = particles[candidate.index]
          anchorConstraints.push({
            type: 'fit-anchor',
            particle,
            target: particle.position.clone(),
            stiffness: 0.24,
            pieceId: piece.id,
          })
        }
      } else {
      if (piece.fitShoulderTacks !== false) {
        const fitShoulderSides = Array.isArray(piece.fitShoulderSides) && piece.fitShoulderSides.length
          ? piece.fitShoulderSides.filter((side) => side === -1 || side === 1)
          : [-1, 1]
        for (const side of fitShoulderSides) {
          let bestIndex = -1
          let bestScore = Infinity
          mesh.vertices.forEach((point, index) => {
            const centerX = piece.arrangement3d?.x || 0
            const worldSide = Math.sign(particles[index].position.x - centerX) || side
            if (worldSide !== side) return
            const score = Math.abs(point.y - (maxY - 1.5)) + Math.abs(Math.abs(point.x) - 15) * 0.45
            if (score < bestScore) {
              bestScore = score
              bestIndex = index
            }
          })
          if (bestIndex >= 0) {
            const particle = particles[bestIndex]
            anchorConstraints.push({
              type: 'fit-anchor',
              particle,
              target: new THREE.Vector3(side * Math.max(0.16, avatarUpper.shoulderHalfWidth - 0.005), 1.66 * avatarHeightScale, 0),
              stiffness: 0.34,
              pieceId: piece.id,
            })
          }
        }
      }

      // A light center-neck placement tack prevents the neckline from falling
      // diagonally across the chest before the shoulders settle. Choose the
      // most central boundary vertex in the upper pattern region so this works
      // for both the deeper front neck and the shallower back neck.
      let neckIndex = -1
      let neckScore = Infinity
      mesh.vertices.forEach((point, index) => {
        if (point.y < maxY - 15) return
        const neckLocalX = Number.isFinite(piece.fitNeckLocalX) ? piece.fitNeckLocalX : centerX
        const score = Math.abs(point.x - neckLocalX) + Math.abs(point.y - (maxY - 8)) * 0.03
        if (score < neckScore) {
          neckScore = score
          neckIndex = index
        }
      })
      if (neckIndex >= 0) {
        const neckParticle = particles[neckIndex]
        const targetY = neckParticle.position.y
        const normalizedY = Math.max(-0.999, Math.min(0.999, (targetY - avatarUpper.shoulderCenterY) / avatarUpper.shoulderCapRadiusY))
        const surfaceZ = avatarUpper.shoulderCapRadiusZ * Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY))
        const sideZ = piece.arrangement3d.wrap === 'front' ? 1 : -1
        const splitFrontPanel = piece.arrangement3d.wrap === 'front' && (
          String(piece.generatedRole || '').startsWith('zip-front') ||
          (Array.isArray(piece.fitShoulderSides) && piece.fitShoulderSides.length === 1)
        )
        if (!splitFrontPanel) {
          anchorConstraints.push({
            type: 'fit-anchor',
            particle: neckParticle,
            target: new THREE.Vector3(0, targetY, sideZ * (surfaceZ + 0.01)),
            // The neck tack is an elevation guide, not a rigid XYZ pin.
            // Pulling it toward a guessed clavicle depth made nearby 1 cm
            // armhole edges jump to opposite sides of the avatar collider
            // (up to 1300% stretch on 160 cm body). Let the sewn cloth solve
            // its own lateral position while supporting neckline height.
            axes: 'y',
            // A gentle altitude guide is enough to discourage the collar from
            // dropping, without competing against sewn-edge strain and body
            // contact. The previous 0.18 was responsible for severe local
            // spikes on 160 cm / 200 cm avatar regression fixtures.
            stiffness: 0.01,
            pieceId: piece.id,
          })
        }
      }
      }
    }

    const isLowerBodyPanel = [
      'lower-front', 'lower-back',
      'left-leg-front', 'left-leg-back', 'right-leg-front', 'right-leg-back',
    ].includes(piece.arrangement3d?.wrap)
    if (project.simulation?.autoFitTacks !== false && isLowerBodyPanel && !isFusedFollower && !piece.frozen3d && mesh.vertices.length) {
      const maxY = Math.max(...mesh.vertices.map((point) => point.y))
      const upper = mesh.vertices
        .map((point, index) => ({ point, index }))
        .filter(({ point }) => point.y >= maxY - 3)
        .sort((a, b) => a.point.x - b.point.x)
      for (const candidate of [upper[0], upper[upper.length - 1]]) {
        if (!candidate) continue
        const particle = particles[candidate.index]
        anchorConstraints.push({
          type: 'fit-anchor',
          particle,
          target: particle.position.clone(),
          stiffness: 0.28,
          pieceId: piece.id,
        })
      }

      if (['left-leg-front', 'left-leg-back', 'right-leg-front', 'right-leg-back'].includes(piece.arrangement3d?.wrap)) {
        // Keep the sewn side boundaries on their intended lateral side of the
        // leg while leaving Z free for front/back seam closure and Y free for
        // gravity. This prevents a closed trouser tube from satisfying its
        // seams by translating completely off the avatar.
        const boundaryParticleIndices = new Set()
        for (const edgeIndex of [0, 1, 3, 4]) {
          for (const particleIndex of boundaryIndicesForEdge(simPiece, edgeIndex)) boundaryParticleIndices.add(particleIndex)
        }
        for (const particleIndex of boundaryParticleIndices) {
          const particle = particles[particleIndex]
          if (!particle || particle.position.y > 0.68 * avatarHeightScale) continue
          anchorConstraints.push({
            type: 'arrangement-guide',
            axes: 'x',
            particle,
            target: particle.position.clone(),
            stiffness: 0.035,
            pieceId: piece.id,
          })
        }
      }

    }

    const isSleeve = ['left-arm', 'right-arm'].includes(piece.arrangement3d?.wrap)
    if (project.simulation?.autoFitTacks !== false && piece.fitSleeveApexTack !== false && isSleeve && !isFusedFollower && !piece.frozen3d && mesh.vertices.length) {
      const maxY = Math.max(...mesh.vertices.map((point) => point.y))
      const centerX = (bounds.minX + bounds.maxX) * 0.5
      let apexIndex = -1
      let apexScore = Infinity
      mesh.vertices.forEach((point, index) => {
        const score = Math.abs(point.y - maxY) * 3 + Math.abs(point.x - centerX)
        if (score < apexScore) {
          apexScore = score
          apexIndex = index
        }
      })
      if (apexIndex >= 0) {
        const side = piece.arrangement3d.wrap === 'left-arm' ? -1 : 1
        anchorConstraints.push({
          type: 'fit-anchor',
          particle: particles[apexIndex],
          target: new THREE.Vector3(side * Math.max(0.16, avatarUpper.shoulderHalfWidth - 0.005), 1.655 * avatarHeightScale, 0),
          stiffness: 0.42,
          pieceId: piece.id,
        })
      }
    }

    const isHood = ['hood-left', 'hood-right'].includes(piece.arrangement3d?.wrap)
    if (project.simulation?.autoFitTacks !== false && isHood && !isFusedFollower && !piece.frozen3d && mesh.vertices.length) {
      const maxY = Math.max(...mesh.vertices.map((point) => point.y))
      const minX = Math.min(...mesh.vertices.map((point) => point.x))
      const maxX = Math.max(...mesh.vertices.map((point) => point.x))
      const targets = piece.hoodState === 'down'
        ? [
          { targetX: minX + (maxX - minX) * 0.60, targetY: maxY, stiffness: 0.11 },
          { targetX: minX + (maxX - minX) * 0.15, targetY: maxY - 8, stiffness: 0.07 },
        ]
        : [
          { targetX: minX + (maxX - minX) * 0.60, targetY: maxY, stiffness: 0.22 },
          { targetX: minX + (maxX - minX) * 0.10, targetY: maxY - 8, stiffness: 0.10 },
        ]
      for (const guide of targets) {
        let bestIndex = -1
        let bestScore = Infinity
        mesh.vertices.forEach((point, index) => {
          const score = Math.abs(point.x - guide.targetX) + Math.abs(point.y - guide.targetY) * 1.4
          if (score < bestScore) {
            bestScore = score
            bestIndex = index
          }
        })
        if (bestIndex >= 0) {
          const particle = particles[bestIndex]
          anchorConstraints.push({
            type: piece.hoodState === 'down' ? 'hood-down-anchor' : 'hood-up-anchor',
            particle,
            target: particle.position.clone(),
            stiffness: guide.stiffness,
            pieceId: piece.id,
          })
        }
      }
    }
    pieces.set(piece.id, simPiece)
  }

  const seamConstraints = []
  const treatmentConstraints = []
  const surfaceAttachmentConstraints = []
  const fastenerConstraints = []
  const fuseConstraints = []
  const fusedPiecePairs = new Set()

  for (const sourcePiece of pieces.values()) {
    for (const attachment of sourcePiece.piece.surfaceAttachments || []) {
      const targetPiece = pieces.get(attachment.targetPieceId)
      if (!targetPiece) continue
      const sourceIndices = boundaryIndicesForEdge(sourcePiece, attachment.sourceEdgeIndex)
      if (sourceIndices.length < 2) continue
      const ordered = attachment.reverseSource ? [...sourceIndices].reverse() : sourceIndices
      const targetEdgeIndices = Number.isInteger(attachment.targetEdgeIndex)
        ? boundaryIndicesForEdge(targetPiece, attachment.targetEdgeIndex)
        : null
      for (let index = 0; index < ordered.length; index += 1) {
        const t = ordered.length === 1 ? 0.5 : index / (ordered.length - 1)
        const targetT = attachment.reverseTarget ? 1 - t : t
        let targetIndex = -1
        let targetSurface = null
        if (targetEdgeIndices?.length) {
          targetIndex = targetEdgeIndices[Math.max(0, Math.min(targetEdgeIndices.length - 1, Math.round(targetT * (targetEdgeIndices.length - 1))))]
        } else if (attachment.targetA && attachment.targetB) {
          const targetPoint = {
            x: THREE.MathUtils.lerp(attachment.targetA.x, attachment.targetB.x, targetT),
            y: THREE.MathUtils.lerp(attachment.targetA.y, attachment.targetB.y, targetT),
          }
          targetSurface = nearestSurfaceTarget(targetPiece, targetPoint)
          targetIndex = targetSurface.indices.reduce((best, candidate, candidateIndex) => (
            (targetSurface.weights[candidateIndex] ?? 0) > (targetSurface.weights[best.weightIndex] ?? -1)
              ? { index: candidate, weightIndex: candidateIndex }
              : best
          ), { index: targetSurface.indices[0], weightIndex: 0 }).index
        }
        if (targetIndex < 0) continue
        const constraint = {
          type: 'surface-stitch',
          a: sourcePiece.particles[ordered[index]],
          b: targetPiece.particles[targetIndex],
          targetParticles: targetSurface?.indices?.map((targetParticleIndex) => targetPiece.particles[targetParticleIndex]) || null,
          targetWeights: targetSurface?.weights || null,
          rest: Math.max(0.001, Number(attachment.restM ?? 0.004)),
          stiffness: Math.max(0.5, Math.min(0.995, Number(attachment.stiffness ?? 0.94))),
          seamId: attachment.id,
          seamType: 'surface-stitch',
        }
        constraints.push(constraint)
        seamConstraints.push(constraint)
        surfaceAttachmentConstraints.push(constraint)
      }
    }
  }

  for (const sourcePiece of pieces.values()) {
    const targetPieceId = sourcePiece.piece.fusedToPieceId
    if (!targetPieceId) continue
    const targetPiece = pieces.get(targetPieceId)
    if (!targetPiece || targetPiece === sourcePiece) continue
    fusedPiecePairs.add([sourcePiece.piece.id, targetPiece.piece.id].sort().join('|'))
    const stiffness = Math.max(0.75, Math.min(0.998, Number(sourcePiece.piece.fuseStiffness ?? 0.985)))
    const rest = Math.max(0.0004, Math.min(0.004, Number(sourcePiece.piece.fuseGapM ?? 0.001)))
    for (let sourceIndex = 0; sourceIndex < sourcePiece.particles.length; sourceIndex += 1) {
      const targetIndex = nearestFlatParticle(targetPiece, sourcePiece.flatVertices[sourceIndex])
      if (targetIndex < 0) continue
      const sourceParticle = sourcePiece.particles[sourceIndex]
      const targetParticle = targetPiece.particles[targetIndex]
      // Fused layers must share the shell's construction-side semantics at
      // sewn boundaries. Otherwise the shell can roll around a side/armhole
      // seam while the interfacing remains classified as an interior front
      // particle, creating a visible local delamination even though a fuse
      // constraint exists between them.
      sourceParticle.seamBoundary = Boolean(targetParticle.seamBoundary)
      sourceParticle.seamIds = new Set(targetParticle.seamIds || [])
      sourceParticle.constructionSideZ = targetParticle.constructionSideZ
      sourceParticle.collisionSideZ = targetParticle.collisionSideZ
      sourceParticle.patternU = targetParticle.patternU
      sourceParticle.patternV = targetParticle.patternV
      sourceParticle.patternOffsetY = targetParticle.patternOffsetY
      const constraint = {
        type: 'fuse',
        a: sourceParticle,
        b: targetParticle,
        rest,
        stiffness,
        fuseId: `${sourcePiece.piece.id}->${targetPiece.piece.id}:${sourceIndex}`,
      }
      constraints.push(constraint)
      fuseConstraints.push(constraint)
    }
  }

  for (const fastener of project.fasteners || []) {
    if (fastener.closed === false || !fastener.a || !fastener.b) continue
    const pieceA = pieces.get(fastener.a.pieceId)
    const pieceB = pieces.get(fastener.b.pieceId)
    if (!pieceA || !pieceB) continue
    const aIndex = nearestFlatParticle(pieceA, fastener.a)
    const bIndex = nearestFlatParticle(pieceB, fastener.b)
    if (aIndex < 0 || bIndex < 0) continue
    const type = fastener.type || 'button'
    const rest = type === 'snap' ? 0.0015 : type === 'hook' ? 0.002 : 0.0035
    const stiffness = type === 'snap' ? 0.995 : type === 'hook' ? 0.99 : 0.985
    const constraint = {
      type: 'fastener',
      a: pieceA.particles[aIndex],
      b: pieceB.particles[bIndex],
      rest,
      stiffness,
      fastenerId: fastener.id,
      fastenerType: type,
    }
    constraints.push(constraint)
    fastenerConstraints.push(constraint)
  }

  for (const seam of project.seams || []) {
    const pieceA = pieces.get(seam.a?.pieceId)
    const pieceB = pieces.get(seam.b?.pieceId)
    if (!pieceA || !pieceB) continue
    const edgeA = boundaryIndicesForSeamEndpoint(pieceA, seam.a)
    const edgeB = boundaryIndicesForSeamEndpoint(pieceB, seam.b)
    const seamType = seam.type || 'normal'
    if (seam.useExactCorrespondence === true || Number.isInteger(seam.sourceCloSeamGroup) || project.simulation?.adaptiveCutlineMeshing === true) {
      for (const sample of buildVirtualSeamSamples(seam, pieceA, pieceB)) {
        const constraint = {
          type: 'seam-virtual',
          a: sample.sourceParticles.reduce((best, item, index) => sample.sourceWeights[index] > best.weight ? { particle: item, weight: sample.sourceWeights[index] } : best, { particle: sample.sourceParticles[0], weight: -1 }).particle,
          b: sample.targetParticles.reduce((best, item, index) => sample.targetWeights[index] > best.weight ? { particle: item, weight: sample.targetWeights[index] } : best, { particle: sample.targetParticles[0], weight: -1 }).particle,
          ...sample,
          rest: 0.008,
          stiffness: (project.simulation?.seamStiffness || 0.96) * sample.arclengthWeight,
          seamId: seam.id,
          seamType,
          sourceCloSeamGroup: seam.sourceCloSeamGroup ?? null,
        }
        constraints.push(constraint)
        seamConstraints.push(constraint)
      }
      continue
    }
    const defaultRatio = seamType === 'gather' ? 0.7 : seamType === 'elastic' ? 0.85 : seamType === 'ease' ? 0.96 : 1
    const treatmentRatio = Math.max(0.3, Math.min(1.2, Number(seam.ratio ?? defaultRatio)))
    if (seamType === 'gather') {
      const gatheredPiece = seam.gatherSide === 'b' ? pieceB : pieceA
      const gatheredEdge = seam.gatherSide === 'b' ? edgeB : edgeA
      addEdgeTreatmentConstraints(gatheredPiece, gatheredEdge, treatmentRatio, 0.54, seam.id, constraints, treatmentConstraints)
    }
    if (seamType === 'elastic') {
      addEdgeTreatmentConstraints(pieceA, edgeA, treatmentRatio, 0.48, seam.id, constraints, treatmentConstraints)
      addEdgeTreatmentConstraints(pieceB, edgeB, treatmentRatio, 0.48, seam.id, constraints, treatmentConstraints)
    }
    if (seamType === 'ease') {
      const easedPiece = seam.easeSide === 'b' ? pieceB : pieceA
      const easedEdge = seam.easeSide === 'b' ? edgeB : edgeA
      addEdgeTreatmentConstraints(easedPiece, easedEdge, treatmentRatio, 0.34, seam.id, constraints, treatmentConstraints)
    }
    const edgeStability = Math.max(0, Math.min(0.98, Number(seam.edgeStability ?? 0)))
    if (edgeStability > 0) {
      // A sewn seam also stabilizes the fabric along the seam line between
      // explicit stitch samples. This is especially important when two sewn
      // edges have different simulation tessellation densities: otherwise
      // unsampled boundary particles can stretch between paired seam nodes.
      addEdgeTreatmentConstraints(pieceA, edgeA, 1, edgeStability, `${seam.id}:edge-a`, constraints, treatmentConstraints)
      addEdgeTreatmentConstraints(pieceB, edgeB, 1, edgeStability, `${seam.id}:edge-b`, constraints, treatmentConstraints)
    }
    const pairedParticles = pairEdgeParticles(edgeA, edgeB, pieceA, pieceB, seam.reverseB)
    for (let pairIndex = 0; pairIndex < pairedParticles.length; pairIndex += 1) {
      const [aIndex, bIndex] = pairedParticles[pairIndex]
      if (seamType === 'zipper' && pairedParticles.length > 1) {
        const openFraction = Math.max(0, Math.min(1, Number(seam.openFraction ?? 0)))
        if (openFraction >= 0.999) continue
        if (openFraction > 0) {
          const progress = pairIndex / (pairedParticles.length - 1)
          const opensFromStart = seam.openFrom === 'start'
          const inOpenSection = opensFromStart ? progress <= openFraction : progress >= 1 - openFraction
          if (inOpenSection) continue
        }
      }
      const closureRest = seamType === 'zipper' ? 0.003 : 0.008
      const closureStiffness = seamType === 'zipper'
        ? Math.max(0.985, project.simulation?.seamStiffness || 0.96)
        : project.simulation?.seamStiffness || 0.96
      const constraint = {
        type: 'seam',
        a: pieceA.particles[aIndex],
        b: pieceB.particles[bIndex],
        rest: closureRest,
        stiffness: closureStiffness,
        seamId: seam.id,
        seamType,
        junctionScale: Number(seam.junctionScale ?? 1),
      }
      constraints.push(constraint)
      seamConstraints.push(constraint)
    }
  }

  // A vertex at a real construction junction can belong to two or more seam
  // paths (crotch/inseam, shoulder/armhole, etc.). Driving every one of those
  // constraints at full seam stiffness concentrates all correction into a
  // single tiny structural triangle. Reduce only multi-seam junction samples
  // so neighboring cloth can share the load while ordinary seam samples stay
  // fully stiff.
  const seamMembership = new Map()
  for (const constraint of seamConstraints) {
    for (const particle of [constraint.a, constraint.b]) {
      if (!seamMembership.has(particle.simIndex)) seamMembership.set(particle.simIndex, new Set())
      seamMembership.get(particle.simIndex).add(constraint.seamId)
    }
  }
  for (const constraint of seamConstraints) {
    const aValence = seamMembership.get(constraint.a.simIndex)?.size || 1
    const bValence = seamMembership.get(constraint.b.simIndex)?.size || 1
    const junctionValence = Math.max(aValence, bValence)
    if (junctionValence > 1 && constraint.junctionScale < 1) {
      constraint.stiffness *= Math.max(0.65, Math.min(1, constraint.junctionScale))
      constraint.junction = true
    }
  }

  const collisionExclusions = new Set()
  for (const constraint of constraints) {
    if (constraint.type === 'seam-virtual') {
      for (const source of constraint.sourceParticles) {
        for (const target of constraint.targetParticles) {
          if (source.simIndex === target.simIndex) continue
          const left = Math.min(source.simIndex, target.simIndex)
          const right = Math.max(source.simIndex, target.simIndex)
          collisionExclusions.add(`${left}:${right}`)
        }
      }
      continue
    }
    if (!['structural', 'bend', 'seam', 'surface-stitch', 'fastener', 'fuse', 'fold', 'dart', 'pleat', 'edge-treatment', 'topstitch', 'zipper-tape'].includes(constraint.type)) continue
    if (constraint.type === 'surface-stitch' && constraint.targetParticles?.length) {
      for (const targetParticle of constraint.targetParticles) {
        const left = Math.min(constraint.a.simIndex, targetParticle.simIndex)
        const right = Math.max(constraint.a.simIndex, targetParticle.simIndex)
        collisionExclusions.add(`${left}:${right}`)
      }
      continue
    }
    const left = Math.min(constraint.a.simIndex, constraint.b.simIndex)
    const right = Math.max(constraint.a.simIndex, constraint.b.simIndex)
    collisionExclusions.add(`${left}:${right}`)
  }

  // Particles that are already near each other in the 2D rest pattern belong
  // to the same local cloth neighborhood. They should not self-repel merely
  // because triangulation did not place a direct structural edge between them.
  // Without this topological exclusion, fine sleeve meshes generate false
  // self-collision pressure and isolated 200–400% stretch spikes.
  const selfGap = Math.max(
    0.004,
    maxThickness * 2 + (project.simulation?.selfCollisionMargin ?? 0.002),
  )
  const restNeighborDistance = Math.max(0.014, selfGap * 1.8)
  for (const piece of pieces.values()) {
    for (let aIndex = 0; aIndex < piece.particles.length; aIndex += 1) {
      for (let bIndex = aIndex + 1; bIndex < piece.particles.length; bIndex += 1) {
        const restDistance = piece.flatVertices[aIndex].distanceTo(piece.flatVertices[bIndex]) * CM_TO_WORLD
        if (restDistance > restNeighborDistance) continue
        const a = piece.particles[aIndex]
        const b = piece.particles[bIndex]
        const left = Math.min(a.simIndex, b.simIndex)
        const right = Math.max(a.simIndex, b.simIndex)
        collisionExclusions.add(`${left}:${right}`)
      }
    }
  }

  return {
    pieces,
    meshQuality: Object.fromEntries([...pieces].map(([id,piece])=>[id,piece.meshQuality])),
    constraints,
    clothConstraints: constraints.filter((constraint) => constraint.type !== 'seam'),
    seamConstraints,
    surfaceAttachmentConstraints,
    fastenerConstraints,
    fuseConstraints,
    treatmentConstraints,
    anchorConstraints,
    manualPinConstraints,
    internalConstraints,
    trimConstraints,
    collisionExclusions,
    fusedPiecePairs,
    elapsed: 0,
    fabric: defaultFabric,
    maxThickness,
  }
}


function satisfyDistance(constraint) {
  if (constraint.type === 'seam-virtual') {
    satisfyVirtualSeam(constraint)
    return
  }
  if (constraint.type === 'surface-stitch' && constraint.targetParticles?.length) {
    satisfySurfaceAttachment(constraint)
    return
  }
  const { a, b, rest, stiffness } = constraint
  const wa = a.invMass
  const wb = b.invMass
  const total = wa + wb
  if (total <= EPSILON) return
  const delta = b.position.clone().sub(a.position)
  const length = delta.length()
  if (length <= EPSILON) return
  const error = (length - rest) / length
  const correction = delta.multiplyScalar(error * stiffness)
  if (constraint.type === 'fuse') {
    // Fusible is a follower laminate: it conforms to the shell while the
    // shell's reinforced material response carries the stiffness effect.
    // Solving this symmetrically lets the reinforcement network drag the sewn
    // shell into wrinkles, which is not how bonded interfacing behaves.
    if (wa > 0) a.position.add(correction)
    return
  }
  if (wa > 0) a.position.addScaledVector(correction, wa / total)
  if (wb > 0) b.position.addScaledVector(correction, -wb / total)
}

function satisfyAnchor(constraint) {
  const particle = constraint.particle
  if (!particle || particle.invMass <= 0) return
  if (constraint.axes === 'y') {
    particle.position.y = THREE.MathUtils.lerp(particle.position.y, constraint.target.y, constraint.stiffness)
    // A support tack should not inject vertical Verlet velocity.
    particle.previous.y = particle.position.y
    return
  }
  if (constraint.axes === 'x') {
    particle.position.x = THREE.MathUtils.lerp(particle.position.x, constraint.target.x, constraint.stiffness)
    particle.previous.x = particle.position.x
    return
  }
  if (constraint.axes === 'xz') {
    particle.position.x = THREE.MathUtils.lerp(particle.position.x, constraint.target.x, constraint.stiffness)
    particle.position.z = THREE.MathUtils.lerp(particle.position.z, constraint.target.z, constraint.stiffness)
    particle.previous.x = particle.position.x
    particle.previous.z = particle.position.z
    return
  }
  particle.position.lerp(constraint.target, constraint.stiffness)
  // A fitting tack is a kinematic placement constraint. Keeping the previous
  // position synchronized prevents the tack from injecting fake Verlet
  // velocity every frame while the surrounding cloth is being solved.
  particle.previous.copy(particle.position)
}

function updateStrain(simulation) {
  for (const piece of simulation.pieces.values()) {
    for (const particle of piece.particles) {
      particle.strain = 0
      particle.strainSamples = 0
    }
  }
  let total = 0
  let max = 0
  let samples = 0
  for (const constraint of simulation.constraints) {
    // Fit strain should describe deformation in the textile itself. Sewing
    // constraints have a deliberately tiny closure distance and would make a
    // still-converging seam look like hundreds of percent of fabric strain.
    if (constraint.type !== 'structural' || constraint.rest <= EPSILON) continue
    const current = constraint.a.position.distanceTo(constraint.b.position)
    const strain = Math.abs(current - constraint.rest) / constraint.rest
    constraint.a.strain += strain
    constraint.b.strain += strain
    constraint.a.strainSamples += 1
    constraint.b.strainSamples += 1
    total += strain
    max = Math.max(max, strain)
    samples += 1
  }
  for (const piece of simulation.pieces.values()) {
    for (const particle of piece.particles) {
      if (particle.strainSamples > 0) particle.strain /= particle.strainSamples
    }
  }
  simulation.strain = {
    average: samples ? total / samples : 0,
    max,
  }
}

function collideEllipsoid(particle, center, radii, margin, friction = 0.3) {
  if (particle.invMass <= 0) return
  const dx = particle.position.x - center.x
  const dy = particle.position.y - center.y
  const dz = particle.position.z - center.z
  const rx = radii.x + margin
  const ry = radii.y + margin
  const rz = radii.z + margin
  const q = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz)
  if (q >= 1 || q <= EPSILON) return
  const normalizedRadius = Math.sqrt(q)
  particle.contactDepth = Math.max(
    particle.contactDepth || 0,
    (1 - normalizedRadius) * Math.min(rx, ry, rz),
  )
  const scale = 1 / Math.sqrt(q)
  particle.position.set(center.x + dx * scale, center.y + dy * scale, center.z + dz * scale)
  particle.previous.lerp(particle.position, Math.max(0, Math.min(0.16, friction * 0.08)))
}

function collideEllipsoidPreserveY(particle, center, radii, margin, friction = 0.3) {
  if (particle.invMass <= 0) return
  const dy = particle.position.y - center.y
  const rx = radii.x + margin
  const ry = radii.y + margin
  const rz = radii.z + margin
  const normalizedY = dy / Math.max(EPSILON, ry)
  if (Math.abs(normalizedY) >= 1) return
  const crossSection = Math.sqrt(Math.max(EPSILON, 1 - normalizedY * normalizedY))
  const sectionX = rx * crossSection
  const sectionZ = rz * crossSection
  const dx = particle.position.x - center.x
  const dz = particle.position.z - center.z
  const q = (dx * dx) / (sectionX * sectionX) + (dz * dz) / (sectionZ * sectionZ)
  if (q >= 1) return
  particle.contactDepth = Math.max(
    particle.contactDepth || 0,
    (1 - Math.sqrt(Math.max(q, 0))) * Math.min(sectionX, sectionZ),
  )
  const sideZ = particle.collisionSideZ || Math.sign(particle.previous.z - center.z) || 1
  if (q <= EPSILON || Math.abs(particle.patternU ?? 1) < 0.78) {
    particle.position.z = center.z + sideZ * sectionZ
  } else {
    const scale = 1 / Math.sqrt(Math.max(q, EPSILON))
    particle.position.x = center.x + dx * scale
    particle.position.z = center.z + dz * scale
  }
  particle.previous.x += (particle.position.x - particle.previous.x) * Math.min(0.2, friction * 0.12)
  particle.previous.z += (particle.position.z - particle.previous.z) * Math.min(0.2, friction * 0.12)
}

// For torso cloth on the clavicle, project into the nearest horizontal
// cross-section of the shoulder collider rather than pushing it upward.
// Unlike an unrestricted lateral projection, the correction is bounded to
// avoid severe local stretch when a sewn vertex starts deep inside the body.
function collideShoulderWithLimitedRise(particle, center, radii, margin, friction = 0.3, maxLateral = 0.018) {
  if (particle.invMass <= 0) return
  const dy = particle.position.y - center.y
  const rx = radii.x + margin
  const ry = radii.y + margin
  const rz = radii.z + margin
  const ny = dy / Math.max(EPSILON, ry)
  if (Math.abs(ny) >= 1) return
  const section = Math.sqrt(Math.max(EPSILON, 1 - ny * ny))
  const sx = rx * section
  const sz = rz * section
  const dx = particle.position.x - center.x
  const dz = particle.position.z - center.z
  const q = dx * dx / (sx * sx) + dz * dz / (sz * sz)
  if (q >= 1) return
  const side = particle.collisionSideZ || Math.sign(dz) || 1
  let tx, tz
  if (q <= EPSILON || Math.abs(particle.patternU ?? 1) < 0.78) {
    tx = particle.position.x
    tz = center.z + side * sz * Math.sqrt(Math.max(0, 1 - dx * dx / (sx * sx)))
  } else {
    const scale = 1 / Math.sqrt(Math.max(q, EPSILON))
    tx = center.x + dx * scale
    tz = center.z + dz * scale
  }
  const moveX = tx - particle.position.x
  const moveZ = tz - particle.position.z
  const distance = Math.hypot(moveX, moveZ)
  const amount = Math.min(1, Math.max(0.001, maxLateral) / Math.max(distance, EPSILON))
  particle.contactDepth = Math.max(particle.contactDepth || 0, distance)
  particle.position.x += moveX * amount
  particle.position.z += moveZ * amount
  const damping = Math.min(0.2, friction * 0.12)
  particle.previous.x += (particle.position.x - particle.previous.x) * damping
  particle.previous.z += (particle.position.z - particle.previous.z) * damping
}

function collideVerticalEllipse(particle, centerX, centerZ, minY, maxY, radiusX, radiusZ, margin, friction = 0.3) {
  if (particle.invMass <= 0 || particle.position.y < minY || particle.position.y > maxY) return
  const dx = particle.position.x - centerX
  const dz = particle.position.z - centerZ
  const rx = radiusX + margin
  const rz = radiusZ + margin
  const q = (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz)
  if (q >= 1) return
  particle.contactDepth = Math.max(
    particle.contactDepth || 0,
    (1 - Math.sqrt(Math.max(q, 0))) * Math.min(rx, rz),
  )
  const patternAbs = Math.abs(particle.patternU ?? 1)
  const seamIds = [...(particle.seamIds || [])]
  const torsoPanel = ['front', 'back'].includes(particle.wrapMode)
  const baseBodyY = particle.position.y / Math.max(0.001, particle.avatarHeightScale || 1)
  const torsoSideSeam = seamIds.some((seamId) => /side-[lr]|side seam|seam-side/i.test(seamId))
  const lowerTorsoSideLock = torsoPanel && baseBodyY < 1.54 && !torsoSideSeam
  const lowerInnerSeam = (
    ['left-leg-front', 'left-leg-back', 'right-leg-front', 'right-leg-back'].includes(particle.wrapMode) &&
    seamIds.some((seamId) => /inseam|rise/i.test(seamId)) &&
    particle.position.y > 0.54 * (particle.avatarHeightScale || 1)
  )
  const preferFrontBack = (
    (torsoPanel && (patternAbs < 0.78 || lowerTorsoSideLock)) ||
    (['lower-front', 'lower-back', 'left-leg-front', 'left-leg-back', 'right-leg-front', 'right-leg-back'].includes(particle.wrapMode) && (!particle.seamBoundary || lowerInnerSeam) && patternAbs < 0.92)
  )
  if (q <= EPSILON || preferFrontBack) {
    // Preserve the panel's front/back side near the centerline. Without this
    // hint adjacent particles can choose opposite lateral exits from the body
    // and create impossible local textile stretch.
    const sideZ = particle.collisionSideZ || Math.sign(particle.previous.z - centerZ) || 1
    particle.position.z = centerZ + sideZ * rz
  } else {
    const scale = 1 / Math.sqrt(q)
    particle.position.x = centerX + dx * scale
    particle.position.z = centerZ + dz * scale
  }
  particle.previous.x += (particle.position.x - particle.previous.x) * Math.min(0.2, friction * 0.12)
  particle.previous.z += (particle.position.z - particle.previous.z) * Math.min(0.2, friction * 0.12)
}

function collideCapsule(particle, pose, margin, friction = 0.3) {
  if (particle.invMass <= 0) return
  const start = pose.center.clone().addScaledVector(pose.axis, -pose.halfLength)
  const end = pose.center.clone().addScaledVector(pose.axis, pose.halfLength)
  const segment = end.clone().sub(start)
  const lengthSq = Math.max(EPSILON, segment.lengthSq())
  const t = Math.max(0, Math.min(1, particle.position.clone().sub(start).dot(segment) / lengthSq))
  const closest = start.addScaledVector(segment, t)
  const delta = particle.position.clone().sub(closest)
  const distance = delta.length()
  const radius = pose.radius + margin
  if (distance >= radius) return

  particle.contactDepth = Math.max(particle.contactDepth || 0, radius - distance)
  if (distance <= EPSILON) delta.set(0, 0, particle.collisionSideZ || 1)
  else delta.multiplyScalar(1 / distance)
  const target = closest.addScaledVector(delta, radius)
  particle.position.copy(target)
  particle.previous.lerp(target, Math.max(0, Math.min(0.18, friction * 0.1)))
}

function torsoRadii(y, chestScale, waistScale, hipScale) {
  if (y >= 1.45) {
    const shoulderBulge = Math.max(0, 1 - Math.abs(y - 1.57) / 0.18)
    return {
      x: (0.19 + 0.05 * shoulderBulge) * chestScale,
      z: (0.13 + 0.012 * shoulderBulge) * chestScale,
    }
  }
  if (y >= 1.08) {
    const t = Math.max(0, Math.min(1, (y - 1.08) / 0.5))
    return {
      x: THREE.MathUtils.lerp(0.155 * waistScale, 0.19 * chestScale, t),
      z: THREE.MathUtils.lerp(0.105 * waistScale, 0.13 * chestScale, t),
    }
  }
  const t = Math.max(0, Math.min(1, (y - 0.60) / 0.48))
  return {
    x: THREE.MathUtils.lerp(0.20 * hipScale, 0.155 * waistScale, t),
    z: THREE.MathUtils.lerp(0.14 * hipScale, 0.105 * waistScale, t),
  }
}

export function getAvatarTorsoRadii(avatar, y) {
  const chestScale = Math.max(0.72, Math.min(1.42, (avatar?.chestCm || 96) / 96))
  const waistScale = Math.max(0.68, Math.min(1.5, (avatar?.waistCm || 78) / 78))
  const hipScale = Math.max(0.72, Math.min(1.42, (avatar?.hipCm || 94) / 94))
  return torsoRadii(y / getAvatarHeightScale(avatar), chestScale, waistScale, hipScale)
}

function ellipsoidClearance(position, center, radii) {
  const dx = position.x - center.x
  const dy = position.y - center.y
  const dz = position.z - center.z
  const q = Math.sqrt(
    (dx * dx) / (radii.x * radii.x) +
    (dy * dy) / (radii.y * radii.y) +
    (dz * dz) / (radii.z * radii.z),
  )
  return (q - 1) * Math.min(radii.x, radii.y, radii.z)
}

function capsuleClearance(position, pose) {
  const start = pose.center.clone().addScaledVector(pose.axis, -pose.halfLength)
  const end = pose.center.clone().addScaledVector(pose.axis, pose.halfLength)
  const segment = end.clone().sub(start)
  const lengthSq = Math.max(EPSILON, segment.lengthSq())
  const t = Math.max(0, Math.min(1, position.clone().sub(start).dot(segment) / lengthSq))
  const closest = start.addScaledVector(segment, t)
  return position.distanceTo(closest) - pose.radius
}

function shouldUseShoulderCap(particle, upper) {
  const wrapMode = particle?.wrapMode || ''
  const patternV = Number.isFinite(particle?.patternV) ? particle.patternV : 1
  const seamIds = [...(particle?.seamIds || [])]
  if (['front', 'back'].includes(wrapMode)) {
    const shoulderSeam = seamIds.some((seamId) => /shoulder/i.test(seamId))
    return shoulderSeam || patternV >= 0.86
  }
  if (['left-arm', 'right-arm'].includes(wrapMode)) return patternV >= 0.72
  return (particle?.position?.y ?? 0) >= upper.shoulderCenterY - upper.shoulderCapRadiusY * 0.45
}

export function avatarClearance(position, avatar, particle = null) {
  const upper = getAvatarUpperBodyDimensions(avatar)
  const heightScale = upper.heightScale
  const clearances = []

  if (position.y >= 0.56 * heightScale && position.y <= 1.49 * heightScale) {
    const radii = getAvatarTorsoRadii(avatar, position.y)
    const radial = Math.sqrt(
      (position.x * position.x) / (radii.x * radii.x) +
      (position.z * position.z) / (radii.z * radii.z),
    )
    clearances.push((radial - 1) * Math.min(radii.x, radii.z))
  }


  // Match the visible upper-chest / shoulder cap instead of extending the
  // front/back cylindrical torso all the way over the shoulder plane. This is
  // crucial for sewn shoulder seams: they need to pass over the top surface
  // at z≈0 rather than being classified as front/back cloth and split apart.
  if (shouldUseShoulderCap(particle || { position }, upper)) {
    clearances.push(
      ellipsoidClearance(
        position,
        new THREE.Vector3(0, upper.shoulderCenterY, 0),
        new THREE.Vector3(upper.shoulderCapRadiusX, upper.shoulderCapRadiusY, upper.shoulderCapRadiusZ),
      ),
    )
  }

  const upperBodice = ['front', 'back'].includes(particle?.wrapMode) &&
    position.y > upper.shoulderCenterY - upper.shoulderCapRadiusY * 1.15 &&
    Math.abs(position.x) < upper.shoulderHalfWidth + 0.025
  if (!upperBodice && position.y >= 0.76 * heightScale && position.y <= 1.57 * heightScale) {
    clearances.push(
      capsuleClearance(position, getAvatarArmPose(avatar, -1)),
      capsuleClearance(position, getAvatarArmPose(avatar, 1)),
    )
  }

  clearances.push(
    ellipsoidClearance(position, new THREE.Vector3(0, upper.neckCenterY, 0), new THREE.Vector3(upper.neckRadius, upper.neckRadiusY, upper.neckRadius)),
    ellipsoidClearance(position, new THREE.Vector3(0, 1.88 * heightScale, 0), new THREE.Vector3(0.15, 0.19 * heightScale, 0.15)),
    ellipsoidClearance(position, new THREE.Vector3(-0.105, 0.24 * heightScale, 0), new THREE.Vector3(0.09, 0.48 * heightScale, 0.10)),
    ellipsoidClearance(position, new THREE.Vector3(0.105, 0.24 * heightScale, 0), new THREE.Vector3(0.09, 0.48 * heightScale, 0.10)),
  )

  return Math.min(...clearances)
}

// Diagnostic only: sample the surface of each cloth triangle, not just its
// vertices. A fabric face can cut through an avatar collider even if all
// three vertices are outside. Sampling never moves cloth and cannot by itself
// certify triangle-level collision freedom or continuous-time contact.
export function measureAvatarSurfaceIntrusion(simulation, avatar, options = {}) {
  const epsilon = Math.max(0, Number(options.epsilonM ?? 0.0005))
  const result = { facesChecked: 0, samplesChecked: 0, penetratingSamples: 0,
    penetratingFaces: 0, maximumIntrusionMm: 0, byPiece: {} }
  const weights = [[1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]]
  for (const piece of simulation.pieces.values()) {
    const metrics = { facesChecked: 0, penetratingFaces: 0, penetratingSamples: 0, maximumIntrusionMm: 0 }
    for (const [ia, ib, ic] of piece.faces || []) {
      const a = piece.particles[ia], b = piece.particles[ib], c = piece.particles[ic]
      if (!a || !b || !c) continue
      let penetrated = false
      metrics.facesChecked++
      result.facesChecked++
      for (const [wa, wb, wc] of weights) {
        const point = new THREE.Vector3().addScaledVector(a.position, wa)
          .addScaledVector(b.position, wb).addScaledVector(c.position, wc)
        const clearance = avatarClearance(point, avatar, {
          position: point, wrapMode: a.wrapMode, patternV: (a.patternV + b.patternV + c.patternV) / 3,
          seamIds: a.seamIds,
        })
        result.samplesChecked++
        if (clearance < -epsilon) {
          const millimeters = -clearance * 1000
          metrics.penetratingSamples++
          result.penetratingSamples++
          metrics.maximumIntrusionMm = Math.max(metrics.maximumIntrusionMm, millimeters)
          result.maximumIntrusionMm = Math.max(result.maximumIntrusionMm, millimeters)
          penetrated = true
        }
      }
      if (penetrated) { metrics.penetratingFaces++; result.penetratingFaces++ }
    }
    result.byPiece[piece.id] = metrics
  }
  result.maximumIntrusionMm = +result.maximumIntrusionMm.toFixed(3)
  return result
}

function updateFitMetrics(simulation, project) {
  let easeTotal = 0
  let pressureTotal = 0
  let pressureMax = 0
  let contacts = 0
  let tight = 0
  let loose = 0
  let count = 0
  for (const piece of simulation.pieces.values()) {
    for (const particle of piece.particles) {
      const clearanceM = avatarClearance(particle.position, project.avatar, particle)
      const easeCm = Math.max(0, clearanceM) * 100
      const pressureScale = Math.max(
        0.004,
        (project.simulation?.collisionMargin ?? 0.012) + (particle.thickness ?? 0.002),
      )
      const penetrationPressure = Math.min(1, (particle.contactDepth || 0) / pressureScale)
      const strainPressure = Math.min(1, (particle.strain || 0) / 0.12)
      const pressureIndex = penetrationPressure > 0
        ? Math.min(1, penetrationPressure * 0.78 + strainPressure * 0.22)
        : 0

      particle.easeCm = easeCm
      particle.pressureIndex = pressureIndex
      easeTotal += easeCm
      pressureTotal += pressureIndex
      pressureMax = Math.max(pressureMax, pressureIndex)
      if (clearanceM <= 0.005 || pressureIndex > 0.02) contacts += 1
      if (easeCm < 1) tight += 1
      if (easeCm > 4) loose += 1
      count += 1
    }
  }

  simulation.fit = {
    averageEaseCm: count ? easeTotal / count : 0,
    averagePressureIndex: count ? pressureTotal / count : 0,
    maxPressureIndex: pressureMax,
    contactRatio: count ? contacts / count : 0,
    tightRatio: count ? tight / count : 0,
    looseRatio: count ? loose / count : 0,
  }
}

export function refreshSimulationAnalysis(simulation, project) {
  if (!simulation || !project) return simulation
  updateStrain(simulation)
  updateFitMetrics(simulation, project)
  // Solver-independent, non-destructive fit telemetry. Mean seam distance
  // alone can hide a completely open sleeve seam; report the tail and worst
  // seam independently. These values are diagnostics, not proof of contact
  // safety (triangle CCD is not implemented in the interactive backend).
  const percentile = (sorted, fraction) => sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : 0
  const seamGaps = (simulation.seamConstraints || [])
    .filter((constraint) => constraint?.a && constraint?.b)
    .map((constraint) => seamGap(constraint) * 1000)
    .sort((a, b) => a - b)
  const strains = (simulation.constraints || [])
    .filter((constraint) => constraint.type === 'structural' && constraint.rest > EPSILON)
    .map((constraint) => Math.abs(constraint.a.position.distanceTo(constraint.b.position) - constraint.rest) / constraint.rest)
    .sort((a, b) => a - b)
  const worstSeams = (simulation.seamConstraints || [])
    .filter((constraint) => constraint?.a && constraint?.b)
    .map((constraint) => ({
      seamId: constraint.seamId || null,
      gapMm: seamGap(constraint) * 1000,
    }))
    .sort((a, b) => b.gapMm - a.gapMm)
    .slice(0, 5)
  simulation.quality = {
    structural: {
      samples: strains.length,
      meanStrainPercent: simulation.strain.average * 100,
      p95StrainPercent: percentile(strains, 0.95) * 100,
      maxStrainPercent: percentile(strains, 1) * 100,
    },
    sewing: {
      pairs: seamGaps.length,
      meanGapMm: seamGaps.reduce((sum, gap) => sum + gap, 0) / Math.max(1, seamGaps.length),
      p95GapMm: percentile(seamGaps, 0.95),
      maxGapMm: percentile(seamGaps, 1),
      worstSeams,
    },
    collision: { triangleCcdVerified: false, allFrameIntersectionFree: null },
  }
  simulation.quality.acceptance = assessSimulationFit(simulation.quality)
  return simulation
}

function collideAvatar(particle, avatar, margin, friction) {
  const upper = getAvatarUpperBodyDimensions(avatar)
  const heightScale = upper.heightScale
  const legPanel = /^(left|right)-leg-/.test(particle.wrapMode || '')
  // At the crotch, a full-width pelvic ellipsoid cannot be applied on top
  // of *both* leg tubes: it pushes paired inseam vertices to opposite front/
  // back sides of the body by ~31 cm. Begin the pelvis collision above the
  // crotch instead; dedicated leg colliders handle the trouser tubes below.
  // The 0.76 transition reduced straight-pants average seam gap from 7.03 cm
  // to 0.90 cm and fitted jeans from 5.46 cm to 0.99 cm in 180-frame tests.
  const legTorsoStartY = THREE.MathUtils.clamp(Number(avatar?.legTorsoCollisionStartY ?? 0.76), 0.56, 0.80) * heightScale
  if (particle.position.y >= 0.56 * heightScale && particle.position.y <= 1.49 * heightScale &&
      (!legPanel || particle.position.y >= legTorsoStartY)) {
    const radii = getAvatarTorsoRadii(avatar, particle.position.y)
    collideVerticalEllipse(particle, 0, 0, 0.56 * heightScale, 1.49 * heightScale, radii.x, radii.z, margin, friction)
  }
  const adaptiveShoulder = avatar?.shoulderContactMode === 'adaptive-limited-lateral' &&
    Number(avatar.heightCm ?? 180) >= 175 && Number(avatar.heightCm ?? 180) <= 190
  if ((avatar?.shoulderContactMode === 'limited-lateral' || adaptiveShoulder) && ['front', 'back'].includes(particle.wrapMode)) {
    collideShoulderWithLimitedRise(
      particle,
      new THREE.Vector3(0, upper.shoulderCenterY, 0),
      new THREE.Vector3(upper.shoulderCapRadiusX, upper.shoulderCapRadiusY, upper.shoulderCapRadiusZ),
      margin,
      friction,
      Number(avatar.shoulderMaxLateralCorrectionM ?? 0.018),
    )
  } else if (avatar?.shoulderContactMode === 'lateral' && ['front', 'back'].includes(particle.wrapMode) && (particle.patternV ?? 1) >= Number(avatar.shoulderLateralPatternV ?? 0)) {
    collideEllipsoidPreserveY(
      particle,
      new THREE.Vector3(0, upper.shoulderCenterY, 0),
      new THREE.Vector3(upper.shoulderCapRadiusX, upper.shoulderCapRadiusY, upper.shoulderCapRadiusZ),
      margin,
      friction,
    )
  } else if (shouldUseShoulderCap(particle, upper)) {
    collideEllipsoid(
      particle,
      new THREE.Vector3(0, upper.shoulderCenterY, 0),
      new THREE.Vector3(upper.shoulderCapRadiusX, upper.shoulderCapRadiusY, upper.shoulderCapRadiusZ),
      margin,
      friction,
    )
  } else if (['front', 'back'].includes(particle.wrapMode)) {
    collideEllipsoidPreserveY(
      particle,
      new THREE.Vector3(0, upper.shoulderCenterY, 0),
      new THREE.Vector3(upper.shoulderCapRadiusX, upper.shoulderCapRadiusY, upper.shoulderCapRadiusZ),
      margin,
      friction,
    )
  }
  // A torso panel at the upper armhole can be inside the arm and shoulder
  // proxy simultaneously. Projecting it against BOTH volumes sequentially
  // throws adjacent 1 cm cloth edges onto opposite sides of the arm and
  // creates severe nonphysical stretching. Only sleeve particles are owned
  // by the full arm capsule. Bodice particles near the shoulder joint use
  // the shoulder cap and chest instead; outboard bodice particles still
  // contact the arms so loose garments cannot pass through the biceps.
  // Tall-body fitting is the reproducible regression; keep the established
  // 160–190 cm collision path until it is independently tuned and verified.
  const bodiceAtShoulder =
    ['front', 'back'].includes(particle.wrapMode) &&
    particle.position.y > upper.shoulderCenterY - upper.shoulderCapRadiusY * 1.15 &&
    Math.abs(particle.position.x) < upper.shoulderHalfWidth + 0.025
  if (!bodiceAtShoulder) {
    collideCapsule(particle, getAvatarArmPose(avatar, -1), margin, friction)
    collideCapsule(particle, getAvatarArmPose(avatar, 1), margin, friction)
  }
  const torsoCloth = ['front', 'back'].includes(particle.wrapMode)
  const useNeckCollider = !torsoCloth || Math.abs(particle.position.x) < upper.neckRadius * 0.86 || particle.position.y > 1.735 * heightScale
  if (useNeckCollider) {
    collideEllipsoid(particle, new THREE.Vector3(0, upper.neckCenterY, 0), new THREE.Vector3(upper.neckRadius, upper.neckRadiusY, upper.neckRadius), margin, friction)
  }
  const useHeadCollider = !torsoCloth || particle.position.y > 1.755 * heightScale
  if (useHeadCollider) {
    collideEllipsoid(particle, new THREE.Vector3(0, 1.88 * heightScale, 0), new THREE.Vector3(0.15, 0.19 * heightScale, 0.15), margin, friction)
  }
  const wrapMode = particle.wrapMode || ''
  const ownsLeftLeg = wrapMode.startsWith('left-leg')
  const ownsRightLeg = wrapMode.startsWith('right-leg')
  const upperInnerSeam = (
    (ownsLeftLeg || ownsRightLeg) &&
    [...(particle.seamIds || [])].some((seamId) => /inseam|rise/i.test(seamId)) &&
    particle.position.y > 0.54 * heightScale
  )
  if (ownsLeftLeg && !upperInnerSeam) {
    collideEllipsoid(particle, new THREE.Vector3(-0.105, 0.24 * heightScale, 0), new THREE.Vector3(0.09, 0.48 * heightScale, 0.10), margin, friction)
  } else if (ownsRightLeg && !upperInnerSeam) {
    collideEllipsoid(particle, new THREE.Vector3(0.105, 0.24 * heightScale, 0), new THREE.Vector3(0.09, 0.48 * heightScale, 0.10), margin, friction)
  } else if (!ownsLeftLeg && !ownsRightLeg) {
    // Generic lower-body panels can span both legs, but dedicated trouser
    // panels own a single leg. Applying both overlapping leg colliders to an
    // inseam/crotch particle can otherwise throw it across the body midline.
    collideEllipsoid(particle, new THREE.Vector3(-0.105, 0.24 * heightScale, 0), new THREE.Vector3(0.09, 0.48 * heightScale, 0.10), margin, friction)
    collideEllipsoid(particle, new THREE.Vector3(0.105, 0.24 * heightScale, 0), new THREE.Vector3(0.09, 0.48 * heightScale, 0.10), margin, friction)
  }
  if (particle.position.y < 0.01) particle.position.y = 0.01
}

function stabilizeSurfaceAttachments(simulation, project) {
  for (const constraint of simulation.surfaceAttachmentConstraints || []) {
    const { a, b } = constraint
    if (!a || !b || (a.invMass <= 0 && b.invMass <= 0)) continue
    if (constraint.targetParticles?.length) {
      // Continuous surface stitches are solved once more after avatar
      // projection. Their barycentric target already follows the shell, so a
      // second midpoint/body projection would double-count the target layer.
      satisfySurfaceAttachment(constraint)
      continue
    }
    const midpoint = a.position.clone().add(b.position).multiplyScalar(0.5)
    const previous = a.previous.clone().add(b.previous).multiplyScalar(0.5)
    const proxy = {
      position: midpoint.clone(),
      previous,
      invMass: 1,
      // `b` is the target shell particle for surface attachments. Use its
      // construction side so lining/pocket pairs cannot be projected to
      // opposite sides of the avatar at ambiguous side-seam locations.
      wrapMode: b.wrapMode || a.wrapMode,
      patternU: Number.isFinite(b.patternU) ? b.patternU : a.patternU,
      collisionSideZ: b.collisionSideZ || a.collisionSideZ || 1,
      contactDepth: 0,
    }
    const layer = Math.max(a.layerIndex || 0, b.layerIndex || 0)
    const thickness = Math.max(a.thickness || 0.002, b.thickness || 0.002)
    const margin = (project.simulation?.collisionMargin ?? 0.012) + thickness + layer * Math.max(0.0025, thickness * 1.15)
    const friction = Math.max(a.friction || 0.3, b.friction || 0.3)
    collideAvatar(proxy, project.avatar, margin, friction)
    const displacement = proxy.position.sub(midpoint)
    const length = displacement.length()
    if (length > 0.035) displacement.multiplyScalar(0.035 / length)
    if (a.invMass > 0) a.position.add(displacement)
    if (b.invMass > 0) b.position.add(displacement)
    satisfyDistance(constraint)
  }
}

function stabilizeSeamPairs(simulation, project) {
  for (const constraint of simulation.seamConstraints || []) {
    if (!constraint?.a || !constraint?.b) continue
    if (constraint.type === 'surface-stitch') continue
    if (constraint.type === 'seam-virtual') {
      // Virtual stitch positions are interpolated across several vertices on
      // both panels; projecting a single representative pair through the
      // avatar would move the *wrong* vertices. Rely on weighted sewing and
      // the ordinary per-particle collision passes instead.
      continue
    }
    const distance = constraint.a.position.distanceTo(constraint.b.position)
    if (distance <= Math.max(0.025, constraint.rest * 2.5)) continue
    const lowerBodyModes = new Set([
      'lower-front', 'lower-back',
      'left-leg-front', 'left-leg-back', 'right-leg-front', 'right-leg-back',
    ])
    const lowerBodySeam = lowerBodyModes.has(constraint.a.wrapMode) || lowerBodyModes.has(constraint.b.wrapMode)
    if (lowerBodySeam) {
      // Inner-leg/crotch seam midpoints can sit inside overlapping left/right
      // leg volumes. Projecting that midpoint through the whole avatar union
      // can select the wrong leg and teleport the seam across the body. Close
      // those seams directly and let the next ordinary collision pass keep each
      // particle on its own leg surface.
      const originalStiffness = constraint.stiffness
      constraint.stiffness = Math.max(originalStiffness, 0.82)
      satisfyDistance(constraint)
      constraint.stiffness = originalStiffness
      continue
    }
    const midpoint = constraint.a.position.clone().add(constraint.b.position).multiplyScalar(0.5)
    const previous = constraint.a.previous.clone().add(constraint.b.previous).multiplyScalar(0.5)
    const proxy = {
      position: midpoint.clone(),
      previous,
      invMass: 1,
      wrapMode: null,
      patternU: 1,
      collisionSideZ: Math.sign(midpoint.z) || constraint.a.collisionSideZ || constraint.b.collisionSideZ || 1,
      contactDepth: 0,
    }
    const thickness = Math.max(constraint.a.thickness || 0.002, constraint.b.thickness || 0.002)
    const layer = Math.max(constraint.a.layerIndex || 0, constraint.b.layerIndex || 0)
    const margin = (project.simulation?.collisionMargin ?? 0.012) + thickness + layer * Math.max(0.0025, thickness * 1.15)
    const friction = Math.max(constraint.a.friction || 0.3, constraint.b.friction || 0.3)
    collideAvatar(proxy, project.avatar, margin, friction)
    const displacement = proxy.position.sub(midpoint)
    const displacementLength = displacement.length()
    if (displacementLength > 0.04) displacement.multiplyScalar(0.04 / displacementLength)
    if (constraint.a.invMass > 0) constraint.a.position.add(displacement)
    if (constraint.b.invMass > 0) constraint.b.position.add(displacement)
    // Use one full-strength closure pass only for reopened outliers. The main
    // seam solver still controls ordinary seam behavior and easing/gathering.
    const originalStiffness = constraint.stiffness
    const shoulderRegion = Number(project.avatar?.heightCm ?? 180) < 195 && [constraint.a, constraint.b].some((particle) =>
      ['front', 'back', 'left-arm', 'right-arm'].includes(particle.wrapMode) &&
      particle.position.y > getAvatarUpperBodyDimensions(project.avatar).shoulderCenterY - 0.17 * getAvatarHeightScale(project.avatar))
    // A large full-strength shoulder seam pull in a single iteration crosses
    // the arm capsule and opens adjacent mesh triangles. Let the regular
    // per-frame sewing passes converge it incrementally near the clavicle.
    constraint.stiffness = shoulderRegion ? Math.min(originalStiffness, 0.35) : 0.995
    satisfyDistance(constraint)
    constraint.stiffness = originalStiffness
  }
}

function stabilizeConstructionSides(simulation) {
  for (const piece of simulation.pieces.values()) {
    for (const particle of piece.particles) {
      const side = particle.constructionSideZ
      if (side !== -1 && side !== 1) continue
      if (particle.position.z * side < 0) particle.position.z = side * Math.abs(particle.position.z)
      if (particle.previous.z * side < 0) particle.previous.z = side * Math.abs(particle.previous.z)
    }
  }
}

function stabilizeFuseLayers(simulation) {
  for (const constraint of simulation.fuseConstraints || []) {
    const source = constraint.a
    const target = constraint.b
    if (!source || !target || source.invMass <= 0) continue
    const correction = target.position.clone().sub(source.position)
    const distance = correction.length()
    if (distance <= 0.0015) continue
    const factor = distance > 0.015 ? 0.92 : 0.78
    correction.multiplyScalar(factor)
    source.position.add(correction)
    // Translate the previous position by the same amount so bonding does not
    // inject artificial velocity on the next integration step.
    source.previous.add(correction)
  }
}

function applyWindForces(simulation, project, dt) {
  const wind = project.simulation?.wind
  if (!wind?.enabled) return
  const speed = Math.max(0, Math.min(25, Number(wind.speed ?? 0)))
  if (speed <= 0.01) return
  const radians = THREE.MathUtils.degToRad(Number(wind.directionDeg ?? 0))
  const direction = new THREE.Vector3(Math.sin(radians), 0, Math.cos(radians)).normalize()
  const turbulence = Math.max(0, Math.min(1, Number(wind.turbulence ?? 0)))
  const airDensity = 1.225
  const responseScale = Math.max(0.005, Math.min(0.08, Number(wind.response ?? 0.025)))
  const time = simulation.elapsed || 0

  for (const piece of simulation.pieces.values()) {
    if (!piece.faces?.length || !piece.particles?.length) continue
    const arealDensity = Math.max(0.04, Number(piece.fabric?.gsm ?? 250) / 1000)
    const baseAcceleration = (0.5 * airDensity * speed * speed / arealDensity) * responseScale
    const accumulated = piece.particles.map(() => new THREE.Vector3())
    const weights = new Float32Array(piece.particles.length)

    for (let faceIndex = 0; faceIndex < piece.faces.length; faceIndex += 1) {
      const face = piece.faces[faceIndex]
      const [ia, ib, ic] = face
      const a = piece.particles[ia]
      const b = piece.particles[ib]
      const c = piece.particles[ic]
      if (!a || !b || !c) continue
      const ab = b.position.clone().sub(a.position)
      const ac = c.position.clone().sub(a.position)
      const cross = ab.cross(ac)
      const doubleArea = cross.length()
      if (doubleArea <= EPSILON) continue
      const area = doubleArea * 0.5
      const normal = cross.multiplyScalar(1 / doubleArea)
      const signedFacing = normal.dot(direction)
      const facing = Math.abs(signedFacing)
      if (facing < 0.015) continue
      const gust = Math.max(0.25, 1 + turbulence * (
        Math.sin(time * 5.7 + faceIndex * 0.713) * 0.42 +
        Math.sin(time * 2.3 + faceIndex * 1.931) * 0.23
      ))
      const acceleration = direction.clone().multiplyScalar(baseAcceleration * facing * gust)
      acceleration.addScaledVector(normal, Math.sign(signedFacing || 1) * baseAcceleration * facing * gust * 0.14)
      for (const index of [ia, ib, ic]) {
        accumulated[index].addScaledVector(acceleration, area)
        weights[index] += area
      }
    }

    for (let index = 0; index < piece.particles.length; index += 1) {
      const particle = piece.particles[index]
      if (!particle || particle.invMass <= 0 || weights[index] <= EPSILON) continue
      const displacement = accumulated[index].multiplyScalar((dt * dt) / weights[index])
      const maxDisplacement = 0.0065
      const length = displacement.length()
      if (length > maxDisplacement) displacement.multiplyScalar(maxDisplacement / length)
      particle.position.add(displacement)
    }
  }
}

function resolveBodyFaceCollisions(pieceSim, project, margin, friction) {
  for (const face of pieceSim.faces) {
    const particles = face.map((index) => pieceSim.particles[index])
    if (particles.every((particle) => particle.invMass <= 0)) continue
    const centroid = new THREE.Vector3()
    const previous = new THREE.Vector3()
    for (const particle of particles) {
      centroid.add(particle.position)
      previous.add(particle.previous)
    }
    centroid.multiplyScalar(1 / 3)
    previous.multiplyScalar(1 / 3)
    const proxy = {
      position: centroid.clone(),
      previous,
      invMass: 1,
      wrapMode: particles[0].wrapMode,
      patternU: particles.reduce((sum, particle) => sum + (particle.patternU || 0), 0) / 3,
      collisionSideZ: Math.sign(particles.reduce((sum, particle) => sum + (particle.collisionSideZ || 0), 0)) || 1,
      contactDepth: 0,
    }
    collideAvatar(proxy, project.avatar, margin, friction)
    const correction = proxy.position.sub(centroid)
    const correctionLength = correction.length()
    if (correctionLength <= 1e-5) continue
    if (correctionLength > 0.03) correction.multiplyScalar(0.03 / correctionLength)
    correction.multiplyScalar(0.12)
    const movable = particles.filter((particle) => particle.invMass > 0)
    if (!movable.length) continue
    const share = 1 / movable.length
    for (const particle of movable) particle.position.addScaledVector(correction, share)
  }
}

// A bounded post-solve contact correction. This is deliberately separate from
// the ordinary constraint loop: seam/fuse constraints can move vertices back
// through the body after a prior contact projection. Check interior triangle
// samples and distribute small corrective impulses to their movable corners.
// The collider is analytic (not the visual GLB); this is not triangle CCD.
export function correctAvatarSurfaceIntrusion(simulation, project, options = {}) {
  const maxCorrectionM = Math.max(0, Math.min(0.008, Number(options.maxCorrectionM ?? 0.003)))
  const epsilonM = Math.max(0, Math.min(0.005, Number(options.epsilonM ?? 0.0005)))
  const before = measureAvatarSurfaceIntrusion(simulation, project.avatar, { epsilonM })
  const result = { before, after: before, correctedFaces: 0, correctedVertices: 0, accepted: false }
  if (!before.penetratingFaces || project.simulation?.collisions === false || !maxCorrectionM) return result
  const baseline = [...simulation.pieces.values()].map(piece => ({
    piece, positions: piece.particles.map(p => p.position.clone()),
  }))
  const affected = new Set()
  for (const piece of simulation.pieces.values()) {
    const thickness = piece.fabric?.thickness ?? 0.002
    const margin = (project.simulation?.collisionMargin ?? 0.012) + thickness
    for (const [ia, ib, ic] of piece.faces || []) {
      const corners = [ia,ib,ic].map(i => piece.particles[i])
      if (corners.some(p => !p)) continue
      const movable = corners.filter(p => p.invMass > 0)
      if (!movable.length) continue
      const centroid = new THREE.Vector3()
      for (const particle of corners) centroid.add(particle.position)
      centroid.multiplyScalar(1 / 3)
      const proxy = {
        position: centroid.clone(), previous: centroid.clone(), invMass: 1,
        wrapMode: corners[0].wrapMode,
        patternU: corners.reduce((sum,p) => sum + (p.patternU || 0),0) / 3,
        patternV: corners.reduce((sum,p) => sum + (p.patternV || 0),0) / 3,
        collisionSideZ: corners[0].collisionSideZ,
        contactDepth: 0,
      }
      if (avatarClearance(centroid, project.avatar, proxy) >= -epsilonM) continue
      collideAvatar(proxy, project.avatar, margin, piece.fabric?.friction ?? 0.3)
      const displacement = proxy.position.sub(centroid)
      if (!Number.isFinite(displacement.lengthSq()) || displacement.lengthSq() < 1e-12) continue
      displacement.clampLength(0, maxCorrectionM).multiplyScalar(1 / movable.length)
      for (const particle of movable) {
        particle.position.add(displacement)
        affected.add(particle)
      }
      result.correctedFaces++
    }
  }
  result.correctedVertices = affected.size
  result.after = measureAvatarSurfaceIntrusion(simulation, project.avatar, { epsilonM })
  result.accepted = result.after.penetratingFaces < before.penetratingFaces &&
    result.after.maximumIntrusionMm <= before.maximumIntrusionMm + 0.5
  if (!result.accepted) {
    for (const {piece,positions} of baseline) piece.particles.forEach((particle,i) => particle.position.copy(positions[i]))
    result.after = before
  } else {
    // Prevent artificial velocity spikes from contact corrections.
    for (const particle of affected) particle.previous.copy(particle.position)
  }
  return result
}

export function stepSimulation(simulation, project, dt = 1 / 60) {
  const schedule = resolveSolverTimestep(project.simulation, dt, simulation.maxThickness ?? 0.002)
  if (!schedule) return simulation
  const { safeDt, substeps, subDt, gravityStep, iterations, selfCollisionDistance } = schedule

  // Keep the largest contact event seen anywhere in this displayed frame so
  // pressure visualization remains meaningful when using multiple substeps.
  for (const piece of simulation.pieces.values()) {
    for (const particle of piece.particles) {
      particle.contactDepth = 0
    }
  }

  for (let substep = 0; substep < substeps; substep += 1) {
    for (const piece of simulation.pieces.values()) {
      const damping = Math.pow(piece.fabric?.damping ?? 0.985, 1 / substeps)
      for (const particle of piece.particles) {
        if (particle.invMass <= 0) continue
        const velocity = particle.position.clone().sub(particle.previous).multiplyScalar(damping)
        particle.previous.copy(particle.position)
        particle.position.add(velocity)
        particle.position.y -= gravityStep
      }
    }
    applyWindForces(simulation, project, subDt)

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      // Alternate the full constraint sweep to reduce Gauss-Seidel ordering
      // bias while still letting seam and structural constraints continuously
      // relax one another. This produced the most stable mirrored drape in the
      // current PBD solver.
      if ((iteration + substep) % 2 === 0) {
        for (let index = 0; index < simulation.constraints.length; index += 1) satisfyDistance(simulation.constraints[index])
      } else {
        for (let index = simulation.constraints.length - 1; index >= 0; index -= 1) satisfyDistance(simulation.constraints[index])
      }
      for (const constraint of simulation.anchorConstraints || []) satisfyAnchor(constraint)
      if (project.simulation?.selfCollision !== false) resolveSelfCollisions(simulation, selfCollisionDistance)
      // Collision is intentionally last. Constraint projection can move sewn
      // cloth back through the body, so ending each solver iteration with the
      // avatar projection guarantees the committed particle state is outside.
      if (project.simulation?.collisions !== false) {
        projectAvatarContacts(simulation, project, collideAvatar)
        if (project.simulation?.bodyTriangleContactAssist === true) {
          // Interior points of cloth triangles can penetrate the avatar even
          // while all three vertices lie outside it. Project the centroid,
          // share only a small correction among movable triangle corners,
          // then rerun individual vertex contacts below. This optional pass
          // does not replace triangle/triangle continuous collision detection.
          for (const piece of simulation.pieces.values()) {
            const {margin,friction} = avatarContactParameters(project,piece)
            resolveBodyFaceCollisions(piece, project, margin, friction)
          }
        }
        stabilizeSurfaceAttachments(simulation, project)
        if (project.simulation?.stabilizeSeamPairs !== false) stabilizeSeamPairs(simulation, project)
        stabilizeConstructionSides(simulation)
        stabilizeFuseLayers(simulation)
        // Attachment/seam/fuse stabilization runs *after* the first contact
        // projection and can push particles straight back inside the avatar.
        // Finish each iteration with contact again. This is a particle-level
        // guarantee only; triangle/triangle CCD remains a separate problem.
        projectAvatarContacts(simulation, project, collideAvatar, { movableOnly: true })
      }
    }
  }
  refreshSimulationAnalysis(simulation, project)
  // Sampling every simulated frame is optional because it is more expensive
  // than particle contact; enabled for the interactive body-contact pass.
  if (project.simulation?.continuousSurfaceContact === true && project.simulation?.collisions !== false) {
    const surfaceContact = correctAvatarSurfaceIntrusion(simulation, project)
    simulation.surfaceContact = {
      penetratingFacesBefore: surfaceContact.before.penetratingFaces,
      penetratingFacesAfter: surfaceContact.after.penetratingFaces,
      maximumIntrusionMm: surfaceContact.after.maximumIntrusionMm,
      correctedVertices: surfaceContact.accepted ? surfaceContact.correctedVertices : 0,
      correctionAccepted: surfaceContact.accepted,
      triangleCcdVerified: false,
    }
    if (surfaceContact.accepted) refreshSimulationAnalysis(simulation, project)
  }
  simulation.elapsed += safeDt
  return simulation
}

function visualSurfacePosition(particle, project) {
  const result = particle.position.clone()
  if (!project) return result
  // Physics particles already start from an arranged body/arm wrap and are
  // projected against the avatar during every solver iteration. Re-projecting
  // each pattern independently at render time breaks seam continuity because
  // two sewn particles can be snapped to different analytic surfaces after
  // the seam solver has brought them together. Keep the old wrap assist as an
  // explicit diagnostic option only; production rendering uses solved cloth.
  if (project.simulation?.visualWrapAssist !== true) return result
  const heightScale = getAvatarHeightScale(project.avatar)
  if (particle.wrapMode === 'left-arm' || particle.wrapMode === 'right-arm') {
    if (result.y < 0.74 * heightScale || result.y > 1.66 * heightScale) return result
    const chestScale = Math.max(0.82, Math.min(1.24, (project.avatar?.chestCm || 96) / 96))
    const centerX = (particle.wrapMode === 'left-arm' ? -0.285 : 0.285) * chestScale
    const outerSign = particle.wrapMode === 'left-arm' ? -1 : 1
    const angle = (particle.patternU || 0) * Math.PI
    const skin = (project.simulation?.collisionMargin ?? 0.012) + (project.fabrics?.main?.thickness ?? 0.002) + 0.004
    const radius = 0.066 + skin
    const targetX = centerX + outerSign * Math.cos(angle) * radius
    const targetZ = Math.sin(angle) * radius
    result.x = THREE.MathUtils.lerp(result.x, targetX, 0.88)
    result.z = THREE.MathUtils.lerp(result.z, targetZ, 0.92)
    return result
  }
  if (!['front', 'back'].includes(particle.wrapMode)) return result
  if (result.y < 0.56 * heightScale || result.y > 1.685 * heightScale) return result
  const chestScale = Math.max(0.82, Math.min(1.24, (project.avatar?.chestCm || 96) / 96))
  const radii = getAvatarTorsoRadii(project.avatar, result.y)
  const skin = (project.simulation?.collisionMargin ?? 0.012) + (project.fabrics?.main?.thickness ?? 0.002) + 0.006
  const side = particle.collisionSideZ || 1
  const targetX = particle.patternOffsetX ?? result.x
  const normalizedX = Math.max(-0.999, Math.min(0.999, targetX / (radii.x + skin)))
  const targetZ = side * (radii.z + skin) * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX)) * shoulderSurfaceBlend(result.y, project.avatar)
  const edgeWeight = Math.min(1, Math.abs(particle.patternU || 0))
  const xContact = THREE.MathUtils.lerp(0.42, 0.78, edgeWeight)
  const zContact = THREE.MathUtils.lerp(0.90, 0.97, edgeWeight)
  result.x = THREE.MathUtils.lerp(result.x, targetX, xContact)
  result.z = THREE.MathUtils.lerp(result.z, targetZ, zContact)
  return result
}

export function syncGeometry(pieceSim, geometry, project) {
  const attribute = geometry.getAttribute('position')
  if (!attribute || attribute.count !== pieceSim.particles.length) return
  for (let index = 0; index < pieceSim.particles.length; index += 1) {
    const point = visualSurfacePosition(pieceSim.particles[index], project)
    attribute.setXYZ(index, point.x, point.y, point.z)
  }
  attribute.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
}

export function createGeometry(pieceSim) {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(pieceSim.particles.length * 3)
  const colors = new Float32Array(pieceSim.particles.length * 3)
  const uvs = new Float32Array(pieceSim.particles.length * 2)
  pieceSim.particles.forEach((particle, index) => {
    positions[index * 3] = particle.position.x
    positions[index * 3 + 1] = particle.position.y
    positions[index * 3 + 2] = particle.position.z
    colors[index * 3] = 1
    colors[index * 3 + 1] = 1
    colors[index * 3 + 2] = 1
  })
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  updateGeometryFabricUV(pieceSim, geometry, pieceSim.fabric)
  geometry.setIndex(pieceSim.faces.flat())
  geometry.computeVertexNormals()
  return geometry
}

// Remap fabric prints and yarns over the unchanged rest-pattern coordinates.
// Changing a textile image or its physical repeat must never reset a live drape.
export function updateGeometryFabricUV(pieceSim, geometry, fabric = {}) {
  const uv = geometry.getAttribute('uv')
  if (!uv || uv.count !== pieceSim.flatVertices.length) return false
  const repeatWidthCm = Math.max(0.5, Number(fabric?.texture?.repeatWidthCm ?? 20) || 20)
  const repeatHeightCm = Math.max(0.5, Number(fabric?.texture?.repeatHeightCm ?? 20) || 20)
  const grainAngle = THREE.MathUtils.degToRad(Number(pieceSim.piece.grainAngleDeg || 0))
  const cosine = Math.cos(-grainAngle)
  const sine = Math.sin(-grainAngle)
  pieceSim.flatVertices.forEach((flat, index) => {
    const grainX = flat.x * cosine - flat.y * sine
    const grainY = flat.x * sine + flat.y * cosine
    uv.setXY(index, grainX / repeatWidthCm, grainY / repeatHeightCm)
  })
  uv.needsUpdate = true
  return true
}

export function syncAnalysisColors(pieceSim, geometry, mode = 'surface') {
  const colors = geometry.getAttribute('color')
  if (!colors) return
  const cold = new THREE.Color('#4f72ff')
  const middle = new THREE.Color('#f1c84d')
  const hot = new THREE.Color('#ff4d52')
  const easeMiddle = new THREE.Color('#5bd48b')
  const color = new THREE.Color()
  for (let index = 0; index < pieceSim.particles.length; index += 1) {
    if (mode === 'surface') {
      colors.setXYZ(index, 1, 1, 1)
      continue
    }
    const particle = pieceSim.particles[index]
    if (mode === 'pressure') {
      const t = Math.min(1, particle.pressureIndex || 0)
      if (t < 0.5) color.copy(cold).lerp(middle, t * 2)
      else color.copy(middle).lerp(hot, (t - 0.5) * 2)
    } else if (mode === 'ease') {
      const ease = Math.max(0, particle.easeCm || 0)
      if (ease < 2) color.copy(hot).lerp(easeMiddle, ease / 2)
      else color.copy(easeMiddle).lerp(cold, Math.min(1, (ease - 2) / 4))
    } else {
      const strain = particle.strain || 0
      const t = Math.min(1, strain / 0.16)
      if (t < 0.5) color.copy(cold).lerp(middle, t * 2)
      else color.copy(middle).lerp(hot, (t - 0.5) * 2)
    }
    colors.setXYZ(index, color.r, color.g, color.b)
  }
  colors.needsUpdate = true
}
