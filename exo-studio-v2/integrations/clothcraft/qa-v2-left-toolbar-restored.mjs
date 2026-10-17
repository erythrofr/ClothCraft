// Verify the merged, default CLO reference toolbar against a disposable Rust session.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {existsSync,mkdtempSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'
import {CLO7_3D_A,CLO7_3D_B,CLO7_2D_A,CLO7_2D_B} from '../../src/data/clo7ToolbarOrder.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-left-toolbar-restored-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const rust=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
assert(existsSync(rust),'Missing compiled isolated Rust exo-session backend')
const nativePort='5495',uiPort='5496',native=`http://127.0.0.1:${nativePort}`,ui=`http://127.0.0.1:${uiPort}`
const processes=[]
function launch(bin,args,env={}){
 const child=spawn(bin,args,{cwd:root,detached:true,stdio:'ignore',env:{...process.env,...env}})
 processes.push(child)
 return child
}
async function ready(target){
 for(let i=0;i<100;i++){
  try{if((await fetch(target,{signal:AbortSignal.timeout(1200)})).ok)return}catch{}
  if(processes.some(p=>p.exitCode!==null))throw Error('Disposable QA server exited: '+target)
  await sleep(250)
 }
 throw Error('Disposable QA server timed out: '+target)
}
const columns=[
 ['3D A','.tool-rail [aria-label="3D editing column A"]','3d',CLO7_3D_A],
 ['3D B','.tool-rail [aria-label="3D garment column B"]','3d',CLO7_3D_B],
 ['2D A','.clo-right-tool-palette [aria-label="CLO 2D column A"]','2d',CLO7_2D_A],
 ['2D B','.clo-right-tool-palette [aria-label="CLO 2D column B"]','2d',CLO7_2D_B],
]
let browser
try{
 launch(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:nativePort,EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:rust,EXO_CLOTHCRAFT_GPU:'0'
 })
 launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port',uiPort,'--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:native})
 await Promise.all([ready(native+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const results=[]
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>{window.__latestCloStatus=null;window.addEventListener('exo-clothcraft-status',e=>window.__latestCloStatus=e.detail)})
  await page.route('**/workspace',async route=>{
   const headers={...route.request().headers()};delete headers.origin
   const response=await route.fetch({url:native+'/workspace',headers})
   await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':ui}})
  })
  await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
  try{await page.locator('.cc-board').first().waitFor({timeout:25000})}
  catch(error){console.error('UI startup diagnostics',JSON.stringify({url:page.url(),body:(await page.locator('body').innerText()).slice(0,1800),errors}));throw error}
  async function checkFull(){
   const unique=[]
   for(const [name,selector,dimension,slots] of columns){
    const column=page.locator(selector)
    await column.waitFor({timeout:12000})
    const actual=await column.locator('[data-clo-slot]').evaluateAll(nodes=>nodes.map(el=>({id:el.dataset.cloSlot,label:el.getAttribute('aria-label')})))
    assert.equal(actual.length,slots.length,`${width} ${name}: expected ${slots.length} icons`)
    assert.deepEqual(actual.map(x=>x.id),slots.map(x=>`${dimension}:${x.id}`),`${width} ${name}: CLO positions/order mismatch`)
    assert.deepEqual(actual.map(x=>x.label),slots.map(x=>x.label),`${width} ${name}: label mismatch`)
    unique.push(...actual.map(x=>x.id))
   }
   assert.equal(unique.length,70,`${width}: all 70 reference positions required`)
   assert.equal(new Set(unique).size,70,`${width}: duplicate tool positions`)
  }
  await checkFull()
  // Real native command: selecting 3D A02 must enter Move, not merely highlight.
  await page.locator('[data-clo-slot="3d:A02"]').click({force:true})
  await page.waitForFunction(()=>window.__latestCloStatus?.mode==='move3d',null,{timeout:15000})
  const stateBefore=await (await fetch(native+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot'})})).json()
  assert(stateBefore.ok,'Rust native snapshot unavailable')
  await page.locator('[data-clo-slot="3d:A05"]').click({force:true})
  await page.getByRole('button',{name:'Switch to Sewing tools'}).waitFor({timeout:12000}).catch(()=>{})
  assert(/sewing/i.test(await page.locator('body').innerText()),`${width}: A05 should expose sewing`)
  await page.locator('[data-clo-slot="3d:B13"]').click({force:true})
  const detail=page.locator('[data-clo-detail="3d:B13"]')
  await detail.waitFor({timeout:12000})
  assert.match(await detail.innerText(),/Zipper/i)
  assert.match(await detail.innerText(),/Requires additional native implementation|Existing EXO inspection workflow/i)
  assert.equal(await detail.getByRole('button',{name:/Run Zipper/}).count(),0)
  const stateAfter=await (await fetch(native+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot'})})).json()
  assert(stateAfter.ok)
  assert.deepEqual(stateAfter.data.template,stateBefore.data.template,`${width}: unsupported B13 mutated native garment topology`)
  await detail.getByRole('button',{name:'Close tool information'}).click()
  await page.getByRole('button',{name:'Show working CLO 3D tools only'}).click({force:true})
  assert((await page.locator('.tool-rail [data-clo-slot]').count())<38,`${width}: WORK ONLY should filter 3D`)
  await page.getByRole('button',{name:'Show all CLO 3D tools in reference order'}).click({force:true})
  const right=page.getByRole('navigation',{name:'Right workspace tools'})
  await right.getByRole('button',{name:'Show working CLO 2D tools only'}).click({force:true})
  assert((await right.locator('[data-clo-slot]').count())<32,`${width}: WORK should filter 2D`)
  await right.getByRole('button',{name:'Show all CLO 2D tools in reference order'}).click({force:true})
  await checkFull()
  await page.screenshot({path:path.join(output,`toolbar-restored-${width}.png`),fullPage:false})
  assert.deepEqual(errors,[],`${width}: unexpected React/browser exceptions`)
  results.push({width,positions:[20,18,17,15],modeA02:'move3d',sewingA05:true,unsupportedB13NoMutation:true,workOnlyAndAllRestored:true,pageErrors:errors})
  await page.close()
 }
 console.log(JSON.stringify({passed:true,isolatedOutput:output,results},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const child of processes)try{process.kill(-child.pid,'SIGTERM')}catch{}
}
