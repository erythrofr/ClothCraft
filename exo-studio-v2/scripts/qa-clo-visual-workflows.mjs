import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Fresh isolated browser state protects the user's open garment and library.
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'] })
try {
  const page = await browser.newPage({ viewport:{ width:1750, height:1050 }, deviceScaleFactor:1 })
  const errors=[]
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee',{waitUntil:'domcontentloaded'})
  await page.waitForTimeout(850)
  const state=() => page.evaluate(() => JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')))

  const navigator=page.locator('.clo-property-category-nav')
  assert.equal(await navigator.locator('.clo-property-category-group').count(),5)
  for(const category of ['2D Pattern','Sewing','3D Form','Material','Environment']) {
    assert.equal(await navigator.getByRole('button',{name:category,exact:true}).count(),1,`Missing ${category} category`)
  }
  await navigator.getByRole('button',{name:'Material',exact:true}).click()
  await navigator.getByRole('button',{name:'Fabric Editor',exact:true}).click()
  assert.equal(await page.locator('.clo-inspector .inspector-head strong').innerText(),'FABRIC')

  await page.getByRole('button',{name:'Browse fabrics'}).click()
  const before=await state()
  const firstPreset=page.locator('.garment-tile[title^="Create "]').first()
  assert.ok(await firstPreset.count(),'Fabric preset gallery missing create/apply action')
  await firstPreset.click()
  await page.waitForTimeout(720)
  const after=await state()
  assert.ok(Object.keys(after.fabrics).length > Object.keys(before.fabrics).length,'Fabric click should add new material')
  assert.notEqual(after.pieces.find(piece=>piece.id==='front').fabricId,before.pieces.find(piece=>piece.id==='front').fabricId,'Fabric click should assign selected piece')
  assert.equal(after.pieces.find(piece=>piece.id==='back').fabricId,before.pieces.find(piece=>piece.id==='back').fabricId,'Fabric click should not silently overwrite other garment pieces')
  await page.getByRole('button',{name:'APPLY TO ALL GARMENT PIECES'}).click()
  await page.waitForTimeout(720)
  const all=await state()
  assert.equal(new Set(all.pieces.map(piece=>piece.fabricId)).size,1,'Apply all must assign every sewn panel')

  await page.getByRole('button',{name:'Patterns',exact:true}).click()
  assert.ok(await page.locator('.clo-pattern-library-preview').count()>=4,'Pattern assets need actual 2D pattern-piece miniatures')
  await page.getByRole('button',{name:'Stage',exact:true}).click()
  assert.equal(await page.locator('.clo-stage-option').count(),4)
  await page.getByRole('button',{name:'Dramatic Contrast'}).click()
  await page.waitForTimeout(720)
  assert.equal((await state()).render.environmentPreset,'dramatic','Stage library must change live render setting')

  await page.screenshot({path:'qa-clo-visual-workflows-20261013.png'})
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,properties:5,patternThumbnails:true,fabricAssignedToSelected:true,applyAll:true,stageChangesRender:true,screenshot:'qa-clo-visual-workflows-20261013.png'},null,2))
} finally { await browser.close() }
