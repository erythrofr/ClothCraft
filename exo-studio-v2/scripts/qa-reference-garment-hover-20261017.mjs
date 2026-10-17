import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const url = process.env.EXO_QA_URL || 'http://127.0.0.1:5207'
const phase = process.env.EXO_QA_PHASE || 'after'
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const harness = phase !== 'before' && process.env.EXO_QA_FULL_APP !== '1'
    const entry = harness ? '/docs/qa/garment-preview-20261017/harness.html?templateId=tee' : '/?desktop=1&testSession=garment-preview-before-' + width
    await page.goto(url + entry, { waitUntil: 'domcontentloaded', timeout: 90000 })
    if (!harness) {
      await page.getByRole('button', { name: 'Browse garments' }).waitFor({ state: 'visible' })
      await page.getByRole('navigation', { name: 'Library categories' }).getByRole('button', { name: 'Garment', exact: true }).click()
      const tile = page.locator('.asset-template[data-library-hover-id^="Garment:"]').first()
      await tile.scrollIntoViewIfNeeded()
      await tile.hover()
    }
    const preview = harness ? page.locator('#preview-harness > div') : page.locator('[data-library-preview^="Garment:"]').first()
    await preview.waitFor({ state: 'visible', timeout: 12000 })
    await preview.locator('.exo-garment-mini-canvas canvas').waitFor({ state: 'attached', timeout: 12000 })
    await page.waitForTimeout(850)
    const bounds = await preview.boundingBox()
    const diagnostics = await preview.locator('.exo-garment-mini-canvas canvas').evaluate(canvas => ({ ...canvas.dataset }))
    const screenshot = `/tmp/exo-reference-preview-${phase}-${width}.png`
    await preview.screenshot({ path: screenshot })
    console.log(JSON.stringify({ phase, width, bounds, diagnostics, screenshot, errors }))
    assert.ok(bounds.width > 215 && bounds.height > 140)
    assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1)
    assert.deepEqual(errors, [])
    if (phase !== 'before') {
      assert.equal(diagnostics.previewStatus, 'ready')
      assert.ok(Number(diagnostics.previewMeshCount) >= 4)
      assert.ok(Number(diagnostics.previewTriangleCount) >= 500)
      if (width === 1440) {
        for (const [label, mode] of [['FRONT', 'reference-curved-arrangement'], ['SIDE', 'reference-curved-arrangement']]) {
          await preview.getByRole('button', { name: label, exact: true }).click()
          await preview.locator('.exo-garment-mini-canvas canvas').waitFor({ state: 'visible' })
          await page.waitForFunction(expected => document.querySelector('.exo-garment-mini-canvas canvas')?.dataset.previewRenderMode === expected &&
            document.querySelector('.exo-garment-mini-canvas canvas')?.dataset.previewStatus === 'ready', mode)
          await preview.screenshot({ path: '/tmp/exo-reference-preview-' + phase + '-' + label.toLowerCase().replaceAll(' ', '-') + '.png' })
        }
        await preview.getByRole('button', { name: '3/4 VIEW', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('.exo-garment-mini-canvas canvas')?.dataset.previewStatus === 'ready')
      }
      const rotate = preview.getByRole('button', { name: 'Rotate garment right' })
      const originalAngle = Number(await preview.locator('canvas').getAttribute('data-preview-angle'))
      await rotate.click()
      const afterAngle = Number(await preview.locator('canvas').getAttribute('data-preview-angle'))
      assert.ok(afterAngle > originalAngle)
      for (const label of ['Style lines', 'Sewing lines', 'Pattern edges']) {
        const control = preview.getByRole('button', { name: label })
        const pressed = await control.getAttribute('aria-pressed')
        const detailBefore = Number(await preview.locator('canvas').getAttribute('data-preview-visible-details'))
        await control.click()
        assert.notEqual(await control.getAttribute('aria-pressed'), pressed)
        const detailAfter = Number(await preview.locator('canvas').getAttribute('data-preview-visible-details'))
        assert.notEqual(detailAfter, detailBefore, label + ' must change rendered detail geometry')
      }
    }
    await page.close()
  }
} finally {
  await browser.close()
}
