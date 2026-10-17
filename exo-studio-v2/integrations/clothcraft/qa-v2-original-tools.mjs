// Independent V2 GUI verification. Dedicated local services and throwaway
// garment output: cannot modify either installed application's saved project.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {existsSync,mkdirSync,mkdtempSync,copyFileSync} from 'node:fs'
import {homedir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-v2-tools-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const reference=path.join(homedir(),'Library/Application Support/EXO-ClothCraft-Studio/Snapshots/V1-20261016')
for(const f of ['fitting-project.json','fitting-project.json.native'])
 if(existsSync(path.join(reference,f)))copyFileSync(path.join(reference,f),path.join(output,'workspace',f))
const rust=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
assert(existsSync(rust),'Build V2 Rust exo-session binary first')
const processes=[]
function start(binary,args,env={}) {
 const p=spawn(binary,args,{cwd:root,env:{...process.env,...env},stdio:'ignore',detached:true})
 processes.push(p)
 return p
}
async function ready(url){
 for(let i=0;i<100;i++){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(1200)});if(r.ok)return}catch{}
  if(processes.some(p=>p.exitCode!==null))throw Error('V2 test process exited before ready')
  await sleep(250)
 }
 throw Error('Timeout waiting for '+url)
}
const base='http://127.0.0.1:5415',ui='http://127.0.0.1:5416'
async function snapshot(){
 const r=await fetch(base+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"op":"snapshot"}'})
 const v=await r.json()
 assert(v.ok,JSON.stringify(v.error))
 return v.data
}
let browser
try{
 start(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:rust,EXO_CLOTHCRAFT_GPU:'0'})
 start(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],
  {VITE_CLOTHCRAFT_BRIDGE_URL:base})
 await Promise.all([ready(base+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const p=await browser.newPage({viewport:{width:1728,height:1040}}),errors=[],actions=[]
 p.on('pageerror',e=>errors.push(e.message))
 p.on('response',r=>{if(r.url().endsWith('/workspace')&&r.request().method()==='POST')actions.push(r.request().postDataJSON())})
 await p.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await p.locator('.cc-board [data-panel]').first().waitFor({timeout:50000})
 const board=p.locator('.cc-board svg'),front=p.locator('.cc-board [data-panel]').first()
 // These are our original Garment Studio ViewportQuickTools/CadToolIcon
 // families, *not* substitute FRONT text buttons. A compact vertical gray
 // toolbar sits at upper-left of each independent viewport; hover opens a
 // horizontal right-facing row of working/disabled actions.
 const widgets = [
  {dimension:'2D',viewport:'.cc-board',count:6,hover:'Select / Transform'},
  {dimension:'3D',viewport:'.cc-scene',count:5,hover:'Select / Move'},
 ]
 for(const {dimension,viewport,count,hover} of widgets){
  const host=p.locator(viewport),rail=host.getByRole('toolbar',{name:`${dimension} viewport quick tools`})
  assert.equal(await rail.count(),1,`${dimension} original corner widget missing`)
  assert.equal(await rail.locator('.clo-corner-tool-group > button').count(),count)
  const geometry=await rail.evaluate(node=>{
   const host=node.closest('.cc-board,.cc-scene').getBoundingClientRect(),rect=node.getBoundingClientRect()
   const rgb=getComputedStyle(node).backgroundColor,layout=getComputedStyle(node).flexDirection
   return {left:rect.left-host.left,top:rect.top-host.top,rgb,layout,width:rect.width,height:rect.height}
  })
  assert(geometry.left>=0 && geometry.left<20 && geometry.top>=0 && geometry.top<20,`${dimension} widget not in top-left corner: ${JSON.stringify(geometry)}`)
  assert.equal(geometry.layout,'column',`${dimension} widget rail must be vertical`)
  assert(geometry.height>geometry.width*2,`${dimension} widget should be taller than wide`)
  assert(geometry.rgb.includes('40, 42, 45'),`${dimension} tool rail must keep original neutral gray palette`)
  const family=rail.locator(`.clo-corner-tool-group > button[title="${hover}"]`),row=rail.getByRole('group',{name:`${hover} alternatives`})
  assert.equal(await row.isVisible(),false,`${dimension} flyout should begin collapsed`)
  await family.hover()
  assert.equal(await row.isVisible(),true,`${dimension} hover should open options`)
  const alignment=await row.evaluate(node=>{
   const base=node.parentElement.getBoundingClientRect(),rect=node.getBoundingClientRect()
   return {x:rect.left-base.right,y:Math.abs(rect.top-base.top),orientation:getComputedStyle(node).flexDirection,width:rect.width,height:rect.height}
  })
  assert(alignment.x>=-2 && alignment.y<12,`${dimension} hover options must open to the right of original icon`)
  assert.equal(alignment.orientation,'row',`${dimension} hover tools should be horizontal`)
  assert(alignment.width>alignment.height*2,`${dimension} flyout should be wider than tall`)
  await p.screenshot({path:path.join(output,`v2-original-${dimension.toLowerCase()}-corner-hover.png`)})
  await family.focus()
  assert.equal(await row.isVisible(),true,`${dimension} alternatives must also work with keyboard focus`)
  await p.locator('.clo-mac-menu').click({position:{x:10,y:10}})
 }
 // The new original icon widgets are functional and dispatch to the same
 // Rust-backed modes as the existing global EXO controls.
 const boardTools=p.locator('.cc-board').getByRole('toolbar',{name:'2D viewport quick tools'})
 const sceneTools=p.locator('.cc-scene').getByRole('toolbar',{name:'3D viewport quick tools'})
 await boardTools.getByRole('button',{name:'Edit Sewing',exact:true}).click()
 assert(await p.locator('.cc-embedded-bottom').getByRole('button',{name:'Sew edges'}).evaluate(el=>el.classList.contains('active')))
 await boardTools.getByRole('button',{name:'Internal Line / Dart',exact:true}).click()
 assert(await p.locator('.cc-embedded-bottom').getByRole('button',{name:'Internal line'}).evaluate(el=>el.classList.contains('active')))
 await boardTools.locator('.clo-corner-tool-group > button[title="Select / Transform"]').click()
 await sceneTools.locator('.clo-corner-tool-group > button[title="Select / Move"]').click()
 assert(await p.locator('.cc-embedded-bottom').getByRole('button',{name:'Move 3D'}).evaluate(el=>el.classList.contains('active')))
 await sceneTools.getByRole('button',{name:'Rotate Garment',exact:true}).click()
 assert(await p.locator('.cc-embedded-bottom').getByRole('button',{name:'Rotate 3D'}).evaluate(el=>el.classList.contains('active')))
 await sceneTools.getByRole('button',{name:'Fabric Hand',exact:true}).click()
 assert(await p.locator('.cc-embedded-bottom').getByRole('button',{name:'Grab / stretch'}).evaluate(el=>el.classList.contains('active')))
 await sceneTools.getByRole('button',{name:'Orbit Camera',exact:true}).click()
 // One 3D avatar mesh is the ONLY source of the 2D silhouette. Both views
 // appear/disappear together, and no fixed SVG figure is drawn without it.
 const currentAvatar=p.locator('[aria-label="Silhouette of current 3D avatar"]')
 const avatarToggle=p.locator('.cc-embedded-bottom').getByRole('button',{name:'Avatar',exact:true})
 await currentAvatar.waitFor({timeout:30000})
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.avatarVisible==='true')
 const liveMesh=await currentAvatar.evaluate(e=>({vertices:Number(e.dataset.sourceVertices),faces:Number(e.dataset.sourceFaces),contours:Number(e.dataset.contours),d:e.querySelector('path')?.getAttribute('d')}))
 assert(liveMesh.vertices>1000 && liveMesh.faces>1000,'SVG must be computed from actual native 3D mesh')
 assert(liveMesh.d?.length>100,'SVG mask must follow model contours, not a generic primitive')
 await avatarToggle.click()
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.avatarVisible==='false')
 assert.equal(await currentAvatar.count(),0,'No 2D body while 3D body is hidden')
 await avatarToggle.click()
 await currentAvatar.waitFor({timeout:12000})
 assert.equal(await p.locator('.cc-scene canvas').getAttribute('data-avatar-visible'),'true')
 assert.equal(await currentAvatar.evaluate(e=>e.querySelector('path')?.getAttribute('d')),liveMesh.d,'Show/hide must not substitute a different mannequin')
 // Geometry swap regression: *same triangulation*, changed width gives a
 // different SVG. Hiding or missing avatar data must never draw a mannequin.
 const swapped=await p.evaluate(async()=>{
  const {projectAvatarSilhouette}=await import('/src/components/avatarSilhouetteFromMesh.js')
  const faces=[[0,1,2],[0,2,3]]
  const specimen=half=>({positions:[[-half,0,0],[half,0,0],[half,1.8,0],[-half,1.8,0]],triangles:faces})
  const a=projectAvatarSilhouette(specimen(.20)),b=projectAvatarSilhouette(specimen(.34))
  return {hasNull:projectAvatarSilhouette(null)!==null,a:a?.d,b:b?.d,contours:a?.contourCount}
 })
 assert.equal(swapped.hasNull,false)
 assert(swapped.a?.startsWith('M')&&swapped.b?.startsWith('M'))
 assert.notEqual(swapped.a,swapped.b,'Silhouette must adapt when a different 3D mesh is selected')
 // Original EXO chrome and Rust controls occupy ONE top bar, not three
 // duplicate ClothCraft title rows in each viewport.
 assert.equal(await p.locator('.cc-embedded-top,.cc-embedded-disclosure,.cc-embedded-main h2').count(),0)
 assert.equal(await p.locator('.exo-v2-rust-engine').count(),1)
 const step=p.getByRole('button',{name:'Step ClothCraft Rust simulation'})
 assert.equal(await step.count(),1)
 assert.equal(await front.getAttribute('fill-opacity'),'1','SVG garment cannot show the silhouette through its cloth')
 assert.equal(await front.getAttribute('fill'),'#f4f4f3','Use Garment Studio exact selected pattern fabric fill')
 assert.equal(await p.locator('.clo-mac-menu').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(37, 37, 39)')
 assert.equal(await p.locator('.cc-board').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(198, 199, 201)')
 // The original EXO Render > Lighting preset selector now drives the visible
 // native ClothCraft stage, rather than a hidden browser-only 3D editor.
 const canvas=p.locator('.cc-scene canvas')
 assert.equal(await canvas.getAttribute('data-studio-lighting-preset'),'studio')
 await p.getByRole('combobox',{name:'Workspace',exact:true}).selectOption('Render')
 const lighting=p.getByRole('combobox',{name:'Lighting preset'})
 await lighting.selectOption('dramatic')
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.studioLightingPreset==='dramatic')
 await lighting.selectOption('studio')
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.studioLightingPreset==='studio')
 await p.getByRole('combobox',{name:'Workspace',exact:true}).selectOption('Pattern')
 assert.equal(await p.getByRole('group',{name:'3D viewport orientation widget'}).count(),1)
 // Colored 3D sewing/contact points are generated from REAL Rust seam guide
 // endpoints. Check all palette colors and the visible/unlit marker meshes.
 const scene=canvas
 await p.waitForFunction(()=>Number(document.querySelector('.cc-scene canvas')?.dataset.seamMarkerCount)>0,{timeout:12000})
 const marks=await scene.evaluate(el=>({count:+el.dataset.seamMarkerCount,visible:+el.dataset.seamMarkerVisibleCount,colors:JSON.parse(el.dataset.seamMarkerColors),palette:JSON.parse(el.dataset.seamMarkerPalette)}))
 assert(marks.count>24,`Expected sewn garment dots, found ${marks.count}`)
 assert.equal(marks.visible,marks.count,'Rust sewing dots should be visible on shirt by default')
 assert(marks.colors.length>=3,'Different seam sections must retain different mark colors')
 const toggleDots=p.getByRole('button',{name:'Seam dots',exact:true})
 await toggleDots.click()
 assert.equal(await scene.evaluate(el=>+el.dataset.seamMarkerVisibleCount),0,'Seam dots visibility toggle failed')
 await toggleDots.click()
 assert.equal(await scene.evaluate(el=>+el.dataset.seamMarkerVisibleCount),marks.count,'Seam dots did not reappear')
 assert.equal(await p.getByRole('group',{name:'2D board view controls'}).count(),1)
 // The Object Browser's real BULLET category icon is first in the
 // HORIZONTAL tab toolbar, directly below Object Browser and before Scene.
 const rail=p.getByRole('navigation',{name:'Right workspace tools'})
 const objectTabs=p.getByRole('tablist',{name:'Object Browser types'})
 const menu=objectTabs.getByRole('tab',{name:'Object Browser category list'})
 assert.equal(await menu.count(),1)
 const tabNames=await objectTabs.locator('[role=tab]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')))
 assert.deepEqual(tabNames,['Object Browser category list','Fabric','Graphic','Button','Buttonhole','Topstitch','Puckering','Grading','POM'])
 const adjacency=await objectTabs.evaluate(row=>{
  const trigger=row.querySelector('.clo-object-tab-menu'),scene=row.querySelector('[role="tab"][aria-label="Fabric"]')
  const head=row.parentElement.querySelector('.clo-panel-header')?.getBoundingClientRect()
  const a=trigger?.getBoundingClientRect(),b=scene?.getBoundingClientRect()
  return row.firstElementChild===trigger&&trigger?.nextElementSibling===scene&&Math.abs(a.top-b.top)<2&&a.top>=head.bottom-1
 })
 assert(adjacency,'Object Browser bullet icon must be the first horizontal item before Fabric')
 assert.equal(await rail.getByRole('button',{name:'Object Browser category list'}).count(),0)
 await menu.click()
 const categories=p.getByRole('navigation',{name:'Object Browser categories'})
 for(const title of ['2D Pattern','Sewing','3D Form','Material','Environment'])
  assert.equal(await categories.getByRole('button',{name:title,exact:true}).count(),1)
 await categories.getByRole('button',{name:'Material',exact:true}).click()
 await categories.getByRole('button',{name:'Fabric Editor'}).click()
 assert.equal(await p.getByRole('tab',{name:'Fabric',exact:true,selected:true}).count(),1)
 await menu.click()
 await categories.getByRole('button',{name:'Environment',exact:true}).click()
 await categories.getByRole('button',{name:'Studio Lighting'}).click()
 assert.equal(await p.getByRole('combobox',{name:'Workspace',exact:true}).inputValue(),'Render')
 const viewMode=rail.getByRole('button',{name:'Show focused tools'})
 assert.equal(await viewMode.count(),1,'All/focused switch remains separate in vertical rail')
 await viewMode.click()
 assert.equal(await rail.getByRole('button',{name:'Show all tools'}).count(),1)
 await rail.getByRole('button',{name:'Show all tools'}).click()
 // Live top Rust Step is a real solver action; use the isolated QA backend.
 const firstFrame=await snapshot()
 await step.click()
 await sleep(650)
 const secondFrame=await snapshot()
 assert(secondFrame.time>firstFrame.time,'Native Step did not advance the Rust solver')
 const alignment=await p.evaluate(()=>{
  const svg=document.querySelector('.cc-board svg'),pieces=[...svg.querySelectorAll('[data-panel]')]
  const garment=pieces[0].getBoundingClientRect(),back=pieces[1].getBoundingClientRect()
  const center=new DOMPoint(0,.76).matrixTransform(svg.getScreenCTM()).x
  const body=svg.querySelector('[aria-label="Centered front avatar silhouette"]').getBoundingClientRect()
  return {x:center,frontX:garment.left+garment.width/2,
   bodyX:body.left+body.width/2,bodyHeight:body.height,backRight:back.right,boardRight:svg.getBoundingClientRect().right}
 })
 assert(Math.abs(alignment.x-alignment.frontX)<2,'Front pattern not over center axis')
 assert(Math.abs(alignment.x-alignment.bodyX)<2,'Avatar not over center axis')
 assert(alignment.backRight<=alignment.boardRight+2,'Back pattern clipped')
 assert(alignment.bodyHeight>170,'Silhouette is not a full-height figure')
 await front.click({force:true})
 await p.screenshot({path:path.join(output,'v2-centered-original-exo.png')})
 assert.equal(await p.locator('.clo-mac-menu').count(),1,'Original EXO menu missing')
 assert.equal(await p.locator('.clo-left-3d-double-bars').count(),2,'EXO dual toolbars missing')

 // A real 2D move must not snap back because of the front-axis alignment.
 const b0=await snapshot(),r0=await front.boundingBox()
 const x=r0.x+r0.width*.5,y=r0.y+r0.height*.67
 await p.mouse.move(x,y);await p.mouse.down()
 await p.mouse.move(x+32,y+13,{steps:12});await p.mouse.up();await sleep(700)
 const b1=await snapshot(),r1=await front.boundingBox()
 assert(b1.revision>b0.revision,'2D drag did not reach Rust')
 assert(r1.x>r0.x+10,'2D pattern snapped back to the body axis')

 // The actual Garment Studio 360-degree ring must commit a *Rust* rotation.
 await p.getByRole('button',{name:'Rotate 3D',exact:true}).click()

 await p.waitForFunction(()=>{
  const el=document.querySelector('.cc-scene canvas')
  return Number(el?.dataset.gizmoRingRadius)>20
 },{timeout:10000})
 const gizmo=await canvas.evaluate(el=>({x:+el.dataset.gizmoCenterX,y:+el.dataset.gizmoCenterY,r:+el.dataset.gizmoRingRadius}))
 const rect=await canvas.boundingBox(),before=await snapshot()
 const gx=rect.x+gizmo.x,gy=rect.y+gizmo.y,r=gizmo.r*1.24
 await p.mouse.move(gx+r,gy);await p.mouse.down()
 await p.mouse.move(gx+r*.72,gy+r*.7,{steps:16});await p.mouse.up();await sleep(700)
 const rotation=actions.filter(a=>a.op==='pose-panel'&&a.rotation_delta_degrees?.some(n=>Math.abs(n)>.1)).at(-1)
 assert(rotation,'360-degree wheel did not rotate ClothCraft via Rust')
 const after=await snapshot()
 assert(after.revision>before.revision)
 for(const panel of before.panels.filter(panel=>panel.id!==rotation.panel))
  assert.deepEqual(after.positions.slice(...panel.vertices),before.positions.slice(...panel.vertices),
    'Rotation changed an unselected simulated panel')
 // In Hand mode there must be no movable transform widget even while a
 // garment is selected. A drag on cloth should reach Rust's brush command.
 await sceneTools.getByRole('button',{name:'Fabric Hand',exact:true}).click()
 await p.waitForFunction(()=>{
  const el=document.querySelector('.cc-scene canvas')
  return el?.dataset.gizmoVisible==='false' && !el.dataset.gizmoRingRadius
 })
 const pullBefore=actions.filter(a=>a.op==='pull-panel').length
 const positions=[[0,0],[0,-24],[0,24],[-30,0],[30,0]]
 for(const [dx,dy] of positions) {
  if(actions.filter(a=>a.op==='pull-panel').length>pullBefore)break
  await p.mouse.move(gx+dx,gy+dy)
  await p.mouse.down()
  await p.mouse.move(gx+dx+35,gy+dy+18,{steps:8})
  await p.mouse.up()
  await sleep(300)
 }
 assert(actions.filter(a=>a.op==='pull-panel').length>pullBefore,'Fabric Hand drag did not submit a Rust pull-panel brush')
 await sceneTools.getByRole('button',{name:'Rotate Garment',exact:true}).click()
 await p.waitForFunction(()=>document.querySelector('.cc-scene canvas')?.dataset.gizmoVisible==='true')
 const blank=await canvas.boundingBox()
 await p.mouse.click(blank.x+blank.width*.94,blank.y+blank.height*.92)
 await p.waitForFunction(()=>{
  const el=document.querySelector('.cc-scene canvas')
  return el?.dataset.gizmoVisible==='false' && !el.dataset.gizmoRingRadius
 })
 assert.equal(await p.locator('.cc-scene canvas').getAttribute('data-gizmo-visible'),'false','Empty-space deselection must remove the move/rotate widget')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,centerAxisDeltaPx:alignment.x-alignment.frontX,
  silhouetteAxisDeltaPx:alignment.x-alignment.bodyX,boardDragMovedPx:r1.x-r0.x,
  rotatedPanel:rotation.panel,otherPanelsUnchanged:true,handPullVerified:true,backgroundClearsGizmo:true,qaOutput:output,errors},null,2))
}finally{
 await browser?.close().catch(()=>{})
 for(const p of processes)try{process.kill(-p.pid,'SIGTERM')}catch{}
}
