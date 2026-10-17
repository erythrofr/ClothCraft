import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.EXO_QA_URL || 'http://127.0.0.1:5207/?desktop=1&testSession=stage-scene-lifecycle', { waitUntil: 'domcontentloaded' })
  const nav = page.getByRole('navigation', { name: 'Library categories' })
  await nav.getByRole('button', { name: 'Stage', exact: true }).click()
  const canvas = page.locator('.three-mount canvas').first()
  const select = async (label, expectedId) => {
    await page.locator('.exo-stage-card').filter({ hasText: label }).first().click()
    await page.waitForFunction(id => {
      const data = document.querySelector('.three-mount canvas')?.dataset
      return data?.stageId === id && data.stageStatus === 'ready' && Number(data.stageMeshCount) > 0
    }, expectedId, { timeout: 25000 })
    return canvas.evaluate(node => ({ id: node.dataset.stageId, count: Number(node.dataset.stageMeshCount), status: node.dataset.stageStatus, loaded: node.dataset.stageLoaded, error: node.dataset.stageLoadError }))
  }
  const records = []
  records.push(await select('MIKRISTIAN Cathedral House', 'cathedral'))
  records.push(await select('Mountain runway', 'R02'))
  records.push(await select('Industrial Stage', 'S14'))
  records.push(await select('MIKRISTIAN Cathedral House', 'cathedral'))
  await page.waitForTimeout(350)
  assert.equal(await canvas.getAttribute('data-stage-id'), 'cathedral')
  assert.equal(await canvas.getAttribute('data-stage-status'), 'ready')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ pass: true, records, errors }, null, 2))
} finally {
  await browser.close()
}
