import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const base = process.env.EXO_QA_URL || 'http://127.0.0.1:5207'
const outputDir = 'screenshots/qa/garment-triptych-20261017'
const fullApp = process.env.EXO_QA_FULL_APP === '1'
await mkdir(outputDir, { recursive: true })
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
    const pageUrl = fullApp ? `${base}/?desktop=1&engine=clothcraft` : `${base}/docs/qa/garment-preview-20261017/harness.html?templateId=tee`
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' })
    if (fullApp) {
      await page.getByRole('button', { name: 'Browse garments' }).waitFor({ state: 'visible', timeout: 20_000 })
      await page.getByRole('navigation', { name: 'Library categories' }).getByRole('button', { name: 'Garment', exact: true }).click()
      const tile = page.locator('.asset-template[data-library-hover-id^="Garment:"]').first()
      await tile.scrollIntoViewIfNeeded()
      await tile.hover()
    }
    const preview = fullApp ? page.locator('[data-library-preview^="Garment:"] .exo-garment-mini').first() : page.locator('#preview-harness .exo-garment-mini')
    await preview.locator('canvas[data-preview-status="ready"]').waitFor({ timeout: 20_000 })
    const canvas = preview.locator('canvas')
    const result = await canvas.evaluate(node => ({ ...node.dataset, canvasCount: node.parentElement.querySelectorAll('canvas').length }))
    const labels = await preview.locator('.exo-garment-mini-view-labels span').allTextContents()
    const bounds = await preview.boundingBox()
    assert.equal(result.previewRenderMode, 'reference-three-view-static')
    assert.equal(result.previewViewCount, '3')
    assert.equal(result.previewViews, 'front,side,back')
    assert.equal(result.canvasCount, 1)
    assert.equal(labels.length, 3)
    assert.match(labels.join(' '), /FRONT.*SIDE.*BACK/)
    assert.ok(Number(result.previewTriangleCount) > 600)
    assert.ok(bounds && bounds.width > 215 && bounds.x >= -1 && bounds.x + bounds.width <= width + 1)
    assert.equal(await preview.getByRole('button', { name: 'Rotate garment right' }).count(), 0)
    assert.deepEqual(errors, [])
    const screenshot = `${outputDir}/${fullApp ? 'installed-' : ''}three-view-${width}.png`
    await preview.screenshot({ path: screenshot })
    const toggle = preview.getByRole('button', { name: 'Pattern edges' })
    const first = Number(await canvas.getAttribute('data-preview-visible-details'))
    await toggle.click()
    const second = Number(await canvas.getAttribute('data-preview-visible-details'))
    assert.notEqual(second, first)
    console.log(JSON.stringify({ width, bounds, diagnostics: result, labels, first, second, screenshot, errors }))
    await page.close()
  }
} finally {
  await browser.close()
}
