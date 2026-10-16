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
await page.getByRole('button', { name: 'Pattern', exact: true }).click()
await page.waitForTimeout(450)

const grainlines = await page.locator('.grainline').count()
const notchMarks = await page.locator('.pattern-notch line').count()
const notchRows = await page.locator('.notch-row').count()
const notchTool = await page.locator('.notch-tool-symbol').count()
const bodyText = await page.locator('.inspector').innerText()
await page.screenshot({ path: 'qa-pattern-production-marks.png', fullPage: true })
await browser.close()

if (errors.length) throw new Error(`Pattern QA browser errors: ${errors.join(' | ')}`)
if (grainlines < 4) throw new Error(`Expected grainlines on all four pieces, found ${grainlines}`)
if (notchMarks < 8) throw new Error(`Expected visible production notch marks, found ${notchMarks}`)
if (notchRows < 2) throw new Error(`Expected front-piece notch editor rows, found ${notchRows}`)
if (!notchTool) throw new Error('Notch authoring tool is missing')
if (!bodyText.includes('Grain angle') || !bodyText.includes('Production notches')) throw new Error('Pattern inspector is missing production mark controls')

console.log(JSON.stringify({ grainlines, notchMarks, notchRows, notchTool }, null, 2))
