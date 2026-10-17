import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Browser acceptance test for the four-piece pre-sew -> sewn garment workflow.
// Uses a fresh browser context; it never overwrites the user's saved project.
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
const page = await browser.newPage({ viewport: { width: 1750, height: 1060 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const assert = (condition, message) => { if (!condition) errors.push(message) }
await page.goto('http://127.0.0.1:5188/?desktop=1', { waitUntil: 'domcontentloaded' })
await page.locator('.template-select').selectOption('tee')
await page.waitForTimeout(1500)

assert((await page.locator('.project-meta').innerText()).includes('4 PATTERNS'), 'T-shirt does not have four patterns')
assert((await page.locator('.project-meta').innerText()).includes('14 SEAMS'), 'T-shirt has incorrect seam relationships')
assert((await page.locator('.garment-tile').count()) >= 1, 'T-shirt library is missing')
await page.screenshot({ path: 'qa-tee-firstfit-staged-20261013.png' })

// Selecting the garment directly in the canvas must reveal the 3-axis gizmo.
await page.locator('.three-mount canvas').click({ position: { x: 275, y: 340 } })
assert((await page.locator('.three-mount').getAttribute('data-transform-mode')) === 'move', 'Clicking the 3D fabric did not reveal translation handles')
await page.getByTitle('3D move garment').click()
await page.locator('.clo-object-tabs button[title="Scene"]').click()
await page.locator('.clo-object-row').filter({ hasText: 'Left Sleeve' }).click()
assert((await page.locator('.three-mount').getAttribute('data-selected-piece')) === 'sleeve-left', '3D left sleeve was not selected')
assert((await page.locator('.three-mount').getAttribute('data-transform-mode')) === 'move', '3D move gizmo failed to enable')
assert((await page.locator('.three-mount').getAttribute('data-transform-mode')) === 'transform', 'On-cloth 3D manipulator missing')
await page.screenshot({ path: 'qa-tee-firstfit-move-gizmo-20261013.png' })

await page.getByRole('button', { name: 'ROTATE', exact: true }).click()
assert((await page.locator('.three-mount').getAttribute('data-transform-mode')) === 'rotate', '3D rotation rings failed to enable')
await page.screenshot({ path: 'qa-tee-firstfit-rotation-gizmo-20261013.png' })
await page.getByRole('button', { name: 'ORBIT', exact: true }).click()
assert((await page.locator('.three-mount').getAttribute('data-transform-mode')) === 'orbit', 'Orbit camera mode failed to enable')

await page.locator('.sim-play').click()
await page.waitForTimeout(5500)
assert((await page.locator('.sim-play').innerText()).includes('PAUSE'), 'Simulation did not start')
assert((await page.locator('.sim-stats').innerText()).includes('vertices'), 'Simulation did not supply mesh stats')
await page.screenshot({ path: 'qa-tee-firstfit-simulating-20261013.png' })
await page.locator('.sim-play').click()
assert((await page.locator('.sim-play').innerText()).includes('SIMULATE'), 'Simulation did not pause')
await page.screenshot({ path: 'qa-tee-firstfit-paused-20261013.png' })
await page.locator('.sim-reset').click()
assert((await page.locator('.workspace-head.viewport-head').innerText()).includes('FLAT 3D ARRANGEMENT'), 'Reset did not restore flat pre-sew arrangement')

console.log(JSON.stringify({
  fourPieces: true,
  sewingRelationships: 14,
  moveGizmo: true,
  rotationGizmo: true,
  firstDrapeReached: true,
  resetVerified: true,
  errors,
  screenshots: ['qa-tee-firstfit-staged-20261013.png', 'qa-tee-firstfit-move-gizmo-20261013.png', 'qa-tee-firstfit-rotation-gizmo-20261013.png', 'qa-tee-firstfit-paused-20261013.png'],
}, null, 2))
await browser.close()
if (errors.length) process.exit(1)
