import assert from 'node:assert/strict'
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'
import { createTemplateProject } from '../src/data/templates.js'
import { describeTextileSurface, makeProceduralTextileMaps, textileRelief } from '../src/core/textileProcedurals.js'
import { normalizeFabricOptics } from '../src/core/fabricSurfaceModel.js'
import { opticalFabricFingerprint, physicsInputFingerprint } from '../src/core/visualOnlyChanges.js'
import { createGeometry, updateGeometryFabricUV } from '../src/core/physics.js'
import { estimateFabricPbrPixels } from '../src/core/fabricPbrGenerator.js'
import { classifyFabricPbrFilename } from '../src/core/fabricPbrFileNaming.js'
import { buildTechPack } from '../src/core/measurements.js'

// A small deterministic canvas stand-in validates generated texture pixels in
// Node without requiring a desktop, GPU or browser. Runtime render validation
// remains a separate visual acceptance requirement.
globalThis.document = {
  createElement(kind) {
    assert.equal(kind, 'canvas')
    const canvas = { width: 0, height: 0 }
    const context = {
      createImageData(width, height) { return {data: new Uint8ClampedArray(width * height * 4)} },
      putImageData(pixels) { canvas.pixels = pixels.data },
    }
    canvas.getContext = () => context
    return canvas
  },
}

const families = ['plain-weave','twill','jersey-knit','rib-knit','terry-knit','silk',
  'synthetic','ripstop','leather','suede','velvet','sheer-weave','corduroy']
const roughnessByFamily = new Map()
for (const family of families) {
  const fabric = {name:`QA ${family}`,surfaceFamily:family,weaveScaleCm:2.5,
    texture:{repeatWidthCm:17,repeatHeightCm:11,rotationDeg:35}}
  assert.equal(describeTextileSurface(fabric).family,family)
  for (const [u,v] of [[0,.27],[.43,0],[.9,.31]]) {
    assert.ok(Math.abs(textileRelief(family,u,v)-textileRelief(family,u+1,v))<1e-9,
      `${family} should tile seamlessly horizontally`)
    assert.ok(Math.abs(textileRelief(family,u,v)-textileRelief(family,u,v+1))<1e-9,
      `${family} should tile seamlessly vertically`)
  }
  const maps=makeProceduralTextileMaps(fabric)
  assert.ok(maps?.colorMap && maps.normalMap && maps.roughnessMap)
  assert.equal(maps.family,family)
  assert.equal(maps.normalMap.colorSpace,'')
  assert.equal(maps.normalMap.image.pixels.length,256*256*4)
  assert.equal(maps.roughnessMap.image.pixels.length,256*256*4)
  assert.equal(maps.colorMap.image.pixels.length,256*256*4)
  assert.ok(Math.abs(maps.colorMap.repeat.x-6.8)<1e-8)
  assert.ok(Math.abs(maps.colorMap.repeat.y-4.4)<1e-8)
  const normals=maps.normalMap.image.pixels
  assert.ok(normals.some((n,index)=>index%4===0 && n!==128),`${family} requires nonflat yarn micro normals`)
  roughnessByFamily.set(family,maps.roughnessMap.image.pixels[1])
  maps.colorMap.dispose(); maps.normalMap.dispose(); maps.roughnessMap.dispose()
}
assert.notEqual(roughnessByFamily.get('silk'),roughnessByFamily.get('suede'),
  'Silk and suede should not share identical roughness detail')

const photoPixels=new Uint8ClampedArray(8*8*4)
for (let y=0;y<8;y++) for (let x=0;x<8;x++) {
  const offset=(y*8+x)*4
  const tone=x<4 ? 65 : 210
  photoPixels.set([tone,tone,tone,255],offset)
}
const estimated=estimateFabricPbrPixels({width:8,height:8,data:photoPixels})
assert.equal(estimated.normal.length,8*8*4)
assert.equal(estimated.roughness.length,8*8*4)
assert.equal(estimated.kind,'estimated-from-albedo')
assert.notEqual(estimated.normal[(2*8+3)*4],estimated.normal[(2*8+0)*4],
  'Image-derived normals should respond to actual high-contrast fiber edges')
assert.ok(estimated.normal.every((v,index)=>index%4!==3 || v===255),
  'Every generated normal must be fully opaque')
assert.throws(()=>estimateFabricPbrPixels({width:2,height:2,data:[]}),/Invalid fabric image/)
const pbrFilenames={
  'denim_fabric_03_diff_1k.jpg':'color',
  'linen_basecolor.png':'color',
  'linen_nor_gl_1k.jpg':'normal',
  'linen_normal_gl.png':'normal',
  'linen_rough_1k.png':'roughness',
  'linen_metalness.png':'metalness',
  'lace_opacity.webp':'opacity',
  'linen_height.png':'displacement',
  'linen_disp_2k.jpg':'displacement',
  'denim_nor_dx_1k.jpg':null,
  'denim_arm_1k.jpg':null,
  'denim_rough_ao_1k.jpg':null,
}
for (const [filename,expected] of Object.entries(pbrFilenames))
  assert.equal(classifyFabricPbrFilename(filename),expected,`PBR channel guess for ${filename}`)

const source=createTemplateProject('tee')
const originalPhysicsKey=physicsInputFingerprint(source)
const originalOpticsKey=opticalFabricFingerprint(source)
const appearance=structuredClone(source)
appearance.fabrics.main.surfaceFamily='ripstop'
appearance.fabrics.main.opacity=.64
appearance.fabrics.main.displacementMm=.7
appearance.fabrics.main.texture={src:'data:image/png;base64,qa',repeatWidthCm:9,repeatHeightCm:7,rotationDeg:35}
appearance.fabrics.main.texture.displacementName='linen_height.png'
assert.equal(physicsInputFingerprint(appearance),originalPhysicsKey,
  'Changing maps, structure or opacity should preserve the live cloth simulation')
assert.notEqual(opticalFabricFingerprint(appearance),originalOpticsKey,
  'Material changes must still update the rendered cloth')
assert.equal(normalizeFabricOptics(appearance.fabrics.main).opacity,.64)
assert.equal(normalizeFabricOptics({opacity:3}).opacity,1)
assert.equal(normalizeFabricOptics(appearance.fabrics.main).displacementMm,.7)
assert.equal(normalizeFabricOptics({displacementMm:7}).displacementMm,2)
const material=buildTechPack(appearance).materials.find(item=>item.id==='main')
assert.equal(material?.texture?.displacementMap,'linen_height.png')
assert.equal(material?.displacementMm,.7)

const pieceSim={
  piece:{grainAngleDeg:0},fabric:{texture:{repeatWidthCm:20,repeatHeightCm:20}},
  particles:[{position:{x:0,y:0,z:0}},{position:{x:1,y:0,z:0}},{position:{x:0,y:1,z:0}}],
  flatVertices:[{x:0,y:0},{x:10,y:0},{x:0,y:10}], faces:[[0,1,2]],
}
const geometry=createGeometry(pieceSim)
const positions=Array.from(geometry.getAttribute('position').array)
assert.equal(geometry.getAttribute('uv').getX(1),.5)
assert.equal(updateGeometryFabricUV(pieceSim,geometry,appearance.fabrics.main),true)
assert.ok(Math.abs(geometry.getAttribute('uv').getX(1)-10/9)<1e-5)
assert.ok(Math.abs(geometry.getAttribute('uv').getY(2)-10/7)<1e-5)
assert.deepEqual(Array.from(geometry.getAttribute('position').array),positions,
  'Retexturing must not displace cloth vertices')
geometry.dispose()
for (const key of ['velvet','silkChiffon','silkOrganza','cottonCorduroy','scubaKnit','technicalSoftshell']) {
  assert.ok(FABRIC_PRESETS[key],`New material ${key} must remain available`)
  assert.ok(FABRIC_PRESETS[key].gsm>0)
}
console.log(JSON.stringify({pass:true,fabricFamilies:families.length,presets:Object.keys(FABRIC_PRESETS).length,
  opticalHotUpdateWithoutDrapeReset:true,realCentimeterUV:true,proceduralPBRMaps:true,
  photoToPBRApproximation:true,bulkPbrFilenameClassifier:true}))
