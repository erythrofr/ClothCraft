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
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-live-grab-'))
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
const base='http://127.0.0.1:5465',ui='http://127.0.0.1:5466'
async function snapshot(){
 const r=await fetch(base+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"snapshot"}'})
 const v=await r.json()
 assert(v.ok,JSON.stringify(v.error))
 return v.data
}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5465',EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:rust,EXO_CLOTHCRAFT_GPU:process.env.EXO_CLOTHCRAFT_GPU==='1'?'1':'0'})
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5466','--strictPort'],
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
 await p.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await p.locator('.cc-board [data-panel]').first().waitFor({timeout:50000})
 const canvas=p.locator('.cc-scene canvas'),bottom=p.locator('.cc-embedded-bottom')
 await p.locator('.cc-board [data-panel]').first().click({force:true})
 await p.getByTitle('Front camera: looking along Z',{exact:true}).click()
 await bottom.getByRole('button',{name:'Move 3D',exact:true}).click()
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.gizmoVisible==='true')
 const rect=await canvas.boundingBox(),g=await canvas.evaluate(el=>({x:+el.dataset.gizmoCenterX,y:+el.dataset.gizmoCenterY}))
 const gx=rect.x+g.x,gy=rect.y+g.y
 async function waitRunning(want){for(let i=0;i<100;i++){const s=await snapshot();if(Boolean(s.running)===want&&!s.busy)return s;await sleep(100)}throw Error('Running state did not become '+want)}
 async function advancing(before){for(let i=0;i<120;i++){const next=await snapshot();if(next.time>before.time)return next;await sleep(200)}throw Error('No native time advance: '+JSON.stringify({before:before.time,current:(await snapshot()).time,errors}))}
 const initial=await snapshot()
 await p.getByRole('navigation',{name:'Right workspace tools'}).getByRole('button',{name:'Fabric hand',exact:true}).click()
 await waitRunning(true)
 let held=false
 for(const [dx,dy] of [[0,0],[0,-24],[0,24],[-30,0],[30,0]]){
  await p.mouse.move(gx+dx,gy+dy);await p.mouse.down()
  if(await canvas.getAttribute('data-fabric-grab-state')==='dragging'){
   await p.mouse.move(gx+dx+24,gy+dy-8,{steps:12});held=true;break
  }
  await p.mouse.up()
 }
 assert(held,'Must pick visible cloth surface')
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.nativeGrabActive==='true',{timeout:30000})
 const heldBefore=await snapshot(),renderBefore=Number(await canvas.getAttribute('data-simulation-time'))
 const heldAfter=await advancing(heldBefore)
 assert(heldAfter.grabActive,'Spring stays attached before mouse release')
 assert.equal(heldAfter.grabStiffness,150)
 assert.notDeepEqual(heldAfter.positions,heldBefore.positions,'Actual solver geometry updates WHILE mouse is held')
 await p.waitForFunction(t=>Number(document.querySelector('.cc-scene canvas')?.dataset.simulationTime)>t,renderBefore)
 const commands=actions.filter(a=>a.op==='grab'&&a.grab)
 assert(commands.length>1,'Pointer motion updates live native target')
 assert(new Set(commands[0].grab.vertices).size===3,'Upstream barycentric surface attachment, not nearest vertex')
 assert(Math.abs(commands[0].grab.weights.reduce((a,b)=>a+b,0)-1)<1e-5)
 assert(!actions.some(a=>a.op==='pull-panel'),'Old teleport brush path must not run')
 await p.screenshot({path:path.join(output,'live-grab-held.png')})
 await p.mouse.up()
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.nativeGrabActive==='false')
 const released=await snapshot();assert(!released.grabActive);assert((await advancing(released)).time>released.time)
 // Cancellation must remove a live held attachment too.
 let cancelled=false
 for(const [dx,dy] of [[0,0],[0,-24],[0,24],[-30,0],[30,0]]){
  await p.mouse.move(gx+dx,gy+dy);await p.mouse.down()
  if(await canvas.getAttribute('data-fabric-grab-state')==='dragging'){
   await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.nativeGrabActive==='true')
   await canvas.dispatchEvent('lostpointercapture',{pointerId:1});await p.mouse.up()
   await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.nativeGrabActive==='false')
   cancelled=true;break
  }
  await p.mouse.up()
 }
 assert(cancelled,'Live constraint cancellation exercised')
 await bottom.getByRole('button',{name:'Select / edit',exact:true}).click();await waitRunning(false)
 const stopped=await snapshot();await sleep(700);assert.equal((await snapshot()).time,stopped.time)
 const template=(await snapshot()).template
 await p.getByRole('button',{name:'Reset fabric panels',exact:true}).click();await sleep(700)
 const reset=await snapshot();assert.equal(reset.time,0);assert.deepEqual(reset.template,template);assert(!reset.grabActive)
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,checks:['visible cloth pick','three barycentric vertices','upstream 150 N/m spring','live pointer targets','physics and rendered geometry advance WHILE held','no brush teleport','release clears spring and keeps physics running','lost capture clears live spring','Select pauses','reset preserves authoring and clears grab'],output}))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of processes)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
