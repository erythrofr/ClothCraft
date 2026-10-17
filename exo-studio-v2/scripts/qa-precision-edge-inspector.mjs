import assert from 'node:assert/strict'
import {chromium} from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
  const page=await browser.newPage({viewport:{width:1650,height:1000}})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee',{waitUntil:'domcontentloaded'})
  await page.waitForTimeout(1100)
  // Select / Transform must drag edges without opening a measurement editor.
  // Explicit point/curve editing tools retain precision edge selection.
  await page.getByRole('button',{name:'Edit Pattern Points',exact:true}).first().click()
  const front=page.locator('.pattern-piece[data-piece-id="front"]')
  const selectEdge=front.locator('.edge-hit').first()
  await selectEdge.dispatchEvent('pointerdown',{button:0,pointerId:20,isPrimary:true})
  const inspector=page.getByRole('region',{name:'Selected 2D pattern edge inspector'})
  assert.ok(await inspector.isVisible(),'Selecting real 2D edge must open numeric editor')
  assert.ok((await inspector.innerText()).includes('Edge 1'))
  const input=inspector.getByRole('spinbutton',{name:'Selected edge seam allowance in cm'})
  await input.fill('1.37')
  await inspector.getByRole('button',{name:'Apply'}).click()
  assert.match(await inspector.innerText(),/Active allowance 1\.37 cm/)
  let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')||'null'))
  await page.waitForTimeout(1100)
  state=await page.evaluate(()=>JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2')||'null'))
  const piece=state?.pieces?.find(p=>p.id==='front')
  assert.equal(piece?.edgeSeamAllowances?.[0],1.37,'Numeric edit must persist to original garment project')
  assert.ok((await front.locator('.pattern-edge.draft-selected-edge').count())===1)
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({pass:true,selectedEdge:'front:0',allowance:1.37,savedProject:true,uiErrors:0},null,2))
}finally{await browser.close()}
