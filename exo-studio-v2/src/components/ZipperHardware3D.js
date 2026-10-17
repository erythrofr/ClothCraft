import * as THREE from 'three'

const clamp = (value, fallback, min, max) => THREE.MathUtils.clamp(Number.isFinite(Number(value)) ? Number(value) : fallback, min, max)
const v = () => new THREE.Vector3()

/** Detailed but inexpensive, instancing-safe zipper tooth profile.
 * Three.js metres; appearance approximation, not a supplier's certified mesh.
 * Local X spans the chain, Y follows its length, Z rises off the cloth.
 */
export function createZipperToothGeometry(chainWidthM, pitchM, tapeThicknessM, type = 'metal') {
  const w = Math.max(.0004, chainWidthM * .43)
  const h = Math.max(.0005, Math.min(pitchM * .78, chainWidthM * .55))
  const coil = /coil|invisible/i.test(type)
  const molded = /molded/i.test(type)
  if (coil) {
    // Textile nylon-coil chain: a continuous helical loop profile per tooth
    // rather than pretending each nylon winding is a stamped metal block.
    // Adjacent instances overlap slightly to read as one coherent coil.
    const pts = []
    const turns = 1.14
    for (let i = 0; i <= 36; i++) {
      const t=i/36, angle=Math.PI*2*turns*t
      pts.push(new THREE.Vector3(
        Math.cos(angle)*w*.43,
        (t-.5)*h*.82 + Math.sin(angle)*h*.065,
        Math.sin(angle)*Math.max(tapeThicknessM*.55,w*.12),
      ))
    }
    const radius=Math.max(.00012,Math.min(w*.12,h*.11,tapeThicknessM*.38))
    const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),48,radius,7,false)
    geometry.computeVertexNormals()
    return geometry
  }
  const chamfer = Math.min(w * .16, h * .2)
  const profile = new THREE.Shape()
  profile.moveTo(-w * .5 + chamfer, -h * .5)
  profile.lineTo(w * .31, -h * .5)
  profile.quadraticCurveTo(w * .5, -h * .5, w * .5, -h * .3)
  profile.lineTo(w * (coil ? .53 : .60), -h * .13)
  profile.lineTo(w * (molded ? .43 : .58), h * .19)
  profile.quadraticCurveTo(w * .60, h * .46, w * .31, h * .5)
  profile.lineTo(-w * .5 + chamfer, h * .5)
  profile.quadraticCurveTo(-w * .5, h * .5, -w * .5, h * .5 - chamfer)
  profile.lineTo(-w * .5, -h * .5 + chamfer)
  profile.quadraticCurveTo(-w * .5, -h * .5, -w * .5 + chamfer, -h * .5)
  const depth = Math.max(.00035, tapeThicknessM * (coil ? 1.8 : molded ? 2.1 : 2.7))
  const bevel = Math.min(depth * .19, chamfer * .7)
  const geo = new THREE.ExtrudeGeometry(profile, { depth: Math.max(.0001, depth - 2*bevel),
    bevelEnabled:true, bevelSegments:2, steps:1, bevelThickness:bevel, bevelSize:bevel*.7, curveSegments:5 })
  geo.translate(0, 0, -depth/2+bevel)
  geo.computeVertexNormals()
  return geo
}

/** A channel-shaped slider casing rather than a plain block. */
export function createZipperSliderHousingGeometry(chainWidthM, tapeThicknessM) {
  const w=chainWidthM*1.38, h=chainWidthM*1.85
  const s=new THREE.Shape()
  s.moveTo(-w*.46,-h*.5)
  s.lineTo(w*.46,-h*.5)
  s.lineTo(w*.49,-h*.31)
  s.lineTo(w*.43,h*.36)
  s.quadraticCurveTo(w*.39,h*.5,w*.23,h*.5)
  s.lineTo(-w*.23,h*.5)
  s.quadraticCurveTo(-w*.39,h*.5,-w*.43,h*.36)
  s.lineTo(-w*.49,-h*.31)
  s.closePath()
  const d=Math.max(.0006,tapeThicknessM*3.1), bevel=d*.09
  const geo=new THREE.ExtrudeGeometry(s,{depth:d-bevel*2,bevelEnabled:true,bevelSegments:3,
    bevelThickness:bevel,bevelSize:bevel,curveSegments:8})
  geo.translate(0,0,-d*.5+bevel)
  return geo
}

/** True cut-out tab: light passes through the inset slot in the puller. */
export function createZipperPullTabGeometry(chainWidthM, tapeThicknessM) {
  const w=chainWidthM*.84, h=chainWidthM*2.7
  const s=new THREE.Shape()
  const r=w*.18
  s.moveTo(-w*.5+r,-h*.5)
  s.lineTo(w*.5-r,-h*.5)
  s.quadraticCurveTo(w*.5,-h*.5,w*.5,-h*.5+r)
  s.lineTo(w*.5,h*.5-r)
  s.quadraticCurveTo(w*.5,h*.5,w*.5-r,h*.5)
  s.lineTo(-w*.5+r,h*.5)
  s.quadraticCurveTo(-w*.5,h*.5,-w*.5,h*.5-r)
  s.lineTo(-w*.5,-h*.5+r)
  s.quadraticCurveTo(-w*.5,-h*.5,-w*.5+r,-h*.5)
  const slot=new THREE.Path()
  slot.absellipse(0,h*.1,w*.22,h*.21,0,Math.PI*2,true)
  s.holes.push(slot)
  const d=Math.max(.00035,tapeThicknessM*1.25), bevel=d*.10
  const geo=new THREE.ExtrudeGeometry(s,{depth:d-bevel*2,bevelEnabled:true,bevelSegments:2,
    bevelThickness:bevel,bevelSize:bevel*.8,curveSegments:12})
  geo.translate(0,0,-d*.5+bevel)
  return geo
}

// Small, deterministic linear-data textures. A single texel tile describes
// sub-millimetre yarn relief; UVs below scale it in garment metres.
function surfaceMaps() {
  const size = 64
  const normalPixels = new Uint8Array(size * size * 4)
  const roughPixels = new Uint8Array(size * size * 4)
  const metalPixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4
    const warp = Math.sin((x / size) * Math.PI * 16)
    const weft = Math.sin((y / size) * Math.PI * 16)
    const overUnder = ((Math.floor(x / 4) + Math.floor(y / 4)) & 1) ? 1 : -1
    const nx = warp * .23 + overUnder * .08
    const ny = weft * .23 - overUnder * .08
    const nz = Math.sqrt(Math.max(.01, 1 - nx * nx - ny * ny))
    normalPixels.set([Math.round(127.5 * (nx + 1)), Math.round(127.5 * (ny + 1)), Math.round(127.5 * (nz + 1)), 255], index)
    const rough = Math.round(190 + 24 * (warp * weft) + 11 * overUnder)
    roughPixels.set([rough, rough, rough, 255], index)
    const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0
    const striation = Math.sin(y * Math.PI / 2) * 10 + (hash % 13) - 6
    const metalRoughness = Math.round(218 + striation)
    metalPixels.set([metalRoughness, metalRoughness, metalRoughness, 255], index)
  }
  function make(pixels) {
    const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat)
    map.colorSpace = THREE.NoColorSpace
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.magFilter = THREE.LinearFilter
    map.minFilter = THREE.LinearMipmapLinearFilter
    map.generateMipmaps = true
    map.needsUpdate = true
    return map
  }
  return { weaveNormal: make(normalPixels), weaveRoughness: make(roughPixels), metalRoughness: make(metalPixels) }
}

/** Deformation-following zipper assembly. All dimensions are millimetres on the public annotation. */
export function createZipperHardware3D(zipper, sides) {
  const chain = clamp(zipper.chainWidthMm, 5, 2, 20) / 1000
  const tape = clamp(zipper.tapeWidthMm, 12, 5, 35) / 1000
  const thickness = clamp(zipper.tapeThicknessMm, 0.65, 0.2, 2.5) / 1000
  const startExtension = clamp(zipper.startExtensionMm, zipper.endExtensionMm == null ? 0 : Number(zipper.endExtensionMm), 0, 80) / 1000
  const endExtension = clamp(zipper.endExtensionMm, 0, 0, 80) / 1000
  const body = new THREE.Group()
  body.name = `zipper-hardware-${zipper.id ?? 'seam'}`
  const textile = new THREE.MeshPhysicalMaterial({ color: zipper.tapeColor || zipper.color || '#343434', metalness: 0, roughness: clamp(zipper.tapeRoughness, 0.89, 0, 1), sheen: 0.55, sheenRoughness: 0.7, side: THREE.DoubleSide })
  const metalness = clamp(zipper.metalness, 0.85, 0, 1)
  const roughness = clamp(zipper.roughness, 0.27, 0, 1)
  const chainType=zipper.type||zipper.zipperType||'metal'
  const nonMetalChain=/coil|invisible|molded/i.test(chainType)
  const teethMaterial = new THREE.MeshStandardMaterial({ color: zipper.teethColor || '#b5b8bc',
    metalness:nonMetalChain ? .03 : metalness, roughness:nonMetalChain ? Math.max(.42,roughness):roughness })
  const sliderMaterial = new THREE.MeshStandardMaterial({ color: zipper.sliderColor || '#929aa3', metalness, roughness })
  const pullMaterial = new THREE.MeshStandardMaterial({ color: zipper.pullerColor || zipper.sliderColor || '#bdc1c6', metalness, roughness })
  const stopMaterial = new THREE.MeshStandardMaterial({ color: zipper.stopperColor || zipper.teethColor || '#b8a88d', metalness, roughness })
  const rows = sides.filter(side => side?.indices?.length >= 2)
  if (!rows.length) return null
  const maps = surfaceMaps()
  textile.normalMap = maps.weaveNormal
  textile.roughnessMap = maps.weaveRoughness
  textile.normalScale.set(.32, .32)
  teethMaterial.roughnessMap = maps.metalRoughness
  sliderMaterial.roughnessMap = maps.metalRoughness
  pullMaterial.roughnessMap = maps.metalRoughness
  stopMaterial.roughnessMap = maps.metalRoughness
  const tapes = rows.map((side, index) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((side.indices.length + 2) * 2 * 3), 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((side.indices.length + 2) * 2 * 2), 2))
    const indices = []
    for (let i = 0; i < side.indices.length + 1; i++) {
      const base = i * 2
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
    }
    geometry.setIndex(indices)
    const mesh = new THREE.Mesh(geometry, textile.clone())
    mesh.name = `zipper-tape-${index}`
    mesh.renderOrder = 33
    mesh.castShadow = true
    mesh.frustumCulled = false
    body.add(mesh)
    return mesh
  })
  // Viewport teardown disposes child materials via scene traversal. Release
  // shared DataTextures once with the first tape material; all child meshes
  // are discarded in that same traversal.
  const ownerMaterial = tapes[0].material
  const disposeOwner = ownerMaterial.dispose.bind(ownerMaterial)
  let mapsDisposed = false
  ownerMaterial.dispose = () => {
    if (!mapsDisposed) {
      mapsDisposed = true
      Object.values(maps).forEach(map => map.dispose())
    }
    disposeOwner()
  }
  const firstSide = rows[0]
  const initialPosition = firstSide.record.geometry.getAttribute('position')
  let runLength = 0
  for (let i = 1; i < firstSide.indices.length; i++) {
    const a = firstSide.indices[i - 1], b = firstSide.indices[i]
    runLength += Math.hypot(initialPosition.getX(a) - initialPosition.getX(b), initialPosition.getY(a) - initialPosition.getY(b), initialPosition.getZ(a) - initialPosition.getZ(b))
  }
  const pitch = clamp(zipper.toothPitchMm, 3.2, 1.4, 8) / 1000
  const maxTeeth = Math.min(280, Math.max(8, Math.round(clamp(zipper.toothCount, runLength / pitch, 8, 280))))
  const toothGeometry = createZipperToothGeometry(chain,pitch,thickness,chainType)
  const teeth = rows.map((_, index) => {
    const instanced = new THREE.InstancedMesh(toothGeometry, teethMaterial.clone(), maxTeeth)
    instanced.name = `zipper-teeth-${index}`
    instanced.frustumCulled = false
    instanced.castShadow = true
    body.add(instanced)
    return instanced
  })
  function makeSlider(name) {
    const slider = new THREE.Group()
    slider.name = name
    const housing = new THREE.Mesh(createZipperSliderHousingGeometry(chain,thickness), sliderMaterial)
    housing.name = 'zipper-slider-body'
    housing.castShadow = true
    slider.add(housing)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(chain * .16, chain * .16, chain * .56, 10), sliderMaterial)
    neck.rotation.x = Math.PI / 2
    neck.position.z = thickness * 4
    slider.add(neck)
    const pull = new THREE.Mesh(createZipperPullTabGeometry(chain,thickness), pullMaterial)
    pull.position.set(0, -chain * 1.55, thickness * 4.8)
    pull.name = 'zipper-puller-tab'
    pull.castShadow = true
    slider.add(pull)
    body.add(slider)
    return slider
  }
  const slider = makeSlider('zipper-slider-assembly')
  const bottomSlider = zipper.twoWay ? makeSlider('zipper-bottom-slider-assembly') : null
  const stops = rows.flatMap((_, index) => [0, 1].map(end => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(chain * .52, chain * .52, thickness * 3), stopMaterial.clone())
    mesh.name = `zipper-stop-${index}-${end}`
    mesh.castShadow = true
    body.add(mesh)
    return { mesh, sideIndex: index, end }
  }))
  const x = v(), tangent = v(), normal = v(), lateral = v(), temp = v(), transform = new THREE.Object3D()
  const lift = thickness * 1.8 + .0012
  function sample(side, t) {
    const positions = side.record.geometry.getAttribute('position')
    const normals = side.record.geometry.getAttribute('normal')
    const extendedT = THREE.MathUtils.clamp(t, 0, 1)
    const slot = extendedT * (side.indices.length - 1)
    const i = Math.min(side.indices.length - 2, Math.floor(slot))
    const fraction = slot - i
    const a = side.indices[i], b = side.indices[i + 1]
    x.set(positions.getX(a), positions.getY(a), positions.getZ(a)).lerp(temp.set(positions.getX(b), positions.getY(b), positions.getZ(b)), fraction)
    normal.set(normals.getX(a), normals.getY(a), normals.getZ(a)).lerp(temp.set(normals.getX(b), normals.getY(b), normals.getZ(b)), fraction).normalize()
    tangent.set(positions.getX(b) - positions.getX(a), positions.getY(b) - positions.getY(a), positions.getZ(b) - positions.getZ(a)).normalize()
    lateral.crossVectors(tangent, normal).normalize()
    if (lateral.lengthSq() < .1) lateral.set(1, 0, 0)
    return { position: x.clone().add(side.record.mesh.position).addScaledVector(normal, lift), tangent: tangent.clone(), normal: normal.clone(), lateral: lateral.clone() }
  }
  function extendedSample(side, t) {
    const f = sample(side, t)
    if (t < 0) f.position.addScaledVector(f.tangent, t * startExtension)
    if (t > 1) f.position.addScaledVector(f.tangent, (t - 1) * endExtension)
    return f
  }
  const zipperFraction = () => zipper.fastened === false ? 0 : clamp(zipper.sliderFraction, zipper.openFraction == null ? 1 : 1 - Number(zipper.openFraction), 0, 1)
  // The primary slider opens the named edge end; the secondary opens the opposite end.
  const isEngaged = (fraction, amount) => zipper.openFrom === 'start' ? fraction >= 1 - amount : fraction <= amount
  const bottomFraction = () => clamp(zipper.bottomSliderFraction, 0, 0, 1)
  const opening = () => {
    const amount = zipperFraction()
    if (!zipper.twoWay) return zipper.openFrom === 'start' ? { start: 1 - amount, end: 0 } : { start: 0, end: 1 - amount }
    return zipper.openFrom === 'start'
      ? { start: 1 - amount, end: bottomFraction() }
      : { start: bottomFraction(), end: 1 - amount }
  }
  let engagedCount = 0
  let openCount = 0
  function update() {
    const sliderFraction = zipperFraction()
    const open = opening()
    engagedCount = 0
    openCount = 0
    rows.forEach((side, sideIndex) => {
      const geometry = tapes[sideIndex].geometry
      const positions = geometry.getAttribute('position')
      const uvs = geometry.getAttribute('uv')
      const sideSign = sideIndex === 0 ? -1 : 1
      let distance = 0
      let previous = null
      for (let i = 0; i < side.indices.length + 2; i++) {
        const fraction = i === 0 ? -1 : i === side.indices.length + 1 ? 2 : (i - 1) / (side.indices.length - 1)
        const frame = extendedSample(side, fraction)
        const edge = frame.position.clone().addScaledVector(frame.lateral, sideSign * chain * .15)
        const outside = frame.position.clone().addScaledVector(frame.lateral, sideSign * (tape + chain * .15))
        positions.setXYZ(i * 2, edge.x, edge.y, edge.z)
        positions.setXYZ(i * 2 + 1, outside.x, outside.y, outside.z)
        if (previous) distance += frame.position.distanceTo(previous)
        previous = frame.position
        // Repeat every 0.8 mm along the tape; texture stays bound to its
        // vertex stations as the simulated cloth bends and stretches.
        uvs.setXY(i * 2, 0, distance / .0008)
        uvs.setXY(i * 2 + 1, tape / .0008, distance / .0008)
      }
      positions.needsUpdate = true
      uvs.needsUpdate = true
      geometry.computeVertexNormals()
      const mesh = teeth[sideIndex]
      for (let i = 0; i < maxTeeth; i++) {
        const fraction = (i + .5) / maxTeeth
        const frame = sample(side, fraction)
        const engaged = zipper.twoWay
          ? open.start + open.end < 1 && fraction >= open.start && fraction <= 1 - open.end
          : isEngaged(fraction, sliderFraction)
        // Closed links meet at the centre and alternate in phase; open links fan apart.
        const opening = engaged ? 0 : chain * .72
        const intermesh = engaged ? (sideIndex === 0 ? -1 : 1) * chain * .09 : 0
        transform.position.copy(frame.position).addScaledVector(frame.lateral, sideSign * (chain * .06 + opening + intermesh))
        if (engaged) engagedCount++
        else openCount++
        transform.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.lateral, frame.tangent, frame.normal))
        transform.scale.setScalar(1)
        transform.updateMatrix()
        mesh.setMatrixAt(i, transform.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    })
    const side = rows[0]
    const sliderT = zipper.openFrom === 'end' ? sliderFraction : 1 - sliderFraction
    const frame = sample(side, sliderT)
    slider.position.copy(frame.position).addScaledVector(frame.normal, thickness * 3)
    slider.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.lateral, frame.tangent, frame.normal))
    if (bottomSlider) {
      const bottomT = zipper.openFrom === 'end' ? bottomFraction() : 1 - bottomFraction()
      const bottomFrame = sample(side, bottomT)
      bottomSlider.position.copy(bottomFrame.position).addScaledVector(bottomFrame.normal, thickness * 3)
      bottomSlider.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(bottomFrame.lateral, bottomFrame.tangent.clone().negate(), bottomFrame.normal.clone().negate()))
    }
    stops.forEach(({ mesh, sideIndex, end }) => {
      const f = extendedSample(rows[sideIndex], end === 0 ? -1 : 2)
      mesh.position.copy(f.position)
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.lateral, f.tangent, f.normal))
    })
    body.visible = rows.some(item => item.record.mesh.visible)
  }
  update()
  return { object: body, update, tapeCount: tapes.length, toothInstanceCount: teeth.length * maxTeeth, sliderCount: bottomSlider ? 2 : 1, stopCount: stops.length,
    get engagedToothCount() { return engagedCount }, get openToothCount() { return openCount },
    get startExtensionM() { return startExtension },
    get endExtensionM() { return endExtension },
    get primarySliderFraction() { return zipperFraction() },
    get bottomSliderFraction() { return bottomSlider ? bottomFraction() : 0 },
    get openStartFraction() { return opening().start },
    get openEndFraction() { return opening().end },
  }
}
