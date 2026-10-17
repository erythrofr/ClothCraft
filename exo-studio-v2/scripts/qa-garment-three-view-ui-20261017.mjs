import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const origin = process.env.EXO_QA_URL || 'http://127.0.0.1:5208'
const fullApp = process.env.EXO_QA_FULL_APP === '1'
const out = 'docs/qa/screenshots'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
try {
  for (const width of [760, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 680 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin + (fullApp
      ? '/?desktop=1&testSession=garment-three-view-' + width
      : '/docs/qa/garment-preview-20261017/harness.html?templateId=tee'), { waitUntil: 'domcontentloaded' })
    if (fullApp) {
      await page.getByRole('button', {name: 'Browse garments'}).waitFor({state:'visible',timeout:20000})
      await page.getByRole('navigation',{name:'Library categories'}).getByRole('button',{name:'Garment',exact:true}).click()
      const tile = page.locator('.asset-template[data-library-hover-id^="Garment:"]').first()
      await tile.scrollIntoViewIfNeeded()
      await tile.hover()
    }
    const preview = fullApp ? page.locator('[data-library-preview^="Garment:"]').first().locator('.exo-garment-mini') : page.locator('.exo-garment-mini')
    await preview.waitFor({state:'visible',timeout:15000})
    const canvas = preview.locator('canvas[data-preview-status="ready"]')
    await canvas.waitFor({ timeout: 20000 })
    const metadata = await canvas.evaluate(element => ({ ...element.dataset }))
    assert.equal(metadata.previewRenderMode, 'reference-three-view-static')
    assert.equal(metadata.previewViewCount, '3')
    assert.equal(metadata.previewViews, 'front,side,back')
    assert.ok(Number(metadata.previewTriangleCount) >= 3000)
    assert.ok(Number(metadata.previewMeshCount) >= 12)
    assert.equal(await preview.locator('.exo-garment-mini-view-labels span').count(), 3)
    assert.equal(await preview.getByRole('button', { name: /rotate garment/i }).count(), 0)
    assert.equal(errors.length, 0, errors.join('; '))
    const path = out + '/exo-garment-fixed-three-view-' + (fullApp ? 'installed-' : '') + width + '-20261017.png'
    await preview.screenshot({ path })
    for (const name of ['Style lines', 'Sewing lines', 'Pattern edges']) {
      const toggle = preview.getByRole('button', {name, exact:true})
      const before = await toggle.getAttribute('aria-pressed')
      const details = await canvas.getAttribute('data-preview-visible-details')
      await toggle.click()
      assert.notEqual(await toggle.getAttribute('aria-pressed'), before, name + ' toggled state')
      assert.notEqual(await canvas.getAttribute('data-preview-visible-details'), details, name + ' changed visible geometry')
    }
    assert.equal(await preview.getByRole('button', {name:/rotate garment/i}).count(), 0)
    console.log(JSON.stringify({width, path, metadata, errors}))
    await page.close()
  }
  if (!fullApp && process.env.EXO_QA_EXTRA_TEMPLATES === '1') {
    // Confirm the shared three-view renderer works beyond the T-shirt without
    // applying T-shirt-specific sleeve choreography to other patterns.
    for (const templateId of ['hoodie', 'pants']) {
      const page = await browser.newPage({viewport:{width:760,height:680}})
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(origin + '/docs/qa/garment-preview-20261017/harness.html?templateId=' + templateId, {waitUntil:'domcontentloaded'})
      const canvas = page.locator('.exo-garment-mini canvas[data-preview-status="ready"]')
      await canvas.waitFor({timeout:20000})
      const state = await canvas.evaluate(element => ({...element.dataset}))
      assert.equal(state.previewViews, 'front,side,back')
      assert.ok(Number(state.previewDisplayedPieceCount) >= 2)
      assert.ok(Number(state.previewMeshCount) >= 12)
      assert.equal(errors.length, 0, errors.join('; '))
      console.log(JSON.stringify({templateId, state, errors}))
      await page.close()
    }
  }
} finally {
  await browser.close()
}
