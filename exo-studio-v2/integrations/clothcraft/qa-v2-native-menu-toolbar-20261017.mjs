import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,existsSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(tmpdir(),'exo-menu-toolbar-qa-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
assert(existsSync(path.join(root,'research/oss/clothcraft/target/debug/exo-session')))
const random=20000+Math.floor(Math.random()*20000),api='http://127.0.0.1:'+random,ui='http://127.0.0.1:'+(random+1)
const children=[],errors=[],requests=[],checks=[],nativeErrors=[]
function start(cmd,args,env={}){const child=spawn(cmd,args,{cwd:root,detached:true,stdio:'ignore',env:{...process.env,...env}});children.push(child)}
async function ready(url){for(let i=0;i<120;i++){try{if((await fetch(url,{signal:AbortSignal.timeout(900)})).ok)return}catch{}await sleep(180)}throw Error('Server not ready '+url)}
async function snap(){const response=await fetch(api+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot'})});const json=await response.json();assert(json.ok,json.error);return json.data}
async function settle(){for(let i=0;i<65;i++){const s=await snap();if(!s.busy)return s;await sleep(130)}throw Error('Rust remained busy')}
async function check(label,fn){try{await fn();checks.push({label,status:'PASS'})}catch(error){checks.push({label,status:'FAIL',message:String(error?.message||error).slice(0,550)})}}
const dispatch=(page,action)=>page.evaluate(action=>window.dispatchEvent(new CustomEvent('garment-studio-native-action',{detail:action})),action)
const tool=async(page,value)=>page.waitForFunction(value=>document.querySelector('.cc-board svg')?.dataset.nativeTool===value,value,{timeout:5000})
const command=async(page,value)=>page.locator('.cc-embedded-bottom button.active').filter({hasText:value==='move3d'?'Move 3D':'Rotate 3D'}).waitFor({timeout:5000})
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{EXO_CLOTHCRAFT_PORT:String(random),EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),EXO_CLOTHCRAFT_GPU:'0'})
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port',String(random+1),'--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:api})
 await Promise.all([ready(api+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1750,height:1150}})
 page.on('pageerror',error=>errors.push(error.message))
 page.on('request',request=>{if(request.url().endsWith('/workspace')&&request.method()==='POST'){try{requests.push(request.postDataJSON())}catch{}}})
 await page.route('**/workspace',async route=>{const headers={...route.request().headers()};delete headers.origin;const response=await route.fetch({url:api+'/workspace',headers});if(!response.ok()){try{nativeErrors.push({request:route.request().postDataJSON(),response:await response.json()})}catch{}}await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':ui}})})
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await page.locator('.cc-board [data-2d-edge-hit]').first().waitFor({timeout:55000})
 const baseline=await settle()
 for(const [action,mode] of [['2d.notch','notch'],['2d.curve','curve'],['2d.internal','internal']])
  await check('native menu '+action+' sets '+mode,async()=>{await dispatch(page,action);await tool(page,mode)})
 for(const [action,mode] of [['3d.move','move3d'],['3d.rotate','rotate3d']])
  await check('native menu '+action,async()=>{await dispatch(page,action);await command(page,mode)})
 await check('native menu 3d.camera triggers renderer fit',async()=>{const old=Number(await page.locator('.cc-scene canvas').getAttribute('data-camera-fit-count')||0);await dispatch(page,'3d.camera');await page.waitForFunction(old=>Number(document.querySelector('.cc-scene canvas')?.dataset.cameraFitCount||0)>old,old)})
 await check('native menu file.open triggers hidden Rust import picker',async()=>{const input=page.locator('[data-native-project-import="true"]');assert.equal(await input.count(),1);await input.evaluate(el=>{el.dataset.qaClicked='false';el.addEventListener('click',()=>el.dataset.qaClicked='true',{once:true})});await dispatch(page,'file.open');await page.waitForFunction(()=>document.querySelector('[data-native-project-import]')?.dataset.qaClicked==='true')})
 await check('native menu file.save calls Rust save',async()=>{const before=requests.filter(x=>x.op==='save').length;await dispatch(page,'file.save');await page.waitForFunction(()=>false,null,{timeout:250}).catch(()=>{});for(let i=0;i<35&&requests.filter(x=>x.op==='save').length===before;i++)await sleep(120);assert(requests.filter(x=>x.op==='save').length>before)})
 await check('Cmd+S from right sidebar saves native Rust project',async()=>{const before=requests.filter(x=>x.op==='save').length;await page.locator('nav[aria-label="Right workspace tools"] button').first().focus();await page.keyboard.press('Meta+s');for(let i=0;i<35&&requests.filter(x=>x.op==='save').length===before;i++)await sleep(120);assert(requests.filter(x=>x.op==='save').length>before)})
 await dispatch(page,'2d.notch');await tool(page,'notch')
 const right=page.getByRole('navigation',{name:'Right workspace tools'})
 await check('right palette Notch selects native board',async()=>{const b=right.locator('[data-clo-slot="2d:A08"]');await b.click();await tool(page,'notch')})
 await check('2D marking toolbar returns workspace from 3D rotate to edit mode',async()=>assert(await page.locator('.cc-embedded-bottom button.active').filter({hasText:'Select / edit'}).count()>0,'2D tool selected while workspace remained in 3D rotate mode'))
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'mode:edit'})))
 await settle()
 await page.locator('.cc-embedded-footer strong').getByText('Rust session ready',{exact:true}).waitFor({timeout:15000})
 let chosen
 async function edgeClick(){const edges=page.locator('.cc-board [data-2d-edge-hit]');const length=await edges.count();for(let i=0;i<length;i++){const e=edges.nth(i);const box=await e.boundingBox();if(box&&box.width>9&&box.height>=0){chosen=await e.getAttribute('data-2d-edge-hit');const pts=await e.evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*.5);const a=el.ownerSVGElement.createSVGPoint();a.x=p.x;a.y=p.y;const out=a.matrixTransform(el.getScreenCTM());return{x:out.x,y:out.y}});await page.mouse.click(pts.x,pts.y);return}}throw Error('No visible edge suitable for click')}
 await check('SVG contour click persists native Notch with preserved drape',async()=>{await edgeClick();await page.locator('.cc-embedded-footer strong').getByText('Rust session ready',{exact:true}).waitFor({timeout:15000});let after;for(let i=0;i<40;i++){after=await settle();if(after.revision>baseline.revision)break;await sleep(140)}assert(after.revision>baseline.revision,'Notch did not edit Rust revision');const [panel,edge]=chosen.split(':');assert(after.template.panels.find(p=>p.id===panel)?.polygon?.notches?.[edge]?.length>0,'No stored notch');assert.deepEqual(after.positions,baseline.positions);assert.deepEqual(after.triangles,baseline.triangles);await page.locator('[data-native-notch]').first().waitFor({timeout:10000})})
 await check('right palette Seam Allowance selects native board',async()=>{const b=right.locator('[data-clo-slot="2d:A09"]');await b.click();await tool(page,'allowance')})
 await check('SVG contour click persists allowance guide preserving drape',async()=>{const before=await settle();await edgeClick();await page.locator('.cc-embedded-footer strong').getByText('Rust session ready',{exact:true}).waitFor({timeout:15000});let after;for(let i=0;i<40;i++){after=await settle();if(after.revision>before.revision)break;await sleep(140)}assert(after.revision>before.revision,'Allowance did not edit Rust revision');const [panel,edge]=chosen.split(':');assert.equal(after.template.panels.find(p=>p.id===panel)?.polygon?.seam_allowances?.[edge],.01);assert.deepEqual(after.positions,baseline.positions);assert.deepEqual(after.triangles,baseline.triangles);await page.locator('[data-native-allowance]').first().waitFor({timeout:10000})})
 await check('native menu edit.undo and edit.redo persist Rust history',async()=>{await sleep(650);const before=await settle();const beforeGuide=JSON.stringify(before.template.panels.map(p=>p.polygon?.seam_allowances));await dispatch(page,'edit.undo');let undone;for(let i=0;i<40;i++){await sleep(150);undone=await settle();if(JSON.stringify(undone.template.panels.map(p=>p.polygon?.seam_allowances))!==beforeGuide)break}assert.notEqual(JSON.stringify(undone.template.panels.map(p=>p.polygon?.seam_allowances)),beforeGuide,'Undo did not remove allowance');assert.deepEqual(undone.positions,baseline.positions);await sleep(350);await dispatch(page,'edit.redo');let redone;for(let i=0;i<40;i++){await sleep(150);redone=await settle();if(JSON.stringify(redone.template.panels.map(p=>p.polygon?.seam_allowances))===beforeGuide)break}assert.equal(JSON.stringify(redone.template.panels.map(p=>p.polygon?.seam_allowances)),beforeGuide,'Redo did not restore allowance');assert.deepEqual(redone.positions,baseline.positions)})
 await check('zero JavaScript page errors',async()=>assert.deepEqual(errors,[]))
}finally{
 await browser?.close().catch(()=>{})
 for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}
 const summary={passed:checks.every(x=>x.status==='PASS'),output,apiPort:random,uiPort:random+1,checks,jsErrors:errors,nativeErrors,nativeOps:requests.map(x=>x.command?.kind||x.op).filter(Boolean)}
 writeFileSync(path.join(output,'report.json'),JSON.stringify(summary,null,2))
 console.log(JSON.stringify(summary,null,2))
 if(!summary.passed)process.exitCode=1
}
