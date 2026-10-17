import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright-core'

const base=process.env.EXO_QA_URL||'http://127.0.0.1:5199'
const out='screenshots/qa-fabric-ball-orbit-20261017'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,
 executablePath:process.env.EXO_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try {
 const results=[]
 for(const [device,width,height] of [['desktop',1440,900],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:device==='mobile',hasTouch:device==='mobile'})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base+'/?desktop=1&testSession=fabric-orbit-20261017',{waitUntil:'domcontentloaded'})
  await page.getByRole('button',{name:'Browse fabrics'}).click()
  await page.getByRole('textbox',{name:'Search library'}).fill('Rigid Denim')
  const row=page.locator('.exo-fabric-entry-main[data-fabric-preset="denim"]')
  await row.waitFor({state:'visible'})
  await row.hover()
  const preview=page.locator('[data-library-preview="Fabric:denim"]')
  await preview.waitFor({state:'visible',timeout:10000})
  const canvas=preview.locator('canvas[data-fabric-ball]')
  await canvas.waitFor({state:'visible'})
  assert.equal(await canvas.getAttribute('data-preview-shared-orbit'),'true')
  assert.equal(await canvas.getAttribute('data-preview-ground-shadow'),'soft-gradient')
  await preview.screenshot({path:`${out}/${device}-before.png`})
  const rect=await canvas.boundingBox()
  assert.ok(rect&&rect.width>80&&rect.height>80,'Interactive preview should occupy visible space')
  const x=rect.x+rect.width*.5,y=rect.y+rect.height*.55
  await page.mouse.move(x,y)
  await page.mouse.down()
  await page.mouse.move(x+34,y+11,{steps:6})
  await page.mouse.up()
  const orbit=await canvas.getAttribute('data-preview-orbit')
  assert.ok(orbit&&Math.abs(Number(orbit.split(',')[0])+.32)>.05,`Orbit should change: ${orbit}`)
  await preview.screenshot({path:`${out}/${device}-orbited.png`})
  await canvas.focus()
  await page.keyboard.press('r')
  assert.equal(await canvas.getAttribute('data-preview-orbit'),'-0.3200,0.0000')
  assert.deepEqual(errors,[])
  results.push({device,canvasWidth:Math.round(rect.width),canvasHeight:Math.round(rect.height),orbit,errors:errors.length})
  await page.close()
 }
 console.log(JSON.stringify({pass:true,results,screenshots:out}))
}finally{await browser.close()}
