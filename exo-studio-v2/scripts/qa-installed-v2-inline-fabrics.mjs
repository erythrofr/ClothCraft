/** Non-mutating acceptance of the already-installed signed EXO V2 app. */
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
const url='http://127.0.0.1:5386/?desktop=1&engine=clothcraft'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const page=await browser.newPage({viewport:{width:1550,height:950}})
 const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(url,{waitUntil:'domcontentloaded'})
 await page.locator('.cc-board [data-panel]').first().waitFor({timeout:30000})
 await page.getByRole('button',{name:'Browse fabrics'}).click()
 await page.getByRole('list',{name:'Fabric presets'}).waitFor()
 assert.equal(await page.locator('.exo-fabric-entry-main').count(),400)
 await page.getByRole('textbox',{name:'Search library'}).fill('Rigid Denim')
 const denim=page.locator('.exo-fabric-entry-main[data-fabric-preset="denim"]')
 await denim.hover()
 const hover=page.locator('[data-library-preview="Fabric:denim"]')
 await hover.waitFor({state:'visible',timeout:4500})
 assert.match(await hover.innerText(),/Rigid Denim/)
 const hoverBounds=await hover.boundingBox()
 assert.ok(hoverBounds?.width>=300&&hoverBounds?.height>=200)
 assert.ok(hoverBounds.x>=0&&hoverBounds.y+hoverBounds.height<=950)
 await page.getByRole('textbox',{name:'Search library'}).fill('')
 const scroll=await page.locator('.asset-library-content').evaluate(el=>{
  const before=el.scrollTop;el.scrollTop=640;return {before,after:el.scrollTop,height:el.clientHeight,total:el.scrollHeight}
 })
 assert.ok(scroll.after>scroll.before+200&&scroll.total>scroll.height)
 // The current V2 Object Browser uses a real 'Fabric' tab, not the retired
 // 'Choose Fabric' standalone action. The fabric stays docked on the right.
 await page.getByRole('tab',{name:'Fabric',exact:true}).click()
 const sceneRows=page.locator('.clo-object-list .clo-object-row')
 await sceneRows.first().waitFor()
 assert.ok(await sceneRows.count()>=1&&await sceneRows.count()<400)
 await sceneRows.first().locator('button.clo-object-select').click()
 await page.locator('.cc-fabric-library').waitFor({state:'visible',timeout:12000})
 const checks=await page.evaluate(()=>{
  const editor=document.querySelector('.clo-property-panel'),material=document.querySelector('.cc-fabric-library'),canvas=document.querySelector('.cc-viewport-3d')
  const rect=material?.getBoundingClientRect(),owner=editor?.getBoundingClientRect(),scene=canvas?.getBoundingClientRect()
  return {inEditor:editor?.contains(material),floating:document.querySelectorAll('.cc-native-fabric-dock').length,
   white:getComputedStyle(material).backgroundColor,background:getComputedStyle(document.body).backgroundColor,
   materialBounds:rect&&{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},
   ownerBounds:owner&&{left:owner.left,right:owner.right},
   sceneBounds:scene&&{left:scene.left,right:scene.right},
   heading:document.querySelector('.cc-fabric-library h3')?.textContent,
   inputs:material?.querySelectorAll('.cc-fabric-field input').length,
   presetPickerCount:material?.querySelectorAll('[data-fabric-preset]').length}
 })
 assert.ok(checks.inEditor&&checks.floating===0)
 assert.ok(checks.materialBounds.left>=checks.ownerBounds.left-2&&checks.materialBounds.right<=checks.ownerBounds.right+2)
 assert.ok(checks.materialBounds.left>checks.sceneBounds.right-2)
 assert.ok(checks.inputs>=4,'Native physical material fields must remain editable')
 assert.equal(checks.presetPickerCount,0,'Full preset catalog should live in the left Library only')
 assert.notEqual(checks.white,'rgb(247, 247, 245)','Old white material widget must be gone')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({pass:true,installedApp:true,leftPresets:400,largeHoverPreview:{width:hoverBounds.width,height:hoverBounds.height},rightSceneSwatches:await sceneRows.count(),scroll,controls:checks,pageErrors:errors.length}))
}finally{await browser.close()}
