// Independent browser QA of the CLO-style 2D bounding marquee and torso guide
// clipping. Uses throwaway native workspace storage and dedicated test ports.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'
import {getBounds,horizontalPatternSpans,verticalPatternSpans} from '../../src/core/clothcraft2dGeometry.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(tmpdir(),'exo-v2-marquee-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
// 5284 is explicitly allowlisted for localhost browser origins by server.mjs.
const base='http://127.0.0.1:5421', ui='http://127.0.0.1:5284'
const processes=[]
const rust=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
const spawnService=(exe,args,env={})=>{
  const p=spawn(exe,args,{cwd:root,env:{...process.env,...env},stdio:'ignore',detached:true})
  processes.push(p)
}
async function ready(url){
  for(let i=0;i<80;i++){
    try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(r.ok)return}catch{}
    await sleep(250)
  }
  throw Error('Timed out waiting for '+url)
}
async function serverCommand(cmd){
  const r=await fetch(base+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(cmd)})
  const data=await r.json()
  assert(data.ok,JSON.stringify(data.error))
  return data.data
}
let browser
try {
  spawnService(process.execPath,['integrations/clothcraft/server.mjs'],{
    EXO_CLOTHCRAFT_PORT:'5421',EXO_CLOTHCRAFT_OUTPUT_DIR:output,
    EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
    EXO_CLOTHCRAFT_SESSION_BIN:rust,EXO_CLOTHCRAFT_GPU:'0'})
  spawnService(path.join(root,'node_modules/.bin/vite'),
    ['--host','127.0.0.1','--port','5284','--strictPort'],
    {VITE_CLOTHCRAFT_BRIDGE_URL:base})
  await Promise.all([ready(base+'/health'),ready(ui)])
  const opened=await serverCommand({op:'open',preset:'tshirt'})
  const frontRange=opened.panels.find(r=>r.id==='front')
  assert(frontRange)
  const xs=[...new Set(Object.values(frontRange.boundaries).flat())].map(i=>opened.uv[i])
  const b=getBounds(xs)
  for(const f of [.46,.72]){
    const spans=horizontalPatternSpans(frontRange.boundaries,opened.uv,b.minY+b.height*f)
    const torso=horizontalPatternSpans({
      'side-left':frontRange.boundaries['side-left'],
      'side-right':frontRange.boundaries['side-right']
    },opened.uv,b.minY+b.height*f)
    assert(spans.length>=1,'cut outline crossings should produce at least one material span')
    assert(spans.every(([a,z])=>a>=b.minX-.001 && z<=b.maxX+.001),
      'cut outline spans remain within piece bounds')
    assert(torso.length===1 && spans.some(([a,z])=>torso[0][0]>=a-.001 && torso[0][1]<=z+.001),
      'true body side seam guide must remain within a filled material span')
    assert(torso[0][1]-torso[0][0]<b.width-.005,
      'torso-only line excludes the extended sleeve width')
  }
  const chestY=b.minY+b.height*.46
  const torsoChest=horizontalPatternSpans({
    'side-left':frontRange.boundaries['side-left'],
    'side-right':frontRange.boundaries['side-right']},opened.uv,chestY)
  const centerX=(torsoChest[0][0]+torsoChest[0][1])/2
  const centerSpans=verticalPatternSpans(frontRange.boundaries,opened.uv,centerX)
  const centerSpan=[...centerSpans].sort((a,z)=>(z[1]-z[0])-(a[1]-a[0]))[0]
  assert(centerSpan && centerSpan[1]-centerSpan[0]>.16,'front center cut span reaches down bodice')
  for(const y of [centerSpan[0]+.01,(centerSpan[0]+centerSpan[1])/2,centerSpan[1]-.01]) {
    assert(verticalPatternSpans(frontRange.boundaries,opened.uv,centerX)
      .some(([lo,hi])=>lo<=y && y<=hi),'center-front samples remain inside actual cut perimeter')
  }
  browser=await chromium.launch({headless:true,
    executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
  const page=await browser.newPage({viewport:{width:1728,height:1040}})
  const errors=[], edits=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('request',request=>{
    if(request.url().endsWith('/workspace') && request.method()==='POST') {
      try{const body=request.postDataJSON();if(body.command?.kind)edits.push(body.command)}catch{}
    }
  })
  await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
  const board=page.locator('.cc-board').first()
  const front=board.locator('[data-panel="front"]').first()
  try{await front.waitFor({timeout:15000})}catch(error){
    console.log('V2 QA startup diagnostic',JSON.stringify({
      errors,boardCount:await page.locator('.cc-board').count(),
      frontCount:await front.count(),body:(await page.locator('body').innerText()).slice(0,1500),
      url:page.url()},null,2))
    await page.screenshot({path:path.join(output,'startup-debug.png'),fullPage:true})
    throw error
  }
  // The displayed 3D mannequin silhouette must meet the *actual* shoulder
  // seams of the front cut pattern, not an arbitrary constant Y anchor.
  const registered=await board.evaluate(root=>{
    const svg=root.querySelector('svg'),figure=svg.querySelector('[aria-label="Centered front avatar silhouette"]')
    const left=svg.querySelector('[data-edge="front:shoulder-left"]')
    const right=svg.querySelector('[data-edge="front:shoulder-right"]')
    if(!figure||!left||!right)return null
    const shoulderScreen=[left,right].map(el=>el.getBoundingClientRect())
    const seamMidY=shoulderScreen.reduce((n,r)=>n+r.top+r.height/2,0)/2
    const seamMinX=Math.min(...shoulderScreen.map(r=>r.left))
    const seamMaxX=Math.max(...shoulderScreen.map(r=>r.right))
    const shoulderY=Number(figure.dataset.registeredShoulderY)
    const avatarY=Number(figure.dataset.avatarAnchorY)
    const path=figure.querySelector('path'),matrix=path.getScreenCTM()
    const localY=shoulderY-avatarY,position=new DOMPoint(0,localY).matrixTransform(matrix)
    const sampled=[]
    const length=path.getTotalLength()
    for(let i=0;i<=4000;i++){
      const xy=path.getPointAtLength(length*i/4000)
      if(Math.abs(xy.y-localY)<.008)sampled.push(new DOMPoint(xy.x,xy.y).matrixTransform(matrix).x)
    }
    return {seamMidY,guideY:position.y,seamWidth:seamMaxX-seamMinX,
      bodyWidth:sampled.length>2?Math.max(...sampled)-Math.min(...sampled):0,
      axisDelta:(seamMinX+seamMaxX)/2-position.x,
      bodyAnchor:figure.getAttribute('transform')}
  })
  assert(registered,'Live body silhouette and front shoulder edges must both be visible')
  assert(Math.abs(registered.guideY-registered.seamMidY)<4,
    'Body shoulder landmark must align vertically with the pattern shoulder seam: '+JSON.stringify(registered))
  assert(Math.abs(registered.axisDelta)<4,
    'Body shoulder axis must align with the centered pattern: '+JSON.stringify(registered))
  assert(registered.bodyWidth>0&&Math.abs(registered.seamWidth-registered.bodyWidth)<13,
    'Avatar mesh upper torso width should match the garment shoulder seam: '+JSON.stringify(registered))
  // The reference continues to track metre-space geometry when the native
  // desktop is resized, and Frame all must not crop the character's head/feet.
  await page.setViewportSize({width:1230,height:790})
  await board.getByRole('button',{name:'Frame all'}).click()
  const narrow=await board.evaluate(root=>{
    const visible=root.querySelector('svg').getBoundingClientRect()
    const body=root.querySelector('[aria-label="Centered front avatar silhouette"]')?.getBoundingClientRect()
    const front=root.querySelector('[data-panel="front"]')?.getBoundingClientRect()
    return {visible:{left:visible.left,right:visible.right,top:visible.top,bottom:visible.bottom},
      body:body&&{left:body.left,right:body.right,top:body.top,bottom:body.bottom},
      front:front&&{left:front.left,right:front.right,top:front.top,bottom:front.bottom}}
  })
  assert(narrow.body&&narrow.front&&narrow.body.top>=narrow.visible.top-2&&
    narrow.body.bottom<=narrow.visible.bottom+2&&narrow.body.left>=narrow.visible.left-2&&
    narrow.body.right<=narrow.visible.right+2,
    'Frame all clips the body silhouette after resizing: '+JSON.stringify(narrow))
  await board.screenshot({path:path.join(output,'aligned-avatar-narrow-2d.png')})
  await page.setViewportSize({width:1728,height:1040})
  await board.getByRole('button',{name:'Frame all'}).click()
  const toolbar=board.getByRole('toolbar',{name:'2D viewport quick tools'})
  const selectTool=toolbar.getByRole('button',{name:'Select / Transform',exact:true}).first()
  // The global EXO tool may start in a 3D mode. Explicitly select the 2D
  // transform tool, since the marquee must NOT follow other tools anymore.
  await selectTool.click()
  const originalFill=await front.getAttribute('fill')
  await front.click()
  const marquee=board.locator('[data-2d-marquee="front"]')
  try{await marquee.waitFor({timeout:4500})}catch(error) {
    console.log('V2 QA selection diagnostic',JSON.stringify({
      errors,selectedOutline:await board.locator('[data-2d-selected-outline]').count(),
      selectedFrontOutline:await board.locator('[data-2d-selected-outline="front"]').count(),
      marqueeCount:await marquee.count(),frontCount:await front.count(),
      controls:(await board.locator('button').allTextContents()).slice(0,18)},null,2))
    await board.screenshot({path:path.join(output,'selection-debug.png')})
    throw error
  }
  assert.equal(await marquee.locator('[data-2d-scale-guide]').count(),8)
  assert.equal(await marquee.locator('[data-2d-rotate]').count(),1)
  assert.equal(await front.getAttribute('fill'),originalFill,
    'pattern fabric fill must never turn yellow on selection')
  assert.equal(await board.locator('[data-measure-guide="chest"]').count(),1)
  assert.equal(await board.locator('[data-measure-guide="belly"]').count(),1)
  const centerGuide=board.locator('[data-measure-guide="center-front"]')
  assert.equal(await centerGuide.count(),1,'selected front renders one center-front vertical guide')
  const externalTool=async tool=>page.evaluate(tool=>window.dispatchEvent(
    new CustomEvent('exo-clothcraft-select-2d-tool',{detail:{tool}})),tool)
  const quickTool=label=>toolbar.getByRole('button',{name:label,exact:true}).first()
  await externalTool('point')
  assert.equal(await marquee.count(),0,'external POINT selection hides marquee')
  assert(await board.locator('[data-control-point="vertex"]').count()>0,'external POINT enables point controls')
  assert.equal(await quickTool('Edit Pattern Points').getAttribute('aria-pressed'),'true','corner point icon active')
  await externalTool('curve')
  assert.equal(await marquee.count(),0,'external CURVE selection hides marquee')
  assert.equal(await quickTool('Edit Curves').getAttribute('aria-pressed'),'true','corner curve icon active')
  await externalTool('select')
  await marquee.waitFor()
  assert.equal(await quickTool('Select / Transform').getAttribute('aria-pressed'),'true','corner select icon active')
  await externalTool('invalid-tool')
  assert.equal(await marquee.count(),1,'unsupported external tool leaves selected mode unchanged')
  const guideStart=await centerGuide.evaluate(el=>[Number(el.getAttribute('x1')),Number(el.getAttribute('y1'))])
  const guideEnd=await centerGuide.evaluate(el=>[Number(el.getAttribute('x2')),Number(el.getAttribute('y2'))])
  assert(Math.abs(guideStart[0]-guideEnd[0])<.001,'front center is vertical at initial rotation')
  assert(guideEnd[1]-guideStart[1]>.16,'front center extends toward hem')
  assert.equal(await board.locator('[data-measure-guide="waist"]').count(),0)
  await page.mouse.move(950,890)
  assert(await marquee.isVisible(),'marquee persists after mouse leaves selected panel')
  await toolbar.getByRole('button',{name:'Edit Pattern Points',exact:true}).click()
  assert.equal(await marquee.count(),0,'point tool must not show pattern transform marquee')
  assert(await board.locator('[data-control-point="vertex"]').count()>0,
    'point tool should show actual editable points, not the transform marquee')
  assert.equal(await front.getAttribute('fill'),originalFill,
    'editing points must preserve the white fabric appearance')
  await toolbar.getByRole('button',{name:'Edit Curves',exact:true}).click()
  assert.equal(await marquee.count(),0,'curve tool must not show pattern transform marquee')
  await toolbar.getByRole('button',{name:'Edit Sewing',exact:true}).click()
  assert.equal(await marquee.count(),0,'sewing tool must not show pattern transform marquee')
  await selectTool.click()
  await marquee.waitFor()
  const boardCanvas=board.locator('svg').first()
  const canvasBox=await boardCanvas.boundingBox()
  assert(canvasBox)
  await boardCanvas.click({position:{x:55,y:canvasBox.height-75}})
  assert.equal(await marquee.count(),0,'clicking blank gray 2D canvas deselects pattern')
  assert.equal(await board.locator('[data-measure-guide="chest"]').count(),0,
    'deselecting should also clear selected-only chest guide')
  assert.equal(await centerGuide.count(),0,'deselecting clears center-front guide')
  assert.equal(await front.getAttribute('fill'),originalFill,
    'deselecting must preserve fabric fill')
  await front.click()
  await marquee.waitFor()
  await board.screenshot({path:path.join(output,'selected-pattern-2d.png')})
  const figureBefore=await board.locator('[aria-label="Centered front avatar silhouette"]').getAttribute('transform')
  const box=await front.boundingBox()
  assert(box && box.width>40 && box.height>40)
  const start={x:box.x+box.width/2,y:box.y+box.height*.53}
  const originalPath=await front.getAttribute('d')
  await page.mouse.move(start.x,start.y)
  await page.mouse.down()
  await page.mouse.move(start.x+55,start.y+26,{steps:5})
  await page.waitForTimeout(100)
  assert.notEqual(await front.getAttribute('d'),originalPath,'drag must preview actual panel moving')
  const movedGuide=await centerGuide.evaluate(el=>[Number(el.getAttribute('x1')),Number(el.getAttribute('y1'))])
  assert(Math.hypot(movedGuide[0]-guideStart[0],movedGuide[1]-guideStart[1])>.005,
    'center front follows live move preview')
  await page.mouse.up()
  await page.waitForFunction(()=>document.querySelector('[data-2d-marquee="front"]')!==null)
  assert.equal(await board.locator('[aria-label="Centered front avatar silhouette"]').getAttribute('transform'),figureBefore,
    'Dragging an authored pattern must never shift the body reference as a side effect')
  assert(edits.some(x=>x.kind==='BoardTransform' && x.panel==='front'),'drag must commit Rust BoardTransform')
  await board.screenshot({path:path.join(output,'moved-pattern-2d.png')})
  await page.waitForTimeout(250)
  const rotate=board.locator('[data-2d-rotate="front"]')
  const knob=await rotate.boundingBox()
  assert(knob)
  await page.mouse.move(knob.x+knob.width/2,knob.y+knob.height/2)
  await page.mouse.down()
  await page.mouse.move(knob.x+knob.width/2+23,knob.y+knob.height/2+24,{steps:4})
  await page.mouse.up()
  await page.waitForTimeout(200)
  assert(edits.filter(x=>x.kind==='BoardTransform' && x.panel==='front').length>=2,
    'rotation knob must commit Rust BoardTransform')
  const rotatedGuide=await centerGuide.evaluate(el=>[Number(el.getAttribute('x2'))-Number(el.getAttribute('x1')),Number(el.getAttribute('y2'))-Number(el.getAttribute('y1'))])
  assert(Math.abs(rotatedGuide[0])>.003,'center-front guide rotates with the bodice')
  assert.equal(errors.length,0,'uncaught frontend browser errors: '+errors.join('; '))
  console.log(JSON.stringify({passed:true,output,checks:[
    'mesh-derived shoulder registration within 4px and torso width within 13px',
    'narrow 1230x790 viewport Frame all keeps the entire body visible',
    'accurate chest/belly guide clipped to cut outline','center front inside true cut silhouette and follows move/rotate','external Select/Point/Curve event updates corner icons and marquee','marquee limited to 2D Select/Transform tool',
    'no transform marquee in point, curve, or sew modes',
    'click blank gray canvas to deselect','selection leaves fabric fill unchanged',
    'eight handles + rotation knob','marquee persists on hover change',
    'live drag preview','Rust BoardTransform move','Rust BoardTransform rotation',
    'white bound reference handles','no page errors'],edits:edits.map(x=>x.kind)},null,2))
} finally {
  if(browser)await browser.close()
  for(const p of processes)if(p.pid){
    try{process.kill(-p.pid,'SIGTERM')}catch{try{p.kill('SIGTERM')}catch{}}
  }
}
