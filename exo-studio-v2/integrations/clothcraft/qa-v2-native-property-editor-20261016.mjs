/** E2E 2D pattern / native Rust fabric Property Editor regression.
 * Isolated native workspace: never modifies the user's signed-app project.
 * Browser runs HEADLESS, no separate browser window is opened.
 */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,openSync,readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-native-property-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const api='http://127.0.0.1:5415',ui='http://127.0.0.1:5416',children=[]
function launch(exe,args,env={}){
 const logFile=path.join(output,args[0]?.includes('server.mjs')?'native-service.log':'ui-service.log')
 const fd=openSync(logFile,'a')
 const p=spawn(exe,args,{cwd:root,detached:true,stdio:['ignore',fd,fd],env:{...process.env,...env}})
 p.on('exit',(code,signal)=>console.log('Service exited',logFile,code,signal))
 children.push(p)
}
async function ready(url){
 for(let i=0;i<100;i++){
  try{if((await fetch(url,{signal:AbortSignal.timeout(850)})).ok)return}catch{}
  if(children.some(p=>p.exitCode!==null))throw Error('Fixture service stopped: '+url)
  await new Promise(resolve=>setTimeout(resolve,250))
 }
 throw Error('Timed out waiting for '+url)
}
async function command(body){
 let response
 try{response=await fetch(api+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
 catch(error){console.log('Service error log:',readFileSync(path.join(output,'native-service.log'),'utf8').slice(-6500));throw error}
 const result=await response.json()
 assert(result.ok,JSON.stringify(result.error))
 return result.data
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
 console.log('QA stage: services ready')
 await Promise.all([ready(api+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--disable-gpu']})
 const page=await browser.newPage({viewport:{width:1700,height:1050}})
 const errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 const board=page.locator('.cc-board')
 console.log('QA stage: board front')
 await board.locator('[data-panel="front"]').waitFor({timeout:40000})
 const inspector=page.locator('.clo-property-panel')
 const headings=()=>inspector.locator('.clo-pe-trigger span').allInnerTexts()
 const area=name=>inspector.getByRole('region',{name:name+' properties'})
 const identity=field=>area('Information').locator('[data-property-field="'+field+'"] input')
 const commit=async(field,value)=>{
  const input=identity(field)
  await input.fill(String(value))
  await input.press('Enter')
 }
 const snapshot=await command({op:'snapshot'})
 const panelId=snapshot.template.panels[0].id
 const fabricId=snapshot.template.fabrics[0].id
 const scene=page.getByRole('tablist',{name:'Object Browser types'})
 assert.equal(await page.locator('.clo-object-browser .clo-object-select').count(),snapshot.template.panels.length+1)
 console.log('QA stage: select pattern')
 await page.locator('.clo-object-list .clo-object-select').filter({hasText:snapshot.template.panels[0].name}).first().click()
 await page.waitForFunction(name=>document.querySelector('.clo-pe-header strong')?.textContent===name,snapshot.template.panels[0].name)
 assert.deepEqual(await headings(),[
  'Information','Selected Line','Simulation Properties','Fabric','Bond','Solidify','Arrange','Miscellaneous'])
 assert.equal(await identity('name').inputValue(),snapshot.template.panels[0].name)
 assert.equal(await identity('itemNo').inputValue(),'')
 assert.equal(await identity('type').inputValue(),'Pattern Piece')
 assert.equal(await identity('type').getAttribute('readonly'),'')
 const renamedPanel='EXO Native Front QA'
 console.log('QA stage: rename pattern')
 await commit('name',renamedPanel)
 await page.waitForFunction(name=>document.querySelector('.clo-pe-header strong')?.textContent===name,renamedPanel)
 assert.equal((await command({op:'snapshot'})).template.panels.find(p=>p.id===panelId).name,renamedPanel)
 console.log('QA stage: itemNo pattern')
 await commit('itemNo','P-2026-FRONT')
 await page.waitForTimeout(180)
 assert.equal((await command({op:'snapshot'})).propertyMetadata.panels[panelId].itemNo,'P-2026-FRONT')
 console.log('QA stage: switch Fabric')
 await scene.getByRole('tab',{name:'Fabric',exact:true}).click()
 const fabricRow=page.locator('.clo-object-list .clo-object-select').filter({hasText:snapshot.template.fabrics[0].name}).first()
 console.log('QA stage: select native fabric')
 await fabricRow.click()
 assert.deepEqual(await headings(),['Information','Material','Physical Property','Miscellaneous'])
 assert.equal(await identity('name').inputValue(),snapshot.template.fabrics[0].name)
 assert.equal(await identity('type').inputValue(),'Fabric')
 const fabricName='EXO Native Fabric QA'
 console.log('QA stage: rename native fabric')
 await commit('name',fabricName)
 await page.waitForFunction(name=>document.querySelector('.clo-pe-header strong')?.textContent===name,fabricName)
 const checks={itemNo:'F-2026',construction:'Cotton French Terry',supplier:'Test Mill',owner:'EXO QA'}
 console.log('QA stage: write fabric metadata')
 for(const [field,value] of Object.entries(checks)){
  await commit(field,value)
  console.log('QA field saved:',field)
  await page.waitForTimeout(120)
 }
 let after=await command({op:'snapshot'})
 assert.equal(after.template.fabrics.find(f=>f.id===fabricId).name,fabricName)
 for(const [field,value] of Object.entries(checks))
  assert.equal(after.propertyMetadata.fabrics[fabricId][field],value,field+' must be native saved')
 assert.equal(await area('Material').count(),1)
 assert.equal(await area('Physical Property').count(),1)
 assert.equal(await area('Information').getByText('2D Perimeter').count(),0,
   'Fabric Information must not reuse selected Pattern metrics')
 assert.equal(await area('Information').getByText('3D Perimeter').count(),0,
   'Fabric must not inherit 3D pattern perimeter')
 assert.equal(await area('Simulation Properties').count(),0,'Fabric cannot inherit Pattern physics groups')
 assert.equal(await area('Arrange').count(),0,'Fabric cannot inherit Pattern arrangement groups')
 // Fabric's Physical Property pane hosts live ClothCraft solver controls.
 const physicsInGroup=await area('Physical Property').locator('.cc-fabric-library').count()
 if(!physicsInGroup){
  console.log('Fabric portal diagnostic',JSON.stringify(await page.evaluate(()=>({
   hostCount:document.querySelectorAll('#cc-native-fabric-inspector').length,
   hostParent:document.querySelector('#cc-native-fabric-inspector')?.parentElement?.className,
   nativeLibraryCount:document.querySelectorAll('.cc-fabric-library').length,
   dockCount:document.querySelectorAll('.cc-native-fabric-dock').length,
   physicalRegion:document.querySelector('[aria-label="Physical Property properties"]')?.outerHTML.slice(0,1600),
  })),null,2))
 }
 assert(physicsInGroup>0,'Native fabric controls must be inside selected Fabric > Physical Property')
 await page.screenshot({path:path.join(output,'fabric-context-edited.png')})
 // Clicking a real pattern swaps the schema and identity without leaking
 // the last selected Fabric's editable fields into its Information section.
 console.log('QA stage: return pattern')
 await board.locator('[data-panel="front"]').first().dispatchEvent('click')
 await page.waitForFunction(()=>!!document.querySelector('.clo-pe-list .clo-pe-trigger'))
 assert.deepEqual(await headings(),[
  'Information','Selected Line','Simulation Properties','Fabric','Bond','Solidify','Arrange','Miscellaneous'])
 assert.equal(await identity('name').inputValue(),renamedPanel)
 assert.equal(await identity('itemNo').inputValue(),'P-2026-FRONT')
 assert.equal(await area('Material').count(),0)
 assert.deepEqual(errors,[],'Frontend errors')
 console.log(JSON.stringify({passed:true,output,patternRename:true,patternItemNo:true,
  nativeFabricRename:true,nativeFabricMetadata:Object.keys(checks),contextIsolation:true,
  livePhysicalFabricControls:true,typeReadOnly:true,errors},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of children)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
