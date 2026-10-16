import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})

const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.evaluate(() => {
  const key = 'garment-studio-project-v1'
  const project = JSON.parse(localStorage.getItem(key))
  if (!project) return
  project.avatar.visibility = 0.05
  localStorage.setItem(key, JSON.stringify(project))
})
await page.reload({ waitUntil: 'networkidle' })
await page.locator('.sim-play').click()
await page.waitForTimeout(3200)
await page.screenshot({ path: 'qa-garment-isolated-true.png', fullPage: true })
await browser.close()
