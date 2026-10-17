import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'

const browser=await chromium.launch({
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless:true,
  args:['--enable-webgl','--ignore-gpu-blocklist'],
})
try{
  const page=await browser.newPage({viewport:{width:720,height:740}})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext=function(kind,...rest){
      if(kind==='webgl'||kind==='webgl2'||kind==='experimental-webgl')return null
      return original.call(this,kind,...rest)
    }
  })
  await page.goto((process.env.EXO_QA_URL||'http://127.0.0.1:5199')+
    '/docs/qa/garment-preview-20261017/harness.html?templateId=tee',{waitUntil:'domcontentloaded'})
  const fallback=page.getByRole('status').filter({hasText:'3D preview unavailable'})
  await fallback.waitFor({state:'visible',timeout:20000})
  assert.match(await fallback.innerText(),/Foundation Tee.*4 drafted source pieces/s)
  assert.match(await fallback.innerText(),/original pattern remains available/i)
  assert.equal(await page.locator('.exo-garment-mini-canvas canvas').count(),0)
  assert.equal(await page.locator('.exo-garment-mini-switches').count(),0)
  assert.deepEqual(errors,[])
  console.log('PASS WebGL-unavailable preview fallback: source-piece summary and no blank canvas or page errors')
  await page.close()
} finally{await browser.close()}
