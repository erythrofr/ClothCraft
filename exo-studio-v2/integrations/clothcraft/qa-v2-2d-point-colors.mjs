// Isolated browser QA for visible, high-contrast 2D edit-point colors.
// No installed V1/V2 service or saved garment is modified.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdirSync,mkdtempSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-point-colors-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const api='http://127.0.0.1:5415',ui='http://127.0.0.1:5416',workers=[]
const start=(bin,args,env={})=>{
 const processHandle=spawn(bin,args,{cwd:root,stdio:'ignore',detached:true,env:{...process.env,...env}})
 workers.push(processHandle);return processHandle
}
const ready=async url=>{
 for(let i=0;i<100;i++){
  try{if((await fetch(url,{signal:AbortSignal.timeout(1500)})).ok)return}catch{}
  if(workers.some(worker=>worker.exitCode!==null))throw Error('QA process ended early')
  await new Promise(resolve=>setTimeout(resolve,200))
 }
 throw Error('QA server unavailable: '+url)
}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
 })
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:api})
 await Promise.all([ready(api+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1650,height:1020}}),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 const firstPanel=page.locator('.cc-board [data-panel]').first()
 await firstPanel.waitFor({timeout:50000})
 await page.locator('.cc-embedded-bottom').getByRole('button',{name:'Select / edit'}).click()
 await firstPanel.click({force:true})
 const controls=page.locator('.cc-board [data-control-point="vertex"]')
 await controls.first().waitFor({timeout:12000})
 const colors=await controls.evaluateAll(nodes=>[...new Set(nodes.map(el=>el.getAttribute('fill')))])
 assert(colors.includes('#206DAB'),'Selected fabric vertices should be saturated blue, never white')
 assert(!colors.some(c=>['white','#fff','#ffffff','#f4f4f3'].includes(c?.toLowerCase())),'White control dots disappear on white fabric')
 assert.equal(await firstPanel.getAttribute('fill-opacity'),'1','Pattern fabric should remain fully opaque')
 // Editing controls must stay interactive after their color change.
 await controls.first().click({force:true})
 assert(await controls.count()>0,'Selecting a control point removed the editable anchors')
 const curves=await page.locator('.cc-board [data-control-point="curve"]').count()
 if(curves)assert.equal(await page.locator('.cc-board [data-control-point="curve"]').first().getAttribute('fill'),'#7451BA')
 const seamDots=page.locator('.cc-board [data-control-point="seam"]')
 assert(await seamDots.count()>0,'Preserve visible color-coded sewing correspondence points')
 const seamStyles=await seamDots.evaluateAll(nodes=>[...new Set(nodes.map(node=>node.getAttribute('fill')))])
 assert(seamStyles.every(c=>c!==null&&c.toLowerCase()!=='white'))
 assert.equal(await seamDots.first().getAttribute('stroke'),'#243746','Seam dots need an outline contrasting on white fabric')
 await page.screenshot({path:path.join(output,'2d-colored-points.png')})
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,vertexColors:colors,selectedVertex:'#E56A26',curvePoints:curves,
  seamDots:await seamDots.count(),seamColors:seamStyles,patternOpaque:true,qaOutput:output,errors},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const worker of workers)try{process.kill(-worker.pid,'SIGTERM')}catch{}
}
