import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

// Exercises the real app side bar, inspector-to-project stage assignment, and
// attached THREE scene nodes. Dedicated session keys avoid saved user projects.
const base = process.env.EXO_QA_URL || 'http://127.0.0.1:5199'
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EXO_QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})

const report = []
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${base}/?desktop=1&testSession=stage-library-${width}`, { waitUntil: 'domcontentloaded' })
      const category = page.getByRole('button', { name: 'Stage', exact: true })
      if (!(await category.isVisible())) await page.getByRole('button', { name: 'Show or hide Library' }).click()
      await category.click()
      assert.equal(await page.locator('.exo-stage-category .exo-stage-card').count(), 20)
      const canvas = page.locator('.three-mount canvas').first()
      const readStage = () => canvas.evaluate(element => ({
        id: element.dataset.stageId,
        meshes: Number(element.dataset.stageMeshCount),
        simulationBuilds: Number(element.dataset.simulationSessionBuilds),
      }))
      const samples = []
      for (const id of ['R01', 'S02', 'S14']) {
        await page.locator(`.exo-stage-card:has([data-stage-id="${id}"])`).first().click()
        await page.waitForTimeout(160)
        const result = await readStage()
        assert.equal(result.id, id)
        assert.ok(result.meshes >= 5, `${id}: live stage has no display meshes`)
        samples.push(result)
      }
      assert.equal(new Set(samples.map(item => item.simulationBuilds)).size, 1,
        'Stage-only changes should preserve the garment simulation session')
      await page.locator('.exo-stage-empty').first().click()
      await page.waitForTimeout(160)
      const cleared = await readStage()
      assert.deepEqual({ id: cleared.id, meshes: cleared.meshes }, { id: 'none', meshes: 0 })
      assert.deepEqual(errors, [], `JS errors at ${width}px`)
      report.push({ width, stageCards: 20, samples, cleared, pageErrors: errors })
    } finally {
      await page.close()
    }
  }
  console.log(JSON.stringify({ pass: true, report }, null, 2))
} finally {
  await browser.close()
}
