import assert from 'node:assert/strict'
import { decodePpfPreview } from '../ppf_backend/previewFrames.mjs'

const payload = { protocol: 'garment-studio.ppf-shell', shell: {
  vertices: [[0,0,0],[1,0,0],[0,1,0]], faces: [[0,1,2]],
  pieces: [{id:'front',particleIndices:[0,1,2],faceStart:0,faceCount:1}],
}}
const frames=2, verts=3, bytes=Buffer.alloc(32+frames*verts*12)
bytes.write('POINTCACHE2\0',0,'ascii');bytes.writeInt32LE(1,12);bytes.writeInt32LE(verts,16);bytes.writeInt32LE(frames,28)
for(let frame=0;frame<frames;frame++) for(let i=0;i<verts;i++) {
  const off=32+(frame*verts+i)*12
  bytes.writeFloatLE(i,off);bytes.writeFloatLE(-i*0.1,off+4);bytes.writeFloatLE(frame+i*0.2,off+8)
}
const preview=decodePpfPreview(payload,bytes,{jobId:'qa',frame:1,accepted:false})
assert.equal(preview.experimental,true)
assert.equal(preview.jobId,'qa')
assert.deepEqual(preview.pieces[0].faces,[[0,1,2]])
assert.deepEqual(preview.pieces[0].vertices[2],[2,1.399999976158142,0.20000000298023224])
assert.throws(()=>decodePpfPreview(payload,bytes.subarray(0,-1)),/Incomplete/)
assert.throws(()=>decodePpfPreview(payload,bytes,{frame:5}),/out of range/)
assert.throws(()=>decodePpfPreview(payload,{length:5}),/Invalid/)
console.log(JSON.stringify({pass:true,frames,verts,source:'PC2 Blender point cache to Garment Studio coordinates'}))
