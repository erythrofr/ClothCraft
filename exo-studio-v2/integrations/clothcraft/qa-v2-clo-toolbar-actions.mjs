// End-to-end tool-rail acceptance against disposable Rust/Vite workspace.
// Headless Chrome is an isolated QA fixture only; EXO runs to user as .app.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'
import {CLO7_NATIVE_TOOL_CAPABILITIES as inventory} from '../../src/core/clo7NativeToolCapabilities.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-clo-toolbar-actions-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
// The Rust bridge intentionally allowlists local origins. Use the permitted
// disposable fixture pair rather than widening CORS just for this test.
const nativePort='5415',uiPort='5416',native=`http://127.0.0.1:${nativePort}`,url=`http://127.0.0.1:${uiPort}`
const processes=[]
const launch=(bin,args,extra={})=>{
 const child=spawn(bin,args,{cwd:root,detached:true,stdio:'ignore',env:{...process.env,...extra}})
 processes.push(child)
 return child
}
async function ready(target){
 for(let attempt=0;attempt<130;attempt++){
  try{if((await fetch(target,{signal:AbortSignal.timeout(1200)})).ok)return}catch{}
  if(processes.some(p=>p.exitCode!==null))throw Error('QA process exited while waiting for '+target)
  await new Promise(resolve=>setTimeout(resolve,180))
 }
 throw Error('QA fixture unavailable '+target)
}
let browser
try{
 launch(process.execPath,['integrations/clothcraft/server.mjs'],
  {EXO_CLOTHCRAFT_PORT:nativePort,EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
   EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
   EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0'})
 launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port',uiPort,'--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:native})
 await Promise.all([ready(native+'/health'),ready(url)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1830,height:1080}}),errors=[]
 page.on('pageerror',err=>errors.push(err.message))
 await page.addInitScript(()=>{
  window.__latestCloStatus=null
  window.addEventListener('exo-clothcraft-status',event=>{window.__latestCloStatus=event.detail})
 })
 await page.goto(url+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 try {
  await page.locator('.cc-board [data-edge]').first().waitFor({timeout:22000})
 } catch(error) {
  const diagnostics={url:page.url(),title:await page.title(),body:(await page.locator('body').innerText()).slice(0,1900),errors,
   rootCount:await page.locator('.cc-embedded-root').count(),boardCount:await page.locator('.cc-board').count()}
  console.error('DISPOSABLE NATIVE QA STARTUP',diagnostics)
  throw error
 }
 const counts={native:0,inspect:0,unavailable:0},examples=[]
 for(const item of inventory){
  // No personal state is mounted: this Vite bridge points at a disposable
  // Rust project in a unique ephemeral QA output folder.
  const control=page.locator(`[data-clo-slot="${item.id}"]`)
  await control.click()
  const panel=page.locator(`[data-clo-detail="${item.id}"]`)
  if(item.mode==='native') {
   assert.equal(await panel.count(),0,'Native action must activate viewport directly without obscuring it')
  } else {
   await panel.waitFor({timeout:10000})
   assert.equal(await panel.getByText(item.label,{exact:true}).count(),1)
   const body=await panel.innerText()
   assert(body.includes(item.mode==='inspect'?'Existing EXO inspection workflow':'Requires additional native implementation'),item.id+' shows wrong status')
   assert.equal(await panel.getByRole('button',{name:`Run ${item.label}`}).count(),0,item.id+' incorrectly offers executable command')
   await panel.getByRole('button',{name:'Close tool information'}).click()
  }
  assert.equal(await control.getAttribute('data-clo-implementation'),item.mode,item.id+' implementation status')
  counts[item.mode]++
  if(examples.length<5)examples.push([item.id,item.label,item.mode])
  if(item.id==='3d:A01')await control.click() // leave disposable solver paused
 }
 assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),70)

 // Validate three real, separate native tool modes rather than merely
 // checking whether a button is styled as clicked.
 const mode=()=>page.evaluate(()=>window.__latestCloStatus?.mode)
 async function waitMode(expected){
  await page.waitForFunction(expected=>window.__latestCloStatus?.mode===expected,expected,{timeout:18000})
  assert.equal(await mode(),expected)
 }
 await page.locator('[data-clo-slot="2d:A04"]').click()
 await waitMode('pen')
 assert(await page.getByRole('button',{name:/Close pattern/}).count()>0,'Polygon must activate real drafting controls')
 await page.locator('[data-clo-slot="2d:A05"]').click()
 await waitMode('line')
 assert(await page.getByRole('button',{name:/Create internal line/}).count()>0,'Native line mode must render actionable drafting controls')
 await page.locator('[data-clo-slot="2d:B02"]').click()
 await waitMode('sew')
 await page.locator('[data-clo-slot="3d:A02"]').click()
 await waitMode('move3d')
 await page.locator('[data-clo-slot="2d:A01"]').click()
 await waitMode('edit')
 // Prove polygon is not a dummy mode: author actual Rust panel topology in
 // the disposable project, check increased panel count, then native Undo.
 const panelCount=await page.evaluate(()=>window.__latestCloStatus?.panels)
 await page.locator('[data-clo-slot="2d:A04"]').click()
 await waitMode('pen')
 const drafting=await page.locator('.cc-board svg').boundingBox()
 assert(drafting?.width>200&&drafting?.height>200)
 for(const [x,y] of [[.10,.18],[.22,.18],[.16,.30]])
  await page.mouse.click(drafting.x+drafting.width*x,drafting.y+drafting.height*y)
 const complete=page.getByRole('button',{name:/Close pattern \(3\)/})
 await complete.waitFor({timeout:8000})
 await complete.click()
 await page.waitForFunction(count=>window.__latestCloStatus?.panels===count+1,panelCount,{timeout:15000})
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'undo'})))
 await page.waitForFunction(count=>window.__latestCloStatus?.panels===count,panelCount,{timeout:15000})
 await page.locator('[data-clo-slot="2d:A12"]').click()
 const measurementHelp=page.getByRole('region',{name:'Point of Measure tool information'})
 await measurementHelp.waitFor()
 assert.match(await measurementHelp.innerText(),/temporary two-click tape measure/i)
 await measurementHelp.getByRole('button',{name:'Close tool information'}).click()
 const boardBox=await page.locator('.cc-board svg').boundingBox()
 assert(boardBox?.width>100&&boardBox?.height>100)
 await page.mouse.click(boardBox.x+boardBox.width*.20,boardBox.y+boardBox.height*.35)
 await page.mouse.click(boardBox.x+boardBox.width*.42,boardBox.y+boardBox.height*.52)
 await page.locator('[data-tape-measurement="true"]').waitFor({timeout:8000})
 const distance=await page.locator('[data-tape-measurement="true"] text').textContent()
 assert.match(distance,/\d+\.\d cm$/)
 await page.getByRole('button',{name:'Clear tape'}).click()
 assert.equal(await page.locator('[data-tape-measurement="true"]').count(),0)
 const nativeState=await page.evaluate(()=>window.__latestCloStatus)
 assert(nativeState?.panels>0&&nativeState?.seams>0)
 await page.screenshot({path:path.join(output,'qa-clo-toolbar-tool-details.png')})
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,all70Clickable:true,counts,
   nativeModesVerified:['pen','line','sew','move3d','edit'],nativePolygonCreatedAndUndone:true,temporaryTwoClickTapeMeasure:distance,nativeGarmentPanels:nativeState.panels,
   noPersonalProjectMutated:true,isolatedOutput:output,examples,errors},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of processes)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
