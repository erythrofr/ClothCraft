import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const appUrl='http://127.0.0.1:5188/?desktop=1&testSession=tee'
const browser=await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
let page
try {
  page=await browser.newPage({viewport:{width:1650,height:1000}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(appUrl,{waitUntil:'domcontentloaded'})
  await page.locator('.pattern-piece[data-piece-id="front"]').waitFor({state:'visible',timeout:18000})
  await page.waitForFunction(()=>Boolean(localStorage.getItem('garment-studio-tee-first-fit-project-v2')),{timeout:18000})
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')||'null'))
  const initial=await read()
  const geometry=JSON.stringify({pieces:initial.pieces,seams:initial.seams})
  const selector=page.getByRole('combobox',{name:'CLO-style workspace layout presets'})

  await selector.selectOption('materials')
  assert.ok(await page.getByRole('region',{name:'Object Browser'}).isVisible())
  assert.ok(await page.getByText('Fiber anisotropy',{exact:true}).count()>0)
  assert.equal((await read()).name,initial.name)
  const canvas=page.locator('.three-mount canvas').first()
  await page.waitForFunction(()=>Number(document.querySelector('.three-mount canvas')?.dataset.simulationSessionBuilds||0)>0,{timeout:15000})
  await page.waitForTimeout(800)
  const sessionsBefore=Number(await canvas.getAttribute('data-simulation-session-builds'))

  const material=page.locator('.slider-row').filter({hasText:'Fiber anisotropy'}).locator('input[type="range"]')
  await material.focus()
  await material.press('ArrowRight')
  await page.waitForTimeout(850)
  const adjusted=await read()
  assert.ok(Number(adjusted.fabrics.main.fiberAnisotropy)>Number(initial.fabrics.main.fiberAnisotropy??0),
    'Fiber anisotropy slider must modify the saved fabric and viewport material')
  const sessionsAfter=Number(await canvas.getAttribute('data-simulation-session-builds'))
  assert.equal(sessionsAfter,sessionsBefore,'Changing fabric optics must not rebuild the physics simulation')
  const normalStrength=page.locator('.slider-row').filter({hasText:'Normal strength'}).locator('input[type="range"]')
  await normalStrength.focus()
  await normalStrength.press('ArrowRight')
  await page.waitForTimeout(350)
  assert.equal(Number(await canvas.getAttribute('data-simulation-session-builds')),sessionsBefore)

  await selector.selectOption('save')
  assert.ok(await page.evaluate(()=>Boolean(localStorage.getItem('garment-studio-workspace-profile-v1'))))
  await selector.selectOption('render')
  assert.ok(await page.getByRole('button',{name:'RENDER PNG STILL'}).isVisible())
  await selector.selectOption('restore')
  assert.ok(await page.getByText('Fiber anisotropy',{exact:true}).count()>0,'Saved fabric workspace should restore')

  await selector.selectOption('drafting')
  const input=page.locator('input[type="file"][accept=".smis,.smms"]')
  await input.setInputFiles('research/oss/Seamly2D/src/app/share/samples/measurements/individual/male_shirt.smis')
  await page.getByRole('button',{name:/APPLY MEASURED BODY VALUES TO AVATAR/}).waitFor({state:'visible',timeout:10000})
  await page.waitForTimeout(850)
  const imported=await read()
  assert.equal(imported.measurementLibrary.seamly.measurementCount,9)
  assert.deepEqual(JSON.stringify({pieces:imported.pieces,seams:imported.seams}),geometry,
    'Importing Seamly measurement files must not alter manufactured pattern geometry or sewing')
  assert.deepEqual(imported.avatar,initial.avatar,
    'Measurement import must not silently change the current avatar')
  await page.getByRole('button',{name:/APPLY MEASURED BODY VALUES TO AVATAR/}).click()
  await page.waitForTimeout(850)
  const applied=await read()
  assert.equal(applied.avatar.heightCm,173)
  assert.equal(applied.avatar.chestCm,102)
  assert.equal(JSON.stringify({pieces:applied.pieces,seams:applied.seams}),geometry)
  await page.getByTitle('Undo',{exact:true}).click()
  await page.waitForTimeout(850)
  assert.equal((await read()).avatar.heightCm,initial.avatar.heightCm)

  // Full Seamly2D construction references are loaded without pretending that
  // complex formulas, spline paths or graded cut details are already solved.
  await page.locator('input[type="file"][accept=".sm2d"]').setInputFiles(
    'research/oss/Seamly2D/src/app/share/samples/patterns/male_shirt.sm2d')
  await page.getByLabel('Imported Seamly2D construction reference').waitFor({state:'visible',timeout:10000})
  await page.waitForTimeout(850)
  const referenced=await read()
  assert.equal(referenced.seamlyConstructionReference.toolCount,188)
  assert.equal(referenced.seamlyConstructionReference.incrementCount,53)
  assert.equal(referenced.seamlyConstructionReference.blocks.length,5)
  assert.equal(JSON.stringify({pieces:referenced.pieces,seams:referenced.seams}),geometry)

  assert.deepEqual(errors,[],'Workspace, rendering settings and measurement import should not throw browser errors')
  console.log(JSON.stringify({
    pass:true,layoutModes:['materials','render','drafting'],
    customLayoutSavedAndRestored:true,materialAnisotropySaved:true,
    clothSessionPreservedDuringOpticalEditing:true,
    seamlyImported:9,seamlyConstructionGraphTools:188,
    avatarAppliedAndUndo:true,patternAndSewingPreserved:true,
    pageErrors:errors.length,
  }))
} finally {
  await browser.close()
}
