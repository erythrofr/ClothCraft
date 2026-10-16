import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// UI-only sewing job setup test. It intentionally DOES NOT submit a job to
// avoid colliding with an active Metal GPU simulation or changing saved work.
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
const page = await browser.newPage({ viewport: { width: 1740, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee', { waitUntil: 'domcontentloaded' })
// Top workspace tabs can be visually collapsed by a persisted desktop UI
// preference. Dispatch its real React click without assuming its visibility.
await page.locator('.section-tabs button').filter({ hasText: 'Sewing' }).evaluate((button) => button.click())
const panel = page.locator('[aria-label="PPF physical sewing simulation"]')
await panel.waitFor({ state: 'visible' })
if (!(await panel.innerText()).includes('PPF contact + sewing')) errors.push('PPF sewing panel missing')
if (!(await panel.innerText()).includes('Stitch spring strength')) errors.push('Stitch stiffness control missing')
if (!(await panel.innerText()).includes('PPF sewing frames')) errors.push('Sewing frame control missing')
if ((await panel.getByRole('button', { name: 'RUN PHYSICAL SEWING · PPF METAL' }).count()) !== 1) errors.push('PPF sewing action missing')

await panel.locator('.control-row input').first().fill('2.5')
await panel.locator('.control-row input').first().press('Tab')
const value = await panel.locator('.control-row input').first().inputValue()
if (Math.abs(Number(value) - 2.5) > 0.01) errors.push('PPF stiffness control did not accept an editable number')

await page.screenshot({ path: 'qa-ppf-sewing-ui-20261013.png' })
console.log(JSON.stringify({ panelVisible: true, value, errors, screenshot: 'qa-ppf-sewing-ui-20261013.png' }))
await browser.close()
if (errors.length) process.exit(1)
