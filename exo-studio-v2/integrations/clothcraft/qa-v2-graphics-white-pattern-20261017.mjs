/** Isolated Rust/Vite browser coverage for native visual artwork overlays. */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync,createWriteStream} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-graphics-white-pattern-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const backend='http://127.0.0.1:5683',ui='http://127.0.0.1:5684',children=[]
const services={rust:{url:backend+'/health',ready:false,lastError:null,exitCode:null},vite:{url:ui,ready:false,lastError:null,exitCode:null}}
function start(name,binary,args,env={}) {
 const child=spawn(binary,args,{cwd:root,detached:true,stdio:['ignore','pipe','pipe'],env:{...process.env,...env}})
 child.stdout.pipe(createWriteStream(path.join(output,`${name}.stdout.log`)))
 child.stderr.pipe(createWriteStream(path.join(output,`${name}.stderr.log`)))
 child.on('exit',(code,signal)=>{services[name].exitCode=code;services[name].exitSignal=signal})
 child.on('error',error=>{services[name].lastError=error.message})
 children.push(child)
}
async function ready(name){
 const service=services[name]
 for(let i=0;i<160;i++) {
  try {const response=await fetch(service.url,{signal:AbortSignal.timeout(1000)});if(response.ok){service.ready=true;return}service.lastError=`HTTP ${response.status}`}catch(error){service.lastError=error.message}
  if(service.exitCode!==null || service.exitSignal)throw Error(`${name} exited: ${service.exitCode ?? service.exitSignal}`)
  await new Promise(r=>setTimeout(r,250))
 }
 throw Error(`${name} readiness failed: ${service.lastError}`)
}
const results={output,backend,ui,services,checks:[],pageerrors:[],stage:'starting'}
const deadline=setTimeout(()=>{results.pass=false;results.failure=`QA timed out at stage ${results.stage}`;writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.error(results.failure);for(const p of children)try{process.kill(-p.pid,'SIGTERM')}catch{};process.exit(2)},110000)
let browser
try {
 start('rust',process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5683',EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
 })
 start('vite',path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5684','--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:backend})
 results.stage='services'; await Promise.all([ready('rust'),ready('vite')])
 results.stage='browser-launch';browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const context=await browser.newContext({viewport:{width:1728,height:1050}})
 const page=await context.newPage()
 page.on('pageerror',e=>results.pageerrors.push(e.message))
 results.stage='page-navigation';await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 results.stage='native-front-pattern';await page.locator('.cc-board [data-panel="front"]').first().waitFor({timeout:50000})
 const patterns=page.locator('.cc-board [data-panel]')
 const fillsBefore=await patterns.evaluateAll(nodes=>nodes.map(n=>({panel:n.dataset.panel,fill:n.getAttribute('fill')})))
 const graphicTab=page.getByRole('tab',{name:'Graphic',exact:true})
 results.stage='graphic-tab';await graphicTab.click()
 const editor=page.locator('#cc-native-graphic-editor .cc-graphic-editor')
 await editor.waitFor({state:'visible',timeout:20000})
 results.checks.push('Graphic tab opens controlled native editor')
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><circle cx="128" cy="128" r="110" fill="#ed1556"/><path d="M60 128h136" stroke="#fff" stroke-width="22"/></svg>'
 results.stage='upload-artwork';await editor.locator('input[type="file"]').setInputFiles({name:'qa-print.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)})
 results.stage='garment-graphic-count';await page.waitForFunction(()=>document.querySelector('.cc-viewport-3d canvas')?.dataset.garmentGraphicCount==='1',null,{timeout:30000})
 results.checks.push('SVG upload creates one canvas garment graphic')
 const sliders=editor.locator('input[type="range"]')
 assert.equal(await sliders.count(),4)
 await sliders.nth(0).fill('0.65')
 await sliders.nth(1).fill('0.40')
 await sliders.nth(2).fill('0.70')
 await sliders.nth(3).fill('35')
 assert.deepEqual(await sliders.evaluateAll(nodes=>nodes.map(n=>n.value)),['0.65','0.4','0.7','35'])
 results.checks.push('X/Y/scale/rotation controls update')
 const fillsAfter=await patterns.evaluateAll(nodes=>nodes.map(n=>({panel:n.dataset.panel,fill:n.getAttribute('fill')})))
 assert.deepEqual(fillsAfter,fillsBefore,'Artwork must not mutate 2D drafting panel fills')
 assert.ok(fillsAfter.every(x=>x.fill==='#f7f8f7'),JSON.stringify(fillsAfter))
 results.checks.push('2D drafting patterns stay white/selection cream')
 // Native 3D overlay count is diagnostic; inspect actual render pixels via before/after canvas screenshots.
 const canvas=page.locator('.cc-viewport-3d canvas').first()
 await canvas.screenshot({path:path.join(output,'graphics-canvas-after-upload.png')})
 const board=page.locator('.cc-board')
 const controls=board.getByRole('group',{name:'2D board view controls'})
 await controls.getByRole('button',{name:'Grid'}).click()
 assert.equal(await controls.getByRole('button',{name:'Grid'}).getAttribute('aria-pressed'),'true')
 await controls.getByRole('button',{name:'Front'}).click()
 assert.equal(await controls.getByRole('button',{name:'Front'}).getAttribute('aria-pressed'),'true')
 const boardSvg=board.locator('svg').last()
 for(const name of ['Frame all','Focus selected','Center axis']) {
  await controls.getByRole('button',{name}).click()
  const box=await boardSvg.getAttribute('viewBox')
  assert.ok(box && box.split(/[ ,]+/).length===4, name+' viewBox missing')
 }
 results.checks.push('FR/GR toggle pressed state and F/S/C retain valid SVG viewBox')
 const fabricTab=page.getByRole('tab',{name:'Fabric',exact:true})
 results.stage='fabric-apply';await fabricTab.click()
 const assign=page.locator('[data-fabric-preset]').first()
 await assign.waitFor({timeout:15000})
 await assign.click()
 await page.waitForTimeout(800)
 const afterFabric=await patterns.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('fill')))
 assert.ok(afterFabric.length>0 && afterFabric.every(fill=>fill==='#f7f8f7'),JSON.stringify(afterFabric))
 results.checks.push('Native fabric preset apply leaves all 2D panel fills #f7f8f7')
 await graphicTab.click()
 await page.screenshot({path:path.join(output,'graphics-before-reload.png'),fullPage:true})
 await page.waitForTimeout(700)
 results.stage='persistence-reload';await page.reload({waitUntil:'domcontentloaded'})
 results.stage='native-front-pattern';await page.locator('.cc-board [data-panel="front"]').first().waitFor({timeout:50000})
 await page.getByRole('tab',{name:'Graphic',exact:true}).click()
 await page.locator('#cc-native-graphic-editor .cc-graphic-item').first().waitFor({timeout:20000})
 await page.waitForFunction(()=>document.querySelector('.cc-viewport-3d canvas')?.dataset.garmentGraphicCount==='1',null,{timeout:20000})
 const restored=await page.locator('#cc-native-graphic-editor input[type="range"]').evaluateAll(nodes=>nodes.map(n=>n.value))
 assert.deepEqual(restored,['0.65','0.4','0.7','35'])
 results.checks.push('Reload restores artwork and placement from IndexedDB sidecar')
 await page.screenshot({path:path.join(output,'graphics-after-reload.png'),fullPage:true})
 assert.deepEqual(results.pageerrors,[])
 results.checks.push('No uncaught page errors')
 results.pass=true
 console.log(JSON.stringify(results,null,2))
}catch(e){
 results.pass=false;results.failure=e.stack||String(e)
 console.error(JSON.stringify(results,null,2))
 process.exitCode=1
}finally{
 clearTimeout(deadline);writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2))
 await browser?.close().catch(()=>{})
 for(const p of children)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
