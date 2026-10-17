/**
 * CLO-style fabric panel placement acceptance on an isolated native test server.
 * Never opens or edits the installed EXO desktop app's saved garment.
 */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-inline-fabric-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
// Bridge CORS explicitly permits the isolated 5416 Vite QA origin.
const nativeUrl='http://127.0.0.1:5415'
const uiUrl='http://127.0.0.1:5416'
const children=[]
const spawnService=(executable,args,env)=>{
 const p=spawn(executable,args,{cwd:root,stdio:'ignore',detached:true,env:{...process.env,...env}})
 children.push(p)
}
async function ready(url){
 for(let i=0;i<90;i++){
  try {if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return}
  catch{}
  if(children.some(c=>c.exitCode!==null))throw Error('Fabric QA fixture stopped unexpectedly')
  await new Promise(r=>setTimeout(r,250))
 }
 throw Error('Fabric QA fixture unavailable '+url)
}
let browser
try {
 spawnService(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
 })
 spawnService(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],{
  VITE_CLOTHCRAFT_BRIDGE_URL:nativeUrl,
 })
 await Promise.all([ready(nativeUrl+'/health'),ready(uiUrl)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const results=[]
 for(const isNative of [false,true]) {
  console.log('Fabric inline QA mode:',isNative?'native':'draft')
  const page=await browser.newPage({viewport:{width:1550,height:980}})
  const pageErrors=[]
  page.on('pageerror',error=>pageErrors.push(error.message))
  try {
   await page.goto(uiUrl+`/?desktop=1&testSession=fabric-inline-${isNative?'native':'draft'}`+(isNative?'&engine=clothcraft':''),{waitUntil:'domcontentloaded'})
   await page.locator('.clo-property-panel').waitFor({timeout:30000})
   if(isNative){
    await page.locator('[data-native-clothcraft="true"]').waitFor({timeout:40000})
    await page.locator('.cc-board [data-panel]').first().waitFor({timeout:60000})
    await page.waitForFunction(()=>document.querySelectorAll('.clo-object-list .clo-object-row').length>0,null,{timeout:25000}).catch(()=>{})
   }
   const left=page.locator('.asset-browser')
   await page.getByRole('button',{name:'Browse fabrics'}).click()
   const presetList=page.getByRole('list',{name:'Fabric presets'})
   await presetList.waitFor({state:'visible'})
   assert.equal(await presetList.getByRole('listitem').count(),400)
   const scroll=await page.locator('.asset-library-content').evaluate(el=>{
    const start=el.scrollTop;el.scrollTop=800;return {height:el.clientHeight,total:el.scrollHeight,moved:el.scrollTop-start}
   })
   assert.ok(scroll.total>scroll.height+200 && scroll.moved>300,'Left fabric folder must scroll inside sidebar')
   await page.getByRole('button',{name:'Choose Fabric'}).click()
   const objectTab=page.getByRole('tablist',{name:'Object Browser types'}).getByRole('tab',{name:'Fabric',exact:true})
   await objectTab.click()
   const objectRows=page.locator('.clo-object-list .clo-object-row')
   if(!await objectRows.first().isVisible()){
    console.log('Fabric object browser diagnostic',JSON.stringify(await page.evaluate(()=>({
      selectedTab:document.querySelector('.clo-object-tab[aria-selected="true"]')?.textContent,
      objectBrowser:document.querySelector('.clo-object-browser')?.outerHTML.slice(0,2400),
      selectionHeader:document.querySelector('.clo-pe-header')?.textContent,
      right:document.querySelector('.clo-inspector-content')?.innerText.slice(0,1100),
      serviceError:document.querySelector('.cc-error')?.textContent,
      nativePanelCount:document.querySelectorAll('.cc-board [data-panel]').length,
    }))))
   }
   await objectRows.first().waitFor({timeout:10000})
   const count=await objectRows.count()
   assert.ok(count>=1&&count<400,'Right Object Browser should show scene fabrics, not full 400 presets')
   const first=objectRows.first().locator('.clo-object-select')
   await first.click()
   const editor=page.locator('.clo-property-panel')
   await editor.getByRole('button',{name:'Material',exact:true}).waitFor({timeout:20000})
   const headings=await editor.locator('.clo-pe-trigger span').allTextContents()
   assert.ok(headings.includes('Material')&&headings.includes('Physical Property'))
   assert.equal(await page.locator('.cc-native-fabric-dock').count(),0,'No floating native fabric widget')
   const white=await page.evaluate(()=>{
    const scan=[...document.querySelectorAll('.cc-fabric-library')]
    return scan.map(el=>({background:getComputedStyle(el).backgroundColor,
      inEditor:Boolean(el.closest('.clo-property-panel')),
      outOfCanvas:!el.closest('.cc-embedded-root'),
      position:getComputedStyle(el).position}))
   })
   if(isNative){
    assert.ok(white.length>=1,'Native solver fabric controls must exist')
    assert.ok(white.every(s=>s.inEditor),'Fabric controls must mount in right Property Editor')
    assert.ok(white.every(s=>!/rgb\((?:24[0-9]|25[0-5]),\s*(?:24[0-9]|25[0-5]),\s*(?:24[0-9]|25[0-5])\)/.test(s.background)),
      'No near-white fabric inspector surfaces')
   }
   await page.screenshot({path:path.join(output,`${isNative?'native':'draft'}-inline-fabric.png`),animations:'disabled'})
   assert.deepEqual(pageErrors,[])
   results.push({mode:isNative?'native':'draft',leftCount:400,rightSwatchCount:count,scroll,
    rightMaterialGroups:headings,nativePanels:white.length,noFloat:true,pageErrors:0})
  }finally{await page.close()}
 }
 console.log(JSON.stringify({pass:true,results,output}))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of children)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
