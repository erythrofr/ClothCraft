import { chromium } from 'playwright-core'

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
try {
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=garment-lifecycle', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Browse garments' }).waitFor()
  await page.getByRole('navigation', { name: 'Library categories' }).getByRole('button', { name: 'Garment', exact: true }).click()
  const tile = page.locator('.asset-template[data-library-hover-id^="Garment:"]').first()
  await tile.scrollIntoViewIfNeeded()
  await tile.hover()
  const preview = page.locator('[data-library-preview^="Garment:"]').first()
  await preview.waitFor({ state: 'visible' })
  await page.evaluate(() => {
    window.__garmentHoverTrace = []
    const log = message => window.__garmentHoverTrace.push({ event: message, at: performance.now() })
    const target = document.querySelector('[data-library-preview^="Garment:"]')
    target.addEventListener('pointerenter', () => log('popup enter'), true)
    target.addEventListener('pointerleave', event => log('popup leave to ' + (event.relatedTarget?.className || '?')), true)
    target.addEventListener('pointermove', () => log('popup move'), { passive: true })
    window.addEventListener('scroll', event => log('scroll: ' + (event.target?.className || event.target?.tagName || 'window')), true)
    const watcher = new MutationObserver(() => { if (!document.querySelector('[data-library-preview^="Garment:"]')) log('popup removed') })
    watcher.observe(document.body, { childList: true })
  })
  for (const label of ['FRONT', 'PATTERN EXPLODED', '3/4 VIEW', 'Rotate garment right', 'Style lines']) {
    try {
      await preview.getByRole('button', { name: label, exact: true }).click({ timeout: 3500 })
      console.log('CONTROL', label, 'clicked')
      await page.waitForTimeout(150)
    } catch (error) {
      console.log('CONTROL', label, 'FAILED', error.message.slice(0, 1200))
      const boxes = await page.evaluate(() => {
        const bounds = selector => {
          const element = document.querySelector(selector)
          if (!element) return null
          const box = element.getBoundingClientRect()
          return { x: box.x, y: box.y, width: box.width, height: box.height, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflow: getComputedStyle(element).overflow }
        }
        return {
          popup: bounds('.exo-library-asset-hover'),
          media: bounds('.exo-library-asset-hover-media'),
          mini: bounds('.exo-garment-mini'),
          canvas: bounds('.exo-garment-mini-canvas'),
          rotate: bounds('.exo-garment-mini-rotate'),
          switches: bounds('.exo-garment-mini-switches'),
          views: bounds('.exo-garment-mini-views'),
        }
      })
      console.log('LAYOUT', JSON.stringify(boxes))
      break
    }
  }
  const trace = await page.evaluate(() => ({ events: window.__garmentHoverTrace, exists: !!document.querySelector('[data-library-preview^="Garment:"]') }))
  console.log(JSON.stringify({ exists: trace.exists, events: trace.events.filter(v => v.event !== 'popup move').slice(-20) }))
} finally {
  await browser.close()
}
