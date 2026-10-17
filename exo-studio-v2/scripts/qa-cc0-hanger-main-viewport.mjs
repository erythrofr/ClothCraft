import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'

const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.EXO_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist'],
})
const base=process.env.EXO_QA_URL||'http://127.0.0.1:5197'
const results=[]
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900}})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    try{
      await page.goto(`${base}/?desktop=1&testSession=cc0-hanger-scene-${width}`,{waitUntil:'domcontentloaded'})
      await page.getByRole('navigation',{name:'Library categories'}).getByRole('button',{name:'Hanger',exact:true}).click()
      for(const preset of ['wood','trouser-clip']){
        const tile=page.locator(`[data-library-hover-id="Hanger:${preset}"]`)
        await tile.waitFor({state:'visible'})
        await tile.scrollIntoViewIfNeeded()
        const tileImage=tile.locator('img')
        assert.ok(await tileImage.evaluate(img=>img.complete&&img.naturalWidth>=200),`${preset} real Blender tile missing`)
        await tile.click()
        await page.waitForFunction(id=>[...document.querySelectorAll('canvas')].some(canvas=>
          canvas.dataset.hangerPreset===id && canvas.dataset.hangerGeometrySource==='imported-cc0-glb'
          && Number(canvas.dataset.hangerMeshCount)>0),preset,{timeout:14000})
        const scene=await page.locator('canvas[data-hanger-geometry-source="imported-cc0-glb"]').first().evaluate(canvas=>({
          preset:canvas.dataset.hangerPreset,
          source:canvas.dataset.hangerGeometrySource,
          meshes:Number(canvas.dataset.hangerMeshCount),
        }))
        assert.equal(scene.preset,preset)
        assert.ok(scene.meshes>0)
        results.push({width,...scene})
      }
      assert.deepEqual(errors,[],'No JavaScript exceptions')
    }finally{await page.close()}
  }
  console.log(JSON.stringify({pass:true,results},null,2))
}finally{await browser.close()}
