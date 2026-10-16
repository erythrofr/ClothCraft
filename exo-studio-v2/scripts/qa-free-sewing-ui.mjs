import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'
import { createTemplateProject } from '../src/data/templates.js'

const project = createTemplateProject('blank')
project.id = 'qa-free-sewing-browser'
project.version = 21
const first = project.pieces[0]
first.id = 'qa-front'
first.name = 'QA Front'
first.points = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 0, y: 20 }]
first.layout2d = { x: 72, y: 120 }
first.arrangement3d = { x: -0.3, y: 1.3, z: 0.35 }
first.active3d = true
first.curves = {}
const second = structuredClone(first)
second.id = 'qa-back'
second.name = 'QA Back'
second.layout2d = { x: 180, y: 120 }
second.arrangement3d.x = 0.3
project.pieces = [first, second]
project.seams = []

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1720, height: 1080 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript((initialProject) => {
    // This browser is an isolated one-use Playwright context. It never opens
    // or modifies the real local Garment Studio user's existing project.
    if (!window.localStorage.getItem('garment-studio-tee-first-fit-project-v2')) {
      window.localStorage.setItem('garment-studio-tee-first-fit-project-v2', JSON.stringify(initialProject))
    }
  }, project)
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee', { waitUntil: 'domcontentloaded' })
  // SVG hit paths have no paint of their own (CSS handles hit testing), so
  // Playwright marks them hidden despite being attached/interactive.
  await page.locator('.pattern-piece[data-piece-id="qa-front"] .edge-hit').first().waitFor({ state: 'attached', timeout: 15000 })
  await page.locator('.clo-corner-toolkit-2d').getByRole('button', { name: 'Edit Sewing', exact: true }).click()
  assert.ok((await page.locator('.workspace-hint').innerText()).includes('Shift-click'))

  // Dispatch a real browser PointerEvent on the SVG path at a computed
  // screen location (not a hard-coded screenshot coordinate). The event goes
  // through the production React edge hit handler and project history.
  async function pick(pieceId, edgeIndex, fraction, shiftKey = true) {
    await page.evaluate(({ pieceId, edgeIndex, fraction, shiftKey }) => {
      const path = document.querySelector(`.pattern-piece[data-piece-id="${pieceId}"] .edge-hit:nth-of-type(2)`)
      const targets = [...document.querySelectorAll(`.pattern-piece[data-piece-id="${pieceId}"] .edge-hit`)]
      const target = targets[edgeIndex] || path
      if (!target) throw new Error(`Missing editable SVG cutline ${pieceId}:${edgeIndex}`)
      const point = target.getPointAtLength(target.getTotalLength() * fraction)
      const viewport = point.matrixTransform(target.getScreenCTM())
      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0,
        shiftKey, clientX: viewport.x, clientY: viewport.y,
      }))
    }, { pieceId, edgeIndex, fraction, shiftKey })
  }
  async function currentSeams() {
    return page.evaluate(() => JSON.parse(window.localStorage.getItem('garment-studio-tee-first-fit-project-v2') || '{}').seams || [])
  }
  async function createFree(a0, a1, b0, b1) {
    await pick('qa-front', 0, a0)
    assert.equal(await page.locator('.free-sewing-start-marker').count(), 1)
    await pick('qa-front', 0, a1)
    await pick('qa-back', 2, b0)
    assert.equal(await page.locator('.free-sewing-start-marker').count(), 1)
    await pick('qa-back', 2, b1)
    // The editor deliberately writes to localStorage after 550 ms of idle
    // time; checking before that only observes the earlier saved revision.
    await page.waitForTimeout(850)
  }
  await createFree(.14, .32, .12, .30)
  let seams = await currentSeams()
  if (seams.length !== 1) {
    console.log('FREE_SEW_DIAGNOSTIC', JSON.stringify({
      hint: await page.locator('.workspace-hint').innerText(),
      markerCount: await page.locator('.free-sewing-start-marker').count(),
      commandResult: await page.locator('.inspector-footer').allTextContents(),
      seams,
    }))
  }
  assert.equal(seams.length, 1, 'First Free Sewing stitch must be saved')
  assert.equal(seams[0].useExactCorrespondence, true)
  assert.ok(Math.abs(seams[0].a.startT - .14) < .012)
  assert.ok(Math.abs(seams[0].a.endT - .32) < .012)
  assert.ok(Math.abs(seams[0].b.startT - .12) < .012)
  assert.ok(Math.abs(seams[0].b.endT - .30) < .012)
  await createFree(.58, .8, .58, .8)
  seams = await currentSeams()
  assert.equal(seams.length, 2, 'Two disjoint Free Sewing intervals on one edge pair must be supported')
  await createFree(.23, .28, .34, .45)
  assert.equal((await currentSeams()).length, 2, 'Overlapping cutline sewing is rejected without mutating project')
  await page.locator('svg.pattern-canvas').focus()
  await page.keyboard.press('Meta+z')
  await page.waitForTimeout(850)
  assert.equal((await currentSeams()).length, 1, 'Undo must restore the previous free-sewing construction state')
  await page.keyboard.press('Meta+Shift+z')
  await page.waitForTimeout(850)
  assert.equal((await currentSeams()).length, 2, 'Redo must restore both fractional sewing links')
  await page.reload({waitUntil:'domcontentloaded'})
  await page.locator('.pattern-piece[data-piece-id="qa-front"] .edge-hit').first().waitFor({state:'attached'})
  assert.equal((await currentSeams()).length, 2, 'Fractional construction must survive project save and reload')
  await page.locator('.clo-corner-toolkit-2d').getByRole('button', { name: 'Edit Sewing', exact: true }).click()
  assert.ok((await page.locator('.workspace-hint').innerText()).includes('Shift-click'))
  assert.deepEqual(errors, [])
  await page.screenshot({ path: 'qa-free-sewing-ui-20261015.png' })
  console.log(JSON.stringify({
    pass: true, physicallyEditable2dSewing: true,
    freeSewingIntervalsSaved: 2,
    fractionalSewingPreserved: true,
    overlappingSewingRejected: true,
    undoRedoAndReloadVerified: true,
    browserErrors: errors.length,
    screenshot: 'qa-free-sewing-ui-20261015.png',
  }, null, 2))
} finally {
  await browser.close()
}
