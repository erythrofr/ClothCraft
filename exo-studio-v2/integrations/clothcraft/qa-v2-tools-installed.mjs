import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message))
 await p.goto('http://127.0.0.1:5386/?desktop=1&engine=clothcraft')
 await p.locator('.cc-board [data-panel]').first().waitFor({timeout:30000})
 const c=p.locator('.cc-scene canvas')
 assert.equal(await c.getAttribute('data-avatar-color'),'#555b64')
 assert.equal(await p.getByRole('button',{name:'Reset fabric panels',exact:true}).count(),1)
 await p.locator('.cc-board [data-panel]').first().click({force:true})
 await p.locator('.cc-embedded-bottom').getByRole('button',{name:'Move 3D',exact:true}).click()
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.gizmoVisible==='true')
 const r=await c.boundingBox();await p.mouse.click(r.x+r.width*.94,r.y+r.height*.92)
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.gizmoVisible==='false')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({installedApp:true,greyAvatar:true,resetButton:true,moveGizmo:true,clickOffDeselects:true,errors}))
}finally{await b.close()}
