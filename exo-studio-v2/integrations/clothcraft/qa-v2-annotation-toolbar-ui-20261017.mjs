// Real CLO A14/A13 browser interaction on disposable Rust project only.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import {setTimeout as sleep} from 'node:timers/promises'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const out=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-annotation-ui-'))
mkdirSync(path.join(out,'workspace'),{recursive:true})
const port='5675',webPort='5676',bridge=`http://127.0.0.1:${port}`,web=`http://127.0.0.1:${webPort}`
const processes=[]
function launch(executable,args,env={}){const child=spawn(executable,args,{cwd:root,detached:true,stdio:'ignore',env:{...process.env,...env}});processes.push(child)}
async function ready(url){for(let i=0;i<120;i++){try{const res=await fetch(url,{signal:AbortSignal.timeout(1000)});if(res.ok)return}catch{}await sleep(200)}throw Error('Service failed: '+url)}
async function snapshot(){const r=await fetch(bridge+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"snapshot"}'});const data=await r.json();assert(data.ok,JSON.stringify(data.error));return data.data}
let browser
try{
 launch(process.execPath,['integrations/clothcraft/server.mjs'],{EXO_CLOTHCRAFT_PORT:port,EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),EXO_CLOTHCRAFT_OUTPUT_DIR:out,EXO_CLOTHCRAFT_GPU:'0'})
 launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port',webPort,'--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:bridge})
 await Promise.all([ready(bridge+'/health'),ready(web)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`${web}/?desktop=1&engine=clothcraft`,{waitUntil:'domcontentloaded',timeout:30000})
 await page.locator('.cc-board [data-panel]').first().waitFor({state:'visible',timeout:20000})
 let dialogValue='CUT ON FOLD'
 page.on('dialog',dialog=>void dialog.accept(dialogValue))
 await page.locator('[data-clo-slot="2d:A14"]').click()
 await page.locator('.cc-board [data-panel="front"]').first().click()
 const note=page.locator('[data-pattern-annotation^="front:"]').first()
 await note.waitFor({state:'visible',timeout:15000})
 let saved=await snapshot()
 const annotations=saved.template.panels.find(p=>p.id==='front').polygon.annotations
 assert.equal(annotations.length,1)
 assert.equal(annotations[0].text,'CUT ON FOLD')
 await page.locator('[data-clo-slot="2d:A13"]').click()
 dialogValue='SEW GUIDE'
 await note.click()
 await page.waitForFunction(()=>document.querySelector('[data-pattern-annotation] text')?.textContent==='SEW GUIDE',null,{timeout:12000})
 saved=await snapshot()
 assert.equal(saved.template.panels.find(p=>p.id==='front').polygon.annotations[0].text,'SEW GUIDE')
 await note.click({modifiers:['Alt']})
 await note.waitFor({state:'detached',timeout:15000})
 saved=await snapshot()
 assert.equal(saved.template.panels.find(p=>p.id==='front').polygon.annotations.length,0)
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({pass:true,created:true,edited:true,removed:true,realRust:true,errors,output:out},null,2))
}finally{await browser?.close().catch(()=>{});for(const child of processes)try{process.kill(-child.pid,'SIGTERM')}catch{}}
