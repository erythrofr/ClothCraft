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
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-toolbar-repair-'))
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
const base='http://127.0.0.1:5475',ui='http://127.0.0.1:5476'
async function snapshot(){
 const r=await fetch(base+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"snapshot"}'})
 const v=await r.json()
 assert(v.ok,JSON.stringify(v.error))
 return v.data
}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5475',EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:rust,EXO_CLOTHCRAFT_GPU:process.env.EXO_CLOTHCRAFT_GPU==='1'?'1':'0'})
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5476','--strictPort'],
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

 const rail=p.getByRole('navigation',{name:'Right workspace tools'})
 await rail.getByRole('button',{name:'Switch to focused workspace tools'}).click()
 async function settled(){await sleep(500);for(let i=0;i<160;i++){const s=await snapshot();if(!s.busy)return s;await sleep(100)}throw Error('busy timeout')}
 async function undo(){await p.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'undo'})));return settled()}
 const initial=await settled(),panel=initial.template.panels.find(p=>p.polygon)
 assert(panel,'Polygon fixture required')
 // Curve: straight points must be convertible, not just display existing handles.
 await p.locator(`[data-panel="${panel.id}"]`).first().click({force:true})
 await rail.getByRole('button',{name:'Adjust pattern curve',exact:true}).click()
 const point=p.locator(`[data-control-point="vertex"][data-panel-id="${panel.id}"]`).first()
 await p.getByRole('button',{name:'Focus selected',exact:true}).click()
 await p.screenshot({path:path.join(output,'before-curve.png')})

 await point.click()
 await sleep(1500)

 let current=await settled()
 assert(actions.some(x=>x.command?.kind==='CurvePoint'),'Curve must author actual native curve')
 assert.notDeepEqual(current.template,initial.template)
 await undo()
 // Split real edge at the actual clicked arclength.
 await rail.getByRole('button',{name:'Split pattern edge',exact:true}).click()
 const edge=p.locator(`[data-edge^="${panel.id}:"]`).first()
 const xy=await edge.evaluate(el=>{const length=el.getTotalLength(),q=el.getPointAtLength(length*.43);const p=el.ownerSVGElement.createSVGPoint();p.x=q.x;p.y=q.y;const t=p.matrixTransform(el.getScreenCTM());return{x:t.x,y:t.y}})
 await p.mouse.click(xy.x,xy.y)
 current=await settled()
 assert(actions.some(x=>x.command?.kind==='SplitBoundary'),'Split must reach Rust')
 assert.equal(current.template.panels.find(x=>x.id===panel.id).polygon.points.length,panel.polygon.points.length+1)
 await undo()
 await rail.getByRole('button',{name:'Tape measure / ruler',exact:true}).click()
 const board=await p.locator('.cc-board svg').boundingBox()
 await p.mouse.click(board.x+board.width*.2,board.y+board.height*.3)
 await p.mouse.click(board.x+board.width*.4,board.y+board.height*.4)
 await p.locator('[data-tape-measurement="true"]').waitFor()
 await rail.getByRole('button',{name:'Fit 3D view',exact:true}).click()
 await p.waitForFunction(()=>+document.querySelector('.cc-scene canvas').dataset.cameraFitCount>0)
 await p.getByTitle('EXO strain map',{exact:true}).click()
 await p.locator('[data-strain-legend="true"]').waitFor()
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas').dataset.analysisMode==='strain',{},{timeout:15000}).catch(async e=>{console.log('strain diagnostics',await p.locator('.cc-scene canvas').evaluateAll(xs=>xs.map(x=>({...x.dataset}))),await p.locator('[data-strain-legend]').allTextContents(),errors);throw e})
 await p.getByTitle('EXO strain map',{exact:true}).click()
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas').dataset.analysisMode==='surface')
 // Change selection immediately before Mirror: catches stale command closure.
 await rail.getByRole('button',{name:'2D pattern select',exact:true}).click()
 await p.getByRole('button',{name:'Frame all',exact:true}).click()
 const last=initial.template.panels.at(-1)
 await p.locator(`[data-panel="${last.id}"]`).first().click()
 await p.locator(`[data-2d-marquee="${last.id}"]`).waitFor()
 await rail.getByRole('button',{name:'Create mirrored pattern copy',exact:true}).click()
 current=await settled()
 assert.equal(actions.filter(x=>x.command?.kind==='Mirror').at(-1)?.command.panel,last.id)
 assert.equal(current.template.panels.length,initial.template.panels.length+1)
 await undo()

 // All-panel layout reset is one undoable transaction and must not reset drape.
 const beforeReset=await snapshot()
 await p.locator('[data-clo-slot="3d:A13"]').click()
 current=await settled()
 assert.equal(current.time,beforeReset.time)
 assert.deepEqual(current.positions,beforeReset.positions)
 assert(actions.some(x=>x.op==='edit-batch'),'Reset 2D must issue transactional native edits')
 assert(current.template.panels.every(x=>(x.layout_rotation_degrees||0)===0))
 assert.notDeepEqual(current.template,beforeReset.template)
 await undo()
 assert.deepEqual((await snapshot()).template,beforeReset.template)
 await p.screenshot({path:path.join(output,'toolbar-repair.png')})
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,output,checks:['native curve creation and undo','click-position edge split and undo','right toolbar metric tape','native camera fit','real strain view on/off','current-selection mirror and undo','atomic reset 2D preserves drape and undoes'],errors}))
}finally{
 await browser?.close().catch(()=>{})
 for(const proc of processes)try{process.kill(-proc.pid,'SIGTERM')}catch{}
}
