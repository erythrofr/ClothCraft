import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'

const base=process.env.EXO_QA_URL||'http://127.0.0.1:5533'
const browser=await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}})
  const errors=[],failed=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('response',response=>{
    if(/\/fabric-scans/.test(response.url())&&!response.ok())failed.push([response.status(),response.url()])
  })
  await page.goto(base+'/?desktop=1&testSession=clo-fabric-ball-lighting',{waitUntil:'domcontentloaded'})
  const nav=page.getByRole('navigation',{name:'Library categories'})
  await nav.getByRole('button',{name:'Fabric',exact:true}).click()
  const fabrics=[]
  for(const [name,id] of [['Rigid Denim','denim'],['Silk Twill','silk']]){
    await page.getByRole('textbox',{name:'Search library'}).fill(name)
    await page.locator(`.exo-fabric-entry-main[data-fabric-preset="${id}"]`).hover()
    const card=page.locator(`[data-library-preview="Fabric:${id}"]`)
    await card.waitFor({state:'visible',timeout:7000})
    const canvas=card.locator('canvas[data-fabric-ball]')
    await canvas.waitFor({state:'attached'})
    const macro=card.locator('canvas[data-scan-macro-ready="true"]')
    await macro.waitFor({state:'attached',timeout:9000})
    assert.equal(await card.locator('.exo-fabric-ball .exo-fabric-flat-macro').count(),0,
      'Enlarged scanned weave must not cover or obscure the 3D cloth ball')
    assert.equal(await card.locator('.exo-fabric-hover-flat .exo-fabric-flat-macro').count(),1)
    assert.equal(await macro.getAttribute('data-scan-macro-width-cm'),'1.8')
    assert.ok((await macro.boundingBox())?.width>50)
    await card.getByRole('button',{name:/Fabric lighting: soft/}).click()
    assert.equal(await canvas.getAttribute('data-preview-light-mode'),'raking')
    await card.getByRole('button',{name:/Fabric lighting: raking/}).click()
    assert.equal(await canvas.getAttribute('data-preview-light-mode'),'daylight')
    const before=Number(await canvas.getAttribute('data-preview-zoom-distance'))||4.5
    await canvas.hover()
    await page.mouse.wheel(0,-90)
    await page.waitForTimeout(500)
    const after=Number(await canvas.getAttribute('data-preview-zoom-distance'))
    assert.ok(after>0&&after<before)
    await canvas.focus()
    await page.keyboard.press('-')
    await page.waitForTimeout(100)
    const out=Number(await canvas.getAttribute('data-preview-zoom-distance'))
    assert.ok(out>after,`Keyboard '-' zoom should increase distance (before ${before}, wheel ${after}, keyboard ${out})`)
    fabrics.push({name,light:'daylight',zoomIn:after,zoomOut:out,macroReady:true,
      scanAssetId:await card.locator('canvas.exo-fabric-hover-flat-canvas').getAttribute('data-scan-asset-id')})
    await page.mouse.move(1050,50)
  }
  assert.deepEqual(errors,[])
  assert.deepEqual(failed,[])
  console.log(JSON.stringify({pass:true,fabrics,pageErrors:errors.length,missingScans:failed.length}))
}finally{await browser.close()}
