import { chromium } from 'playwright-core'
import { stat } from 'node:fs/promises'
import assert from 'node:assert/strict'

const ids = ['cathedral','R02','R03','S01','S10']
const reports = []
for (const id of ids) {
  const file = await stat(`public/stage-posters/${id}.png`)
  assert.ok(file.size > 8000, `${id}: empty poster`)
  reports.push({ id, posterBytes: file.size })
}
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'] })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${process.env.EXO_QA_URL || 'http://127.0.0.1:5188'}/?desktop=1&testSession=stage-poster-qa`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name:'Stage', exact:true }).click()
  const catalog=page.locator('.exo-stage-catalog').first()
  await catalog.waitFor({ timeout:12000 })
  const cards=catalog.locator('.exo-stage-card')
  assert.equal(await cards.count(), 5)
  const actualIds=await cards.evaluateAll(nodes=>nodes.map((node,index)=>index===0?'cathedral':node.querySelector('[data-stage-id]')?.dataset.stageId))
  assert.deepEqual(actualIds,ids)
  assert.equal(await cards.locator('canvas').count(),0,'cards unexpectedly create WebGL canvases')
  for(const entry of reports){
    const tile=entry.id==='cathedral'?cards.first().locator('.exo-stage-illustration'):catalog.locator(`[data-stage-id="${entry.id}"]`)
    await tile.scrollIntoViewIfNeeded()
    await tile.locator('img').evaluate(async img=>{ if(!img.complete) await new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})}) })
    assert.equal(await tile.locator('img').evaluate(el=>el.naturalWidth>0),true,`${entry.id}: poster missing`)
  }
  const selected=catalog.locator('[data-stage-id="R02"]').locator('..')
  await selected.hover({ force:true })
  const popup=page.locator('[data-library-preview="stage:R02"]')
  await popup.waitFor({timeout:5000})
  const canvas=popup.locator('canvas')
  await canvas.waitFor({timeout:5000})
  await page.waitForFunction(()=>document.querySelector('[data-library-preview="stage:R02"] canvas')?.dataset.stageStatus==='ready',null,{timeout:15000})
  const meshes=Number(await canvas.getAttribute('data-preview-mesh-count'))
  assert.ok(meshes>0,'hover lacks actual mesh')
  assert.equal(await cards.locator('canvas').count(),0,'hover should not mount canvases inside cards')
  await selected.click({force:true})
  console.log(JSON.stringify({ width:390,ids,cardCanvases:0,hoverMeshes:meshes,posters:reports },null,2))
} finally { await browser.close() }
