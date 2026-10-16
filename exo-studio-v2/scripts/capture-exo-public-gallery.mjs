// Real, current EXO Sample 3D captures. Isolated browser/test fixture;
// never uses the restricted CLO/Thomas avatar or private user project data.
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, 'screenshots')
fs.mkdirSync(output, { recursive: true })
const origin = process.env.EXO_SCREENSHOT_ORIGIN || 'http://127.0.0.1:5173'
const chromeOverride = process.env.EXO_CHROME_PATH
const browser = await chromium.launch({
  headless: true,
  ...(chromeOverride ? { executablePath: chromeOverride } : { channel: 'chrome' }),
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
const context = await browser.newContext({
  viewport: { width: 1860, height: 1130 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
const results = []
const capture = async (name, kind = 'page') => {
  await page.waitForTimeout(900)
  const dest = path.join(output, name)
  const element = kind === 'viewport'
    ? page.locator('.workspaces > .viewport-shell').first()
    : kind === 'pattern'
      ? page.locator('.workspaces > .pattern-editor-shell').first()
      : page
  await element.screenshot({ path: dest, animations: 'disabled', timeout: 30000 })
  const size = fs.statSync(dest).size
  results.push({ name, size, kind })
  if (size < 15000) throw new Error('Screenshot unexpectedly small: ' + name)
}
try {
  await page.goto(origin + '/?desktop=1&testSession=tee', { waitUntil: 'domcontentloaded' })
  await page.locator('.three-mount canvas').waitFor({ state: 'visible', timeout: 30000 })
  await page.locator('.pattern-piece[data-piece-id="front"]').waitFor({ timeout: 30000 })
  const projectInfo = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(key => /garment.*project|first.fit/.test(key))
    const projects = keys.map(key => {
      try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
    }).filter(project => project?.pieces?.length)
    return { keys, project: projects[0] || null }
  })
  const project = projectInfo.project
  // Current UI may use an internal testSession state without serializing
  // until first edit. The page must still render a real first-party pattern.
  if (project?.avatar?.model === 'clo-thomas') throw new Error('Restricted avatar: screenshots refused')
  const profiles = page.getByRole('combobox', { name: 'CLO-style workspace layout presets' })
  await capture('exo-2026-current-pattern-and-3d-grid.png')
  await capture('exo-2026-current-3d-garment-grid.png', 'viewport')
  await capture('exo-2026-current-2d-pattern-grid.png', 'pattern')
  await profiles.selectOption('materials')
  await capture('exo-2026-fabric-and-3d-grid.png')
  await capture('exo-2026-fabric-viewport.png', 'viewport')
  await profiles.selectOption('render')
  await capture('exo-2026-3d-render-studio.png')
  await capture('exo-2026-3d-model-grid-detail.png', 'viewport')
  await profiles.selectOption('sewing')
  await capture('exo-2026-sewing-workspace.png')
  console.log(JSON.stringify({ ok: true, avatar: project?.avatar?.model || 'procedural',
    localStorageKeys: projectInfo.keys,
    source: origin + '/?desktop=1&testSession=tee', screenshots: results,
    canvasCount: await page.locator('.three-mount canvas').count(), errors }, null, 2))
} finally {
  await context.close()
  await browser.close()
}
