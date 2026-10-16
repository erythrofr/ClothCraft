import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// A fresh headless browser profile does not touch the user's open garment.
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try {
  const page = await browser.newPage({viewport:{width:1650,height:1050},deviceScaleFactor:1})
  const pageErrors=[]
  page.on('pageerror',error=>pageErrors.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee',{waitUntil:'domcontentloaded'})
  await page.locator('.pattern-piece[data-piece-id="front"]').waitFor()
  await page.waitForTimeout(950)
  const front=page.locator('.pattern-piece[data-piece-id="front"]')
  const back=page.locator('.pattern-piece[data-piece-id="back"]')
  assert.equal(await front.locator('[data-pom="chest"]').count(),1)
  assert.equal(await front.locator('[data-pom="stomach"]').count(),1)
  assert.equal(await back.locator('[data-pom="chest"]').count(),1)
  assert.equal(await back.locator('[data-pom="stomach"]').count(),1)
  assert.equal(await page.locator('.draft-avatar-contour[data-avatar-proportioned="true"]').count(),1)
  assert.ok((await page.locator('.draft-avatar-contour').getAttribute('d')).length>1400,'Body silhouette needs realistic anatomical geometry')
  assert.equal(await page.locator('.draft-avatar-render').count(),0,'Never draw a face image in 2D')
  assert.ok(await front.locator('.pattern-node.selected-point').count()>=12)
  const points=await front.locator('.pattern-node.selected-point').evaluateAll(nodes=>nodes.map(node=>({r:node.getAttribute('r'),color:getComputedStyle(node).stroke})))
  assert.ok(points.every(node=>Number(node.r)>=1.8),'Selected points too small')

  const canvas=page.locator('.three-mount canvas').first()
  await canvas.waitFor()
  const shader=await canvas.evaluate(node=>({mapped:Number(node.dataset.textileMappedPanels),total:Number(node.dataset.textilePanelCount)}))
  assert.ok(shader.total>=4,'T-shirt needs four distinct rendered cloth panels')
  assert.equal(shader.mapped,shader.total,'Every 3D panel must have an actual textile normal and roughness map')

  const trigger=page.getByRole('button',{name:'Object Browser category list'})
  assert.ok(await trigger.isVisible())
  await trigger.click()
  assert.equal(await trigger.getAttribute('aria-expanded'),'true')
  assert.equal(await page.locator('.clo-object-hierarchy-group').count(),5)
  for(const name of ['2D Pattern','Sewing','3D Form','Material','Environment']) {
    assert.equal(await page.locator('.clo-object-hierarchy-group > button').filter({hasText:name}).count(),1)
  }
  await page.locator('.clo-object-hierarchy-group > button').filter({hasText:'Material'}).click()
  await page.getByRole('button',{name:'Fabric Editor',exact:true}).last().click()
  assert.equal(await trigger.getAttribute('aria-expanded'),'false','Selecting an object category should dismiss the menu')
  assert.equal(await page.locator('.clo-inspector .inspector-head strong').innerText(),'FABRIC')
  assert.deepEqual(pageErrors,[])
  await page.screenshot({path:'qa-tee-realism-object-menu-20261013.png'})
  console.log(JSON.stringify({pass:true,bodySilhouette:true,chestAndStomachGuides:true,selectedPointRadius:points[0].r,textileShaderMaps:shader,objectCategories:5,nestedNavigation:true,screenshot:'qa-tee-realism-object-menu-20261013.png'},null,2))
} finally { await browser.close() }
