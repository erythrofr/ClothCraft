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
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-move-mode-'))
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
const base='http://127.0.0.1:5455',ui='http://127.0.0.1:5456'
async function snapshot(){
 const r=await fetch(base+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"snapshot"}'})
 const v=await r.json()
 assert(v.ok,JSON.stringify(v.error))
 return v.data
}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5455',EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:rust,EXO_CLOTHCRAFT_GPU:'0'})
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5456','--strictPort'],
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
 // Rotation ring remains interactive on the moved panel.
 const ring=await canvas.evaluate(el=>({x:+el.dataset.gizmoCenterX,y:+el.dataset.gizmoCenterY,r:+el.dataset.gizmoRingRadius}))
 await p.mouse.move(rect.x+ring.x-ring.r*1.24,rect.y+ring.y);await p.mouse.down()
 await p.mouse.move(rect.x+ring.x-ring.r*.85,rect.y+ring.y+ring.r*.85,{steps:12});await p.mouse.up()
 for(let i=0;i<60;i++){if(actions.some(a=>a.op==='pose-panel'&&a.rotation_delta_degrees?.some(n=>Math.abs(n)>.1)))break;await sleep(100)}
 assert(actions.some(a=>a.op==='pose-panel'&&a.rotation_delta_degrees?.some(n=>Math.abs(n)>.1)),'Move orb must rotate the panel')
 await sleep(300)
 const before=await snapshot()
 assert.equal(await canvas.getAttribute('data-avatar-color'),'#555b64')
 assert(Number(await canvas.getAttribute('data-gizmo-ring-radius'))>10,'Move orb must be present')
 await p.mouse.move(gx+18,gy+22);await p.mouse.down();await p.mouse.move(gx+498,gy+22,{steps:12});await p.mouse.up()
 for(let i=0;i<100;i++){if(actions.some(a=>a.op==='pose-panel'&&a.translation_delta?.some(n=>Math.abs(n)>.01)))break;await sleep(100)}
 const pose=actions.filter(a=>a.op==='pose-panel'&&a.translation_delta?.some(n=>Math.abs(n)>.01)).at(-1)
 assert(pose,'Dragging Move must submit rigid native pose, not cloth brush')
 await sleep(500);const moved=await snapshot()
 assert.equal(moved.time,before.time,'Move stays paused')
 assert.deepEqual(moved.uv,before.uv,'Move cannot stretch rest patterns')
 assert.deepEqual(moved.template.seams,before.template.seams)
 const range=before.panels.find(p=>p.id===pose.panel)
 const delta=moved.positions[range.vertices[0]].map((v,k)=>v-before.positions[range.vertices[0]][k])
 assert(Math.hypot(...delta)>.05,'Panel moved away from body')
 for(let i=range.vertices[0];i<range.vertices[1];i++)for(let k=0;k<3;k++)assert(Math.abs(moved.positions[i][k]-before.positions[i][k]-delta[k])<1e-7,'Move must be rigid, not local stretch')
 for(const r of before.panels.filter(p=>p.id!==pose.panel))assert.deepEqual(moved.positions.slice(...r.vertices),before.positions.slice(...r.vertices),'Other panels remain untouched')
 assert(!actions.some(a=>a.op==='pull-panel'),'Move must not use Hand brush')
 const placed=await snapshot();console.log(JSON.stringify({pose,delta,poses:actions.filter(a=>a.op==="pose-panel"),bounds:[0,1,2].map(k=>[Math.min(...placed.positions.slice(...range.vertices).map(p=>p[k])),Math.max(...placed.positions.slice(...range.vertices).map(p=>p[k]))])}))
 // The user can pull a panel outside the body, then press the PRIMARY SIM
 // control without having to pick Fabric Hand manually.
 await p.locator('.clo-simulate-main').click()
 await waitRunning(true);const draping=await advancing(placed)
 assert.notDeepEqual(draping.positions,placed.positions,'Moved panel must resimulate')
 await p.waitForFunction(()=>document.querySelector('.cc-embedded-bottom button.active')?.textContent?.includes('Grab / stretch'))
 assert.equal(await bottom.getByRole('button',{name:'Grab / stretch',exact:true}).getAttribute('class'),'active','SIM must automatically switch into Fabric Hand')
 assert.equal(await canvas.getAttribute('data-gizmo-visible'),'false','Hand must not show Move orb')
 await bottom.getByRole('button',{name:'Move 3D',exact:true}).click();await waitRunning(false)
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.gizmoVisible==='true')
 await p.mouse.click(rect.x+rect.width*.94,rect.y+rect.height*.92)
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.gizmoVisible==='false')
 assert.equal(await canvas.getAttribute('data-gizmo-ring-radius'),null,'Click-off must remove selection orb')
 assert.deepEqual(errors,[])
 await p.screenshot({path:path.join(output,'move-grey-deselected.png')})
 console.log(JSON.stringify({passed:true,checks:['grey avatar','Move orb visible','rigid off-body panel drag','other panels and rest UV unchanged','Move orb rotation','SIM resumes moved panel and enters Fabric Hand','Hand resimulates moved panel without orb','Move pauses physics','click-off deselects'],output},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of processes)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
