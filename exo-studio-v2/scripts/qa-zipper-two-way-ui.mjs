import assert from 'node:assert/strict'
import {chromium} from '../../music-empire-game/node_modules/playwright-core/index.mjs'

/** Two-way zipper end-to-end acceptance: DOM, persistent draft seam and live Three scene. */
const base=process.env.EXO_QA_URL||'http://127.0.0.1:5188'
const browser=await chromium.launch({headless:true,
  executablePath:process.env.EXO_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist']})
const results=[]
const close=(value,expected,description)=>assert.ok(Math.abs(Number(value)-expected)<.0001,`${description}: ${value} vs ${expected}`)
const scene=page=>page.evaluate(()=>{
  const c=[...document.querySelectorAll('canvas')].find(item=>item.dataset.hardwareZipperGroupCount!=null)
  const d=c?.dataset||{}
  return {groups:Number(d.hardwareZipperGroupCount||0),sliderCount:Number(d.hardwareZipperSliderCount||0),
    teeth:Number(d.hardwareZipperToothInstanceCount||0),engaged:Number(d.hardwareZipperEngagedToothCount||0),
    open:Number(d.hardwareZipperOpenToothCount||0),startExtensionMm:Number(d.hardwareZipperStartExtensionMm||0),
    endExtensionMm:Number(d.hardwareZipperEndExtensionMm||0),
    startOpen:Number((d.hardwareZipperOpenStartFractions||'0').split(',')[0]),
    endOpen:Number((d.hardwareZipperOpenEndFractions||'0').split(',')[0])}
})
const stored=page=>page.evaluate(()=>{
  const p=JSON.parse(localStorage.getItem('garment-studio-project-v1')||'null')
  return {zipper:p?.pieces?.find(piece=>piece.id==='front')?.zippers?.[0]||null,
    seam:p?.seams?.find(seam=>seam.id==='seam-shoulder-l')||null}
})
const waitForSeam=(page,start,end)=>page.waitForFunction(({start,end})=>{
  const p=JSON.parse(localStorage.getItem('garment-studio-project-v1')||'null')
  const seam=p?.seams?.find(item=>item.id==='seam-shoulder-l')
  return seam?.type==='zipper'&&Math.abs(Number(seam.openStartFraction)-start)<.0001&&Math.abs(Number(seam.openEndFraction)-end)<.0001
},{start,end},{timeout:12000})
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900}})
    const errors=[];page.on('pageerror',error=>errors.push(error.message))
    try{
      await page.goto(`${base}/?desktop=1&testSession=zipper-two-way-${width}`,{waitUntil:'domcontentloaded'})
      await page.getByRole('navigation',{name:'Library categories'}).getByRole('button',{name:'Hardware and Trims'}).click()
      await page.getByRole('button',{name:'Zippers folder'}).click()
      const twoWayPreset=page.locator('[data-hardware-preset="two-way-outerwear-zipper"]')
      await twoWayPreset.click()
      assert.ok(await twoWayPreset.locator('img').evaluate(img=>img.complete&&img.naturalWidth>=300),'Dedicated two-way zipper must have a rendered library cover')
      const inspector=page.locator('.clo-property-panel')
      await inspector.getByRole('button',{name:'PLACE ZIPPER ON SELECTED PATTERN'}).click()
      await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>Number(c.dataset.hardwareZipperGroupCount||0)>0))
      const beforePair=await stored(page)
      assert.notEqual(beforePair.seam?.type,'zipper','Placement must not silently convert a normal seam')
      const selection=inspector.getByRole('combobox',{name:'Pair zipper with sewn edge'})
      await selection.selectOption('seam-shoulder-l')
      const twoWay=inspector.getByRole('checkbox',{name:'Two-way Zipper'})
      assert.equal(await twoWay.isChecked(),true,'Dedicated two-way catalog preset must enable both sliders by default')
      const primary=inspector.getByRole('slider',{name:'Drag Zipper Pull'})
      const bottom=inspector.getByRole('slider',{name:'Drag Bottom Zipper Pull'})
      await primary.fill('80')
      await bottom.fill('15')
      await waitForSeam(page,.15,.20)
      await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>Number(c.dataset.hardwareZipperSliderCount||0)>=2))
      let live=await scene(page)
      assert.equal(live.sliderCount,2,'Two independent 3D slider assemblies')
      assert.ok(live.teeth>0&&live.engaged>0&&live.open>0,'Two-way zipper has partially engaged 3D teeth')
      close(live.startOpen,.15,'rendered start opening')
      close(live.endOpen,.20,'rendered end opening')
      await inspector.getByRole('spinbutton',{name:'Start Extension'}).fill('8')
      await inspector.getByRole('spinbutton',{name:'Start Extension'}).press('Tab')
      await inspector.getByRole('spinbutton',{name:'End Extension'}).fill('14')
      await inspector.getByRole('spinbutton',{name:'End Extension'}).press('Tab')
      await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>Number(c.dataset.hardwareZipperStartExtensionMm||0)>=8&&Number(c.dataset.hardwareZipperEndExtensionMm||0)>=14))
      live=await scene(page)
      close(live.startExtensionMm,8,'start extension mm')
      close(live.endExtensionMm,14,'end extension mm')
      const openingDirection=inspector.getByRole('combobox',{name:'Opening Direction'})
      await openingDirection.selectOption('start')
      await waitForSeam(page,.20,.15)
      const flipped=await scene(page)
      close(flipped.startOpen,.20,'start direction rendered opening')
      close(flipped.endOpen,.15,'start direction opposite opening')
      const fasten=inspector.getByRole('checkbox',{name:'Fasten Zipper'})
      await fasten.uncheck()
      await waitForSeam(page,1,0)
      await fasten.check()
      await waitForSeam(page,.20,.15)
      const saved=await stored(page)
      assert.equal(saved.zipper?.twoWay,true)
      close(saved.zipper?.bottomSliderFraction,.15,'saved secondary slider')
      close(saved.zipper?.startExtensionMm,8,'saved start extension')
      close(saved.zipper?.endExtensionMm,14,'saved end extension')
      // Disabling the extra slider must restore the exact legacy single-end
      // seam schema instead of leaving stale two-way physics flags behind.
      await twoWay.uncheck()
      await page.waitForFunction(()=>{
        const p=JSON.parse(localStorage.getItem('garment-studio-project-v1')||'null')
        const seam=p?.seams?.find(item=>item.id==='seam-shoulder-l')
        return seam?.type==='zipper'&&seam.openStartFraction===undefined&&seam.openEndFraction===undefined
          &&Math.abs(seam.openFraction-.2)<.0001
      })
      await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>Number(c.dataset.hardwareZipperSliderCount||0)===1))
      await twoWay.check()
      await waitForSeam(page,.20,.15)
      await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>Number(c.dataset.hardwareZipperSliderCount||0)===2))
      assert.deepEqual(errors,[],'No JavaScript exceptions')
      results.push({width,pass:true,scene:live,flipped,sourceSeam:saved.seam.id,exceptions:errors.length})
    }finally{await page.close()}
  }
  console.log(JSON.stringify({pass:true,results},null,2))
}finally{await browser.close()}
