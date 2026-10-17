import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'
import { groupApparelPresets } from '../src/data/apparelMaterialExpansion.js'

// Bounded UI verification against an existing Vite app. Use a dedicated tee
// autosave slot and one headless browser, closed on every exit.
const baseUrl = process.env.EXO_QA_URL || 'http://127.0.0.1:5188'
const timeoutMs = 25_000
const screenshotDir=path.resolve('screenshots')
fs.mkdirSync(screenshotDir,{recursive:true})
const materialDiff=(before,after)=>{
  return {differentPng:!before.equals(after),beforeBytes:before.length,afterBytes:after.length}
}
const presetEntries = Object.entries(FABRIC_PRESETS)
assert.equal(presetEntries.length, 400, 'Fabric catalog must contain exactly 400 presets')
assert.equal(new Set(presetEntries.map(([id]) => id)).size, 400)
const denimEntry = presetEntries.find(([id]) => id === 'denim')
assert.ok(denimEntry, 'Rigid Denim catalog record is required')
assert.equal(FABRIC_PRESETS.nylonRipstop?.texture?.scanAssetId,'Fabric046')
assert.equal(FABRIC_PRESETS.nylonRipstop?.texture?.scanSource,'ambientCG')
const fallbackEntries=presetEntries.filter(([,preset])=>!preset.texture?.scanAssetId)
assert.ok(fallbackEntries.length>0,'Catalog must retain genuinely procedural fallback entries')

try {
  const response = await fetch(baseUrl, {signal: AbortSignal.timeout(3500)})
  assert.ok(response.ok, `Vite returned HTTP ${response.status}`)
} catch (error) {
  console.error(JSON.stringify({pass:false, blocked:'No reachable running Vite app', baseUrl, error:String(error)}))
  process.exitCode = 2
}

if (!process.exitCode) {
  let browser
  try {
    browser = await chromium.launch({
      headless:true, executablePath:process.env.EXO_QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      timeout:timeoutMs, args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
    })
    const page = await browser.newPage({viewport:{width:1650,height:1000}})
    page.setDefaultTimeout(timeoutMs)
    const errors=[]
    const failedAssets=[]
    page.on('pageerror', error=>errors.push(error.message))
    page.on('response',response=>{if(response.url().includes('/fabric-scans-ambientcg/')&&!response.ok())failedAssets.push({url:response.url(),status:response.status()})})
    await page.goto(`${baseUrl}/?desktop=1&testSession=tee`,{waitUntil:'domcontentloaded',timeout:timeoutMs})
    await page.locator('.three-mount canvas').first().waitFor({state:'attached'})
    const simulation=page.locator('.three-mount canvas').first()
    await page.waitForFunction(()=>Number(document.querySelector('.three-mount canvas')?.dataset.simulationSessionBuilds)>0,{timeout:timeoutMs})
    const initialBuilds=Number(await simulation.getAttribute('data-simulation-session-builds'))
    const layout=page.getByRole('combobox',{name:'CLO-style workspace layout presets'})
    await layout.selectOption('materials')
    await page.getByRole('button',{name:'Browse fabrics'}).click()
    const search=page.getByRole('textbox',{name:'Search library'})
    const tiles=page.locator('.exo-fabric-entry-main')
    await search.fill('')
    const allCount=await tiles.count()
    assert.equal(allCount,400,`Rendered fabric catalog has ${allCount} presets, expected 400`)
    for(const term of ['denim','cotton','leather','ripstop']){
      await search.fill(term)
      const expected=groupApparelPresets(FABRIC_PRESETS)
        .flatMap(([group,entries])=>entries.filter(([,p])=>
          `${p.name} ${group} ${p.texture?.scanSource||''}`.toLowerCase().includes(term))).length
      assert.equal(await tiles.count(),expected,`Search mismatch for ${term}`)
      assert.ok(expected>0,`Catalog search has no ${term} fabric`)
    }
    await search.fill('Rigid Denim')
    assert.ok(await tiles.count()>=1)
    const rigidDenim=page.locator('.exo-fabric-entry-main[data-fabric-preset="denim"]')
    assert.equal(await rigidDenim.count(),1)
    await rigidDenim.click()
    await page.getByRole('button',{name:'Add to project and apply'}).click()
    await page.locator('.clo-object-row .clo-object-select').filter({hasText:'Rigid Denim'}).first().click()
    await page.locator('.panel-section').filter({has:page.getByText('Physical fabric',{exact:true})}).first().waitFor({state:'visible'})
    const cloReferenceDetails=page.locator('details[aria-label="CLO7 style fabric detailed property comparison"]')
    await cloReferenceDetails.waitFor({state:'visible'})
    await cloReferenceDetails.locator('summary').click()
    assert.ok(await cloReferenceDetails.getByText('Bending · warp',{exact:true}).isVisible(),
      'CLO-style directional physical comparison must be visible for selected fabric')
    assert.ok(await cloReferenceDetails.getByText('Buckling ratio',{exact:true}).isVisible())
    assert.ok((await cloReferenceDetails.locator('.control-row').filter({hasText:'NOT AVAILABLE'}).count())>=5,
      'Missing calibrated CLO-style physical models must not be filled with invented coefficients')
    const presetSelect=page.locator('.panel-section').filter({has:page.getByText('Physical fabric',{exact:true})}).locator('select').first()
    await assert.equal(await presetSelect.inputValue(),'denim')
    const structure=page.getByRole('combobox',{name:'Fabric structure'})
    assert.ok(['auto','twill'].includes(await structure.inputValue()),'Denim has a supported textile structure')
    const afterPresetBuilds=Number(await simulation.getAttribute('data-simulation-session-builds'))
    await structure.selectOption('twill')
    await page.locator('.fabric-material-preview-canvas canvas').waitFor({state:'visible'})
    const license=page.locator('.panel-section').filter({has:page.getByText('Textile surface',{exact:true})}).locator('a[href]')
    assert.ok(await license.count()>0,'Denim should expose a source/license link')
    const href=await license.first().getAttribute('href')
    assert.ok(/^https:\/\//.test(href||''),'License source link must be HTTPS')
    const text=await license.first().locator('..').innerText()
    assert.match(text,/CC0/)
    const wash=page.getByRole('combobox',{name:'Fabric wash effect'})
    const options=await wash.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value))
    const effect=options.includes('stone')?'stone':options.find(value=>value!=='raw')
    assert.ok(effect,'Wash editor must offer an actual effect')
    const preview=page.locator('.fabric-material-preview-canvas canvas')
    const capture=async label=>{
      await page.waitForTimeout(450)
      const output=path.join(screenshotDir,`QA-400-${label}.png`)
      const buffer=await preview.screenshot({animations:'disabled'})
      fs.writeFileSync(output,buffer)
      return buffer
    }
    await wash.selectOption('raw')
    const denimBefore=await capture('denim-before-wash')
    await wash.selectOption(effect)
    assert.equal(await wash.inputValue(),effect)
    await page.getByRole('combobox',{name:'Fabric wash blend'}).selectOption('soft-light')
    assert.equal(await page.getByRole('combobox',{name:'Fabric wash blend'}).inputValue(),'soft-light')
    const washEditor=page.getByLabel('Non destructive digital fabric wash editor')
    const intensity=washEditor.locator('.slider-row').filter({hasText:'Wash intensity'}).locator('input[type="range"]')
    await intensity.focus()
    await intensity.press('ArrowRight')
    assert.ok(Number(await intensity.inputValue())>0,'Wash intensity must be editable')
    const denimAfter=await capture('denim-after-wash')
    const denimPixels=materialDiff(denimBefore,denimAfter)
    assert.equal(Number(await simulation.getAttribute('data-simulation-session-builds')),afterPresetBuilds,
      'Changing only denim textile appearance and wash must not reinitialize physics')
    await presetSelect.selectOption('nylonRipstop')
    assert.equal(await presetSelect.inputValue(),'nylonRipstop')
    const ambientHref=await license.first().getAttribute('href')
    assert.equal(ambientHref,'https://ambientcg.com/a/Fabric046', 'Source must switch to ambientCG Fabric046')
    const ambientLabel=await license.first().locator('..').innerText()
    assert.match(ambientLabel,/ambientCG.*Fabric046/)
    assert.match(ambientLabel,/CC0/)
    for(const channel of ['color','normal','roughness']){
      const relative=`/fabric-scans-ambientcg/Fabric046/${channel}.jpg`
      const asset=await page.request.get(`${baseUrl}${relative}`)
      assert.equal(asset.status(),200,`${relative} must load without 404`)
      assert.match(asset.headers()['content-type']||'',/image\//)
      assert.ok((await asset.body()).length>1000,`${relative} must have nonempty image bytes`)
    }
    const afterNylonBuilds=Number(await simulation.getAttribute('data-simulation-session-builds'))
    await wash.selectOption('raw')
    const nylonBefore=await capture('nylon-ripstop-before-wash')
    await wash.selectOption(effect)
    await page.getByRole('combobox',{name:'Fabric wash blend'}).selectOption('soft-light')
    await intensity.focus()
    await intensity.press('ArrowRight')
    const nylonAfter=await capture('nylon-ripstop-after-wash')
    const nylonPixels=materialDiff(nylonBefore,nylonAfter)
    assert.equal(Number(await simulation.getAttribute('data-simulation-session-builds')),afterNylonBuilds,
      'AmbientCG-backed nylon wash edits must preserve physics session')
    assert.deepEqual(errors,[],'Fabric UI must not cause runtime page errors')
    assert.deepEqual(failedAssets,[],'AmbientCG image requests must not fail')
    console.log(JSON.stringify({pass:true,actualPresets:allCount,searchTerms:['denim','cotton','leather','ripstop'],denimSelected:true,licenseSource:href,ambientSource:ambientHref,ambientMapsHttp200:3,proceduralFallbacks:fallbackEntries.length,washEffect:effect,denimPixels,nylonPixels,simulationBuildsBeforePreset:initialBuilds,simulationBuildsAfterDenim:afterPresetBuilds,simulationBuildsAfterNylon:afterNylonBuilds,simulationBuildsAfterWash:Number(await simulation.getAttribute('data-simulation-session-builds')),pageErrors:errors.length}))
  } catch(error) {
    console.error(JSON.stringify({pass:false,error:String(error),stack:error.stack}))
    process.exitCode=1
  } finally {
    await browser?.close()
  }
}
