import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const url = process.env.EXO_QA_URL || 'http://127.0.0.1:5199'
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
let checks = 0
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 900 },
      hasTouch: width === 390,
      isMobile: width === 390,
    })
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(url + '/?desktop=1&testSession=library-hover-a11y-' + width, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Browse garments' }).waitFor({ state: 'visible' })
    await page.getByRole('navigation', { name: 'Library categories' }).getByRole('button', { name: 'Garment', exact: true }).click()
    const tile = page.locator('.asset-template[data-library-hover-id^="Garment:"]').first()
    await tile.scrollIntoViewIfNeeded()
    const id = await tile.getAttribute('data-library-hover-id')
    const preview = page.locator('[data-library-preview="' + id + '"]')
    if (width === 1440) {
      await tile.focus()
      await preview.waitFor({ state: 'visible' })
      checks += 1
      await tile.press('Tab')
      assert.equal(await preview.getByRole('button', { name: 'Style lines', exact: true }).evaluate(el => el === document.activeElement), true)
      assert.equal(await preview.isVisible(), true, 'Popup must survive tile blur to controls')
      checks += 1
      await page.keyboard.press('Escape')
      await preview.waitFor({ state: 'hidden' })
      assert.equal(await tile.evaluate(el => el === document.activeElement), true, 'Escape should return focus to invoking tile')
      checks += 1
      // A second preview cycle requires a new focus transition.
      await page.keyboard.press('Tab')
      await tile.focus()
      await preview.waitFor({ state: 'visible' })
      await tile.press('Tab')
      const style=preview.getByRole('button', { name: 'Style lines' })
      const before=await style.getAttribute('aria-pressed')
      await style.click()
      assert.notEqual(await style.getAttribute('aria-pressed'),before)
      checks += 1
    } else {
      const hint = tile.locator('[data-library-preview-touch]')
      assert.ok(await hint.isVisible(), 'Touch users must see preview affordance')
      await hint.tap()
      await preview.waitFor({ state: 'visible' })
      checks += 1
      assert.equal(await preview.locator('.exo-garment-mini').count(), 1)
      const edges=preview.getByRole('button', { name: 'Pattern edges', exact: true })
      const pressed=await edges.getAttribute('aria-pressed')
      await edges.tap()
      assert.notEqual(await edges.getAttribute('aria-pressed'),pressed)
      checks += 1
      await page.keyboard.press('Escape')
      await preview.waitFor({ state: 'hidden' })
      checks += 1
    }
    assert.deepEqual(errors, [], 'No JavaScript errors: ' + errors.join(' | '))
    await page.close()
  }
  console.log('LIBRARY HOVER ACCESSIBILITY PASS: ' + checks + ' focus/touch interactions')
} finally {
  await browser.close()
}
