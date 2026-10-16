import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'

// Static, explicit triangle collision proxy built from the avatar's rendered
// geometry. This is an experimental surface-distance guard, not swept CCD.
export function createAvatarMeshCollider(avatarGroup, options = {}) {
  const maxTriangles = options.maxTriangles ?? 250000
  const meshFilter = options.meshFilter || (() => true)
  const positions = []
  const bounds = new THREE.Box3()
  let triangles = 0
  let skippedMeshes = 0
  avatarGroup.updateMatrixWorld(true)
  avatarGroup.traverse((mesh) => {
    if (!mesh.isMesh || mesh.visible === false || !meshFilter(mesh)) return
    const attr = mesh.geometry?.attributes?.position
    if (!attr) return
    // Bake the posed skin vertex into the static collision proxy. We rebuild
    // whenever the model/pose changes, not while its skeleton animates.
    if (mesh.isSkinnedMesh) mesh.skeleton?.update?.()
    const index = mesh.geometry.index
    const count = index ? index.count / 3 : attr.count / 3
    if (triangles + count > maxTriangles) { skippedMeshes++; return }
    const v = new THREE.Vector3()
    for (let i = 0; i < count * 3; i++) {
      const vertex = index ? index.getX(i) : i
      v.fromBufferAttribute(attr, vertex)
      if (mesh.isSkinnedMesh) mesh.applyBoneTransform(vertex, v)
      v.applyMatrix4(mesh.matrixWorld)
      positions.push(v.x, v.y, v.z)
      bounds.expandByPoint(v)
    }
    triangles += count
  })
  if (!triangles) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const bvh = new MeshBVH(geometry)
  return { bvh, geometry, bounds, triangles, skippedMeshes, dispose: () => geometry.dispose() }
}

// CLO exports can include layered clothing, trims, shoes, hair, and eyes.
// Using the complete scene as one closed solid makes ray parity ambiguous and
// incorrectly pushes cloth away from clothing/accessories instead of skin.
export function selectAvatarBodyMeshes(avatarGroup, model = '') {
  const meshes = []
  avatarGroup.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh) })
  if (model === 'clo-thomas') {
    const body = meshes.filter(mesh => {
      const names = [mesh.name,mesh.parent?.name,mesh.geometry?.name]
      return names.some(name => /(^|[_\s.-])body([_\s.-]|$)/i.test(name || ''))
    })
    return { meshes: body, mode: body.length ? 'body-only' : 'no-body', names: body.map(mesh => mesh.name) }
  }
  return { meshes, mode: 'all-meshes', names: meshes.map(mesh => mesh.name) }
}

export function sampleMeshContact(collider, point, options = {}) {
  const clearance = Math.max(0, options.clearance ?? 0.003)
  // Outside the narrow collision band, querying BVH nearest triangles on
  // every cloth particle costs CPU with no possible contact correction.
  const near = collider?.bvh.closestPointToPoint(point, {}, 0, options.maxDistance ?? 0.035)
  if (!near) return null
  const delta = point.clone().sub(near.point)
  const distance = delta.length()
  // Only near-surface signed side probing is used. Meshes with inconsistent
  // winding/open boundaries remain unverified: never claim full containment.
  let inside = false
  if (distance < Math.max(0.06, clearance * 4)) {
    const ray = new THREE.Ray(point.clone(), new THREE.Vector3(0.71831, 0.29412, 0.63037).normalize())
    let crossings = 0
    for (let i = 0; i < 32; i++) {
      const hit = collider.bvh.raycastFirst(ray, THREE.DoubleSide, 1e-5)
      if (!hit) break
      crossings++
      ray.origin.addScaledVector(ray.direction, hit.distance + 0.0001)
    }
    inside = crossings > 0 && crossings < 32 && crossings % 2 === 1
  }
  const intrusion = inside ? distance + clearance : clearance - distance
  return { inside, distance, intrusion, nearest: near.point,
    direction: distance > 1e-8 ? delta.multiplyScalar((inside ? -1 : 1) / distance) : new THREE.Vector3(0, 0, 0) }
}

export function correctMeshAvatarContacts(simulation, collider, options = {}) {
  const limit = Math.max(0, Math.min(0.006, options.maxCorrectionM ?? 0.002))
  const clearance = Math.max(0, options.clearance ?? 0.002)
  let checked = 0, nearby = 0, moved = 0, maximumIntrusionMm = 0
  const expandedBounds = collider.bounds.clone().expandByScalar(0.05)
  for (const piece of simulation?.pieces?.values() || []) {
    for (const particle of piece.particles) {
      if (particle.invMass <= 0 || !expandedBounds.containsPoint(particle.position)) continue
      checked++
      const contact = sampleMeshContact(collider, particle.position, { clearance, maxDistance: 0.035 })
      if (!contact) continue
      if (contact.distance < 0.025) nearby++
      if (contact.intrusion <= 0 || contact.distance > 0.035 || !limit) continue
      maximumIntrusionMm = Math.max(maximumIntrusionMm, contact.intrusion * 1000)
      const correction = Math.min(limit, contact.intrusion)
      particle.position.addScaledVector(contact.direction, correction)
      particle.previous.copy(particle.position)
      moved++
    }
  }
  return { checked, nearby, moved, maximumIntrusionMm: +maximumIntrusionMm.toFixed(2), collisionCertified: false }
}
