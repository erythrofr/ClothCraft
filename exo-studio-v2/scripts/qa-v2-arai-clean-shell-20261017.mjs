// Smoke test the compact V2 chrome and click-to-open ARAI command panel.
// Uses an isolated native session; does not touch the user's open project.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-arai-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const installed=process.argv.includes('--installed-web')
const base='http://127.0.0.1:5496'
const web=installed?'http://127.0.0.1:5386':'http://127.0.0.1:5497'
const processes=[]
const start=(bin,args,env={})=>{
  const child=spawn(bin,args,{cwd:root,detached:true,stdio:'ignore',env:{...process.env,...env}})
  processes.push(child)
}
const ready=async url=>{
  for(let i=0;i<120;i++){
    try{if((await fetch(url,{signal:AbortSignal.timeout(1200)})).ok)return}catch{}
    if(processes.some(p=>p.exitCode!==null))throw Error(`Test service stopped before ${url}`)
    await new Promise(resolve=>setTimeout(resolve,250))
  }
  throw Error(`Test service unavailable: ${url}`)
}
let browser
try{
  start(process.execPath,['integrations/clothcraft/server.mjs'],{
    EXO_CLOTHCRAFT_PORT:'5496',EXO_CLOTHCRAFT_OUTPUT_DIR:output,
    EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
    EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
    EXO_CLOTHCRAFT_GPU:'0',
  })
  if(!installed)start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5497','--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:base})
  await Promise.all([ready(base+'/health'),ready(web)])
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
  const page=await browser.newPage({viewport:{width:1650,height:990}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  if(installed)await page.route('http://127.0.0.1:5385/**',route=>route.continue({url:route.request().url().replace('http://127.0.0.1:5385',base)}))
  else await page.route(base+'/workspace',async route=>{
    const headers={...route.request().headers()}
    delete headers.origin
    const response=await route.fetch({headers})
    await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':web}})
  })
  await page.goto(web+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
  // This is a chrome/assistant test; solver initialization is independent
  // and can take longer than the user interface on machines with GPU load.
  await page.locator('.clo-mac-menu').waitFor({timeout:15000})
  await page.locator('.cc-board [data-panel]').first().waitFor({timeout:30000})
  assert.equal(await page.locator('.project-strip').count(),0,'Old permanent project/AI toolbar still exists')
  assert.equal(await page.locator('.clo-inspector-topline').count(),0,'Redundant Objects & Properties strip still exists')
  const button=page.getByRole('button',{name:'Open ARAI assistant chat'})
  assert.equal(await button.count(),1,'ARAI button missing from primary menu')
  assert.equal(await page.getByRole('dialog',{name:'ARAI garment assistant'}).count(),0,'ARAI should start closed')
  await button.click()
  const chat=page.getByRole('dialog',{name:'ARAI garment assistant'})
  await chat.waitFor()
  await chat.getByRole('textbox',{name:'EXO tool assistant'}).fill('show fabrics')
  await chat.getByRole('button',{name:'SEND'}).click()
  await page.getByText('Opened the Fabric library.',{exact:true}).first().waitFor({timeout:10000})
  assert.equal(await button.getAttribute('aria-expanded'),'true')
  await chat.getByRole('button',{name:'Close ARAI chat'}).click()
  assert.equal(await chat.count(),0,'Closing ARAI must remove the chat')
  assert.equal(await button.getAttribute('aria-expanded'),'false')
  assert.equal(await page.locator('.clo-tool-palette-label').count(),0,'Redundant TOOLS/ALL heading remains')
  assert.equal(await page.locator('.tool-rail .clo-reference-mode-toggle').count(),0,'Unfinished ALL 38 switch remains in 3D toolbar')
  // The reference tool map retains original CLO positions for discoverability.
  // Unsupported commands must be distinctly disabled and described, with no
  // misleading click handler or fallback question-mark icon.
  const toolbar=await page.locator('.tool-rail [data-clo-slot],.clo-right-tool-palette [data-clo-slot]')
    .evaluateAll(els=>els.map(el=>({slot:el.dataset.cloSlot,implementation:el.dataset.cloImplementation,
      disabled:el.disabled,ariaDisabled:el.getAttribute('aria-disabled'),label:el.getAttribute('aria-label'),
      title:el.getAttribute('title'),operational:el.dataset.cloOperational})))
  const disabledSlots=toolbar.filter(tool=>tool.disabled)
  assert(disabledSlots.length>0,'Expected pending reference tools to remain safely disabled')
  assert(disabledSlots.every(tool=>tool.implementation==='unavailable'&&tool.label&&!tool.label.includes('?')),
    `Disabled slots lack capability labels: ${JSON.stringify(disabledSlots.filter(tool=>tool.implementation!=='unavailable'||!tool.label))}`)
  assert(!toolbar.some(tool=>tool.implementation==='unavailable'&&!tool.disabled),
    'An unavailable native reference tool is mistakenly clickable')
  const fabricItem=page.locator('.asset-browser [data-library-hover-id^="Fabric:"]').first()
  await fabricItem.waitFor({timeout:12000})
  await fabricItem.hover()
  const fabricPreview=page.locator('.exo-library-asset-hover--fabric .exo-fabric-hover-dual')
  await fabricPreview.waitFor({state:'visible',timeout:8000})
  const square=await fabricPreview.locator('.exo-fabric-hover-flat').boundingBox()
  assert(square && square.width>=240 && Math.abs(square.width-square.height)<3,
    `Fabric macro swatch must be a large square: ${JSON.stringify(square)}`)
  assert.equal(await fabricPreview.locator('.exo-fabric-hover-drape canvas').count(),1,'Fabric ball canvas missing')
  await page.screenshot({path:path.join(output,'fabric-square-ball-hover.png'),animations:'disabled'})
  assert.deepEqual(errors,[],'Browser threw during the ARAI command flow')
  console.log(JSON.stringify({pass:true,installed,output,oldStripRemoved:true,inspectorToplineRemoved:true,toolsHeaderRemoved:true,unavailableToolbarSlotsDisabled:disabledSlots.length,araiClickOpenClose:true,assistantCommandVerified:true,fabricSquare:{width:square.width,height:square.height},errors},null,2))
}finally{
  await browser?.close().catch(()=>{})
  for(const p of processes)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
