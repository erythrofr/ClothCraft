// Capture a deterministic screenshot of our own 2D Pattern Window for future
// *reference-based* comparisons. Does not browse, alter, or copy CLO3D.
// Save in a Git-ignored folder so production distributions cannot accidentally
// include reference artwork or user garment imagery.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'replica/clone-screens')
const output = path.join(dir, 'S01-2d-pattern-window.png')
const fullOutput = path.join(dir, 'S01-whole-app-1440.png')
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', err => errors.push(err.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee',
    { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.locator('.pattern-piece').first().waitFor({ state: 'visible', timeout: 15000 })
  const region = page.locator('.pattern-editor-shell')
  await region.waitFor({ state: 'visible' })
  const bounds = await region.boundingBox()
  assert.ok(bounds && bounds.width > 150 && bounds.height > 150)
  fs.mkdirSync(dir, { recursive: true })
  // Match the saved 1440x900 workspace for a reproducible right-side
  // 2D + palette crop. Source crop is assessed separately from garment art.
  const whole = await page.screenshot({ path: fullOutput, animations: 'disabled' })
  assert.ok(whole.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
  const png = await region.screenshot({ path: output, animations: 'disabled', timeout: 15000 })
  assert.ok(png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'Expected a PNG')
  const toolbox = await page.locator('.clo-corner-toolkit-2d').boundingBox()
  const palette = await page.locator('.clo-right-tool-palette').boundingBox()
  const firstPaletteTool = await page.locator('.clo-reference-dual-bars button').first().boundingBox()
  assert.ok(toolbox && toolbox.width <= 42, '2D quick tools must form a slim vertical CLO-style utility strip')
  assert.ok(palette && firstPaletteTool && firstPaletteTool.y - palette.y <= 55,
    'Twin drafting/sewing rails should begin immediately after the slim heading')
  assert.equal(await page.locator('.clo-right-tool-palette.all-tools .clo-palette-workflows').isVisible(), false,
    'Redundant quick workflow block should be hidden in all-tools layout')
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(dir, 'S01-capture.json'), JSON.stringify({
    app: 'Garment Studio', screen: 'S01 2D drafting',
    viewport: [1440, 900], panelBounds: [bounds.width, bounds.height],
    image: path.basename(output),
    pngSha256: crypto.createHash('sha256').update(png).digest('hex'),
    fullApp: path.basename(fullOutput),
    fullAppSha256: crypto.createHash('sha256').update(whole).digest('hex'),
    toolbarSize: [toolbox.width, toolbox.height],
    firstTwinRailOffsetY: firstPaletteTool.y - palette.y,
    note: 'Owned application testSession=tee. Not a CLO3D reference screenshot.',
  }, null, 2) + '\n')
  console.log(JSON.stringify({ pass: true, image: output, bytes: png.length, browserErrors: errors.length }))
} finally {
  await browser.close()
}
