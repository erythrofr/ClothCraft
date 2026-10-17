/** Capture the existing EXO GLB-powered tile render, without third-party imagery.
 * Run against the current EXO dev UI: node scripts/build-stage-posters.mjs
 */
import { chromium } from 'playwright-core'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const base = process.env.EXO_QA_URL || 'http://127.0.0.1:5188'
const ids = ['cathedral', 'R02', 'R03', 'S01', 'S10']
await mkdir('public/stage-posters', { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.EXO_CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
  for (const id of ids) {
    // Reload with a single target ID: exactly one card mounts the 3D renderer.
    // No multi-context captures, even when regenerating every poster.
    await page.goto(`${base}/?desktop=1&stagePosterCapture=${id}&testSession=stage-posters`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.getByRole('button', { name: 'Stage', exact: true }).click()
    const catalog = page.locator('.exo-stage-catalog').first()
    await catalog.waitFor({ timeout: 10000 })
    const tile = catalog.locator(`.exo-stage-card:has([data-stage-id="${id}"])`)
    const canvas = tile.locator('canvas')
    await canvas.waitFor({ timeout: 15000 })
    assert.equal(await catalog.locator('canvas').count(), 1, `${id}: capture opened more than one WebGL card`)
    await page.waitForFunction(id => document.querySelector(`.exo-stage-card [data-stage-id="${id}"] canvas`)?.dataset.stageStatus === 'ready', id, { timeout: 25000 })
    const result = await canvas.evaluate(el => {
      const context = el.getContext('webgl2') || el.getContext('webgl')
      return { meshes: Number(el.dataset.previewMeshCount || 0), width: el.width, height: el.height, hasContext: Boolean(context), stageId: el.dataset.previewStageId }
    })
    assert.equal(result.stageId, id, `${id}: loaded wrong GLB preview`)
    assert.ok(result.hasContext && result.meshes > 0, `${id}: missing GLB geometry or WebGL context`)
    // Capture the real rendered canvas and its tile background at 2x resolution.
    const image = await tile.locator('.exo-stage-illustration').screenshot({ type: 'png' })
    // StageCatalog loads PNG URLs. Keep the generator deterministic regardless
    // of whether an optional image converter happens to be installed.
    const target = `public/stage-posters/${id}.png`
    const temporary = `public/stage-posters/.${id}.png.tmp`
    await writeFile(temporary, image)
    await rename(temporary, target)
    console.log(JSON.stringify({ id, ...result, bytes: image.length, saved: target }))
  }
} finally { await browser.close() }
