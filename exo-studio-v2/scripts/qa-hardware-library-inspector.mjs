import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const url=process.env.EXO_QA_URL||'http://127.0.0.1:5188'
const browser=await chromium.launch({headless:true,
  executablePath:process.env.EXO_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist']})
const results=[]
try {
  for(const width of [1440,390])for(const native of [false,true]){
    const page=await browser.newPage({viewport:{width,height:900}})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    try {
      await page.goto(`${url}/?desktop=1&testSession=hardware-${width}-${native?'rust':'draft'}${native?'&engine=clothcraft':''}`)
      await page.getByRole('navigation',{name:'Library categories'}).getByRole('button',{name:'Hardware and Trims'}).click()
      const folders=page.getByLabel('Hardware and trims library')
      assert.equal(await folders.getByRole('button',{name:'Buttons folder'}).getAttribute('aria-expanded'),'true')
      assert.ok(await folders.locator('[data-hardware-preset]').count()>=14,'Buttons folder must list multiple authentic styles')
      await folders.locator('[data-hardware-preset="four-hole-shirt-button"]').click()
      const editor=page.locator('.clo-property-panel')
      assert.ok((await editor.locator('.clo-pe-header').innerText()).includes('Four-hole shirt button'))
      assert.equal(await page.getByRole('tab',{name:'Button',exact:true}).getAttribute('aria-selected'),'true')
      await editor.getByRole('region',{name:'Shape & Specifications properties'}).getByText('Diameter',{exact:true}).waitFor()
      const place=editor.getByRole('button',{name:'PLACE BUTTON ON SELECTED PATTERN'})
      assert.equal(await place.isEnabled(),!native,`${width}: native hardware placement unavailable until Rust support`)
      let added=false
      if(!native){
        await place.click()
        const shape=editor.getByRole('region',{name:'Button Style & Dimensions properties'})
        const optical=editor.getByRole('region',{name:'Material · Basic Parameters & Reflection properties'})
        const widthInput=shape.getByRole('spinbutton',{name:'Width'})
        await widthInput.fill('21')
        await widthInput.press('Tab')
        const roughness=optical.getByRole('spinbutton',{name:'Roughness'})
        await roughness.fill('0.16')
        await roughness.press('Tab')
        assert.equal(await widthInput.inputValue(),'21','Width mm persisted through project edit')
        assert.equal(await roughness.inputValue(),'0.16','Material roughness persisted through project edit')
        added=(await page.locator('.clo-object-row .clo-object-select').filter({hasText:'Four-hole shirt button'}).count())>0
        assert.ok(added,'Placed button appears in Object Browser')
      }
      const bounds=await page.evaluate(()=>{
        const rect=selector=>{
          const el=document.querySelector(selector),r=el.getBoundingClientRect()
          return {left:r.left,right:r.right,contentWidth:el.clientWidth,scrollWidth:el.scrollWidth}
        }
        return {library:rect('.exo-hardware-library'),inspector:rect('.clo-property-panel'),dialogs:document.querySelectorAll('[role=dialog]').length}
      })
      assert.equal(bounds.dialogs,0,'No floating modal overlays')
      assert.equal(bounds.library.contentWidth,bounds.library.scrollWidth,'Hardware folder must not overflow horizontally')
      assert.equal(bounds.inspector.contentWidth,bounds.inspector.scrollWidth,'Inspector must not overflow horizontally')
      assert.deepEqual(errors,[],'No JavaScript runtime exceptions')
      results.push({width,mode:native?'native':'draft',added,...bounds,errorCount:errors.length})
    }finally{await page.close()}
  }
  console.log(JSON.stringify({pass:true,results},null,2))
}finally{await browser.close()}
