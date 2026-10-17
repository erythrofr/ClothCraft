import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
try {
  const page=await browser.newPage({viewport:{width:1440,height:960}})
  const errors=[]
  page.on('pageerror', e=>errors.push(e.message))
  await page.goto(process.env.EXO_QA_URL||'http://127.0.0.1:5188/?desktop=1',{waitUntil:'domcontentloaded'})
  await page.getByRole('navigation',{name:'Library categories'}).getByRole('button',{name:'Hardware and Trims'}).click()
  const lib=page.getByLabel('Hardware and trims library')
  assert.match(await lib.innerText(),/18 of 28 hardware designs/)
  assert.equal(await lib.locator('[data-hardware-preset="denim-copper-rivet"]').count(),0)
  await lib.getByRole('button',{name:'All designs'}).click()
  assert.match(await lib.innerText(),/28 of 28 hardware designs/)
  await lib.getByRole('button',{name:'Rivets folder'}).click()
  assert.equal(await lib.locator('[data-hardware-preset="denim-copper-rivet"]').count(),1)
  await lib.getByRole('button',{name:'Featured designs'}).click()
  assert.match(await lib.innerText(),/18 of 28 hardware designs/)
  assert.deepEqual(errors,[])
  console.log('PASS: 18 featured, 28 full library, weak rivet hidden by default and recoverable, zero page errors')
} finally {await browser.close()}
