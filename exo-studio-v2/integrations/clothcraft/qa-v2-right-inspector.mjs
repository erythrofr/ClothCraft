// V2 right-inspector UI regression. Uses disposable local services and does
// not mutate the installed garment or independent V1 application.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdirSync,mkdtempSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-right-inspector-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const api='http://127.0.0.1:5415',ui='http://127.0.0.1:5416',children=[]
const launch=(binary,args,env={})=>{
 const child=spawn(binary,args,{cwd:root,stdio:'ignore',detached:true,env:{...process.env,...env}})
 children.push(child)
 return child
}
async function waitFor(url){
 for(let i=0;i<100;i++){
  try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}
  if(children.some(p=>p.exitCode!==null))throw new Error('QA service exited')
  await new Promise(resolve=>setTimeout(resolve,220))
 }
 throw new Error('Timed out: '+url)
}
let browser
try{
 launch(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
 })
 launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],{
  VITE_CLOTHCRAFT_BRIDGE_URL:api,
 })
 await Promise.all([waitFor(api+'/health'),waitFor(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1700,height:1080}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 const accordion=page.getByRole('list',{name:'Property Editor sections'})
 // The UI is a div with an ARIA label; assert directly to avoid list semantics.
 const list=page.locator('.clo-property-panel .clo-pe-list')
 await list.waitFor({timeout:45000})
 assert.equal(await page.locator('.clo-property-category-nav').count(),0,'Old Property Categories panel must be gone')
 assert.equal(await page.locator('.clo-property-panel .clo-pe-header').count(),1)
 const labels=['Information','Selected Line','Simulation Properties','Fabric','Bond','Solidify','Arrange','Miscellaneous']
 const actual=await list.locator('.clo-pe-trigger span').allInnerTexts()
 assert.deepEqual(actual,labels,'Property Editor dropdown headings/order mismatch')
 assert.equal(await list.locator('.clo-pe-trigger svg').count(),8,'Chevron per dropdown expected')
 assert.equal(await list.locator('.clo-pe-trigger .cad-tool-icon').count(),0,'No decorative icons on property headings')
 const headerColor=await list.locator('.clo-pe-trigger span').first().evaluate(el=>getComputedStyle(el).color)
 assert.notEqual(headerColor,'rgb(255, 255, 255)','CLO-like tinted lettering required')
 assert.notEqual(headerColor,'rgb(222, 222, 222)','Property text should differ from old gray categories')
 await page.screenshot({path:path.join(output,'right-property-editor-compact-default.png')})
 const info=list.getByRole('button',{name:'Information'})
 assert.equal(await info.getAttribute('aria-expanded'),'true')
 const selectedLine=list.getByRole('button',{name:'Selected Line'})
 await selectedLine.click()
 assert.equal(await selectedLine.getAttribute('aria-expanded'),'true')
 assert.equal(await list.getByRole('region',{name:'Selected Line properties'}).count(),1)
 await selectedLine.click()
 assert.equal(await selectedLine.getAttribute('aria-expanded'),'false')
 for(const title of ['Simulation Properties','Fabric','Bond','Solidify','Miscellaneous']){
  const trigger=list.getByRole('button',{name:title,exact:true})
  await trigger.click()
  assert.equal(await trigger.getAttribute('aria-expanded'),'true')
  assert.equal(await list.getByRole('region',{name:`${title} properties`}).count(),1)
 }
 assert((await list.getByRole('region',{name:'Bond properties'}).innerText()).includes('No equivalent native Rust bonding command'))
 assert((await list.getByRole('region',{name:'Solidify properties'}).innerText()).includes('no equivalent Solidify strength'))
 const arrange=list.getByRole('button',{name:'Arrange'})
 assert.equal(await arrange.getAttribute('aria-expanded'),'false','All eight Property Editor groups should be visible on initial load')
 assert.equal(await page.locator('#clo-pattern-properties-host').count(),1,'The drafting editor portal must stay mounted when collapsed')
 await arrange.click()
 assert.equal(await arrange.getAttribute('aria-expanded'),'true','Arrange dropdown should expand when clicked')
 assert(await list.getByRole('region',{name:'Arrange properties'}).locator('#clo-pattern-properties-host').count()===1,
  'Original functional draft tools must remain mounted inside Arrange')
 // Object Browser's first inline tab still has icons for each requested category.
 await page.getByRole('tablist',{name:'Object Browser types'}).getByRole('tab',{name:'Object Browser category list'}).click()
 const categories=page.getByRole('navigation',{name:'Object Browser categories'})
 await categories.waitFor()
 for(const title of ['2D Pattern','Sewing','3D Form','Material','Environment']){
  const button=categories.getByRole('button',{name:title,exact:true})
  assert.equal(await button.locator('.cad-tool-icon').count(),1,`Missing icon: ${title}`)
 }
 // A fabric asset in the Object Browser is a different selection *type*
 // from the active 2D/3D pattern. Its property groups must change, and
 // clicking an asset must NOT quietly apply it to the selected garment.
 await page.getByRole('tablist',{name:'Object Browser types'}).getByRole('tab',{name:'Fabric',exact:true}).click()
 await page.locator('.clo-object-list .clo-object-select').first().click()
 const fabricHeadings=await list.locator('.clo-pe-trigger span').allInnerTexts()
 assert.deepEqual(fabricHeadings,['Information','Material','Physical Property','Miscellaneous'])
 if(await list.getByRole('button',{name:'Material',exact:true}).getAttribute('aria-expanded')!=='true')
  await list.getByRole('button',{name:'Material',exact:true}).click()
 assert.equal(await list.getByRole('region',{name:'Material properties'}).locator('[data-property-field="color"]').count(),0,'Native Rust fabric must not silently edit an unrelated EXO draft swatch')
 assert.equal(await list.getByRole('tab',{name:'Front'}).count(),1)
 assert.equal(await list.getByRole('tab',{name:'Back'}).isDisabled(),true,'Do not fake independent CLO back-face materials')
 assert(await page.locator('.clo-property-panel .clo-pe-header strong').innerText())
 assert.equal(await page.getByRole('tab',{name:'Fabric',selected:true}).count(),1)
 await page.screenshot({path:path.join(output,'right-property-editor-eight-dropdowns.png')})
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,propertyHeadings:labels,oldCategoriesRemoved:true,
  independentDropdowns:true,originalFunctionalEditorPreserved:true,
  objectCategoryIcons:5,fabricContextGroups:fabricHeadings,letterColor:headerColor,output,errors},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of children)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
