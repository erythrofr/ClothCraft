/** Verifies the installed, signed macOS EXO V2 Property Editor in place.
 * Does not write to the live garment or open a visible external browser.
 */
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {chromium} from 'playwright-core'
const app=path.join(os.homedir(),'Applications/EXO ClothCraft Studio V2.app')
const indexFile=path.join(app,'Contents/Resources/web/index.html')
const root=process.cwd()
const oldFiles=[
  ['dist/index.html',indexFile],
  ['integrations/clothcraft/workspace.mjs',path.join(app,'Contents/Resources/integrations/clothcraft/workspace.mjs')],
  ['research/oss/clothcraft/target/debug/exo-session',path.join(app,'Contents/Resources/research/oss/clothcraft/target/debug/exo-session')],
]
execFileSync('codesign',['--verify','--deep','--strict',app])
for(const [src,dst] of oldFiles)
 assert.deepEqual(fs.readFileSync(path.join(root,src)),fs.readFileSync(dst),'Installed version differs: '+src)
const response=await fetch('http://127.0.0.1:5386/',{signal:AbortSignal.timeout(6000)})
assert(response.ok)
assert.equal(await response.text(),fs.readFileSync(indexFile,'utf8'))
const health=await (await fetch('http://127.0.0.1:5385/health',{signal:AbortSignal.timeout(6000)})).json()
assert(health.ok&&health.nativeReady&&health.rustCheckoutReady)
const browser=await chromium.launch({headless:true,
 executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 args:['--disable-gpu']})
try{
 const page=await browser.newPage({viewport:{width:1660,height:1040}})
 const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:5386/?desktop=1&engine=clothcraft',
  {waitUntil:'domcontentloaded',timeout:30000})
 const board=page.locator('.cc-board')
 await board.locator('[data-panel]').first().waitFor({timeout:35000})
 const inspector=page.locator('.clo-property-panel')
 const tabs=page.getByRole('tablist',{name:'Object Browser types'})
 const headings=()=>inspector.locator('.clo-pe-trigger span').allInnerTexts()
 const info=inspector.getByRole('region',{name:'Information properties'})
 // A native pattern row, selected without changing its dimensions.
 const scene=page.locator('.clo-object-list .clo-object-select').nth(1)
 await scene.waitFor()
 await scene.click()
 assert.deepEqual(await headings(),
  ['Information','Selected Line','Simulation Properties','Fabric','Bond','Solidify','Arrange','Miscellaneous'])
 for(const name of ['name','itemNo','type'])
  assert.equal(await info.locator('[data-property-field="'+name+'"] input').count(),1)
 assert.equal(await info.locator('[data-property-field="type"] input').getAttribute('readonly'),'')
 assert.equal(await info.locator('[data-property-field="name"] input').isEditable(),true)
 const patternName=await info.locator('[data-property-field="name"] input').inputValue()
 assert(patternName.length>0)
 // Fabric selection switches to actual Rust fabric asset, not draft swatch.
 await tabs.getByRole('tab',{name:'Fabric',exact:true}).click()
 const fabric=page.locator('.clo-object-list .clo-object-select').first()
 await fabric.waitFor()
 await fabric.click()
 assert.deepEqual(await headings(),['Information','Material','Physical Property','Miscellaneous'])
 const fabricName=await info.locator('[data-property-field="name"] input').inputValue()
 assert(fabricName.length>0)
 for(const name of ['name','itemNo','type','construction','supplier','owner'])
  assert.equal(await info.locator('[data-property-field="'+name+'"] input').count(),1,
   'Native Fabric field: '+name)
 assert.equal(await info.locator('[data-property-field="type"] input').inputValue(),'Fabric')
 assert.equal(await info.locator('[data-property-field="type"] input').getAttribute('readonly'),'')
 assert.equal(await info.getByText('2D Perimeter').count(),0,
  'Fabric Information must not show previously selected Pattern perimeter')
 assert.equal(await info.getByText('3D Perimeter').count(),0,
  'Fabric Information must not inherit Pattern measurements')
 const physical=inspector.getByRole('region',{name:'Physical Property properties'})
 assert(await physical.locator('.cc-fabric-library').count()>0,'Native physical fabric controls must be embedded')
 const material=inspector.getByRole('region',{name:'Material properties'})
 assert.equal(await material.getByRole('tab',{name:'Front',exact:true}).count(),1)
 assert.equal(await material.getByRole('tab',{name:'Back',exact:true}).isDisabled(),true)
 assert.equal(await material.getByRole('tab',{name:'Side',exact:true}).isDisabled(),true)
 const basic=material.getByRole('button',{name:'BASIC PARAMETERS',exact:true})
 const reflection=material.getByRole('button',{name:'REFLECTION',exact:true})
 const basicRegion=material.getByRole('region',{name:'Basic Parameters'})
 const reflectionRegion=material.getByRole('region',{name:'Reflection'})
 assert.equal(await basic.getAttribute('aria-expanded'),'true')
 assert.equal(await reflection.getAttribute('aria-expanded'),'true')
 await basic.click()
 assert.equal(await basic.getAttribute('aria-expanded'),'false')
 assert.equal(await basicRegion.isVisible(),false)
 if(!(await reflectionRegion.isVisible())){
  console.log('NESTED_VISIBILITY_DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>{
   const basic=document.getElementById('clo-pe-material-basic')
   const reflection=document.getElementById('clo-pe-material-reflection')
   const parent=reflection?.closest('.clo-pe-section')
   return {
    basicHidden:basic?.hidden,basicDisplay:basic?getComputedStyle(basic).display:null,
    reflectionHidden:reflection?.hidden,reflectionDisplay:reflection?getComputedStyle(reflection).display:null,
    reflectionParentExpanded:parent?.classList.contains('expanded'),
    parentHidden:parent?.querySelector('.clo-pe-content')?.hidden,
    parentHTML:parent?.outerHTML.slice(0,500)
   }
  }),null,2))
 }
 assert.equal(await reflectionRegion.isVisible(),true)
 await basic.click()
 assert.equal(await basicRegion.isVisible(),true)
 await reflection.click()
 assert.equal(await reflection.getAttribute('aria-expanded'),'false')
 assert.equal(await reflectionRegion.isVisible(),false)
 await reflection.click()
 assert.equal(await reflectionRegion.isVisible(),true)
 // Returning to the pattern must not leave Fabric-specific subgroups active.
 await tabs.getByRole('tab',{name:'Object Browser category list'}).count()
 await board.locator('[data-panel]').first().dispatchEvent('click')
 await page.waitForFunction(()=>document.querySelectorAll('.clo-pe-trigger').length===8)
 assert.deepEqual(await headings(),['Information','Selected Line','Simulation Properties','Fabric','Bond','Solidify','Arrange','Miscellaneous'])
 assert.equal(await info.locator('[data-property-field="construction"]').count(),0)
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,signedNativeApp:true,matchingBundle:true,
  localServicesReady:true,patternName,selectedFabricName:fabricName,
  nativeFabricInfoFields:6,realPhysicsControls:true,contextSwitch:true,typeReadOnly:true,
  nestedMaterialDisclosures:true,
  warnings:'No CLO-only physics controls claimed implemented',errors:[]},null,2))
}finally{await browser.close()}
