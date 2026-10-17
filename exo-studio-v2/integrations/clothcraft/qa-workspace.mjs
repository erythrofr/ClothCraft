import assert from 'node:assert/strict'
import fs from 'node:fs'
import {chromium} from 'playwright-core'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const page=await browser.newPage({viewport:{width:1512,height:982}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.route('http://127.0.0.1:5193/workspace',async route=>{const r=await route.fetch({url:'http://127.0.0.1:5194/workspace'});await route.fulfill({response:r})})
 await page.goto('http://127.0.0.1:5174/?desktop=1&engine=clothcraft-lab')
 await page.locator('[data-piece]').first().waitFor({timeout:60000})
 // Always start from a fresh, reproducible fixture. Workspace state persists
 // between runs, so relying on an old project's time made repeated QA fail.
 await page.locator('.cc-library-tabs').getByRole('button',{name:'Library',exact:true}).click()
 await page.getByRole('button',{name:'T-shirt fixture',exact:true}).click()
 await page.waitForFunction(()=>document.querySelector('.cc-status')?.textContent.includes('0.000 s'),{timeout:60000})
 await page.getByRole('button',{name:'Pieces',exact:true}).click()
 assert.equal(await page.locator('.cc-error').count(),0)
 await page.locator('[data-piece]').first().hover()
 await page.screenshot({path:'screenshots/clothcraft-workspace-linked-20261016.png'})
 const piece=await page.locator('[data-piece]').first().getAttribute('data-piece')
 await page.locator('[data-piece]').first().click()
 await page.getByRole('button',{name:'Duplicate',exact:true}).click()
 await page.waitForFunction(()=>document.querySelectorAll('[data-piece]').length===3)
 await page.getByRole('button',{name:'Undo',exact:true}).click()
 await page.waitForFunction(()=>document.querySelectorAll('[data-piece]').length===2)
 await page.getByRole('button',{name:'Single step',exact:true}).click()
 await page.waitForFunction(()=>document.querySelector('.cc-status').textContent.includes('0.017 s'),{timeout:60000})
 assert.equal(await page.locator('.cc-error').count(),0)
 await page.getByRole('button',{name:'Save / export',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Workspace saved'}).waitFor()
 await page.reload();await page.locator('[data-piece]').first().waitFor({timeout:60000})
 // The persisted Rust snapshot arrives asynchronously after the first React
 // render. Wait for the actual recovered physical time, not merely the panel DOM.
 await page.waitForFunction(()=>document.querySelector('.cc-status')?.textContent.includes('0.017 s'),{timeout:60000})
 await page.getByRole('button',{name:'Sew edges',exact:true}).click()
 const edges=page.locator('[data-edge]');await edges.first().click({force:true});await edges.nth(15).click({force:true});assert(await page.getByRole('button',{name:'Create seam',exact:true}).isEnabled())
 await page.screenshot({path:'screenshots/clothcraft-workspace-sewing-20261016.png'})
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,checks:['render-3d-2d','panel-selection','duplicate-undo','native-single-step','save-reload','two-view-sewing-selection'],piece,errors}))
}finally{await browser.close()}
