/** Read-only product-source QA, using isolated Rust state and compiled Vite preview. */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync,openSync,closeSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-fabric-static-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const backend='http://127.0.0.1:5583',ui='http://127.0.0.1:5584',children=[]
function start(binary,args,env={}){
 const log=openSync(path.join(output,`service-${children.length}.log`),'w')
 const child=spawn(binary,args,{cwd:root,detached:true,stdio:['ignore',log,log],env:{...process.env,...env}})
 closeSync(log);children.push(child)
}
async function ready(url){for(let i=0;i<120;i++){
 try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}
 if(children.some(p=>p.exitCode!==null))throw Error('Isolated QA service exited')
 await new Promise(r=>setTimeout(r,250))
}throw Error('Timed out starting '+url)}
const results={output,backend,ui,checks:[],pageerrors:[],observations:{}}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5583',EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
 })
 start(path.join(root,'node_modules/.bin/vite'),['preview','--host','127.0.0.1','--port','5584','--strictPort','--outDir','dist'])
 await Promise.all([ready(backend+'/health'),ready(ui)])
 async function snap(){const response=await fetch(backend+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot'})});const body=await response.json();assert(body.ok,body.error);return body.data}
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1728,height:1050}})
 page.on('pageerror',error=>results.pageerrors.push(error.message))
 await page.route('**/workspace',async route=>{
  const headers={...route.request().headers()};delete headers.origin
  const response=await route.fetch({url:backend+'/workspace',headers,timeout:30000})
  await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':ui}})
 })
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded',timeout:90000})
 await page.locator('.cc-board [data-panel="front"]').first().waitFor({timeout:50000})
 const patterns=page.locator('.cc-board [data-panel]')
 const fillsBefore=await patterns.evaluateAll(nodes=>nodes.map(n=>({panel:n.dataset.panel,fill:n.getAttribute('fill')})))
 const before=await snap()
 const fabricTab=page.getByRole('tablist',{name:'Object Browser types'}).getByRole('tab',{name:'Fabric',exact:true})
 await fabricTab.click()
 const object=page.locator('.clo-object-list .clo-object-select').first()
 await object.waitFor({state:'visible',timeout:20000})
 await object.click()
 const inspector=page.locator('#cc-native-fabric-inspector .cc-fabric-library')
 await inspector.waitFor({state:'visible',timeout:20000})
 assert.equal(await page.locator('#cc-native-fabric-inspector').isVisible(),true)
 results.checks.push('Selected native fabric opens visible property portal')
 const ball=inspector.locator('.cc-fabric-fold canvas[data-fabric-ball]')
 await ball.waitFor({state:'visible',timeout:20000})
 const render=await ball.evaluate(canvas=>({width:canvas.width,height:canvas.height,drawn:canvas.width>0&&canvas.height>0,meshCount:Number(canvas.dataset.previewMeshCount||0),gl:!!canvas.getContext('webgl2')||!!canvas.getContext('webgl')}))
 results.observations.ball=render
 assert(render.drawn&&render.gl&&render.meshCount>0,'Fabric ball must contain a nonempty WebGL cloth mesh')
 results.checks.push('3D fabric ball canvas has nonzero framebuffer and WebGL context')
 const physics=inspector.locator('.cc-fabric-physics .cc-fabric-adjust')
 assert.equal(await physics.count(),7)
 assert.equal(await physics.locator('input[type="number"]').count(),7)
 results.checks.push('Seven physical property numeric controls mounted')
 const first=physics.first().locator('input[type="number"]')
 const initial=Number(await first.inputValue())
 const target=Number((initial+1).toFixed(3))
 const initialFabricId=await inspector.getAttribute('data-native-fabric-id')
 const frontPanel=before.template.panels.find(p=>p.fabric===initialFabricId)
 assert(frontPanel,'Fixture needs a panel assigned to the selected native fabric')
 await first.fill(String(target));await page.waitForTimeout(200);await first.press('Tab')
 await page.waitForFunction(revision=>Number(document.querySelector('.cc-embedded-root')?.dataset.revision||0)>revision,before.revision,{timeout:2000}).catch(()=>{})
 let edited=await snap()
 for(let i=0;i<25&&edited.revision<=before.revision;i++){await page.waitForTimeout(200);edited=await snap()}
 assert(edited.revision>before.revision,'Physical edit did not increment native Rust revision')
 const oldFabric=before.template.fabrics.find(item=>item.id===initialFabricId)
 let assigned=edited.template.panels.find(p=>p.id===frontPanel.id)
 let editedFabric=edited.template.fabrics.find(item=>item.id===assigned?.fabric)
 // A Fabric edit on only one panel deliberately clones a shared material:
 // validate the newly assigned fabric, not the old material in the library.
 for(let i=0;i<25&&Math.abs(Number(editedFabric?.properties?.density)-target/1000)>1e-8;i++){
   await page.waitForTimeout(120);edited=await snap()
   assigned=edited.template.panels.find(p=>p.id===frontPanel.id)
   editedFabric=edited.template.fabrics.find(item=>item.id===assigned?.fabric)
 }
 assert(oldFabric&&editedFabric,'Assigned native material must exist')
 results.observations.physicalEdit={id:initialFabricId,assignedFabricId:assigned.fabric,panelId:frontPanel.id,previous:initial,input:target,revisionBefore:before.revision,revisionAfter:edited.revision,old:oldFabric.properties,new:editedFabric.properties}
 assert(Math.abs(editedFabric.properties.density-target/1000)<1e-8,'Selected panel fabric density did not change in Rust')
 results.checks.push('Physical edit persists in isolated Rust workspace and increments revision')
 const fillAfterEdit=await patterns.evaluateAll(nodes=>nodes.map(n=>({panel:n.dataset.panel,fill:n.getAttribute('fill')})))
 assert.deepEqual(fillAfterEdit,fillsBefore,'Physical edit changed the white 2D drafting fills')
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'undo'})))
 let undone=await snap()
 for(let i=0;i<25&&undone.template.panels.find(p=>p.id===frontPanel.id)?.fabric!==initialFabricId;i++){await page.waitForTimeout(200);undone=await snap()}
 assert.equal(undone.template.panels.find(p=>p.id===frontPanel.id)?.fabric,initialFabricId,'Undo did not restore the original panel material assignment')
 assert.deepEqual(undone.template.fabrics.find(item=>item.id===initialFabricId)?.properties,oldFabric.properties,'Undo did not restore physical properties')
 assert.deepEqual(await patterns.evaluateAll(nodes=>nodes.map(n=>({panel:n.dataset.panel,fill:n.getAttribute('fill')}))),fillsBefore)
 results.checks.push('Native Undo restores physical values and 2D pattern fills remain white')
 const supplier=inspector.getByRole('textbox',{name:'Fabric supplier'})
 await supplier.waitFor({state:'visible',timeout:10000})
 await supplier.fill('EXO isolated fabric QA')
 await supplier.press('Tab')
 await page.waitForTimeout(500)
 const meta=await snap()
 results.observations.metadata={supplier:meta.propertyMetadata?.fabrics?.[initialFabricId]?.supplier??null}
 assert.equal(meta.propertyMetadata?.fabrics?.[initialFabricId]?.supplier,'EXO isolated fabric QA','Supplier metadata not saved in Rust workspace')
 results.checks.push('Fabric supplier metadata persisted in isolated Rust project')
 await page.screenshot({path:path.join(output,'fabric-inspector-static.png'),fullPage:true})
 assert.deepEqual(results.pageerrors,[])
 results.checks.push('No uncaught browser errors')
 results.pass=true
}catch(error){results.pass=false;results.failure=error.stack||String(error);process.exitCode=1}
finally{
 writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2))
 console.log(JSON.stringify(results,null,2))
 await browser?.close().catch(()=>{})
 for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}
}
