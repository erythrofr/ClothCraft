import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root=path.resolve('public/references/zozo-dress')
const metadata=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'))
const mesh=JSON.parse(fs.readFileSync(path.join(root,'meshes.json'),'utf8'))
const audit=JSON.parse(fs.readFileSync('logs/ppf-upstream-full-audit-20261014.json','utf8'))
const obj='research/oss/Codim-IPC/Projects/FEMShell/input/dress_knife/stage.obj'
const hash=crypto.createHash('sha256').update(fs.readFileSync(obj)).digest('hex')

assert.equal(metadata.format,'garment-studio.zozo-reference-dress.v1')
assert.equal(metadata.originalObjSha256,hash)
assert.equal(metadata.clothVertices,15656)
assert.equal(metadata.bodyVertices,12811)
assert.equal(metadata.vertexCount,28467)
assert.equal(metadata.frames,241)
assert.equal(metadata.stitchConstraints,851)
assert.equal(metadata.accepted,false)
assert.equal(metadata.fullPhysicalFitVerified,false)
assert.equal(metadata.sweptCCDVerified,false)
assert.equal(mesh.clothPanels.length,14)
assert.equal(mesh.clothPanels.reduce((sum,p)=>sum+p.indices.length,0),29456*3)
assert.equal(mesh.bodyIndices.length,25472*3)
assert.equal(new Set(mesh.clothPanels.flatMap(p=>p.indices)).size,15656)
assert.ok(mesh.clothPanels.every(p=>p.indices.length>0 && p.indices.length%3===0))
assert.ok(mesh.clothPanels.every(p=>p.indices.every(i=>i>=0&&i<15656)))
assert.ok(mesh.bodyIndices.every(i=>i>=15656&&i<28467))
assert.deepEqual(metadata.failedFrames,[{frame:87,pairs:2},{frame:90,pairs:492},{frame:174,pairs:2}])
assert.equal(metadata.maxBodyIntersectionPairs,492)
assert.deepEqual(metadata.audits.map(row=>row.bodyCrossings),audit.perFrame.map(row=>row.bodyCrossings))

const bin=fs.readFileSync(path.join(root,'frames.bin'))
assert.equal(bin.subarray(0,8).toString('ascii'),'GSDRESS1')
assert.equal(bin.readUInt32LE(8),1)
assert.equal(bin.readUInt32LE(12),metadata.vertexCount)
assert.equal(bin.readUInt32LE(16),metadata.frames)
assert.equal(bin.readUInt32LE(20),metadata.frameRate)
assert.equal(bin.readUInt32LE(24),metadata.bodyVertices)
assert.equal(bin.byteLength,28+metadata.vertexCount*metadata.frames*12)

const run=JSON.parse(fs.readFileSync('logs/ppf-upstream-fitting-full-20261014.json','utf8'))
for (const frame of [0,1,87,90,174,240]) {
  const native=fs.readFileSync(path.join(run.sessionPath,'output',`vert_${frame}.bin`))
  const offset=28+frame*metadata.vertexCount*12
  assert.deepEqual(bin.subarray(offset,offset+native.length),native,`Native frame ${frame} must have no processing/retargeting`)
}
console.log(JSON.stringify({pass:true,source:'original ZOZO/Codim-IPC dress',panels:14,stitches:851,frames:241,
  savedVertexPositionsIdenticalToOriginalSolver:true,clothingTriangles:29456,
  allRecordedIntersectionFailuresPreserved:true,accepted:false},null,2))
