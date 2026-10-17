import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base=process.env.EXO_QA_URL||'http://127.0.0.1:5188'
const browser=await chromium.launch({headless:true,
  executablePath:process.env.EXO_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[],badAssets=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('response',response=>{
  if(/\/fabric-scans(?:-ambientcg)?\//.test(response.url())&&!response.ok())badAssets.push(response.url())
 })
 await page.goto(`${base}/?desktop=1&testSession=library-hover-dblclick`,{waitUntil:'domcontentloaded'})
 await page.locator('.three-mount canvas').first().waitFor({state:'visible',timeout:30000})
 await page.getByRole('button',{name:'Browse fabrics'}).click()
 const search=page.getByRole('textbox',{name:'Search library'})
 const rows=page.locator('.exo-fabric-entry-main')
 assert.equal(await rows.count(),400)
 await search.fill('Rigid Denim')
 const fabric=page.locator('.exo-fabric-entry-main').filter({hasText:'Rigid Denim'}).first()
 await fabric.waitFor()
 await fabric.hover()
 const hover=page.locator('[data-library-preview="Fabric:denim"]')
 await hover.waitFor({state:'visible',timeout:4000})
 assert.match(await hover.innerText(),/Rigid Denim/)
 const detail=await hover.evaluate(el=>{
  const bounds=el.getBoundingClientRect()
  return {width:bounds.width,height:bounds.height,bottom:bounds.bottom,left:bounds.left}
 })
 assert.ok(detail.width>=230&&detail.height>=180,'Hover photo/info card should be large')
 assert.ok(detail.bottom<=900&&detail.left>=0,'Hover preview must remain inside browser viewport')
 await fabric.dblclick()
 await page.getByRole('tablist',{name:'Object Browser types'}).getByRole('tab',{name:'Fabric'}).click()
 await page.locator('.clo-object-list .clo-object-select').filter({hasText:'Rigid Denim'}).first().waitFor()
 await page.locator('.clo-object-list .clo-object-select').filter({hasText:'Rigid Denim'}).first().click()
 await page.locator('.fabric-material-preview-canvas canvas').waitFor({state:'visible'})
 await page.waitForFunction(()=>Number(document.querySelector('.three-mount canvas')?.dataset.textileMappedPanels)>0)
 const mapping=Number(await page.locator('.three-mount canvas').first().getAttribute('data-textile-mapped-panels'))
 assert.ok(mapping>0)
 await search.fill('denim')
 const second=rows.first()
 await second.dblclick({modifiers:['Shift']})
 await page.waitForTimeout(400)
 assert.deepEqual(errors,[])
 assert.deepEqual(badAssets,[])
 console.log(JSON.stringify({pass:true,presets:400,hoverPreview:detail,doubleClickApplied:true,mappedPanels:mapping,shiftApplyAll:true,errors:errors.length,badAssets:badAssets.length}))
}finally{await browser.close()}
