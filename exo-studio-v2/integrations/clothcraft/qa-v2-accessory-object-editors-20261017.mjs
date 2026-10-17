/** Bounded full V2 browser QA. Changes only an isolated browser's EXO draft,
 * never the signed native app's actual garment or Rust solver workspace. */
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {mkdir} from 'node:fs/promises'

const base=process.env.EXO_QA_URL||'http://127.0.0.1:5386'
const output='docs/qa/screenshots'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],
})
try {
  const context=await browser.newContext({viewport:{width:1630,height:960}})
  const page=await context.newPage()
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(base+'/?desktop=1&engine=clothcraft&testSession=accessory-qa',{waitUntil:'domcontentloaded',timeout:60000})
  await page.locator('.cc-board [data-panel="front"]').waitFor({timeout:35000})
  const browserPanel=page.getByRole('region',{name:'Object Browser'})
  const tabs=page.getByRole('tablist',{name:'Object Browser types'})
  const editor=page.locator('.clo-property-panel')
  const tested=[]
  const configurations=[
    {tab:'Button',group:'Button Style & Dimensions',field:'diameterCm',value:'3.1',expect:'3.1'},
    {tab:'Buttonhole',group:'Buttonhole',field:'lengthCm',value:'2.8',expect:'2.8'},
    {tab:'Zipper',group:'Zipper Style',field:'chainWidthMm',value:'8',expect:'8'},
    {tab:'Topstitch',group:'Stitch',field:'stitchLengthMm',value:'4.5',expect:'4.5'},
    {tab:'Puckering',group:'Puckering',field:'amplitudeMm',value:'2.5',expect:'2.5'},
  ]
  for(const {tab,group,field,value,expect} of configurations){
    await tabs.getByRole('tab',{name:tab,exact:true}).click()
    await editor.getByText('Choose a '+tab.toLowerCase(),{exact:false}).first().waitFor({timeout:8000})
    const add=browserPanel.getByRole('button',{name:'+ Add '+tab.toLowerCase()})
    const priorCount=await browserPanel.locator('.clo-object-row').count()
    await add.click()
    await page.waitForFunction(prior=>document.querySelectorAll('.clo-object-list .clo-object-row').length===prior+1,priorCount)
    // Some template fixtures already contain topstitches; always edit the
    // newly created, selected record instead of an older default first row.
    const first=browserPanel.locator('.clo-object-row .clo-object-select[aria-current="true"]')
    await first.waitFor({timeout:8000})
    assert.match(await first.innerText(),new RegExp(tab,'i'),tab+' row must appear')
    const headings=await editor.locator('.clo-pe-trigger span').allInnerTexts()
    assert.ok(headings.includes(group),tab+' context accordion '+JSON.stringify(headings))
    assert.equal(await editor.getByRole('combobox',{name:'Select native sewing relationship'}).count(),0,
      tab+' draft properties should not mix native sewing selection')
    if(group==='Zipper Style'){
      const specification=editor.getByRole('button',{name:'Chain, Tape & Dimensions'})
      if(await specification.getAttribute('aria-expanded')!=='true')await specification.click()
    }
    const input=editor.locator('[data-property-field="'+field+'"] input')
    await input.waitFor({state:'visible',timeout:9000})
    await input.fill(value)
    await input.press('Enter')
    await page.waitForFunction(({field,value})=>{
      const element=document.querySelector('[data-property-field="'+field+'"] input')
      return element && Math.abs(Number(element.value)-Number(value))<.00001
    },{field,value:expect})
    await page.waitForTimeout(180)
    console.log('field edited',tab,field,'value',await input.inputValue(),'notices',await page.locator('.clo-command-result, .clo-pe-field-error,[role="alert"]').allInnerTexts())
    await first.click()
    console.log('field reselected',tab,field,'value',await input.inputValue())
    assert.equal(Number(await input.inputValue()),Number(expect),tab+' should preserve typed edit after reselect')
    const sourceReadout=await editor.innerText()
    assert.match(sourceReadout,/EXO draft/i,'native runtime must identify draft annotation')
    await editor.screenshot({path:output+'/exo-v2-accessory-'+tab.toLowerCase()+'-properties-20261017.png'})
    const remove=browserPanel.getByRole('button',{name:/^Remove /})
    await remove.click()
    await page.waitForFunction(prior=>document.querySelectorAll('.clo-object-list .clo-object-row').length===prior,priorCount)
    tested.push({tab,group,field,value,objectCreated:true,editVerified:true,removed:true})
  }
  // EXO's existing debounced project autosave must also preserve a draft
  // annotation after an actual page reload in the same isolated browser.
  await tabs.getByRole('tab',{name:'Puckering',exact:true}).click()
  await browserPanel.getByRole('button',{name:'+ Add puckering'}).click()
  await editor.locator('[data-property-field="amplitudeMm"] input').fill('3.3')
  await editor.locator('[data-property-field="amplitudeMm"] input').press('Enter')
  await page.waitForTimeout(950)
  await page.reload({waitUntil:'domcontentloaded'})
  await page.locator('.cc-board [data-panel="front"]').waitFor({timeout:35000})
  await page.getByRole('tablist',{name:'Object Browser types'}).getByRole('tab',{name:'Puckering',exact:true}).click()
  const savedRow=page.locator('.clo-object-list .clo-object-select').first()
  await savedRow.waitFor({timeout:8000})
  await savedRow.click()
  assert.equal(Number(await page.locator('[data-property-field="amplitudeMm"] input').inputValue()),3.3,
    'EXO draft puckering should survive a full reload in the same saved document')
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({pass:true,tested,reloadPersistence:true,errors,source:'isolated V2 native hybrid browser session',url:base},null,2))
  await context.close()
} finally {
  await browser.close()
}
