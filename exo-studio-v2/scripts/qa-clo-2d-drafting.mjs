import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try {
  const page=await browser.newPage({viewport:{width:1650,height:1000}})
  const pageErrors=[]
  page.on('pageerror',e=>pageErrors.push(e.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee',{waitUntil:'domcontentloaded'})
  await page.waitForTimeout(1000)
  const svg=page.locator('svg.pattern-canvas')
  const source=await svg.evaluate(el=>({view:el.getAttribute('viewBox'), background:getComputedStyle(el).backgroundColor}))
  assert.ok(source.background==='rgb(198, 199, 201)' || source.background==='rgb(197, 198, 200)',`Unexpected neutral drafting background: ${source.background}`)
  assert.equal(await page.locator('.draft-avatar-render').count(),0,'Facial image must not be drawn in 2D silhouette')
  assert.equal(await page.locator('.draft-avatar-contour').count(),1)
  assert.equal(await page.locator('.pattern-canvas [data-grid-coverage="overscanned"]').count(),1)
  await svg.hover()
  const before=Number((await svg.getAttribute('viewBox')).split(' ')[2])
  for(let i=0;i<30;i++)await page.mouse.wheel(0,-500)
  const after=Number((await svg.getAttribute('viewBox')).split(' ')[2])
  assert.ok(after<25,`Must zoom closer than the old 25-unit limit, got ${after}`)
  const coverage=await svg.evaluate(el=>{
    const v=el.getAttribute('viewBox').split(' ').map(Number)
    const grid=el.querySelector('[data-grid-coverage="overscanned"]')
    const [x,y,w,h]=v
    return {covers:grid.x.baseVal.value<=x&&grid.y.baseVal.value<=y&&grid.x.baseVal.value+grid.width.baseVal.value>=x+w&&grid.y.baseVal.value+grid.height.baseVal.value>=y+h}
  })
  assert.ok(coverage.covers,'Grid must cover entire zoomed SVG viewport')
  await svg.focus()
  await page.keyboard.press('f')
  await page.locator('.pattern-piece[data-piece-id="front"] .pattern-fill').evaluate(el=>{
    const r=el.getBoundingClientRect()
    const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:r.left+r.width/2,clientY:r.top+r.height/2})
    if(el.dispatchEvent(event)) throw new Error('Context menu must be blocked in drafting workspace')
  })
  assert.equal(await page.locator('.clo-pattern-context-menu').count(),0,'No context menu should overlay pattern when dragging')
  await page.screenshot({path:'qa-clo-2d-drafting-20261013.png'})
  assert.deepEqual(pageErrors,[])
  console.log(JSON.stringify({pass:true,neutralBackground:source.background,faceFreeSilhouette:true,deepZoomWidth:after,overscannedGrid:true,contextMenuSuppressed:true},null,2))
}finally{await browser.close()}
