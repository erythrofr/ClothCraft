import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Isolated testSession=tee never opens or overwrites the owner's jeans or
// other current garments. One bounded headless browser instance for QA only.
const browser=await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try {
  const page=await browser.newPage({viewport:{width:1650,height:1000}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee',{waitUntil:'domcontentloaded'})
  await page.getByRole('combobox',{name:'CLO-style workspace layout presets'}).selectOption('materials')
  const preview=page.locator('.fabric-material-preview canvas').first()
  await preview.waitFor({state:'visible',timeout:20000})
  const viewport=page.locator('.three-mount canvas').first()
  await page.waitForFunction(()=>Number(document.querySelector('.three-mount canvas')?.dataset.simulationSessionBuilds||0)>0,{timeout:20000})
  const initialBuilds=Number(await viewport.getAttribute('data-simulation-session-builds'))
  const initialProject=await page.evaluate(()=>JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')||'null'))
  assert.ok(initialProject?.fabrics?.main)
  assert.ok(await preview.evaluate(canvas=>canvas.width>0 && canvas.height>0))

  const opacity=page.locator('.slider-row').filter({hasText:'Fabric opacity'}).locator('input[type="range"]')
  await opacity.focus()
  await opacity.press('ArrowLeft')
  await page.waitForTimeout(450)
  assert.equal(Number(await viewport.getAttribute('data-simulation-session-builds')),initialBuilds,
    'Opacity shader edits must not rebuild cloth physics')

  const photoInput=page.locator('input[type="file"][accept="image/png,image/jpeg,image/webp"]').nth(1)
  await photoInput.setInputFiles('qa-fabric-texture-2d3d.png')
  await page.waitForFunction(()=>Boolean(JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')||'null')?.fabrics?.main?.texture?.src),{timeout:15000})
  await page.getByRole('button',{name:/GENERATE NORMAL \+ ROUGHNESS FROM PHOTO/}).click()
  await page.waitForFunction(()=>{
    const map=JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')||'null')?.fabrics?.main?.texture
    return Boolean(map?.normalSrc && map?.roughnessSrc)
  },{timeout:20000})
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')||'null'))
  assert.equal(saved.fabrics.main.texture.normalName,'Auto from textile image')
  assert.equal(saved.fabrics.main.texture.roughnessName,'Auto from textile image')
  assert.equal(Number(await viewport.getAttribute('data-simulation-session-builds')),initialBuilds,
    'Color texture and generated PBR maps must preserve the live simulation')

  // Validate a non-default family change reaches saved project and keeps solver.
  await page.getByRole('combobox',{name:'Fabric structure'}).selectOption('ripstop')
  await page.waitForTimeout(700)
  const updated=await page.evaluate(()=>JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')||'null'))
  assert.equal(updated.fabrics.main.surfaceFamily,'ripstop')
  assert.equal(Number(await viewport.getAttribute('data-simulation-session-builds')),initialBuilds)
  await preview.screenshot({path:'qa-sampl3d-material-ball-20261015.png'})
  assert.deepEqual(errors,[],'Fabric editor and preview must not throw JavaScript errors')
  console.log(JSON.stringify({pass:true,canvasPreview:true,photoPbr:true,structureSelector:true,
    opticalEditsPreserveSession:true,simulationSessions:initialBuilds,errors:errors.length,
    screenshot:'qa-sampl3d-material-ball-20261015.png'}))
} finally {
  await browser.close()
}
