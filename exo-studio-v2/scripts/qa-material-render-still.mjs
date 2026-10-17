import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

// Real WebGL canvas export from an isolated tee test session. This is a
// rendered preview, not physical cloth fit validation or path tracing.
const browser=await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try {
  const page=await browser.newPage({viewport:{width:1650,height:1000},acceptDownloads:true})
  const failures=[]
  page.on('pageerror',error=>failures.push(error.message))
  await page.goto('http://127.0.0.1:5188/?desktop=1&testSession=tee',{waitUntil:'domcontentloaded'})
  await page.locator('.three-mount canvas').waitFor({state:'visible',timeout:20000})
  const layout=page.getByRole('combobox',{name:'CLO-style workspace layout presets'})
  await layout.selectOption('materials')
  const canvas=page.locator('.three-mount canvas').first()
  await page.waitForFunction(()=>{
    const elem=document.querySelector('.three-mount canvas')
    return Number(elem?.dataset.textileMappedPanels||0)>0
  },{timeout:20000})
  const maps=await canvas.evaluate(elem=>({
    matched:+(elem.dataset.textileMappedPanels||0),
    total:+(elem.dataset.textilePanelCount||0),
  }))
  assert.ok(maps.matched>=1 && maps.matched<=maps.total)

  await layout.selectOption('render')
  await page.getByRole('combobox',{name:'Output preset'}).selectOption('1080x1350')
  const [download]=await Promise.all([
    page.waitForEvent('download',{timeout:30000}),
    page.getByRole('button',{name:'RENDER PNG STILL'}).click(),
  ])
  const path=await download.path()
  assert.ok(path,'Rendered PNG should produce a real browser download')
  const contents=fs.readFileSync(path)
  assert.ok(contents.byteLength>20000,'Rendered PNG should contain nonempty pixels')
  assert.equal(contents.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
  assert.equal(contents.readUInt32BE(16),1080,'PNG encoded width')
  assert.equal(contents.readUInt32BE(20),1350,'PNG encoded height')
  assert.deepEqual(failures,[])
  console.log(JSON.stringify({
    pass:true,pbrMappedPanels:maps.matched,panels:maps.total,
    renderFormat:'PNG',renderDimensions:[1080,1350],
    fileBytes:contents.byteLength,browserErrors:failures.length,
    pathTracingCertified:false,
  }))
} finally { await browser.close() }
