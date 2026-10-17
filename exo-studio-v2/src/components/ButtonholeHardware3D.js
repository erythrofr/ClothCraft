import * as THREE from 'three'

// Metre-scale decorative geometry. The garment mesh is not perforated here.
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/**
 * CLO-style buttonhole overlay, front facing local +Z, major axis local +X.
 * Accepts pattern lengthCm/widthCm and catalog dimensionsMm; optional
 * orientationDeg, color/threadColor and preset openingShape.
 * Caller positions it on the garment and disposes meshes/materials via traverse.
 */
export function createButtonholeHardware3D(buttonhole = {}, preset = null) {
  const dims = { ...(preset?.dimensionsMm || {}), ...(buttonhole.dimensionsMm || {}) }
  const length = clamp(finite(buttonhole.lengthCm, finite(dims.length, 18) / 10) / 100, .003, .09)
  const width = clamp(finite(buttonhole.widthCm, finite(dims.openingWidth ?? dims.stitchedWidth, 2) / 10) / 100, .0007, length * .36)
  const keyhole = buttonhole.openingShape === 'keyhole' || (!buttonhole.openingShape && (preset?.openingShape === 'keyhole' || preset?.id === 'keyhole-buttonhole'))
  const eyeRadius = keyhole ? clamp(finite(buttonhole.eyeDiameterMm, finite(dims.eyeDiameter, 5)) / 2000, width * .7, length * .18) : width * .52
  const satinWidth = clamp(finite(buttonhole.stitchBorderWidthMm, finite(dims.stitchBorderWidth ?? dims.stitchedWidth, 2.2)) / 1000, .0005, length * .14)
  const threadColor = buttonhole.threadColor || buttonhole.color || preset?.pbr?.baseColor || '#a7a2a0'
  const group = new THREE.Group()
  group.name = 'hardware-buttonhole-' + (buttonhole.id || preset?.id || 'custom')
  group.userData.hardware = { kind: 'buttonhole', presetId: preset?.id || null, lengthCm: length * 100, widthCm: width * 100, openingShape: keyhole ? 'keyhole' : 'horizontal' }
  group.userData.isDecorativeOverlay = true
  group.userData.requiresGarmentCut = true
  group.userData.angleDeg = finite(buttonhole.orientationDeg, finite(buttonhole.angleDeg, finite(preset?.orientationDeg, 0)))
  group.rotation.z = THREE.MathUtils.degToRad(group.userData.angleDeg)

  const matte = new THREE.MeshStandardMaterial({ color: buttonhole.recessColor || '#08090c', roughness: .98, metalness: 0, side: THREE.DoubleSide })
  const edge = new THREE.MeshStandardMaterial({ color: threadColor, roughness: .86, metalness: 0, side: THREE.DoubleSide })
  const shadow = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: .48, depthWrite: false, side: THREE.DoubleSide })
  const add = (geometry, material, name, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.z = z
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }
  const radius = width * .5
  const left = -length * .5 + (keyhole ? eyeRadius : radius)
  const right = length * .5 - radius
  const middle = new THREE.Shape()
  middle.moveTo(left, -radius)
  middle.lineTo(right, -radius)
  middle.absarc(right, 0, radius, -Math.PI / 2, Math.PI / 2, false)
  middle.lineTo(left, radius)
  if (keyhole) middle.absarc(left, 0, eyeRadius, Math.PI / 2, Math.PI * 1.5, false)
  else middle.absarc(left, 0, radius, Math.PI / 2, Math.PI * 1.5, false)
  middle.closePath()
  add(new THREE.ShapeGeometry(middle, 28), shadow, 'recess-shadow', -.00011)
  add(new THREE.ShapeGeometry(middle, 28), matte, 'dark-visual-opening', -.00007)

  // Each satin stitch crosses the visible border and has its own thread normal,
  // but segments are merged into one geometry to avoid hundreds of draw calls.
  const outline = middle.getPoints(Math.max(64, Math.ceil(length / .00015)))
  const positions = []
  const indices = []
  const stitchCount = clamp(Math.ceil(length / .00019) * 2, 64, 700)
  const beadWidth = clamp(length / stitchCount * .65, .000045, .00011)
  for(let i = 0; i < stitchCount; i++) {
    const pt = outline[Math.floor(i / stitchCount * (outline.length - 1))]
    const prev = outline[Math.max(0, Math.floor(i / stitchCount * (outline.length - 1)) - 1)]
    const next = outline[Math.min(outline.length - 1, Math.floor(i / stitchCount * (outline.length - 1)) + 1)]
    let dx = next.x - prev.x, dy = next.y - prev.y
    const mag = Math.hypot(dx, dy) || 1
    dx /= mag; dy /= mag
    // Shape points wind clockwise; radial direction is inferred from center.
    let nx = dy, ny = -dx
    const toward = (pt.x * nx + pt.y * ny)
    if (toward < 0) { nx = -nx; ny = -ny }
    const half = satinWidth * .48
    const centerX = pt.x + nx * (half * .62)
    const centerY = pt.y + ny * (half * .62)
    const j = positions.length / 3
    const a = [-half,-beadWidth/2], b = [half,-beadWidth/2], c = [half,beadWidth/2], d = [-half,beadWidth/2]
    for(const [offset,side] of [a,b,c,d]) positions.push(centerX+nx*offset+dx*side,centerY+ny*offset+dy*side,.00005+(i%3)*.000003)
    indices.push(j,j+1,j+2,j,j+2,j+3)
  }
  const stitches = new THREE.BufferGeometry()
  stitches.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  stitches.setIndex(indices)
  stitches.computeVertexNormals()
  add(stitches, edge, 'dense-satin-stitches')
  // Raised narrow piping visually accentuates the recessed opening.
  const path = new THREE.CatmullRomCurve3(outline.map(p=>new THREE.Vector3(p.x,p.y,.0001)),true,'centripetal')
  add(new THREE.TubeGeometry(path,Math.min(900,outline.length*2),Math.min(.000085,satinWidth*.08),4,true),edge,'thread-rim')
  return group
}
