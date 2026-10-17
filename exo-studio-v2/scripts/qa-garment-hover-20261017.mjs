import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const url = process.env.EXO_QA_URL || 'http://127.0.0.1:5188'
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
    const screenshot = `/tmp/exo-garment-preview-${phase}-${width}.png`
    await preview.screenshot({ path: screenshot })
    console.log(JSON.stringify({ phase, width, bounds, diagnostics, screenshot, errors }))
    assert.ok(bounds.width > 215 && bounds.height > 140)
    assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1)
    assert.deepEqual(errors, [])
    if (phase !== 'before') {
      assert.equal(diagnostics.previewStatus, 'ready')
      assert.ok(Number(diagnostics.previewMeshCount) >= 4)
      assert.ok(Number(diagnostics.previewTriangleCount) >= 1000)
      // Current V2 shows all three read-only views in one source-derived
      // orthographic triptych; there is deliberately no movable mannequin
      // or separate rotation button in the hover card.
      assert.equal(diagnostics.previewRenderMode, 'reference-three-view-static')
      // Camera framing is concurrently being refined in V2. Validate the
      // source-derived three-view contract, not a transient angle label.
      const cameraViews=diagnostics.previewViews.split(',')
      assert.equal(cameraViews.length,3)
      assert.equal(cameraViews[0],'front')
      assert.match(cameraViews[1],/side/)
      assert.match(cameraViews[2],/^(back|three-quarter)$/)
      assert.equal(diagnostics.previewSourcePieceCount, '4')
      assert.equal(diagnostics.previewDisplayedPieceCount, '4')
      assert.equal(diagnostics.previewPageCount, '1')
      assert.equal(await preview.locator('.exo-garment-mini-view-labels span').count(),3)
      for (const label of ['Style lines', 'Sewing lines', 'Pattern edges']) {
        const control = preview.getByRole('button', { name: label })
        const pressed = await control.getAttribute('aria-pressed')
        const detailBefore = Number(await preview.locator('canvas').getAttribute('data-preview-visible-details'))
        await control.click()
        assert.notEqual(await control.getAttribute('aria-pressed'), pressed)
        const detailAfter = Number(await preview.locator('canvas').getAttribute('data-preview-visible-details'))
        assert.notEqual(detailAfter, detailBefore, label + ' must change the actual rendered detail geometry')
      }
    }
    await page.close()
  }
} finally {
  await browser.close()
}
