import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base=process.env.EXO_QA_URL||'http://127.0.0.1:5188'
const browser=await chromium.launch({headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 try{
 for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900}})
 const errors=[],badAssets=[]
 page.on('pageerror',e=>errors.push(e.message))
 page.on('response',r=>{if((/\/library-3d\//.test(r.url())||/\/hardware-thumbnails\//.test(r.url()))&&!r.ok())badAssets.push([r.status(),r.url()])})
 await page.goto(`${base}/?desktop=1&testSession=library-universal-hover-${width}`,{waitUntil:'domcontentloaded'})
 await page.getByRole('button',{name:'Browse garments'}).waitFor({state:'visible'})
 const nav=page.getByRole('navigation',{name:'Library categories'})
 const data=[]
 for(const [category,buttonSelector,previewSelector] of [
  ['Garment','.asset-template[data-library-hover-id^="Garment:"]','[data-library-preview^="Garment:"]'],
  ['Avatar','.asset-template[data-library-hover-id^="Avatar:"]','[data-library-preview^="Avatar:"]'],
  ['Hanger','.asset-template[data-library-hover-id^="Hanger:"]','[data-library-preview^="Hanger:"]'],
  ['Fabric','.exo-fabric-entry-main','[data-library-preview^="Fabric:"]'],
  ['Hardware and Trims','.exo-hardware-asset[data-library-hover-id^="hardware:"]','[data-library-preview^="hardware:"]'],
  ['Material','.exo-fabric-entry-main','[data-library-preview^="Fabric:"]'],
  ['Stage','.exo-stage-card[data-library-hover-id="stage:R02"]','[data-library-preview="stage:R02"]'],
  ['Patterns','.asset-template[data-library-hover-id^="Patterns:"]','[data-library-preview^="Patterns:"]'],
 ]){
  console.log('Category hover QA',width,category)
  await page.mouse.move(1100,38)
  await nav.getByRole('button',{name:category,exact:true}).click()
  if(category==='Fabric'||category==='Material')await page.getByRole('textbox',{name:'Search library'}).fill('Rigid Denim')
  const target=category==='Avatar'
    ?page.locator(buttonSelector).filter({hasText:'Theo'}).first()
    :page.locator(buttonSelector).first()
  await target.waitFor({state:'visible',timeout:15000})
  await target.scrollIntoViewIfNeeded()
  await page.mouse.move(1100,38)
  await target.hover({timeout:15000})
  const preview=page.locator(previewSelector).first()
  await preview.waitFor({state:'visible',timeout:8000})
  const bounds=await preview.boundingBox()
  console.log('Preview box',category,width,bounds)
  assert.ok(bounds.width>=225 && bounds.height>=145,`${category}: enlarged preview must be substantial`)
  assert.ok(bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=(width===390?845:901),`${category}: preview must fit viewport`)
  const media=await preview.locator('canvas,img,svg').count()
  assert.ok(media>0,`${category}: media is required`)
  if(category==='Stage') {
    const stagePreview=preview.locator('canvas[data-preview-stage-id]')
    await stagePreview.waitFor({state:'attached',timeout:10000})
    const status=await stagePreview.evaluate(canvas=>({id:canvas.dataset.previewStageId,meshes:Number(canvas.dataset.previewMeshCount)}))
    assert.ok(/^R\d\d$|^S\d\d$/.test(status.id) && status.meshes>5,`Stage popup must render the selected stage's actual 3D geometry: ${JSON.stringify(status)}`)
  }
  const dark=await preview.evaluate(el=>getComputedStyle(el).backgroundColor)
  data.push({category,width:Math.round(bounds.width),height:Math.round(bounds.height),media,dark})
  // Clear hover when switching categories and release canvases.
  await page.mouse.move(1135,50)
 }
 // The real hanger is selectable from the same left rail and updates the
 // Three.js garment viewport, independently of cloth physical constraints.
 await nav.getByRole('button',{name:'Hanger',exact:true}).click()
 await page.getByRole('button',{name:'Tailored Wood Hanger'}).first().click()
 await page.waitForFunction(()=>document.querySelector('.three-mount canvas')?.dataset.hangerPreset==='wood',{timeout:10000})
 assert.ok(Number(await page.locator('.three-mount canvas').first().getAttribute('data-hanger-mesh-count'))>0)
 await nav.getByRole('button',{name:'Stage',exact:true}).click()
 await page.locator('.exo-stage-card').filter({hasText:'MIKRISTIAN Cathedral House'}).first().click()
 await page.waitForFunction(()=>{const canvas=document.querySelector('.three-mount canvas');return canvas?.dataset.stageId==='cathedral'&&canvas?.dataset.stageStatus==='ready'},{timeout:20000})
 const stageMeshes=Number(await page.locator('.three-mount canvas').first().getAttribute('data-stage-mesh-count'))
 assert.ok(stageMeshes>0,'Cathedral needs real 3D scene meshes')
 assert.deepEqual(errors,[],`Runtime errors: ${errors.join('; ')}`)
 assert.deepEqual(badAssets,[])
 console.log(JSON.stringify({pass:true,viewportWidth:width,categories:data,stageMeshes,realHanger:true,errors:errors.length,badAssets:badAssets.length}))
 await page.close()
 }
}finally{await browser.close()}
