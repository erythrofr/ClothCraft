// Personal desktop avatar regression. Never captures or distributes CLO meshes.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const origin = process.env.EXO_AVATAR_TEST_ORIGIN || 'http://127.0.0.1:5284'
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})

try {
  const context = await browser.newContext({ viewport: { width: 1480, height: 940 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${origin}/?desktop=1&testSession=tee&qa=avatar-model-switch`, { waitUntil: 'domcontentloaded' })
  const viewport = page.locator('.three-mount')
  await viewport.waitFor({ timeout: 30000 })
  await page.getByRole('combobox', { name: 'Workspace', exact: true }).selectOption('Avatar')
  const picker = page.getByRole('combobox', { name: 'Fitting avatar' })
  await picker.waitFor({ timeout: 30000 })
  const ready = async model => {
    await page.waitForFunction(expected => {
      const mount = document.querySelector('.three-mount')
      return mount?.dataset.avatarModel === expected && mount?.dataset.avatarLoadStatus === 'ready'
    }, model, { timeout: model === 'clo-thomas' ? 160000 : 60000 })
    const result = await viewport.evaluate(el => ({ model: el.dataset.avatarModel,
      load: el.dataset.avatarLoadStatus, heightM: Number(el.dataset.avatarVisualHeightM),
      visibleAvatarChildren: Number(el.dataset.avatarVisibleChildren),
      canvas: el.querySelector('canvas') !== null }))
    assert.equal(result.model, model)
    assert.equal(result.load, 'ready')
    assert.equal(result.canvas, true)
    assert.equal(result.visibleAvatarChildren, 1, `Duplicate or missing visual avatars: ${JSON.stringify(result)}`)
    assert.ok(result.heightM >= 1.4 && result.heightM <= 2.2, JSON.stringify(result))
    return result
  }
  const first = await ready('makehuman-base')
  const choices = await picker.locator('option').evaluateAll(options =>
    options.map(option => ({ value: option.value, disabled: option.disabled })))
  for (const model of ['clo-thomas', 'theo', 'nora']) {
    assert.ok(choices.some(x => x.value === model && !x.disabled), `${model} asset must be installed`)
  }
  await picker.selectOption('clo-thomas')
  const thomas = await ready('clo-thomas')
  await picker.selectOption('makehuman-base')
  const back = await ready('makehuman-base')
  await picker.selectOption('theo')
  const theo = await ready('theo')
  await picker.selectOption('nora')
  const nora = await ready('nora')
  // A second model can finish loading after the user already selected another.
  // It must never replace or dispose the new avatar behind the user's back.
  await picker.selectOption('clo-thomas')
  await picker.selectOption('theo')
  const rapidSwitch = await ready('theo')
  await page.waitForTimeout(3000)
  assert.equal(await viewport.getAttribute('data-avatar-model'), 'theo')
  assert.equal(await viewport.getAttribute('data-avatar-load-status'), 'ready')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: true, choices, first, thomas, back, theo, nora, rapidSwitch, errors }, null, 2))
  await context.close()
} finally { await browser.close() }
