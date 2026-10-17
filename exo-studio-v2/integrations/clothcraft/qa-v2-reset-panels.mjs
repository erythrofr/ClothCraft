// Isolated UI recovery test: top RESET PANELS must restore original off-body
// Rust positions without deleting the authored pattern or sewing connections.
// Never touches installed V1/V2 garment data or their service ports.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const out=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-reset-panels-'))
mkdirSync(path.join(out,'workspace'),{recursive:true})
const url='http://127.0.0.1:5416',api='http://127.0.0.1:5415'
const children=[]
function start(binary,args,env){const p=spawn(binary,args,{cwd:root,stdio:'ignore',env:{...process.env,...env},detached:true});children.push(p);return p}
async function ready(url){for(let i=0;i<100;i++){
 try{const res=await fetch(url,{signal:AbortSignal.timeout(1200)});if(res.ok)return}catch{}
 if(children.some(c=>c.exitCode!==null))throw Error('Reset QA process stopped unexpectedly')
 await new Promise(resolve=>setTimeout(resolve,220))
}throw Error('Reset QA server timed out: '+url)}
async function request(op){const res=await fetch(api+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op})});const obj=await res.json();assert(obj.ok,JSON.stringify(obj.error));return obj.data}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  EXO_CLOTHCRAFT_OUTPUT_DIR:out,EXO_CLOTHCRAFT_GPU:'0',
 })
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:api})
 await Promise.all([ready(api+'/health'),ready(url)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1600,height:980}}),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto(url+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await page.locator('.cc-board [data-panel]').first().waitFor({timeout:50000})
 const reset=page.getByRole('button',{name:'Reset pattern position outside avatar'})
 assert.equal(await reset.count(),1,'Dedicated top-bar reset button missing')
 // A restored native workspace may START in its last draped state. Establish
 // canonical authored off-body initial_state by clicking Reset first; don't
 // incorrectly assume the loaded snapshot is the off-body starting pose.
 const imported=await request('snapshot')
 await reset.click()
 await page.getByText('Patterns returned to their original off-body positions.',{exact:false}).waitFor({timeout:30000})
 const initial=await request('snapshot')
 assert.equal(initial.time,0)
 assert.deepEqual(initial.template,imported.template)
 await page.locator('.cc-notice button').click()
 const step=page.getByRole('button',{name:'Step ClothCraft Rust simulation'})
 await step.click()
 await page.waitForFunction(()=>document.querySelector('.cc-embedded-footer')?.textContent.includes('Rust session ready'),{timeout:30000})
 let advanced=await request('snapshot')
 assert(advanced.time>0,'Solver never advanced')
 await reset.click()
 await page.getByText('Patterns returned to their original off-body positions.',{exact:false}).waitFor({timeout:30000})
 let restored=await request('snapshot')
 assert.equal(restored.time,0,'Reset must zero the simulation clock')
 assert.deepEqual(restored.positions,initial.positions,'Reset must restore initial off-body cloth vertices')
 assert.deepEqual(restored.template,initial.template,'Reset must preserve all authored pattern/seam/material records')
 assert.deepEqual(restored.panels.map(p=>p.id),initial.panels.map(p=>p.id),'All pattern panels must remain')

 // Recovery during an ongoing simulation must stop its loop first.
 await page.locator('.cc-notice button').click()
 await page.locator('.clo-simulate-main').click()
 await page.waitForFunction(()=>document.querySelector('.cc-embedded-footer')?.textContent.includes('Running Rust simulation'),{timeout:12000})
 await reset.click()
 await page.getByText('Patterns returned to their original off-body positions.',{exact:false}).waitFor({timeout:45000})
 await page.waitForFunction(()=>document.querySelector('.cc-embedded-footer')?.textContent.includes('Rust session ready'),{timeout:30000})
 restored=await request('snapshot')
 assert.equal(restored.time,0,'Reset during simulation did not zero solver time')
 assert.deepEqual(restored.positions,initial.positions,'Reset during simulation did not restore starting pose')
 assert.deepEqual(restored.template,initial.template,'Live reset deleted authored work')
 await new Promise(resolve=>setTimeout(resolve,400))
 assert.equal((await request('snapshot')).time,0,'Simulation restarted without user permission after reset')
 assert.deepEqual(errors,[],'Unexpected UI errors during reset')
 console.log(JSON.stringify({passed:true,topButton:true,fromStep:true,whileSimulating:true,offBodyRestored:true,authoredPatternPreserved:true,solverStopped:true,errors},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const child of children){try{process.kill(-child.pid,'SIGTERM')}catch{}}
}
