import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { avatarClearance, boundaryIndicesForEdge, createGeometry, getAvatarArmPose, getAvatarHeightScale, getAvatarTorsoRadii, getAvatarUpperBodyDimensions, measureAvatarSurfaceIntrusion, refreshSimulationAnalysis, syncAnalysisColors, syncGeometry, updateGeometryFabricUV } from '../core/physics.js'
import { createSimulationSession } from '../core/backends/registry.js'
import { solveWithNativeService } from '../core/backends/nativeServiceClient.js'
import { setStagedGeometry, stagedPanelPositions } from '../core/staging.js'
import { captureDrape, captureParticlePositions, measureSeamGap, restoreParticlePositions, transferDrape } from '../core/liveDrapeTransfer.js'
import { createAvatarMeshCollider, correctMeshAvatarContacts, selectAvatarBodyMeshes } from '../core/meshAvatarContact.js'
import { applyAutoFitPlacement } from '../core/autoFitPlacement.js'
import { mergeMeshFaceSelection } from '../core/meshSelection.js'
import ViewportQuickTools from './ViewportQuickTools.jsx'
import { assessNativeSolverResult } from '../core/backends/nativeServiceBackend.js'
import { makeProceduralTextileMaps } from '../core/textileProcedurals.js'
import { normalizeFabricOptics } from '../core/fabricSurfaceModel.js'
import { physicsInputFingerprint, opticalFabricFingerprint } from '../core/visualOnlyChanges.js'
import { normalizeWashSpec } from '../core/clothWashProcedurals.js'
import { washTextureImage } from '../core/clothWashImage.js'
import { tintLicensedFabricScan } from '../core/photographicScanToning.js'
import { balanceScannedRoughness, shouldBalanceFabricRoughness } from '../core/fabricPbrAppearance.js'
import { getHardwarePreset } from '../data/hardwarePresets.js'
import { createStageEnvironment } from '../core/createStageEnvironment.js'
import { createHanger3D } from './Library3DAssetPreview.jsx'
import { createHardwareButton3D } from './HardwareButton3D.js'
import { createButtonholeHardware3D } from './ButtonholeHardware3D.js'
import { createZipperHardware3D } from './ZipperHardware3D.js'

function syncSurfaceOverlay(record) {
  const position = record.meshRecord.geometry.getAttribute('position')
  const normal = record.meshRecord.geometry.getAttribute('normal')
  if (!position || !normal) return

  if (record.type === 'graphic') {
    const attribute = record.object.geometry.getAttribute('position')
    for (let index = 0; index < record.mappings.length; index += 1) {
      const mapping = record.mappings[index]
      if (!mapping) {
        attribute.setXYZ(index, 0, 0, 0)
        continue
      }
      const [aIndex, bIndex, cIndex] = mapping.indices
      const [wa, wb, wc] = mapping.weights
      const x = position.getX(aIndex) * wa + position.getX(bIndex) * wb + position.getX(cIndex) * wc
      const y = position.getY(aIndex) * wa + position.getY(bIndex) * wb + position.getY(cIndex) * wc
      const z = position.getZ(aIndex) * wa + position.getZ(bIndex) * wb + position.getZ(cIndex) * wc
      let nx = normal.getX(aIndex) * wa + normal.getX(bIndex) * wb + normal.getX(cIndex) * wc
      let ny = normal.getY(aIndex) * wa + normal.getY(bIndex) * wb + normal.getY(cIndex) * wc
      let nz = normal.getZ(aIndex) * wa + normal.getZ(bIndex) * wb + normal.getZ(cIndex) * wc
      const normalLength = Math.hypot(nx, ny, nz) || 1
      nx /= normalLength
      ny /= normalLength
      nz /= normalLength
      attribute.setXYZ(index, x + nx * record.lift, y + ny * record.lift, z + nz * record.lift)
    }
    attribute.needsUpdate = true
    record.object.geometry.computeBoundingSphere()
    return
  }

  if (record.type === 'line') {
    const attribute = record.object.geometry.getAttribute('position')
    for (let index = 0; index < record.indices.length; index += 1) {
      const vertexIndex = record.indices[index]
      attribute.setXYZ(
        index,
        position.getX(vertexIndex) + normal.getX(vertexIndex) * record.lift,
        position.getY(vertexIndex) + normal.getY(vertexIndex) * record.lift,
        position.getZ(vertexIndex) + normal.getZ(vertexIndex) * record.lift,
      )
    }
    attribute.needsUpdate = true
    if (record.object.isLine && record.object.material?.isLineDashedMaterial) record.object.computeLineDistances()
    return
  }

  if (record.type === 'button') {
    const vertexIndex = record.vertexIndex
    const surfaceNormal=new THREE.Vector3(normal.getX(vertexIndex),normal.getY(vertexIndex),normal.getZ(vertexIndex)).normalize()
    record.object.position.set(
      position.getX(vertexIndex) + normal.getX(vertexIndex) * record.lift,
      position.getY(vertexIndex) + normal.getY(vertexIndex) * record.lift,
      position.getZ(vertexIndex) + normal.getZ(vertexIndex) * record.lift,
    )
    if (record.orientToSurface) {
      record.object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),surfaceNormal)
      if (record.object.userData.angleDeg) record.object.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),THREE.MathUtils.degToRad(record.object.userData.angleDeg)),
      )
    }
    return
  }

  if (record.type === 'surface-object') {
    const vertexIndex = record.vertexIndex
    const nx = normal.getX(vertexIndex)
    const ny = normal.getY(vertexIndex)
    const nz = normal.getZ(vertexIndex)
    record.object.position.set(
      position.getX(vertexIndex) + nx * record.lift,
      position.getY(vertexIndex) + ny * record.lift,
      position.getZ(vertexIndex) + nz * record.lift,
    )
    const surfaceNormal = new THREE.Vector3(nx, ny, nz).normalize()
    const base = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormal)
    const twist = new THREE.Quaternion().setFromAxisAngle(surfaceNormal, THREE.MathUtils.degToRad(Number(record.orientationDeg || 0)))
    record.object.quaternion.copy(twist.multiply(base))
  }
}

function makeTrimLine(meshRecord, indices, material, lift = 0.0025) {
  if (!indices?.length || indices.length < 2) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(indices.length * 3), 3))
  const object = new THREE.Line(geometry, material)
  object.renderOrder = 31
  const record = { type: 'line', object, meshRecord, indices, lift }
  syncSurfaceOverlay(record)
  return record
}

function nearestFlatVertexIndex(simPiece, point) {
  let bestIndex = 0
  let bestDistance = Infinity
  for (let index = 0; index < simPiece.flatVertices.length; index += 1) {
    const candidate = simPiece.flatVertices[index]
    const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

function triangleMapping(point, a, b, c) {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
  if (Math.abs(denominator) < 1e-8) return null
  const wa = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator
  const wb = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator
  const wc = 1 - wa - wb
  if (wa < -1e-4 || wb < -1e-4 || wc < -1e-4) return null
  return [wa, wb, wc]
}

function mapFlatPointToMesh(simPiece, point) {
  for (const face of simPiece.faces) {
    const [aIndex, bIndex, cIndex] = face
    const weights = triangleMapping(
      point,
      simPiece.flatVertices[aIndex],
      simPiece.flatVertices[bIndex],
      simPiece.flatVertices[cIndex],
    )
    if (weights) return { indices: [aIndex, bIndex, cIndex], weights }
  }
  return null
}

function makeGraphicOverlay(meshRecord, graphic, segments = 12) {
  if (!graphic?.src) return null
  const count = segments + 1
  const mappings = []
  const uvs = new Float32Array(count * count * 2)
  const positions = new Float32Array(count * count * 3)
  const indices = []
  const rotation = THREE.MathUtils.degToRad(Number(graphic.rotationDeg || 0))
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  const width = Math.max(0.1, Number(graphic.widthCm ?? 20))
  const height = Math.max(0.1, Number(graphic.heightCm ?? 20))
  const centerX = Number(graphic.x ?? 0)
  const centerY = Number(graphic.y ?? 0)

  for (let row = 0; row < count; row += 1) {
    const v = row / segments
    for (let column = 0; column < count; column += 1) {
      const u = column / segments
      const localX = (u - 0.5) * width
      const localY = (0.5 - v) * height
      const point = {
        x: centerX + localX * cosine - localY * sine,
        y: centerY + localX * sine + localY * cosine,
      }
      mappings.push(mapFlatPointToMesh(meshRecord.simPiece, point))
      const uvIndex = (row * count + column) * 2
      uvs[uvIndex] = u
      uvs[uvIndex + 1] = 1 - v
    }
  }

  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const a = row * count + column
      const b = a + 1
      const c = a + count
      const d = c + 1
      if (mappings[a] && mappings[b] && mappings[c]) indices.push(a, c, b)
      if (mappings[b] && mappings[c] && mappings[d]) indices.push(b, c, d)
    }
  }
  if (!indices.length) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  const texture = new THREE.TextureLoader().load(graphic.src)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: Math.max(0, Math.min(1, Number(graphic.opacity ?? 1))),
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
  const object = new THREE.Mesh(geometry, material)
  object.renderOrder = 29
  const record = { type: 'graphic', object, meshRecord, mappings, lift: 0.0032 }
  syncSurfaceOverlay(record)
  return record
}

function makeAvatarTorsoGeometry(avatar) {
  const verticalSegments = 20
  const radialSegments = 40
  const heightScale = getAvatarHeightScale(avatar)
  const minY = 0.58 * heightScale
  const maxY = 1.49 * heightScale
  const positions = []
  const indices = []

  for (let row = 0; row <= verticalSegments; row += 1) {
    const t = row / verticalSegments
    const y = THREE.MathUtils.lerp(minY, maxY, t)
    const radii = getAvatarTorsoRadii(avatar, y)
    for (let column = 0; column < radialSegments; column += 1) {
      const angle = (column / radialSegments) * Math.PI * 2
      positions.push(Math.cos(angle) * radii.x, y, Math.sin(angle) * radii.z)
    }
  }

  for (let row = 0; row < verticalSegments; row += 1) {
    for (let column = 0; column < radialSegments; column += 1) {
      const nextColumn = (column + 1) % radialSegments
      const a = row * radialSegments + column
      const b = row * radialSegments + nextColumn
      const c = (row + 1) * radialSegments + column
      const d = (row + 1) * radialSegments + nextColumn
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function makeFabricTexture(fabric, sourceField = 'src', colorTexture = false) {
  const source = fabric?.texture?.[sourceField]
  if (!source) return null
  const wash=normalizeWashSpec(fabric.wash)
  const appliesWash=colorTexture&&wash.type!=='raw'&&wash.strength>0
  const isLicensedPhoto=colorTexture&&Boolean(fabric.texture?.scanAssetId)
  const rebalanceRoughness=sourceField==='roughnessSrc'&&shouldBalanceFabricRoughness(fabric)
  const texture = new THREE.TextureLoader().load(source,(loaded)=>{
    if (!appliesWash && !isLicensedPhoto && !rebalanceRoughness) return
    const sourceImage=loaded.image
    const size={
      width:Math.min(1024,sourceImage?.naturalWidth||sourceImage?.width||512),
      height:Math.min(1024,sourceImage?.naturalHeight||sourceImage?.height||512),
    }
    // A real scan supplies material yarn variation; tinting reproduces the
    // selected dye color rather than multiplying its original dye twice.
    const processed=rebalanceRoughness
      ? balanceScannedRoughness(sourceImage,fabric,size)
      : isLicensedPhoto
      ? tintLicensedFabricScan(sourceImage,fabric,size)
      : washTextureImage(sourceImage,wash,size)
    if (processed) {loaded.image=processed;loaded.needsUpdate=true}
  })
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.center.set(0.5, 0.5)
  texture.rotation = THREE.MathUtils.degToRad(Number(fabric.texture.rotationDeg || 0))
  // TextureLoader sets needsUpdate after the real image arrives. Marking it
  // ready here races image decoding and triggers repeated empty-map uploads.
  return texture
}

function textileMapSignature(fabric = {}) {
  const texture = fabric.texture || {}
  // Texture identity and UV placement are optical. Neither belongs in the
  // XPBD simulation key or may force a re-drape when a material is edited.
  return JSON.stringify([
    fabric.name, fabric.surfaceFamily, fabric.weaveScaleCm, fabric.colorVariation,
    fabric.thickness, texture.src, texture.normalSrc, texture.roughnessSrc,
    texture.metalnessSrc, texture.opacitySrc, texture.displacementSrc,
    texture.repeatWidthCm, texture.repeatHeightCm, texture.rotationDeg,
    fabric.wash, fabric.color,
  ])
}

function makeFabricSurfaceMaps(fabric) {
  const uploadedColor = makeFabricTexture(fabric, 'src', true)
  const uploadedNormal = makeFabricTexture(fabric, 'normalSrc')
  const uploadedRoughness = makeFabricTexture(fabric, 'roughnessSrc')
  const uploadedMetalness = makeFabricTexture(fabric, 'metalnessSrc')
  const uploadedOpacity = makeFabricTexture(fabric, 'opacitySrc')
  const uploadedDisplacement = makeFabricTexture(fabric, 'displacementSrc')
  const generated = (!uploadedColor || !uploadedNormal || !uploadedRoughness)
    ? makeProceduralTextileMaps(fabric) : null
  const maps = {
    fabricMap: uploadedColor || generated?.colorMap || null,
    normalMap: uploadedNormal || generated?.normalMap || null,
    roughnessMap: uploadedRoughness || generated?.roughnessMap || null,
    metalnessMap: uploadedMetalness,
    alphaMap: uploadedOpacity || generated?.alphaMap || null,
    displacementMap: uploadedDisplacement,
    proceduralChannels: {
      color: !uploadedColor, normal: !uploadedNormal, roughness: !uploadedRoughness,
      alpha:!uploadedOpacity&&Boolean(generated?.alphaMap),
    },
    family: generated?.family || fabric.surfaceFamily || 'uploaded-pbr',
  }
  if (uploadedColor) generated?.colorMap?.dispose?.()
  if (uploadedNormal) generated?.normalMap?.dispose?.()
  if (uploadedRoughness) generated?.roughnessMap?.dispose?.()
  if (uploadedOpacity) generated?.alphaMap?.dispose?.()
  return maps
}

function makeAvatar(project) {
  const group = new THREE.Group()
  group.name = 'avatar'
  const opacity = project.avatar?.visibility ?? 0.82
  const material = new THREE.MeshStandardMaterial({
    color: 0x6b6b6b,
    roughness: 0.7,
    metalness: 0,
    transparent: opacity < 0.99,
    opacity,
    // A semi-transparent fitting avatar should not occlude cloth in the depth
    // buffer. Otherwise nearly invisible body geometry can make intact garment
    // faces look as though they are missing or torn.
    depthWrite: opacity >= 0.99,
  })
  const hipScale = Math.max(0.82, Math.min(1.24, (project.avatar?.hipCm || 94) / 94))
  const upper = getAvatarUpperBodyDimensions(project.avatar)
  const heightScale = upper.heightScale

  const addEllipsoid = (position, scale) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24), material)
    mesh.position.set(...position)
    mesh.scale.set(...scale)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  const torso = new THREE.Mesh(makeAvatarTorsoGeometry(project.avatar), material)
  torso.castShadow = true
  torso.receiveShadow = true
  group.add(torso)
  addEllipsoid([0, upper.shoulderCenterY, 0], [upper.shoulderCapRadiusX, upper.shoulderCapRadiusY, upper.shoulderCapRadiusZ])
  addEllipsoid([0, upper.neckCenterY, 0], [upper.neckRadius, upper.neckRadiusY, upper.neckRadius])
  addEllipsoid([0, 0.78 * heightScale, 0], [0.20 * hipScale, 0.28 * heightScale, 0.14 * hipScale])
  addEllipsoid([0, 1.88 * heightScale, 0], [0.14, 0.18 * heightScale, 0.14])
  addEllipsoid([-0.105, 0.24 * heightScale, 0], [0.09, 0.48 * heightScale, 0.10])
  addEllipsoid([0.105, 0.24 * heightScale, 0], [0.09, 0.48 * heightScale, 0.10])

  const leftPose = getAvatarArmPose(project.avatar, -1)
  const armGeometry = new THREE.CapsuleGeometry(leftPose.radius, leftPose.halfLength * 2, 6, 16)
  const leftArm = new THREE.Mesh(armGeometry, material)
  leftArm.position.copy(leftPose.center)
  leftArm.rotation.z = leftPose.rotationZ
  leftArm.castShadow = true
  group.add(leftArm)
  const rightArm = leftArm.clone()
  const rightPose = getAvatarArmPose(project.avatar, 1)
  rightArm.position.copy(rightPose.center)
  rightArm.rotation.z = rightPose.rotationZ
  group.add(rightArm)

  return group
}

function disposeAvatarObject(root) {
  root?.traverse((object) => {
    object.geometry?.dispose?.()
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : []
    for (const material of materials) material?.dispose?.()
  })
}

async function upgradeAvatarVisualization(group, project, customAvatar = null, isCurrent = () => true) {
  const avatarModel = project.avatar?.model || 'makehuman-base'
  let detailed
  if (avatarModel === 'clo-thomas') {
    detailed = (await new GLTFLoader().loadAsync('/avatars/clo-thomas.glb')).scene
    detailed.name = 'clo-thomas-avatar'
  } else if (avatarModel === 'custom-export' && customAvatar?.url) {
    if (customAvatar.type === 'glb') detailed = (await new GLTFLoader().loadAsync(customAvatar.url)).scene
    else detailed = await new OBJLoader().loadAsync(customAvatar.url)
    detailed.name = 'imported-clo-avatar'
  } else if (avatarModel === 'theo' || avatarModel === 'nora') {
    const gltf = await new GLTFLoader().loadAsync(`/avatars/opensew/${avatarModel}.glb`)
    detailed = gltf.scene
    detailed.name = `${avatarModel}-rigged-fitting-avatar`
  } else {
    detailed = await new OBJLoader().loadAsync('/avatars/makehuman-base.obj')
    detailed.name = 'makehuman-detailed-avatar'
  }

  // Fast avatar switching can finish an earlier GLB/OBJ request after the new
  // avatar has been installed. Never attach a stale loaded model to the scene.
  if (!isCurrent()) {
    disposeAvatarObject(detailed)
    return null
  }

  // Skinned CLO avatars need their skeleton updated before computing world bounds.
  detailed.updateMatrixWorld(true)
  const initialBounds = new THREE.Box3().setFromObject(detailed)
  const initialSize = new THREE.Vector3()
  initialBounds.getSize(initialSize)
  const targetHeightM = Math.max(1.4, Math.min(2.2, Number(project.avatar?.heightCm ?? 180) / 100))
  const uniformScale = targetHeightM / Math.max(0.001, initialSize.y)
  if (!Number.isFinite(uniformScale) || initialSize.y < 0.001) {
    disposeAvatarObject(detailed)
    throw new Error('Avatar file contains no measurable body height')
  }
  detailed.scale.setScalar(uniformScale)
  detailed.updateMatrixWorld(true)

  const scaledBounds = new THREE.Box3().setFromObject(detailed)
  const scaledCenter = new THREE.Vector3()
  scaledBounds.getCenter(scaledCenter)
  detailed.position.set(-scaledCenter.x, -scaledBounds.min.y, -scaledCenter.z)
  detailed.updateMatrixWorld(true)
  const finalBounds = new THREE.Box3().setFromObject(detailed)
  const finalHeightM = finalBounds.max.y - finalBounds.min.y
  if (!Number.isFinite(finalHeightM) || Math.abs(finalHeightM - targetHeightM) > 0.025) {
    disposeAvatarObject(detailed)
    throw new Error(`Avatar normalization failed: ${finalHeightM} m instead of ${targetHeightM} m`)
  }

  const opacity = project.avatar?.visibility ?? 0.82
  const material = new THREE.MeshStandardMaterial({
    color: 0x777777,
    roughness: 0.68,
    metalness: 0,
    transparent: opacity < 0.99,
    opacity,
    depthWrite: opacity >= 0.99,
  })

  let meshCount = 0
  detailed.traverse((object) => {
    if (!object.isMesh) return
    meshCount += 1
    // Preserve CLO's actual skin, face, hair and shoe textures. The
    // neutral material is only for generic untextured fitting avatars.
    if (avatarModel !== 'clo-thomas') object.material = material
    object.castShadow = true
    object.receiveShadow = true
  })
  if (!meshCount) throw new Error('Detailed avatar loaded without mesh geometry')

  // The existing primitive avatar remains our collision proxy for now. Once
  // the detailed body is ready, hide those render meshes only; physics still
  // uses the measurement-driven analytic body in physics.js/native payloads.
  const fallbackChildren = [...group.children]
  for (const child of fallbackChildren) child.visible = false
  group.add(detailed)
  group.userData.visualAvatar = avatarModel
  group.userData.visualHeightM = finalHeightM
  group.userData.collisionAvatar = 'analytic-parametric'
  return detailed
}

export default function GarmentViewport({ project, ppfPreview = null, running, hasSimulated = false, resetSignal, wireframe, analysisMode = 'surface', backendId = 'browser-pbd', nativeSolveSignal = 0, nativeQuality = 'draft', exportSignal = 0, glbExportSignal = 0, renderSignal = 0, hdriUrl = '', customAvatar = null, viewportTool = 'orbit', onMeshSelection, fitCameraSignal = 0, selectedPieceId = null, onSelectPiece, showSewingGuides = true, highlightSeamId = null, arrangementSpread = 0, onMoveStagedPanel, onExportMesh, onExportGlb, onRenderStill, onStats, onNativeSolve, onToggleWireframe, onToggleSewingGuides, onChangeAnalysisMode, onChangeViewportTool }) {
  const [showAvatar, setShowAvatar] = useState(true)
  const [showFloor, setShowFloor] = useState(true)
  const [cameraPreset, setCameraPreset] = useState('perspective')
  const [selectedMeshTriangles, setSelectedMeshTriangles] = useState(null)
  const selectedMeshRef = useRef(null)
  const meshSelectionNotifyRef = useRef(onMeshSelection)
  meshSelectionNotifyRef.current = onMeshSelection
  const selectionOverlayRef = useRef(null)
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const simulationRef = useRef(null)
  const pendingDrapeRef = useRef(null)
  const backendRef = useRef(null)
  const backendSessionRef = useRef(null)
  const meshRecordsRef = useRef([])
  const ppfPreviewGroupRef = useRef(null)
  const trimRecordsRef = useRef([])
  const seamGuideRecordsRef = useRef([])
  const avatarRef = useRef(null)
  const meshAvatarColliderRef = useRef(null)
  const floorRef = useRef(null)
  const gridRef = useRef(null)
  const stageSceneRef = useRef(null)
  const hangerSceneRef = useRef(null)
  const windHelperRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const transformRef = useRef(null)
  const gizmoPivotRef = useRef(null)
  const garmentRotationRingsRef = useRef(null)
  const environmentRef = useRef(null)
  const studioEnvironmentRef = useRef(null)
  const customEnvironmentRef = useRef(null)
  const hemiLightRef = useRef(null)
  const keyLightRef = useRef(null)
  const rimLightRef = useRef(null)
  const projectRef = useRef(project)
  const toolRef = useRef(viewportTool)
  const selectedPieceRef = useRef(selectedPieceId)
  const spreadRef = useRef(arrangementSpread)
  const stagedRef = useRef(!hasSimulated)
  const stageBlendRef = useRef(0)
  const initialHemHeightRef = useRef(null)
  const stagedSimulationStartedRef = useRef(false)
  stagedRef.current = !hasSimulated
  toolRef.current = viewportTool
  selectedPieceRef.current = selectedPieceId
  spreadRef.current = arrangementSpread
  const runningRef = useRef(running)
  const wireframeRef = useRef(wireframe)
  const analysisModeRef = useRef(analysisMode)
  const onStatsRef = useRef(onStats)
  const onNativeSolveRef = useRef(onNativeSolve)
  const onExportMeshRef = useRef(onExportMesh)
  const onExportGlbRef = useRef(onExportGlb)
  const onRenderStillRef = useRef(onRenderStill)
  const onMoveStagedPanelRef = useRef(onMoveStagedPanel)
  const onSelectPieceRef = useRef(onSelectPiece)

  projectRef.current = project
  const physicsKey = physicsInputFingerprint(project)
  const fabricOpticsKey = opticalFabricFingerprint(project)
  runningRef.current = running
  wireframeRef.current = wireframe
  analysisModeRef.current = analysisMode
  onStatsRef.current = onStats
  onNativeSolveRef.current = onNativeSolve
  onExportMeshRef.current = onExportMesh
  onExportGlbRef.current = onExportGlb
  onRenderStillRef.current = onRenderStill
  onMoveStagedPanelRef.current = onMoveStagedPanel
  onSelectPieceRef.current = onSelectPiece

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const scene = new THREE.Scene()
    // CLO-like studio backdrop: a neutral grey vertical falloff, not a
    // flat black clear color. A CanvasTexture follows the camera viewport.
    const gradientCanvas = document.createElement('canvas')
    gradientCanvas.width = 8
    gradientCanvas.height = 512
    const gradientContext = gradientCanvas.getContext('2d')
    const gradient = gradientContext.createLinearGradient(0, 0, 0, 512)
    // CLO's daylight stage is shaded from darker neutral gray overhead to
    // near-white at the floor, rather than black or a saturated backdrop.
    gradient.addColorStop(0, '#919298')
    gradient.addColorStop(0.48, '#d4d5d9')
    gradient.addColorStop(1, '#f2f2f7')
    gradientContext.fillStyle = gradient
    gradientContext.fillRect(0, 0, 8, 512)
    const studioBackdrop = new THREE.CanvasTexture(gradientCanvas)
    studioBackdrop.colorSpace = THREE.SRGBColorSpace
    scene.userData.studioBackdrop = studioBackdrop
    scene.background = studioBackdrop
    scene.fog = new THREE.Fog(0xe9e9eb, 6, 16)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 30)
    const initialHeightScale = getAvatarHeightScale(projectRef.current.avatar)
    camera.position.set(0.9 * initialHeightScale, 1.55 * initialHeightScale, 4.15 * initialHeightScale)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
    rendererRef.current = renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    // Arrow-key placement is scoped to an explicitly focused 3D viewport.
    // It must not hijack 2D pattern-editor arrows or form controls.
    renderer.domElement.tabIndex = 0
    renderer.domElement.style.outline = 'none'
    mount.appendChild(renderer.domElement)

    const roomEnvironment = new RoomEnvironment()
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    environmentRef.current = pmremGenerator.fromScene(roomEnvironment, 0.04).texture
    studioEnvironmentRef.current = environmentRef.current
    scene.environment = environmentRef.current
    roomEnvironment.dispose()

    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.zoomToCursor = true
    controls.target.set(0, 1.05 * initialHeightScale, 0)
    controls.minDistance = 0.12 * initialHeightScale
    controls.maxDistance = 12 * initialHeightScale

    // DCC-style translation arrows and rotation rings, anchored at the
    // selected panel's center. The pivot transforms the actual staged mesh
    // positions, and only commits editable XYZ/rotation values on pointer up.
    const gizmoPivot = new THREE.Object3D()
    gizmoPivot.name = 'selected-pattern-transform-pivot'
    scene.add(gizmoPivot)
    gizmoPivotRef.current = gizmoPivot
    const transform = new TransformControls(camera, renderer.domElement)
    transform.size = 0.65
    transform.setSpace('world')
    transform.enabled = false
    transform.getHelper().visible = false
    scene.add(transform.getHelper())
    transformRef.current = transform

    // Unified DCC manipulator: actual XYZ translate arrows from
    // TransformControls, plus draggable three-axis rotation rings around the
    // *selected garment panel*. This is deliberately different from a camera
    // navigation widget in the top-right corner.
    const ringGroup = new THREE.Group()
    ringGroup.name = 'selected-garment-rotation-gizmo'
    ringGroup.visible = false
    scene.add(ringGroup)
    garmentRotationRingsRef.current = ringGroup
    const axisColors = { x: 0xef6967, y: 0x76d38f, z: 0x76aaff, free: 0xe9f4ff }
    const ringGeometry = new THREE.TorusGeometry(1, 0.014, 8, 120)
    const pickingGeometry = new THREE.TorusGeometry(1, 0.065, 8, 120)
    const pickRings = []
    const visualRings = []
    for (const axis of ['x', 'y', 'z', 'free']) {
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
        color: axisColors[axis], transparent: true, opacity: axis === 'free' ? 0.63 : 0.97,
        depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      }))
      ring.name = `garment-rotate-${axis}`
      ring.renderOrder = 95
      const picker = new THREE.Mesh(pickingGeometry, new THREE.MeshBasicMaterial({
        color: axisColors[axis], transparent: true, opacity: 0,
        depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      }))
      picker.name = `garment-rotate-pick-${axis}`
      picker.userData.rotationAxis = axis
      picker.renderOrder = 96
      if (axis === 'x') { ring.rotation.y = Math.PI / 2; picker.rotation.y = Math.PI / 2 }
      if (axis === 'y') { ring.rotation.x = -Math.PI / 2; picker.rotation.x = -Math.PI / 2 }
      ringGroup.add(ring, picker)
      if (axis === 'free') {
        // A slightly wider camera-facing trackball rim gives the same visual
        // separation as DCC universal gizmos without hiding the XYZ rings.
        ring.scale.setScalar(1.24)
        picker.scale.setScalar(1.24)
      }
      pickRings.push(picker)
      visualRings.push(ring)
    }
    const updateRings = () => {
      if (!ringGroup.visible) return
      ringGroup.position.copy(gizmoPivot.position)
      ringGroup.quaternion.copy(gizmoPivot.quaternion)
      const radius = 0.25
      ringGroup.scale.setScalar(radius)
      // Expose the current projected position of the real 3D pivot. This also
      // makes viewport-size-independent interaction tests possible without
      // guessing where the model happens to appear in a screenshot.
      const projected = gizmoPivot.position.clone().project(camera)
      renderer.domElement.dataset.gizmoCenterX = String((projected.x + 1) * renderer.domElement.clientWidth * 0.5)
      renderer.domElement.dataset.gizmoCenterY = String((1 - projected.y) * renderer.domElement.clientHeight * 0.5)
      const faceCamera = gizmoPivot.quaternion.clone().invert().multiply(camera.quaternion)
      for (const entry of [...visualRings, ...pickRings]) {
        if (entry.name.endsWith('-free')) entry.quaternion.copy(faceCamera)
      }
      ringGroup.updateMatrixWorld(true)
    }
    let activeRingDrag = null
    let hoveredRingAxis = null
    const ringPoint = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      // The circular Y/X rings project across the arrow handles in some
      // views. Keep an inner pointer zone reserved for translation so the
      // unified gizmo genuinely supports both actions at the same time.
      const pivotNdc = gizmoPivot.position.clone().project(camera)
      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      const projectedRadius = gizmoPivot.position.clone().addScaledVector(cameraRight, 0.25).project(camera)
      const ringRadiusPx = Math.abs(projectedRadius.x - pivotNdc.x) * bounds.width * 0.5
      const centerX = bounds.left + (pivotNdc.x + 1) * bounds.width * 0.5
      const centerY = bounds.top + (1 - pivotNdc.y) * bounds.height * 0.5
      if (Math.hypot(event.clientX - centerX, event.clientY - centerY) < ringRadiusPx * 0.60) return null
      const ndc = new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      const cast = new THREE.Raycaster()
      cast.setFromCamera(ndc, camera)
      return cast.intersectObjects(pickRings, false)[0]?.object?.userData?.rotationAxis || null
    }
    const canvasAngle = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      const screen = gizmoPivot.position.clone().project(camera)
      const px = bounds.left + ((screen.x + 1) / 2) * bounds.width
      const py = bounds.top + ((1 - screen.y) / 2) * bounds.height
      return Math.atan2(event.clientY - py, event.clientX - px)
    }
    let transformStart = null
    const canEditCloth = () => stagedRef.current || (
      !runningRef.current && backendRef.current?.id === 'browser-pbd'
    )
    const startTransform = (record) => ({
      record,
      simulated: !stagedRef.current,
      // A paused, sewn garment edits the actual PBD particles, not the old
      // flat arrangement buffer. These edits are in-session solver state;
      // reset returns to the editable flat pattern, as in CLO's simulation.
      positions: stagedRef.current
        ? record.stagedPositions.map((point) => point.clone())
        : record.simPiece.particles.map((particle) => particle.position.clone()),
      position: gizmoPivot.position.clone(),
      quaternion: gizmoPivot.quaternion.clone(),
    })
    const previewTransform = (start) => {
      if (!start || !canEditCloth()) return
      const { record, positions, position, quaternion, simulated } = start
      const rotation = gizmoPivot.quaternion.clone().multiply(quaternion.clone().invert())
      const translation = gizmoPivot.position.clone().sub(position)
      for (let index = 0; index < positions.length; index += 1) {
        const next = positions[index].clone()
          .sub(position).applyQuaternion(rotation).add(position).add(translation)
        if (simulated) {
          const particle = record.simPiece.particles[index]
          if (!particle) continue
          particle.position.copy(next)
          particle.previous.copy(next)
        } else record.stagedPositions[index].copy(next)
      }
      if (simulated) syncGeometry(record.simPiece, record.geometry, projectRef.current)
      else setStagedGeometry(record.geometry, record.stagedPositions)
      if (simulated && record.simPiece.particles.length) {
        const origin = positions[0]
        const current = record.simPiece.particles[0].position
        // The on-body gizmo really edits solver particle positions. A small
        // numeric readout on the canvas makes this physically testable without
        // making a visual screenshot the sole proof of correctness.
        renderer.domElement.dataset.simulatedParticleDeltaM = current.distanceTo(origin).toFixed(6)
      }
      updateRings()
    }
    const commitTransform = (start) => {
      if (!start) return
      if (start.simulated) {
        // This is a deliberate interactive pose adjustment on the current
        // simulation particles; resuming XPBD resolves cloth constraints.
        // Never write it into the pre-sew staging offsets by accident.
        renderer.domElement.dataset.simulatedPoseEdited = 'true'
        return
      }
      const translation = gizmoPivot.position.clone().sub(start.position)
      const changed = translation.lengthSq() > 1e-10 || gizmoPivot.quaternion.angleTo(start.quaternion) > 1e-5
      if (!changed) return
      const euler = new THREE.Euler().setFromQuaternion(gizmoPivot.quaternion, 'XYZ')
      onMoveStagedPanelRef.current?.(start.record.simPiece.id, {
        x: translation.x, y: translation.y, z: translation.z,
        rotation: {
          x: THREE.MathUtils.radToDeg(euler.x),
          y: THREE.MathUtils.radToDeg(euler.y),
          z: THREE.MathUtils.radToDeg(euler.z),
        },
      })
    }
    transform.addEventListener('dragging-changed', (event) => {
      controls.enabled = !event.value
    })
    transform.addEventListener('mouseDown', () => {
      const record = meshRecordsRef.current.find((item) => item.simPiece.id === selectedPieceRef.current)
      if (!record || !canEditCloth()) return
      transformStart = startTransform(record)
    })
    transform.addEventListener('objectChange', () => {
      previewTransform(transformStart)
    })
    transform.addEventListener('mouseUp', () => {
      if (!transformStart) return
      const start = transformStart
      transformStart = null
      commitTransform(start)
    })

    // Interactive fabric manipulation uses the actual solver particles,
    // rather than translating a disconnected display-only mesh.
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let fabricDrag = null
    const hitCloth = (event) => {
      if (spreadRef.current > 0) return null
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObjects(meshRecordsRef.current.map((record) => record.mesh), false)[0] || null
    }
    // Capture-phase selection prevents native TransformControls from stealing
    // clicks on the circular rings when translate arrows are visible too.
    const onRingDown = (event) => {
      if (event.button !== 0 || !canEditCloth() || toolRef.current !== 'transform' || !ringGroup.visible) return
      const axis = ringPoint(event)
      if (!axis) return
      const record = meshRecordsRef.current.find((item) => item.simPiece.id === selectedPieceRef.current)
      if (!record) return
      const starting = startTransform(record)
      const rotationAxis = axis === 'free'
        ? camera.getWorldDirection(new THREE.Vector3()).negate().normalize()
        : new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0)
          .applyQuaternion(starting.quaternion).normalize()
      activeRingDrag = {
        axis, start: starting, rotationAxis,
        previousAngle: canvasAngle(event), accumulatedAngle: 0,
      }
      hoveredRingAxis = axis
      renderer.domElement.dataset.rotationDragAxis = axis
      transform.enabled = false
      controls.enabled = false
      renderer.domElement.setPointerCapture(event.pointerId)
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const onFabricDown = (event) => {
      renderer.domElement.focus({ preventScroll: true })
      if (event.button !== 0 || transform.dragging || (transform.enabled && transform.axis)) return
      const hit = hitCloth(event)
      if (toolRef.current === 'mesh-select') {
        const record = hit && meshRecordsRef.current.find(item => item.mesh === hit.object)
        if (!record || !Number.isInteger(hit.faceIndex)) {
          selectedMeshRef.current = null
          setSelectedMeshTriangles(null)
          meshSelectionNotifyRef.current?.(null)
          return
        }
        const value = mergeMeshFaceSelection(selectedMeshRef.current, record.simPiece.id, hit.faceIndex, hit.face, event.shiftKey || event.metaKey)
        selectedMeshRef.current = value
        setSelectedMeshTriangles(value)
        meshSelectionNotifyRef.current?.(value)
        onSelectPieceRef.current?.(record.simPiece.id)
        renderer.domElement.dataset.meshSelectionTriangle = value?.triangleIndices.join(',') || ''
        renderer.domElement.dataset.meshSelectionPiece = record.simPiece.id
        event.preventDefault()
        return
      }
      if (!hit) {
        if (toolRef.current === 'orbit') onSelectPieceRef.current?.(null)
        return
      }
      const record = meshRecordsRef.current.find((item) => item.mesh === hit.object)
      if (!record) return
      // All 3D tools share this selection with the 2D pattern editor,
      // outliner, and Pattern/Seam inspector.
      // Even an already-selected panel should reveal its XYZ gizmo when
      // clicked in Orbit mode. Otherwise first-click appears to do nothing.
      if (selectedPieceRef.current !== record.simPiece.id || toolRef.current === 'orbit') {
        onSelectPieceRef.current?.(record.simPiece.id)
      }
      if (!['hand', 'move', 'transform'].includes(toolRef.current)) return
      if (!stagedRef.current && runningRef.current && toolRef.current !== 'hand') return
      if (stagedRef.current) {
        if (!['move', 'transform'].includes(toolRef.current)) return
        fabricDrag = {
          mode: 'arrangement',
          record,
          start: hit.point.clone(),
          original: record.stagedPositions.map((point) => point.clone()),
          center: gizmoPivot.position.clone(),
          offset: new THREE.Vector3(),
          plane: new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.point),
        }
        controls.enabled = false
        renderer.domElement.setPointerCapture(event.pointerId)
        event.preventDefault()
        return
      }
      const geometryPositions = record.geometry.getAttribute('position')
      const first = hit.face?.a ?? 0
      const indices = ['move', 'transform'].includes(toolRef.current)
        ? record.simPiece.particles.map((_, index) => index)
        : record.simPiece.particles.map((_, index) => index).filter((index) => {
          const dx = geometryPositions.getX(index) - hit.point.x
          const dy = geometryPositions.getY(index) - hit.point.y
          const dz = geometryPositions.getZ(index) - hit.point.z
          return dx * dx + dy * dy + dz * dz < 0.085 * 0.085
        })
      if (!indices.length) indices.push(first)
      fabricDrag = {
        record,
        indices,
        start: hit.point.clone(),
        center: gizmoPivot.position.clone(),
        original: indices.map((index) => record.simPiece.particles[index].position.clone()),
        // During a hand grab, keep the selected cloth particles kinematic.
        // The surrounding fabric continues solving under seam tension and
        // gravity, instead of the solver immediately pulling the grabbed
        // particles away from the cursor. Restore their masses on release.
        originalInvMass: toolRef.current === 'hand'
          ? indices.map((index) => record.simPiece.particles[index].invMass)
          : null,
        plane: new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.point),
      }
      if (fabricDrag.originalInvMass) {
        for (const index of indices) record.simPiece.particles[index].invMass = 0
        renderer.domElement.dataset.physicsHandGrab = 'active'
        renderer.domElement.dataset.physicsHandGrabSteps = '0'
      }
      controls.enabled = false
      renderer.domElement.setPointerCapture(event.pointerId)
      event.preventDefault()
    }
    const onFabricMove = (event) => {
      if (activeRingDrag) {
        const angle = canvasAngle(event)
        let delta = angle - activeRingDrag.previousAngle
        if (delta > Math.PI) delta -= 2 * Math.PI
        else if (delta < -Math.PI) delta += 2 * Math.PI
        activeRingDrag.accumulatedAngle += delta
        activeRingDrag.previousAngle = angle
        renderer.domElement.dataset.rotationPreviewDeg = String(THREE.MathUtils.radToDeg(activeRingDrag.accumulatedAngle))
        const spin = new THREE.Quaternion().setFromAxisAngle(activeRingDrag.rotationAxis, activeRingDrag.accumulatedAngle)
        gizmoPivot.quaternion.copy(spin.multiply(activeRingDrag.start.quaternion))
        gizmoPivot.updateMatrixWorld(true)
        previewTransform(activeRingDrag.start)
        event.preventDefault()
        return
      }
      if (!fabricDrag && toolRef.current === 'transform' && canEditCloth() && ringGroup.visible && !transform.dragging) {
        hoveredRingAxis = ringPoint(event)
        renderer.domElement.dataset.garmentRingHover = hoveredRingAxis || ''
        // The arrow pickers remain enabled except over the ring itself.
        transform.enabled = !hoveredRingAxis
        if (!hoveredRingAxis) {
          // TransformControls received this pointermove before the hover gate
          // reopened; explicitly refresh its native axis picker immediately.
          const bounds = renderer.domElement.getBoundingClientRect()
          transform.pointerHover(new THREE.Vector2(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
          ))
        }
        for (const entry of visualRings) {
          const active = entry.name.endsWith(`-${hoveredRingAxis}`)
          entry.material.opacity = active ? 1 : entry.name.endsWith('-free') ? 0.63 : 0.97
        }
        renderer.domElement.style.cursor = hoveredRingAxis ? 'crosshair' : ''
      }
      if (!fabricDrag) return
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const target = new THREE.Vector3()
      if (!raycaster.ray.intersectPlane(fabricDrag.plane, target)) return
      const offset = target.sub(fabricDrag.start)
      if (fabricDrag.mode === 'arrangement') {
        fabricDrag.offset.copy(offset)
        for (let index = 0; index < fabricDrag.record.stagedPositions.length; index += 1) {
          fabricDrag.record.stagedPositions[index].copy(fabricDrag.original[index]).add(offset)
        }
        setStagedGeometry(fabricDrag.record.geometry, fabricDrag.record.stagedPositions)
        if (toolRef.current === 'transform') {
          gizmoPivot.position.copy(fabricDrag.center).add(offset)
          updateRings()
        }
        event.preventDefault()
        return
      }
      fabricDrag.indices.forEach((index, i) => {
        const particle = fabricDrag.record.simPiece.particles[index]
        particle.position.copy(fabricDrag.original[i]).add(offset)
        particle.previous.copy(particle.position)
      })
      syncGeometry(fabricDrag.record.simPiece, fabricDrag.record.geometry, projectRef.current)
      if (toolRef.current === 'transform' && !stagedRef.current) {
        gizmoPivot.position.copy(fabricDrag.center).add(offset)
        updateRings()
        renderer.domElement.dataset.simulatedPoseEdited = 'true'
      }
      event.preventDefault()
    }
    const onFabricUp = (event) => {
      if (activeRingDrag) {
        const { start, accumulatedAngle } = activeRingDrag
        activeRingDrag = null
        renderer.domElement.dataset.rotationLastCommitDeg = String(THREE.MathUtils.radToDeg(accumulatedAngle))
        if (event?.type === 'pointercancel') {
          gizmoPivot.position.copy(start.position)
          gizmoPivot.quaternion.copy(start.quaternion)
          previewTransform(start)
        } else commitTransform(start)
        hoveredRingAxis = null
        renderer.domElement.dataset.rotationDragAxis = ''
        renderer.domElement.dataset.garmentRingHover = ''
        renderer.domElement.style.cursor = ''
        transform.enabled = toolRef.current === 'transform'
        controls.enabled = true
        return
      }
      if (fabricDrag?.mode === 'arrangement' && fabricDrag.offset.lengthSq() > 0.000001) {
        onMoveStagedPanelRef.current?.(fabricDrag.record.simPiece.id, {
          x: fabricDrag.offset.x,
          y: fabricDrag.offset.y,
          z: fabricDrag.offset.z,
        })
      }
      if (fabricDrag?.originalInvMass) {
        fabricDrag.indices.forEach((index, i) => {
          const particle = fabricDrag.record.simPiece.particles[index]
          particle.invMass = fabricDrag.originalInvMass[i]
          particle.previous.copy(particle.position)
        })
        renderer.domElement.dataset.physicsHandGrab = 'released'
      }
      fabricDrag = null
      controls.enabled = true
    }
    renderer.domElement.addEventListener('pointerdown', onRingDown, true)
    renderer.domElement.addEventListener('pointerdown', onFabricDown)
    renderer.domElement.addEventListener('pointermove', onFabricMove)
    renderer.domElement.addEventListener('pointerup', onFabricUp)
    renderer.domElement.addEventListener('pointercancel', onFabricUp)

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb7b7bc, 1.85)
    hemiLightRef.current = hemi
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xfffcf8, 2.6)
    keyLightRef.current = key
    key.position.set(2.5, 4.5, 3.1)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xe2ecff, 0.85)
    rimLightRef.current = rim
    rim.position.set(-3, 2, -2.5)
    scene.add(rim)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 96),
      new THREE.MeshStandardMaterial({ color: 0xebebed, roughness: 0.94, metalness: 0 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.005
    floor.receiveShadow = true
    scene.add(floor)
    floorRef.current = floor
    const grid = new THREE.GridHelper(5.5, 22, 0xaeb0b4, 0xdddddf)
    grid.position.y = 0.002
    scene.add(grid)
    gridRef.current = grid
    // Garment CAD center reference: stronger world X=0 floor axis plus a
    // vertical guide through the avatar's true world origin. Both are children
    // of the existing floor-grid toggle; neither changes cloth physics.
    const originAxis = new THREE.Group()
    originAxis.name = 'garment-world-center-axes'
    const makeAxis = (vertices, color, opacity) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(vertices.map(([x,y,z]) => new THREE.Vector3(x,y,z)))
      return new THREE.Line(geometry, new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}))
    }
    originAxis.add(makeAxis([[0,0.013,-2.75],[0,0.013,2.75]],0x8b8c91,0.52))
    originAxis.add(makeAxis([[0,0.018,0],[0,2.25,0]],0x9f9fa4,0.35))
    grid.add(originAxis)

    const resize = () => {
      const width = Math.max(1, mount.clientWidth)
      const height = Math.max(1, mount.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    let animationFrame = 0
    let lastTime = performance.now()
    let statsClock = 0
    const tick = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 1 / 20)
      lastTime = time
      const simulation = simulationRef.current
      // An active hand grab pins only nearby cloth particles. Keep the real
      // solver running so the remainder of the fabric bends and stretches in
      // response DURING the drag, not only after mouse release.
      if (simulation && runningRef.current && (!fabricDrag || Boolean(fabricDrag.originalInvMass)) && spreadRef.current === 0) {
        if (fabricDrag?.originalInvMass) {
          renderer.domElement.dataset.physicsHandGrabSteps = String(Number(renderer.domElement.dataset.physicsHandGrabSteps || 0) + 1)
        }
        const backend = backendRef.current
        const backendSession = backendSessionRef.current
        if (backend?.stepAsync) {
          backend.stepAsync(backendSession, 8).catch(() => {})
        } else {
          backend?.step?.(backendSession, dt)
        }
        if (backend?.id === 'browser-pbd' && projectRef.current.simulation?.meshAvatarContact === true && meshAvatarColliderRef.current) {
          const contact = correctMeshAvatarContacts(simulation, meshAvatarColliderRef.current)
          renderer.domElement.dataset.meshContactVerticesMoved = String(contact.moved)
          renderer.domElement.dataset.meshContactMaximumIntrusionMm = String(contact.maximumIntrusionMm)
        }
        stageBlendRef.current = Math.min(1, stageBlendRef.current + dt * 1.5)
        for (const record of meshRecordsRef.current) {
          syncGeometry(record.simPiece, record.geometry, projectRef.current)
          if (stageBlendRef.current < 1) {
            const fittedAttribute = record.geometry.getAttribute('position')
            const fitted = record.stagedPositions.map((_, index) => new THREE.Vector3(
              fittedAttribute.getX(index), fittedAttribute.getY(index), fittedAttribute.getZ(index),
            ))
            setStagedGeometry(record.geometry, record.stagedPositions, fitted, stageBlendRef.current)
          }
          syncAnalysisColors(record.simPiece, record.geometry, analysisModeRef.current)
        }
        for (const record of trimRecordsRef.current) syncSurfaceOverlay(record)
      }
      const spread = spreadRef.current
      const records = meshRecordsRef.current
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index]
        // Exploded arrangement is a rendering-only inspection transform; it
        // never alters the solver's actual particles or sewing constraints.
        const column = index % 4
        const row = Math.floor(index / 4)
        const x = (column - 1.5) * 0.33
        const z = (row % 2 === 0 ? 1 : -1) * (0.17 + row * 0.085)
        record.mesh.position.set(spread * x, 0, spread * z)
        if (record.outline) {
          record.outline.visible = (stagedRef.current || record.simPiece.id === selectedPieceRef.current) && record.mesh.visible
          if (record.outline.visible) {
            const outlinePosition = record.outline.geometry.getAttribute('position')
            const clothPosition = record.geometry.getAttribute('position')
            for (let segment = 0; segment < record.outlinePairs.length; segment += 1) {
              const [a, b] = record.outlinePairs[segment]
              outlinePosition.setXYZ(segment * 2,
                clothPosition.getX(a) + record.mesh.position.x,
                clothPosition.getY(a),
                clothPosition.getZ(a) + record.mesh.position.z)
              outlinePosition.setXYZ(segment * 2 + 1,
                clothPosition.getX(b) + record.mesh.position.x,
                clothPosition.getY(b),
                clothPosition.getZ(b) + record.mesh.position.z)
            }
            outlinePosition.needsUpdate = true
            record.outline.geometry.computeBoundingSphere()
          }
        }
      }
      for (const trim of trimRecordsRef.current) {
        if (!trim.meshRecord) continue
        if (trim.type === 'zipper-hardware') {
          trim.update()
          continue
        }
        if (trim.type === 'button' || trim.type === 'surface-object') {
          syncSurfaceOverlay(trim)
          trim.object.position.add(trim.meshRecord.mesh.position)
        } else {
          syncSurfaceOverlay(trim)
          trim.object.position.copy(trim.meshRecord.mesh.position)
        }
      }
      for (const guide of seamGuideRecordsRef.current) {
        const attribute = guide.object.geometry.getAttribute('position')
        const offsetA = guide.aRecord.mesh.position
        const offsetB = guide.bRecord.mesh.position
        for (let index = 0; index < guide.pairs.length; index += 1) {
          const pair = guide.pairs[index]
          const a = guide.aRecord.geometry.getAttribute('position')
          const b = guide.bRecord.geometry.getAttribute('position')
          const base = index * 6
          // Display the same barycentric sewing stations the solver uses,
          // rather than inventing a line between two nearest particles.
          for (const [slot, vertexPositions, origin, indices, weights] of [
            [0, a, offsetA, pair.aIndices, pair.aWeights],
            [3, b, offsetB, pair.bIndices, pair.bWeights],
          ]) {
            let x = origin.x, y = origin.y, z = origin.z
            indices.forEach((vertexIndex, positionIndex) => {
              const weight = weights[positionIndex] ?? 0
              x += vertexPositions.getX(vertexIndex) * weight
              y += vertexPositions.getY(vertexIndex) * weight
              z += vertexPositions.getZ(vertexIndex) * weight
            })
            attribute.array[base + slot] = x
            attribute.array[base + slot + 1] = y
            attribute.array[base + slot + 2] = z
          }
        }
        attribute.needsUpdate = true
        guide.object.geometry.computeBoundingSphere()
      }
      controls.update()
      updateRings()
      // Read-only QA probe of actual live scene nodes, refreshed every frame.
      // Counts instantiated child meshes rather than project/DOM annotations.
      let hardwareButtonMeshCount = 0
      let hardwareButtonGroupCount = 0
      let hardwareButtonholeMeshCount = 0
      let hardwareButtonholeGroupCount = 0
      for (const record of trimRecordsRef.current) {
        if (record.type !== 'button' || !record.object.isGroup || !record.object.parent) continue
        const isButtonhole=record.object.userData.hardware?.kind==='buttonhole'
        if(isButtonhole)hardwareButtonholeGroupCount++
        else hardwareButtonGroupCount++
        record.object.traverse(child => {
          if (child.isMesh && child.geometry?.getAttribute('position')?.count > 0 && child.parent){
            if(isButtonhole)hardwareButtonholeMeshCount++
            else hardwareButtonMeshCount++
          }
        })
      }
      renderer.domElement.dataset.hardwareButtonMeshCount = String(hardwareButtonMeshCount)
      renderer.domElement.dataset.hardwareButtonGroupCount = String(hardwareButtonGroupCount)
      renderer.domElement.dataset.hardwareButtonholeMeshCount = String(hardwareButtonholeMeshCount)
      renderer.domElement.dataset.hardwareButtonholeGroupCount = String(hardwareButtonholeGroupCount)
      const zipperHardware = trimRecordsRef.current.filter(record => record.type === 'zipper-hardware' && record.object.parent)
      renderer.domElement.dataset.hardwareZipperGroupCount = String(zipperHardware.length)
      renderer.domElement.dataset.hardwareZipperTapeMeshCount = String(zipperHardware.reduce((sum, record) => sum + record.tapeCount, 0))
      renderer.domElement.dataset.hardwareZipperToothInstanceCount = String(zipperHardware.reduce((sum, record) => sum + record.toothInstanceCount, 0))
      renderer.domElement.dataset.hardwareZipperSliderCount = String(zipperHardware.reduce((sum, record) => sum + record.sliderCount, 0))
      renderer.domElement.dataset.hardwareZipperStopCount = String(zipperHardware.reduce((sum, record) => sum + record.stopCount, 0))
      renderer.domElement.dataset.hardwareZipperEngagedToothCount = String(zipperHardware.reduce((sum, record) => sum + record.engagedToothCount, 0))
      renderer.domElement.dataset.hardwareZipperOpenToothCount = String(zipperHardware.reduce((sum, record) => sum + record.openToothCount, 0))
      renderer.domElement.dataset.hardwareZipperTerminalExtensionMm = String(zipperHardware.reduce((sum, record) => sum + record.endExtensionM * 1000, 0))
      renderer.domElement.dataset.hardwareZipperStartExtensionMm = String(zipperHardware.reduce((sum, record) => sum + record.startExtensionM * 1000, 0))
      renderer.domElement.dataset.hardwareZipperEndExtensionMm = String(zipperHardware.reduce((sum, record) => sum + record.endExtensionM * 1000, 0))
      renderer.domElement.dataset.hardwareZipperPrimarySliderFractions = zipperHardware.map(record => record.primarySliderFraction.toFixed(4)).join(',')
      renderer.domElement.dataset.hardwareZipperBottomSliderFractions = zipperHardware.map(record => record.bottomSliderFraction.toFixed(4)).join(',')
      renderer.domElement.dataset.hardwareZipperOpenStartFractions = zipperHardware.map(record => record.openStartFraction.toFixed(4)).join(',')
      renderer.domElement.dataset.hardwareZipperOpenEndFractions = zipperHardware.map(record => record.openEndFraction.toFixed(4)).join(',')
      renderer.render(scene, camera)
      statsClock += dt
      if (statsClock > 0.5 && simulation) {
        statsClock = 0
        const torsoPanels = [...simulation.pieces.values()].filter(piece => ['front', 'back'].includes(piece.id) || ['front', 'back'].includes(piece.piece?.arrangement3d?.wrap))
        const hemHeight = torsoPanels.length ? Math.min(...torsoPanels.flatMap(piece => piece.particles.map(particle => particle.position.y))) : null
        const hemRise = hemHeight === null || initialHemHeightRef.current === null ? null : hemHeight - initialHemHeightRef.current
        if (renderer.domElement) {
          renderer.domElement.dataset.simulationHemRiseM = hemRise === null ? '' : hemRise.toFixed(4)
          renderer.domElement.dataset.simulationHemQuality = hemRise === null ? 'unavailable' : hemRise > 0.08 ? 'floating-warning' : 'within-rise-threshold'
        }
        const vertexCount = [...simulation.pieces.values()].reduce((sum, piece) => sum + piece.particles.length, 0)
        const backendStats = backendRef.current?.getStats?.(backendSessionRef.current) || {}
        onStatsRef.current?.({
          vertices: vertexCount,
          constraints: simulation.constraints.length,
          seams: simulation.seamConstraints.length,
          fasteners: simulation.fastenerConstraints?.length || 0,
          treatments: simulation.treatmentConstraints?.length || 0,
          trims: simulation.trimConstraints?.length || 0,
          anchors: simulation.anchorConstraints?.length || 0,
          manualPins: simulation.manualPinConstraints?.length || 0,
          internal: simulation.internalConstraints?.length || 0,
          elapsed: simulation.elapsed,
          averageStrain: simulation.strain?.average || 0,
          maxStrain: simulation.strain?.max || 0,
          p95StrainPercent: simulation.quality?.structural?.p95StrainPercent ?? null,
          meanSeamGapMm: simulation.quality?.sewing?.meanGapMm ?? null,
          p95SeamGapMm: simulation.quality?.sewing?.p95GapMm ?? null,
          maxSeamGapMm: simulation.quality?.sewing?.maxGapMm ?? null,
          collisionCcdVerified: simulation.quality?.collision?.triangleCcdVerified === true,
          sampledPenetratingFaces: simulation.surfaceContact?.penetratingFacesAfter ?? null,
          sampledIntrusionMm: simulation.surfaceContact?.maximumIntrusionMm ?? null,
          sampledCorrectedVertices: simulation.surfaceContact?.correctedVertices ?? null,
          averageEaseCm: simulation.fit?.averageEaseCm || 0,
          averagePressureIndex: simulation.fit?.averagePressureIndex || 0,
          maxPressureIndex: simulation.fit?.maxPressureIndex || 0,
          contactRatio: simulation.fit?.contactRatio || 0,
          tightRatio: simulation.fit?.tightRatio || 0,
          looseRatio: simulation.fit?.looseRatio || 0,
          backendId: backendRef.current?.id || 'browser-pbd',
          backendFrame: backendStats.frame || 0,
          backendElapsedMs: backendStats.elapsedMs || 0,
          backendError: backendStats.serviceError || null,
          backendInitialAssembly: backendStats.initialAssembly || null,
          backendFitAssessment: backendStats.fitAssessment || null,
          hemRiseM: hemRise,
          hemHeightM: hemHeight,
          hemFloatingWarning: hemRise !== null && hemRise > 0.08,
        })
      }
      animationFrame = requestAnimationFrame(tick)
    }
    animationFrame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onRingDown, true)
      renderer.domElement.removeEventListener('pointerdown', onFabricDown)
      renderer.domElement.removeEventListener('pointermove', onFabricMove)
      renderer.domElement.removeEventListener('pointerup', onFabricUp)
      renderer.domElement.removeEventListener('pointercancel', onFabricUp)
      transform.detach()
      scene.remove(transform.getHelper())
      scene.remove(gizmoPivot)
      scene.remove(ringGroup)
      ringGeometry.dispose()
      pickingGeometry.dispose()
      for (const ring of [...visualRings, ...pickRings]) ring.material.dispose()
      garmentRotationRingsRef.current = null
      transform.dispose()
      transformRef.current = null
      gizmoPivotRef.current = null
      controls.dispose()
      customEnvironmentRef.current?.dispose?.()
      studioEnvironmentRef.current?.dispose?.()
      customEnvironmentRef.current = null
      studioEnvironmentRef.current = null
      environmentRef.current = null
      pmremGenerator.dispose()
      renderer.dispose()
      rendererRef.current = null
      renderer.domElement.remove()
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose?.()
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose?.())
        }
      })
      if (stageSceneRef.current) stageSceneRef.current.userData.disposed = true
      stageSceneRef.current = null
      hangerSceneRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      controlsRef.current = null
    }
  }, [])

  // Scene environments are decorative, reversible Three.js objects. Rebuilding
  // the stage never rebuilds the cloth solver or changes garment particles.
  useEffect(() => {
    const scene = sceneRef.current
    const canvas = rendererRef.current?.domElement
    if (!scene || !canvas) return undefined
    const stageId = project.render?.stageId || 'none'
    if (stageSceneRef.current) {
      const previous = stageSceneRef.current
      previous.userData.disposed = true
      scene.remove(previous)
      previous.traverse(node => {
        node.geometry?.dispose?.()
        const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : []
        materials.forEach(material => material.dispose?.())
      })
      stageSceneRef.current = null
    }
    const enabled = stageId !== 'none'
    if (floorRef.current) floorRef.current.visible = !enabled
    if (gridRef.current) gridRef.current.visible = !enabled
    const refreshStageCount = () => {
      if (stageSceneRef.current?.userData.disposed || !rendererRef.current?.domElement) return
      let count = 0
      stageSceneRef.current?.traverse(node => { if (node.isMesh && node.geometry?.getAttribute('position')?.count > 0) count++ })
      canvas.dataset.stageMeshCount = String(count)
      canvas.dataset.stageLoaded = String(Boolean(stageSceneRef.current?.userData.loaded))
      canvas.dataset.stageLoadError = String(stageSceneRef.current?.userData.loadError || '')
      canvas.dataset.stageStatus = !enabled ? 'none' : stageSceneRef.current?.userData.loadError ? 'error' : stageSceneRef.current?.userData.loaded && count > 0 ? 'ready' : 'loading'
      // Stage ID signals a completed selection to browser QA and UI observers.
      // Keep the pending marker until asynchronous GLB geometry has arrived.
      canvas.dataset.stageId = stageSceneRef.current ? stageId : 'none'
    }
    if (enabled) {
      const stage = createStageEnvironment(THREE, stageId, loadedStage => {
        if (stageSceneRef.current !== loadedStage) return
        refreshStageCount()
      })
      if (stage) {
        stageSceneRef.current = stage
        scene.add(stage)
      }
    }
    refreshStageCount()
    return () => {
      const current = stageSceneRef.current
      if (!current || current.userData.stageId !== stageId) return
      current.userData.disposed = true
      scene.remove(current)
      current.traverse(node => {
        node.geometry?.dispose?.()
        const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : []
        materials.forEach(material => material.dispose?.())
      })
      stageSceneRef.current = null
    }
  }, [project.render?.stageId])

  // The selected hanger is a visual display prop, independent of garment
  // simulation and all physical collision/attachment constraints.
  useEffect(() => {
    const scene = sceneRef.current
    const canvas = rendererRef.current?.domElement
    if (!scene || !canvas) return
    let cancelled = false
    const disposeHanger = object => {
      if(!object)return
      scene.remove(object)
      object.traverse(node => {
        node.geometry?.dispose?.()
        ;(Array.isArray(node.material)?node.material:[node.material]).forEach(mat=>{
          if(!mat)return
          for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'])mat[key]?.dispose?.()
          mat.dispose?.()
        })
      })
    }
    const updateDiagnostics = (preset, hanger, source='procedural') => {
      canvas.dataset.hangerPreset = hanger ? preset : 'none'
      let meshCount=0
      hanger?.traverse(node=>{if(node.isMesh)meshCount++})
      canvas.dataset.hangerMeshCount = String(meshCount)
      canvas.dataset.hangerGeometrySource = hanger ? source : 'none'
    }
    const previous = hangerSceneRef.current
    if (previous) {
      disposeHanger(previous)
      hangerSceneRef.current = null
    }
    const hangerPreset = project.render?.hangerPreset || 'none'
    if (['wood','chrome','velvet','padded','trouser-clip'].includes(hangerPreset)) {
      // Fast deterministic prop while the two actual CC0 hanger GLBs load.
      const hanger = createHanger3D(hangerPreset==='trouser-clip'?'chrome':hangerPreset)
      hanger.position.set(0, 1.55, -.3)
      hanger.scale.setScalar(.31)
      hangerSceneRef.current = hanger
      scene.add(hanger)
    }
    updateDiagnostics(hangerPreset,hangerSceneRef.current,'procedural-fallback')
    const importedUrls={
      wood:'/hangers/innerscene-shoulder-form.glb',
      'trouser-clip':'/hangers/innerscene-clip-rail.glb',
    }
    if(importedUrls[hangerPreset]){
      new GLTFLoader().load(importedUrls[hangerPreset],gltf=>{
        const imported=gltf.scene
        if(cancelled){imported.traverse(node=>{node.geometry?.dispose?.();(Array.isArray(node.material)?node.material:[node.material]).forEach(mat=>mat?.dispose?.())});return}
        const bounds=new THREE.Box3().setFromObject(imported)
        const size=bounds.getSize(new THREE.Vector3())
        if(!Number.isFinite(size.x)||size.x<.001)return
        const center=bounds.getCenter(new THREE.Vector3())
        const scale=.54/size.x
        imported.scale.setScalar(scale)
        imported.position.set(-center.x*scale,1.65-center.y*scale,-.3-center.z*scale)
        imported.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true}})
        disposeHanger(hangerSceneRef.current)
        hangerSceneRef.current=imported
        scene.add(imported)
        updateDiagnostics(hangerPreset,imported,'imported-cc0-glb')
      },undefined,()=>{if(!cancelled)updateDiagnostics(hangerPreset,hangerSceneRef.current,'procedural-fallback')})
    }
    return ()=>{cancelled=true}
  }, [project.render?.hangerPreset])

  useEffect(() => {
    const scene = sceneRef.current
    const renderer = rendererRef.current
    if (!scene || !renderer) return
    const settings = project.render || {}
    renderer.toneMappingExposure = Math.max(0.2, Math.min(4, Number(settings.exposure ?? 1.1)))
    const preset = settings.environmentPreset || 'studio'
    const lighting = {
      studio: { hemi: 1.85, key: 2.6, rim: 0.85, background: 0xd4d5d9 },
      softbox: { hemi: 2.35, key: 2.15, rim: 0.62, background: 0xe4e4e6 },
      dramatic: { hemi: 1.05, key: 3.4, rim: 1.65, background: 0xa4a5aa },
      neutral: { hemi: 1.95, key: 2.3, rim: 0.8, background: 0xf0f0f1 },
    }[preset] || { hemi: 1.85, key: 2.6, rim: 0.85, background: 0xd4d5d9 }
    if (hemiLightRef.current) hemiLightRef.current.intensity = lighting.hemi
    if (keyLightRef.current) keyLightRef.current.intensity = lighting.key
    if (rimLightRef.current) rimLightRef.current.intensity = lighting.rim
    const environment = customEnvironmentRef.current || studioEnvironmentRef.current
    scene.environment = environment || null
    if (settings.showEnvironment && hdriUrl && environment) {
      scene.background = environment
      scene.fog = null
    } else {
      scene.background = scene.userData.studioBackdrop || new THREE.Color(lighting.background)
      scene.fog = new THREE.Fog(0xe9e9eb, 6, 16)
    }
  }, [project.render, hdriUrl])

  useEffect(() => {
    const scene = sceneRef.current
    const renderer = rendererRef.current
    if (!scene || !renderer) return undefined
    if (!hdriUrl) {
      customEnvironmentRef.current?.dispose?.()
      customEnvironmentRef.current = null
      environmentRef.current = studioEnvironmentRef.current
      scene.environment = studioEnvironmentRef.current
      // The built-in lighting probe lights fabric but is not a viewable
      // photographic backdrop. Keep the grey studio gradient on screen.
      scene.background = scene.userData.studioBackdrop || scene.background
      return undefined
    }
    let cancelled = false
    let sourceTexture = null
    void (async () => {
      try {
        const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js')
        sourceTexture = await new RGBELoader().loadAsync(hdriUrl)
        if (cancelled) {
          sourceTexture.dispose()
          return
        }
        const pmrem = new THREE.PMREMGenerator(renderer)
        const nextEnvironment = pmrem.fromEquirectangular(sourceTexture).texture
        pmrem.dispose()
        sourceTexture.dispose()
        sourceTexture = null
        customEnvironmentRef.current?.dispose?.()
        customEnvironmentRef.current = nextEnvironment
        environmentRef.current = nextEnvironment
        scene.environment = nextEnvironment
        if (projectRef.current.render?.showEnvironment) scene.background = nextEnvironment
      } catch (error) {
        console.error('HDRI environment failed to load', error)
      }
    })()
    return () => {
      cancelled = true
      sourceTexture?.dispose?.()
    }
  }, [hdriUrl])

  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    const heightScale = getAvatarHeightScale(project.avatar)
    camera.position.set(0.9 * heightScale, 1.55 * heightScale, 4.15 * heightScale)
    controls.target.set(0, 1.05 * heightScale, 0)
    controls.minDistance = 0.12 * heightScale
    controls.maxDistance = 12 * heightScale
    controls.update()
  }, [project.avatar?.heightCm])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined

    pendingDrapeRef.current = hasSimulated && backendId === 'browser-pbd'
      ? captureDrape(simulationRef.current) : null
    stagedSimulationStartedRef.current = false

    for (const record of meshRecordsRef.current) {
      scene.remove(record.mesh)
      if (record.outline) {
        scene.remove(record.outline)
        record.outline.geometry.dispose()
        record.outline.material.dispose()
      }
      record.geometry.dispose()
      record.fabricMap?.dispose?.()
      record.normalMap?.dispose?.()
      record.roughnessMap?.dispose?.()
      record.metalnessMap?.dispose?.()
      record.alphaMap?.dispose?.()
      record.displacementMap?.dispose?.()
      record.material.dispose()
    }
    meshRecordsRef.current = []

    for (const record of trimRecordsRef.current) {
      scene.remove(record.object)
      record.object.traverse(child => {
        child.geometry?.dispose?.()
        const materials = Array.isArray(child.material) ? child.material : (child.material ? [child.material] : [])
        for (const material of materials) {
          material.map?.dispose?.()
          material.dispose?.()
        }
      })
    }
    trimRecordsRef.current = []

    for (const guide of seamGuideRecordsRef.current) {
      scene.remove(guide.object)
      guide.object.geometry.dispose()
      guide.object.material.dispose()
    }
    seamGuideRecordsRef.current = []

    if (avatarRef.current) {
      scene.remove(avatarRef.current)
      disposeAvatarObject(avatarRef.current)
    }
    meshAvatarColliderRef.current?.dispose?.()
    meshAvatarColliderRef.current = null
    avatarRef.current = makeAvatar(project)
    avatarRef.current.visible = showAvatar
    scene.add(avatarRef.current)
    const avatarGroup = avatarRef.current
    if (mountRef.current) {
      mountRef.current.dataset.avatarModel = project.avatar?.model || 'makehuman-base'
      mountRef.current.dataset.avatarLoadStatus = 'loading'
    }
    void upgradeAvatarVisualization(avatarGroup, project, customAvatar, () => avatarRef.current === avatarGroup).then((detailed) => {
      if (!detailed || avatarRef.current !== avatarGroup) return
      if (mountRef.current) {
        mountRef.current.dataset.avatarLoadStatus = 'ready'
        mountRef.current.dataset.avatarVisualHeightM = String(avatarGroup.userData.visualHeightM)
        mountRef.current.dataset.avatarVisibleChildren = String(avatarGroup.children.filter(child => child.visible).length)
      }
      // Build from the actual imported/displayed avatar model in its final
      // normalized world pose, not the simplified analytic placeholder.
      meshAvatarColliderRef.current?.dispose?.()
      const bodySelection = selectAvatarBodyMeshes(detailed, project.avatar?.model)
      const included = new Set(bodySelection.meshes)
      meshAvatarColliderRef.current = included.size ? createAvatarMeshCollider(detailed, {
        meshFilter: mesh => included.has(mesh),
      }) : null
      avatarGroup.userData.collisionAvatar = meshAvatarColliderRef.current && !meshAvatarColliderRef.current.skippedMeshes
        ? 'static-avatar-mesh-bvh' : 'analytic-parametric'
      if (meshAvatarColliderRef.current?.skippedMeshes) {
        meshAvatarColliderRef.current.dispose()
        meshAvatarColliderRef.current = null
      }
    }).catch((error) => {
      if (avatarRef.current === avatarGroup) {
        if (mountRef.current) mountRef.current.dataset.avatarLoadStatus = 'fallback'
        console.warn('Detailed fitting avatar failed to load; using analytic avatar fallback', error)
      }
    })

    if (windHelperRef.current) {
      scene.remove(windHelperRef.current)
      windHelperRef.current.traverse?.((object) => {
        object.geometry?.dispose?.()
        object.material?.dispose?.()
      })
      windHelperRef.current = null
    }
    if (project.simulation?.wind?.enabled) {
      const radians = THREE.MathUtils.degToRad(Number(project.simulation.wind.directionDeg ?? 0))
      const direction = new THREE.Vector3(Math.sin(radians), 0, Math.cos(radians)).normalize()
      const speed = Math.max(0, Number(project.simulation.wind.speed ?? 0))
      const length = Math.max(0.28, Math.min(0.78, 0.28 + speed * 0.035))
      const helper = new THREE.ArrowHelper(direction, new THREE.Vector3(-0.72, 0.22, 0.48), length, 0x8ea7ff, 0.10, 0.055)
      helper.name = 'wind-direction-gizmo'
      scene.add(helper)
      windHelperRef.current = helper
    }

    backendRef.current?.dispose?.(backendSessionRef.current)
    const { backend, session } = createSimulationSession(project, backendId)
    const simulation = session.simulation
    if (!simulation?.pieces) throw new Error(`Simulation backend ${backendId} does not expose an in-process mesh session`)
    backendRef.current = backend
    backendSessionRef.current = session
    simulationRef.current = simulation
    // Read-only QA instrumentation: optical edits must not trigger this
    // counter, since a cloth-session rebuild discards physical drape state.
    if (rendererRef.current?.domElement) {
      const canvas=rendererRef.current.domElement
      canvas.dataset.simulationSessionBuilds=String(Number(canvas.dataset.simulationSessionBuilds || 0)+1)
    }
    for (const simPiece of simulation.pieces.values()) {
      const geometry = createGeometry(simPiece)
      syncGeometry(simPiece, geometry, project)
      const stagedPositions = stagedPanelPositions(simPiece, project.avatar)
      if (!hasSimulated) setStagedGeometry(geometry, stagedPositions)
      const fabric = project.fabrics?.[simPiece.piece.fabricId] || project.fabrics?.main || {}
      const optics = normalizeFabricOptics(fabric)
      const wash=normalizeWashSpec(fabric.wash)
      const hasWash=wash.type!=='raw'&&wash.strength>0
      const fabricColor = new THREE.Color(hasWash||fabric.texture?.scanAssetId ? '#ffffff':fabric.color || '#d3d3d3')
      const analysisEnabled = analysisModeRef.current !== 'surface'
      const isInterfacing = simPiece.piece.generatedRole === 'interfacing'
      const surfaceMaps = makeFabricSurfaceMaps(fabric)
      const { fabricMap: albedoMap, normalMap, roughnessMap, metalnessMap, alphaMap, displacementMap } = surfaceMaps
      const normalStrength = optics.normalStrength
      const material = new THREE.MeshPhysicalMaterial({
        color: analysisEnabled ? 0xffffff : fabricColor,
        map: analysisEnabled ? null : albedoMap,
        normalMap: analysisEnabled ? null : normalMap,
        normalScale: new THREE.Vector2(normalStrength, normalStrength),
        roughnessMap: analysisEnabled ? null : roughnessMap,
        metalnessMap: analysisEnabled ? null : metalnessMap,
        alphaMap: analysisEnabled ? null : alphaMap,
        alphaTest:surfaceMaps.proceduralChannels.alpha ? .40:0,
        displacementMap: analysisEnabled ? null : displacementMap,
        displacementScale: optics.displacementMm / 1000,
        displacementBias: -optics.displacementMm / 2000,
        side: THREE.DoubleSide,
        roughness: optics.roughness,
        metalness: optics.metalness,
        sheen: optics.sheen,
        sheenRoughness: optics.sheenRoughness,
        anisotropy: optics.anisotropy,
        anisotropyRotation: optics.anisotropyRotation,
        clearcoat: optics.clearcoat,
        clearcoatRoughness: optics.clearcoatRoughness,
        // Keep garment surfaces in the transparent render queue at full
        // opacity so they draw after the semi-transparent fitting avatar.
        // This avoids the avatar visually washing over correctly draped cloth.
        transparent: true,
        opacity: isInterfacing ? 0.30 : optics.opacity,
        depthWrite: !isInterfacing && optics.opacity >= .99 && !alphaMap,
        polygonOffset: isInterfacing,
        polygonOffsetFactor: isInterfacing ? -1 : 0,
        polygonOffsetUnits: isInterfacing ? -1 : 0,
        wireframe: wireframeRef.current,
        vertexColors: analysisEnabled,
      })
      syncAnalysisColors(simPiece, geometry, analysisModeRef.current)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = `pattern-${simPiece.id}`
      mesh.userData.textileSurface = surfaceMaps.family
      mesh.userData.fiberAnisotropy = optics.anisotropy
      mesh.userData.proceduralYarnAlbedo = Boolean(!fabric.texture?.src && albedoMap)
      mesh.userData.textileNormalMap = Boolean(normalMap)
      mesh.userData.textileRoughnessMap = Boolean(roughnessMap)
      mesh.renderOrder = isInterfacing ? 24 : 20
      mesh.castShadow = !isInterfacing
      mesh.receiveShadow = true
      mesh.visible = simPiece.piece.visible3d !== false
      scene.add(mesh)
      const meshRecord = {
        simPiece, geometry, material, mesh, fabricColor,
        fabricMap: albedoMap, normalMap, roughnessMap, metalnessMap, alphaMap, displacementMap, stagedPositions,
        proceduralChannels: surfaceMaps.proceduralChannels,
        proceduralSignature: textileMapSignature(fabric),
        outline: null, outlinePairs: [],
      }
      meshRecordsRef.current.push(meshRecord)
      // Inspectable QA metadata: confirms actual THREE shader textures are
      // bound to each garment panel, not merely shown in a fabric swatch.
      if (rendererRef.current?.domElement) {
        rendererRef.current.domElement.dataset.textileMappedPanels = String(meshRecordsRef.current.filter(record => record.material.normalMap && record.material.roughnessMap).length)
        rendererRef.current.domElement.dataset.textilePanelCount = String(meshRecordsRef.current.length)
        rendererRef.current.domElement.dataset.textileDisplacementPanels = String(meshRecordsRef.current.filter(record => Boolean(record.material.displacementMap)).length)
      }

      // Accurate boundary segments from the same pattern vertex indices used
      // in 2D. A subtle outline makes staged flat panels readable in 3D.
      const outlinePairs = []
      const seenEdges = new Set()
      for (let edge = 0; edge < (simPiece.piece.points?.length || 0); edge += 1) {
        const indices = boundaryIndicesForEdge(simPiece, edge)
        for (let i = 0; i < indices.length - 1; i += 1) {
          const a = indices[i], b = indices[i + 1]
          if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) continue
          const key = a < b ? `${a}:${b}` : `${b}:${a}`
          if (seenEdges.has(key)) continue
          seenEdges.add(key)
          outlinePairs.push([a, b])
        }
      }
      if (outlinePairs.length) {
        const outlineGeometry = new THREE.BufferGeometry()
        outlineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(outlinePairs.length * 6), 3))
        const outline = new THREE.LineSegments(outlineGeometry, new THREE.LineBasicMaterial({ color: 0xa9b4db, transparent: true, opacity: 0.7, depthTest: true, depthWrite: false }))
        outline.name = `pattern-boundary-${simPiece.id}`
        outline.renderOrder = 25
        outline.visible = !hasSimulated && mesh.visible
        scene.add(outline)
        meshRecord.outlinePairs = outlinePairs
        meshRecord.outline = outline
      }

      for (const graphic of simPiece.piece.graphics || []) {
        const graphicRecord = makeGraphicOverlay(meshRecord, graphic)
        if (graphicRecord) {
          graphicRecord.object.name = `graphic-${graphic.id}`
          scene.add(graphicRecord.object)
          trimRecordsRef.current.push(graphicRecord)
        }
      }

      for (const stitch of simPiece.piece.topstitches || []) {
        const indices = boundaryIndicesForEdge(simPiece, stitch.edgeIndex)
        const trimRecord = makeTrimLine(
          meshRecord,
          indices,
          new THREE.LineDashedMaterial({
            color: stitch.color || '#b2b2b2',
            dashSize: Math.max(0.003, Number(stitch.stitchLengthMm ?? 3) / 1000),
            gapSize: 0.0025,
            transparent: true,
            opacity: 0.96,
          }),
          0.0028,
        )
        if (trimRecord) {
          trimRecord.object.name = `topstitch-${stitch.id}`
          scene.add(trimRecord.object)
          trimRecordsRef.current.push(trimRecord)
        }
      }

      for (const binding of simPiece.piece.bindings || []) {
        const indices = boundaryIndicesForEdge(simPiece, binding.edgeIndex)
        const trimRecord = makeTrimLine(
          meshRecord,
          indices,
          new THREE.LineBasicMaterial({
            color: binding.color || '#666666',
            transparent: true,
            opacity: 0.94,
          }),
          0.0036,
        )
        if (trimRecord) {
          trimRecord.object.name = `binding-${binding.id}`
          scene.add(trimRecord.object)
          trimRecordsRef.current.push(trimRecord)
        }
      }

      for (const button of simPiece.piece.buttons || []) {
        const preset = getHardwarePreset(button.hardwarePresetId)
        const buttonMesh = createHardwareButton3D(button,preset)
        const trimRecord = {
          type: 'button',
          object: buttonMesh,
          meshRecord,
          vertexIndex: nearestFlatVertexIndex(simPiece, button),
          lift: buttonMesh.userData.rearExtensionM + .00055,
          orientToSurface:true,
        }
        syncSurfaceOverlay(trimRecord)
        buttonMesh.name = `button-${button.id}`
        scene.add(buttonMesh)
        trimRecordsRef.current.push(trimRecord)
      }

      for (const buttonhole of simPiece.piece.buttonholes || []) {
        const slotMesh = createButtonholeHardware3D(buttonhole,getHardwarePreset(buttonhole.hardwarePresetId))
        slotMesh.traverse(child=>{if(child.isMesh)child.renderOrder=33})
        const trimRecord = {
          type: 'button',
          object: slotMesh,
          meshRecord,
          vertexIndex: nearestFlatVertexIndex(simPiece, buttonhole),
          lift: 0.0015,
          orientToSurface:true,
        }
        syncSurfaceOverlay(trimRecord)
        slotMesh.name = `buttonhole-${buttonhole.id}`
        scene.add(slotMesh)
        trimRecordsRef.current.push(trimRecord)
      }
    }

    for (const fastener of project.fasteners || []) {
      const type = fastener.type || 'button'
      const radius = Math.max(0.004, Number(fastener.diameterCm ?? 1.8) * 0.005)
      for (const [role, endpoint] of [['a', fastener.a], ['b', fastener.b]]) {
        if (!endpoint) continue
        const meshRecord = meshRecordsRef.current.find((record) => record.simPiece.id === endpoint.pieceId)
        if (!meshRecord) continue
        const isPrimary = role === 'a'
        const hardwareRadius = isPrimary ? radius : radius * (type === 'button' ? 0.62 : 0.82)
        const hardware = type === 'button' && isPrimary
          ? createHardwareButton3D({ ...fastener, diameterCm: hardwareRadius * 200, holes: fastener.holes ?? 4 }, getHardwarePreset(fastener.hardwarePresetId))
          : new THREE.Mesh(
            new THREE.SphereGeometry(hardwareRadius, 16, 10),
            new THREE.MeshStandardMaterial({
              color: type === 'snap' ? '#b8b8b8' : type === 'hook' ? '#8d8d8d' : '#252525',
              roughness: type === 'button' ? 0.5 : 0.28,
              metalness: type === 'button' ? 0.05 : 0.72,
              transparent: fastener.closed === false,
              opacity: fastener.closed === false ? 0.58 : 1,
            }),
          )
        hardware.castShadow = true
        hardware.renderOrder = 34
        const trimRecord = {
          type: 'button',
          object: hardware,
          meshRecord,
          vertexIndex: nearestFlatVertexIndex(meshRecord.simPiece, endpoint),
          lift: hardware.userData.rearExtensionM ? hardware.userData.rearExtensionM + .00055 : hardwareRadius * 0.82,
          orientToSurface: Boolean(hardware.userData.rearExtensionM),
        }
        syncSurfaceOverlay(trimRecord)
        hardware.name = `fastener-${fastener.id}-${role}`
        scene.add(hardware)
        trimRecordsRef.current.push(trimRecord)
      }
    }

    const renderedZipperSeams = new Set()
    const zipperRecordsById = new Map(meshRecordsRef.current.map(record => [record.simPiece.id, record]))
    for (const meshRecord of meshRecordsRef.current) {
      for (const zipper of meshRecord.simPiece.piece.zippers || []) {
        const indices = boundaryIndicesForEdge(meshRecord.simPiece, zipper.edgeIndex)
        if (indices.length < 2) continue
        const pairedSeam = (project.seams || []).find(seam => seam.id === zipper.pairedSeamId || (seam.type === 'zipper' && ((seam.a?.pieceId === meshRecord.simPiece.id && seam.a?.edgeIndex === zipper.edgeIndex) || (seam.b?.pieceId === meshRecord.simPiece.id && seam.b?.edgeIndex === zipper.edgeIndex))))
        if (pairedSeam && renderedZipperSeams.has(pairedSeam.id)) continue
        const opposite = pairedSeam && (pairedSeam.a?.pieceId === meshRecord.simPiece.id && pairedSeam.a?.edgeIndex === zipper.edgeIndex ? pairedSeam.b : pairedSeam.a)
        const opposingRecord = zipperRecordsById.get(opposite?.pieceId)
        const opposingIndices = opposingRecord && boundaryIndicesForEdge(opposingRecord.simPiece, opposite.edgeIndex)
        const hardware = createZipperHardware3D(zipper, [{ record: meshRecord, indices }, ...(opposingIndices?.length >= 2 ? [{ record: opposingRecord, indices: opposingIndices }] : [])])
        if (!hardware) continue
        if (pairedSeam) renderedZipperSeams.add(pairedSeam.id)
        scene.add(hardware.object)
        trimRecordsRef.current.push({ type: 'zipper-hardware', meshRecord, ...hardware })
      }
    }
    for (const seam of project.seams || []) {
      if (seam.type !== 'zipper' || renderedZipperSeams.has(seam.id)) continue
      const aRecord = zipperRecordsById.get(seam.a?.pieceId)
      const bRecord = zipperRecordsById.get(seam.b?.pieceId)
      if (!aRecord) continue
      const aIndices = boundaryIndicesForEdge(aRecord.simPiece, seam.a.edgeIndex)
      const bIndices = bRecord && boundaryIndicesForEdge(bRecord.simPiece, seam.b.edgeIndex)
      const hardware = createZipperHardware3D({ ...seam, sliderFraction: 1 - Number(seam.openFraction ?? 0) }, [{ record: aRecord, indices: aIndices }, ...(bIndices?.length >= 2 ? [{ record: bRecord, indices: bIndices }] : [])])
      if (!hardware) continue
      scene.add(hardware.object)
      trimRecordsRef.current.push({ type: 'zipper-hardware', meshRecord: aRecord, ...hardware })
      renderedZipperSeams.add(seam.id)
    }

    // Show the actual paired solver cutline constraints (including fractional
    // Free Sewing positions). These are not decorative guide approximations.
    const byId = new Map(meshRecordsRef.current.map((record) => [record.simPiece.id, record]))
    for (const seam of project.seams || []) {
      const aRecord = byId.get(seam.a?.pieceId)
      const bRecord = byId.get(seam.b?.pieceId)
      if (!aRecord || !bRecord) continue
      const matches = simulation.seamConstraints.filter((item) => item.seamId === seam.id && ['seam', 'seam-virtual'].includes(item.type))
      if (!matches.length) continue
      const aLookup = new Map(aRecord.simPiece.particles.map((particle, index) => [particle, index]))
      const bLookup = new Map(bRecord.simPiece.particles.map((particle, index) => [particle, index]))
      const allPairs = matches.map((item) => item.type === 'seam-virtual'
        ? {
            aIndices: item.sourceParticles.map((particle) => aLookup.get(particle)),
            aWeights: item.sourceWeights,
            bIndices: item.targetParticles.map((particle) => bLookup.get(particle)),
            bWeights: item.targetWeights,
          }
        : { aIndices: [aLookup.get(item.a)], aWeights: [1], bIndices: [bLookup.get(item.b)], bWeights: [1] })
        .filter((pair) => [...pair.aIndices, ...pair.bIndices].every(Number.isInteger))
      // Reveal the actual boundary pairing when panels are moved away from
      // the body. Three decorative stations hid most sewing relationships,
      // particularly trouser inseams and sleeve caps. Limit only unusually
      // dense seam meshes so the WebGL line overlay stays responsive.
      const maxGuides = 48
      const pairs = allPairs.length <= maxGuides ? allPairs : Array.from({ length: maxGuides }, (_, index) => allPairs[Math.round(index * (allPairs.length - 1) / (maxGuides - 1))])
      if (!pairs.length) continue
      const positions = new Float32Array(pairs.length * 6)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xf4aa61, transparent: true, opacity: highlightSeamId ? 0.9 : 0.45, depthTest: false }))
      object.name = `sewing-guide-${seam.id}`
      object.renderOrder = 45
      object.visible = showSewingGuides && (!highlightSeamId || seam.id === highlightSeamId)
      scene.add(object)
      seamGuideRecordsRef.current.push({ object, seamId: seam.id, aRecord, bRecord, pairs })
    }

    return undefined
  }, [physicsKey, project.previewSize, resetSignal, backendId, customAvatar])

  // Optical editing is a material operation, never a new physical simulation.
  // Material maps and shader uniforms update in place, so cloth positions,
  // interactive time, and the existing drape survive fabric swatch tuning.
  useEffect(() => {
    const records=meshRecordsRef.current
    if (!records.length) return
    const surfaceMode=analysisModeRef.current === 'surface'
    for (const record of records) {
      const fabric=project.fabrics?.[record.simPiece.piece.fabricId] || project.fabrics?.main || {}
      const optics=normalizeFabricOptics(fabric)
      const wash=normalizeWashSpec(fabric.wash)
      record.fabricColor.set((wash.type!=='raw'&&wash.strength>0)||fabric.texture?.scanAssetId?'#ffffff':fabric.color || '#d3d3d3')
      const material=record.material
      material.color.copy(surfaceMode ? record.fabricColor : new THREE.Color('#ffffff'))
      material.normalScale.set(optics.normalStrength,optics.normalStrength)
      material.roughness=optics.roughness
      material.metalness=optics.metalness
      material.sheen=optics.sheen
      material.sheenRoughness=optics.sheenRoughness
      material.anisotropy=optics.anisotropy
      material.anisotropyRotation=optics.anisotropyRotation
      material.clearcoat=optics.clearcoat
      material.clearcoatRoughness=optics.clearcoatRoughness
      material.displacementScale=optics.displacementMm / 1000
      material.displacementBias=-optics.displacementMm / 2000
      const isInterfacing = record.simPiece.piece.generatedRole === 'interfacing'
      material.opacity = isInterfacing ? .30 : optics.opacity
      material.depthWrite = !isInterfacing && optics.opacity >= .99 && !record.alphaMap

      const nextSignature=textileMapSignature(fabric)
      if (nextSignature!==record.proceduralSignature) {
        const replacement=makeFabricSurfaceMaps(fabric)
        record.fabricMap?.dispose?.()
        record.normalMap?.dispose?.()
        record.roughnessMap?.dispose?.()
        record.metalnessMap?.dispose?.()
        record.alphaMap?.dispose?.()
        record.displacementMap?.dispose?.()
        record.fabricMap=replacement.fabricMap
        record.normalMap=replacement.normalMap
        record.roughnessMap=replacement.roughnessMap
        record.metalnessMap=replacement.metalnessMap
        record.alphaMap=replacement.alphaMap
        record.displacementMap=replacement.displacementMap
        record.proceduralChannels=replacement.proceduralChannels
        record.mesh.userData.textileSurface=replacement.family
        updateGeometryFabricUV(record.simPiece,record.geometry,fabric)
        record.proceduralSignature=nextSignature
      }
      material.map=surfaceMode ? record.fabricMap : null
      material.normalMap=surfaceMode ? record.normalMap : null
      material.roughnessMap=surfaceMode ? record.roughnessMap : null
      material.metalnessMap=surfaceMode ? record.metalnessMap : null
      material.alphaMap=surfaceMode ? record.alphaMap : null
      material.alphaTest=surfaceMode&&record.proceduralChannels.alpha ? .40 : 0
      material.displacementMap=surfaceMode ? record.displacementMap : null
      material.depthWrite = !isInterfacing && optics.opacity >= .99 && !record.alphaMap
      material.needsUpdate=true
      record.mesh.userData.fiberAnisotropy=optics.anisotropy
    }
    if (rendererRef.current?.domElement) {
      rendererRef.current.domElement.dataset.textileMappedPanels = String(records.filter(record => Boolean(record.material.normalMap && record.material.roughnessMap)).length)
      rendererRef.current.domElement.dataset.textileDisplacementPanels = String(records.filter(record => Boolean(record.material.displacementMap)).length)
    }
  }, [fabricOpticsKey,physicsKey])

  useEffect(() => {
    const transform = transformRef.current
    const pivot = gizmoPivotRef.current
    const rotationRings = garmentRotationRingsRef.current
    for (const record of meshRecordsRef.current) {
      const selected = record.simPiece.id === selectedPieceId
      record.material.emissive.set(selected ? '#ffed1c' : '#000000')
      record.material.emissiveIntensity = selected ? 0.22 : 0
      if (record.outline) {
        record.outline.material.color.set(selected ? '#fff127' : '#a9b4db')
        record.outline.material.opacity = selected ? 1 : 0.7
        // CLO-style selected panel outline must remain legible even against
        // dark materials and where the cloth folds away from the camera.
        record.outline.material.depthTest = !selected
        record.outline.renderOrder = selected ? 55 : 25
        record.outline.visible = record.mesh.visible && (!hasSimulated || selected)
      }
    }
    if (!transform || !pivot || transform.dragging) return
    const record = meshRecordsRef.current.find((item) => item.simPiece.id === selectedPieceId && item.mesh.visible)
    const canEditPose = hasSimulated && !running && backendId === 'browser-pbd'
    if (!record || (hasSimulated && !canEditPose) || !['move', 'rotate', 'transform'].includes(viewportTool)) {
      transform.detach()
      transform.enabled = false
      transform.getHelper().visible = false
      if (rotationRings) rotationRings.visible = false
      return
    }
    transform.setMode(viewportTool === 'rotate' ? 'rotate' : 'translate')
    transform.setSpace(viewportTool === 'rotate' ? 'local' : 'world')
    const center = hasSimulated
      ? new THREE.Box3().setFromBufferAttribute(record.geometry.getAttribute('position')).getCenter(new THREE.Vector3())
      : new THREE.Box3().setFromPoints(record.stagedPositions).getCenter(new THREE.Vector3())
    pivot.position.copy(center)
    const angles = record.simPiece.piece.arrangement3d || {}
    pivot.rotation.set(...(hasSimulated
      ? [0, 0, 0, 'XYZ']
      : [
          THREE.MathUtils.degToRad(Number(angles.stagingRotationX || 0)),
          THREE.MathUtils.degToRad(Number(angles.stagingRotationY || 0)),
          THREE.MathUtils.degToRad(Number(angles.stagingRotationZ || 0)),
          'XYZ',
        ]))
    pivot.updateMatrixWorld(true)
    transform.attach(pivot)
    transform.enabled = true
    transform.getHelper().visible = true
    if (rotationRings) {
      rotationRings.position.copy(center)
      rotationRings.quaternion.copy(pivot.quaternion)
      rotationRings.visible = viewportTool === 'transform'
    }
  }, [selectedPieceId, viewportTool, hasSimulated, running, backendId, project.revision, project.previewSize, resetSignal])

  useEffect(() => {
    const scene = sceneRef.current
    const prior = selectionOverlayRef.current
    if (prior && scene) {
      scene.remove(prior)
      prior.geometry.dispose()
      prior.material.dispose()
      selectionOverlayRef.current = null
    }
    if (!scene || viewportTool !== 'mesh-select' || !selectedMeshTriangles) return
    const record = meshRecordsRef.current.find(item => item.simPiece.id === selectedMeshTriangles.pieceId)
    if (!record) return
    const vertices = record.geometry.getAttribute('position')
    const positions = []
    for (const index of selectedMeshTriangles.triangleIndices) {
      const face = record.simPiece.faces?.[index]
      if (!face || !face.every(i => i >= 0 && i < record.simPiece.particles.length)) continue
      for (const localIndex of face) positions.push(vertices.getX(localIndex), vertices.getY(localIndex), vertices.getZ(localIndex))
    }
    if (!positions.length) return
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const material = new THREE.MeshBasicMaterial({ color: 0xffe137, side: THREE.DoubleSide, transparent: true, opacity: 0.75, depthTest: false })
    const marker = new THREE.Mesh(geometry, material)
    marker.name = 'selected-cloth-mesh-triangle'
    marker.renderOrder = 95
    scene.add(marker)
    selectionOverlayRef.current = marker
    return () => {
      if (selectionOverlayRef.current === marker) selectionOverlayRef.current = null
      scene.remove(marker)
      geometry.dispose()
      material.dispose()
    }
  }, [viewportTool, selectedMeshTriangles, project.revision, project.previewSize, resetSignal])

  useEffect(() => {
    if (!hasSimulated) {
      stagedSimulationStartedRef.current = false
      stageBlendRef.current = 0
      const canvas = rendererRef.current?.domElement
      if (canvas) {
        canvas.dataset.simulatedPoseEdited = ''
        canvas.dataset.simulatedParticleDeltaM = ''
      }
      for (const record of meshRecordsRef.current) setStagedGeometry(record.geometry, record.stagedPositions)
      return
    }
    if (stagedSimulationStartedRef.current) return
    stagedSimulationStartedRef.current = true
    // Before sewing, a user may place a panel a few centimeters wrong or
    // leave it far outside the body. Pulling every *flat* staged vertex into
    // the physical solver makes stiff seam links rocket panels through the
    // avatar and can leave the finished hem floating upward. In automatic
    // fitting, solve from the avatar-size-aware canonical dressing pose and
    // animate the moved panels toward that pose. The editable 2D patterns,
    // seam graph and physical rest lengths remain unchanged.
    const autoFitPlacement = projectRef.current?.simulation?.autoFitPlacement !== false
    if (rendererRef.current?.domElement) {
      rendererRef.current.domElement.dataset.autoFitPlacement = autoFitPlacement ? 'correcting' : 'manual'
    }
    if (backendId === 'browser-pbd') {
      if (autoFitPlacement) {
        // Keep the original manually arranged panels visible for the initial
        // dressing transition, but never use their distant, unsewn coordinates
        // as the solver's first physical state.
        let correctedDistanceM = 0
        let retainedDistanceM = 0
        for (const record of meshRecordsRef.current) {
          const adjustment = applyAutoFitPlacement(record.simPiece, record.simPiece.piece.arrangement3d)
          correctedDistanceM += adjustment.correctedMagnitudeM
          retainedDistanceM += adjustment.appliedMagnitudeM
        }
        const beforeIntrusion = measureAvatarSurfaceIntrusion(simulationRef.current, projectRef.current.avatar)
        const beforeSeams = measureSeamGap(simulationRef.current)
        const originalPose = captureParticlePositions(simulationRef.current)
        const transferred = transferDrape(pendingDrapeRef.current, simulationRef.current, 0.035, (particle, original) => {
          const clearance = avatarClearance(particle.position, projectRef.current.avatar, particle)
          const originalClearance = avatarClearance(new THREE.Vector3(original.x, original.y, original.z), projectRef.current.avatar, particle)
          return Number.isFinite(clearance) && clearance >= Math.min(-0.0005, originalClearance - 0.0005)
        })
        let afterIntrusion = measureAvatarSurfaceIntrusion(simulationRef.current, projectRef.current.avatar)
        let afterSeams = measureSeamGap(simulationRef.current)
        // Accept only a transfer that does not worsen existing face intrusions
        // or reopen seams materially. Falling back to the safe initial pose
        // keeps simulation alive and lets the solver settle normally.
        const worsenedFaces = afterIntrusion.penetratingFaces > beforeIntrusion.penetratingFaces
        const worsenedDepth = afterIntrusion.maximumIntrusionMm > beforeIntrusion.maximumIntrusionMm + 0.5
        const worsenedSeams = beforeSeams.pairs && afterSeams.pairs &&
          (afterSeams.meanMm > beforeSeams.meanMm + 2 || afterSeams.maxMm > beforeSeams.maxMm + 5)
        const rejected = Boolean(worsenedFaces || worsenedDepth || worsenedSeams)
        if (rejected) {
          restoreParticlePositions(originalPose)
          afterIntrusion = beforeIntrusion
          afterSeams = beforeSeams
        }
        pendingDrapeRef.current = null
        if (rendererRef.current?.domElement) {
          rendererRef.current.domElement.dataset.liveDrapeTransferredVertices = String(transferred.transferred)
          rendererRef.current.domElement.dataset.liveDrapeRejectedVertices = String(transferred.skipped)
          rendererRef.current.domElement.dataset.liveDrapeIntrudingFacesBefore = String(beforeIntrusion.penetratingFaces)
          rendererRef.current.domElement.dataset.liveDrapeIntrudingFacesAfter = String(afterIntrusion.penetratingFaces)
          rendererRef.current.domElement.dataset.liveDrapeRejectedPose = String(rejected)
          rendererRef.current.domElement.dataset.liveDrapeSeamGapMm = afterSeams.meanMm.toFixed(2)
        }
        if (rendererRef.current?.domElement) {
          rendererRef.current.domElement.dataset.autoFitCorrectedDistanceM = correctedDistanceM.toFixed(4)
          rendererRef.current.domElement.dataset.autoFitRetainedUserHintM = retainedDistanceM.toFixed(4)
        }
        stageBlendRef.current = 0
      } else {
        for (const record of meshRecordsRef.current) {
          record.simPiece.particles.forEach((particle, index) => {
            const initial = record.stagedPositions[index]
            if (!initial) return
            particle.position.copy(initial)
            particle.previous.copy(initial)
          })
          setStagedGeometry(record.geometry, record.stagedPositions)
        }
        stageBlendRef.current = 1
      }
      const torsoPanels = [...simulationRef.current.pieces.values()].filter(piece => ['front', 'back'].includes(piece.id) || ['front', 'back'].includes(piece.piece?.arrangement3d?.wrap))
      initialHemHeightRef.current = torsoPanels.length ? Math.min(...torsoPanels.flatMap(piece => piece.particles.map(particle => particle.position.y))) : null
    }
  }, [hasSimulated, resetSignal, backendId])

  useEffect(() => {
    for (const guide of seamGuideRecordsRef.current) {
      guide.object.visible = showSewingGuides && (!highlightSeamId || guide.seamId === highlightSeamId)
      guide.object.material.opacity = highlightSeamId ? 0.92 : 0.45
    }
  }, [showSewingGuides, highlightSeamId])

  useEffect(() => {
    for (const record of meshRecordsRef.current) record.material.wireframe = Boolean(wireframe)
  }, [wireframe])

  useEffect(() => {
    if (avatarRef.current) avatarRef.current.visible = showAvatar
  }, [showAvatar, project.revision, customAvatar])

  useEffect(() => {
    if (floorRef.current) floorRef.current.visible = showFloor
    if (gridRef.current) gridRef.current.visible = showFloor
  }, [showFloor])

  const changeCamera = (view) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    const scale = getAvatarHeightScale(project.avatar)
    const views = {
      front: [0, 1.5, 4.15], back: [0, 1.5, -4.15],
      left: [-4.15, 1.5, 0], right: [4.15, 1.5, 0],
      perspective: [0.9, 1.55, 4.15], top: [0.001, 5.25, 0],
    }
    const p = views[view] || views.perspective
    camera.position.set(p[0] * scale, p[1] * scale, p[2] * scale)
    controls.target.set(0, 1.05 * scale, 0)
    camera.lookAt(controls.target)
    controls.update()
    setCameraPreset(view)
  }

  useEffect(() => {
    if (fitCameraSignal > 0) changeCamera('perspective')
  }, [fitCameraSignal])

  useEffect(() => {
    if (!nativeSolveSignal || !simulationRef.current) return undefined
    const controller = new AbortController()
    let active = true
    onNativeSolveRef.current?.({ status: 'solving' })

    const solve = async () => {
      try {
        const response = await solveWithNativeService(projectRef.current, {
          frames: 60,
          quality: nativeQuality,
          experimentalSewFirst:projectRef.current.simulation?.experimentalNativeSewFirst === true,
          signal: controller.signal,
        })
        if (!active) return
        const simulation = simulationRef.current
        const backend = backendRef.current
        const session = backendSessionRef.current
        if (backend?.adoptResult && session) {
          backend.adoptResult(session, response.result, response.elapsedMs)
        } else {
          for (const solvedPiece of response.result?.pieces || []) {
            const simPiece = simulation?.pieces?.get(solvedPiece.id)
            if (!simPiece || solvedPiece.vertices?.length !== simPiece.particles.length) {
              throw new Error(`Native solver topology mismatch for ${solvedPiece.id}`)
            }
            for (let index = 0; index < simPiece.particles.length; index += 1) {
              const vertex = solvedPiece.vertices[index]
              if (!vertex?.every?.(Number.isFinite)) throw new Error(`Native solver returned invalid vertex data for ${solvedPiece.id}`)
              simPiece.particles[index].position.set(vertex[0], vertex[1], vertex[2])
              simPiece.particles[index].previous.copy(simPiece.particles[index].position)
            }
          }
          simulation.elapsed = Number(response.result?.frames || 60) / 60
          refreshSimulationAnalysis(simulation, projectRef.current)
        }
        for (const record of meshRecordsRef.current) {
          syncGeometry(record.simPiece, record.geometry, projectRef.current)
          syncAnalysisColors(record.simPiece, record.geometry, analysisModeRef.current)
        }
        for (const record of trimRecordsRef.current) syncSurfaceOverlay(record)
        onNativeSolveRef.current?.({
          status: 'done',
          elapsedMs: response.elapsedMs,
          stats: response.result?.stats || {},
          payload: response.payload || {},
          fitAssessment: assessNativeSolverResult(response.result),
          fitTrajectory: response.result?.fitTrajectory || null,
        })
      } catch (error) {
        if (!active || error?.name === 'AbortError') return
        onNativeSolveRef.current?.({ status: 'error', error: error.message || String(error) })
      }
    }
    solve()
    return () => {
      active = false
      controller.abort()
    }
  }, [nativeSolveSignal])

  useEffect(() => {
    const analysisEnabled = analysisMode !== 'surface'
    for (const record of meshRecordsRef.current) {
      syncAnalysisColors(record.simPiece, record.geometry, analysisMode)
      record.material.vertexColors = analysisEnabled
      record.material.color.copy(analysisEnabled ? new THREE.Color(0xffffff) : record.fabricColor)
      record.material.map = analysisEnabled ? null : record.fabricMap
      record.material.normalMap = analysisEnabled ? null : record.normalMap
      record.material.roughnessMap = analysisEnabled ? null : record.roughnessMap
      record.material.metalnessMap = analysisEnabled ? null : record.metalnessMap
      record.material.alphaMap = analysisEnabled ? null : record.alphaMap
      record.material.displacementMap = analysisEnabled ? null : record.displacementMap
      record.material.needsUpdate = true
    }
  }, [analysisMode])

  // ZOZO's saved Metal frames are an inspectable overlay, not a replacement
  // for the editable XPBD cloth, 2D patterns, or their rest-state geometry.
  // The preview mesh is constructed from PPF's preserved vertex-index map.
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined
    const old = ppfPreviewGroupRef.current
    if (old) {
      scene.remove(old)
      old.traverse(object => {
        object.geometry?.dispose?.()
        object.material?.dispose?.()
      })
      ppfPreviewGroupRef.current = null
    }
    for (const record of meshRecordsRef.current) {
      record.mesh.visible = record.simPiece.piece.visible3d !== false
    }
    if (!ppfPreview) {
      for (const record of meshRecordsRef.current) if (record.outline) record.outline.visible = !hasSimulated && record.mesh.visible
      return undefined
    }
    if (ppfPreview.format !== 'garment-studio.ppf-preview.v1' || !Array.isArray(ppfPreview.pieces)) return undefined
    const byId = new Map(meshRecordsRef.current.map(record => [record.simPiece.id, record]))
    const group = new THREE.Group()
    group.name = `ZOZO_PPF_${ppfPreview.accepted ? 'validated' : 'experimental'}`
    for (const piece of ppfPreview.pieces) {
      const source = byId.get(piece.id)
      if (!source || !Array.isArray(piece.vertices) || !Array.isArray(piece.faces) || piece.vertices.length !== source.simPiece.particles.length) continue
      if (!piece.vertices.every(vertex => Array.isArray(vertex) && vertex.length === 3 && vertex.every(Number.isFinite))) continue
      if (!piece.faces.every(face => Array.isArray(face) && face.length === 3 && face.every(index => Number.isInteger(index) && index >= 0 && index < piece.vertices.length))) continue
      const geometry = source.geometry.clone()
      const positions = geometry.getAttribute('position')
      for (let i = 0; i < piece.vertices.length; i += 1) positions.setXYZ(i, ...piece.vertices[i])
      geometry.setIndex(piece.faces.flat())
      positions.needsUpdate = true
      geometry.computeVertexNormals()
      geometry.computeBoundingSphere()
      const material = source.material.clone()
      material.wireframe = false
      if (!ppfPreview.accepted) {
        material.color.set('#dba877')
        material.map = null
        material.emissive.set('#734222')
        material.emissiveIntensity = 0.08
      }
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = `ppf-preview-${piece.id}`
      mesh.renderOrder = 35
      mesh.userData.ppfValidated = Boolean(ppfPreview.accepted)
      group.add(mesh)
      source.mesh.visible = false
      if (source.outline) source.outline.visible = false
    }
    scene.add(group)
    ppfPreviewGroupRef.current = group
    const canvas = rendererRef.current?.domElement
    if (canvas) {
      canvas.dataset.ppfPreviewStatus = ppfPreview.accepted ? 'validated' : 'experimental'
      canvas.dataset.ppfPreviewFrame = String(ppfPreview.frame)
      canvas.dataset.ppfPreviewMeshes = String(group.children.length)
    }
    return () => {
      if (ppfPreviewGroupRef.current === group) ppfPreviewGroupRef.current = null
      scene.remove(group)
      group.traverse(object => {
        object.geometry?.dispose?.()
        object.material?.dispose?.()
      })
      for (const record of meshRecordsRef.current) {
        record.mesh.visible = record.simPiece.piece.visible3d !== false
        if (record.outline) record.outline.visible = !hasSimulated && record.mesh.visible
      }
      if (canvas) {
        delete canvas.dataset.ppfPreviewStatus
        delete canvas.dataset.ppfPreviewFrame
        delete canvas.dataset.ppfPreviewMeshes
      }
    }
  }, [ppfPreview, project.revision, project.previewSize, resetSignal, backendId])

  useEffect(() => {
    if (!exportSignal || !meshRecordsRef.current.length || !onExportMeshRef.current) return
    const rows = [
      '# Garment Studio OBJ',
      '# Units: meters',
      `# Project: ${projectRef.current?.name || 'Untitled'}`,
    ]
    let vertexOffset = 1
    for (const record of meshRecordsRef.current) {
      const position = record.geometry.getAttribute('position')
      const index = record.geometry.getIndex()
      rows.push(`o ${String(record.simPiece.piece.name || record.simPiece.id).replace(/\s+/g, '_')}`)
      for (let i = 0; i < position.count; i += 1) {
        rows.push(`v ${position.getX(i).toFixed(6)} ${position.getY(i).toFixed(6)} ${position.getZ(i).toFixed(6)}`)
      }
      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          rows.push(`f ${vertexOffset + index.getX(i)} ${vertexOffset + index.getX(i + 1)} ${vertexOffset + index.getX(i + 2)}`)
        }
      } else {
        for (let i = 0; i < position.count; i += 3) rows.push(`f ${vertexOffset + i} ${vertexOffset + i + 1} ${vertexOffset + i + 2}`)
      }
      vertexOffset += position.count
    }
    onExportMeshRef.current(rows.join('\n'))
  }, [exportSignal])

  useEffect(() => {
    if (!glbExportSignal || !meshRecordsRef.current.length || !onExportGlbRef.current) return
    let cancelled = false
    const group = new THREE.Group()
    group.name = String(projectRef.current?.name || 'Garment').replace(/\s+/g, '_')
    for (const record of meshRecordsRef.current) {
      const mesh = new THREE.Mesh(record.geometry.clone(), record.material.clone())
      mesh.name = String(record.simPiece.piece.name || record.simPiece.id).replace(/\s+/g, '_')
      group.add(mesh)
    }
    const dispose = () => group.traverse((object) => {
      object.geometry?.dispose?.()
      object.material?.dispose?.()
    })
    void (async () => {
      try {
        // GLB export is an infrequent production action, so keep the exporter
        // out of the initial CAD bundle and load it only when requested.
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
        if (cancelled) return dispose()
        const exporter = new GLTFExporter()
        exporter.parse(
          group,
          (result) => {
            if (!cancelled) onExportGlbRef.current?.(result)
            dispose()
          },
          (error) => {
            console.error('GLB export failed', error)
            dispose()
          },
          { binary: true, onlyVisible: true, trs: false },
        )
      } catch (error) {
        console.error('GLB exporter failed to load', error)
        dispose()
      }
    })()
    return () => { cancelled = true }
  }, [glbExportSignal])

  useEffect(() => {
    if (!renderSignal || !onRenderStillRef.current) return
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    const mount = mountRef.current
    if (!renderer || !scene || !camera || !mount) return
    const settings = projectRef.current.render || {}
    const width = Math.max(512, Math.min(6144, Math.round(Number(settings.widthPx ?? 2048))))
    const height = Math.max(512, Math.min(6144, Math.round(Number(settings.heightPx ?? 2560))))
    const oldSize = renderer.getSize(new THREE.Vector2())
    const oldPixelRatio = renderer.getPixelRatio()
    const oldAspect = camera.aspect
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    const dataUrl = renderer.domElement.toDataURL('image/png')
    renderer.setPixelRatio(oldPixelRatio)
    renderer.setSize(oldSize.x, oldSize.y, false)
    camera.aspect = oldAspect
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    onRenderStillRef.current({ dataUrl, width, height })
  }, [renderSignal])

  return (
    <div className="viewport-shell">
      <ViewportQuickTools dimension="3d" activeTool={viewportTool} onChangeTool={onChangeViewportTool}/>
      <div className="workspace-head viewport-head">
        <div>
          <strong>3D GARMENT</strong>
          <span>{!hasSimulated ? 'FLAT 3D ARRANGEMENT' : running ? 'LIVE SIMULATION' : 'SIMULATION PAUSED'}</span>
        </div>
        <div className={`sim-indicator ${running ? 'active' : ''}`}><i />{!hasSimulated ? 'PRE-SEW' : running ? 'SOLVING' : 'PAUSED'}</div>
      </div>
      <div ref={mountRef} className="three-mount" data-selected-piece={selectedPieceId || ''} data-transform-mode={viewportTool} data-gizmo-location="selected-cloth-panel" data-simulation-pose-editable={hasSimulated && !running && backendId === 'browser-pbd' ? 'true' : 'false'} />
      {analysisMode !== 'surface' && (
        <div className={`analysis-legend ${analysisMode}`}>
          <span>{analysisMode === 'ease' ? 'TIGHT' : 'LOW'}</span><i /><span>{analysisMode === 'ease' ? 'LOOSE' : analysisMode === 'pressure' ? 'HIGH CONTACT' : 'HIGH STRAIN'}</span>
        </div>
      )}
    </div>
  )
}
