import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try {
  const page=await browser.newPage({viewport:{width:1760,height:1050}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee',{waitUntil:'domcontentloaded'})
  const navigator=page.locator('.clo-property-category-nav')
  await navigator.getByRole('button',{name:'3D Form',exact:true}).click()
  await navigator.getByRole('button',{name:'Drape / Fitting'}).click()
  await page.locator('.clo-inspector .panel-title').filter({hasText:'Native XPBD'}).waitFor()
  await page.locator('.clo-property-panel select').filter({has:page.locator('option[value="quality"]')}).selectOption('quality')
  await page.getByRole('button',{name:'SOLVE NATIVE XPBD · 60 FRAMES'}).click()
  await page.getByText('NATIVE PHYSICAL FIT: FAILED',{exact:false}).waitFor({timeout:25000})
  const categories=page.getByText('INITIAL ASSEMBLY REQUIRES REPAIR:',{exact:false})
  await categories.waitFor()
  const preflight=await categories.innerText()
  assert.ok(/188\.\d mm apart/.test(preflight),`Missing measured initial seam gap: ${preflight}`)
  assert.ok(preflight.includes('seam-shoulder-l'), 'Expected measured shoulder seam group')
  assert.ok(await page.getByText('FIT FAILED',{exact:true}).count()>=1,'Unsafe fit must not display SOLVED')
  assert.ok(await page.getByText('Trajectory peak strain',{exact:false}).count()>=1)
  assert.deepEqual(errors,[],'No uncaught render errors expected')
  await page.screenshot({path:'qa-native-fit-diagnostics-20261013.png'})
  console.log(JSON.stringify({pass:true,nativeSolveTriggered:true,liveNativeService:true,initialAssemblyWarning:preflight,fitStatus:'FAILED',screenshot:'qa-native-fit-diagnostics-20261013.png'},null,2))
} finally {await browser.close()}
