/** Regression QA for the five GLB stages after swapping catalog cards to static GLB posters.
 * A single Chromium instance covers desktop + narrow mobile and checks real hover
 * and active viewport GLB loading. Run: node scripts/qa-stage-posters-lifecycle-20261017.mjs
 */
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const base = process.env.EXO_QA_URL || 'http://127.0.0.1:5188'
const ids = ['cathedral', 'R02', 'R03', 'S01', 'S10']
const timeout = 18_000
const posterAssets = []

for (const id of ids) {
  const poster = await readFile(`public/stage-posters/${id}.png`)
  const path = id === 'cathedral'
    ? 'public/library-3d/MIKRISTIAN_Cathedral_House.glb'
    : `public/stage-scenes/${id}.glb`
  assert.deepEqual([...poster.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${id}: invalid PNG`)
  const width = poster.readUInt32BE(16)
  const height = poster.readUInt32BE(20)
  assert.ok(width >= 150 && height >= 100, `${id}: poster too small`)
  const glb = await stat(path)
  assert.ok(glb.size > 10_000, `${id}: missing or invalid GLB`)
  posterAssets.push({ id, pngBytes: poster.length, width, height, glbBytes: glb.size })
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EXO_CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})

const results = []
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 900 },
      deviceScaleFactor: 1,
    })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.setDefaultTimeout(timeout)
    await page.goto(`${base}/?desktop=1&testSession=stage-posters-lifecycle-${width}`, {
      waitUntil: 'domcontentloaded', timeout,
    })
    await page.getByRole('button', { name: 'Stage', exact: true }).click()
    const catalog = page.locator('.exo-stage-catalog').first()
    await catalog.waitFor({ timeout })
    const cards = catalog.locator('.exo-stage-card')
    assert.equal(await cards.count(), 5, `${width}: expected five cards`)
    const actualIds = await cards.evaluateAll(nodes =>
      nodes.map(node => node.querySelector('[data-stage-id]')?.dataset.stageId))
    assert.deepEqual(actualIds, ids, `${width}: curated IDs or order drifted`)
    assert.equal(await catalog.locator('canvas').count(), 0, `${width}: idle library created WebGL canvases`)

    const posters = []
    for (const id of ids) {
      const card = cards.filter({ has: page.locator(`[data-stage-id="${id}"]`) })
      const img = card.locator('img.exo-stage-poster')
      await img.scrollIntoViewIfNeeded()
      await img.evaluate(image => image.decode().catch(() => {}))
      const data = await img.evaluate(image => ({
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        width: Math.round(image.getBoundingClientRect().width),
        height: Math.round(image.getBoundingClientRect().height),
      }))
      assert.ok(data.complete && data.naturalWidth > 0 && data.naturalHeight > 0, `${width} ${id}: poster failed to load`)
      assert.ok(data.width > 0 && data.height > 0, `${width} ${id}: poster has no layout`)
      posters.push({ id, ...data })
    }
    assert.equal(await catalog.locator('canvas').count(), 0, `${width}: posters created WebGL canvases`)

    // The enlarged hover is intentionally a separate portal, mounted lazily.
    const hoverId = 'R02'
    const hoverCard = catalog.locator('[data-stage-id="R02"]').locator('xpath=ancestor::button[1]')
    await hoverCard.hover({ force: true })
    const hover = page.locator('[data-library-preview="stage:R02"]')
    await hover.waitFor({ timeout: 7000 })
    const hoverCanvas = hover.locator('canvas')
    await hoverCanvas.waitFor({ timeout: 5000 })
    await page.waitForFunction(() => document.querySelector('[data-library-preview="stage:R02"] canvas')?.dataset.stageStatus === 'ready', null, { timeout })
    const hoverDetails = await hoverCanvas.evaluate(canvas => ({
      stageId: canvas.dataset.previewStageId,
      status: canvas.dataset.stageStatus,
      meshCount: Number(canvas.dataset.previewMeshCount || 0),
    }))
    assert.equal(hoverDetails.stageId, hoverId)
    assert.equal(hoverDetails.status, 'ready')
    assert.ok(hoverDetails.meshCount > 0, 'hover must load a real GLB mesh')
    assert.equal(await catalog.locator('canvas').count(), 0, 'hover must not mount a WebGL card canvas')

    // Move away to let the portal dispose its renderer before testing selected scenes.
    await page.mouse.move(1, 1)
    await hover.waitFor({ state: 'detached', timeout: 7000 })
    const selectedStages = []
    for (const id of ids) {
      const card = catalog.locator(`[data-stage-id="${id}"]`).locator('xpath=ancestor::button[1]')
      await card.scrollIntoViewIfNeeded()
      await card.click({ force: true })
      const viewport = page.locator('.three-mount canvas[data-stage-id]').first()
      await page.waitForFunction(id => {
        const el = document.querySelector('.three-mount canvas[data-stage-id]')
        return el?.dataset.stageId === id && ['ready', 'error'].includes(el.dataset.stageStatus)
      }, id, { timeout })
      const data = await viewport.evaluate(el => ({
        stageId: el.dataset.stageId,
        status: el.dataset.stageStatus,
        meshCount: Number(el.dataset.stageMeshCount || 0),
        loadError: el.dataset.stageLoadError,
      }))
      assert.equal(data.stageId, id, `${width}: applied wrong stage`)
      assert.equal(data.status, 'ready', `${width} ${id}: stage load failed: ${data.loadError}`)
      assert.ok(data.meshCount > 0, `${width} ${id}: stage lacks mesh geometry`)
      selectedStages.push(data)
    }
    assert.equal(await catalog.locator('canvas').count(), 0, `${width}: canvases leaked into card catalog`)
    const mobileLayout = await catalog.evaluate(el => {
      const bounds = el.getBoundingClientRect()
      const cards = [...el.querySelectorAll('.exo-stage-card')]
      const grids = [...el.querySelectorAll('.exo-stage-grid')]
      return {
        viewportWidth: window.innerWidth,
        catalogWidth: Math.round(bounds.width),
        catalogScrollWidth: el.scrollWidth,
        catalogClientWidth: el.clientWidth,
        gridColumns: grids.map(grid => getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length),
        cardWidths: cards.map(card => Math.round(card.getBoundingClientRect().width)),
        bodyOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      }
    })
    assert.ok(mobileLayout.cardWidths.every(cardWidth => cardWidth > 55), `${width}: unusably narrow stage cards`)
    assert.ok(mobileLayout.catalogScrollWidth <= mobileLayout.catalogClientWidth + 1, `${width}: stage catalog overflows its own panel`)
    if(width === 390) {
      assert.ok(mobileLayout.gridColumns.every(count => count === 1), 'mobile stage grid must use one readable column')
      assert.ok(mobileLayout.cardWidths.every(cardWidth => cardWidth >= 100), '390px: stage card remains too narrow')
      // Simulate a missing poster without deleting any asset. The fallback
      // must remain readable, and the real GLB must still load on hover.
      await page.route('**/stage-posters/R03.png', route => route.fulfill({ status: 404, body: '' }))
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name:'Stage', exact:true }).click()
      const missingCard = page.locator('.exo-stage-catalog [data-stage-id="R03"]').locator('xpath=ancestor::button[1]')
      await missingCard.scrollIntoViewIfNeeded()
      await missingCard.locator('.exo-stage-poster-fallback').waitFor({ timeout })
      assert.equal(await page.locator('.exo-stage-catalog canvas').count(), 0, 'poster fallback must not allocate WebGL')
      await missingCard.hover({ force: true })
      const fallbackHover = page.locator('[data-library-preview="stage:R03"] canvas')
      await fallbackHover.waitFor({ timeout })
      await page.waitForFunction(() => document.querySelector('[data-library-preview="stage:R03"] canvas')?.dataset.stageStatus === 'ready', null, { timeout })
      assert.ok(Number(await fallbackHover.getAttribute('data-preview-mesh-count')) > 0, 'missing poster blocked 3D hover')
      mobileLayout.missingPosterFallback = 'PASS; R03 GLB hover still loads'
    } else {
      assert.ok(mobileLayout.gridColumns.every(count => count === 2), 'desktop stage grid should show two columns')
    }
    assert.equal(pageErrors.length, 0, `${width}: JavaScript errors: ${pageErrors.join('; ')}`)
    results.push({ width, ids: actualIds, posters, hover: hoverDetails, selectedStages, layout: mobileLayout, pageErrors })
    await page.close()
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify({ posterAssets, results, result: 'PASS' }, null, 2))
