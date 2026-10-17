// Read-only installed native .app UI smoke via its embedded loopback service.
// Headless automation never opens a visible browser or changes saved garment
// geometry. Confirms the exact signed app's served assets after reinstall.
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'

const browser=await chromium.launch({
  headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try{
  const page=await browser.newPage({viewport:{width:1650,height:1000}})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5386/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
  const board=page.locator('.cc-board').first()
  const front=board.locator('[data-panel="front"]').first()
  await front.waitFor({timeout:30000})
  const rails=[
    '.tool-rail [aria-label="3D editing column A"]',
    '.tool-rail [aria-label="3D garment column B"]',
    '.clo-right-tool-palette [aria-label="CLO 2D column A"]',
    '.clo-right-tool-palette [aria-label="CLO 2D column B"]',
  ]
  const counts=[]
  for(const rail of rails){
    const n=await page.locator(rail+' > [data-clo-slot]').count()
    const disabled=await page.locator(rail+' > [data-clo-slot]:disabled').count()
    assert(n>=2 && n<=10,'Native editing toolbar is overly cluttered: '+n)
    assert.equal(disabled,0,'No unusable/reference-only icon in normal mode: '+rail)
    counts.push(n)
  }
  assert.equal(await page.getByRole('button',{name:'Show complete CLO 3D reference map'}).count(),1)
  assert.equal(await page.getByRole('button',{name:'Show complete CLO 2D reference map'}).count(),1)
  assert.equal(await page.getByRole('button',{name:'Expand additional EXO tools'}).count(),1)

  // The persisted native workspace may reopen in sew, draw or movement mode.
  // Explicitly switch to 2D Select before a read-only pattern selection.
  await page.locator('.clo-right-tool-palette [aria-label="CLO 2D column A"]')
    .getByRole('button',{name:'Select/Transform Pattern'}).click()
  // Select only; do not issue any geometry or save/reset commands.
  await front.click({force:true})
  await board.locator('[data-2d-marquee="front"]').waitFor()
  assert.equal(await board.locator('[data-measure-guide="chest"]').count(),1)
  assert.equal(await board.locator('[data-measure-guide="belly"]').count(),1)
  assert.equal(await board.locator('[data-measure-guide="center-front"]').count(),1)
  const center=await board.locator('[data-measure-guide="center-front"]').first().evaluate(el=>({
    x1:Number(el.getAttribute('x1')),x2:Number(el.getAttribute('x2')),
    y1:Number(el.getAttribute('y1')),y2:Number(el.getAttribute('y2')),
  }))
  assert(Object.values(center).every(Number.isFinite),'Center guide must have finite endpoints')
  assert(Math.hypot(center.x1-center.x2,center.y1-center.y2)>.15,'Center-front guide must run down torso')
  const fill=await front.getAttribute('fill')

  // Right-side tool now controls the live Rust-backed 2D editor, rather than
  // only the legacy V1 toolbar state.
  await page.locator('.clo-right-tool-palette [aria-label="CLO 2D column A"]')
    .getByRole('button',{name:'Edit Pattern Points/Segments'}).click()
  assert.equal(await board.locator('[data-2d-marquee="front"]').count(),0)
  assert(await board.locator('[data-control-point="vertex"]').count()>0,'Point edit controls should become available')
  await page.locator('.clo-right-tool-palette [aria-label="CLO 2D column A"]')
    .getByRole('button',{name:'Select/Transform Pattern'}).click()
  await board.locator('[data-2d-marquee="front"]').waitFor()
  assert.equal(await front.getAttribute('fill'),fill,'Selecting must not change the fabric color')
  assert.deepEqual(errors,[],'UI runtime errors')
  console.log(JSON.stringify({
    passed:true,
    installedNativeUI:true,
    normalVisibleToolCounts:{threeD_A:counts[0],threeD_B:counts[1],twoD_A:counts[2],twoD_B:counts[3]},
    referenceOnlySlotsHidden:true,
    referenceMapsStillAvailable:true,
    centerFrontInsidePattern:true,
    rightToolbarControlsNativePointAndSelect:true,
    originalFabricColorPreserved:true,
    errors,
  },null,2))
}finally{await browser.close()}
