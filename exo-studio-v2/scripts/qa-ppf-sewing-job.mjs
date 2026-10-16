import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'
import fs from 'node:fs'

// Full acceptance test. Requires the LOCAL PPF service at 127.0.0.1:5192 and
// no other PPF solver. Runs one isolated 10-frame T-shirt sewing job.
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1740, height: 1000 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee', { waitUntil: 'domcontentloaded' })
  await page.locator('.section-tabs button').filter({ hasText: 'Sewing' }).evaluate((button) => button.click())
  const panel = page.locator('[aria-label="PPF physical sewing simulation"]')
  await panel.waitFor({ state: 'visible' })
  const action = panel.getByRole('button', { name: 'RUN PHYSICAL SEWING · PPF METAL' })
  await action.evaluate((button) => button.click())
  let status = ''
  const start = Date.now()
  while (Date.now() - start < 160000) {
    status = String(await panel.locator('[role="status"]').textContent() || '')
    if (/PPF:\s*(DONE|ERROR)/i.test(status)) break
    await page.waitForTimeout(1000)
  }
  const text = await panel.innerText()
  await page.screenshot({ path: 'qa-ppf-sewing-end-to-end-20261013.png' })
  if (!/PPF:\s*DONE/i.test(status)) errors.push(`PPF physical sewing job failed or timed out: ${status} ${text.slice(-700)}`)
  if (!text.includes('Measured seam closure:')) errors.push('PPF sewing measurement is missing from the completed UI')
  if (!text.includes('Solver completed. Blender scene saved')) errors.push('PPF Blender result is not shown')
  const response = await fetch('http://127.0.0.1:5192/jobs')
  const jobs = await response.json()
  const finalJob = jobs.jobs?.at(-1)
  if (finalJob?.status !== 'done') errors.push('PPF service did not mark sewing job complete')
  if (!fs.existsSync(finalJob?.artifacts?.blend || '')) errors.push('Saved PPF Blender scene missing')
  if (!fs.existsSync(finalJob?.artifacts?.sewingReport || '')) errors.push('Per-seam physical sewing report missing')
  if (!fs.existsSync(finalJob?.artifacts?.contactReport || '')) errors.push('Frame-by-frame cloth/avatar collision report missing')
  if ((finalJob?.summary?.contact?.framesChecked ?? 0) < 10) errors.push('Physical solver output did not undergo a full per-frame contact audit')
  const pc2 = finalJob?.summary?.pc2?.path
  if (!pc2 || !fs.existsSync(pc2)) errors.push('PPF point cache was lost when temporary solver workspace was cleaned up')
  if (pc2 && !pc2.includes('/blender_bridge/output/data/')) errors.push('PPF point cache is not stored in durable project output')
  await page.waitForTimeout(500)
  const health = await (await fetch('http://127.0.0.1:5192/health')).json()
  if (!health.ready || health.busy) errors.push('Local PPF solver was not released after finishing sewing')
  console.log(JSON.stringify({ success: errors.length === 0, status, durationSeconds: +((Date.now() - start) / 1000).toFixed(1),
    jobId: finalJob?.id, averageSewingClosurePercent: finalJob?.summary?.sewing?.closurePercent,
    maxSelfIntersectionPairs: finalJob?.summary?.contact?.maxSelfIntersectionPairs,
    maxAvatarIntersectionPairs: finalJob?.summary?.contact?.maxAvatarIntersectionPairs,
    cachePersistent: Boolean(pc2 && fs.existsSync(pc2)), serverReadyAfterSolve: health.ready,
    errors, screenshot: 'qa-ppf-sewing-end-to-end-20261013.png' }))
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
}
