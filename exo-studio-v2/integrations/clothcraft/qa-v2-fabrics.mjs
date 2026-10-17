// Independent V2 GUI verification. Dedicated local services and throwaway
// garment output: cannot modify either installed application's saved project.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {existsSync,mkdirSync,mkdtempSync,copyFileSync} from 'node:fs'
import {homedir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-fabrics-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const reference=path.join(homedir(),'Library/Application Support/EXO-ClothCraft-Studio/Snapshots/V1-20261016')
for(const f of ['fitting-project.json','fitting-project.json.native'])
 if(existsSync(path.join(reference,f)))copyFileSync(path.join(reference,f),path.join(output,'workspace',f))
const rust=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
assert(existsSync(rust),'Build V2 Rust exo-session binary first')
const processes=[]
function start(binary,args,env={}) {
 const p=spawn(binary,args,{cwd:root,env:{...process.env,...env},stdio:'ignore',detached:true})
 processes.push(p)
 return p
}
async function ready(url){
 for(let i=0;i<100;i++){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(1200)});if(r.ok)return}catch{}
  if(processes.some(p=>p.exitCode!==null))throw Error('V2 test process exited before ready')
  await sleep(250)
 }
 throw Error('Timeout waiting for '+url)
}
const base='http://127.0.0.1:5435',ui='http://127.0.0.1:5436'
async function snapshot(){
 const r=await fetch(base+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"snapshot"}'})
 const v=await r.json()
 assert(v.ok,JSON.stringify(v.error))
 return v.data
}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5435',EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:rust,EXO_CLOTHCRAFT_GPU:'0'})
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5436','--strictPort'],
  {VITE_CLOTHCRAFT_BRIDGE_URL:base})
 await Promise.all([ready(base+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const p=await browser.newPage({viewport:{width:1728,height:1040}}),errors=[],actions=[]
 p.on('pageerror',e=>{errors.push(e.message);console.error(e.message)})
 p.on('response',r=>{if(r.url().endsWith('/workspace')&&r.request().method()==='POST')actions.push(r.request().postDataJSON())})
 // Dedicated test ports, forwarded to the real isolated native service.
 // Only test transport changes; no material or snapshot response is mocked.
 await p.route('**/workspace',async route=>{
  const headers={...route.request().headers()};delete headers.origin;
  const response=await route.fetch({url:base+'/workspace',headers});
  await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':ui}})
 })
 console.log('browser ready');await p.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await p.locator('.cc-board [data-panel]').first().waitFor({timeout:50000}).catch(async e=>{await p.screenshot({path:path.join(output,'failure.png')});console.log(await p.locator('body').innerText());throw e})
 await p.locator('.cc-board [data-panel]').first().click({force:true})
 await p.getByRole('combobox',{name:'Workspace',exact:true}).selectOption('Fabric')
 const library=p.getByRole('region',{name:'Native fabric library'})
 await library.waitFor()
 await library.locator('[data-fabric-preset="denim"]').click()
 await p.waitForFunction(()=>JSON.parse(document.querySelector('.cc-scene canvas')?.dataset.fabricPresets||'[]').includes('denim'))
 assert.equal(Number(await library.getByRole('spinbutton',{name:'Surface mass (g/m²)'}).inputValue()),296.675)
 await library.getByLabel('Apply to all garment panels').check()
 await library.locator('[data-fabric-preset="silk"]').click()
 await p.waitForFunction(()=>{const a=JSON.parse(document.querySelector('.cc-scene canvas')?.dataset.fabricPresets||'[]');return a.length&&a.every(x=>x==='silk')})
 await library.getByRole('spinbutton',{name:'Surface mass (g/m²)'}).fill('120')
 await library.getByRole('spinbutton',{name:'Surface mass (g/m²)'}).press('Tab')
 await p.waitForTimeout(400)
 let state=await snapshot();assert(state.template.panels.every(panel=>state.template.fabrics.find(f=>f.id===panel.fabric).properties.density===.12))
 await p.screenshot({path:path.join(output,'native-fabric-library.png')})
 await p.reload();await p.locator('.cc-board [data-panel]').first().waitFor({timeout:50000})
 await p.waitForFunction(()=>{const a=JSON.parse(document.querySelector('.cc-scene canvas')?.dataset.fabricPresets||'[]');return a.length&&a.every(x=>x==='silk')})
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,checks:['native library visible','denim units','all-panel silk rendering','custom GSM reaches solver','appearance reload','no browser errors'],output},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of processes)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
