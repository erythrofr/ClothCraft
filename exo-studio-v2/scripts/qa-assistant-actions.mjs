import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {interpretAssistantIntent,ASSISTANT_ACTIONS} from '../src/core/assistantActions.js'
const samples=[
 ['show fabrics','library.open'],['open 2D','workspace.view'],
 ['import svg','pattern.importSvg'],['save project','project.save'],
 ['start simulation','simulation.start'],['undo','history.undo'],
 ['export a render','render.exportStill'],
]
for(const [prompt,action] of samples)assert.equal(interpretAssistantIntent(prompt)?.action,action,prompt)
assert.equal(interpretAssistantIntent('buy 500 yards of fabric automatically'),null)
assert.equal(interpretAssistantIntent('delete all project files'),null)
assert.ok(ASSISTANT_ACTIONS.length>=12)
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto((process.env.EXO_QA_URL||'http://127.0.0.1:5188')+'/?desktop=1&testSession=assistant-actions',{waitUntil:'domcontentloaded'})
 const assistant=page.getByRole('textbox',{name:'EXO tool assistant'})
 await assistant.fill('show fabrics');await assistant.press('Enter')
 await page.locator('.exo-fabric-entry-main').first().waitFor()
 assert.equal(await page.locator('.exo-fabric-entry-main').count(),400)
 await assistant.fill('open 2D');await assistant.press('Enter')
 assert.equal(await page.locator('select[aria-label="3D and 2D window arrangement"]').inputValue(),'2d')
 await assistant.fill('use Foundation Tee pattern');await assistant.press('Enter')
 await page.waitForTimeout(150)
 assert.match(await page.locator('.project-meta').innerText(),/0 SEAMS/)
 await assistant.fill('show stages');await assistant.press('Enter')
 assert.equal(await page.locator('.exo-stage-card').count(),5)
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({pass:true,registeredActions:ASSISTANT_ACTIONS.length,verifiedIntents:samples.length,unrecognizedRejected:2,stageCards:5,svgIndependent:true,errors:0}))
}finally{await browser.close()}
