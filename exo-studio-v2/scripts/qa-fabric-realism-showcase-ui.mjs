import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Browser acceptance for the actual editor and assigned garment, using an
// isolated project slot. PBR rendering is evidence of appearance only.
const url=process.env.EXO_QA_URL || 'http://127.0.0.1:5188'
const browser=await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}})
  const errors=[]
  const missing=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('response',response=>{
    if(/\/fabric-scans(?:-ambientcg)?\//.test(response.url())&&!response.ok())
      missing.push({url:response.url(),status:response.status()})
  })
  await page.goto(url+'/?desktop=1&testSession=fabric-showcase',{waitUntil:'domcontentloaded'})
  await page.locator('.three-mount canvas').first().waitFor({state:'attached',timeout:25000})
  await page.getByRole('combobox',{name:'CLO-style workspace layout presets'}).selectOption('materials')
  await page.getByRole('button',{name:'Browse fabrics'}).click()
  await page.getByRole('textbox',{name:'Search library'}).fill('Rigid Denim')
  await page.locator('.exo-fabric-entry-main[data-fabric-preset="denim"]').click()
  await page.getByRole('button',{name:'Add to project and apply'}).click()
  await page.locator('.clo-object-row .clo-object-select').filter({hasText:'Rigid Denim'}).first().click()
  const cards=page.locator('.exo-fabric-realism-collection > button')
  await cards.first().waitFor({state:'visible'})
  assert.equal(await cards.count(),5)
  const preview=page.locator('.fabric-material-preview-canvas canvas')
  await preview.waitFor({state:'visible'})
  await cards.first().click()
  await page.waitForFunction(()=>Boolean(document.querySelector('.fabric-material-preview-meta')?.textContent?.includes('CC0 SCAN')))
  await page.locator('.fabric-material-preview-tools button').filter({hasText:'Draped surface'}).click()
  assert.equal(await page.getByRole('button',{name:'Draped surface'}).getAttribute('aria-pressed'),'true')
  const labels=await page.locator('.fabric-material-preview-controls label').allTextContents()
  assert.ok(labels.some(s=>s.includes('Fabric roughness')))
  const roughness=page.locator('.fabric-material-preview-controls label').filter({hasText:'Fabric roughness'}).locator('input')
  const roughnessBefore=Number(await roughness.inputValue())
  await roughness.focus()
  await roughness.press('ArrowLeft')
  const roughnessAfter=Number(await roughness.inputValue())
  assert.ok(roughnessAfter<roughnessBefore,'Editing roughness must change the live material value')
  const shine=page.locator('.fabric-material-preview-controls label').filter({hasText:'Light direction'}).locator('input')
  await shine.fill('115')
  assert.equal(await shine.inputValue(),'115')
  const garment=page.locator('.three-mount canvas').first()
  await page.waitForFunction(()=>Number(document.querySelector('.three-mount canvas')?.dataset.textileMappedPanels)>0)
  const mapCount=Number(await garment.getAttribute('data-textile-mapped-panels'))
  assert.ok(mapCount>0,'Actual garment must use textile PBR maps')
  if(process.env.EXO_CAPTURE==='1'){
    await page.locator('.exo-fabric-realism-collection').screenshot({path:'screenshots/exo-five-fabric-presets-review.png'})
    await page.locator('.fabric-material-preview').screenshot({path:'screenshots/exo-fabric-draped-preview-review.png'})
  }
  assert.deepEqual(errors,[])
  assert.deepEqual(missing,[])
  console.log(JSON.stringify({pass:true,showcaseCards:5,liveWebGL:true,
    cameraModes:['macro','drape'],pbrMappedGarmentPanels:mapCount,
    opticalPreviewControls:labels.length,roughnessBefore,roughnessAfter,
    pageErrors:errors.length,missingMaps:missing.length}))
}finally{
  await browser.close()
}
