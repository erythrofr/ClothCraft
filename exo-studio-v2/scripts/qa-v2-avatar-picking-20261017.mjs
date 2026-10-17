/** Disposable Rust avatar selection QA against the installed signed V2 web UI. */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-avatar-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const api='http://127.0.0.1:5437', ui='http://127.0.0.1:5386'
const thomas=path.join(homedir(),'Applications/EXO ClothCraft Studio V2.app/Contents/Resources/collision-avatars/thomas-body.obj')
const child=spawn(process.execPath,['integrations/clothcraft/server.mjs'],{
  cwd:root,detached:true,stdio:'ignore',env:{...process.env,
    EXO_CLOTHCRAFT_PORT:'5437',EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
    EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
    EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
    EXO_CLOTHCRAFT_AVATAR_THOMAS_OBJ:thomas,
  },
})
const ready=async url=>{
  for(let i=0;i<80;i++){
    try{if((await fetch(url,{signal:AbortSignal.timeout(900)})).ok)return}
    catch{}
    if(child.exitCode!==null)throw Error('Disposable Rust service exited')
    await new Promise(resolve=>setTimeout(resolve,250))
  }
  throw Error('Timed out waiting for '+url)
}
let browser
try {
  await Promise.all([ready(api+'/health'),ready(ui)])
  browser=await chromium.launch({headless:true,
    executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
  const page=await browser.newPage({viewport:{width:1620,height:1040}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  // Only this disposable browser sends mutations to disposable Rust, even
  // though the signed UI assets are served by the user's installed V2 app.
  await page.route('http://127.0.0.1:5385/**',route=>
    route.continue({url:route.request().url().replace('127.0.0.1:5385','127.0.0.1:5437')}))
  await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
  await page.locator('.cc-board [data-panel]').first().waitFor({timeout:45000})
  await page.locator('.cc-scene canvas').waitFor({timeout:12000})
  await page.evaluate(()=>{
    window.__nativeAvatarPicks=[]
    window.addEventListener('exo-clothcraft-native-pick',event=>window.__nativeAvatarPicks.push(event.detail))
  })
  await page.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.avatarVisible==='true')
  const before=await page.locator('.cc-studio-avatar').getAttribute('data-source-vertices')
  assert.equal(Number(before),13380,'Initial 2D avatar is not real MakeHuman geometry')

  // The silhouette itself must dispatch avatar selection, rather than treating
  // every click as selecting the front fabric panel underneath it.
  const silhouette=page.locator('.cc-board [data-2d-avatar-hit]').first()
  await silhouette.waitFor({timeout:18000})
  const visibleBodyPoint=await page.evaluate(()=>{
    const path=document.querySelector('.cc-board [data-2d-avatar-hit]')
    const box=path.getBoundingClientRect()
    // Find an exposed painted pixel in the lower body. The garment can
    // legitimately cover the chest of the underlying mannequin silhouette.
    for(let y=box.bottom-3;y>box.top+box.height*.6;y-=3)
      for(let x=box.left+2;x<box.right-2;x+=3)
        if(document.elementFromPoint(x,y)===path)return {x,y}
    return null
  })
  assert(visibleBodyPoint,'2D avatar has no visible selectable pixel behind garment panels')
  await page.mouse.click(visibleBodyPoint.x,visibleBodyPoint.y)
  assert.equal(await page.evaluate(()=>window.__nativeAvatarPicks.at(-1)?.avatar),true,'2D avatar click does not reach native selection')

  await page.getByRole('button',{name:'Browse avatars'}).click()
  const thomasTile=page.locator('.asset-template.garment-tile').filter({hasText:'CLO Thomas'}).first()
  await thomasTile.waitFor({timeout:10000})
  await thomasTile.click()
  await page.waitForFunction(()=>Number(document.querySelector('.cc-studio-avatar')?.dataset.sourceVertices)===37299,null,{timeout:30000})
  const response=await fetch(api+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot',avatar:true})})
  const result=await response.json()
  assert(result.ok,'Disposable native session did not survive Thomas selection')
  assert.equal(result.data.avatarModel,'clo-thomas')
  assert.equal(result.data.avatar.positions.length,37299)
  assert.equal(result.data.template.panels.length,2,'Native avatar switch lost garment panels')
  assert.equal(await page.locator('.cc-scene canvas').getAttribute('data-avatar-visible'),'true')
  const canvasBox=await page.locator('.cc-scene canvas').boundingBox()
  // With the default front perspective, this is the exposed forehead above
  // the off-body garment; a real mouse click must select the closer avatar.
  await page.mouse.click(canvasBox.x+canvasBox.width*.5,canvasBox.y+canvasBox.height*.18)
  assert.equal(await page.evaluate(()=>window.__nativeAvatarPicks.at(-1)?.avatar),true,
    '3D rendered avatar click does not reach native selection')
  assert.deepEqual(errors,[],'React or WebGL page errors')
  await page.locator('.cc-viewport-3d').screenshot({path:path.join(output,'3d-thomas.png'),animations:'disabled'})
  await page.locator('.cc-viewport-2d').screenshot({path:path.join(output,'2d-thomas.png'),animations:'disabled'})
  const report={pass:true,output,panels:result.data.template.panels.map(p=>p.id),
    beforeAvatarVertices:Number(before),afterAvatarVertices:result.data.avatar.positions.length,
    rendered3dAvatar:true,click2dAvatar:true,click3dAvatar:true,errors}
  writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
} finally {
  await browser?.close().catch(()=>{})
  try{process.kill(-child.pid,'SIGTERM')}catch{}
}
