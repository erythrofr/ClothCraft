// Read-only regression of the installed EXO ClothCraft Studio V2 shell.
// Its persistent Rust workspace is never edited by this script.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const ui = process.env.EXO_INSTALLED_WEB || 'http://127.0.0.1:5386'
const bridge = process.env.EXO_INSTALLED_BRIDGE || 'http://127.0.0.1:5385'
const health = await fetch(`${bridge}/health`, { signal: AbortSignal.timeout(8000) }).then(response => response.json())
assert.equal(health.ok, true, 'Installed native bridge must be healthy')
assert.equal(health.nativeReady, true, 'Installed native Rust session must be available')

const snapshot = await fetch(`${bridge}/workspace`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': ui },
  body: JSON.stringify({ op: 'snapshot', avatar: false }),
  signal: AbortSignal.timeout(20000),
}).then(response => response.json())
assert.equal(snapshot.ok, true, `Installed project load failed: ${snapshot.error || 'unknown error'}`)
assert.ok(snapshot.data?.template?.name)
assert.ok(snapshot.data?.panels?.length > 0)

const report = { nativeReady: true, projectName: snapshot.data.template.name,
  revision: snapshot.data.revision, panels: snapshot.data.panels.length,
  seams: snapshot.data.template.seams?.length || 0, viewports: [],
  browserCheck: process.env.EXO_QA_BROWSER === '1' ? 'requested' : 'not requested' }
// The signed app's local bridge/project check is fast and safe even when a
// machine is already running several graphical regression sessions. Explicitly
// request EXO_QA_BROWSER=1 for additional headless 1440px/390px hover QA.
if (process.env.EXO_QA_BROWSER === '1') {
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EXO_QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } })
    const exceptions = []
    page.on('pageerror', error => exceptions.push(error.message))
    await page.goto(`${ui}/?desktop=1&engine=clothcraft&testSession=installed-v2-reopen-${width}`, {
      waitUntil: 'domcontentloaded', timeout: 30000,
    })
    await page.locator('[data-native-clothcraft="true"]').waitFor({ state: 'attached', timeout: 20000 })
    await page.locator('.cc-viewport-3d canvas').waitFor({ state: 'visible', timeout: 20000 })
    const result = { width, objectBrowser: await page.locator('.clo-object-row').count(), hovers: [] }
    const nav = page.getByRole('navigation', { name: 'Library categories' })
    for (const [category, selector, preview] of [
      ['Garment', '[data-library-hover-id^="Garment:"]', '[data-library-preview^="Garment:"]'],
      ['Hardware and Trims', '[data-library-hover-id^="hardware:"]', '[data-library-preview^="hardware:"]'],
      ['Stage', '[data-library-hover-id="stage:R01"]', '[data-library-preview="stage:R01"]'],
      ['Patterns', '[data-library-hover-id^="Patterns:"]', '[data-library-preview^="Patterns:"]'],
    ]) {
      await nav.getByRole('button', { name: category, exact: true }).click()
      const item = page.locator(selector).first()
      await item.scrollIntoViewIfNeeded()
      await page.mouse.move(1040, 36)
      await item.hover()
      const card = page.locator(preview).first()
      await card.waitFor({ state: 'visible', timeout: 12000 })
      const rect = await card.boundingBox()
      assert.ok(rect.width > 220 && rect.x >= 0 && rect.x + rect.width <= width + 1,
        `${category} enlarged preview is offscreen at ${width}px`)
      if (category === 'Stage') {
        const canvas = card.locator('canvas[data-preview-stage-id="R01"]')
        await canvas.waitFor({ state: 'visible', timeout: 15000 })
        assert.ok(Number(await canvas.getAttribute('data-preview-mesh-count')) > 0)
      }
      result.hovers.push(category)
    }
    assert.deepEqual(exceptions, [], `JS exception at ${width}px`)
    result.errors = exceptions.length
    report.viewports.push(result)
    await page.close()
  }
} finally {
  await browser.close()
}
report.browserCheck = 'passed'
}
console.log(JSON.stringify({ pass: true, ...report }, null, 2))
