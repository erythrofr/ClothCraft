import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const stages = [
  ['cathedral', 'public/library-3d/MIKRISTIAN_Cathedral_House.glb'],
  ...['R02', 'R03', 'S01', 'S10'].map(id => [id, `public/stage-scenes/${id}.glb`]),
]

for (const [id, file] of stages) {
  const data = readFileSync(new URL(`../${file}`, import.meta.url))
  assert.equal(data.toString('utf8', 0, 4), 'glTF', `${id} invalid GLB header`)
  const length = data.readUInt32LE(12)
  const json = JSON.parse(data.toString('utf8', 20, 20 + length))
  const primitives = (json.meshes || []).flatMap(mesh => mesh.primitives || [])
  const uv = primitives.filter(p => p.attributes?.TEXCOORD_0 !== undefined).length
  const mapped = (json.materials || []).filter(m => m.pbrMetallicRoughness?.baseColorTexture).length
  assert.ok(primitives.length, `${id} has no geometry`)
  assert.ok(json.materials?.length, `${id} has no materials`)
  assert.ok(uv, `${id} has no texture coordinates`)
  console.log(`${id}: ${primitives.length} primitives, ${json.materials.length} materials, ${uv}/${primitives.length} UV, ${json.images?.length || 0} images, ${mapped} color-mapped materials`)
}

const source = readFileSync(new URL('../src/components/Library3DAssetPreview.jsx', import.meta.url), 'utf8')
assert.match(source, /toneMappingExposure=stage \? \.92 : 1\.18/)
assert.match(source, /stage \? 768 : 1024/)
assert.match(source, /normalBias=stage \? \.035/)
console.log('Stage-specific exposure, shadow frustum, and normal bias configured')
