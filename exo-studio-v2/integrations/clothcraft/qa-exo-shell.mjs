// Verifies working EXO chrome surrounding the actual ClothCraft 3D/2D editors.
// Uses a dedicated local QA session, never the installed user's live workspace.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'] })
try {
  const context = await browser.newContext({viewport:{width:1512,height:982},acceptDownloads:true})
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => d.accept())
  await page.route('http://127.0.0.1:5193/workspace', async route => {
    const response = await route.fetch({url:'http://127.0.0.1:5194/workspace'})
    await route.fulfill({response})
  })
  await page.goto('http://127.0.0.1:5174/?desktop=1&engine=clothcraft-lab',{waitUntil:'domcontentloaded'})
  await page.locator('[data-piece]').first().waitFor({timeout:60000})
  const nav = page.getByRole('navigation',{name:'EXO tool categories'})
  const categories = ['Pattern','Sewing','Fabric','Avatar','Fit','Production','Render']
  for (const category of categories) assert.equal(await nav.getByRole('button',{name:category,exact:true}).count(),1)
  assert.equal(await page.locator('.cc-scene canvas').count(),1)
  assert.equal(await page.locator('.cc-board svg').count(),1)
  assert.equal(await page.locator('.cc-inspector').count(),1)

  await page.locator('[data-piece]').first().click()
  await nav.getByRole('button',{name:'Pattern'}).click()
  const initial = await page.locator('[data-piece]').count()
  await page.getByRole('button',{name:'Duplicate',exact:true}).click()
  await page.waitForFunction(expected => document.querySelectorAll('[data-piece]').length===expected,initial+1)
  await page.getByRole('button',{name:'Undo',exact:true}).first().click()
  await page.waitForFunction(expected => document.querySelectorAll('[data-piece]').length===expected,initial)
  await page.getByRole('button',{name:'Create piece',exact:true}).click()
  await page.waitForFunction(expected => document.querySelectorAll('[data-piece]').length===expected,initial+1)
  await page.getByRole('button',{name:'Undo',exact:true}).first().click()
  await page.waitForFunction(expected => document.querySelectorAll('[data-piece]').length===expected,initial)

  await nav.getByRole('button',{name:'Sewing'}).click()
  assert.equal(await page.getByRole('button',{name:'Create seam',exact:true}).count(),1)
  await page.locator('.cc-library-tabs').getByRole('button',{name:'Seams'}).click()
  assert.ok(await page.locator('.cc-seam-row').count()>0)
  await nav.getByRole('button',{name:'Fabric'}).click()
  assert.ok(await page.locator('fieldset').filter({hasText:'Physical fabric parameters'}).count()>0)
  await nav.getByRole('button',{name:'Avatar'}).click()
  const avatarCheckbox=page.getByRole('checkbox',{name:'Show avatar'})
  await avatarCheckbox.uncheck();assert.equal(await avatarCheckbox.isChecked(),false)
  await avatarCheckbox.check()
  assert.equal(await avatarCheckbox.isChecked(),true)
  await nav.getByRole('button',{name:'Fit'}).click()
  assert.ok((await page.locator('.cc-inspector').innerText()).includes('LIVE CONTACT / FIT'))
  await page.getByRole('button',{name:'Single step',exact:true}).first().click()
  await page.waitForFunction(()=>document.querySelector('.cc-status')?.textContent.includes('Ready'),{timeout:60000})

  await nav.getByRole('button',{name:'Render'}).click()
  await page.getByRole('checkbox',{name:'Cloth wireframe'}).check()
  await page.getByRole('checkbox',{name:'Seam correspondences'}).uncheck()
  await page.getByRole('combobox',{name:'Render viewport layout'}).selectOption('3d')
  assert.equal(await page.locator('.cc-viewport-2d').isVisible(),false)
  assert.equal(await page.locator('.cc-viewport-3d').isVisible(),true)
  await page.getByRole('combobox',{name:'Render viewport layout'}).selectOption('split')
  assert.equal(await page.locator('.cc-viewport-2d').isVisible(),true)

  await nav.getByRole('button',{name:'Production'}).click()
  const exported=[]
  for (const label of ['Export current drape OBJ','Export pattern reference SVG']) {
    const promise=page.waitForEvent('download',{timeout:30000})
    await page.getByRole('button',{name:label}).click()
    const download=await promise
    exported.push(download.suggestedFilename())
  }
  assert.ok(exported.some(filename=>filename.endsWith('.obj')))
  assert.ok(exported.some(filename=>filename.endsWith('.svg')))
  await page.getByRole('button',{name:'Toggle asset library'}).click()
  assert.equal(await page.locator('.cc-pieces').count(),0)
  await page.getByRole('button',{name:'Toggle asset library'}).click()
  assert.equal(await page.locator('.cc-pieces').count(),1)
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,categories,checks:['center-3d-2d','linked-selection','duplicate-undo','create-piece-undo','sewing','physical-fabrics','avatar-visibility','rust-step','wireframe','layout','live-obj-export','svg-reference-export','library-toggle'],exported,errors},null,2))
  await context.close()
} finally { await browser.close() }
