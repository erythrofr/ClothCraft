import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'

const browser = await chromium.launch({
  headless: true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
const page = await browser.newPage({viewport:{width:1600,height:980}})
const errors=[]
page.on('pageerror',error=>errors.push(error.message))
await page.goto('http://127.0.0.1:5188/?desktop=1&defaultAvatar=clo-thomas',{waitUntil:'domcontentloaded'})
await page.waitForTimeout(1500)
const guide=page.locator('.draft-avatar-render')
if ((await guide.getAttribute('href')) !== '/avatars/guides/clo-thomas.png') errors.push('Thomas is not the active 2D silhouette')
for (const model of ['clo-thomas','theo','nora','makehuman-base']) {
  const response = await page.request.get(`http://127.0.0.1:5188/avatars/guides/${model}.png`)
  if (!response.ok()) errors.push(`Missing ${model} projected guide: ${response.status()}`)
}
await page.screenshot({path:'qa-avatar-guide-thomas-20261013.png'})
await page.getByRole('combobox',{name:'Workspace'}).selectOption('Avatar')
const avatarSelect=page.getByLabel('Fitting avatar')
for (const model of ['theo','nora','makehuman-base','clo-thomas']) {
  await avatarSelect.selectOption(model)
  if ((await guide.getAttribute('href')) !== `/avatars/guides/${model}.png`) errors.push(`Guide did not follow selected ${model}`)
}
console.log(JSON.stringify({guide:'CLO Thomas front projection',models:4,errors}))
await browser.close()
if (errors.length)process.exit(1)
