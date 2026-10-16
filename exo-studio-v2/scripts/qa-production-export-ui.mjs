import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Isolated first-fit session: must never overwrite the user's current garment.
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})

try {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1620, height: 960 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('http://127.0.0.1:5173/?desktop=1&testSession=tee&qa=production-exports', { waitUntil: 'domcontentloaded' })
  await page.locator('.pattern-canvas').waitFor({ timeout: 25000 })
  await page.getByRole('combobox', { name: 'Workspace', exact: true }).selectOption('Production')
  await page.getByText('Manufacturing preflight · all sizes').waitFor()
  const priceField = page.getByRole('spinbutton', { name: 'Supplier price per fabric meter' })
  assert.ok(await priceField.isVisible(), 'Production workspace must expose supplier fabric price')
  await priceField.fill('19.75')
  await page.getByText('Estimated material cost · M').waitFor()
  const buttons = [
    /EXPORT DXF/,
    /EXPORT TRUE-SCALE MARKER PDF/,
    /EXPORT TRUE-SCALE MARKER SVG/,
    /EXPORT BOM · XML/,
    /EXPORT FACTORY PACKAGE/,
  ]
  const downloaded = []
  for (const buttonName of buttons) {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 25000 }),
      page.getByRole('button', { name: buttonName }).click(),
    ])
    downloaded.push(download.suggestedFilename())
  }
  assert.ok(downloaded.some((name) => name.endsWith('.pdf')))
  assert.ok(downloaded.some((name) => name.endsWith('.svg')))
  assert.ok(downloaded.some((name) => name.endsWith('.xml')))
  assert.ok(downloaded.some((name) => name.endsWith('.dxf')))
  assert.ok(downloaded.some((name) => name.endsWith('.zip')))
  assert.deepEqual(pageErrors, [], `Production UI runtime errors: ${pageErrors.join(', ')}`)
  console.log(JSON.stringify({ passed: true, downloaded }, null, 2))
} finally {
  await browser.close()
}
