import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Isolated browser profile: never modify the user's saved garment or Chrome
// workspace. Run after starting `npm run dev -- --host 127.0.0.1 --port 5188`.
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1650, height: 1050 } })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(process.env.GARMENT_STUDIO_URL || 'http://127.0.0.1:5188/?desktop=1', { waitUntil: 'domcontentloaded' })
  await page.locator('.template-select').selectOption('tee')
  await page.waitForTimeout(700)
  const canvas = page.locator('.three-mount canvas').first()
  const svg = page.locator('svg.pattern-canvas')
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('garment-studio-project-v1')))

  await canvas.focus()
  for (const [shortcut, expected] of [['w', 'move'], ['e', 'rotate'], ['q', 'orbit'], ['h', 'hand']]) {
    await page.keyboard.press(shortcut)
    assert.equal(await page.locator('.three-mount').getAttribute('data-transform-mode'), expected,
      `CLO-style 3D shortcut ${shortcut} did not select ${expected}`)
  }
  const before3d = await read()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(650)
  const after3d = await read()
  const xBefore = Number(before3d.pieces.find(p => p.id === 'front').arrangement3d.userPlacementDeltaX || 0)
  const xAfter = Number(after3d.pieces.find(p => p.id === 'front').arrangement3d.userPlacementDeltaX || 0)
  assert.ok(Math.abs((xAfter - xBefore) - 0.0025) < 1e-6, '3D arrow nudge did not record a 2.5 mm manual placement hint')

  await svg.focus()
  for (const [shortcut, expected] of [['a', 'tool-select'], ['z', 'tool-point'], ['p', 'tool-pin']]) {
    await page.keyboard.press(shortcut)
    assert.ok((await svg.getAttribute('class')).includes(expected), `2D shortcut ${shortcut} did not select ${expected}`)
  }
  const layoutBefore = (await read()).pieces.find(p => p.id === 'front').layout2d.x
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(650)
  const layoutAfter = (await read()).pieces.find(p => p.id === 'front').layout2d.x
  assert.equal(layoutAfter - layoutBefore, 1, '2D arrow nudge did not move the pattern exactly 1 cm')

  await page.locator('.sim-play').click()
  await page.waitForTimeout(700)
  assert.equal(await canvas.getAttribute('data-auto-fit-placement'), 'correcting', 'Automatic fitted startup did not activate')
  const retainedUserOffset = Number(await canvas.getAttribute('data-auto-fit-retained-user-hint-m'))
  assert.ok(retainedUserOffset >= 0.00249, 'Manual 3D placement hint was silently discarded in auto-fit startup')

  await canvas.focus()
  await page.keyboard.press('h')
  const bounds = await canvas.boundingBox()
  let grabbed = false
  let liveSteps = 0
  for (const y of [0.34, 0.42, 0.50, 0.58, 0.66]) {
    for (const x of [0.4, 0.5, 0.6]) {
      if (grabbed) break
      await page.mouse.move(bounds.x + bounds.width * x, bounds.y + bounds.height * y)
      await page.mouse.down()
      await page.waitForTimeout(70)
      if ((await canvas.getAttribute('data-physics-hand-grab')) === 'active') {
        grabbed = true
        await page.mouse.move(bounds.x + bounds.width * (x + 0.05), bounds.y + bounds.height * (y + 0.05), { steps: 8 })
        await page.waitForTimeout(350)
        liveSteps = Number(await canvas.getAttribute('data-physics-hand-grab-steps'))
        break
      }
      await page.mouse.up()
    }
    if (grabbed) break
  }
  await page.mouse.up()
  assert.ok(grabbed, 'Could not grab the simulated cloth with the Hand tool')
  assert.ok(liveSteps > 0, 'The physical solver stopped while cloth was held')
  assert.equal(await canvas.getAttribute('data-physics-hand-grab'), 'released', 'Hand release did not restore particle mass')
  assert.deepEqual(pageErrors, [], 'Browser experienced runtime errors')

  console.log(JSON.stringify({
    ok: true, shortcut3D: ['Q', 'W', 'E', 'H'], shortcut2D: ['A', 'Z', 'P'],
    panel3dNudgeMm: 2.5, pattern2dNudgeCm: 1,
    autoFitUserHintRetainedM: retainedUserOffset, physicalSolverStepsWhileHolding: liveSteps,
    browserErrors: pageErrors,
  }, null, 2))
} finally {
  await browser.close()
}
