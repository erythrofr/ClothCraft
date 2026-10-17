/** Exercises the actual right Graphic panel against an already running V2 UI. */
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright-core'

const origin=process.env.EXO_QA_URL||'http://127.0.0.1:5386'
const out='docs/qa/screenshots'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try{
  const context=await browser.newContext({viewport:{width:1600,height:940}})
  const page=await context.newPage()
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  const asset=await page.request.get(origin+'/graphic-presets/nike-swoosh.svg')
  assert.equal(asset.status(),200,'Nike Swoosh graphic SVG bundled in installed EXO')
  assert.match(await asset.text(),/<svg\b/,'SVG example is vector source')
  await page.goto(origin+'/?desktop=1&engine=clothcraft&testSession=nike-print',{waitUntil:'domcontentloaded',timeout:90000})
  const board=page.locator('.cc-board [data-panel="front"]').first()
  await board.waitFor({state:'visible',timeout:30000})
  const graphicTab=page.getByRole('tab',{name:'Graphic',exact:true})
  await graphicTab.click()
  const editor=page.locator('#cc-native-graphic-editor .cc-graphic-editor')
  await editor.waitFor({state:'visible',timeout:12000})
  assert.equal(await editor.getByRole('button',{name:'Place example on garment'}).count(),1)
  const viewport=page.locator('.cc-viewport-3d canvas').first()
  await viewport.waitFor({state:'attached',timeout:12000})
  await viewport.screenshot({path:out+'/exo-v2-svg-print-3d-before-20261017.png'})
  const before=Number((await viewport.getAttribute('data-garment-graphic-count'))||0)
  await editor.getByRole('button',{name:'Place example on garment'}).click()
  await page.waitForFunction(minimum=>Number(document.querySelector('.cc-viewport-3d canvas')?.dataset.garmentGraphicCount||0)>minimum,before,{timeout:30000})
  await editor.locator('.cc-graphic-item').last().waitFor()
  assert.match(await editor.locator('.cc-graphic-item').last().innerText(),/Nike Swoosh/)
  const importedPixels=await editor.locator('.cc-graphic-item img').last().evaluate(async img=>{
    await img.decode()
    const canvas=document.createElement('canvas')
    canvas.width=img.naturalWidth
    canvas.height=img.naturalHeight
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    ctx.drawImage(img,0,0)
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data
    let occupied=0
    for(let i=3;i<pixels.length;i+=64)if(pixels[i]>30)occupied++
    return {width:canvas.width,height:canvas.height,occupied}
  })
  assert.ok(importedPixels.occupied>100,'SVG example must actually rasterize visible marks')
  await editor.locator('.cc-graphic-preview').screenshot({path:out+'/exo-v2-svg-print-artwork-placement-20261017.png'})
  const sliders=editor.locator('input[type=range]')
  assert.equal(await sliders.count(),4)
  await sliders.nth(0).fill('0.58')
  await sliders.nth(1).fill('0.58')
  await sliders.nth(2).fill('0.7')
  await sliders.nth(3).fill('10')
  await page.waitForTimeout(1100)
  const values=await sliders.evaluateAll(elements=>elements.map(element=>element.value))
  assert.deepEqual(values,['0.58','0.58','0.7','10'])
  const after=Number(await viewport.getAttribute('data-garment-graphic-count'))
  assert.ok(after>before,'one new graphic projected to native cloth')
  const paintedScreenshot=await viewport.screenshot({path:out+'/exo-v2-svg-print-3d-after-20261017.png'})
  // Assert actual visible pixels on the WebGL garment, not just bookkeeping.
  // Toggle the print off after layout settles and compare equal-sized captures.
  const visibleToggle=editor.getByRole('checkbox',{name:'Visible'})
  await visibleToggle.uncheck()
  await page.waitForFunction(expected=>Number(document.querySelector('.cc-viewport-3d canvas')?.dataset.garmentGraphicCount||0)<expected,after,{timeout:12000})
  await page.waitForTimeout(350)
  const hiddenScreenshot=await viewport.screenshot({path:out+'/exo-v2-svg-print-3d-hidden-20261017.png'})
  const pixelComparison=await page.evaluate(async ({on,off})=>{
    const decode=base64=>new Promise((resolve,reject)=>{
      const image=new Image()
      image.onload=()=>resolve(image)
      image.onerror=()=>reject(new Error('QA capture could not decode'))
      image.src='data:image/png;base64,'+base64
    })
    const [a,b]=await Promise.all([decode(on),decode(off)])
    if(a.width!==b.width||a.height!==b.height)return {sameDimensions:false,differing:0,dimensions:[[a.width,a.height],[b.width,b.height]]}
    const canvas=document.createElement('canvas')
    canvas.width=a.width;canvas.height=a.height
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    ctx.drawImage(a,0,0);const painted=ctx.getImageData(0,0,a.width,a.height).data
    ctx.clearRect(0,0,a.width,a.height);ctx.drawImage(b,0,0)
    const hidden=ctx.getImageData(0,0,a.width,a.height).data
    let differing=0
    for(let y=Math.floor(a.height*.18);y<Math.floor(a.height*.65);y++)for(let x=Math.floor(a.width*.18);x<Math.floor(a.width*.84);x++){
      const i=(y*a.width+x)*4
      if(Math.abs(painted[i]-hidden[i])+Math.abs(painted[i+1]-hidden[i+1])+Math.abs(painted[i+2]-hidden[i+2])>65)differing++
    }
    return {sameDimensions:true,differing}
  },{on:paintedScreenshot.toString('base64'),off:hiddenScreenshot.toString('base64')})
  assert.equal(pixelComparison.sameDimensions,true,'visibility comparison uses equal viewport dimensions')
  assert.ok(pixelComparison.differing>250,'Nike Swoosh print must visibly affect T-shirt pixels: '+JSON.stringify(pixelComparison))
  await visibleToggle.check()
  await page.waitForFunction(expected=>Number(document.querySelector('.cc-viewport-3d canvas')?.dataset.garmentGraphicCount||0)>=expected,after,{timeout:12000})
  await page.screenshot({path:out+'/exo-v2-svg-print-right-panel-20261017.png'})
  await page.reload({waitUntil:'domcontentloaded',timeout:30000})
  await page.locator('.cc-board [data-panel="front"]').first().waitFor({state:'visible',timeout:30000})
  await page.getByRole('tab',{name:'Graphic',exact:true}).click()
  const reloaded=page.locator('#cc-native-graphic-editor .cc-graphic-editor')
  await reloaded.getByRole('button',{name:'Place example on garment'}).waitFor()
  await reloaded.locator('.cc-graphic-item').last().waitFor({timeout:30000})
  assert.deepEqual(await reloaded.locator('input[type=range]').evaluateAll(elements=>elements.map(element=>element.value)),values)
  assert.equal(errors.length,0,errors.join('; '))
  console.log(JSON.stringify({pass:true,origin,before,after,importedPixels,pixelComparison,placement:values,reload:'preserved',errors,screenshots:[out+'/exo-v2-svg-print-3d-after-20261017.png',out+'/exo-v2-svg-print-right-panel-20261017.png']},null,2))
}finally{
  await browser.close()
}
