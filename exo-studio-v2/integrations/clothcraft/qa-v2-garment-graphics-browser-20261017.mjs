/** Isolated Rust/Vite browser coverage for native visual artwork overlays. */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync,openSync,closeSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-garment-graphics-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const backend='http://127.0.0.1:5463',ui='http://127.0.0.1:5464',children=[]
function start(binary,args,env={}) {
 const log=openSync(path.join(output,`service-${children.length}.log`),'w')
 const child=spawn(binary,args,{cwd:root,detached:true,stdio:['ignore',log,log],env:{...process.env,...env}})
 closeSync(log)
 children.push(child)
}
async function ready(url){
 for(let i=0;i<120;i++) {
  try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}
  if(children.some(p=>p.exitCode!==null))throw Error('Isolated QA service exited')
  await new Promise(r=>setTimeout(r,250))
 }
 throw Error('Timed out starting '+url)
}
const results={output,backend,ui,checks:[],pageerrors:[]}
let browser
try {
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5463',EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
 })
 // Preview the compiled static bundle rather than triggering thousands of
 // dev-time Vite transformations on an already busy shared Mac workspace.
 start(path.join(root,'node_modules/.bin/vite'),['preview','--host','127.0.0.1','--port','5464','--strictPort','--outDir','dist'])
 await Promise.all([ready(backend+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const context=await browser.newContext({viewport:{width:1728,height:1050}})
 const page=await context.newPage()
 page.on('pageerror',e=>results.pageerrors.push(e.message))
 await page.route('**/workspace',async route=>{
  const headers={...route.request().headers()};delete headers.origin
  const response=await route.fetch({url:backend+'/workspace',headers,timeout:30000})
  await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':ui}})
 })
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded',timeout:90000})
 await page.locator('.cc-board [data-panel="front"]').first().waitFor({timeout:50000})
 const patterns=page.locator('.cc-board [data-panel]')
 const fillsBefore=await patterns.evaluateAll(nodes=>nodes.map(n=>({panel:n.dataset.panel,fill:n.getAttribute('fill')})))
 const graphicTab=page.getByRole('tab',{name:'Graphic',exact:true})
 await graphicTab.click()
 const editor=page.locator('#cc-native-graphic-editor .cc-graphic-editor')
 await editor.waitFor({state:'visible',timeout:20000})
 results.checks.push('Graphic tab opens controlled native editor')
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><circle cx="128" cy="128" r="110" fill="#ed1556"/><path d="M60 128h136" stroke="#fff" stroke-width="22"/></svg>'
 await editor.locator('input[type="file"]').setInputFiles({name:'qa-print.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)})
 await page.waitForFunction(()=>document.querySelector('.cc-viewport-3d canvas')?.dataset.garmentGraphicCount==='1',null,{timeout:30000})
 results.checks.push('SVG upload creates one canvas garment graphic')
 const sliders=editor.locator('input[type="range"]')
 assert.equal(await sliders.count(),4)
 await sliders.nth(0).fill('0.65')
 await sliders.nth(1).fill('0.4')
 await sliders.nth(2).fill('0.7')
 await sliders.nth(3).fill('35')
 assert.deepEqual(await sliders.evaluateAll(nodes=>nodes.map(n=>n.value)),['0.65','0.4','0.7','35'])
 results.checks.push('X/Y/scale/rotation controls update')
 const fillsAfter=await patterns.evaluateAll(nodes=>nodes.map(n=>({panel:n.dataset.panel,fill:n.getAttribute('fill')})))
 assert.deepEqual(fillsAfter,fillsBefore,'Artwork must not mutate 2D drafting panel fills')
 assert.ok(fillsAfter.every(x=>/^#(?:f7f8f7|f4f4f3|f4deb7)$/i.test(x.fill)),JSON.stringify(fillsAfter))
 results.checks.push('2D drafting patterns stay white/selection cream')
 await page.screenshot({path:path.join(output,'graphics-before-reload.png'),fullPage:true})
 await page.waitForTimeout(700)
 await page.reload({waitUntil:'domcontentloaded'})
 await page.locator('.cc-board [data-panel="front"]').first().waitFor({timeout:50000})
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
 writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2))
 await browser?.close().catch(()=>{})
 for(const p of children)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
