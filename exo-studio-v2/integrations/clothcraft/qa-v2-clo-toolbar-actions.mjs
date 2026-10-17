// End-to-end tool-rail acceptance against disposable Rust/Vite workspace.
// Headless Chrome is an isolated QA fixture only; EXO runs to user as .app.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {mkdtempSync,mkdirSync,existsSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'
import {CLO7_NATIVE_TOOL_CAPABILITIES as inventory} from '../../src/core/clo7NativeToolCapabilities.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-clo-toolbar-actions-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
// The Rust bridge intentionally allowlists local origins. Use the permitted
// disposable fixture pair rather than widening CORS just for this test.
const installedWeb=process.argv.includes('--installed-web')
// Pick fresh ports for each QA run. Fixed ports can accidentally attach to an
// orphaned earlier fixture and give a false pass against someone else's data.
const freePort=()=>new Promise((resolve,reject)=>{
 const server=createServer()
 server.once('error',reject)
 server.listen(0,'127.0.0.1',()=>{
  const {port}=server.address()
  server.close(error=>error?reject(error):resolve(String(port)))
 })
})
const nativePort=await freePort(),uiPort=await freePort(),native=`http://127.0.0.1:${nativePort}`,
 url=installedWeb?'http://127.0.0.1:5386':`http://127.0.0.1:${uiPort}`
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
 if(!installedWeb)launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port',uiPort,'--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:native})
 await Promise.all([ready(native+'/health'),ready(url)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1830,height:1080}}),errors=[]
 page.on('pageerror',err=>errors.push(err.message))
 await page.addInitScript(()=>{
  window.__latestCloStatus=null
  window.addEventListener('exo-clothcraft-status',event=>{window.__latestCloStatus=event.detail})
 })
 let isolatedWorkspaceCalls=0
 // Capture all workspace requests even when Vite picks a dynamic UI port.
 // Fulfil directly from disposable Rust so the native origin allowlist and
 // an installed bundle's hardcoded port cannot reach a personal project.
 await page.route('**/*',async route=>{
   const request=route.request(),target=new URL(request.url())
   if(target.pathname==='/workspace'){
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{
     'access-control-allow-origin':'*','access-control-allow-methods':'POST, GET, OPTIONS',
     'access-control-allow-headers':'Content-Type'}})
    isolatedWorkspaceCalls++
    const response=await fetch(native+'/workspace',{method:request.method(),
     headers:{'content-type':'application/json'},body:request.postData()||undefined})
    const content=await response.text()
    return route.fulfill({status:response.status,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:content})
   }
   if(installedWeb&&/^127\.0\.0\.1$/.test(target.hostname)&&target.port!=='5386')
    return route.abort('blockedbyclient')
   return route.continue()
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
 assert(existsSync(path.join(output,'workspace/fitting-project.json')),
  `Refusing to click toolbar: ${isolatedWorkspaceCalls} intercepted workspace calls did not create disposable project`)
 const counts={native:0,inspect:0,unavailable:0},examples=[]
 const referenceSlots=page.locator('[data-clo-slot]')
 assert.equal(await referenceSlots.count(),70,'All 38 3D and 32 2D reference positions must remain visible')
 assert.equal(await page.locator('.clo-left-3d-double-bars[data-toolbar-complete="true"] [data-clo-slot]').count(),38,
  'Full two-column 3D reference toolbar must be restored')
 await page.locator('[data-clo-slot="3d:A01"]').focus()
 await page.keyboard.press('ArrowDown')
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.cloSlot),'3d:A02',
  'ArrowDown must navigate to next enabled native 3D command')
 await page.keyboard.press('End')
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.cloSlot),'3d:A20',
  'End must reach final available native 3D inspector slot')
 for(const item of inventory){
  // No personal state is mounted: this Vite bridge points at a disposable
  // Rust project in a unique ephemeral QA output folder.
  const control=page.locator(`[data-clo-slot="${item.id}"]`)
  if(item.mode==='unavailable')assert(await control.isDisabled(),item.id+' reference slot must be disabled until a native action exists')
  else {
   assert(!(await control.isDisabled()),item.id+' should allow a real native or inspection action')
   await control.click()
  }
  assert.equal(await page.locator('.exo-clo-tool-card').count(),0,'The remaining-work tool popup must not obscure the editor')
  assert.equal(await control.getAttribute('data-clo-implementation'),item.mode,item.id+' implementation status')
  assert.equal(await control.locator('.cad-tool-icon').count(),1,item.id+' icon must render as a recognizable graphical tool')
  counts[item.mode]++
  if(examples.length<5)examples.push([item.id,item.label,item.mode])
  if(item.id==='3d:A01')await control.click() // leave disposable solver paused
 }
 assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),70)
 assert.equal(counts.native,22,'Native reference count must match tested command inventory')
 assert.equal(counts.inspect,26,'All existing related inspection/editor routes must remain available')
 assert.equal(counts.unavailable,22,'Unsupported reference count must match current native inventory')
 await page.locator('[data-clo-slot="2d:A06"]').click()
 await page.locator('[data-native-base-polygon="true"]').waitFor({timeout:8000})
 await page.locator('[data-clo-slot="2d:A01"]').click()
 assert.equal(await page.locator('[data-native-base-polygon="true"]').count(),0,
  'Switching drafting tools must dismiss the Base Polygon overlay')
 // These are real EXO destinations. Inspect slots should open them in the
 // current installed-style UI without displaying the obsolete status popup.
 await page.locator('[data-clo-slot="3d:B09"]').click()
 await page.waitForFunction(()=>document.getElementById('cc-native-graphic-editor')?.hidden===false,null,{timeout:8000})
 assert.equal(await page.getByRole('tab',{name:'Graphic',exact:true}).getAttribute('aria-selected'),'true')
 await page.locator('[data-clo-slot="3d:B13"]').click()
 assert.equal(await page.getByRole('tab',{name:'Zipper',exact:true}).getAttribute('aria-selected'),'true')
 await page.locator('[data-clo-slot="2d:A17"]').click()
 assert.equal(await page.getByRole('tab',{name:'Grading',exact:true}).getAttribute('aria-selected'),'true')

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
 await page.locator('[data-clo-slot="3d:A06"]').click()
 await waitMode('sew')
 assert.equal(await page.locator('[data-native-sewing-panel="true"]').count(),1,
  '3D Segment Sewing must enable the real native two-edge sewing interface')
 await page.locator('[data-clo-slot="3d:A07"]').click()
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
 // Trace must author independent native Rust geometry and retain the source.
 // Exercise actual reference toolbar A07 and document history, not just click.
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'select:front'})))
 await page.locator('[data-clo-slot="2d:A07"]').click()
 await page.waitForFunction(count=>window.__latestCloStatus?.panels===count+1,panelCount,{timeout:15000})
 assert.equal(await page.locator('.cc-board [data-panel="front"]').count()>0,true,
  'Trace must preserve the original source panel')
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'undo'})))
 await page.waitForFunction(count=>window.__latestCloStatus?.panels===count,panelCount,{timeout:15000})
 // Real persisted contour construction: toolbar selects the exact authoring
 // command, mouse click submits Rust edit, SVG renders the saved mark.
 const boundary=page.locator('.cc-board [data-edge]').first()
 const boundaryId=await boundary.getAttribute('data-edge')
 assert(boundaryId,'Need an actual named material boundary')
 await page.locator('[data-clo-slot="2d:A08"]').click()
 await boundary.click({force:true})
 await page.locator('[data-native-notch="'+boundaryId+'"]').first().waitFor({timeout:15000})
 await page.locator('[data-clo-slot="2d:A09"]').click()
 await boundary.click({force:true})
 await page.locator('[data-native-allowance="'+boundaryId+'"]').first().waitFor({timeout:15000})
 // Verify these explicit construction markings do not remesh cloth.
 const annotated=await page.evaluate(()=>window.__latestCloStatus)
 assert.equal(annotated.panels,panelCount)
 await page.locator('[data-clo-slot="2d:A01"]').click()
 await waitMode('edit')
 await page.locator('[data-clo-slot="2d:B01"]').click()
 await page.getByRole('region',{name:'Native sewing relationship editor'}).waitFor({timeout:15000})
 assert(await page.getByRole('spinbutton',{name:'Native seam stiffness'}).count()>0)
 await page.locator('[data-clo-slot="2d:A12"]').click()
 await waitMode('edit')
 await page.waitForFunction(()=>document.querySelector('.cc-board svg')?.dataset.nativeTool==='measure',null,{timeout:8000})
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
 console.log(JSON.stringify({passed:true,all70ReferencePositionsVisible:true,counts,
   nativeModesVerified:['pen','line','sew','move3d','edit'],nativePolygonCreatedAndUndone:true,
   nativeContourTracedAndUndone:true,notchConstructedInRust:true,seamAllowancePersistedInRust:true,nativeSeamEditorVisible:true,
   temporaryTwoClickTapeMeasure:distance,relatedEditorsVerified:['Graphic','Zipper','Grading'],nativeGarmentPanels:nativeState.panels,
   noPersonalProjectMutated:true,isolatedOutput:output,examples,errors},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of processes)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
