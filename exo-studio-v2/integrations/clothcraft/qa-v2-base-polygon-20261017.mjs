// Isolated, disposable native Rust/Playwright proof for CLO 2D A06 Base Polygon.
// Never touches the installed user's project or invokes macOS app save.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,readFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(tmpdir(),'exo-base-polygon-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const backend=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
assert(existsSync(backend),'Required compiled Rust exo-session is missing')
const native='http://127.0.0.1:5635',ui='http://127.0.0.1:5636',children=[]
function start(cmd,args,env){const child=spawn(cmd,args,{cwd:root,detached:true,stdio:'ignore',env:{...process.env,...env}});children.push(child)}
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url,{signal:AbortSignal.timeout(1200)})).ok)return}catch{}await sleep(250)}throw Error('Service failed to start: '+url)}
async function snapshot(){const response=await fetch(native+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"snapshot"}'});const data=await response.json();assert(data.ok,JSON.stringify(data.error));return data.data}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{EXO_CLOTHCRAFT_PORT:'5635',EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),EXO_CLOTHCRAFT_SESSION_BIN:backend,EXO_CLOTHCRAFT_GPU:'0'})
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5636','--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:native})
 await Promise.all([ready(native+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],sent=[]
 p.on('pageerror',e=>errors.push(e.message))
 p.on('request',r=>{if(r.url().endsWith('/workspace')&&r.method()==='POST'){try{sent.push(r.postDataJSON())}catch{}}})
 await p.route('**/workspace',async route=>{const headers={...route.request().headers()};delete headers.origin;const response=await route.fetch({url:native+'/workspace',headers});await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':ui}})})
 await p.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await p.locator('.cc-board [data-panel]').first().waitFor({timeout:40000})
 const initial=await snapshot()
 // Exercises exactly the same native command as CLO A06 (also usable before
 // status promotion). The verified CLO button is tested separately by 70-slot QA.
 await p.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'tool:base-polygon'})))
 const modal=p.locator('[data-native-base-polygon="true"]')
 await modal.waitFor({state:'visible',timeout:10000})
 await p.getByRole('combobox',{name:'Base polygon shape'}).selectOption('rectangle')
 await p.getByRole('spinbutton',{name:'Base polygon width in millimetres'}).fill('415')
 await p.getByRole('spinbutton',{name:'Base polygon height in millimetres'}).fill('625')
 await modal.getByRole('button',{name:'Create native pattern'}).click()
 await modal.waitFor({state:'hidden',timeout:15000})
 let created
 for(let i=0;i<75;i++){created=await snapshot();if(created.template.panels.length===initial.template.panels.length+1)break;await sleep(100)}
 assert.equal(created.template.panels.length,initial.template.panels.length+1)
 assert(sent.some(x=>x.command?.kind==='Primitive'&&x.command?.shape==='rectangle'&&Math.abs(x.command.size[0]-.415)<.00001&&Math.abs(x.command.size[1]-.625)<.00001),'Rust did not receive exact metric Primitive')
 const save=await fetch(native+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'save'})}).then(r=>r.json())
 assert.equal(save.ok,true,'Saving edited project failed')
 assert.equal(save.data?.project?.template?.panels?.length,created.template.panels.length,'Saved project omitted new pattern')
 assert.equal(created.canUndo,true,'Created project should have native history')
 // The direct saved-project verification above is an external QA request; let
 // the server release that transaction before asking the editor to Undo.
 await sleep(250)
 const undoResponse=p.waitForResponse(response=>response.url().endsWith('/workspace')&&response.request().method()==='POST'&&(()=>{try{return response.request().postDataJSON()?.op==='undo'}catch{return false}})(),{timeout:10000})
 await p.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'undo'})))
 const undoEnvelope=await (await undoResponse).json()
 assert.equal(undoEnvelope.ok,true,`Native toolbar Undo rejected: ${undoEnvelope.error||'unknown error'}`)
 let undone
 for(let i=0;i<20;i++){undone=await snapshot();if(undone.template.panels.length===initial.template.panels.length)break;await sleep(100)}
 assert.equal(undone.template.panels.length,initial.template.panels.length,'Native Undo did not remove created polygon')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({pass:true,initialPanels:initial.template.panels.length,createdPanels:created.template.panels.length,undoPanels:undone.template.panels.length,dimensionsMm:[415,625],savedPattern:true,errors,output},null,2))
}finally{await browser?.close().catch(()=>{});for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}}
