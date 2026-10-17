/* Run with: node docs/hanger-assets/qa-hanger-browser.mjs */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const folder = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch({
  headless: true,
  executablePath: join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
  args: ['--use-angle=swiftshader', '--enable-webgl', '--no-sandbox']
})
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
const errors = []
const avatarRequests = []
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => {
  if (request.url().includes('clo-thomas.glb')) avatarRequests.push(request.url())
})
try {
  await page.goto(process.env.EXO_QA_URL || 'http://127.0.0.1:5174/docs/hanger-assets/preview-fixture.html', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.locator('#fixture-ready').waitFor({timeout:15000})
  await page.locator('.exo-hanger-library-tile img').first().waitFor({ timeout: 20000 })
  const tiles = await page.locator('.exo-hanger-library-tile').evaluateAll(async nodes => {
    await Promise.all(nodes.map(async node => {
      const img=node.querySelector('img')
      if (img) { img.loading='eager'; await img.decode().catch(()=>{}) }
    }))
    return nodes.map(node => ({
      img: !!node.querySelector('img'), canvas: !!node.querySelector('canvas'),
      source: node.querySelector('img')?.getAttribute('src'), ready: !!node.querySelector('img')?.naturalWidth
    }))
  })
  if (tiles.length < 4 || tiles.some(tile => !tile.img || tile.canvas || !tile.ready)) {
    throw new Error('Hanger tiles do not load static images without canvases: ' + JSON.stringify(tiles))
  }
  await page.locator('[data-library-hover-id="Hanger:wood"]').hover()
  const hover = page.locator('[data-library-preview="Hanger:wood"]')
  await hover.waitFor({ timeout: 15000 })
  await hover.locator('canvas').waitFor({ timeout: 15000 })
  await hover.locator('[data-model-status="imported"]').waitFor({timeout:15000})
  await hover.screenshot({ path: join(folder, 'qa-hanger-panel.png') })
  const contextsWhileHovered = await page.locator('.library-3d-preview canvas').count()
  await page.mouse.move(1400, 40)
  await hover.waitFor({ state: 'detached', timeout: 15000 })
  const hangerStatuses = { wood: 'imported' }
  for (const id of ['chrome','velvet','padded','trouser-clip']) {
    await page.locator(`[data-library-hover-id="Hanger:${id}"]`).hover()
    const card=page.locator(`[data-library-preview="Hanger:${id}"]`)
    await card.locator('canvas').waitFor({timeout:15000})
    if (id==='trouser-clip') await card.locator('[data-model-status="imported"]').waitFor({timeout:15000})
    const statusNode=card.locator('[data-model-status]')
    hangerStatuses[id]=await statusNode.count() ? await statusNode.getAttribute('data-model-status') : 'procedural'
    if (await card.locator('.library-3d-preview-fallback').count()) throw new Error(`WebGL fallback for hanger ${id}`)
    await page.mouse.move(1400,40)
    await card.waitFor({state:'detached',timeout:15000})
  }
  const avatarStatuses = {}
  for (const id of ['clo-thomas','theo','nora']) {
    await page.locator(`[data-library-hover-id="Avatar:${id}"]`).hover()
    const avatar=page.locator(`[data-library-preview="Avatar:${id}"]`)
    await avatar.locator('[data-model-status="loaded"]').waitFor({timeout:25000})
    avatarStatuses[id]=await avatar.locator('[data-model-status]').getAttribute('data-model-status')
    await page.mouse.move(1400,40)
    await avatar.waitFor({state:'detached',timeout:15000})
  }
  const actual = {
    tiles,
    contextsWhileHovered,
    canvasAfterClose: await page.locator('.exo-hanger-library-tile canvas').count(),
    hangerStatuses,
    avatarStatuses,
    avatarRequests,
    pageErrors: errors
  }
  console.log(JSON.stringify(actual, null, 2))
  writeFileSync(join(folder, 'qa-results.json'), JSON.stringify(actual,null,2)+'\n')
  if (avatarRequests.some(url => url.endsWith('/avatars/clo-thomas.glb'))) {
    throw new Error('Heavy CLO Thomas model requested for hover')
  }
  if (errors.length) throw new Error(errors.join('; '))
} catch (error) {
  console.error('QA failed:', error.message, 'page errors:', JSON.stringify(errors))
  await page.screenshot({ path: join(folder, 'qa-failure-screen.png'), timeout: 5000 }).catch(()=>{})
  throw error
} finally {
  await browser.close()
}
