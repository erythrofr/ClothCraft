// DOM + source-to-display verification for the saved CLO 7.0.242 screenshot
// transcription. No actual CLO proprietary UI assets are copied.
import assert from 'node:assert/strict'
import {mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'
import {CLO7_3D_A,CLO7_3D_B,CLO7_2D_A,CLO7_2D_B} from '../src/data/clo7ToolbarOrder.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const base=process.env.EXO_TOOLBAR_QA_URL||'http://127.0.0.1:5173/?desktop=1'
const expected={A3:CLO7_3D_A.map(x=>'3d:'+x.id),B3:CLO7_3D_B.map(x=>'3d:'+x.id),
  A2:CLO7_2D_A.map(x=>'2d:'+x.id),B2:CLO7_2D_B.map(x=>'2d:'+x.id)}
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const errors=[]
try{
  const page=await browser.newPage({viewport:{width:1800,height:1050}})
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000})
  const selectors={
    A3:'.tool-rail [aria-label="3D editing column A"]',
    B3:'.tool-rail [aria-label="3D garment column B"]',
    A2:'.clo-right-tool-palette [aria-label="CLO 2D column A"]',
    B2:'.clo-right-tool-palette [aria-label="CLO 2D column B"]',
  }
  const defaultVisible={}
  for(const [column,selector] of Object.entries(selectors)){
    await page.locator(selector).waitFor({timeout:18000})
    const actual=await page.locator(selector+' > [data-clo-slot]').evaluateAll(nodes=>nodes.map(node=>node.dataset.cloSlot))
    assert(actual.length > 0 && actual.length < expected[column].length,`${column}: daily toolbar must omit unimplemented reference slots`)
    assert(actual.every((id,index)=>expected[column].indexOf(id)>(index===0?-1:expected[column].indexOf(actual[index-1]))),
      `${column}: compact daily tools must retain screenshot ordering`)
    defaultVisible[column]=actual.length
    assert.equal(await page.locator(selector+' > [data-clo-slot]:disabled').count(),0,
      `${column}: daily toolbar must not show dead or confusing placeholder icons`)
    const x=await page.locator(selector).evaluate(el=>el.getBoundingClientRect().x)
    assert(Number.isFinite(x))
  }
  mkdirSync(path.join(root,'screenshots'),{recursive:true})
  await page.screenshot({path:path.join(root,'screenshots/exo-toolbar-working-default-20261016.png'),fullPage:true})
  // The user may inspect all 70 CLO photo-reference positions on demand, but
  // those incomplete icons must never flood the normal editing workspace.
  await page.getByRole('button',{name:'Show complete CLO 3D reference map'}).click()
  await page.getByRole('button',{name:'Show complete CLO 2D reference map'}).click()
  for(const [column,selector] of Object.entries(selectors)){
    const actual=await page.locator(selector+' > [data-clo-slot]').evaluateAll(nodes=>nodes.map(node=>node.dataset.cloSlot))
    assert.deepEqual(actual,expected[column],`${column}: full optional map differs from screenshot`)
  }
  const xy={}
  for(const [key,selector] of Object.entries(selectors)){
    xy[key]=await page.locator(selector).evaluate(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y}))
  }
  assert(xy.A3.x<xy.B3.x && xy.B3.x<xy.A2.x && xy.A2.x<xy.B2.x,'physical order must read left AB then right AB')
  assert.equal(await page.locator('[data-clo-slot="3d:A01"]').isEnabled(),true)
  assert.equal(await page.locator('[data-clo-slot="3d:A02"]').isEnabled(),true)
  assert.equal(await page.locator('[data-clo-slot="3d:B01"]').isEnabled(),false,'motion is research-only')
  assert.equal(await page.locator('[data-clo-slot="2d:A01"]').isEnabled(),true)
  assert.equal(await page.locator('[data-clo-slot="2d:B01"]').isEnabled(),false,'unverified CLO-specific icon must not be given a wrong command')
  assert.equal(await page.locator('[data-clo-slot="2d:A04"]').isEnabled(),true,'polygon creation should be wired')
  assert.equal(await page.locator('[aria-label="Additional EXO tools not assigned to the CLO 7 2D reference strips"]').count(),0,
    'EXO extra actions should be collapsed by default')
  await page.getByRole('button',{name:'Expand additional EXO tools'}).click()
  assert.equal(await page.locator('.clo-right-tool-palette .clo-reference-dual-bars').count(),2,
    'reference and EXO extras must be separately available on request')
  const extras=await page.locator('[aria-label="Additional EXO tools not assigned to the CLO 7 2D reference strips"] button').count()
  assert(extras>=15,'preserve all EXO actions under extras instead of removing them')
  assert(errors.length===0,'Frontend page errors: '+errors.join('; '))
  mkdirSync(path.join(root,'screenshots'),{recursive:true})
  await page.screenshot({path:path.join(root,'screenshots/clo-v7-exo-4column-audit.png'),fullPage:true})
  console.log(JSON.stringify({passed:true,order:'3D left A/B, 2D right A/B',workingByDefault:defaultVisible,allReferenceColumns:Object.fromEntries(
    Object.entries(expected).map(([k,v])=>[k,v.length])),preservedExtraActions:extras,
    referenceScreenshot:'screenshots/clo-v7-exo-4column-audit.png'},null,2))
} finally{await browser.close()}
