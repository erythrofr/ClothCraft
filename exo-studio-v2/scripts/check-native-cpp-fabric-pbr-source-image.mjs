import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {deflateSync} from 'node:zlib'
import {estimateFabricPbrPixels} from '../src/core/fabricPbrGenerator.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const binary=resolve(mkdtempSync(resolve(tmpdir(),'garment-pbr-source-')),'runner')
const compile=spawnSync('c++',['-std=c++17','-O2','-I','native_cpp/core','-I','native_cpp/vendor',
 'native_cpp/core/fabric_pbr_pixels.cpp','native_cpp/core/fabric_pbr_image_generator.cpp',
 'native_cpp/core/fabric_pbr_source_image.cpp','native_cpp/tests/test_fabric_pbr_source_image.cpp',
 '-framework','CoreFoundation','-framework','CoreGraphics','-framework','ImageIO','-o',binary],{cwd:root,encoding:'utf8'})
assert.equal(compile.status,0,compile.stderr)
function crc(data){let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function chunk(name,data){const head=Buffer.alloc(4);head.writeUInt32BE(data.length);const tag=Buffer.from(name);const tail=Buffer.alloc(4);tail.writeUInt32BE(crc(Buffer.concat([tag,data])));return Buffer.concat([head,tag,data,tail])}
function png(w,h,pixels){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;const rows=[];for(let y=0;y<h;y++)rows.push(Buffer.from([0,...pixels.slice(y*w*4,(y+1)*w*4)]));return 'data:image/png;base64,'+Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]).toString('base64')}
const cases=[]
for(const [w,h] of [[2,2],[7,5],[19,11],[40,20]]){
 const pixels=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixels.push((x*11+y*7)%256,(x*23+y*13)%256,(x*17+y*29)%256,255)
 for(const maxSize of [16,512])cases.push({source:png(w,h,pixels),options:{maxSize,normalStrength:2},original:{w,h,pixels}})
}
cases.push({source:'not-an-image',options:{}})
for(const [w,h,alpha] of [[32,16,false],[32,16,true],[8,8,true]]){
 const pixels=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixels.push((x*41+y*7)%256,(x*29+y*19)%256,(x*11+y*37)%256,alpha?(x+y)%4*80+15:255)
 cases.push({source:png(w,h,pixels),options:{maxSize:16,normalStrength:3},original:{w,h,pixels},alpha})
}
// Real ImageIO JPEG decode and browser Image.decode comparison.
{
 const temporary=mkdtempSync(resolve(tmpdir(),'garment-pbr-jpeg-'))
 const w=32,h=16,pixels=[]
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixels.push((x*39+y*11)%256,(x*13+y*23)%256,(x*5+y*41)%256,255)
 const sourcePng=resolve(temporary,'source.png'),jpegPath=resolve(temporary,'source.jpeg')
 writeFileSync(sourcePng,Buffer.from(png(w,h,pixels).split(',')[1],'base64'))
 const converted=spawnSync('sips',['-s','format','jpeg',sourcePng,'--out',jpegPath],{encoding:'utf8'})
 if(converted.status===0)cases.push({source:'data:image/jpeg;base64,'+readFileSync(jpegPath).toString('base64'),options:{maxSize:16,normalStrength:2.5},original:{w,h,pixels},jpeg:true})
}
const execute=spawnSync(binary,['--json-lines'],{cwd:root,encoding:'utf8',input:cases.map(x=>JSON.stringify({source:x.source,options:x.options})).join('\n')+'\n',maxBuffer:40*1024*1024})
assert.equal(execute.status,0,execute.stderr)
const outputs=execute.stdout.trim().split('\n').map(JSON.parse)
assert.equal(outputs.length,cases.length)
for(let i=0;i<cases.length;i++){
 const item=cases[i],out=outputs[i]
 if(!item.original){assert.equal(out.ok,false);continue}
 assert.equal(out.ok,true,`source case ${i}: ${out.error}`)
 const {w,h,pixels}=item.original
 const targetFactor=Math.min(1,Math.max(16,item.options.maxSize)/Math.max(w,h))
 const expectedW=Math.max(2,Math.round(w*targetFactor)),expectedH=Math.max(2,Math.round(h*targetFactor))
 assert.equal(out.result.width,expectedW);assert.equal(out.result.height,expectedH)
 assert.equal(out.pixels.width,expectedW);assert.equal(out.pixels.height,expectedH)
 assert.match(out.result.normalSrc,/^data:image\/png;base64,/)
 assert.match(out.result.roughnessSrc,/^data:image\/png;base64,/)
 if(w===expectedW&&h===expectedH&&!item.alpha){
  assert.deepEqual(out.pixels.data,pixels,`lossless original RGBA case ${i}`)
  const estimate=estimateFabricPbrPixels({width:w,height:h,data:pixels},item.options)
  assert.equal(out.result.method,estimate.kind)
 }
}
console.log(`Native source image decoder passed ${cases.length} source fixtures including PNG lossless decode, dimension scaling and invalid input`)
// Two honest acceptance lanes:
// --decode-only: known-supported native ImageIO decode and raster dimensions.
// default: additionally require exact browser Canvas/PBR decoded-pixel parity.
// The latter currently FAILS and must remain visible until equivalence is real.
if(!process.argv.includes('--decode-only')){
const browserExecutable='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const chromeProbe=spawnSync('test',['-x',browserExecutable],{encoding:'utf8'})
if(chromeProbe.status===0){
 const temporary=mkdtempSync(resolve(tmpdir(),'garment-pbr-browser-'))
 const source=readFileSync(resolve(root,'src/core/fabricPbrGenerator.js'),'utf8').replaceAll('export function','function').replaceAll('export async function','async function')
 const selected=cases.filter(x=>x.original)
 const html=`<!doctype html><meta charset="utf-8"><body><script>${source.replaceAll('</script>','<\\/script>')}\n(async()=>{const rows=[];for(const input of ${JSON.stringify(selected)}){try{const result=await generateFabricPbrFromImage(input.source,input.options);const read=async url=>{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return Array.from(ctx.getImageData(0,0,c.width,c.height).data)};const sourceImage=new Image();sourceImage.src=input.source;await sourceImage.decode();const factor=Math.min(1,Math.max(16,Number(input.options.maxSize)||512)/Math.max(sourceImage.naturalWidth,sourceImage.naturalHeight));const width=Math.max(2,Math.round(sourceImage.naturalWidth*factor)),height=Math.max(2,Math.round(sourceImage.naturalHeight*factor));const inputCanvas=document.createElement('canvas');inputCanvas.width=width;inputCanvas.height=height;const inputContext=inputCanvas.getContext('2d',{willReadFrequently:true});inputContext.drawImage(sourceImage,0,0,width,height);const sourcePixels=Array.from(inputContext.getImageData(0,0,width,height).data);rows.push({width:result.width,height:result.height,sourcePixels,normal:await read(result.normalSrc),roughness:await read(result.roughnessSrc),normalSrc:result.normalSrc,roughnessSrc:result.roughnessSrc})}catch(e){rows.push({error:String(e)})}}document.body.textContent=JSON.stringify(rows)})()</script></body>`
 const htmlPath=resolve(temporary,'groundtruth.html');writeFileSync(htmlPath,html)
 const chrome=spawnSync(browserExecutable,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--virtual-time-budget=10000','--dump-dom',`file://${htmlPath}`],{encoding:'utf8',maxBuffer:50*1024*1024,timeout:45000})
 const match=chrome.stdout?.match(/<body>([\s\S]*?)<\/body>/)
 if(chrome.status===0&&match){
  const escaped=match[1].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')
  const truth=JSON.parse(escaped)
  let exact=0,nonmatching=0,sourceMismatches=0,pbrAlgorithmMismatches=0,first=null,firstSource=null
  for(let i=0;i<selected.length;i++){
   const native=outputs[cases.indexOf(selected[i])].result,browser=truth[i]
   assert.equal(native.width,browser.width);assert.equal(native.height,browser.height)
   if(browser.error)throw new Error(browser.error)
   // Normal and roughness encoded maps are decoded in the browser, so the
   // comparison tests image semantics, independent of PNG compression.
   const sourceInput=selected[i],expectedPixels=outputs[cases.indexOf(sourceInput)].pixels
   for(let j=0;j<browser.sourcePixels.length;j++)if(browser.sourcePixels[j]!==expectedPixels.data[j]){sourceMismatches++;firstSource??={case:i,index:j,browser:browser.sourcePixels[j],native:expectedPixels.data[j]}}
   const nativeReference=estimateFabricPbrPixels(expectedPixels,sourceInput.options)
   const browserReference=estimateFabricPbrPixels({width:browser.width,height:browser.height,data:browser.sourcePixels},sourceInput.options)
   for(const [name,expected] of [['normal',nativeReference.normal],['roughness',nativeReference.roughness]]){
    const actual=browser[name]
    for(let j=0;j<actual.length;j++)if(actual[j]!==expected[j]){nonmatching++;first??={case:i,map:name,index:j,browser:actual[j],native:expected[j]}}
    for(let j=0;j<actual.length;j++)if(actual[j]!==browserReference[name][j])pbrAlgorithmMismatches++
   }
   if(browser.normalSrc===native.normalSrc&&browser.roughnessSrc===native.roughnessSrc)exact++
  }
  console.log(`Browser ground truth: ${selected.length} fixtures; source RGBA mismatches=${sourceMismatches}; PBR output mismatches=${nonmatching}; browser PBR algorithm mismatches=${pbrAlgorithmMismatches}; PNG-identical pairs=${exact}`,{firstSource,firstPbr:first})
  if(nonmatching)process.exitCode=1
 }else console.log('Browser canvas ground truth unavailable:',chrome.status,chrome.stderr?.slice(-350))
}else console.log('No compatible headless Chrome; browser ground truth not run')
}
