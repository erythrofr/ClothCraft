// Read-only checks against the user's installed Studio V2 app. Clicks here
// only change toolbar mode and open non-editing details; no project mutations.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { CLO7_3D_A,CLO7_3D_B,CLO7_2D_A,CLO7_2D_B } from '../src/data/clo7ToolbarOrder.js'

const url=process.env.EXO_TOOLBAR_QA_URL||'http://127.0.0.1:5386/?desktop=1&engine=clothcraft'
const groups={
  leftA:['.tool-rail [aria-label="3D editing column A"]',CLO7_3D_A,'3d:'],
  leftB:['.tool-rail [aria-label="3D garment column B"]',CLO7_3D_B,'3d:'],
  rightA:['.clo-right-tool-palette [aria-label="CLO 2D column A"]',CLO7_2D_A,'2d:'],
  rightB:['.clo-right-tool-palette [aria-label="CLO 2D column B"]',CLO7_2D_B,'2d:'],
}
const browser=await chromium.launch({headless:true,executablePath:process.env.EXO_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
const results=[]
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:width===390?844:900}})
    const exceptions=[]
    page.on('pageerror',e=>exceptions.push(e.message))
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
    await page.locator('.tool-rail').waitFor({timeout:20000})
    const found={}
    for(const [name,[selector,reference,prefix]] of Object.entries(groups)){
      const slots=await page.locator(`${selector} > [data-clo-slot]`).evaluateAll(buttons=>buttons.map(b=>({id:b.dataset.cloSlot,label:b.getAttribute('aria-label')})))
      assert.deepEqual(slots.map(x=>x.id),reference.map(x=>prefix+x.id),`${width}px ${name} mismatched CLO order`)
      assert.deepEqual(slots.map(x=>x.label),reference.map(x=>x.label),`${width}px ${name} labels mismatched`)
      found[name]=slots.length
    }
    const x=await Promise.all(Object.values(groups).map(async([selector])=>page.locator(selector).evaluate(el=>el.getBoundingClientRect().x)))
    assert(x[0]<x[1]&&x[1]<x[2]&&x[2]<x[3],'Physical A/B/A/B column order is wrong')

    await page.locator('[data-clo-slot="3d:B13"]').click()
    const help=page.locator('[data-clo-detail="3d:B13"]')
    await help.waitFor({state:'visible',timeout:12000})
    assert.match(await help.innerText(),/Requires additional native implementation/i)
    assert.equal(await help.getByRole('button',{name:/Run Zipper/i}).count(),0,'Unavailable zipper must not claim to execute')
    await help.getByRole('button',{name:'Close tool information'}).click()

    await page.getByRole('button',{name:'Show working CLO 3D tools only'}).click()
    assert((await page.locator('.tool-rail [data-clo-slot]').count())<38,'WORK ONLY filter should be smaller')
    await page.getByRole('button',{name:'Show all CLO 3D tools in reference order'}).click()
    assert.equal(await page.locator('.tool-rail [data-clo-slot]').count(),38)
    await page.getByRole('button',{name:'Show working CLO 2D tools only'}).click()
    assert((await page.locator('.clo-right-tool-palette [data-clo-slot]').count())<32)
    await page.getByRole('button',{name:'Show all CLO 2D tools in reference order'}).click()
    assert.equal(await page.locator('.clo-right-tool-palette [data-clo-slot]').count(),32)
    assert.deepEqual(exceptions,[],`${width}px page exception`)
    results.push({width,columns:found,unavailableHelp:true,filterAndRestore:true,exceptions:exceptions.length})
    await page.close()
  }
  console.log(JSON.stringify({pass:true,results},null,2))
}finally{await browser.close()}
