/** Browser-to-Rust material application test using an isolated workspace. */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-native-fabric-doubleclick-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const backend='http://127.0.0.1:5415',front='http://127.0.0.1:5416',children=[]
function service(command,args,additional){
 const p=spawn(command,args,{cwd:root,stdio:'ignore',detached:true,env:{...process.env,...additional}})
 children.push(p)
}
async function ready(url){
 for(let tries=0;tries<100;tries++){
  try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}
  if(children.some(x=>x.exitCode!==null))throw Error('Isolated service stopped')
  await new Promise(resolve=>setTimeout(resolve,240))
 }
 throw Error('Cannot start isolated test service '+url)
}
async function snapshot(){
 const response=await fetch(backend+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot'})})
 const value=await response.json()
 assert.equal(value.ok,true,JSON.stringify(value.error))
 return value.data
}
let browser
try{
 service(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
 })
 service(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],{
  VITE_CLOTHCRAFT_BRIDGE_URL:backend,
 })
 await Promise.all([ready(backend+'/health'),ready(front)])
 browser=await chromium.launch({headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1550,height:940}}),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto(front+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await page.locator('.cc-board [data-panel="front"]').first().waitFor({timeout:45000})
 const initial=await snapshot()
 const first=initial.template.panels[0]
 assert.ok(first)
 const canvas=page.locator('.cc-viewport-3d canvas').first()
 await canvas.waitFor({state:'visible'})
 const initialFrame=await canvas.screenshot({animations:'disabled'})
 await page.locator(`.cc-board [data-panel="${first.id}"]`).first().dispatchEvent('click')
 await page.getByRole('button',{name:'Browse fabrics'}).click()
 await page.getByRole('textbox',{name:'Search library'}).fill('Rigid Denim')
 const denim=page.locator('.exo-fabric-entry-main[data-fabric-preset="denim"]')
 await denim.dblclick()
 await page.waitForTimeout(450)
 console.log('Native denim diagnostic',JSON.stringify({
  notices:await page.locator('.cc-notice,.cc-error').allTextContents(),
  command:await page.locator('.command-result').allTextContents(),
  revision:(await snapshot()).revision,
 }))
 await page.waitForFunction(()=>document.querySelector('.cc-notice')?.textContent?.includes('Denim applied'),null,{timeout:15000})
 const changed=await snapshot()
 await page.waitForTimeout(1000)
 const denimFrame=await canvas.screenshot({animations:'disabled'})
 const applied=changed.template.fabrics.find(f=>f.id===changed.template.panels.find(p=>p.id===first.id).fabric)
 assert.equal(applied.name,'Denim','Double-click must update actual native assigned fabric')
 assert.ok(applied.properties?.density>0)
 assert.ok(changed.revision>initial.revision)
 await page.getByRole('textbox',{name:'Search library'}).fill('Silk Satin')
 const silk=page.locator('.exo-fabric-entry-main[data-fabric-preset="silkSatin"]')
 await silk.dblclick({modifiers:['Shift']})
 await page.waitForFunction(()=>document.querySelector('.cc-notice')?.textContent?.includes('Silk Satin'),null,{timeout:15000})
 const all=await snapshot()
 await page.waitForTimeout(1000)
 const silkFrame=await canvas.screenshot({animations:'disabled'})
 const used=all.template.panels.map(p=>all.template.fabrics.find(f=>f.id===p.fabric)?.name)
 assert.ok(used.every(name=>name==='Silk Satin'),'Shift double-click must assign all native panels')
 assert.notDeepEqual(initialFrame,denimFrame,'Native garment framebuffer must change when applying denim')
 assert.notDeepEqual(denimFrame,silkFrame,'Native garment framebuffer must change when applying silk')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({pass:true,selectedPanel:first.id,denimApplied:applied.name,
  densityKgPerM2:applied.properties.density,revisionBefore:initial.revision,
  revisionAfter:all.revision,allPanelNames:used,renderFramesDiffer:true,errors:errors.length,output}))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of children)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
