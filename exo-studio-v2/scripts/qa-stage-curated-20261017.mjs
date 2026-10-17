import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const base=process.env.EXO_QA_URL||'http://127.0.0.1:5188'
const out='docs/qa-stage-curated-20261017'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
const report=[]
try {
 for (const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:1})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`${base}/?desktop=1&testSession=curated-stage-${width}`,{waitUntil:'domcontentloaded'})
  await page.getByRole('button',{name:'Stage',exact:true}).click()
  const catalog=page.locator('.exo-stage-catalog').first()
  try { await catalog.waitFor({timeout:4500}) } catch {
   await page.screenshot({path:`${out}/${width}-catalog-unavailable.png`,fullPage:false})
   report.push({width,pass:false,reason:"Stage Library catalog unavailable after Stage navigation",visibleStageText:(await page.locator("body").innerText()).slice(0,850),errors})
   await page.close(); continue
  }
  const ids=await catalog.locator('.exo-stage-card').evaluateAll(nodes=>nodes.map(n=>n.querySelector('[data-stage-id]')?.dataset.stageId||'cathedral'))
  assert.deepEqual(ids,['cathedral','R02','R03','S01','S10'])
  assert.equal(await catalog.locator('.exo-stage-card canvas').count(),0,'Non-hover cards must use stills, not five active WebGL canvases')
  const thumb=[]
  for (const id of ids) {
   const card=id==='cathedral'?catalog.locator('.exo-stage-card').first():catalog.locator(`.exo-stage-card:has([data-stage-id="${id}"])`)
   await card.scrollIntoViewIfNeeded()
   const poster=card.locator('img.exo-stage-poster')
   await poster.waitFor({state:'attached'})
   assert.equal(await poster.evaluate(img=>img.complete&&img.naturalWidth>0),true,`${id}: real GLB-derived poster missing`)
   await card.hover()
   const overlay=page.locator(`[data-library-preview="stage:${id}"]`)
   await overlay.waitFor({state:'visible',timeout:9000})
   const canvas=overlay.locator('canvas')
   await canvas.waitFor({state:'attached',timeout:10000})
   await page.waitForFunction(el=>['ready','error'].includes(el?.dataset?.stageStatus),await canvas.elementHandle(),{timeout:12000})
   const meshCount=Number(await canvas.getAttribute('data-preview-mesh-count')||0)
   const status=await canvas.getAttribute('data-stage-status')
   const previewStageId=await canvas.getAttribute('data-preview-stage-id')
   assert.equal(previewStageId,id,`${id}: wrong preview stage identity`)
   assert.equal(status,'ready',`${id}: GLB not ready`)
   assert.ok(meshCount>0,`${id}: no real GLB mesh geometry`)
   await card.screenshot({path:`${out}/${width}-${id}.png`})
   thumb.push({id,poster:true,meshCount,status,previewStageId})
  }
  const selected=catalog.locator('.exo-stage-card:has([data-stage-id="R02"])')
  await selected.click()
  await page.waitForTimeout(1500)
  const viewport=page.locator('.three-mount canvas').first()
  const selectedData=await viewport.evaluate(el=>({id:el.dataset.stageId,status:el.dataset.stageStatus,meshes:Number(el.dataset.stageMeshCount||0)})).catch(e=>({error:e.message}))
  await page.screenshot({path:`${out}/${width}-selected-viewport.png`,fullPage:false})
  report.push({width,ids,thumb,selectedData,errors})
  await page.close()
 }
}finally{await browser.close()}
console.log(JSON.stringify(report,null,2))
if(report.some(r=>r.pass===false||r.errors.length||r.thumb.some(t=>t.meshCount<=0)||r.selectedData.id!=='R02'||r.selectedData.status!=='ready'))process.exitCode=1
