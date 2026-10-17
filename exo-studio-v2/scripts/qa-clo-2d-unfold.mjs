// Real UI acceptance: unfold a clean half-pattern without modifying a user's
// CLO/garment document. All changes are in an isolated browser test session.
import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'
import { inspectDraftTopology } from '../src/core/draftingTopology.js'

const browser=await chromium.launch({
  headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
const URL='http://127.0.0.1:5188/?desktop=1&testSession=tee'
const KEY='garment-studio-tee-first-fit-project-v2'
try{
  const page=await browser.newPage({viewport:{width:1800,height:1120}})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(URL,{waitUntil:'domcontentloaded'})
  await page.locator('svg.pattern-canvas').waitFor({state:'visible',timeout:15000})
  await page.locator('svg.pattern-canvas').focus()
  await page.locator('svg.pattern-canvas').press('ArrowRight')
  await page.waitForTimeout(650)
  const source=await page.evaluate(key=>{
    const p=JSON.parse(localStorage.getItem(key))
    const front=p.pieces.find(piece=>piece.id==='front')
    const fixture={...front,id:'unfold-fixture',name:'Half test bodice',
      points:[{x:0,y:0},{x:10,y:0},{x:10,y:20},{x:0,y:20}],
      layout2d:{x:270,y:145},curves:{},notches:[],internalLines:[],
      edgeSeamAllowances:{},pins:[],buttons:[],buttonholes:[],graphics:[],
      topstitches:[],bindings:[],zippers:[],
      linkedMirrorSourceId:undefined,locked:false}
    p.pieces.push(fixture)
    localStorage.setItem(key,JSON.stringify(p))
    return p
  },KEY)
  await page.reload({waitUntil:'domcontentloaded'})
  const own=page.locator('.pattern-piece[data-piece-id="unfold-fixture"]')
  await own.waitFor({state:'visible',timeout:16000})
  await page.getByRole('button',{name:'Edit Pattern Points',exact:true}).first().click()
  await own.locator('.edge-hit').nth(3).dispatchEvent('pointerdown',{
    button:0,pointerId:74,isPrimary:true,
  })
  const dock=page.locator('#clo-pattern-properties-host')
  const unfold=dock.getByRole('button',{name:'Unfold half-pattern across this straight edge'})
  assert.ok(await unfold.isVisible())
  assert.ok(await unfold.isEnabled())
  await unfold.click()
  await page.waitForTimeout(850)
  const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY)
  const edited=state.pieces.find(piece=>piece.id==='unfold-fixture')
  if(edited.points.length!==6) console.log('UNFOLD_DIAGNOSTIC',JSON.stringify({
    alerts:await page.getByRole('alert').allInnerTexts(),
    message:await page.locator('.command-result').allInnerTexts(),
    edge:await dock.locator('.draft-edge-inspector').allInnerTexts(),
    trackedId:edited.id,locked:edited.locked, mirror:edited.linkedMirrorSourceId,
  }).slice(0,1700))
  assert.equal(edited.points.length,6,'Unfold must generate a single closed 6-vertex cutline')
  assert.ok(inspectDraftTopology(edited).valid,'Unfolded garment needs valid cut topology')
  assert.ok(Math.abs(inspectDraftTopology(edited).areaCm2-400)<.01,
    'A 10×20 cm half rectangle becomes a single 20×20 cm pattern')
  assert.deepEqual(state.seams,source.seams,'Unrelated sewing graph unchanged')
  assert.equal(state.pieces.length,source.pieces.length)
  assert.ok(!(await page.locator('.pattern-editor-shell .draft-edge-inspector').count()),
    'No modal or floating property overlay in the 2D canvas')
  await page.getByTitle('Undo',{exact:true}).click()
  await page.waitForTimeout(850)
  const undone=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY)
  assert.equal(undone.pieces.find(piece=>piece.id==='unfold-fixture').points.length,4,
    'One Undo must restore the original half pattern geometry')
  assert.deepEqual(undone.seams,source.seams)
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({
    pass:true,areaBeforeCm2:200,areaAfterCm2:400,
    validCutline:true,stablePieceIdentity:true,allSewingPreserved:true,
    singleUndo:true,noCanvasPopup:true,browserErrors:0,
  }))
}finally{await browser.close()}
