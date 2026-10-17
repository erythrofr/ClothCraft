import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'

const base=process.env.EXO_QA_URL||'http://127.0.0.1:5518'
const browser=await chromium.launch({
  headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
const results=[]
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900}})
    const warnings=[],pageErrors=[],failed=[]
    page.on('console',message=>{
      if(message.text().includes('Texture marked for update but no image data found'))warnings.push(message.text())
    })
    page.on('pageerror',error=>pageErrors.push(error.message))
    page.on('response',response=>{
      if(/\/(fabric-scans|stage-scenes|stage-posters)\//.test(response.url())&&!response.ok())failed.push([response.status(),response.url()])
    })
    await page.goto(base+'/?desktop=1&testSession=realism-next-'+width,{waitUntil:'domcontentloaded'})
    await page.waitForTimeout(850)
    const nav=page.getByRole('navigation',{name:'Library categories'})
    await nav.getByRole('button',{name:'Stage',exact:true}).click()
    const stageCards=page.locator('.exo-stage-card')
    assert.equal(await stageCards.count(),5,'Only five curated stage cards should be visible')
    assert.equal(await stageCards.locator('canvas').count(),0,'Inactive stage catalog cards must not occupy five WebGL contexts')
    assert.equal(await stageCards.locator('img.exo-stage-poster').count(),5,'Stage cards must use images rendered from actual GLBs')
    await page.locator('.exo-stage-card').filter({hasText:'Mountain'}).hover()
    const stageHover=page.locator('[data-library-preview="stage:R02"]')
    await stageHover.waitFor({state:'visible',timeout:8000})
    await stageHover.locator('canvas').first().waitFor({state:'attached',timeout:9000})
    await nav.getByRole('button',{name:'Garment',exact:true}).click()
    await page.locator('.asset-template[data-library-hover-id="Garment:tee"]').hover()
    const garment=page.locator('[data-library-preview="Garment:tee"]')
    await garment.waitFor({state:'visible',timeout:9000})
    const patternView=garment.locator('canvas[data-preview-render-mode="reference-three-view-static"]')
    await patternView.waitFor({state:'attached',timeout:10000})
    const garmentInfo=await patternView.evaluate(canvas=>({
      meshes:Number(canvas.dataset.previewMeshCount),
      triangles:Number(canvas.dataset.previewTriangleCount),
      status:canvas.dataset.previewStatus,
      views:Number(canvas.dataset.previewViewCount),
      pieces:Number(canvas.dataset.previewSourcePieceCount),
    }))
    assert.ok(garmentInfo.meshes>=12 && garmentInfo.triangles>3000)
    assert.equal(garmentInfo.status,'ready')
    assert.equal(garmentInfo.views,3,'Garment cutlines should appear in front/side/back views together')
    assert.equal(garmentInfo.pieces,4,'Tee should have distinct front/back and two source sleeves')
    await nav.getByRole('button',{name:'Fabric',exact:true}).click()
    await page.getByRole('textbox',{name:'Search library'}).fill('Rigid Denim')
    await page.locator('.exo-fabric-entry-main[data-fabric-preset="denim"]').hover()
    const ball=page.locator('[data-library-preview="Fabric:denim"] canvas[data-fabric-ball]')
    await ball.waitFor({state:'attached',timeout:10000})
    const ballInfo=await ball.evaluate(canvas=>({
      width:canvas.width,height:canvas.height,lost:canvas.getContext('webgl2')?.isContextLost()??true,
      vertices:Number(canvas.dataset.previewMeshCount),
    }))
    assert.ok(ballInfo.width>90&&ballInfo.height>150&&!ballInfo.lost)
    assert.equal(await page.locator('[data-library-preview="Fabric:denim"] .exo-fabric-ball-macro').count(),0,'The 3D drape must be unobstructed')
    assert.equal(await page.locator('[data-library-preview="Fabric:denim"] .exo-fabric-hover-flat').count(),1,'One enlarged flat swatch stays beside the drape')
    assert.deepEqual(pageErrors,[])
    assert.deepEqual(failed,[])
    results.push({width,stageCards:5,stageCanvasesIdle:0,garment:garmentInfo,fabricBall:ballInfo,
      textureUploadWarnings:warnings.length,pageErrors:pageErrors.length,failedAssets:failed.length})
    await page.close()
  }
  console.log(JSON.stringify({pass:true,results},null,2))
}finally{await browser.close()}
