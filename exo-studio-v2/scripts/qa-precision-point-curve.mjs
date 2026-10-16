import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Run against the existing local development server. All edits are isolated to
// a new browser context's testSession=tee, never to a user garment document.
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-4,`${a} differs from ${b}`)
try {
  const page = await browser.newPage({viewport:{width:1650,height:1000}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee',{waitUntil:'domcontentloaded'})
  await page.locator('.pattern-piece[data-piece-id="front"]').waitFor({state:'visible',timeout:15000})
  await page.waitForFunction(()=>!!localStorage.getItem('garment-studio-tee-first-fit-project-v2'),{timeout:15000})
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')||'null'))
  const front=page.locator('.pattern-piece[data-piece-id="front"]')
  const original=(await read()).pieces.find(p=>p.id==='front')
  assert.ok(original)

  await page.getByRole('button',{name:'Edit Pattern Points',exact:true}).first().click()
  await front.locator('.pattern-node').first().click({force:true})
  const pointEditor=page.getByRole('region',{name:'Precision point editor'})
  assert.ok(await pointEditor.isVisible(),'Point editor must open on a real point click')
  const xField=pointEditor.getByRole('spinbutton',{name:'Point X coordinate in centimeters'})
  const changedX=original.points[0].x+.125
  await xField.fill(changedX.toFixed(4))
  await pointEditor.getByRole('button',{name:'Apply precision edit'}).click()
  await page.waitForTimeout(850)
  near((await read()).pieces.find(p=>p.id==='front').points[0].x,changedX)

  await page.getByTitle('Undo',{exact:true}).click()
  await page.waitForTimeout(850)
  near((await read()).pieces.find(p=>p.id==='front').points[0].x,original.points[0].x)
  await page.getByTitle('Redo',{exact:true}).click()
  await page.waitForTimeout(850)
  near((await read()).pieces.find(p=>p.id==='front').points[0].x,changedX)

  await page.getByRole('button',{name:'Edit Curves',exact:true}).first().click()
  await front.locator('.curve-control circle').first().click({force:true})
  const curveEditor=page.getByRole('region',{name:'Precision curve editor'})
  assert.ok(await curveEditor.isVisible(),'Curve editor must open on a real curve-handle click')
  await curveEditor.getByRole('spinbutton',{name:'Curve handle along chord in centimeters'}).fill('0.2500')
  await curveEditor.getByRole('spinbutton',{name:'Curve perpendicular depth in centimeters'}).fill('1.7500')
  await curveEditor.getByRole('button',{name:'Apply curve edit'}).click()
  await page.waitForTimeout(850)
  let state=(await read()).pieces.find(p=>p.id==='front')
  assert.ok(Number.isFinite(state.curves?.[0]?.cx) && Number.isFinite(state.curves?.[0]?.cy))
  assert.match(await curveEditor.innerText(),/Curved/)
  const curved={...state.curves[0]}

  await curveEditor.getByRole('button',{name:'Control X/Y'}).click()
  const controlX=curved.cx+.125
  await curveEditor.getByRole('spinbutton',{name:'Curve control X in centimeters'}).fill(controlX.toFixed(4))
  await curveEditor.getByRole('button',{name:'Apply curve edit'}).click()
  await page.waitForTimeout(850)
  state=(await read()).pieces.find(p=>p.id==='front')
  near(state.curves[0].cx,controlX)

  await curveEditor.getByRole('button',{name:'Convert to straight edge'}).click()
  await page.waitForTimeout(850)
  state=(await read()).pieces.find(p=>p.id==='front')
  assert.equal(state.curves?.[0],undefined,'Straighten must delete only the selected quadratic control')
  await page.getByTitle('Undo',{exact:true}).click()
  await page.waitForTimeout(850)
  state=(await read()).pieces.find(p=>p.id==='front')
  near(state.curves[0].cx,controlX)

  assert.deepEqual(errors,[],'Precision controls must not generate browser errors')
  console.log(JSON.stringify({pass:true,pointXYUndoRedo:true,curveChordAndAbsolute:true,curveStraightenUndo:true,projectPersisted:true,errors},null,2))
} finally { await browser.close() }
