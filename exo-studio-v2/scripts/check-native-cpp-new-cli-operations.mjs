import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createTemplateProject } from '../src/data/templates.js'
import { gradePiece } from '../src/core/grading.js'
import { estimateFabricPbrPixels } from '../src/core/fabricPbrGenerator.js'
import { assembleNativeSeams, inspectStagedAvatarContact } from '../src/core/backends/seamAssembly.js'
import { buildSimulation } from '../src/core/physics.js'
import { inspectNativeAssemblyPose } from '../src/core/backends/nativeAssemblyPreflight.js'
import { assessNativeSolverResult } from '../src/core/backends/nativeServiceBackend.js'

const binary = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const document = createTemplateProject('tee')
const seamPayload = {
  avatar: { heightCm: 180 }, particles: [
    { id: 0, pieceId: 'front', position: [0.31, 1.55, 0.2], previous: [0.31, 1.55, 0.2], invMass: 1 },
    { id: 1, pieceId: 'front', position: [0.32, 1.55, 0.2], previous: [0.32, 1.55, 0.2], invMass: 1 },
    { id: 2, pieceId: 'front', position: [0.31, 1.56, 0.2], previous: [0.31, 1.56, 0.2], invMass: 1 },
    { id: 3, pieceId: 'back', position: [0.34, 1.55, 0.2], previous: [0.34, 1.55, 0.2], invMass: 1 },
    { id: 4, pieceId: 'back', position: [0.35, 1.55, 0.2], previous: [0.35, 1.55, 0.2], invMass: 1 },
    { id: 5, pieceId: 'back', position: [0.34, 1.56, 0.2], previous: [0.34, 1.56, 0.2], invMass: 1 },
  ], pieces: [
    { id: 'front', particleIndices: [0, 1, 2],
      flatVerticesM: [[0, 0, 0], [.01, 0, 0], [0, .01, 0]], faces: [[0, 1, 2]] },
    { id: 'back', particleIndices: [3, 4, 5],
      flatVerticesM: [[0, 0, 0], [.01, 0, 0], [0, .01, 0]], faces: [[0, 1, 2]] },
  ], constraints: [{ type: 'seam', a: 1, b: 3, seamId: 'armhole' }], virtualSeams: [],
}
const requests = [
  ['garment-code-export', {}],
  ['grade-helper', { method: 'gradePiece', piece: document.pieces[0], grading: document.grading, size: 'L' }],
  ['fabric-estimate-pbr-pixels', { imageData: { width: 2, height: 2,
    data: [128, 128, 128, 255, 128, 128, 128, 255,
      255, 255, 255, 255, 0, 0, 0, 255] } }],
  ['avatar-mesh-collider', { avatar: { meshes: [{ name: 'Body',
    vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 2]] }] } }],
  ['avatar-physics', { method: 'getAvatarHeightScale', avatar: document.avatar }],
  ['ppf-fabric-preset', { fabric: { id: 'washed-denim' } }],
  ['native-quality-profiles', {}],
  ['seamly-parse-measurements', { xml: "<smis><unit>cm</unit><body-measurements><m name='height' value='175'/></body-measurements></smis>" }],
  ['cloth-mesh-from-project', {}],
  ['cloth-seams-from-project', {}],
  ['native-seam-staged-contact', { payload: seamPayload }],
  ['native-seam-assemble', { payload: seamPayload, options: { iterations: 2 } }],
  ['native-assembly-preflight', { payload: seamPayload }],
  ['native-assess-solver-result', { result: { stats: { finite: false, fullMeshEdgeStrainMax: .05, seamMaxDistance: .04 } } }],
  ['native-seam-assemble', { payload: seamPayload, options: { contactConstrained: true } }],
]
const input = requests.map(([op, args]) => JSON.stringify({
  protocol: 'garment-studio.native-cad.v1', document, op, args,
})).join('\n') + '\n'
const child = spawnSync(binary, [], { input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
if (child.error) throw child.error
assert.equal(child.status, 0, child.stderr)
const outputs = child.stdout.trim().split('\n').map(x => JSON.parse(x))
assert.equal(outputs.length, requests.length)
for (let i = 0; i < outputs.length - 1; i++) assert.equal(outputs[i].op, requests[i][0])
for (let i = 0; i < outputs.length - 1; i++) assert.equal(outputs[i].ok, true, `${requests[i][0]}: ${outputs[i].error}`)
assert.ok(Object.keys(outputs[0].garmentCode.pattern.panels).length > 0)
const expectedGrade = gradePiece(document.pieces[0], document.grading, 'L')
assert.deepEqual(outputs[1].value, expectedGrade)
const expectedPbr = estimateFabricPbrPixels(requests[2][1].imageData)
assert.deepEqual(outputs[2].maps.normal, [...expectedPbr.normal])
assert.deepEqual(outputs[2].maps.roughness, [...expectedPbr.roughness])
assert.equal(outputs[3].collider.triangleCount, 1)
assert.ok(outputs[4].value > 0)
assert.equal(outputs[5].preset.preset, 'Denim')
assert.equal(outputs[6].profiles.quality.clothModel, 'strain-triangle')
assert.equal(outputs[7].library.measurements.height.baseCm, 175)
const originalMesh = buildSimulation(document)
const flatNative = outputs[8].mesh.pieces
assert.equal(flatNative.length, originalMesh.pieces.size)
for (let i = 0; i < flatNative.length; i++) {
  const cpp = flatNative[i]
  const js = [...originalMesh.pieces.values()][i]
  assert.deepEqual(cpp.faces, js.faces, `indexed triangle parity ${cpp.id}`)
  assert.equal(cpp.flatVertices.length, js.flatVertices.length)
  for(let j=0; j<cpp.flatVertices.length; j++) {
    assert.ok(Math.hypot(cpp.flatVertices[j].x-js.flatVertices[j].x,
      cpp.flatVertices[j].y-js.flatVertices[j].y)<1e-8)
  }
}
const nativeStitches=outputs[9].constraints
const simulationParticles=new Map([...originalMesh.pieces.values()]
  .flatMap(piece=>piece.particles.map((particle,index)=>[particle,{pieceId:piece.id,index}])))
const expectedSeams=originalMesh.seamConstraints.filter(c=>c.type==='seam')
assert.equal(nativeStitches.seamConstraints.length,expectedSeams.length)
for(let i=0;i<expectedSeams.length;i++) {
  const js=expectedSeams[i],cpp=nativeStitches.seamConstraints[i]
  assert.equal(cpp.seamId,js.seamId)
  assert.equal(cpp.aPieceId,simulationParticles.get(js.a).pieceId)
  assert.equal(cpp.bPieceId,simulationParticles.get(js.b).pieceId)
  assert.equal(cpp.aIndex,simulationParticles.get(js.a).index)
  assert.equal(cpp.bIndex,simulationParticles.get(js.b).index)
  assert.ok(Math.abs(cpp.stiffness-js.stiffness)<1e-10)
}
assert.equal(nativeStitches.anchorConstraints.length,originalMesh.anchorConstraints.length)
assert.equal(nativeStitches.fullParity,false)
assert.equal(outputs[10].report.sweptCollisionCertified, false)
assert.equal(outputs[10].report.checked, inspectStagedAvatarContact(seamPayload).checked)
assert.equal(outputs[11].assembly.assemblyExperiment.collisionCertified, false)
const jsAssembly = assembleNativeSeams(seamPayload, { iterations: 2 })
const nativePositions = outputs[11].assembly.particles.map(p => p.position)
const jsPositions = jsAssembly.particles.map(p => p.position)
for (let i = 0; i < nativePositions.length; i++) for (let axis = 0; axis < 3; axis++)
  assert.ok(Math.abs(nativePositions[i][axis] - jsPositions[i][axis]) < 1e-8,
    `Native seam position mismatch at particle ${i}, axis ${axis}`)
assert.deepEqual(outputs[12].report, inspectNativeAssemblyPose(seamPayload))
assert.equal(outputs[12].report.simulationFitApproved, false)
assert.deepEqual(outputs[13].assessment, assessNativeSolverResult(requests[13][1].result))
assert.equal(outputs[13].assessment.status, 'FAILED')
assert.equal(outputs[14].ok, false)
assert.match(outputs[14].error, /require a supplied full avatar solver adapter/i)
console.log('Native CLI integration passed: 14 native operations including tee mesh and seam/anchor compilation, preflight, solver result acceptance, and unsupported contact-constrained rejection')
