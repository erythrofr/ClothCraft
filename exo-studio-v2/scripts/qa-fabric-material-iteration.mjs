import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Fully isolated tee session: does not change the user's saved production
// garments. This is a browser shader/UI test, not measured CLO fabric parity.
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'],
})
try {
  const page = await browser.newPage({viewport:{width:1650,height:1000}})
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee', {waitUntil:'domcontentloaded'})
  await page.locator('.three-mount canvas').first().waitFor({timeout:25000})
  await page.getByRole('combobox', {name:'CLO-style workspace layout presets'}).selectOption('materials')
  const preview = page.locator('.fabric-material-preview-canvas canvas')
  await preview.waitFor({state:'visible',timeout:20000})
  const garment = page.locator('.three-mount canvas').first()
  await page.waitForFunction(() => Number(document.querySelector('.three-mount canvas')?.dataset.simulationSessionBuilds || 0) > 0)
  const sessionBefore = Number(await garment.getAttribute('data-simulation-session-builds'))
  await page.waitForTimeout(450)
  const originalMaterial = await preview.screenshot()

  const structure = page.getByRole('combobox', {name:'Fabric structure'})
  await structure.selectOption('twill')
  await page.waitForTimeout(500)
  const twillMaterial = await preview.screenshot()
  fs.writeFileSync('/tmp/sampl3d-fabric-procedural-qa-20261015.png',twillMaterial)
  assert.ok(!originalMaterial.equals(twillMaterial), 'Fabric structure must visibly change the 3D preview')
  assert.equal(Number(await garment.getAttribute('data-simulation-session-builds')),sessionBefore,
    'Changing only a fabric structure must not reset the cloth simulation')

  const raw = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 32
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createLinearGradient(0,0,32,32)
    gradient.addColorStop(0,'#2f4c70'); gradient.addColorStop(.5,'#a1acb5'); gradient.addColorStop(1,'#172a38')
    ctx.fillStyle = gradient
    ctx.fillRect(0,0,32,32)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', {name:'UPLOAD TEXTILE IMAGE'}).click(),
  ])
  await chooser.setFiles({name:'qa-material-photo.png',mimeType:'image/png',buffer:Buffer.from(raw,'base64')})
  await page.getByRole('button',{name:'GENERATE NORMAL + ROUGHNESS FROM PHOTO'}).waitFor({timeout:10000})
  await page.getByRole('button',{name:'GENERATE NORMAL + ROUGHNESS FROM PHOTO'}).click()
  await page.getByText('Auto from textile image').first().waitFor({state:'visible',timeout:15000})
  await page.waitForTimeout(500)
  assert.equal(Number(await garment.getAttribute('data-simulation-session-builds')),sessionBefore,
    'Uploading and generating fabric optical maps must not restart garment physics')

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2') || 'null'))
  assert.ok(state?.fabrics?.main?.texture?.normalSrc?.startsWith('data:image/png'))
  assert.ok(state?.fabrics?.main?.texture?.roughnessSrc?.startsWith('data:image/png'))
  assert.equal(state.fabrics.main.texture.normalName,'Auto from textile image')
  assert.equal(state.fabrics.main.texture.roughnessName,'Auto from textile image')

  const [heightChooser]=await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button',{name:'LOAD HEIGHT / DISPLACEMENT MAP'}).click(),
  ])
  await heightChooser.setFiles({name:'qa-fabric-height.png',mimeType:'image/png',buffer:Buffer.from(raw,'base64')})
  await page.getByText('qa-fabric-height.png',{exact:true}).waitFor({state:'visible',timeout:10000})
  const displacementSlider=page.locator('.slider-row').filter({hasText:'Visual displacement'}).locator('input[type="range"]')
  await displacementSlider.focus()
  await displacementSlider.press('ArrowRight')
  await page.waitForTimeout(650)
  const updated=await page.evaluate(() => JSON.parse(localStorage.getItem('garment-studio-tee-first-fit-project-v2') || 'null'))
  assert.equal(updated.fabrics.main.texture.displacementName,'qa-fabric-height.png')
  assert.ok(updated.fabrics.main.displacementMm>0)
  assert.ok(Number(await garment.getAttribute('data-textile-displacement-panels'))>0,
    'Real garment materials must receive the uploaded height map')
  assert.equal(Number(await garment.getAttribute('data-simulation-session-builds')),sessionBefore,
    'Changing visual displacement must preserve cloth simulation positions')

  const output = '/tmp/sampl3d-fabric-preview-qa-20261015.png'
  fs.writeFileSync(output,await preview.screenshot())
  assert.deepEqual(errors,[],'Fabric edits should not throw browser errors')
  console.log(JSON.stringify({pass:true,interactivePreview:true,structuresDiffer:true,
    generatedPhotoPBR:true,materialDisplacement:true,clothSimulationPreserved:true,pageErrors:0,
    previewScreenshot:output}))
} finally {
  await browser.close()
}
