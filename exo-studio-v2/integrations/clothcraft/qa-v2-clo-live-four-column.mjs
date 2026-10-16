// Ground truth: active, accessible CLO 7.0.242 AX toolbar controls with
// observed screen coordinates. EXO UI test is isolated/headless; it never
// opens the user-facing garment project in a browser or changes CLO files.
import assert from 'node:assert/strict'
import {readFileSync,mkdtempSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'
import {CLO7_3D_A,CLO7_3D_B,CLO7_2D_A,CLO7_2D_B} from '../../src/data/clo7ToolbarOrder.js'
import {getClo7NativeCapability} from '../../src/core/clo7NativeToolCapabilities.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const ax=JSON.parse(readFileSync(path.join(os.homedir(),'Library/Application Support/EXO-CLO-Inspector/latest-status.json'),'utf8'))
assert(ax.accessibility && ax.screenRecording && ax.cloWindowCount>0,'EXO CLO Inspector permission or window missing')
const windowOrigin=ax.cloWindows[0]?.frame
assert(windowOrigin&&Number.isFinite(windowOrigin.x)&&Number.isFinite(windowOrigin.y),'CLO app window origin required for relative comparison')
const flattened=[]
function walk(node){flattened.push(node);for(const child of node.children||[])walk(child)}
for(const window of ax.cloWindows)walk(window)
const columns={
 '3D A':{x:232,slots:CLO7_3D_A,selector:'.tool-rail [aria-label="3D editing column A"]'},
 '3D B':{x:268,slots:CLO7_3D_B,selector:'.tool-rail [aria-label="3D garment column B"]'},
 '2D A':{x:1096,slots:CLO7_2D_A,selector:'.clo-right-tool-palette [aria-label="CLO 2D column A"]'},
 '2D B':{x:1132,slots:CLO7_2D_B,selector:'.clo-right-tool-palette [aria-label="CLO 2D column B"]'},
}
for(const [name,{x,slots}] of Object.entries(columns)){
 const actual=flattened.filter(n=>n.frame?.x-windowOrigin.x===x&&n.frame.y-windowOrigin.y>=65&&n.frame.y-windowOrigin.y<1000&&
   ['AXButton','AXCheckBox','AXPopUpButton'].includes(n.role)&&n.name).sort((a,b)=>a.frame.y-b.frame.y)
 assert.equal(actual.length,slots.length,`${name}: live named icon count differs from EXO`)
 for(let i=0;i<slots.length;i++){
  assert.equal(slots[i].label,actual[i].name,`${name} icon ${i+1} actual CLO tooltip differs`)
  assert.equal(slots[i].observedY-slots[0].observedY,
    actual[i].frame.y-actual[0].frame.y,
    `${name} icon ${i+1} relative Y/sequence differs (window frame/titlebar may move)`)
 }
}

// Vite is an ephemeral internal headless QA fixture. The signed V2.app is the
// actual user-visible product; no Chrome window is shown to the user.
const port=5517,origin=`http://127.0.0.1:${port}`
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-live-toolbar-'))
mkdirSync(output,{recursive:true})
const child=spawn(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port',String(port),'--strictPort'],
 {cwd:root,detached:true,stdio:'ignore'})
let browser
try{
 let ready=false
 for(let i=0;i<100;i++){
  try{
   const response=await fetch(origin,{signal:AbortSignal.timeout(1000)})
   if(response.ok&&(await response.text()).includes('/@vite/client')){ready=true;break}
  }catch{}
  if(child.exitCode!==null)throw Error('Vite QA service exited')
  await new Promise(resolve=>setTimeout(resolve,200))
 }
 assert(ready,'Internal QA fixture did not start')
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist']})
 const page=await browser.newPage({viewport:{width:1800,height:1080}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(origin+'/?desktop=1',{waitUntil:'domcontentloaded'})
 const coordinates={}
 for(const [name,{slots,selector}] of Object.entries(columns)){
  const column=page.locator(selector)
  await column.waitFor({timeout:20000})
  const actual=await column.locator('[data-clo-slot]').evaluateAll(nodes=>nodes.map(el=>({id:el.getAttribute('data-clo-slot'),title:el.getAttribute('aria-label'),disabled:el.disabled,implementation:el.getAttribute('data-clo-implementation')})))
  assert.equal(actual.length,slots.length,`${name}: full reference must display every CLO icon by default`)
  for(let i=0;i<slots.length;i++){
    assert.equal(actual[i].title,slots[i].label,`${name} frontend slot ${i+1} does not match live CLO title`)
    const dimension=name.startsWith('3D')?'3d':'2d'
    assert.equal(actual[i].implementation,getClo7NativeCapability(dimension,slots[i].id).mode,`${name} tool status mismatch`)
    assert.equal(actual[i].disabled,false,`${name} tool details must always be accessible`)
  }
  coordinates[name]=await column.evaluate(el=>el.getBoundingClientRect().x)
 }
 assert(coordinates['3D A']<coordinates['3D B']&&coordinates['3D B']<coordinates['2D A']&&coordinates['2D A']<coordinates['2D B'],'Expected physical order: 3D A/B then 2D A/B')
 assert.equal(await page.locator('[data-clo-slot="3d:A01"]').isEnabled(),true)
 assert.equal(await page.locator('[data-clo-slot="3d:B01"]').isEnabled(),true)
 assert.equal(await page.locator('[data-clo-slot="2d:A04"]').isEnabled(),true)
 assert.equal(await page.locator('[data-clo-slot="2d:B06"]').getAttribute('data-clo-implementation'),'unavailable','Seam taping solver must not be advertised as implemented')
 await page.locator('[data-clo-slot="2d:B06"]').click()
 const notice=page.getByRole('region',{name:'Seam Taping tool information'})
 await notice.waitFor()
 assert.match(await notice.innerText(),/Requires additional native implementation/)
 assert.equal(await notice.getByRole('button',{name:'Run Seam Taping'}).count(),0,'Unsupported tool cannot have a fake Run command')
 await page.getByRole('button',{name:'Close tool information'}).click()
 await page.screenshot({path:path.join(output,'exa-verified-full-four-column-toolbars.png')})
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,groundTruth:'live signed CLO 7.0.242 AX titles and Y positions',
  slots:Object.fromEntries(Object.entries(columns).map(([name,v])=>[name,v.slots.length])),
  all70InCorrectPhysicalOrder:true,all70ToolDetailsClickable:true,unsupportedPhysicsIdentified:true,noVisibleBrowserOpened:true,
  screenshot:path.join(output,'exa-verified-full-four-column-toolbars.png'),errors},null,2))
}finally{
 await browser?.close().catch(()=>{})
 try{process.kill(-child.pid,'SIGTERM')}catch{}
}
