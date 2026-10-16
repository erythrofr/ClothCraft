import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'

// Three FileLoader uses ProgressEvent in the browser. Node's fetch provides
// the embedded data URI but does not supply this event class by default.
globalThis.ProgressEvent ||= class ProgressEvent {
  constructor(type, properties = {}) { this.type = type; Object.assign(this, properties) }
}
const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
function native(project, op, options = {}) {
  const child = spawnSync(cli, { encoding: 'utf8', maxBuffer: 96 * 1024 * 1024,
    input: JSON.stringify({ protocol: 'garment-studio.native-cad.v1',
      document: project, op, args: options }) + '\n' })
  if (child.error) throw child.error
  assert.equal(child.status, 0, child.stderr)
  return JSON.parse(child.stdout.trim())
}
let panels = 0, triangles = 0, fabrics = 0
const shirt = createDefaultProject()
shirt.fabrics.main.opacity = 0.35
shirt.fabrics.main.color = '#2c3d4e'
for (const project of [shirt, createZipHoodieTemplate()]) {
  const original = structuredClone(project)
  const exported = native(project, 'export-flat-gltf', { segmentsPerCurve: 8, resolution: 0 })
  assert.equal(exported.ok, true, exported.error)
  assert.equal(exported.fitAccepted, false)
  assert.equal(exported.mimeType, 'model/gltf+json')
  assert.equal(exported.units, 'm')
  const data = JSON.parse(exported.gltf)
  assert.equal(data.asset.version, '2.0')
  assert.equal(data.extras.fitAccepted, false)
  assert.equal(data.extras.restState, true)
  assert.equal(data.extras.coordinateUnits, 'metres')
  const binary = Buffer.from(data.buffers[0].uri.split(',')[1], 'base64')
  assert.equal(binary.length, data.buffers[0].byteLength)
  for (const view of data.bufferViews) {
    assert.equal(view.byteOffset % 4, 0, 'glTF buffer view must be four-byte aligned')
    assert.ok(view.byteOffset + view.byteLength <= binary.length)
  }
  const sourceMeshes = native(project, 'mesh-project', { segmentsPerCurve: 8, resolution: 0 })
  assert.equal(sourceMeshes.ok, true)
  assert.equal(data.meshes.length, sourceMeshes.meshes.length)
  const scene = await new Promise((resolve, reject) =>
    new GLTFLoader().parse(exported.gltf, '', resolve, reject))
  assert.equal(scene.scene.children.length, data.meshes.length)
  for (let i = 0; i < sourceMeshes.meshes.length; i++) {
    const reference = sourceMeshes.meshes[i]
    const loaded = scene.scene.children[i]
    assert.equal(loaded.name, reference.pieceId)
    assert.ok(loaded.isMesh)
    assert.equal(loaded.geometry.getAttribute('position').count, reference.vertices.length)
    assert.equal(loaded.geometry.getAttribute('uv').count, reference.vertices.length)
    assert.equal(loaded.geometry.index.count, reference.triangles.length * 3)
    assert.equal(data.meshes[i].extras.sourcePieceId, reference.pieceId)
    for (const edge of data.meshes[i].extras.seamEdgeIds)
      assert.ok(typeof edge.seamIds === 'string' && edge.seamIds.length > 0)
    const position = loaded.geometry.getAttribute('position')
    for (let k = 0; k < position.count; k++) {
      assert.equal(position.getY(k), 0, 'flat patterns must remain in the XZ plane')
      assert.ok(Number.isFinite(position.getX(k)) && Number.isFinite(position.getZ(k)))
    }
    triangles += reference.triangles.length
    panels++
  }
  fabrics += data.materials.length
  if (project === shirt) {
    assert.equal(data.materials[0].alphaMode, 'BLEND')
    assert.ok(Math.abs(data.materials[0].pbrMetallicRoughness.baseColorFactor[3] - .35) < 1e-9)
  }
  assert.equal(native(project, 'export-flat-gltf', { segmentsPerCurve: 8, resolution: 0 }).gltf,
    exported.gltf, 'glTF export must be deterministic')
  assert.deepEqual(project, original, 'glTF export modified source project')
  assert.equal(native(project, 'export-flat-gltf', { resolution: 9 }).ok, false,
    'unbounded resolution must be rejected')
}
console.log(JSON.stringify({ pass: true, implementation: 'C++17 glTF 2.0',
  projects: 2, panels, triangles, fabrics, threeLoaderParse: true,
  embeddedBufferBytesValid: true, sourcePreserved: true,
  deterministic: true, fitAccepted: false }))
