// Standalone Object Browser menu relocation regression. Runs disposable
// localhost services and never edits either installed Studio's saved garment.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdirSync,mkdtempSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-object-menu-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const api='http://127.0.0.1:5415',ui='http://127.0.0.1:5416',children=[]
const launch=(binary,args,env={})=>{
 const p=spawn(binary,args,{cwd:root,env:{...process.env,...env},stdio:'ignore',detached:true})
 children.push(p);return p
}
const ready=async url=>{
 for(let n=0;n<100;n++){
  try{if((await fetch(url,{signal:AbortSignal.timeout(1200)})).ok)return}catch{}
  if(children.some(child=>child.exitCode!==null))throw Error('QA server stopped')
  await new Promise(resolve=>setTimeout(resolve,200))
 }
 throw Error('QA timeout: '+url)
}
let browser
try{
 launch(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0'})
 launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],
  {VITE_CLOTHCRAFT_BRIDGE_URL:api})
 await Promise.all([ready(api+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1660,height:1010}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await page.getByRole('tablist',{name:'Object Browser types'}).waitFor({timeout:40000})
 const toolbar=page.getByRole('tablist',{name:'Object Browser types'})
 const bullet=toolbar.getByRole('tab',{name:'Object Browser category list'})
 const actualTabs=await toolbar.locator('[role="tab"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')))
 assert.deepEqual(actualTabs,['Object Browser category list','Fabric','Graphic','Button','Buttonhole','Topstitch','Puckering','Grading','POM'],'Exactly nine Object Browser tools, in user-specified order')
 const scene=toolbar.getByRole('tab',{name:'Fabric',exact:true})
 assert.equal(await bullet.count(),1,'Exactly one Object Browser bullet button should exist')
 const layout=await toolbar.evaluate(row=>{
  const trigger=row.querySelector('.clo-object-tab-menu')
  const scene=row.querySelector('[role="tab"][aria-label="Fabric"]')
  const header=row.parentElement.querySelector('.clo-panel-header')?.getBoundingClientRect()
  const a=trigger?.getBoundingClientRect(),b=scene?.getBoundingClientRect()
  const rail=document.querySelector('.clo-right-tool-palette')
  return {firstChild:row.firstElementChild===trigger,
   directlyBeforeScene:trigger?.nextElementSibling===scene,
   sameHorizontalRow:Math.abs((a?.top||0)-(b?.top||0))<2,
   underTitle:(a?.top||0)>=(header?.bottom||0),
   equalCellWidth:Math.abs((a?.width||0)-(b?.width||0))<2,
   notInVerticalTools:!rail?.querySelector('.clo-object-category-trigger'),
  }
 })
 assert.deepEqual(layout,{firstChild:true,directlyBeforeScene:true,sameHorizontalRow:true,underTitle:true,equalCellWidth:true,notInVerticalTools:true})
 assert.equal(await bullet.getAttribute('aria-selected'),'false')
 await bullet.click()
 assert.equal(await bullet.getAttribute('aria-selected'),'true')
 const categories=page.getByRole('navigation',{name:'Object Browser categories'})
 await categories.waitFor()
 const titles=['2D Pattern','Sewing','3D Form','Material','Environment']
 for(const name of titles) assert.equal(await categories.getByRole('button',{name,exact:true}).count(),1,name)
 assert.equal(await categories.getByRole('button',{name:'Pattern Pieces'}).count(),1)
 const placement=await categories.evaluate(node=>{
  const browser=node.closest('.clo-object-browser')
  const tabs=browser.querySelector('.clo-object-tabs').getBoundingClientRect()
  const area=node.getBoundingClientRect(),browserRect=browser.getBoundingClientRect()
  const styles=getComputedStyle(node)
  return {belowTabRow:area.top>=tabs.bottom+15,
    withinPanel:area.left>=browserRect.left-1&&area.right<=browserRect.right+1&&area.bottom<=browserRect.bottom+1,
    normalFlow:styles.position==='relative'&&styles.boxShadow==='none',
    fullWidth:area.width/browserRect.width>.95,
    replacesObjects:!browser.querySelector('.clo-object-list,.clo-object-search,.clo-fabric-preview'),
  }
 })
 assert.deepEqual(placement,{belowTabRow:true,withinPanel:true,normalFlow:true,fullWidth:true,replacesObjects:true},
  'Object categories must occupy the Object Browser panel just like other tabs, not a floating menu')
 await categories.getByRole('button',{name:'Sewing',exact:true}).click()
 assert.equal(await categories.getByRole('button',{name:'Sewing Relationships'}).count(),1)
 await categories.getByRole('button',{name:'Material',exact:true}).click()
 await categories.getByRole('button',{name:'Fabric Editor'}).click()
 assert.equal(await categories.count(),0,'Selecting a nested category returns to normal Object Browser view')
 assert.equal(await page.getByRole('tab',{name:'Fabric',selected:true}).count(),1)
 await bullet.click()
 await categories.getByRole('button',{name:'Environment',exact:true}).click()
 await categories.getByRole('button',{name:'Studio Lighting'}).click()
 assert.equal(await page.getByRole('combobox',{name:'Workspace',exact:true}).inputValue(),'Render')
 await bullet.click()
 assert.equal(await categories.count(),1)
 await toolbar.getByRole('tab',{name:'Fabric',exact:true}).click()
 assert.equal(await categories.count(),0,'Clicking Fabric must replace categories with Fabric objects')
 assert.equal(await page.locator('.clo-object-list').count(),1)
 await bullet.click()
 await page.screenshot({path:path.join(output,'object-menu-first-horizontal-icon.png')})
 const rightRail=page.getByRole('navigation',{name:'Right workspace tools'})
 assert.equal(await rightRail.getByRole('button',{name:'Object Browser category list'}).count(),0)
 const all=rightRail.getByRole('button',{name:'Show focused tools'})
 assert.equal(await all.count(),1,'All/focused toggle should remain independent in its original tools header')
 await all.click()
 assert.equal(await rightRail.getByRole('button',{name:'Show all tools'}).count(),1)
 assert.equal(await toolbar.getByRole('tab',{name:'Object Browser category list'}).count(),1)
 await rightRail.getByRole('button',{name:'Show all tools'}).click()
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,firstIconUnderObjectBrowser:true,horizontalWithFabric:true,nineTools:true,
  inlineObjectBrowserView:true,categoryRows:titles,childCategoryNavigation:true,allFocusedAvailable:true,
  output,errors},null,2))
} finally {
 await browser?.close().catch(()=>{})
 for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}
}
