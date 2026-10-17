// Test that the actual EXO Sample 3D chrome (not a reproduction) surrounds the
// native ClothCraft center and that key global EXO controls route to Rust.
// This browser QA deliberately uses the isolated 5194 Rust session.
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'

const browser=await chromium.launch({headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const context=await browser.newContext({viewport:{width:1512,height:982},acceptDownloads:true})
 const page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 page.on('dialog',dialog=>dialog.accept())
 await page.route('http://127.0.0.1:5193/workspace',async route=>{
  const response=await route.fetch({url:'http://127.0.0.1:5194/workspace'})
  await route.fulfill({response})
 })
 await page.goto('http://127.0.0.1:5174/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 const root=page.locator('.cc-rust-embedded')
 await root.locator('.cc-scene canvas').waitFor({timeout:60000})
 await root.locator('.cc-board svg').waitFor({timeout:40000})
 assert.equal(await page.locator('.clo-mac-menu').count(),1,'Actual EXO menu bar missing')
 assert.equal(await page.locator('.project-strip').count(),1,'EXO project/command bar missing')
 assert.equal(await page.locator('.asset-browser').count(),1,'Real EXO asset browser missing')
 assert.equal(await page.getByRole('complementary',{name:'3D and sewing toolbar'}).count(),1)
 assert.equal(await page.locator('.clo-left-3d-double-bars').count(),2,'EXO dual-column 3D/2D tools missing')
 assert.equal(await page.locator('.clo-right-tool-palette').count(),1,'EXO right tool bar missing')
 assert.equal(await page.locator('.clo-inspector').count(),1,'EXO inspector missing')
 assert.equal(await page.locator('.simulation-bar').count(),1,'EXO bottom simulation controls missing')
 assert.equal(await page.locator('.clo-exo-not-real').count(),0)
 await page.waitForFunction(()=>document.querySelector('.project-name input')?.value.toLowerCase().includes('tshirt'),{timeout:12000})

 // Rust is now the source of truth for the visible center and top metadata.
 const before=await root.locator('.cc-embedded-footer').innerText()
 await page.locator('.cc-embedded-actions').getByRole('button',{name:'Step',exact:true}).click()
 await page.waitForFunction(previous=>document.querySelector('.cc-embedded-footer')?.textContent!==previous,before,{timeout:50000})
 await page.locator('.cc-embedded-footer').getByText('Rust session ready').waitFor({timeout:50000})
 await page.locator('.clo-mac-menu').getByRole('button',{name:'Save Rust'}).click()
 await root.locator('.cc-notice').getByText(/Workspace saved/).waitFor({timeout:30000})

 // The *original* EXO left-bar duplicate and top-bar undo now mutate the
 // native Rust garment currently visible in the center, not the hidden draft.
 const initialPanels=await root.locator('.cc-embedded-title').innerText()
 const beforeCount=Number(initialPanels.match(/(\d+) panels/)?.[1])
 assert.ok(Number.isFinite(beforeCount))
 await root.locator('.cc-board [data-panel]').first().click({force:true})
 await page.getByRole('button',{name:'Duplicate selected pattern'}).click()
 await page.waitForFunction(expected=>document.querySelector('.cc-embedded-title')?.textContent.includes(`${expected} panels`),beforeCount+1,{timeout:45000})
 await page.locator('.clo-mac-menu').getByRole('button',{name:'Undo',exact:true}).click()
 await page.waitForFunction(expected=>document.querySelector('.cc-embedded-title')?.textContent.includes(`${expected} panels`),beforeCount,{timeout:45000})

 await page.locator('.clo-mac-menu').getByRole('button',{name:/SIM|PAUSE/}).first().click()
 await page.waitForFunction(()=>document.querySelector('.clo-simulate-main')?.textContent.includes('PAUSE'),{timeout:30000})
 await page.locator('.clo-simulate-main').click()
 await page.waitForFunction(()=>document.querySelector('.clo-simulate-main')?.textContent.includes('SIM'),{timeout:30000})

 // Send real global EXO toolbar actions into native authoring, not the hidden
 // EXO browser simulation or separate garment document.
 await page.getByRole('button',{name:'Select / move',exact:true}).click()
 await page.getByRole('button',{name:'Free Sewing · sew edges'}).click()
 assert.equal(await root.getByRole('button',{name:'Sew edges'}).getAttribute('class'),'active')
 await page.getByRole('button',{name:'Toggle garment mesh wireframe'}).click()
 assert.equal(await root.getByRole('button',{name:'Wireframe'}).getAttribute('class'),'active')
 await page.locator('.clo-mac-menu').getByRole('combobox',{name:'3D and 2D window arrangement'}).selectOption('3d')
 assert.equal(await root.locator('.cc-viewport-2d').isVisible(),false)
 await page.locator('.clo-mac-menu').getByRole('combobox',{name:'3D and 2D window arrangement'}).selectOption('split')
 assert.equal(await root.locator('.cc-viewport-2d').isVisible(),true)

 // Actual EXO panel pages remain visible, and explicitly identify which
 // controls are not yet connected to the current Rust pattern document.
 const workspaceSelect=page.getByRole('combobox',{name:'Workspace',exact:true})
 await workspaceSelect.selectOption('Production')
 assert.equal(await page.locator('.clo-property-panel').count(),1)
 assert.ok((await page.locator('.cc-exo-inspector-warning').innerText()).includes('separate EXO project'))
 assert.equal(await root.locator('.cc-scene canvas').count(),1)
 await workspaceSelect.selectOption('Pattern')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,checks:['exact-exo-menu-bar','original-asset-library','dual-column-left-tools','right-side-toolbar','original-object-browser','original-property-editor','full-top-and-bottom-bars','rust-center-3d-2d','native-rust-step','global-save-to-rust','native-duplicate-via-exo-left-bar','native-undo-via-exo-top-bar','rust-sim-via-exo-top-bar','original-sew-button-to-rust','wireframe-to-rust','layout-switch','explain-unmapped-exo-tools'],errors},null,2))
 await context.close()
}finally{await browser.close()}
