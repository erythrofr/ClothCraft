import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
const url=process.env.EXO_QA_URL||'http://127.0.0.1:5188'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[],failedMaps=[]
 page.on('pageerror',e=>errors.push(e.message))
 page.on('response',r=>{if(/\/fabric-scans(?:-ambientcg)?\//.test(r.url())&&!r.ok())failedMaps.push([r.status(),r.url()])})
 await page.goto(url+'/?desktop=1&testSession=svg-fabric-ball',{waitUntil:'domcontentloaded'})
 const library=page.getByRole('navigation',{name:'Library categories'})
 await library.getByRole('button',{name:'Fabric',exact:true}).click()
 assert.equal(await page.locator('.exo-fabric-entry-main').count(),400)
 const prose=await page.locator('.exo-fabric-catalog-intro').innerText()
 assert.match(prose,/400 fabric presets/)
 assert.doesNotMatch(await page.locator('.exo-fabric-catalog').innerText(),/CC0 photographic references are shared/)
 await page.getByRole('textbox',{name:'Search library'}).fill('Rigid Denim')
 await page.locator('.exo-fabric-entry-main[data-fabric-preset="denim"]').hover()
 await page.locator('[data-library-preview="Fabric:denim"] canvas[data-fabric-ball]').waitFor({state:'attached',timeout:10000})
 const image=await page.locator('[data-library-preview="Fabric:denim"] canvas[data-fabric-ball]').evaluate(canvas=>{
  const gl=canvas.getContext('webgl2')||canvas.getContext('webgl')
  return {width:canvas.width,height:canvas.height,available:Boolean(gl),realMap:canvas.getAttribute('data-fabric-ball')}
 })
 // A larger hover dedicates most of its media to the unobstructed ball and
 // keeps the single enlarged flat swatch beside it.
 assert.ok(image.width>200&&image.height>240&&image.available,'Enlarged fabric-covered 3D sphere must render')
 assert.equal(await page.locator('[data-library-preview="Fabric:denim"] .exo-fabric-hover-flat').count(),1)
 assert.equal(await page.locator('[data-library-preview="Fabric:denim"] .exo-fabric-ball-macro').count(),0,'No mini swatch may obscure the drape')
 await library.getByRole('button',{name:'Patterns',exact:true}).click()
 await page.getByRole('button',{name:'Foundation Tee',exact:false}).first().click()
 await page.waitForFunction(()=>document.querySelector('.command-result')?.textContent?.includes('unsewn 2D pattern outlines'),null,{timeout:5000}).catch(()=>{})
 assert.equal(await page.locator('select[aria-label="3D and 2D window arrangement"]').inputValue(),'2d')
 const xml='<svg xmlns="http://www.w3.org/2000/svg" width="400mm" height="200mm" viewBox="0 0 800 400"><path id="front" d="M20 20 L400 20 L400 360 L20 360 Z"/><polygon id="back" points="430,20 780,20 780,360 430,360"/></svg>'
 await page.locator('input[accept*=".svg"]').setInputFiles({name:'illustrator-cutlines.svg',mimeType:'image/svg+xml',buffer:Buffer.from(xml)})
 await page.locator('[data-piece-id="svg-pattern-1"]').waitFor({state:'attached',timeout:5000})
 await page.locator('[data-piece-id="svg-pattern-2"]').waitFor({state:'attached',timeout:5000})
 assert.equal(await page.locator('[data-piece-id="svg-pattern-3"]').count(),0)
 assert.match(await page.locator('body').innerText(),/0 seam links/)
 assert.ok(await page.locator('svg').count()>2)
 assert.deepEqual(errors,[])
 assert.deepEqual(failedMaps,[])
 console.log(JSON.stringify({pass:true,fabricPresets:400,ball:image,svgPieces:2,seams:0,viewport:'2d',errors:0,failedMaps:0}))
}finally{await browser.close()}
