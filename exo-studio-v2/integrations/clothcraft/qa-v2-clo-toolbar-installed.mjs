// Read-only smoke against assets served by the *installed, signed native .app*.
// Chrome headless is a test client; it never opens a user-facing browser window.
// Do not select or edit the user's persistent native garment.
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {CLO7_NATIVE_TOOL_CAPABILITIES as inventory} from '../../src/core/clo7NativeToolCapabilities.js'
const native='http://127.0.0.1:5385',ui='http://127.0.0.1:5386'
const health=await (await fetch(native+'/health',{signal:AbortSignal.timeout(3000)})).json()
assert(health.nativeReady,'Native signed app Rust bridge is not ready')
const browser=await chromium.launch({headless:true,
 executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const page=await browser.newPage({viewport:{width:1740,height:1040}}),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await page.locator('[data-clo-slot="3d:A01"]').waitFor({timeout:30000})
 const tools=await page.locator('[data-clo-slot]').evaluateAll(nodes=>nodes.map(node=>({
  id:node.getAttribute('data-clo-slot'),name:node.getAttribute('aria-label'),
  mode:node.getAttribute('data-clo-implementation'),clickable:!node.disabled,
  title:node.getAttribute('title')
 })))
 assert.equal(tools.length,70)
 assert.deepEqual(tools.map(t=>t.id),inventory.map(t=>t.id))
 assert.deepEqual(tools.map(t=>t.name),inventory.map(t=>t.label))
 for(let i=0;i<tools.length;i++){
  assert.equal(tools[i].mode,inventory[i].mode)
  assert(tools[i].clickable,'All reference icons should open a real tool or honest information panel')
  assert(!/\?\?|undefined|null/i.test(tools[i].title),'Tool has broken tooltip: '+tools[i].id)
 }
 // Non-mutating click on one missing physics tool proves informative,
 // dismissible panel rather than inert question-mark or fake active mode.
 await page.locator('[data-clo-slot="2d:B06"]').click()
 const detail=page.getByRole('region',{name:'Seam Taping tool information'})
 await detail.waitFor()
 assert.match(await detail.innerText(),/Requires additional native implementation/)
 assert.equal(await detail.getByRole('button',{name:'Run Seam Taping'}).count(),0)
 await detail.getByRole('button',{name:'Close tool information'}).click()
 assert.equal(await detail.count(),0)
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,nativeApp:true,metadataSlots:70,
  counts:Object.fromEntries(['native','inspect','unavailable'].map(mode=>[mode,tools.filter(t=>t.mode===mode).length])),
  tooltipsReadable:true,unavailableToolsInformative:true,noNativeGarmentEdits:true,errors},null,2))
}finally{await browser.close()}
