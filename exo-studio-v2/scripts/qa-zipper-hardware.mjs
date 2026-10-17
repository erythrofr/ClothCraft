import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser=await chromium.launch({headless:true,
  executablePath:process.env.EXO_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist']})
const base=process.env.EXO_QA_URL||'http://127.0.0.1:5188'
const report=[]
const getGeometry=page=>page.evaluate(()=>{
  const canvas=[...document.querySelectorAll('canvas')].find(c=>c.dataset.hardwareZipperGroupCount!==undefined)
  const d=canvas?.dataset||{}
  return {groups:Number(d.hardwareZipperGroupCount||0),tapes:Number(d.hardwareZipperTapeMeshCount||0),
    teeth:Number(d.hardwareZipperToothInstanceCount||0),sliders:Number(d.hardwareZipperSliderCount||0),
    stops:Number(d.hardwareZipperStopCount||0),engaged:Number(d.hardwareZipperEngagedToothCount||0),
    open:Number(d.hardwareZipperOpenToothCount||0),extensionMm:Number(d.hardwareZipperTerminalExtensionMm||0)}
})
try{
  for(const width of [1440,390])for(const native of [false,true]){
    const page=await browser.newPage({viewport:{width,height:900}})
    const errors=[];page.on('pageerror',error=>errors.push(error.message))
    try{
      await page.goto(`${base}/?desktop=1&testSession=zipper-${width}-${native?'native':'draft'}${native?'&engine=clothcraft':''}`,{waitUntil:'domcontentloaded'})
      await page.getByRole('navigation',{name:'Library categories'}).getByRole('button',{name:'Hardware and Trims'}).click()
      const library=page.getByLabel('Hardware and trims library')
      const folder=library.getByRole('button',{name:'Zippers folder'})
      await folder.click()
      const swatch=library.locator('[data-hardware-preset="coil-zipper-5"]')
      await swatch.click()
      const img=swatch.locator('img')
      await img.waitFor({state:'visible'})
      assert.ok(await img.evaluate(el=>el.complete&&el.naturalWidth>100),'Rendered 3D zipper thumbnail must load')
      const inspector=page.locator('.clo-property-panel')
      assert.ok((await inspector.locator('.clo-pe-header').innerText()).includes('Coil zipper size 5'))
      const selectedImg=page.getByLabel('Selected hardware preview').locator('img')
      assert.ok(await selectedImg.evaluate(el=>el.complete&&el.naturalWidth>100),'Object Browser preview must be a rendered asset')
      const place=inspector.getByRole('button',{name:'PLACE ZIPPER ON SELECTED PATTERN'})
      assert.equal(await place.isEnabled(),!native)
      let geometry=null
      if(!native){
        await place.click()
        await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].some(c=>Number(c.dataset.hardwareZipperGroupCount||0)>0),{timeout:12000})
        geometry=await getGeometry(page)
        assert.ok(geometry.groups>0&&geometry.tapes>=1&&geometry.teeth>0&&geometry.sliders>0&&geometry.stops>=2,`Single-edge visual zipper 3D geometry ${JSON.stringify(geometry)}`)
        const slider=inspector.getByRole('slider',{name:'Drag Zipper Pull'})
        await slider.fill('35')
        await page.waitForTimeout(250)
        assert.equal(await slider.inputValue(),'35','Dragging zipper pull must persist')
        const openGeometry=await getGeometry(page)
        assert.ok(openGeometry.open>0,`Partially opened zipper shows separated tooth state: ${JSON.stringify(openGeometry)}`)
        const extension=inspector.getByRole('spinbutton',{name:'End Extension'})
        await extension.fill('12')
        await extension.press('Tab')
        assert.equal(await extension.inputValue(),'12')
        await page.waitForTimeout(250)
        const extendedGeometry=await getGeometry(page)
        assert.ok(extendedGeometry.extensionMm>=10,`Extension changes real geometry: ${JSON.stringify(extendedGeometry)}`)
        // Placing a zipper must never silently convert an existing shirt seam.
        const paired=inspector.getByRole('combobox',{name:'Pair zipper with sewn edge'})
        assert.equal(await paired.inputValue(),'','Normal garment seams must remain unpaired until explicitly chosen')
        if(await paired.locator('option').count()>1){
          const seamId=await paired.locator('option').nth(1).getAttribute('value')
          await paired.selectOption(seamId)
          await page.waitForTimeout(300)
          const linkedGeometry=await getGeometry(page)
          assert.ok(linkedGeometry.tapes>=2&&linkedGeometry.stops>=4,`Pairing sewn edges must produce two tape meshes with stops: ${JSON.stringify(linkedGeometry)}`)
          await slider.fill('25')
          const fastening=inspector.getByRole('checkbox',{name:'Fasten Zipper'})
          const waitForSavedOpenFraction=expected=>page.waitForFunction(({id,value})=>{
            const saved=JSON.parse(localStorage.getItem('garment-studio-project-v1')||'null')
            const seam=saved?.seams?.find(item=>item.id===id)
            return seam?.type==='zipper'&&Math.abs(Number(seam.openFraction)-value)<1e-6
          },{id:seamId,value:expected},{timeout:5000})
          await waitForSavedOpenFraction(.75)
          const stored=()=>page.evaluate(id=>{
            const saved=JSON.parse(localStorage.getItem('garment-studio-project-v1')||'null')
            return saved?.seams?.find(seam=>seam.id===id)||null
          },seamId)
          let savedSeam=await stored()
          assert.equal(savedSeam?.type,'zipper','Explicit pairing changes the draft sewing relationship to zipper')
          assert.ok(Math.abs(savedSeam.openFraction-.75)<1e-6,'Pull position updates saved seam open fraction')
          await fastening.uncheck()
          await waitForSavedOpenFraction(1)
          savedSeam=await stored()
          assert.equal(savedSeam.openFraction,1,'Unfastened zipper opens the paired seam')
          await fastening.check()
          await waitForSavedOpenFraction(.75)
          savedSeam=await stored()
          assert.ok(Math.abs(savedSeam.openFraction-.75)<1e-6,'Fasten restores slider-controlled closure')
        }
        geometry={start:geometry,opened:openGeometry,extended:extendedGeometry}
      }
      assert.deepEqual(errors,[],'No JavaScript page exceptions')
      report.push({width,mode:native?'native':'draft',previewLoaded:true,geometry,exceptions:errors.length})
    }finally{await page.close()}
  }
  console.log(JSON.stringify({pass:true,report},null,2))
}finally{await browser.close()}
