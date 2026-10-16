// Real browser QA of CLO-style numeric split-line tools against current tee
// state. Uses isolated testSession=tee, never the user's active project.
import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'
import { edgeLength } from '../src/core/project.js'

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
const projectKey = 'garment-studio-tee-first-fit-project-v2'
try {
  const page = await browser.newPage({ viewport: { width: 1750, height: 1120 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee', { waitUntil: 'domcontentloaded' })
  await page.locator('.pattern-piece').first().waitFor({ state: 'visible', timeout: 15000 })
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), projectKey)
  // Force the session's default project to persist, without changing its
  // drafting boundary. The key is isolated from everyday projects.
  await page.locator('svg.pattern-canvas').focus()
  await page.locator('svg.pattern-canvas').press('ArrowRight')
  await page.waitForTimeout(650)
  const source = await saved()
  assert.ok(source?.pieces?.length >= 4)
  const front = source.pieces.find(piece => piece.id === 'front')
  // Verify both previously sewn-edge remapping and geometric arc length.
  const sewn = source.seams.find(seam => seam.a?.pieceId === 'front' || seam.b?.pieceId === 'front')
  assert.ok(sewn, 'Acceptance fixture requires a sewn front pattern edge')
  const sewnEndpoint = sewn.a?.pieceId === 'front' ? sewn.a : sewn.b
  const index = sewnEndpoint.edgeIndex
  const oldLength = edgeLength(front, index)
  assert.ok(oldLength > 2)

  // Select the real Split Line CAD tool and opt into an editable inspector;
  // normal click-to-add remains the default behavior.
  await page.getByRole('button', { name: 'Split pattern edge' }).click()
  assert.ok(await page.getByRole('button', { name: 'Click to add' }).isVisible())
  await page.getByRole('button', { name: 'Precise split' }).click()
  const selectedEdge = page.locator('.pattern-piece[data-piece-id="front"] .edge-hit').nth(index)
  await selectedEdge.dispatchEvent('pointerdown', { button: 0, pointerId: 61, isPrimary: true })
  assert.ok(await page.getByRole('button', { name: 'Split selected edge' }).isEnabled())
  await page.getByRole('spinbutton', { name: 'Number of equal edge segments' }).fill('3')
  await page.getByRole('button', { name: 'Split selected edge' }).click()
  await page.waitForTimeout(850)
  const uniform = await saved()
  const changedFront = uniform.pieces.find(piece => piece.id === 'front')
  assert.equal(changedFront.points.length, front.points.length + 2)
  for (let i = 0; i < 3; i++) {
    const length = edgeLength(changedFront, index + i)
    assert.ok(Math.abs(length - oldLength / 3) < .015,
      'Uniform split must divide TRUE cutting lengths equally, not just Bézier parameter')
  }
  assert.equal(uniform.pieces.length, source.pieces.length)
  for (const piece of uniform.pieces.filter(piece => piece.id !== 'front')) {
    assert.deepEqual(piece.points, source.pieces.find(item => item.id === piece.id).points,
      'Splitting an edge may not distort other patterns')
  }
  for (const seam of uniform.seams) {
    for (const endpoint of [seam.a, seam.b]) {
      const piece = uniform.pieces.find(item => item.id === endpoint?.pieceId)
      assert.ok(piece && endpoint.edgeIndex >= 0 && endpoint.edgeIndex < piece.points.length,
        'All seam endpoint references must remain valid after a sewn edge is divided')
    }
  }

  // A one-click Undo must reverse the entire 3-way division, not just the
  // final split, because it was performed in one project transaction.
  await page.locator('svg.pattern-canvas').focus()
  await page.keyboard.press('ControlOrMeta+z')
  await page.waitForTimeout(850)
  const undone = await saved()
  const undoneFront = undone.pieces.find(piece => piece.id === 'front')
  assert.equal(undoneFront.points.length, front.points.length,
    'Uniform multi-split must undo as exactly one editing gesture')
  assert.deepEqual(undone.seams, source.seams,
    'Undo must restore the original sewing graph')

  // Re-select original edge and split by a measured distance. Invalid values
  // must show inline feedback and never change the project document.
  await page.locator('.pattern-piece[data-piece-id="front"] .edge-hit').nth(index)
    .dispatchEvent('pointerdown', { button: 0, pointerId: 63, isPrimary: true })
  await page.getByRole('combobox', { name: 'Numeric edge split method' }).selectOption('length')
  const lengthField = page.getByRole('spinbutton', { name: 'Split distance from edge start in centimeters' })
  await lengthField.fill(String(oldLength * 0.25))
  await page.getByRole('button', { name: 'Split selected edge' }).click()
  await page.waitForTimeout(800)
  const byLength = await saved()
  const byLengthFront = byLength.pieces.find(piece => piece.id === 'front')
  if (byLengthFront.points.length !== front.points.length + 1) console.log('SPLIT_LENGTH_DIAGNOSTIC',JSON.stringify({
    sourcePoints:front.points.length, actualPoints:byLengthFront.points.length,
    alerts:await page.getByRole('alert').allInnerTexts(),
    chosenEdge:await page.locator('.draft-edge-inspector').allInnerTexts(),
    selectedText:await page.locator('.clo-draft-split-settings').allInnerTexts(),
  }).slice(0,2100))
  assert.equal(byLengthFront.points.length, front.points.length + 1)
  assert.ok(Math.abs(edgeLength(byLengthFront, index) - oldLength * .25) < .015)

  await page.locator('svg.pattern-canvas').focus()
  await page.keyboard.press('ControlOrMeta+z')
  await page.waitForTimeout(800)
  await page.locator('.pattern-piece[data-piece-id="front"] .edge-hit').nth(index)
    .dispatchEvent('pointerdown', { button: 0, pointerId: 65, isPrimary: true })
  await lengthField.fill(String(oldLength * 2))
  await page.getByRole('button', { name: 'Split selected edge' }).click()
  assert.ok(await page.getByRole('alert').filter({ hasText: '5%' }).count(),
    'Invalid split outside the 5%-95% cutline must be rejected inline')
  const invalid = await saved()
  assert.equal(invalid.pieces.find(piece => piece.id === 'front').points.length,
    front.points.length, 'Rejected split must not change cutline geometry')
  assert.equal(await page.locator('.pattern-editor-shell .draft-edge-inspector').count(), 0,
    'Precise splitting may not reopen a floating canvas pop-up')
  assert.deepEqual(errors, [], 'Uncaught 2D split browser errors')
  console.log(JSON.stringify({
    pass: true, oldEdgeLengthCm: oldLength,
    equalLengthSegments: 3, lengthBasedSplit: true,
    sewnEdgeTopologyRemapped: true, singleStepUndo: true,
    invalidSplitRejected: true, noFloatingPopup: true, browserErrors: errors.length,
  }))
} finally {
  await browser.close()
}
