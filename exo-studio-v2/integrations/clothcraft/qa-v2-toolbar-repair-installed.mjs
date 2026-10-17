// Installed bundle smoke: inspection/display controls only, no authoring or save.
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const p=await browser.newPage({viewport:{width:1510,height:900}}),errors=[],writes=[]
 p.on('pageerror',e=>errors.push(e.message))
 p.on('request',r=>{if(r.url().endsWith('/workspace')&&r.method()==='POST')writes.push(r.postDataJSON()?.op)})
 await p.goto('http://127.0.0.1:5386/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await p.locator('.cc-board [data-panel]').first().waitFor({timeout:45000})
 const rail=p.getByRole('navigation',{name:'Right workspace tools'})
 const expand=rail.getByRole('button',{name:'Expand additional EXO tools'})
 if(await expand.count())await expand.click()
 await rail.getByRole('button',{name:'Split pattern edge',exact:true}).click()
 await p.waitForFunction(()=>document.querySelector('.cc-board svg').dataset.nativeTool==='split')
 await rail.getByRole('button',{name:'Adjust pattern curve',exact:true}).click()
 await p.waitForFunction(()=>document.querySelector('.cc-board svg').dataset.nativeTool==='curve')
 await rail.getByRole('button',{name:'Tape measure / ruler',exact:true}).click()
 await p.waitForFunction(()=>document.querySelector('.cc-board svg').dataset.nativeTool==='measure')
 await rail.getByRole('button',{name:'Fit 3D view',exact:true}).click()
 await p.waitForFunction(()=>+document.querySelector('.cc-scene canvas').dataset.cameraFitCount>0)
 await rail.getByRole('button',{name:'Surface / strain view',exact:true}).click()
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas').dataset.analysisMode==='strain')
 await rail.getByRole('button',{name:'Surface / strain view',exact:true}).click()
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas').dataset.analysisMode==='surface')
 await p.locator('[data-clo-slot="2d:A01"]').click()
 assert.deepEqual(errors,[])
 assert(!writes.some(op=>['edit','edit-batch','save','reset','open','pose-panel','pull-panel'].includes(op)),JSON.stringify(writes))
 await p.screenshot({path:'/tmp/exo-v2-toolbar-installed.png'})
 console.log(JSON.stringify({passed:true,installedBundle:true,authoringUnchanged:true,controls:['Split','Curve','Measure','Camera Fit','strain on/off','Select'],errors}))
}finally{await browser.close()}
