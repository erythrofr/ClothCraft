/** Isolated 2D SVG and 3D WebGL rendering smoke test for EXO ClothCraft V2.
 * Creates a disposable Rust session; never opens installed user project data.
 */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-panels-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const installedWeb=process.argv.includes('--installed-web')
const api='http://127.0.0.1:5433',url=installedWeb?'http://127.0.0.1:5386':'http://127.0.0.1:5284'
const children=[]
const start=(binary,args,extra)=>{
  const child=spawn(binary,args,{cwd:root,detached:true,stdio:'ignore',env:{...process.env,...extra}})
  children.push(child)
}
const ready=async target=>{
  for(let i=0;i<120;i++){
    try{if((await fetch(target,{signal:AbortSignal.timeout(1250)})).ok)return}
    catch{}
    if(children.some(child=>child.exitCode!==null))throw Error('Isolated QA process stopped')
    await new Promise(resolve=>setTimeout(resolve,250))
  }
  throw Error(`QA server not ready: ${target}`)
}
let browser
try{
  start(process.execPath,['integrations/clothcraft/server.mjs'],{
    EXO_CLOTHCRAFT_PORT:'5433',EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
    EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
    EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  })
  if(!installedWeb)start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5284','--strictPort'],{
    VITE_CLOTHCRAFT_BRIDGE_URL:api,
  })
  await Promise.all([ready(api+'/health'),ready(url)])
  browser=await chromium.launch({headless:true,
    executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
  const page=await browser.newPage({viewport:{width:1600,height:980}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>{
    window.__v2PanelStatus=null
    window.addEventListener('exo-clothcraft-status',event=>{window.__v2PanelStatus=event.detail})
  })
  // The installed V2 app serves real signed-app web assets from 5386. Redirect
  // only the test browser's workspace traffic to the disposable Rust session;
  // never send mutation, snapshot or pagehide pause to the user's 5385 bridge.
  if(installedWeb)await page.route('http://127.0.0.1:5385/**',async route=>{
    const request=route.request()
    await route.continue({url:request.url().replace('http://127.0.0.1:5385',api)})
  })
  await page.goto(url+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
  await page.locator('.cc-board [data-panel]').first().waitFor({timeout:60000})
  const scene=page.locator('.cc-viewport-3d')
  const board=page.locator('.cc-viewport-2d')
  await scene.locator('canvas').waitFor({timeout:30000})
  await page.waitForTimeout(1400)
  const before=await page.evaluate(()=>{
    const panelElements=[...document.querySelectorAll('.cc-board [data-panel]')]
    const canvas=document.querySelector('.cc-viewport-3d canvas')
    const svg=document.querySelector('.cc-board svg')
    const canvasBox=canvas?.getBoundingClientRect(),svgBox=svg?.getBoundingClientRect()
    return {
      panelCount:panelElements.length,
      paths:panelElements.map(el=>{const box=el.getBBox();return {
        id:el.getAttribute('data-panel'),d:el.getAttribute('d'),
        bbox:{x:box.x,y:box.y,width:box.width,height:box.height},
      }}),
      edgeCount:document.querySelectorAll('.cc-board [data-edge]').length,
      canvas:{width:canvas?.width,height:canvas?.height,clientWidth:canvasBox?.width,clientHeight:canvasBox?.height,
        stageStatus:canvas?.dataset?.stageStatus},
      board:{width:svgBox?.width,height:svgBox?.height,viewBox:svg?.getAttribute('viewBox')},
      nativeStatus:document.querySelector('.cc-embedded-footer')?.textContent,
    }
  })
  assert.ok(before.panelCount>=2,'Native 2D panels did not render')
  assert.ok(before.paths.every(p=>p.d?.startsWith('M')&&p.bbox.width>0&&p.bbox.height>0),
    'Some 2D paths are missing, inverted or collapsed')
  assert.ok(before.edgeCount>0,'No editable 2D panel contours')
  assert.ok(before.canvas.width>=300&&before.canvas.height>=300,'3D WebGL canvas is collapsed')
  assert.ok(before.board.width>250&&before.board.height>250,'2D board is clipped')
  await scene.screenshot({path:path.join(output,'3d-before.png'),animations:'disabled'})
  await board.screenshot({path:path.join(output,'2d-before.png'),animations:'disabled'})
  await page.screenshot({path:path.join(output,'split-before.png'),animations:'disabled'})
  // A 2D selection must remain visible while 3D and 2D viewports are mounted.
  await page.locator('.cc-embedded-bottom').getByRole('button',{name:'Select / edit'}).click()
  await page.locator('[data-clo-slot="2d:A02"]').click()
  await page.locator('.cc-board [data-panel]').first().click({force:true})
  await page.locator('.cc-board [data-control-point="vertex"]').first().waitFor({timeout:12000})
  await page.screenshot({path:path.join(output,'split-selected.png'),animations:'disabled'})
  const after=await page.evaluate(()=>({
    paths:document.querySelectorAll('.cc-board [data-panel]').length,
    canvas:document.querySelector('.cc-viewport-3d canvas')?.getBoundingClientRect().toJSON(),
    board:document.querySelector('.cc-board svg')?.getBoundingClientRect().toJSON(),
    selectionPoints:document.querySelectorAll('.cc-board [data-control-point="vertex"]').length,
  }))
  assert.equal(after.paths,before.panelCount,'2D selection destroyed a panel')
  assert.ok(after.selectionPoints>0,'2D panel vertices are not editable')
  assert.ok(after.canvas.width>250&&after.board.width>250,'Selection collapsed a viewport')
  // Verify 3D picking reaches the shared linked panel selection. Seed the
  // opposite panel, then click visible white front material in the viewport.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('exo-clothcraft-command',{detail:'select:back'})))
  await page.waitForFunction(()=>window.__v2PanelStatus?.selection?.panelId==='back',{timeout:5000})
  const canvasBox=await scene.locator('canvas').boundingBox()
  let pickedFront=false
  for(const [x,y] of [[.15,.42],[.21,.40],[.15,.52],[.20,.47]]){
    await page.mouse.click(canvasBox.x+canvasBox.width*x,canvasBox.y+canvasBox.height*y)
    pickedFront=await page.evaluate(()=>window.__v2PanelStatus?.selection?.panelId==='front')
    if(pickedFront)break
  }
  assert.ok(pickedFront,'Clicking visible 3D front cloth must select linked 2D panel')
  assert.deepEqual(errors,[],'React/WebGL page errors')
  const result={pass:true,source:installedWeb?'installed V2 web bundle plus disposable Rust service':'local Vite plus disposable Rust service',output,before,after,linked3dPick:true,errors}
  writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n')
  console.log(JSON.stringify({pass:true,source:result.source,output,panelCount:before.panelCount,edgeCount:before.edgeCount,canvas:before.canvas,board:before.board,selectionPoints:after.selectionPoints,linked3dPick:true,errors},null,2))
}finally{
  await browser?.close().catch(()=>{})
  for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}
}
