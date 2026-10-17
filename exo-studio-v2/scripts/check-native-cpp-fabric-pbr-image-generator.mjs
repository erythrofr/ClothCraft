import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {inflateSync} from 'node:zlib'
import {estimateFabricPbrPixels} from '../src/core/fabricPbrGenerator.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'garment-pbr-image-')),'runner')
const compile=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor',
  'native_cpp/core/fabric_pbr_pixels.cpp',
  'native_cpp/core/fabric_pbr_image_generator.cpp',
  'native_cpp/tests/test_fabric_pbr_image_generator.cpp','-o',binary],
{cwd:root,encoding:'utf8'})
assert.equal(compile.status,0,compile.stderr)

function pngPixels(url) {
  assert.ok(url.startsWith('data:image/png;base64,'))
  const png=Buffer.from(url.slice(22),'base64')
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
  const w=png.readUInt32BE(16),h=png.readUInt32BE(20)
  assert.equal(png[24],8)
  assert.equal(png[25],6)
  const chunks=[]
  for(let i=8;i<png.length;) {
    const len=png.readUInt32BE(i),type=png.toString('ascii',i+4,i+8)
    if(type==='IDAT')chunks.push(png.subarray(i+8,i+8+len))
    i+=12+len
  }
  const raw=inflateSync(Buffer.concat(chunks)),data=[]
  for(let y=0;y<h;y++){
    const base=y*(w*4+1)
    assert.equal(raw[base],0)
    data.push(...raw.subarray(base+1,base+1+w*4))
  }
  return {width:w,height:h,data}
}
function image(width,height,mode){
  const data=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4
    for(let c=0;c<4;c++)data[i+c]=c===3?255:
      mode===0?128:mode===1?(x%2?255:0):
      mode===2?((x+y)%2?240:15):
      mode===3?((x*71+y*37+c*53)%256):(x*17+y*39+c*101)%256
  }
  return {width,height,data:[...data]}
}
const cases=[]
for(const [width,height] of [[2,2],[3,4],[8,6],[17,9],[33,25]]) {
 for(let mode=0;mode<5;mode++)for(const normalStrength of [.1,2,4.4,8]){
  cases.push({imageData:image(width,height,mode),options:{normalStrength}})
 }
}
// JS generateFabricPbrFromImage computes output dimensions using source pixel
// dimensions and maxSize before drawing. These fixtures supply that drawn raster.
cases.push({imageData:{...image(16,8,3),sourceWidth:64,sourceHeight:32},options:{maxSize:16}})
cases.push({imageData:{...image(2,2,1),sourceWidth:2,sourceHeight:2},options:{maxSize:512}})
const execute=spawnSync(binary,['--json-lines'],{cwd:root,encoding:'utf8',
 input:cases.map(JSON.stringify).join('\n')+'\n',maxBuffer:32*1024*1024})
assert.equal(execute.status,0,execute.stderr)
const outputs=execute.stdout.trim().split('\n')
assert.equal(outputs.length,cases.length)
for(let i=0;i<cases.length;i++){
 const input=cases[i],actual=JSON.parse(outputs[i])
 assert.equal(actual.ok,true,`case ${i}: ${actual.error}`)
 const expected=estimateFabricPbrPixels(input.imageData,input.options)
 assert.deepEqual(pngPixels(actual.result.normalSrc),{
  width:expected.width,height:expected.height,data:[...expected.normal]},`normal case ${i}`)
 assert.deepEqual(pngPixels(actual.result.roughnessSrc),{
  width:expected.width,height:expected.height,data:[...expected.roughness]},`roughness case ${i}`)
 assert.equal(actual.result.method,'estimated-from-albedo')
}
console.log(`Native image PBR PNG maps match JavaScript pixel outputs for ${cases.length} raster fixtures`)
console.log('Unported browser semantics: source image data URL decode, canvas scaling/resampling, canvas PNG encoder byte identity')
