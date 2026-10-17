import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync,mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'

// Exercise the actual JS loader without Vite's import.meta.env override,
// serving the original local bundle via an in-memory fetch response.
const root=resolve('public/references/zozo-dress')
const source=readFileSync('src/core/zozoReferenceDress.js','utf8')
  .replace('import.meta.env.BASE_URL',JSON.stringify('/'))
const load= (await import('data:text/javascript;base64,'+
  Buffer.from(source).toString('base64'))).loadZozoDressReference
const previousFetch=globalThis.fetch
globalThis.fetch=async(url)=>{
  assert.ok(String(url).startsWith('/references/zozo-dress/'),url)
  const path=resolve(root,String(url).split('/').at(-1))
  const data=readFileSync(path)
  return {ok:true,status:200,async json(){return JSON.parse(data.toString('utf8'))},
    async arrayBuffer(){return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)}}
}
let js
try{js=await load()}finally{globalThis.fetch=previousFetch}
assert.equal(js.manifest.accepted,false)
assert.equal(js.manifest.fullPhysicalFitVerified,false)
const bin=resolve(mkdtempSync(resolve(tmpdir(),'gs-zozo-ref-native-')),'runner')
const compile=spawnSync('c++',['-std=c++17','-O2','-Wall','-Wextra','-Wpedantic',
  '-I','native_cpp/vendor','-I','native_cpp/core',
  'native_cpp/core/zozo_reference_dress.cpp',
  'native_cpp/tests/test_zozo_reference_dress.cpp',
  '-o',bin],{encoding:'utf8'})
assert.equal(compile.status,0,compile.stderr)
const run=spawnSync(bin,[root,'--json'],{encoding:'utf8',maxBuffer:16*1024*1024})
assert.equal(run.status,0,run.stderr)
const native=JSON.parse(run.stdout)
assert.deepEqual(native.manifest,js.manifest)
assert.deepEqual(native.meshes,js.meshes)
assert.equal(native.accepted,false)
assert.equal(native.fullPhysicalFitVerified,false)
for(const row of native.frames) {
  const xyz=js.frameVertices(row.frame)
  const bits=new Uint32Array(xyz.buffer,xyz.byteOffset,xyz.length)
  assert.deepEqual(row.sampleBits,native.sampleCoordinates.map(index=>bits[index]),
    `Float32 bit parity for original ZOZO frame ${row.frame}`)
}
for(const frame of [-1,241,243]){
  assert.throws(()=>js.frameVertices(frame),/outside recorded trajectory/)
}
console.log('Original ZOZO dress reference: native C++/JS manifest and 14-panel mesh exact, 6 original frames Float32-bit parity, unsafe-fit labels preserved')
