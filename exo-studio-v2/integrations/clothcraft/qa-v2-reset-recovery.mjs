// Verify RESET PANELS also repairs a document whose saved cloth pose cannot
// load. The original saved project is copied into an isolated test directory;
// this test never modifies the installed user document or launches its apps.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {existsSync,mkdirSync,mkdtempSync,copyFileSync,readFileSync,readdirSync} from 'node:fs'
import {homedir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-reset-recover-'))
const folder=path.join(output,'workspace');mkdirSync(folder,{recursive:true})
const source=path.join(homedir(),'Library/Application Support/EXO-ClothCraft-Studio-V2/Output/workspace/fitting-project.json')
assert(existsSync(source),'Need an existing V2 saved garment to test recovery')
copyFileSync(source,path.join(folder,'fitting-project.json'))
if(existsSync(source+'.native'))copyFileSync(source+'.native',path.join(folder,'fitting-project.json.native'))
const original=JSON.parse(readFileSync(source,'utf8'))
const ui='http://127.0.0.1:5416',backend='http://127.0.0.1:5415',children=[]
function start(file,args,env={}){
 const child=spawn(file,args,{cwd:root,stdio:'ignore',detached:true,env:{...process.env,...env}})
 children.push(child)
 return child
}
async function wait(url){for(let i=0;i<90;i++){
 try{if((await fetch(url,{signal:AbortSignal.timeout(1200)})).ok)return}catch{}
 if(children.some(p=>p.exitCode!==null))throw Error('Test server ended unexpectedly')
 await new Promise(r=>setTimeout(r,250))
}throw Error('Recovery QA server timeout: '+url)}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),EXO_CLOTHCRAFT_GPU:'0'})
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],{VITE_CLOTHCRAFT_BRIDGE_URL:backend})
 await Promise.all([wait(backend+'/health'),wait(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1550,height:940}}),errors=[],commands=[]
 page.on('pageerror',e=>errors.push(e.message))
 let intercepted=false
 await page.route(backend+'/workspace',async route=>{
  const body=route.request().postDataJSON()
  commands.push(body.op)
  // Simulate a real saved-pose OGC load failure in the browser, without
  // relying on a nondeterministic collision or corrupting the user file.
  if(body.op==='snapshot'&&!intercepted){
   intercepted=true
   await route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({ok:false,error:'OGC initial intersection: invalid saved drape',data:null})})
  }else await route.continue()
 })
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await page.locator('.cc-error').waitFor({timeout:45000})
 assert.equal(await page.locator('.cc-board svg').count(),0,'Initial broken garment unexpectedly rendered')
 const reset=page.getByRole('button',{name:'Reset pattern position outside avatar'})
 assert(await reset.isEnabled(),'Recovery button must remain clickable when the project failed to load')
 await reset.click()
 await page.getByText('Recovered off-body panels from the saved garment.',{exact:false}).waitFor({timeout:45000})
 await page.locator('.cc-board svg').waitFor({timeout:45000})
 const backups=readdirSync(folder).filter(f=>f.includes('.before-off-body-reset-'))
 assert(backups.some(f=>f.endsWith('.bak')),'Must back up the saved JSON before overwriting')
 assert(backups.some(f=>f.endsWith('.bak.native')),'Must back up native saved drape too')
 const restored=JSON.parse(readFileSync(path.join(folder,'fitting-project.json'),'utf8'))
 assert.equal(restored.state?.time,0,'Recovery must open off-body starting pose')
 assert.deepEqual(restored.template,original.template,'Recovery changed authored panels or sewing')
 assert.equal(JSON.parse(readFileSync(source,'utf8')).state?.time,original.state?.time,'QA altered live user document')
 assert(commands.includes('recover-off-body'),'UI button did not call native recovery workflow')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,missingProjectUIRecovered:true,offBodyReset:true,backupFiles:backups.length,authoredPatternPreserved:true,userProjectUntouched:true,errors},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of children)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
