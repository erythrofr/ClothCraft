import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'

const binary=process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
function run(project,op,resolution=0) {
  const child=spawnSync(binary,{input:JSON.stringify({
    protocol:'garment-studio.native-cad.v1',document:project,op,
    args:{resolution,segmentsPerCurve:8}})+'\n',encoding:'utf8',maxBuffer:64*1024*1024})
  if(child.error) throw child.error
  assert.equal(child.status,0,child.stderr)
  return JSON.parse(child.stdout.trim())
}

let totalPatterns=0,totalTriangles=0,totalUVs=0
for(const project of [createDefaultProject(),createZipHoodieTemplate()]) {
  const snapshot=structuredClone(project)
  const mesh=run(project,'mesh-project')
  const obj=run(project,'export-flat-obj')
  assert.equal(mesh.ok,true,mesh.error)
  assert.equal(obj.ok,true,obj.error)
  assert.equal(obj.fitAccepted,false,'flat OBJ is not a fitted garment')
  assert.equal(obj.units,'cm')
  assert.ok(obj.obj.startsWith('# Garment Studio native C++ flat pattern export'))
  assert.ok(obj.obj.includes('# rest geometry ONLY'))
  const scene=new OBJLoader().parse(obj.obj)
  assert.equal(scene.children.length,mesh.meshes.length)
  for(let i=0;i<mesh.meshes.length;i++) {
    const entry=mesh.meshes[i],loaded=scene.children[i]
    assert.equal(loaded.name,entry.pieceId)
    assert.equal(loaded.geometry.getAttribute('position').count,entry.triangles.length*3)
    assert.equal(loaded.geometry.getAttribute('uv').count,entry.triangles.length*3)
    assert.ok(loaded.geometry.getAttribute('position').array.every(Number.isFinite))
    assert.ok(loaded.geometry.getAttribute('uv').array.every(Number.isFinite))
    for(let k=2;k<loaded.geometry.getAttribute('position').count*3;k+=3)
      assert.equal(loaded.geometry.getAttribute('position').array[k],0,'flat rest mesh Z must remain zero')
    const originalPiece=project.pieces.find(piece=>piece.id===entry.pieceId)
    assert.equal(loaded.material.name,originalPiece.fabricId || 'main')
    totalPatterns++
    totalTriangles+=entry.triangles.length
    totalUVs+=loaded.geometry.getAttribute('uv').count
  }
  assert.equal(obj.obj,run(project,'export-flat-obj').obj,'OBJ nondeterministic')
  assert.deepEqual(project,snapshot,'OBJ export changed source')
  const invalid=run(project,'export-flat-obj',9)
  assert.equal(invalid.ok,false,'OBJ accepted unsupported excessive subdivision level')
}
console.log(JSON.stringify({pass:true,implementation:'C++17 Wavefront OBJ',
  patterns:totalPatterns,triangles:totalTriangles,uvs:totalUVs,
  objLoaderParse:true,sourcePreserved:true,fitAccepted:false}))
