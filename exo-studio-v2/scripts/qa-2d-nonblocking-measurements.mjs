import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Actual isolated browser UI acceptance. None of these operations mutates
// the user's existing Mac document or everyday localStorage project.
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})

const appUrl = 'http://127.0.0.1:5188/?desktop=1&testSession=tee'
try {
  const page = await browser.newPage({ viewport: { width: 1750, height: 1120 } })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
  const canvas = page.locator('.pattern-canvas')
  await canvas.waitFor({ state: 'visible', timeout: 20000 })
  const dock = page.locator('#clo-pattern-properties-host')
  const sidebar = page.locator('.clo-inspector')
  const audit = dock.locator('.clo-2d-docked-audit')
  const initialBounds = await canvas.boundingBox()
  const unchangedCanvas = async () => {
    const bounds = await canvas.boundingBox()
    assert.ok(bounds.width >= initialBounds.width - 2 && bounds.height >= initialBounds.height - 2,
      'Canvas must not shrink when pattern dimensions are opened')
    assert.equal(await page.locator('.pattern-editor-shell .draft-edge-inspector').count(), 0,
      'Precision inspectors must never float above the 2D canvas')
    assert.equal(await page.locator('.pattern-editor-shell .draft-audit-panel').count(), 0,
      'QA measurements must never open as a 2D canvas popup')
    assert.equal(await page.locator('.draft-audit-toggle').count(), 0,
      'Old measurement popup trigger must be removed')
  }
  const inSidebar = async selector => {
    const located = dock.locator(selector).first()
    assert.ok(await located.isVisible(), selector + ' must be visible in the Property Editor')
    assert.equal(await located.evaluate((element, root) => root?.contains(element), await dock.elementHandle()), true)
    const bb = await located.boundingBox()
    const parent = await sidebar.boundingBox()
    assert.ok(bb.x >= parent.x - 2 && bb.x + bb.width <= parent.x + parent.width + 2,
      selector + ' must remain inside the right inspector, not cover the pattern')
  }

  await unchangedCanvas()
  assert.equal(await audit.evaluate(element => element.open), false,
    'Pattern measurement QA must start closed')

  const front = page.locator('.pattern-piece[data-piece-id="front"]')
  await page.getByRole('button', { name: 'Edit Pattern Points', exact: true }).first().click()
  const properties = page.locator('.clo-property-panel')
  await properties.evaluate(element => { element.scrollTop = element.scrollHeight })
  assert.ok(await properties.evaluate(element => element.scrollTop) > 80,
    'Regression fixture must start with a scrolled Property Editor')
  await front.locator('.pattern-node').first().click({ force: true })
  await page.waitForFunction(() => {
    const element = document.querySelector('.clo-property-panel')
    return element && element.scrollTop < 15
  }, { timeout: 5000 })
  await inSidebar('.precision-point-inspector')
  await unchangedCanvas()
  assert.equal(await audit.evaluate(element => element.open), false,
    'Selecting points must not auto-open measurement QA')

  await page.getByRole('button', { name: 'Edit Curves', exact: true }).first().click()
  await front.locator('.curve-control circle').first().click({ force: true })
  await inSidebar('.precision-curve-inspector')
  await unchangedCanvas()
  assert.equal(await audit.evaluate(element => element.open), false,
    'Editing a curve must not auto-open the measurement list')

  await front.locator('.edge-hit').first().dispatchEvent('pointerdown', {
    button: 0, pointerId: 36, isPrimary: true,
  })
  await inSidebar('.draft-edge-inspector')
  await unchangedCanvas()

  await audit.locator('summary').click()
  assert.equal(await audit.evaluate(element => element.open), true,
    'QA dimensions must be accessible only by an explicit click')
  await page.waitForFunction(() => (
    document.querySelectorAll('#clo-pattern-properties-host .clo-2d-docked-audit .draft-audit-scroll > button').length >= 4
  ), { timeout: 5000 })
  assert.ok(await audit.locator('.draft-audit-scroll > button').count() >= 4)
  await unchangedCanvas()
  await audit.locator('summary').click()
  assert.equal(await audit.evaluate(element => element.open), false)
  await page.getByRole('combobox', { name: 'Workspace', exact: true }).selectOption('Sewing')
  assert.ok(await dock.isVisible(),
    'Precision measurements must stay in the Property Editor while using Sewing tools')
  await page.getByRole('combobox', { name: 'Workspace', exact: true }).selectOption('Render')
  assert.equal(await dock.isVisible(), false,
    'Pattern-only measurement properties must not appear in the Render workspace')
  await page.getByRole('combobox', { name: 'Workspace', exact: true }).selectOption('Pattern')
  assert.equal(await audit.evaluate(element => element.open), false,
    'Switching workspaces must never reopen 2D QA')

  // A real two-click tape measurement must not trigger a floating audit.
  await page.getByTitle('Tape measure', { exact: true }).first().click()
  const fill = front.locator('.pattern-fill').first()
  const fillBounds = await fill.boundingBox()
  const x = fillBounds.x + fillBounds.width * .47
  const y = fillBounds.y + fillBounds.height * .55
  // A half-finished measurement may not survive tool changes or Escape:
  // otherwise an old first point could create a surprise tape later.
  await fill.dispatchEvent('pointerdown', { button: 0, pointerId: 47, clientX: x, clientY: y })
  assert.equal(await page.locator('.measurement-pending').count(), 1)
  await page.getByRole('button', { name: 'Edit Pattern Points', exact: true }).first().click()
  await page.locator('.measurement-pending').waitFor({ state: 'detached', timeout: 5000 })
  assert.equal(await page.locator('.measurement-pending').count(), 0)
  await page.getByTitle('Tape measure', { exact: true }).first().click()
  await fill.dispatchEvent('pointerdown', { button: 0, pointerId: 49, clientX: x, clientY: y })
  assert.equal(await page.locator('.measurement-pending').count(), 1)
  await canvas.focus()
  await canvas.press('Escape')
  await page.locator('.measurement-pending').waitFor({ state: 'detached', timeout: 5000 })
  assert.equal(await page.locator('.measurement-pending').count(), 0)
  await fill.dispatchEvent('pointerdown', { button: 0, pointerId: 50, clientX: x, clientY: y })
  await fill.dispatchEvent('pointerdown', { button: 0, pointerId: 51, clientX: x + 20, clientY: y + 14 })
  await page.waitForTimeout(950)
  const saved = await page.evaluate(() => JSON.parse(
    localStorage.getItem('garment-studio-tee-first-fit-project-v2') || 'null',
  ))
  assert.equal(saved?.customMeasurements?.length, 1, 'Two tape clicks should create one stored POM')
  await unchangedCanvas()
  assert.equal(await audit.evaluate(element => element.open), false,
    'Creating a measurement must not open QA automatically')

  // Regression: moving a pattern from either its fill or its edge should
  // never trigger the former context menu or edge-measurement inspector.
  await page.getByRole('button', { name: 'Select / Transform', exact: true }).first().click()
  const initialLayout = await page.evaluate(() => JSON.parse(
    localStorage.getItem('garment-studio-tee-first-fit-project-v2') || 'null',
  ).pieces.find(piece => piece.id === 'front').layout2d)
  const edge = front.locator('.edge-hit').first()
  const edgeBounds = await edge.boundingBox()
  const fromX = edgeBounds.x + edgeBounds.width * .5
  const fromY = edgeBounds.y + edgeBounds.height * .5
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  await page.mouse.move(fromX + 45, fromY + 32, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(850)
  const movedLayout = await page.evaluate(() => JSON.parse(
    localStorage.getItem('garment-studio-tee-first-fit-project-v2') || 'null',
  ).pieces.find(piece => piece.id === 'front').layout2d)
  assert.ok(Math.hypot(movedLayout.x - initialLayout.x, movedLayout.y - initialLayout.y) > 0.1,
    'Dragging the edge in Select mode must actually move the pattern')
  assert.equal(await dock.locator('.draft-edge-inspector').count(), 0,
    'Dragging a pattern must not activate the precision edge popup')
  assert.equal(await page.locator('.clo-pattern-context-menu').count(), 0,
    'The 2D context menu must not appear while moving a pattern')
  const eventCancelled = await canvas.evaluate(element => !element.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }),
  ))
  assert.equal(eventCancelled, true, 'Trackpad contextmenu should be suppressed in 2D')
  assert.equal(await page.locator('.clo-pattern-context-menu').count(), 0)
  await unchangedCanvas()

  assert.deepEqual(pageErrors, [])
  console.log(JSON.stringify({
    pass: true,
    canvasUnobstructed: true,
    dockedEditors: ['point', 'curve', 'edge'],
    measurementAuditOptInOnly: true,
    measurementAddedWithoutPopup: true,
    browserErrors: pageErrors.length,
  }))
} finally {
  await browser.close()
}
