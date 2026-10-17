import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-webgl', '--ignore-gpu-blocklist'] })
const base = process.env.EXO_QA_URL || 'http://127.0.0.1:5173'
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/?desktop=1&testSession=hover-all-${width}`, { waitUntil: 'domcontentloaded' })
    const nav = page.getByRole('navigation', { name: 'Library categories' })
    const categories = ['Garment', 'Avatar', 'Hanger', 'Fabric', 'Hardware and Trims', 'Material', 'Stage', 'Patterns']
    const results = []
    for (const category of categories) {
      await page.mouse.move(width - 15, 30)
      await nav.getByRole('button', { name: category, exact: true }).click()
      if (category === 'Fabric' || category === 'Material') await page.getByRole('textbox', { name: 'Search library' }).fill('Rigid Denim')
      const target = page.locator('[data-library-hover-id]').first()
      await target.waitFor({ state: 'visible', timeout: 15000 })
      await target.scrollIntoViewIfNeeded()
      await target.hover()
      const preview = page.locator('[data-library-preview]').first()
      await preview.waitFor({ state: 'visible', timeout: 10000 })
      const bounds = await preview.boundingBox()
      assert.ok(bounds.width > 200 && bounds.height > 130, `${category} preview is too small`)
      assert.ok(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= (width === 390 ? 845 : 901), `${category} preview is clipped`)
      assert.ok(await preview.locator('canvas,img,svg').count(), `${category} media is missing`)
      if (category === 'Garment') {
        for (const [template, pieces, seams] of [['tee',4,14],['hoodie',10,32],['pants',4,10]]) {
          const tile = page.locator(`[data-library-hover-id="Garment:${template}"]`)
          await tile.scrollIntoViewIfNeeded()
          await tile.hover()
          const garment = page.locator(`[data-library-preview="Garment:${template}"]`)
          await garment.waitFor({ state:'visible', timeout:10000 })
          const canvas = garment.locator('.exo-garment-mini-canvas')
          assert.equal(await canvas.getAttribute('data-template-id'), template)
          assert.equal(Number(await canvas.getAttribute('data-piece-count')), pieces)
          assert.equal(Number(await canvas.getAttribute('data-seam-count')), seams)
          assert.equal(await canvas.locator('canvas').count(), 1, `${template}: one WebGL preview canvas`)
          const box = await garment.boundingBox()
          assert.ok(box.x>=-1 && box.y>=-1 && box.x+box.width<=width+1 && box.y+box.height<=(width===390?845:901), `${template}: popup clipping`)
          for (const label of ['Style lines','Sewing lines','Pattern edges']) {
            const toggle = garment.getByRole('button',{name:label})
            const initial = await toggle.getAttribute('aria-pressed')
            await toggle.click()
            assert.notEqual(await toggle.getAttribute('aria-pressed'),initial,`${template}: ${label} toggle`)
          }
          results.push({template,pieces,seams})
        }
      }
      results.push({ category, size: `${Math.round(bounds.width)}x${Math.round(bounds.height)}` })
      await page.mouse.move(width - 15, 30)
    }
    assert.deepEqual(errors, [], errors.join('\n'))
    console.log(JSON.stringify({ pass: true, width, results }))
    await page.close()
  }
} finally { await browser.close() }
