/**
 * Tests the BUILT-IN static UI of the running EXO ClothCraft Studio V2.app.
 * Runs headlessly. It does not launch a visible browser, replace the app, or
 * write to the live Rust garment's material/geometry state.
 */
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {chromium} from 'playwright-core'

const app=path.join(os.homedir(),'Applications/EXO ClothCraft Studio V2.app')
const web=path.join(app,'Contents/Resources/web/index.html')
assert(fs.existsSync(web),'Native V2 app has no packaged UI')
assert(fs.readFileSync(web,'utf8').includes('/assets/index-'),'Native V2 app manifest missing')
execFileSync('codesign',['--verify','--deep','--strict',app],{stdio:'pipe'})
const services=await Promise.all([
  fetch('http://127.0.0.1:5386/',{signal:AbortSignal.timeout(2500)}),
  fetch('http://127.0.0.1:5385/health',{signal:AbortSignal.timeout(2500)}),
])
assert(services.every(x=>x.ok),'Native V2 bundled local services must be running')
assert.equal(await services[0].text(),fs.readFileSync(web,'utf8'),
  'Running native static service must serve current installed bundle')
const backend=await services[1].json()
assert(backend.ok && backend.nativeReady && backend.rustCheckoutReady)

const browser=await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--disable-gpu'],
})
try {
  const page=await browser.newPage({viewport:{width:1640,height:1030}})
  const pageErrors=[]
  page.on('pageerror',error=>pageErrors.push(error.message))
  await page.goto('http://127.0.0.1:5386/?desktop=1&engine=clothcraft',
    {waitUntil:'domcontentloaded',timeout:30000})
  const rail=page.locator('.tool-rail')
  const right=page.locator('.clo-right-tool-palette')
  await rail.getByRole('button',{name:'Show complete CLO 3D reference map'}).waitFor()
  await right.getByRole('button',{name:'Show complete CLO 2D reference map'}).waitFor()
  const col3a=rail.locator('[aria-label="3D editing column A"]')
  const col3b=rail.locator('[aria-label="3D garment column B"]')
  const col2a=right.locator('[aria-label="CLO 2D column A"]')
  const col2b=right.locator('[aria-label="CLO 2D column B"]')
  const c3a=await col3a.locator('button[data-clo-slot]').count()
  const c3b=await col3b.locator('button[data-clo-slot]').count()
  const c2a=await col2a.locator('button[data-clo-slot]').count()
  const c2b=await col2b.locator('button[data-clo-slot]').count()
  for(const n of [c3a,c3b,c2a,c2b])assert(n>=2 && n<=12,
    'Daily native toolbar must show working tools, not dozens of disabled placeholders')
  assert.equal(await page.locator('[data-clo-slot]:disabled').count(),0,
    'Daily native app should show no disabled CLO placeholder icons')
  assert.equal(await right.locator('[aria-label="Additional EXO tools not assigned to the CLO 7 2D reference strips"]').count(),0,
    'EXO extras should be collapsed initially')
  const imgs=await page.locator('.tool-rail img.cad-tool-icon, .clo-right-tool-palette img.cad-tool-icon').evaluateAll(
    nodes=>nodes.map(node=>({id:node.dataset.iconId,loaded:node.complete&&node.naturalWidth>0,src:node.getAttribute('src')})))
  assert(imgs.length>10,'Missing toolbar icon set')
  assert(imgs.every(x=>x.loaded),'Missing toolbar vector assets: '+JSON.stringify(imgs.filter(x=>!x.loaded)))

  const board=page.locator('.cc-board').first()
  await board.locator('[data-panel="front"]').waitFor({timeout:30000})
  const front=board.locator('[data-panel="front"]').first()
  // A persisted workspace may start in Move 3D. Explicitly activate the
  // 2D selection tool before asserting its move marquee.
  await col2a.getByRole('button',{name:'Select/Transform Pattern'}).click()
  const fillBefore=await front.getAttribute('fill')
  await front.click()
  // SVG lines with x1 === x2 have no horizontal bounding-box area, so
  // Playwright's generic "visible" predicate may call the stroked line
  // hidden despite it having an actual rendered stroke and nonzero length.
  await page.waitForFunction(() => !!document.querySelector('.cc-board [data-measure-guide="center-front"]'),
    undefined,{timeout:7000})
  const line=board.locator('[data-measure-guide="center-front"]')
  const endpoints=await line.evaluate(el=>({
    x1:Number(el.getAttribute('x1')),x2:Number(el.getAttribute('x2')),
    y1:Number(el.getAttribute('y1')),y2:Number(el.getAttribute('y2')),
  }))
  assert(Math.hypot(endpoints.x2-endpoints.x1,endpoints.y2-endpoints.y1)>.15,
    'Front center line should be a genuine vertically extended guide')
  assert.equal(await board.locator('[data-measure-guide="chest"]').count(),1)
  assert.equal(await board.locator('[data-measure-guide="belly"]').count(),1)
  assert.equal(await front.getAttribute('fill'),fillBefore)
  const marquee=board.locator('[data-2d-marquee="front"]')
  await marquee.waitFor()
  await page.screenshot({path:path.join(process.cwd(),'screenshots/exo-installed-v2-centerfront-qa.png')})

  // Right toolbar controls must switch the same real V2 2D editor as the
  // internal corner widget. No shape or measurement edits are performed.
  await col2a.getByRole('button',{name:'Edit Pattern Points/Segments'}).click()
  assert.equal(await marquee.count(),0,'Point tool must hide 2D move marquee')
  await col2a.getByRole('button',{name:'Select/Transform Pattern'}).click()
  await marquee.waitFor()
  assert.equal(await front.getAttribute('fill'),fillBefore)
  assert.deepEqual(pageErrors,[])

  console.log(JSON.stringify({passed:true,installedNativeApp:app,backend:'ready',
    defaultVisible:{left3D_A:c3a,left3D_B:c3b,right2D_A:c2a,right2D_B:c2b},
    vectorIconsLoaded:imgs.length,centerFront:true,chest:true,belly:true,
    V2SelectPointLink:true,whiteFabricPreserved:true,scriptErrors:pageErrors.length},null,2))
} finally {await browser.close()}
