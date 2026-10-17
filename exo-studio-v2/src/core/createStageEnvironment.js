import { getStagePreset } from '../data/stagePresets.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Studio stages contain hundreds of tiny bevels and floor details. Let the
// substantial vertical props cast shadows, while keeping the receiver surfaces
// and fine trim out of the shadow pass for predictable editor performance.
function configureRoomShadows(THREE, room) {
  const candidates = []
  let meshCount = 0
  let adjustedMaterials = 0
  let skippedNonStructural = 0
  const seenMaterials = new Set()
  room.updateWorldMatrix(true, true)
  room.traverse(node => {
    if (!node.isMesh || !node.geometry?.getAttribute('position')) return
    meshCount++
    node.castShadow = false
    node.receiveShadow = true
    for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
      if (!material?.isMeshStandardMaterial || seenMaterials.has(material)) continue
      seenMaterials.add(material)
      const name = (material.name || '').toLowerCase()
      // Viewer renderers use ACES tone mapping and a shared studio environment.
      // Tune only named PBR surfaces, retaining authored color/texture maps.
      if (/mirror/.test(name)) {
        material.metalness = 0.9
        material.roughness = 0.09
        material.envMapIntensity = 1.35
      } else if (/water surface/.test(name)) {
        material.metalness = 0.08
        material.roughness = 0.12
        material.envMapIntensity = 1.2
      } else if (/polished metal/.test(name)) {
        material.roughness = Math.max(0.23, material.roughness)
        material.envMapIntensity = 1.15
      } else if (/brushed brass|anodized/.test(name)) {
        material.roughness = Math.max(0.34, material.roughness)
        material.envMapIntensity = 1.05
      } else continue
      material.needsUpdate = true
      adjustedMaterials++
    }
    if (!node.visible || !node.geometry.getAttribute('position').count) return
    const meshMaterials = (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean)
    // A shadow-map pass treats even mirror and luminous artwork as opaque
    // blockers. Keep their reflection/emission visible without casting an
    // unnatural black silhouette across the garment or stage floor.
    if (meshMaterials.some(material => material.transparent || material.opacity < 0.98 ||
      /mirror|water surface|illuminated strip|emissive|light panel/i.test(material.name || ''))) {
      skippedNonStructural++
      return
    }
    // World-aligned bounds account for rotated props (e.g. reflectors and
    // foliage). Local bounding boxes misclassified these as floor trim.
    const bounds = new THREE.Box3().setFromObject(node)
    if (bounds.isEmpty()) return
    const size = bounds.getSize(new THREE.Vector3())
    // Floors and thin horizontal caps should receive, never cast; tiny trim
    // adds shadow draw calls with little visible improvement.
    if (size.y < 0.24 || Math.max(size.x, size.z) < 0.13) return
    // A full-height enclosing wall can obscure all direct garment lighting.
    // Reserve shadow casters for architectural props within the stage.
    if (Math.max(size.x, size.z) > 7 && size.y > 2.5) return
    const center = bounds.getCenter(new THREE.Vector3())
    const distance = Math.hypot(center.x, center.z)
    // Readable contact shadows around the garment matter more than massive
    // set pieces at the far end of a long runway.
    const score = size.y * Math.min(Math.max(size.x, size.z), 3) / (1 + distance * 0.18)
    candidates.push({ node, score })
  })
  candidates.sort((a, b) => b.score - a.score)
  for (const { node } of candidates.slice(0, 14)) node.castShadow = true
  return { meshCount, shadowCasters: Math.min(candidates.length, 14), adjustedMaterials, skippedNonStructural }
}

function disposeLoadedScene(scene) {
  const textures = new Set()
  scene.traverse(node => {
    node.geometry?.dispose?.()
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : []
    for (const material of materials) {
      if (!material) continue
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
      material.dispose?.()
    }
  })
  for (const texture of textures) texture.dispose?.()
}

/**
 * Build a self-contained THREE scene group in metres; avatar stands at x/z=0,
 * with the floor at y=0. Caller owns lifecycle and must dispose geometries and
 * materials by scene traversal. No external textures or borrowed meshes.
 */
export function createStageEnvironment(THREE, stageId, onReady) {
  const group = new THREE.Group()
  group.name = 'exo-stage-environment'
  group.userData.stageId = stageId || 'none'
  if (stageId === 'cathedral') {
    group.userData.stagePreset = 'cathedral'
    group.userData.source = 'User Blender scene: MIKRISTIAN_Cathedral_House.glb'
    // Keep model scale and ground orientation consistent with avatar at origin.
    const loader = new GLTFLoader()
    loader.load('/library-3d/MIKRISTIAN_Cathedral_House.glb', gltf => {
      if (group.userData.disposed) {
        disposeLoadedScene(gltf.scene)
        return
      }
      const model = gltf.scene
      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      if (size.lengthSq() === 0) {
        group.userData.loadError = 'Empty Blender room geometry'
        disposeLoadedScene(model)
        onReady?.(group)
        return
      }
      // Fit within stage bounds and put the original scene behind the avatar.
      const scale = 9.5 / Math.max(size.x, size.y, size.z)
      model.scale.setScalar(scale)
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale - 2.7)
      const details = configureRoomShadows(THREE, model)
      group.userData.meshCount = details.meshCount
      group.userData.shadowCasters = details.shadowCasters
      group.userData.adjustedMaterials = details.adjustedMaterials
      group.userData.skippedNonStructural = details.skippedNonStructural
      group.add(model)
      group.userData.loaded = true
      onReady?.(group)
    }, undefined, error => {
      if(group.userData.disposed) return
      group.userData.loadError = error?.message || 'Blender room failed to load'
      onReady?.(group)
    })
    return group
  }
  const preset = getStagePreset(stageId)
  if (!preset) return group
  group.userData.stagePreset = preset.id
  group.userData.source = preset.sceneFile
  const loader = new GLTFLoader()
  loader.load(preset.sceneFile, gltf => {
    if (group.userData.disposed) {
      disposeLoadedScene(gltf.scene)
      return
    }
    const room = gltf.scene
    room.name = `EXO Blender room ${preset.id}`
    const { meshCount: count, shadowCasters, adjustedMaterials, skippedNonStructural } = configureRoomShadows(THREE, room)
    if (!count) {
      group.userData.loadError = 'Exported room has no mesh geometry'
      disposeLoadedScene(room)
    } else {
      group.add(room)
      group.userData.loaded = true
      group.userData.meshCount = count
      group.userData.shadowCasters = shadowCasters
      group.userData.adjustedMaterials = adjustedMaterials
      group.userData.skippedNonStructural = skippedNonStructural
    }
    onReady?.(group)
  }, undefined, error => {
    if (group.userData.disposed) return
    group.userData.loadError = error?.message || 'EXO Blender room unavailable'
    onReady?.(group)
  })
  return group
}
