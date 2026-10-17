import * as THREE from 'three'

// Scene units are metres. Hardware catalog dimensions and inspector overrides are mm.
const mm = (value, fallback) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback) / 1000
const clamp01 = value => THREE.MathUtils.clamp(Number(value), 0, 1)

function buttonOutline(shape, width, height) {
  const outline = new THREE.Shape()
  if (shape === 'square') {
    const r = Math.min(width, height) * .13
    outline.moveTo(-width / 2 + r, -height / 2)
    outline.lineTo(width / 2 - r, -height / 2)
    outline.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + r)
    outline.lineTo(width / 2, height / 2 - r)
    outline.quadraticCurveTo(width / 2, height / 2, width / 2 - r, height / 2)
    outline.lineTo(-width / 2 + r, height / 2)
    outline.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - r)
    outline.lineTo(-width / 2, -height / 2 + r)
    outline.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + r, -height / 2)
  } else outline.absellipse(0, 0, width / 2, height / 2, 0, Math.PI * 2, false)
  return outline
}

function addMesh(group, geometry, material, name, z = 0) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.z = z
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** Build physical 3D button surfaces for viewport display (not rigid-body collisions). */
export function createHardwareButton3D(button = {}, preset = null) {
  const dims = { ...(preset?.dimensionsMm || {}), ...(button.dimensionsMm || {}) }
  const nominalDiameter = Number(button.diameterCm) > 0 ? Number(button.diameterCm) * 10 :
    (dims.diameter ?? dims.capDiameter ?? dims.width ?? 18)
  const width = mm(button.widthMm ?? dims.width, nominalDiameter) || mm(nominalDiameter, 18)
  const height = mm(button.heightMm ?? dims.height, nominalDiameter) || mm(nominalDiameter, 18)
  const thickness = Math.max(.0008, mm(button.thicknessMm ?? dims.thickness ?? dims.frontThickness ?? dims.capHeight, 2.5))
  const mount = button.mount || preset?.mount || 'sew-through'
  const shape = button.shape || preset?.shape || 'round'
  const holesRequested = Number(button.holes ?? preset?.holes ?? 4)
  const holes = mount === 'shank' || mount === 'tack' ? 0 : ([0, 2, 4].includes(holesRequested) ? holesRequested : 4)
  const holeSpacing = mm(button.holeSpacingMm ?? dims.holeSpacing, 4)
  const holeRadius = Math.max(.00025, Math.min(mm(button.holeDiameterMm ?? dims.holeDiameter, 1.4) / 2, Math.min(width, height) * .1))
  const halfSpacing = Math.min(holeSpacing / 2, Math.min(width, height) * (holes === 4 ? .22 : .33))
  const holeCenters = holes === 2 ? [[-halfSpacing, 0], [halfSpacing, 0]] : holes === 4
    ? [[-halfSpacing, -halfSpacing], [halfSpacing, -halfSpacing], [-halfSpacing, halfSpacing], [halfSpacing, halfSpacing]] : []
  const pbr = { ...(preset?.pbr || {}), ...(button.pbr || {}) }
  const color = button.color || pbr.baseColor || '#343434'
  const material = new THREE.MeshPhysicalMaterial({
    color, metalness: clamp01(button.metalness ?? pbr.metalness ?? .05),
    roughness: THREE.MathUtils.clamp(Number(button.roughness ?? pbr.roughness ?? .46), .035, 1),
    clearcoat: clamp01(button.clearcoat ?? pbr.clearcoat ?? .18),
    clearcoatRoughness: clamp01(button.clearcoatRoughness ?? pbr.clearcoatRoughness ?? .23),
    transmission: clamp01(button.transmission ?? pbr.transmission ?? 0),
    thickness, ior: Math.max(1, Number(button.ior ?? pbr.ior ?? 1.48)),
    envMapIntensity: Math.max(0, Number(button.reflectionIntensity ?? pbr.envMapIntensity ?? 1)),
    side: THREE.DoubleSide,
  })
  const group = new THREE.Group()
  group.name = `hardware-button-${button.id || preset?.id || 'custom'}`
  group.userData.hardware = { id: button.id || null, presetId: preset?.id || null, diameterMm: nominalDiameter,
    widthMm: width * 1000, heightMm: height * 1000, thicknessMm: thickness * 1000, mount, holes }
  // Front face points to local +Z; caller rotates that direction onto the garment normal.
  const outline = buttonOutline(shape, width, height)
  holeCenters.forEach(([x, y]) => {
    const hole = new THREE.Path()
    hole.absarc(x, y, holeRadius, 0, Math.PI * 2, true)
    outline.holes.push(hole)
  })
  const bevel = Math.min(.00042, thickness * .19, Math.min(width, height) * .025)
  const body = new THREE.ExtrudeGeometry(outline, {
    depth: Math.max(.0002, thickness - bevel * 2), bevelEnabled: true,
    bevelSegments: 3, bevelThickness: bevel, bevelSize: Math.min(bevel, holeRadius * .2),
    steps: 1, curveSegments: 36,
  })
  body.translate(0, 0, -thickness / 2 + bevel)
  addMesh(group, body, material, 'drilled-button-body')

  if (shape === 'rimmed-round') {
    const rimMaterial = material.clone()
    rimMaterial.metalness = Math.max(.65, material.metalness)
    rimMaterial.roughness = Math.min(.34, material.roughness)
    const rim = new THREE.TorusGeometry(Math.min(width, height) * .455, Math.max(.00035, width * .038), 10, 64)
    addMesh(group, rim, rimMaterial, 'raised-metal-rim', thickness / 2 + .00007)
  }

  let rearExtension = thickness / 2
  if (mount === 'shank' || mount === 'tack') {
    const shankHeight = Math.max(.001, mm(button.shankHeightMm ?? dims.shankHeight ?? dims.nominalInstalledStack, 3.4))
    const stemRadius = Math.max(.0005, mm(dims.tackShaftDiameter, 2) / 2)
    const stem = new THREE.CylinderGeometry(stemRadius, stemRadius, shankHeight, 16)
    stem.rotateX(Math.PI / 2)
    addMesh(group, stem, material, 'rear-attachment-post', -thickness / 2 - shankHeight / 2)
    rearExtension += shankHeight
    if (mount === 'shank') {
      const eyeRadius = Math.max(.001, mm(dims.eyeDiameter, 2.5) / 2)
      const eye = new THREE.TorusGeometry(eyeRadius, Math.max(.00035, stemRadius * .45), 8, 24)
      eye.rotateY(Math.PI / 2)
      addMesh(group, eye, material, 'shank-sewing-eye', -thickness / 2 - shankHeight)
    }
  }

  // Optional sew-through stitch representation: each stitch is a small 3D thread segment.
  if (holeCenters.length && button.threadColor && String(button.threadType).toLowerCase() !== 'none') {
    const thread = new THREE.MeshStandardMaterial({ color: button.threadColor, roughness: .94, metalness: 0 })
    const threadType=String(button.threadType||'Cross').toLowerCase()
    const pairs = holes === 2 ? [[0, 1]] : threadType === 'cross'
      ? [[0, 3], [1, 2]] : threadType==='square'
        ? [[0, 1], [1, 3], [3, 2], [2, 0]] : [[0, 1], [2, 3]]
    for (const [a, b] of pairs) {
      const from = new THREE.Vector3(...holeCenters[a], thickness / 2 + .00021)
      const to = new THREE.Vector3(...holeCenters[b], thickness / 2 + .00021)
      const direction = to.clone().sub(from)
      const cylinder = new THREE.CylinderGeometry(.00024, .00024, direction.length(), 6)
      const stitch = addMesh(group, cylinder, thread, 'sewing-thread')
      stitch.position.copy(from.add(to).multiplyScalar(.5))
      stitch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    }
  }
  group.userData.angleDeg = Number(button.angleDeg ?? button.orientationDeg ?? 0)
  group.userData.rearExtensionM = rearExtension
  group.traverse(child => { if (child.isMesh) child.renderOrder = 32 })
  return group
}
