import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Production', exact: true }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: 'qa-production.png', fullPage: true })
console.log(JSON.stringify({ errors, text: (await page.locator('.inspector').innerText()).slice(0, 2400) }, null, 2))
await browser.close()
