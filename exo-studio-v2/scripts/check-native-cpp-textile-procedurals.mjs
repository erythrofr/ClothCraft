import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {describeTextileSurface,textileRelief,makeProceduralTextileMaps} from '../src/core/textileProcedurals.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'gs-textile-procedural-')),'runner')
const compiled=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/vendor','-I','native_cpp/core','native_cpp/core/textile_procedurals.cpp','native_cpp/tests/test_textile_procedurals.cpp','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compiled.status,0,compiled.stderr)
const families=['jersey-knit','rib-knit','terry-knit','twill','plain-weave','synthetic','silk','suede','leather','ripstop','velvet','sheer-weave','corduroy']
const fabrics=families.map((family,i)=>({name:['Cotton jersey','Rib Knit','French Terry','Denim Twill','Plain canvas','Polyester','Silk satin','Suede','Leather','Ripstop nylon','Velvet','Organza','Corduroy'][i],surfaceFamily:family,weaveScaleCm:1+i*.27,thickness:.001+i*.00015,colorVariation:i/15,texture:{repeatWidthCm:18+i,repeatHeightCm:23+i,rotationDeg:i*11}}))
const pixels=[[0,0],[1,1],[2,3],[7,14],[27,59],[45,133],[100,65],[127,128],[255,255],[250,12],[23,240],...Array.from({length:64},(_,i)=>[(i*73+19)%256,(i*139+47)%256])]
const cases=[]
for(const fabric of fabrics){cases.push({op:'describe',fabric},{op:'maps',fabric,pixels});for(const [u,v] of [[0,0],[.25,.75],[.333,.777],[1,1],[-.15,.3]])cases.push({op:'relief',family:fabric.surfaceFamily,u,v})}
cases.push({op:'describe',fabric:{}},{op:'describe',fabric:{name:'Jeans',surfaceFamily:'auto'}},{op:'describe',fabric:{name:'Unknown',surfaceFamily:'custom-finish'}},{op:'describe',fabric:{name:'Jersey',weaveScaleCm:null}},{op:'describe',fabric:{name:'Silk',weaveScaleCm:'3.1'}},{op:'describe',fabric:{name:'Ripstop',weaveScaleCm:200}})
const native=spawnSync(binary,[],{cwd:root,input:JSON.stringify({cases}),encoding:'utf8',maxBuffer:16*1024*1024})
assert.equal(native.status,0,native.stderr)
const actual=JSON.parse(native.stdout)
assert.equal(actual.length,cases.length)
function close(a,b,label){if(typeof a==='number'){assert.ok(Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(a)),label+' '+a+' != '+b);return}if(Array.isArray(a)){assert.equal(a.length,b.length,label);a.forEach((x,i)=>close(x,b[i],label+' '+i));return}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),label);for(const key of Object.keys(a))close(a[key],b[key],label+'.'+key);return}assert.deepEqual(a,b,label)}
let passed=0;const mismatches=[]
for(let i=0;i<cases.length;i++){
 const q=cases[i],v=actual[i];let expected
 if(q.op==='describe')expected=describeTextileSurface(q.fabric)
 else if(q.op==='relief')expected=textileRelief(q.family,q.u,q.v)
 else continue
 try{assert.equal(v.ok,true);close(expected,v.result,'case '+i);passed++}catch(e){mismatches.push({case:i,error:e.message})}
}
// Install a minimal canvas stand-in and compare the pixels written by the real JS function.
const originalDocument=globalThis.document
globalThis.document={createElement:()=>{const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(image){this.canvasData=image.data}};return {width:0,height:0,getContext:()=>context}}}
try{
 for(let i=0;i<cases.length;i++){
  const q=cases[i];if(q.op!=='maps')continue
  const js=makeProceduralTextileMaps(q.fabric)
  const observed={family:js.family,tileCm:js.tileCm,repeat:{x:js.colorMap.repeat.x,y:js.colorMap.repeat.y},rotation:js.colorMap.rotation,samples:q.pixels.map(([x,y])=>{const index=(y*256+x)*4;const channels=['colorMap','normalMap','roughnessMap'].map(name=>Array.from(js[name].image.getContext('2d').canvasData.slice(index,index+4)));return {color:channels[0],normal:channels[1],roughness:channels[2]}})}
  const nativeResult=v=>v.result
  try{
   const cpp=nativeResult(actual[i]);delete cpp.samples[0]?.height
   // Height buffers are C++-only; browser source internally uses Float32Array without exposing them.
   for(const sample of cpp.samples)delete sample.height
   close(observed,cpp,'map '+i);passed++
  }catch(e){mismatches.push({case:i,error:e.message})}
 }
}finally{globalThis.document=originalDocument}
console.log(JSON.stringify({passed,total:cases.length,mismatches:mismatches.slice(0,12)},null,2))
if(mismatches.length)process.exitCode=1
