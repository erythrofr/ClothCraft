// Isolated browser coverage for the typed EXO draft Property Editor.
// Native Rust property QA is separate: draft fields explicitly reject native edits.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-property-context-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const api='http://127.0.0.1:5415',ui='http://127.0.0.1:5416',children=[]
const launch=(binary,args,env={})=>{const p=spawn(binary,args,{cwd:root,detached:true,stdio:'ignore',env:{...process.env,...env}});children.push(p)}
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}if(children.some(p=>p.exitCode!==null))throw Error('Service exited before ready: '+url);await new Promise(r=>setTimeout(r,200))}throw Error('Service timeout: '+url)}
const all=['Information','Selected Line','Simulation Properties','Fabric','Bond','Solidify','Arrange','Miscellaneous']
const fabric=['Information','Material','Physical Property','Miscellaneous']
let browser
try{
 launch(process.execPath,['integrations/clothcraft/server.mjs'],{EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0'})
 launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:api})
 await Promise.all([ready(api+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1700,height:1080}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 // Main typed property adapter edits the EXO draft; native board initialization is not required.
 await page.goto(ui+'/?desktop=1',{waitUntil:'domcontentloaded'})
 const list=page.locator('.clo-property-panel .clo-pe-list')
 await list.waitFor({timeout:45000})
 const headings=()=>list.locator('.clo-pe-trigger span').allInnerTexts()
 const expand=async title=>{const button=list.getByRole('button',{name:title,exact:true});if(await button.getAttribute('aria-expanded')!=='true')await button.click();return list.getByRole('region',{name:`${title} properties`})}
 const tabs=page.getByRole('tablist',{name:'Object Browser types'})
 const select=async tab=>{if(tab!=='Scene')await tabs.getByRole('tab',{name:tab,exact:true}).click();const row=page.locator('.clo-object-list .clo-object-select').first();if(!await row.count())return false;await row.click();return true}
 const field=key=>page.locator(`.clo-property-panel [data-property-field="${key}"] input`)
 const commit=async(key,value)=>{const input=field(key);await input.fill(String(value));await input.blur()}
 const undo=()=>page.getByRole('button',{name:'Undo',exact:true}).first()
 // Saved EXO projects may restore a selected pattern on startup. In that
 // case the inspector correctly shows the Pattern schema.
 assert.deepEqual(await headings(),all,'Restored selected pattern opens Pattern groups')
 const host=page.locator('#clo-pattern-properties-host')
 assert.equal(await host.count(),1)
 // The first Scene row is the avatar. It must expose its own limited context.
 assert(await select('Scene'))
 assert.deepEqual(await headings(),['Information','Miscellaneous'],'Avatar inspector context')
 assert.equal(await page.locator('.clo-property-panel .clo-pe-header strong').innerText(),await page.locator('.clo-object-list .clo-object-select').first().innerText())
 assert.equal(await page.locator('.clo-property-panel .clo-pe-typed-fields').count(),0,'Avatar should not expose editable garment fields')
 // The next Scene row represents the actual editable pattern.
 const patternRow=page.locator('.clo-object-list .clo-object-select').nth(1)
 assert(await patternRow.count(),'Scene must contain a pattern after the avatar')
 await patternRow.click()
 assert.deepEqual(await headings(),all)
 await expand('Arrange')
 assert.equal(await host.count(),1)
 await list.getByRole('button',{name:'Arrange',exact:true}).click()
 assert.equal(await host.count(),1)
 await expand('Information')
 const originalName=await field('name').inputValue()
 const renamed=originalName+' QA'
 await commit('name',renamed)
 await page.waitForFunction(value=>[...document.querySelectorAll('[data-property-field="name"] input')].some(el=>el.value===value),renamed)
 assert.equal(await field('name').inputValue(),renamed)
 await undo().click()
 await page.waitForFunction(value=>document.querySelector('[data-property-field="name"] input')?.value===value,originalName)
 assert.equal(await field('name').inputValue(),originalName)
 await expand('Arrange')
 const quantity=field('cutQuantity')
 const initialQuantity=await quantity.inputValue()
 await commit('cutQuantity','101')
 assert.equal(await page.locator('[data-property-field="cutQuantity"] [role="alert"]').count(),1,'Out-of-range cut quantity must be rejected')
 assert.equal(await quantity.inputValue(),'101','Invalid draft remains visible for correction')
 await commit('cutQuantity',initialQuantity)
 // Fabric: inspector reduces group set, fields reflect submitted material changes, Undo recovers.
 assert(await select('Fabric'))
 assert.deepEqual(await headings(),fabric)
 await expand('Information')
 const fabricName=await field('name').inputValue()
 await commit('name',fabricName+' QA')
 assert.equal(await field('name').inputValue(),fabricName+' QA')
 await undo().click()
 await page.waitForFunction(value=>document.querySelector('[data-property-field="name"] input')?.value===value,fabricName)
 const sim=await expand('Physical Property')
 assert.equal(await sim.locator('[data-property-field="gsm"]').count(),1)
 assert.equal(await sim.locator('[data-property-field="thickness"]').count(),1)
 const gsm=await field('gsm').inputValue()
 await commit('gsm','0')
 assert.equal(await page.locator('[data-property-field="gsm"] [role="alert"]').count(),1)
 await commit('gsm',gsm)
 await expand('Material')
 assert.equal(await field('color').getAttribute('type'),'color')
 // Instance fixtures are conditional; never fabricate project records.
 const hardware={}
 for(const [tab,groups,group,properties] of [
  ['Button',['Information','Button','2D Placement','Miscellaneous'],'Button',['diameterCm','holes','color']],
  ['Topstitch',['Information','Stitch','Miscellaneous'],'Stitch',['stitchLengthMm','offsetCm','rows','rowGapCm','color']],
 ]){
  if(!await select(tab)){hardware[tab]='fixture absent';continue}
  assert.deepEqual(await headings(),groups)
  const region=await expand(group)
  for(const key of properties)assert.equal(await region.locator(`[data-property-field="${key}"]`).count(),1,`${tab}.${key} missing`)
  const numeric=tab==='Button'?'diameterCm':'stitchLengthMm'
  const before=await field(numeric).inputValue()
  const next=String(Number(before)+0.2)
  await commit(numeric,next)
  assert.equal(Number(await field(numeric).inputValue()),Number(next))
  await undo().click()
  await page.waitForFunction(({key,value})=>document.querySelector(`[data-property-field="${key}"] input`)?.value===value,{key:numeric,value:before})
  hardware[tab]='edited and undone'
 }
 await page.screenshot({path:path.join(output,'property-draft-context.png')})
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,mode:'draft',avatarContext:true,patternUndo:true,fabricUndo:true,invalidNumericRejected:true,hardware,output,errors},null,2))
}finally{await browser?.close().catch(()=>{});for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}}
