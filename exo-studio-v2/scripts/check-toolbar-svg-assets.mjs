// Verify all current EXO 3D/2D toolbar buttons have an existing, loadable
// original EXO SVG. The historical manifest.placements list describes an
// older 78-slot layout and must not be used as the CLO7 four-column order.
import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {CLO7_3D_A,CLO7_3D_B,CLO7_2D_A,CLO7_2D_B} from '../src/data/clo7ToolbarOrder.js'

const root = resolve(import.meta.dirname, '..')
const dir = join(root, 'src/assets/toolbar-icons')
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
assert.equal(manifest.uniqueCount, 47)
assert.equal(manifest.slotCount, 78,'Original SVG artwork provenance manifest changed unexpectedly')
assert.equal(manifest.files.length, manifest.uniqueCount)
assert.equal(manifest.placements.length, manifest.slotCount)
assert.equal(new Set(manifest.files.map(f=>f.id)).size, manifest.files.length)
for (const {id,file} of manifest.files) {
  const path = join(dir,file)
  assert.ok(existsSync(path), 'Missing SVG file: '+id)
  const svg=readFileSync(path,'utf8')
  assert.match(svg,/<svg[^>]+viewBox="0 0 24 24"/,'Missing viewBox: '+id)
  assert.match(svg,/(<path|<ellipse|<rect|<circle)/,'Empty SVG: '+id)
  assert.ok(!svg.includes('currentColor'), 'Standalone SVG cannot rely on inherited currentColor: '+id)
}
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
try {
  const page=await browser.newPage({viewport:{width:1530,height:950}})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(process.env.GARMENT_UI_URL || 'http://127.0.0.1:5173/?desktop=1',{waitUntil:'networkidle'})
  const expected=[...CLO7_3D_A,...CLO7_3D_B,...CLO7_2D_A,...CLO7_2D_B]
  const photographed=await page.locator('[data-clo-slot]').all()
  assert.equal(photographed.length,expected.length)
  const bars=[...await page.locator('.tool-rail button:has(img.cad-tool-icon)').all(),
    ...await page.locator('.clo-reference-dual-bars button:has(img.cad-tool-icon)').all()]
  assert(bars.length>manifest.slotCount,'Expanded photo reference should include original and reference-only buttons')
  const rendered=[]
  for(let i=0;i<bars.length;i++){
    const actual=await bars[i].locator('img.cad-tool-icon').evaluate(img=>({id:img.dataset.iconId,loaded:img.complete&&img.naturalWidth>0,source:img.getAttribute('src'),format:img.dataset.iconFormat}))
    assert(manifest.files.some(f=>f.id===actual.id),`Missing EXO icon source: ${actual.id}`)
    assert.equal(actual.format,'svg')
    assert.ok(actual.loaded,`Broken SVG image at rendered slot ${i+1}: ${actual.id}`)
    rendered.push({...actual,index:i+1})
  }
  for(let i=0;i<photographed.length;i++){
    const node=photographed[i],image=await node.locator('img.cad-tool-icon').evaluate(img=>img.dataset.iconId)
    // Order is independently verified by scripts/qa-clo-v7-four-column-order.mjs.
    assert(manifest.files.some(f=>f.id===image),'Reference uses an undocumented artwork id '+image)
  }
  assert.deepEqual(errors,[], 'Browser JavaScript errors')
  const output=join(root,'native_app/qa/toolbar-svg-asset-coverage.json')
  mkdirSync(join(root,'native_app/qa'),{recursive:true})
  writeFileSync(output,JSON.stringify({passed:true,slots:rendered.length,referenceSlots:photographed.length,uniqueAssets:manifest.uniqueCount,exactCloVerified:0,rendered},null,2)+'\n')
  console.log(JSON.stringify({passed:true,referenceSlots:photographed.length,uniqueAssets:manifest.uniqueCount,loadedIcons:rendered.length,exactCloVerified:0,output},null,2))
}finally{await browser.close()}
