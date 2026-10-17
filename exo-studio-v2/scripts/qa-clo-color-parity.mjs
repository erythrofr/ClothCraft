import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'] })
try {
  const page = await browser.newPage({ viewport: { width: 1650, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee', { waitUntil: 'domcontentloaded' })
  await page.locator('.pattern-piece').first().waitFor()
  const colors = await page.evaluate(() => {
    const css = selector => getComputedStyle(document.querySelector(selector))
    return {
      draftingBoard: css('.pattern-editor-shell .pattern-canvas').backgroundColor,
      library: css('.clo-library-categories').backgroundColor,
      objectBrowser: css('.clo-object-list').backgroundColor,
      selectedOutline: css('.pattern-piece.selected .pattern-selection-outline').stroke,
      selectionBox: css('.pattern-piece.selected .pattern-selection-box').stroke,
      faceImageCount: document.querySelectorAll('.draft-avatar-render').length,
      gridCoverCount: document.querySelectorAll('[data-grid-coverage="overscanned"]').length,
      separateSleeves: [...document.querySelectorAll('.pattern-piece[data-piece-id]')].filter(el => /sleeve/.test(el.getAttribute('data-piece-id'))).length,
      categories: [...document.querySelectorAll('.clo-property-category-group-trigger > span')].map(el => el.textContent),
    }
  })
  assert.equal(colors.draftingBoard, 'rgb(198, 199, 201)')
  assert.equal(colors.library, 'rgb(45, 45, 46)')
  assert.equal(colors.objectBrowser, 'rgb(45, 45, 46)')
  assert.equal(colors.selectedOutline, 'rgb(255, 241, 39)')
  assert.equal(colors.selectionBox, 'rgb(138, 139, 141)')
  assert.equal(colors.faceImageCount, 0)
  assert.equal(colors.gridCoverCount, 1)
  assert.equal(colors.separateSleeves, 2)
  assert.deepEqual(colors.categories, ['2D Pattern', 'Sewing', '3D Form', 'Material', 'Environment'])
  assert.deepEqual(errors, [])
  await page.screenshot({ path: 'qa-clo-color-parity-20261013.png' })
  console.log(JSON.stringify({ pass: true, ...colors, capture: 'qa-clo-color-parity-20261013.png' }, null, 2))
} finally { await browser.close() }
