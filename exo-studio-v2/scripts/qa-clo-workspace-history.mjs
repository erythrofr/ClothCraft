import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
const context=await browser.newContext({viewport:{width:1520,height:920},deviceScaleFactor:1})
const page=await context.newPage()
const errors=[]
page.on('pageerror',error=>errors.push(error.message))
try {
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee',{waitUntil:'domcontentloaded'})
  await page.waitForFunction(()=>Boolean(localStorage.getItem('garment-studio-tee-first-fit-project-v2')),null,{timeout:15000})
  const snapshot=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')))
  const initial=await snapshot()
  const addPattern=async()=>{
    await page.locator('.clo-menu-group').filter({has:page.getByRole('button',{name:'2D Pattern',exact:true})}).getByRole('button',{name:'2D Pattern',exact:true}).click()
    await page.getByRole('menuitem',{name:'Add pattern'}).click()
    await page.waitForTimeout(700)
  }
  await addPattern()
  const afterOne=await snapshot()
  assert.equal(afterOne.pieces.length,initial.pieces.length+1)
  await addPattern()
  const afterTwo=await snapshot()
  assert.equal(afterTwo.pieces.length,initial.pieces.length+2)

  await page.getByRole('button',{name:'HISTORY',exact:true}).click()
  const timeline=page.getByRole('list',{name:'Recent garment history'})
  assert(await timeline.isVisible())
  assert.equal(await timeline.locator('[data-undo-index]').count(),2)
  await timeline.locator('[data-undo-index="0"]').click()
  await page.waitForTimeout(700)
  const restored=await snapshot()
  assert.deepEqual(restored.pieces,initial.pieces)
  assert.deepEqual(restored.seams,initial.seams)
  assert.deepEqual(restored.fabrics,initial.fabrics)
  assert.equal(restored.revision,initial.revision)
  assert.equal(await page.locator('.clo-history-actions button').last().locator('span').innerText(),'2')

  await page.locator('.clo-history-actions button').last().click()
  await page.waitForTimeout(700)
  assert.deepEqual((await snapshot()).pieces,afterOne.pieces)
  await page.locator('.clo-history-actions button').last().click()
  await page.waitForTimeout(700)
  assert.deepEqual((await snapshot()).pieces,afterTwo.pieces)
  await page.screenshot({path:'qa-clo-workspace-history-20261015.png'})
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({pass:true,historyStates:2,restoredOriginalRevision:initial.revision,redoReplaysExactFirstAndSecondPattern:true,editorHistoryPreservesSeams:true,browserErrors:0,screenshot:'qa-clo-workspace-history-20261015.png'},null,2))
} finally { await browser.close() }
