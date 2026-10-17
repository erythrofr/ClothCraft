import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1650, height: 1050 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.GARMENT_STUDIO_URL || 'http://127.0.0.1:5188/?desktop=1', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  const twoD = page.locator('.clo-corner-toolkit-2d')
  const threeD = page.locator('.clo-corner-toolkit-3d')
  assert.equal(await twoD.locator('.clo-corner-tool-group').count(), 6)
  assert.equal(await threeD.locator('.clo-corner-tool-group').count(), 5)
  assert.equal(await twoD.locator('.clo-corner-tool-group > button .cad-tool-icon').count(), 6)
  assert.equal(await threeD.locator('.clo-corner-tool-group > button .cad-tool-icon').count(), 5)
  for (const dimension of [twoD, threeD]) {
    assert.equal(await dimension.locator('.clo-corner-tool-group > button:not(:has(.cad-tool-icon))').count(), 0,
      'Every corner tool requires a real CAD icon')
  }

  await twoD.getByRole('button', { name: 'Edit Curves', exact: true }).click()
  assert.ok((await page.locator('svg.pattern-canvas').getAttribute('class')).includes('tool-curve'),
    '2D quick icon did not invoke the real curve tool')
  await threeD.getByRole('button', { name: 'Rotate Garment', exact: true }).click()
  assert.equal(await page.locator('.three-mount').getAttribute('data-transform-mode'), 'rotate',
    '3D quick icon did not invoke the real rotation tool')

  // A curve tool should edit curves rather than turn every trailing canvas
  // click into piece selection. Switch explicitly to Select/Transform before
  // testing cross-viewport piece selection (mirrors the actual CLO workflow).
  await twoD.getByRole('button', { name: 'Select / Transform', exact: true }).click()
  await page.locator('.pattern-piece').nth(1).locator('.pattern-fill').evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await page.waitForTimeout(150)
  const selected = await page.locator('.pattern-piece.selected').count()
  assert.equal(selected, 1, 'Exactly one 2D pattern should be selected')
  assert.equal(await page.locator('.pattern-piece.selected .pattern-selection-outline').count(), 1,
    'Selected pattern must have an independent complete yellow contour')
  assert.equal(await page.locator('.pattern-piece.selected .pattern-selection-box').count(), 1,
    'Selected pattern must retain a neutral transform box')
  const colors = await page.locator('.pattern-piece.selected').evaluate(el => ({
    outline: getComputedStyle(el.querySelector('.pattern-selection-outline')).stroke,
    box: getComputedStyle(el.querySelector('.pattern-selection-box')).stroke,
    width: getComputedStyle(el.querySelector('.pattern-selection-outline')).strokeWidth,
  }))
  assert.equal(colors.outline, 'rgb(255, 241, 39)', 'Selected 2D contour must be bright yellow')
  assert.equal(colors.box, 'rgb(138, 139, 141)', 'Transform box must be neutral gray')
  assert.equal(colors.width, '2.9px')
  assert.equal(await page.locator('.three-mount').getAttribute('data-selected-piece'), 'back',
    '2D selection was not synchronized into the 3D garment viewer')

  await page.locator('.pattern-piece').first().locator('.pattern-fill').evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  assert.equal(await page.locator('.three-mount').getAttribute('data-selected-piece'), 'front',
    'Changing selected pattern did not update the 3D viewer')

  await twoD.getByRole('button', { name: 'Edit Pattern Points', exact: true }).hover()
  const editPointOptions = twoD.getByRole('group', { name: 'Edit Pattern Points alternatives' })
  assert.ok(await editPointOptions.getByRole('button', { name: 'Add / Split Point' }).isVisible(),
    'CLO-style tool-family hover flyout did not open')
  await editPointOptions.getByRole('button', { name: 'Add / Split Point' }).click()
  assert.ok((await page.locator('svg.pattern-canvas').getAttribute('class')).includes('tool-split'),
    'Tool-family flyout did not invoke the split-point tool')

  const previewPath = 'qa-viewport-selection-icons-20261013.png'
  await page.screenshot({ path: previewPath })
  assert.deepEqual(errors, [], `Uncaught browser errors: ${errors.join('; ')}`)
  console.log(JSON.stringify({ pass: true, selectedOutline: colors.outline, neutralBoundingBox: colors.box, linked3DSelection: true, quickIconCount: 11, screenshot: previewPath }, null, 2))
} finally {
  await browser.close()
}
