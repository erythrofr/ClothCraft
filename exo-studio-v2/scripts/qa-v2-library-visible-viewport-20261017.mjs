import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'

const browser=await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try{
  for(const [category,button,source] of [
    ['Fabric','Browse fabrics','[data-fabric-preset="denim"]'],
    ['Garment','Browse garments','.asset-template[data-library-hover-id^="Garment:"]'],
  ]){
    const page=await browser.newPage({
      viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    })
    page.setDefaultTimeout(15000)
    const errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.goto((process.env.EXO_QA_URL||'http://127.0.0.1:5199')+'/?desktop=1&testSession=visible-library-'+category,
      {waitUntil:'domcontentloaded'})
    await page.getByRole('button',{name:button}).click()
    if(category==='Fabric')await page.getByRole('textbox',{name:'Search library'}).fill('Rigid Denim')
    const item=page.locator(source).first()
    await item.waitFor({state:'visible'})
    await item.scrollIntoViewIfNeeded()
    if(category==='Garment'){
      const hint=item.locator('[data-library-preview-touch]')
      await hint.tap()
    }else await item.hover()
    const popup=page.locator('[data-library-preview^="'+category+':"]').first()
    await popup.waitFor({state:'visible'})
    await page.waitForTimeout(120)
    const details=await popup.evaluate(node=>{
      const r=node.getBoundingClientRect(),v=visualViewport
      return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,
        visibleLeft:v.offsetLeft,visibleTop:v.offsetTop,
        visibleRight:v.offsetLeft+v.width,visibleBottom:v.offsetTop+v.height,
      }
    })
    assert.ok(details.left>=details.visibleLeft+9,category+' left overflow '+JSON.stringify(details))
    assert.ok(details.right<=details.visibleRight-9,category+' right overflow '+JSON.stringify(details))
    assert.ok(details.top>=details.visibleTop+9,category+' top overflow '+JSON.stringify(details))
    assert.ok(details.bottom<=details.visibleBottom-9,category+' bottom overflow '+JSON.stringify(details))
    assert.deepEqual(errors,[])
    console.log('PASS '+category+' mobile preview fits visible viewport',JSON.stringify(details))
    await page.close()
  }
}finally{await browser.close()}
