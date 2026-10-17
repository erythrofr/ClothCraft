// End-to-end native selected-edge inspection, not invented draft dimensions.
// Every request uses disposable service ports and an isolated garment folder.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdirSync,mkdtempSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'
import {measureNativeSelection} from '../../src/core/clothcraftSelectionMetrics.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-line-context-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const api='http://127.0.0.1:5415',ui='http://127.0.0.1:5416',children=[]
const launch=(bin,args,env={})=>{
 const worker=spawn(bin,args,{cwd:root,stdio:'ignore',detached:true,env:{...process.env,...env}})
 children.push(worker);return worker
}
async function ready(url){for(let i=0;i<110;i++){
 try{if((await fetch(url,{signal:AbortSignal.timeout(1400)})).ok)return}catch{}
 if(children.some(w=>w.exitCode!==null))throw Error('QA process ended')
 await new Promise(resolve=>setTimeout(resolve,220))
}throw Error('QA service timeout '+url)}
let browser
try{
 launch(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0',
 })
 launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:api})
 await Promise.all([ready(api+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1700,height:1050}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await page.locator('.cc-board [data-edge]').first().waitFor({timeout:50000})
 const snapshotRequest=async()=>{
  const res=await fetch(api+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot'})})
  const json=await res.json();assert(json.ok,JSON.stringify(json.error));return json.data
 }
 const initial=await snapshotRequest()
 const candidates=(await page.locator('.cc-board [data-edge]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-edge'))))
 const chosen=candidates.map(id=>{const [panel,...rest]=id.split(':');return{panel,edge:rest.join(':')}})
   .find(sel=>!initial.template.seams.some(seam=>[seam.a,seam.b].some(side=>side?.panel===sel.panel&&side?.edge===sel.edge)))
 assert(chosen,'Need an unsewn boundary for safe target editing')
 const selection=chosen
 const edge=page.locator(`.cc-board [data-edge="${selection.panel}:${selection.edge}"]`)
 const actual=measureNativeSelection(initial,selection)
 assert.equal(actual?.kind,'line');assert(actual.length2DCm>0&&actual.length3DCm>0)
 await edge.dispatchEvent('click')
 await page.waitForFunction(()=>{
  const title=document.querySelector('.clo-pe-header strong')?.textContent
  return title&&title!=='Native garment'
 },{timeout:20000})
 const line=page.getByRole('button',{name:'Selected Line',exact:true})
 if(await line.getAttribute('aria-expanded')!=='true')await line.click()
 const region=page.getByRole('region',{name:'Selected Line properties'})
 await region.waitFor()
 const metrics=await region.locator('.clo-pe-readout').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.querySelector('span')?.textContent,n.querySelector('strong')?.textContent])))
 assert.equal(metrics['Selected Line'],selection.edge)
 // Selection context must follow the *last clicked object*. Fabric asset
 // selection narrows the Property Editor; picking a native boundary again
 // restores line readouts and the eight pattern-related sections.
 await page.getByRole('tablist',{name:'Object Browser types'}).getByRole('tab',{name:'Fabric',exact:true}).click()
 await page.locator('.clo-object-list .clo-object-select').first().click()
 assert.deepEqual(await page.locator('.clo-pe-trigger span').allInnerTexts(),['Information','Material','Physical Property','Miscellaneous'])
 await edge.dispatchEvent('click')
 await page.waitForFunction(()=>document.querySelectorAll('.clo-pe-trigger').length===8)
 assert.equal(await page.getByRole('region',{name:'Selected Line properties'}).count(),1)
 assert.equal(metrics['2D Line Length'],`${actual.length2DCm.toFixed(2)} cm`)
 assert.equal(metrics['3D Line Length'],`${actual.length3DCm.toFixed(2)} cm`)
 assert.equal(metrics['3D Stretch'],`${actual.elongationPercent>=0?'+':''}${actual.elongationPercent.toFixed(2)}%`)
 const unitSelect=page.getByRole('combobox',{name:'Property Editor length unit'})
 await unitSelect.selectOption('mm')
 assert.equal(await region.locator('.clo-pe-readout').filter({hasText:'2D Line Length'}).locator('strong').innerText(),`${(actual.length2DCm*10).toFixed(1)} mm`)
 await unitSelect.selectOption('in')
 assert.equal(await region.locator('.clo-pe-readout').filter({hasText:'3D Line Length'}).locator('strong').innerText(),`${(actual.length3DCm/2.54).toFixed(3)} in`)
 assert.equal((await snapshotRequest()).revision,initial.revision,'Changing measurement display units must not edit Rust geometry')
 await unitSelect.selectOption('cm')
 assert.equal(await region.getByRole('checkbox',{name:'Elastic physical simulation not yet implemented'}).isDisabled(),true)
 assert.equal(await region.getByRole('checkbox',{name:'Seam taping physical simulation not yet implemented'}).isDisabled(),true)
 const input=region.getByRole('spinbutton',{name:'Target 2D length (cm)'})
 const requested=Math.min(1000,Math.max(0.01,Number((actual.length2DCm*1.02).toFixed(2))))
 await input.fill(String(requested))
 await region.getByRole('button',{name:'SET LENGTH SPEC'}).click()
 await page.waitForFunction(([panel,edge,target])=>{
  const input=document.getElementById('clo-pe-target-length')
  return input?.value===Number(target).toFixed(2)
 },[selection.panel,selection.edge,requested],{timeout:10000})
 await page.waitForFunction(revision=>{const indicator=document.querySelector('.clo-pe-line-target button');return indicator&&!indicator.disabled},initial.revision,{timeout:12000})
 let after=await snapshotRequest()
 for(let i=0;i<50&&after.revision===initial.revision;i++){await new Promise(r=>setTimeout(r,100));after=await snapshotRequest()}
 const updated=measureNativeSelection(after,selection)
 assert(Math.abs(updated.targetLengthCm-requested)<.005,'Native drafting target did not persist through Rust session')
 assert.deepEqual(after.template.panels.map(p=>p.id),initial.template.panels.map(p=>p.id),'Line target update changed native garment panel structure')
 const capabilities=await (await fetch(api+'/agent/v1/capabilities')).json()
 assert.deepEqual(capabilities.capabilities.map(cap=>cap.id),['workspace.status','workspace.snapshot','simulation.pause','simulation.step','line.inspect','line.setTargetSpecification'])
 const status=await (await fetch(api+'/agent/v1/status')).json()
 assert(status.ok&&status.loaded,'Agent facade must reuse same open native workspace')
 const agentRequest=async body=>{const response=await fetch(api+'/agent/v1/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:response.status,json:await response.json()}}
 const snapshotAgent=await agentRequest({action:'workspace.snapshot'})
 assert.equal(snapshotAgent.status,200)
 assert.equal(snapshotAgent.json.data.revision,after.revision)
 const nativeLine=await agentRequest({action:'line.inspect',panel:selection.panel,edge:selection.edge})
 assert.equal(nativeLine.status,200)
 assert(Math.abs(nativeLine.json.length2dCm-actual.length2DCm)<1e-8)
 assert(Math.abs(nativeLine.json.length3dCm-actual.length3DCm)<1e-8)
 assert(Math.abs(nativeLine.json.targetSpecificationCm-requested)<.005)
 const unsupportedLine=await agentRequest({action:'line.inspect',panel:selection.panel,edge:'not-a-real-edge'})
 assert.equal(unsupportedLine.status,404)
 const stale=await agentRequest({action:'simulation.pause',expectedRevision:after.revision-1})
 assert.equal(stale.status,409)
 assert.equal(stale.json.code,'STALE_REVISION')
 const invalid=await agentRequest({action:'simulation.fake',expectedRevision:after.revision})
 assert.equal(invalid.status,400)
 const safePause=await agentRequest({action:'simulation.pause',expectedRevision:after.revision})
 assert.equal(safePause.status,200)
 const agentTarget=Number(Math.min(1000,requested+0.4).toFixed(2))
 const agentMutation=await agentRequest({action:'line.setTargetSpecification',panel:selection.panel,edge:selection.edge,
   expectedRevision:after.revision,targetCm:agentTarget})
 assert.equal(agentMutation.status,200)
 assert.equal(agentMutation.json.revision,after.revision+1)
 const agentAfter=await snapshotRequest()
 assert(Math.abs(measureNativeSelection(agentAfter,selection).targetLengthCm-agentTarget)<.005)
 assert.deepEqual(agentAfter.positions,after.positions,'Agent drafting specification must not change live garment geometry')
 await page.screenshot({path:path.join(output,'native-selected-line-properties.png')})
 // A native sewing pair is its own Property Editor context; show measured
 // lengths for BOTH named boundaries and the current 3D gap. This path is
 // part of the actual V2 right-side inspector, not the old standalone sidebar.
 const workspaceSelect=page.getByRole('combobox',{name:'Workspace',exact:true})
 await workspaceSelect.selectOption('Sewing')
 const nativeSeamPicker=page.getByRole('combobox',{name:'Select native sewing relationship'})
 await nativeSeamPicker.waitFor({timeout:20000})
 const seamId=initial.template.seams[0].id
 await nativeSeamPicker.selectOption(seamId)
 const seamExpected=measureNativeSelection(agentAfter,{seamId})
 assert.equal(seamExpected?.kind,'sewing')
 assert(seamExpected.first?.length2DCm>0&&seamExpected.second?.length2DCm>0)
 const sewingAccordion=page.locator('.clo-pe-list').getByRole('button',{name:'Sewing',exact:true})
 await sewingAccordion.waitFor({timeout:10000})
 if(await sewingAccordion.getAttribute('aria-expanded')!=='true')await sewingAccordion.click()
 const sewingInfo=page.getByRole('region',{name:'Sewing properties'})
 await sewingInfo.waitFor()
 const sewingMetrics=await sewingInfo.locator('.clo-pe-readout').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.querySelector('span')?.textContent,n.querySelector('strong')?.textContent])))
 assert.equal(sewingMetrics['Sewing Relationship'],seamId)
 assert.equal(sewingMetrics['First 2D Line Length'],`${seamExpected.first.length2DCm.toFixed(2)} cm`)
 assert.equal(sewingMetrics['Second 2D Line Length'],`${seamExpected.second.length2DCm.toFixed(2)} cm`)
 assert.equal(sewingMetrics['Ease Allowed'],seamExpected.allowEase?'Yes':'No')
 assert.equal(sewingMetrics['Reverse Orientation'],seamExpected.reversed?'Yes':'No')
 await page.screenshot({path:path.join(output,'native-selected-sewing-properties.png')})
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,selected:selection,real2DCm:actual.length2DCm,
  real3DCm:actual.length3DCm,extensionPercent:actual.elongationPercent,
  targetSavedCm:updated.targetLengthCm,agentTargetSavedCm:agentTarget,agentCapabilities:capabilities.capabilities.length,nativeSeamId:seamId,nativeSeam2DCm:[seamExpected.first.length2DCm,seamExpected.second.length2DCm],staleCommandRejected:true,elasticAndTapePhysicalUnsupported:true,
  noUnrelatedGarmentEdits:true,errors,output},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}
}
