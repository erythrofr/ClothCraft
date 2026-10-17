import { createTeeTemplate } from '../src/data/templates.js'
import { buildTechPack } from '../src/core/measurements.js'
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'

for (const id of ['jersey','fleece','denim','silk','interfacing']) {
  const fabric = FABRIC_PRESETS[id]
  for (const key of ['roughness','metalness','sheen','sheenRoughness','normalStrength']) {
    if (!Number.isFinite(Number(fabric?.[key]))) throw new Error(`${id} missing PBR property ${key}`)
  }
}
const project = createTeeTemplate()
project.fabrics.main.roughness = 0.53
project.fabrics.main.sheen = 0.41
project.fabrics.main.normalStrength = 1.7
project.fabrics.main.texture = {
  src: 'data:image/png;base64,ALBEDO_BYTES_SHOULD_NOT_EXPORT',
  name: 'woven-albedo.png',
  normalSrc: 'data:image/png;base64,NORMAL_BYTES_SHOULD_NOT_EXPORT',
  normalName: 'woven-normal.png',
  roughnessSrc: 'data:image/png;base64,ROUGH_BYTES_SHOULD_NOT_EXPORT',
  roughnessName: 'woven-roughness.png',
  repeatWidthCm: 12.5,
  repeatHeightCm: 9.5,
  rotationDeg: 17,
}
const tech = buildTechPack(project)
const main = tech.materials.find((item) => item.id === 'main')
if (!main) throw new Error('Main material missing from tech pack')
if (main.roughness !== 0.53 || main.sheen !== 0.41 || main.normalStrength !== 1.7) throw new Error('PBR response values were lost')
if (main.texture?.colorMap !== 'woven-albedo.png' || main.texture?.normalMap !== 'woven-normal.png' || main.texture?.roughnessMap !== 'woven-roughness.png') throw new Error('PBR map names were lost')
if (main.texture.repeatWidthCm !== 12.5 || main.texture.repeatHeightCm !== 9.5 || main.texture.rotationDeg !== 17) throw new Error('Textile UV metadata was lost')
const serialized = JSON.stringify(main)
if (serialized.includes('ALBEDO_BYTES') || serialized.includes('NORMAL_BYTES') || serialized.includes('ROUGH_BYTES')) throw new Error('Tech pack embedded large texture bytes instead of map references')
console.log(JSON.stringify({ material: main, presetResponses: Object.fromEntries(['jersey','fleece','denim','silk','interfacing'].map((id)=>[id,{roughness:FABRIC_PRESETS[id].roughness,sheen:FABRIC_PRESETS[id].sheen}])) }, null, 2))
