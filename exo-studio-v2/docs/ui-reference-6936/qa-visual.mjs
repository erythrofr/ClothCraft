import { chromium } from 'playwright-core'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'

const cwd = dirname(fileURLToPath(import.meta.url))
const base = process.env.EXO_QA_URL || 'http://127.0.0.1:5188'
const browser = await chromium.launch({
  headless:true,
  executablePath:join(homedir(),'Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
  args:['--enable-webgl','--use-angle=swiftshader','--no-sandbox']
})
const report = { garmented:[], hardware:[], errors:[] }
try {
  for(const viewport of (process.env.EXO_QA_FAST ? [{width:1440,height:900}] : [{width:1440,height:900},{width:390,height:844}])) {
    const page = await browser.newPage({viewport})
    page.on('pageerror', err => report.errors.push(err.message))
    page.on('console', message => {if(message.type()==='error')report.errors.push(message.text())})
    await page.goto(base+'/docs/ui-reference-6936/preview-fixture.html',{waitUntil:'domcontentloaded',timeout:45000})
    await page.locator('[data-fixture="ready"]').waitFor({timeout:15000})
    for(const category of (process.env.EXO_QA_HARDWARE_ONLY ? [] : ['Garment','Patterns'])) {
      await page.locator(`[data-fixture-category="${category}"]`).hover()
      const popup = page.locator(`[data-library-preview="${category}:tee"]`)
      await popup.waitFor({timeout:15000}).catch(async err=>{
        console.log('Hover diagnosis',category,await page.locator('body').innerText().catch(()=>'none'),report.errors)
        console.log('Hovered tile markup',await page.locator(`[data-fixture-category="${category}"]`).evaluate(n=>n.outerHTML.slice(0,500)).catch(()=>'unavailable'))
        await page.screenshot({path:join(cwd,`qa-debug-${category}-${viewport.width}.png`),timeout:5000}).catch(()=>{})
        throw err
      })
      if (process.env.EXO_QA_EXPLODED) {
        await popup.getByRole('button', {name:'PATTERN EXPLODED'}).click({timeout:10000})
      }
      await popup.locator('canvas').waitFor({timeout:15000})
      const bounds = await popup.boundingBox()
      if (!bounds || bounds.x < -1 || bounds.x+bounds.width > viewport.width+1) throw Error(`Garment popup offscreen: ${category}`)
      await popup.screenshot({path:join(cwd,`qa-${category.toLowerCase()}-${viewport.width}.png`),timeout:15000})
      report.garmented.push({category,viewport:viewport.width,width:Math.round(bounds.width),canvas:await popup.locator('canvas').count()})
      await page.mouse.move(viewport.width-3,viewport.height-3)
      await popup.waitFor({state:'detached',timeout:15000})
    }
    for(const id of ['d-ring','prong-buckle','slide-adjuster']) {
      await page.locator(`[data-fixture-category="${id}"]`).hover()
      const popup = page.locator(`[data-library-preview="hardware:${id}"]`)
      await popup.waitFor({timeout:15000})
      await popup.locator('[data-model-status="loaded"]').waitFor({timeout:20000})
      const canvas=popup.locator('canvas')
      await canvas.waitFor({timeout:15000})
      if(viewport.width===1440) await popup.screenshot({path:join(cwd,`qa-hardware-${id}.png`),timeout:15000})
      report.hardware.push({id,viewport:viewport.width,loaded:true,canvas:await canvas.count()})
      await page.mouse.move(viewport.width-3,viewport.height-3)
      await popup.waitFor({state:'detached',timeout:15000})
    }
    await page.close()
  }
  if (report.errors.length) throw Error(report.errors.join('; '))
  writeFileSync(join(cwd,'qa-report.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
} finally {
  await browser.close()
}
