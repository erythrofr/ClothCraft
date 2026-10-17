import assert from 'node:assert/strict'
import * as THREE from 'three'
import { chromium } from 'playwright-core'
import { createTemplateProject } from '../src/data/templates.js'
import { garmentPreviewPage } from '../src/core/garmentPreviewPaging.js'
import { makePanelGeometry, posedPanelNormal } from '../src/core/garmentPreviewGeometry.js'
import { garmentPreviewTextileFamily, garmentPreviewStudioColor } from '../src/core/garmentPreviewFabric.js'

const jeans = createTemplateProject('jeans-501')
assert.equal(jeans.pieces.length, 24, 'Use the actual 24-panel authored 501 source fixture')
const first = garmentPreviewPage(jeans.pieces, 0)
const second = garmentPreviewPage(jeans.pieces, 1)
assert.equal(first.pageCount, 2)
assert.deepEqual([first.pieces.length,second.pieces.length], [14,10])
assert.equal(first.total, 24)
assert.equal(second.total, 24)
assert.equal(second.page, 1)
assert.equal(garmentPreviewPage(jeans.pieces, 999).page, 1)
assert.equal(garmentPreviewPage(jeans.pieces, -10).page, 0)
assert.equal(garmentPreviewPage(jeans.pieces, NaN).page, 0)
assert.equal(new Set([...first.pieces,...second.pieces].map(p=>p.id)).size, 24)
const invalid = garmentPreviewPage([...jeans.pieces, {id:'broken',points:[{x:1,y:2}]}])
assert.equal(invalid.total, 24)
assert.equal(invalid.invalidCount, 1)

// Confirm edge geometry is extruded *normal to the curved surface*, rather
// than world Z. This remains a visual ribbon, not measured cloth thickness.
const transform = p => new THREE.Vector3(p.x*.04, p.y*.03, p.x*.015 + p.y*.011)
const resources = []
const panel = makePanelGeometry(jeans.pieces[0], transform, resources)
assert.ok(panel?.triangles>0)
const edge = panel.edgeGeometry.getAttribute('position')
const front = new THREE.Vector3().fromBufferAttribute(edge,0)
const rear = new THREE.Vector3().fromBufferAttribute(edge,2)
const delta = rear.sub(front)
const normal = posedPanelNormal(panel.boundary.points[0],transform)
assert.ok(Math.abs(delta.length()-.012)<1e-4)
assert.ok(Math.abs(delta.dot(normal)+.012)<1e-4)
assert.ok(Math.abs(delta.x)>1e-3 || Math.abs(delta.y)>1e-3,'Edge thickness must not be a world-Z offset')
resources.forEach(item=>item.dispose?.())
for(const [templateId,family] of [
  ['tee','jersey-knit'],
  ['hoodie','french-terry'],
  ['zip-hoodie','french-terry'],
  ['pants','denim-twill'],
  ['skirt','denim-twill'],
  ['jeans-501','denim-twill'],
]) {
  assert.equal(garmentPreviewTextileFamily(createTemplateProject(templateId).fabrics.main),family)
}
assert.equal(garmentPreviewStudioColor('#252525').adjusted,true)
assert.equal(garmentPreviewStudioColor('#d9dde1').adjusted,false)

const url=process.env.EXO_QA_URL || 'http://127.0.0.1:5199'
const browser=await chromium.launch({
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless:true,
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try {
  for(const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:width===390?844:900}})
    page.setDefaultTimeout(25000)
    const errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.goto(url+'/docs/qa/garment-preview-20261017/harness.html?templateId=jeans-501',{waitUntil:'domcontentloaded'})
    const canvas=page.locator('.exo-garment-mini-canvas canvas')
    await canvas.waitFor({state:'attached'})
    await page.waitForFunction(()=>document.querySelector('.exo-garment-mini-canvas canvas')?.dataset.previewStatus==='ready')
    const before=await canvas.evaluate(el=>({...el.dataset}))
    assert.equal(before.previewSourcePieceCount,'24')
    assert.equal(before.previewDisplayedPieceCount,'14')
    assert.equal(before.previewPageCount,'2')
    const firstIDs=before.previewSourcePieceIds.split(',')
    const next=page.getByRole('button',{name:'Next source panels'})
    await next.click()
    await page.waitForFunction(()=>document.querySelector('.exo-garment-mini-canvas canvas')?.dataset.previewPage==='2' &&
      document.querySelector('.exo-garment-mini-canvas canvas')?.dataset.previewStatus==='ready')
    const after=await page.locator('.exo-garment-mini-canvas canvas').evaluate(el=>({...el.dataset}))
    assert.equal(after.previewDisplayedPieceCount,'10')
    assert.equal(after.previewSourcePieceCount,'24')
    assert.equal(after.previewHiddenPieceCount,'14')
    assert.deepEqual(new Set([...firstIDs,...after.previewSourcePieceIds.split(',')]).size,24)
    assert.equal(await next.isDisabled(),true)
    await page.getByRole('button',{name:'Previous source panels'}).click()
    await page.waitForFunction(()=>document.querySelector('.exo-garment-mini-canvas canvas')?.dataset.previewPage==='1')
    assert.deepEqual(errors,[])
    assert.equal(before.previewTextileFamily,'denim-twill')
    assert.equal(before.previewTextileProvenance,'procedural-estimated')
    assert.equal(before.previewOriginalFabricColor,'#2c4259')
    assert.equal(before.previewStudioColorLifted,'true')
    console.log(JSON.stringify({width,preview:'jeans-501',sourceCount:24,groups:2,firstCount:14,lastCount:10,errors}))
    await page.close()
  }
} finally {await browser.close()}
console.log('PASS complete source-piece paging, tangent-normal edge ribbons and desktop/mobile view updates')
