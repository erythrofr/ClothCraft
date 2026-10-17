// Isolated live Rust/browser toolbar coverage. Each assertion records its own result.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,existsSync,copyFileSync,writeFileSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(tmpdir(),'exo-toolbar-coverage-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const ref=path.join(homedir(),'Library/Application Support/EXO-ClothCraft-Studio/Snapshots/V1-20261016')
for(const f of ['fitting-project.json','fitting-project.json.native'])if(existsSync(path.join(ref,f)))copyFileSync(path.join(ref,f),path.join(output,'workspace',f))
const rust=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
assert(existsSync(rust),'Rust session binary missing')
const processes=[]
function start(binary,args,env={}){const p=spawn(binary,args,{cwd:root,env:{...process.env,...env},stdio:'ignore',detached:true});processes.push(p)}
async function ready(url){for(let n=0;n<100;n++){try{if((await fetch(url,{signal:AbortSignal.timeout(1200)})).ok)return}catch{}await sleep(250)}throw Error('Service not ready: '+url)}
const base='http://127.0.0.1:5575',ui='http://127.0.0.1:5576'
const results=[],pageErrors=[],nativeCommands=[]
let browser,inventory={left:[],right:[]}
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{EXO_CLOTHCRAFT_PORT:'5575',EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),EXO_CLOTHCRAFT_SESSION_BIN:rust,EXO_CLOTHCRAFT_GPU:'0'})
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5576','--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:base})
 await Promise.all([ready(base+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1728,height:1040}})
 page.on('pageerror',e=>pageErrors.push(e.message))
 page.on('request',r=>{if(r.url().endsWith('/workspace')&&r.method()==='POST'){try{nativeCommands.push(r.postDataJSON())}catch{}}})
 await page.route('**/workspace',async route=>{const headers={...route.request().headers()};delete headers.origin;const response=await route.fetch({url:base+'/workspace',headers});await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':ui}})})
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await page.locator('.cc-board [data-panel]').first().waitFor({timeout:50000})
 const right=page.getByRole('navigation',{name:'Right workspace tools'})
 const focus=right.getByRole('button',{name:'Switch to focused workspace tools'})
 if(await focus.count())await focus.click()
 inventory=await page.evaluate(()=>({left:[...document.querySelectorAll('.tool-rail button')].filter(e=>e.getClientRects().length).map(e=>({label:e.getAttribute('aria-label')||e.title||e.textContent.trim(),slot:e.dataset.cloSlot||null,capability:e.dataset.cloImplementation||null})),right:[...document.querySelectorAll('nav[aria-label="Right workspace tools"] button')].filter(e=>e.getClientRects().length).map(e=>({label:e.getAttribute('aria-label')||e.title||e.textContent.trim(),disabled:e.disabled}))}))
 async function check(name,fn){try{await fn();results.push({name,status:'PASS'})}catch(e){results.push({name,status:'FAIL',error:String(e.message).slice(0,320)})}}
 async function snap(){const r=await fetch(base+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot'})});const j=await r.json();assert(j.ok,JSON.stringify(j.error));return j.data}
 async function settled(){for(let i=0;i<100;i++){const s=await snap();if(!s.busy)return s;await sleep(100)}throw Error('Rust busy timeout')}
 async function mode(slot,expected){await page.locator(`[data-clo-slot="${slot}"]`).click();await page.waitForFunction(expected=>document.querySelector('.cc-scene canvas')?.dataset.nativeMode===expected,expected,{timeout:3500})}
 await check('left: 3D move mode selected',async()=>{await page.getByTitle('EXO 3D move garment').click();await page.waitForFunction(()=>document.querySelector('.cc-embedded-bottom button.active')?.textContent?.includes('Move 3D'))})
 await check('left: fabric hand mode selected',async()=>{await page.getByTitle('EXO 3D fabric hand tool').click();await page.waitForFunction(()=>document.querySelector('.cc-embedded-bottom button.active')?.textContent?.includes('Grab / stretch'))})
 await check('left: rotate mode selected',async()=>{await page.getByTitle('EXO 3D rotate selected fabric').click();await page.waitForFunction(()=>document.querySelector('.cc-embedded-bottom button.active')?.textContent?.includes('Rotate 3D'))})
 await check('embedded seam panel exposed through native tool',async()=>{await page.locator('.cc-embedded-bottom button').filter({hasText:'Sew edges'}).click();await page.locator('[data-native-sewing-panel="true"]').waitFor();assert(await page.locator('[data-native-create-seam="true"]').isDisabled(),'Create seam should require two selected edges')})
 await check('embedded 2D Draw enables native pen mode',async()=>{await page.locator('.cc-embedded-bottom button').filter({hasText:'Draw'}).click();await page.waitForFunction(()=>document.querySelector('.cc-embedded-bottom button.active')?.textContent?.trim()==='Draw')})
 await check('left: strain shader enabled then disabled',async()=>{await page.getByTitle('EXO strain map',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.analysisMode==='strain');await page.getByTitle('EXO strain map',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.analysisMode==='surface')})
 await check('right: Surface / strain view toggles on and off',async()=>{const toggle=right.getByRole('button',{name:'Surface / strain view',exact:true});await toggle.click();await page.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.analysisMode==='strain');await toggle.click();await page.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.analysisMode==='surface')})
 await check('right: Split 2D tool selected',async()=>{await right.getByRole('button',{name:'Split pattern edge',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cc-board svg')?.dataset.nativeTool==='split')})
 await check('right: Curve 2D tool selected',async()=>{await right.getByRole('button',{name:'Adjust pattern curve',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cc-board svg')?.dataset.nativeTool==='curve')})
 await check('right: Tape measure 2D tool selected',async()=>{await right.getByRole('button',{name:'Tape measure / ruler',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cc-board svg')?.dataset.nativeTool==='measure')})
 await check('right: 3D fit camera renderer effect',async()=>{await right.getByRole('button',{name:'Fit 3D view',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('.cc-scene canvas')?.dataset.cameraFitCount)>0)})
 await check('right: native mirror adds pattern and undo restores',async()=>{await right.getByRole('button',{name:'2D pattern select',exact:true}).click();const original=await settled();const panel=original.template.panels.at(-1);await page.locator(`[data-panel="${panel.id}"]`).first().click();await right.getByRole('button',{name:'Create mirrored pattern copy',exact:true}).click();const changed=await settled();assert.equal(changed.template.panels.length,original.template.panels.length+1);assert.equal(nativeCommands.filter(x=>x.command?.kind==='Mirror').at(-1)?.command.panel,panel.id);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'undo'})));let restored=false;for(let i=0;i<30;i++){await sleep(120);if((await settled()).template.panels.length===original.template.panels.length){restored=true;break}}assert(restored,'Mirror undo did not restore panel count')})
 await check('left: native 2D reset is reversible and preserves drape',async()=>{const before=await settled();await page.locator('[data-clo-slot="3d:A13"]').click();const after=await settled();assert.deepEqual(after.positions,before.positions);assert.equal(after.time,before.time);assert(nativeCommands.some(x=>x.op==='edit-batch'),'No native edit-batch');await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'undo'})));let restored=false;for(let i=0;i<30;i++){await sleep(120);const now=await settled();if(now.template.panels.every((p,j)=>JSON.stringify(p.layout||p.layout_2d||[0,0])===JSON.stringify(before.template.panels[j]?.layout||before.template.panels[j]?.layout_2d||[0,0]))){restored=true;break}}assert(restored,'Reset layout undo did not restore panel positions')})
 await check('native seam commit between two unsown edges and undo',async()=>{
  const before=await settled(),existing=before.template.seams||[]
  const linked=new Set(existing.flatMap(s=>[s.a,s.b,s.first,s.second].filter(Boolean).map(v=>String(v.panel)+':'+String(v.edge))))
  await page.locator('.cc-embedded-bottom button').filter({hasText:'Sew edges'}).click()
  await page.locator('[data-native-sewing-panel="true"]').waitFor()
  const visible=await page.locator('.cc-board [data-edge]').evaluateAll(nodes=>nodes.map(n=>n.dataset.edge))
  const candidates=[...new Set(visible)].filter(e=>!linked.has(e))
  let selected=null
  for(let i=0;i<candidates.length&&!selected;i++)for(let j=i+1;j<candidates.length;j++){
   if(candidates[i].split(':')[0]!==candidates[j].split(':')[0]){selected=[candidates[i],candidates[j]];break}
  }
  assert(selected,'No compatible unsown 2D boundary candidates')
  for(const edge of selected){
   const line=page.locator('.cc-board [data-edge]').filter({has:page.locator('__nonexistent__')})
   const xy=await page.locator('.cc-board [data-edge]').evaluateAll((els,key)=>{const e=els.find(n=>n.dataset.edge===key);if(!e)return null;const pt=e.points.getItem(Math.floor((e.points.numberOfItems-1)/2));const svg=e.ownerSVGElement.createSVGPoint();svg.x=pt.x;svg.y=pt.y;const m=svg.matrixTransform(e.getScreenCTM());return{x:m.x,y:m.y}},edge)
   assert(xy,'Missing edge coordinates '+edge)
   await page.mouse.click(xy.x,xy.y)
  }
  const create=page.locator('[data-native-create-seam="true"]')
  await create.waitFor({state:'visible'})
  assert(!(await create.isDisabled()),'Seam commit stays disabled after two distinct edge picks')
  await create.click()
  let after
  for(let i=0;i<35;i++){await sleep(120);after=await settled();if(after.template.seams.length>existing.length)break}
  assert.equal(after.template.seams.length,existing.length+1,'Seam not persisted')
  assert(nativeCommands.some(x=>x.command?.kind==='Sew'),'Native Sew edit absent')
  await page.locator('.cc-embedded-footer strong').getByText('Rust session ready',{exact:true}).waitFor({state:'visible',timeout:15000})
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'undo'})))
  let undone=false;for(let i=0;i<35;i++){await sleep(120);if((await settled()).template.seams.length===existing.length){undone=true;break}}
  assert(undone,'Sew undo did not restore seam count')
 })
 await check('native three-point polygon close and undo',async()=>{
  const before=await settled()
  await page.locator('.cc-embedded-bottom button').filter({hasText:'Draw'}).click()
  const board=page.locator('.cc-board svg').first()
  await board.waitFor()
  const bbox=await board.boundingBox();assert(bbox,'2D board SVG unavailable')
  for(const [x,y] of [[.80,.70],[.91,.70],[.86,.82]])await page.mouse.click(bbox.x+bbox.width*x,bbox.y+bbox.height*y)
  const close=page.getByRole('button',{name:/Close pattern \(3\)/})
  await close.waitFor({timeout:3500});assert(!(await close.isDisabled()))
  await close.click()
  let after;for(let i=0;i<35;i++){await sleep(120);after=await settled();if(after.template.panels.length>before.template.panels.length)break}
  assert.equal(after.template.panels.length,before.template.panels.length+1,'Polygon not persisted')
  assert(nativeCommands.some(x=>x.command?.kind==='Polygon'),'Native Polygon edit absent')
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'undo'})))
  let undone=false;for(let i=0;i<35;i++){await sleep(120);if((await settled()).template.panels.length===before.template.panels.length){undone=true;break}}
  assert(undone,'Polygon undo did not restore count')
 })
 await check('no browser runtime errors',async()=>assert.deepEqual(pageErrors,[]))
 await page.screenshot({path:path.join(output,'coverage.png')})
}finally{
 await browser?.close().catch(()=>{})
 for(const proc of processes)try{process.kill(-proc.pid,'SIGTERM')}catch{}
 const summary={output,inventory,results,nativeCommandKinds:[...new Set(nativeCommands.map(x=>x.command?.kind||x.op||'unknown'))],pageErrors}
 writeFileSync(path.join(output,'report.json'),JSON.stringify(summary,null,2))
 console.log(JSON.stringify(summary,null,2))
 if(results.some(x=>x.status==='FAIL'))process.exitCode=1
}
