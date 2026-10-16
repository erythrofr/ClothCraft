// A live, isolated browser acceptance of the 2D drafting snapping tools.
// This uses the dedicated tee testSession storage, NOT a user's open project.
import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1750, height: 1120 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee', { waitUntil: 'domcontentloaded' })
  await page.locator('.pattern-piece').first().waitFor({ state: 'visible', timeout: 15000 })
  const grid = page.getByRole('checkbox', { name: 'Snap to Grid' })
  const pattern = page.getByRole('checkbox', { name: 'Snap to Pattern' })
  assert.equal(await grid.isChecked(), false)
  assert.equal(await pattern.isChecked(), true)
  const settings = page.locator('.clo-draft-snap-settings')
  assert.ok(await settings.isVisible(), 'CLO-style drafting guides belong in the right Property Editor')
  assert.equal(await page.locator('.pattern-editor-shell .clo-draft-snap-settings').count(), 0,
    'No floating 2D snapping inspector may cover pattern movement')

  await grid.check()
  await page.getByRole('combobox', { name: 'Drafting grid distance in centimeters' }).selectOption('5')
  const currentProject = () => page.evaluate(() => JSON.parse(
    localStorage.getItem('garment-studio-tee-first-fit-project-v2')))
  // This isolated test session initially opens the in-memory default tee;
  // persist it with a valid keyboard nudge before reading its saved state.
  await page.locator('.pattern-canvas').focus()
  await page.locator('.pattern-canvas').press('ArrowRight')
  await page.waitForTimeout(650)
  const projectBefore = await currentProject()
  assert.ok(projectBefore?.pieces?.length >= 4, 'Test-session project was not persisted')
  const piece = page.locator('.pattern-piece[data-piece-id="front"]')
  await page.getByRole('button', { name: 'Select / Transform', exact: true }).first().click()
  const fill = piece.locator('.pattern-fill')
  const bounds = await fill.boundingBox()
  const origin = { x: bounds.x + bounds.width * .47, y: bounds.y + bounds.height * .54 }
  await page.mouse.move(origin.x, origin.y)
  await page.mouse.down()
  await page.mouse.move(origin.x + 37, origin.y + 18, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(800)
  const moved = (await currentProject()).pieces.find(item => item.id === 'front')
  assert.ok(Math.hypot(moved.layout2d.x - projectBefore.pieces[0].layout2d.x,
    moved.layout2d.y - projectBefore.pieces[0].layout2d.y) > 2,
    'Moving a pattern must change its actual saved 2D layout')
  assert.ok(Math.abs(moved.layout2d.x / 5 - Math.round(moved.layout2d.x / 5)) < 1e-7)
  assert.ok(Math.abs(moved.layout2d.y / 5 - Math.round(moved.layout2d.y / 5)) < 1e-7)
  assert.deepEqual(moved.points, projectBefore.pieces[0].points,
    'Snap-to-grid must never alter a sewing cutline')
  assert.deepEqual((await currentProject()).seams, projectBefore.seams,
    'Snap-to-grid must preserve sewing references')

  // Alt temporarily disables snapping for a continuous off-grid move.
  const movedBounds = await fill.boundingBox()
  const a = { x: movedBounds.x + movedBounds.width * .47, y: movedBounds.y + movedBounds.height * .54 }
  await page.keyboard.down('Alt')
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(a.x + 19, a.y + 13, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await page.waitForTimeout(800)
  const offGrid = (await currentProject()).pieces.find(item => item.id === 'front')
  assert.ok(Math.abs(offGrid.layout2d.x / 5 - Math.round(offGrid.layout2d.x / 5)) > .01
    || Math.abs(offGrid.layout2d.y / 5 - Math.round(offGrid.layout2d.y / 5)) > .01,
  'Holding Alt during a drag must temporarily bypass grid snapping')

  // Preferences must persist across reloads in this isolated session.
  await page.reload({ waitUntil: 'domcontentloaded' })
  assert.equal(await grid.isChecked(), true)
  assert.equal(await pattern.isChecked(), true)
  assert.equal(await page.getByRole('combobox', { name: 'Drafting grid distance in centimeters' }).inputValue(), '5')
  await grid.uncheck()
  assert.equal(await grid.isChecked(), false)
  assert.ok(await page.locator('.pattern-canvas').isVisible())
  assert.equal(await page.locator('.pattern-editor-shell .draft-edge-inspector').count(), 0)
  assert.deepEqual(errors, [], 'Uncaught browser errors in snapping editor')
  console.log(JSON.stringify({
    pass: true, snappedPiece: [moved.layout2d.x, moved.layout2d.y],
    altBypassedGrid: true, cutlineAndSeamsPreserved: true, persistedPreferences: true,
    drawingUnobstructed: true, browserErrors: errors.length,
  }))
} finally {
  await browser.close()
}
