import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Covers the actual left Library in EXO draft and Rust ClothCraft modes.
// Uses an isolated browser session and never changes a saved garment project.
const base=process.env.EXO_QA_URL||'http://127.0.0.1:5188'
const browser=await chromium.launch({headless:true,
  executablePath:process.env.EXO_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
const report=[]
try{
  for(const native of [false,true]){
    const page=await browser.newPage({viewport:{width:1440,height:900}})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    try{
      const mode=native?'clothcraft':'draft'
      const url=`${base}/?desktop=1&testSession=fabric-side-${mode}${native?'&engine=clothcraft':''}`
      await page.goto(url,{waitUntil:'domcontentloaded'})
      await page.getByRole('button',{name:'Browse fabrics'}).click()
      const catalog=page.getByLabel('Fabric preset catalog')
      await catalog.waitFor({state:'visible',timeout:15000})
      const rows=page.locator('.exo-fabric-entry-main')
      assert.equal(await rows.count(),400,`${mode}: all 400 presets available`)
      const box=page.locator('.asset-library-content')
      const scroll=await box.evaluate(el=>{
        const before=el.scrollTop
        el.scrollTop=99999
        return {height:el.clientHeight,full:el.scrollHeight,before,after:el.scrollTop}
      })
      assert.ok(scroll.full>scroll.height+200,`${mode}: catalog needs own scroll area`)
      assert.ok(scroll.after>scroll.before+200,`${mode}: catalog scroll must move`)
      const search=page.getByRole('textbox',{name:'Search library'})
      await search.fill('denim')
      const count=await rows.count()
      assert.ok(count>0&&count<400,`${mode}: search actually narrows library`)
      const first=rows.first()
      await first.click()
      assert.equal(await first.getAttribute('aria-expanded'),'true',`${mode}: details expand`)
      if(native){
        assert.equal(await page.getByRole('button',{name:'Apply to selected Rust panel'}).count(),1)
        assert.equal(await page.getByRole('button',{name:'Add to project and apply'}).count(),0)
      }else{
        await page.getByRole('button',{name:'Add to project and apply'}).click()
        assert.ok(await page.locator('.clo-object-row .clo-object-select').count()>0,'EXO draft swatch created')
      }
      assert.deepEqual(errors,[],`${mode}: no JavaScript errors`)
      report.push({mode,total:400,matched:count,scrollHeight:scroll.full,clientHeight:scroll.height,scrollMoved:scroll.after,errors:0})
    }finally{await page.close()}
  }
  const mobile=await browser.newPage({viewport:{width:390,height:844}})
  const mobileErrors=[]
  mobile.on('pageerror',error=>mobileErrors.push(error.message))
  try{
    await mobile.goto(`${base}/?desktop=1&testSession=fabric-side-mobile`,{waitUntil:'domcontentloaded'})
    let browse=mobile.getByRole('button',{name:'Browse fabrics'})
    if(!(await browse.isVisible()))await mobile.getByRole('button',{name:'Show or hide Library'}).click()
    await browse.click()
    const entries=mobile.locator('.exo-fabric-entry-main')
    assert.equal(await entries.count(),400,'390px: full fabric catalog is accessible')
    const metrics=await mobile.locator('.asset-library-content').evaluate(el=>{
      el.scrollTop=400
      return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
        scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,scrollTop:el.scrollTop}
    })
    assert.ok(metrics.scrollHeight>metrics.clientHeight,'390px: library has internal overflow')
    assert.ok(metrics.scrollTop>=300,'390px: library can be scrolled')
    assert.deepEqual(mobileErrors,[])
    report.push({mode:'mobile-390',total:400,...metrics,errors:0})
  }finally{await mobile.close()}
  console.log(JSON.stringify({pass:true,report}))
}finally{await browser.close()}
