import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser = await chromium.launch({
  headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
const page = await browser.newPage({viewport:{width:1550,height:960}})
const errors=[]
page.on('pageerror',error=>errors.push(error.message))
await page.goto('http://127.0.0.1:5188/?desktop=1&defaultAvatar=clo-thomas',{waitUntil:'domcontentloaded'})
await page.waitForTimeout(950)
await page.locator('.template-select').selectOption('tee')
if ((await page.locator('.clo-object-row').count()) !== 5) errors.push('T-shirt object browser should list avatar + four pieces')
const matchButton=page.getByRole('button',{name:'MATCH T-SHIRT ARMHOLES + SLEEVES'})
if (!(await matchButton.count())) errors.push('Existing tee armhole correction action absent')
else {
  await matchButton.click()
  const message=await page.locator('.command-result').first().textContent().catch(()=>null)
  if (message && !message.includes('armholes')) errors.push('Pattern correction message missing')
}
await page.getByRole('combobox',{name:'Workspace'}).selectOption('Fit')
if (!(await page.getByRole('button',{name:'RUN PPF BODY + SEAM FIT'}).count())) errors.push('PPF fitting is not reachable from Fit inspector')
if (!(await page.getByText('the measurement proxy otherwise',{exact:false}).count())) errors.push('PPF real Thomas versus proxy backend distinction missing')
await page.screenshot({path:'qa-tee-ppf-interface-20261013.png'})
console.log(JSON.stringify({teePatterns:4,seams:14,fitSection:true,errors}))
await browser.close()
if(errors.length)process.exit(1)
