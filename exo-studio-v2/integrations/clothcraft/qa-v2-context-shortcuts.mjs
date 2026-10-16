// Browser validation of V2 context-aware right click menus and native Rust history shortcuts.
// All services/projects are isolated in a throwaway test workspace.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync, mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-context-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
// The bridge intentionally allowlists only approved localhost UI origins.
const service='http://127.0.0.1:5417',ui='http://127.0.0.1:5416'
const spawned=[]
function start(command,args,env={}){
 const child=spawn(command,args,{cwd:root,env:{...process.env,...env},stdio:'ignore',detached:true})
 spawned.push(child)
 return child
}
async function ready(url){
 for(let i=0;i<100;i++){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(1000)});if(response.ok)return}catch{}
  await sleep(250)
 }
 throw Error('Timed out opening '+url)
}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5417',
  EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  EXO_CLOTHCRAFT_GPU:'0',
 })
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],
  {VITE_CLOTHCRAFT_BRIDGE_URL:service})
 await Promise.all([ready(service+'/health'),ready(ui)])
 browser=await chromium.launch({
  headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
 })
 const page=await browser.newPage({viewport:{width:1680,height:1000}})
 const errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto(ui+'/?desktop=1&engine=clothcraft-lab',{waitUntil:'domcontentloaded'})
 const piece=page.locator('.cc-board path[data-panel]').first()
 await piece.waitFor({timeout:20000}).catch(async error=>{
  console.error('V2 browser startup diagnostic',JSON.stringify({
   errors,
   body:(await page.locator('body').innerText()).slice(0,1500),
   sections:await page.locator('.cc-embedded-root,.cc-workspace,.cc-board,.cc-scene').count(),
   health:await fetch(service+'/health').then(r=>r.text()).catch(e=>String(e)),
  },null,2))
  throw error
 })
 const pieces=()=>page.locator('.cc-pieces button[data-piece]').count()
 const count=await pieces()
 // Right-click directly on a 2D garment panel. Action must reach Rust history.
 await piece.click({button:'right',force:true})
 const menu=page.getByRole('menu',{name:'2D pattern context actions'})
 await menu.waitFor()
 await menu.getByRole('menuitem',{name:'Duplicate pattern'}).click()
 await page.waitForFunction(expected=>document.querySelectorAll('.cc-pieces button[data-piece]').length>expected,count)
 assert.equal(await pieces(),count+1,'2D context duplicate did not create a Rust panel')
 // The editor's keyboard focus is retained after using the portal menu.
 await page.locator('.cc-board svg').click({position:{x:110,y:350}})
 await page.keyboard.press('Meta+z')
 await page.waitForFunction(expected=>document.querySelectorAll('.cc-pieces button[data-piece]').length===expected,count)
 await page.keyboard.press('Meta+Shift+z')
 await page.waitForFunction(expected=>document.querySelectorAll('.cc-pieces button[data-piece]').length===expected+1,count)
 // Context menu on empty 3D space still provides real viewport modes.
 const canvas=page.locator('.cc-scene canvas')
 const size=await canvas.boundingBox()
 const rightClick={x:Math.round(size.width*.69),y:Math.round(size.height*.58)}
 await canvas.click({button:'right',position:rightClick})
 const menu3=page.getByRole('menu',{name:'3D garment context actions'})
 await menu3.waitFor()
 await menu3.getByRole('menuitem',{name:'Fabric hand / stretch'}).last().click()
 const hand=page.locator('.cc-scene .clo-corner-tool-group > button[title="Fabric Hand"]')
 await page.waitForFunction(()=>document.querySelector('.cc-scene .clo-corner-tool-group > button[title="Fabric Hand"]')?.getAttribute('aria-pressed')==='true')
 assert.equal(await hand.getAttribute('aria-pressed'),'true')
 // Shortcut cheatsheet appears in the same native editor surface.
 await canvas.click({position:rightClick})
 await page.keyboard.type('?')
 await page.getByRole('menu',{name:'3D garment context actions'}).waitFor({state:'hidden'}).catch(()=>{})
 await page.locator('.cc-native-context-title').getByText('SHORTCUTS').waitFor()
 await page.keyboard.press('Escape')
 assert.equal(await page.locator('.cc-native-context-menu').count(),0)
 assert.deepEqual(errors,[],'Browser runtime errors after context menu / shortcuts')
 console.log(JSON.stringify({passed:true,checks:['2d-right-click-menu','rust-duplicate','meta-z-undo','meta-shift-z-redo','3d-right-click-menu','real-hand-tool','keyboard-cheatsheet','escape-dismissal'],errors},null,2))
}finally{
 if(browser)await browser.close().catch(()=>{})
 for(const child of spawned){try{process.kill(-child.pid,'SIGTERM')}catch{child.kill('SIGTERM')}}
}
