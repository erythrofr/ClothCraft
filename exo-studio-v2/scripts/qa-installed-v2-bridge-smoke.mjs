// A small, read-only check for the signed EXO desktop/web coupling.
// It catches accidentally shipped development ports 5191/5193.
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'

const base='http://127.0.0.1:5386'
const native='http://127.0.0.1:5385'
const health=await fetch(native+'/health',{signal:AbortSignal.timeout(6000)}).then(r=>r.json())
assert.equal(health.ok,true,'Signed EXO native bridge must be healthy')
assert.equal(health.nativeReady,true,'EXO native Rust backend must be ready')

const browser=await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}})
  const errors=[],badPorts=[],warnings=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('requestfailed',request=>{
    if(/127\.0\.0\.1:(5191|5193)\//.test(request.url()))badPorts.push(request.url())
  })
  page.on('console',message=>{
    if(message.text().includes('Texture marked for update but no image data found'))warnings.push(message.text())
  })
  await page.goto(base+'/?desktop=1&engine=clothcraft&testSession=signed-native-bridge-smoke',
    {waitUntil:'domcontentloaded',timeout:18000})
  await page.locator('.cc-board [data-panel]').first().waitFor({state:'visible',timeout:20000})
  const panels=await page.locator('.cc-board [data-panel]').count()
  const editor=await page.locator('body').innerText()
  assert.ok(panels>=1,'Native pattern board should show at least one panel')
  assert.doesNotMatch(editor,/Failed to fetch|NetworkError when attempting to fetch a resource/)
  assert.deepEqual(errors,[])
  assert.deepEqual(badPorts,[])
  assert.deepEqual(warnings,[])
  console.log(JSON.stringify({pass:true,nativeReady:true,panels,badPorts:0,pageErrors:0,textureWarnings:0}))
}finally{
  await browser.close()
}
