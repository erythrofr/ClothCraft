import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message))
 await p.goto('http://127.0.0.1:5386/?desktop=1&engine=clothcraft')
 await p.locator('.cc-board [data-panel]').first().waitFor({timeout:30000})
 await p.getByRole('combobox',{name:'Workspace',exact:true}).selectOption('Fabric')
 await p.getByRole('region',{name:'Native fabric library'}).waitFor()
 assert.equal(await p.locator('[data-fabric-preset]').count(),9)
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({installedApp:true,nativePanelsVisible:true,fabrics:9,errors}))
}finally{await b.close()}
