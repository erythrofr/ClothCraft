import {chromium} from 'playwright-core'

const base=process.env.EXO_QA_URL||'http://127.0.0.1:5188'
const browser=await chromium.launch({headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try{
  const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1})
  await page.goto(base+'/?desktop=1&testSession=qa-library-previews',{waitUntil:'domcontentloaded'})
  const nav=page.getByRole('navigation',{name:'Library categories'})
  await nav.getByRole('button',{name:'Fabric',exact:true}).click()
  await page.getByRole('textbox',{name:'Search library'}).fill('Rigid Denim')
  await page.locator('.exo-fabric-entry-main[data-fabric-preset="denim"]').hover()
  const fabric=page.locator('[data-library-preview="Fabric:denim"]')
  await fabric.waitFor({state:'visible'})
  await fabric.locator('canvas[data-fabric-ball]').waitFor({state:'visible'})
  await page.waitForTimeout(350)
  await fabric.screenshot({path:'docs/qa/clo-reference-images/exo-v2-fabric-hover-after.png',animations:'disabled'})
  await nav.getByRole('button',{name:'Garment',exact:true}).click()
  await page.locator('.asset-template[data-library-hover-id="Garment:tee"]').hover()
  const garment=page.locator('[data-library-preview="Garment:tee"]')
  await garment.waitFor({state:'visible'})
  await garment.locator('canvas[data-preview-status="ready"]').waitFor({state:'visible'})
  await page.waitForTimeout(300)
  await garment.screenshot({path:'docs/qa/clo-reference-images/exo-v2-garment-hover-after.png',animations:'disabled'})
  console.log('Saved two dev-web preview captures to docs/qa/clo-reference-images/')
}finally{await browser.close()}
