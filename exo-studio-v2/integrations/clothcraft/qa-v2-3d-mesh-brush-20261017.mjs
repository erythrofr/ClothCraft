// Disposable Rust garment browser acceptance for the CLO 3D A03 brush.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-3d-brush-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const nativePort='5415',uiPort='5416',native=`http://127.0.0.1:${nativePort}`,url=`http://127.0.0.1:${uiPort}`
const children=[]
function launch(binary,args,env={}){
  const child=spawn(binary,args,{cwd:root,detached:true,stdio:'ignore',env:{...process.env,...env}})
  children.push(child)
}
async function ready(target){
  for(let i=0;i<130;i++){
    try{if((await fetch(target,{signal:AbortSignal.timeout(1200)})).ok)return}catch{}
    await new Promise(resolve=>setTimeout(resolve,180))
  }
  throw Error(`QA fixture failed to start ${target}`)
}
let browser
try{
  launch(process.execPath,['integrations/clothcraft/server.mjs'],{
    EXO_CLOTHCRAFT_PORT:nativePort,EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
    EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
    EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
  })
  launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port',uiPort,'--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:native})
  await Promise.all([ready(`${native}/health`),ready(url)])
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(`${url}/?desktop=1&engine=clothcraft`,{waitUntil:'domcontentloaded'})
  await page.locator('.cc-board [data-edge]').first().waitFor({timeout:25000})
  const canvas=page.locator('.cc-scene canvas').first()
  await canvas.waitFor()
  await page.locator('[data-clo-slot="3d:A03"]').click()
  await page.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.meshBrushActive==='true',null,{timeout:8000})
  const box=await canvas.boundingBox()
  assert(box?.width>200&&box?.height>150)
  // Search the garment region from the actual WebGL ray intersections. Each
  // sample performs the same physical canvas click as the human user.
  let count=0
  for(let row=2;row<=8&&!count;row++)for(let col=2;col<=8&&!count;col++){
    await page.mouse.click(box.x+box.width*col/10,box.y+box.height*row/10)
    count=Number(await canvas.getAttribute('data-mesh-brush-selected-count')||0)
  }
  assert(count>0,'A03 click must select real Rust mesh vertices')
  assert(Number(await canvas.getAttribute('data-mesh-brush-highlighted-count'))>0,'selected vertices must render visible highlight geometry')
  assert(Number(await canvas.getAttribute('data-mesh-brush-radius-metres'))>0,'brush radius must be computed from camera geometry')
  const indices=JSON.parse(await canvas.getAttribute('data-mesh-brush-selected-indices'))
  assert.equal(indices.length,count,'selection diagnostics should match actual selected vertex set')
  await page.keyboard.press('Escape')
  assert.equal(Number(await canvas.getAttribute('data-mesh-brush-selected-count')),0,'Escape clears selected mesh vertices')
  assert.equal(Number(await canvas.getAttribute('data-mesh-brush-highlighted-count')),0,'Escape removes rendered selection points')
  // A different 3D toolbar command must deactivate A03 and clear stale points.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-3d-tool',{detail:{tool:'mesh-brush',active:true}})))
  assert.equal(await canvas.getAttribute('data-mesh-brush-active'),'true')
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-3d-tool',{detail:{tool:'select-move',active:false}})))
  assert.equal(await canvas.getAttribute('data-mesh-brush-active'),'false')
  assert.equal(Number(await canvas.getAttribute('data-mesh-brush-selected-count')),0)
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-3d-tool',{detail:{tool:'mesh-brush'}})))
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-mesh-brush',{detail:{active:true,clear:true}})))
  assert.equal(Number(await canvas.getAttribute('data-mesh-brush-selected-count')),0,'explicit reset clears mesh selection')
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-3d-tool',{detail:{tool:'orbit'}})))
  assert.equal(await canvas.getAttribute('data-mesh-brush-active'),'false')
  assert.deepEqual(errors,[],'no page errors')
  console.log('PASS native 3D A03 mesh brush',JSON.stringify({selected:count,indices:indices.slice(0,12),errors}))
}finally{
  await browser?.close()
  for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}
}
