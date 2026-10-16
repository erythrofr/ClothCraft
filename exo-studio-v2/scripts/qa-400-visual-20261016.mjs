import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'

const base=process.env.EXO_QA_URL||'http://127.0.0.1:5188'
const out=path.resolve('screenshots')
fs.mkdirSync(out,{recursive:true})
const result={pass:false,base,checks:{},errors:[],consoleErrors:[],failedRequests:[],optionalBridgeFailures:[],failedImages:[],captures:[]}
const isOptionalBridge=(url)=>{try {const u=new URL(url);return ['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&u.port!==new URL(base).port&&/\/(?:api\/)?(?:health|status|bridge|session|workspace|native)(?:\/|$|\?)/i.test(u.pathname)}catch{return false}}
let browser
try {
  assert.equal(Object.keys(FABRIC_PRESETS).length,400)
  browser=await chromium.launch({headless:true,executablePath:process.env.EXO_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal'],timeout:30000})
  const page=await browser.newPage({viewport:{width:1650,height:1000}})
  page.setDefaultTimeout(20000)
  page.on('pageerror',e=>result.errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push({text:m.text(),location:m.location()})})
  page.on('requestfailed',req=>{const item={method:req.method(),url:req.url(),failure:req.failure()};result.failedRequests.push(item);if(/fabric-scans|\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(item.url))result.failedImages.push(item);if(isOptionalBridge(item.url)&&/ERR_CONNECTION_REFUSED/.test(item.failure?.errorText||''))result.optionalBridgeFailures.push(item)})
  page.on('response',r=>{if(/fabric-scans/.test(r.url())&&!r.ok())result.failedImages.push([r.status(),r.url()])})
  await page.goto(`${base}/?desktop=1&testSession=tee-optical`,{waitUntil:'domcontentloaded'})
  const simulation=page.locator('.three-mount canvas').first()
  await simulation.waitFor()
  await page.waitForFunction(()=>Number(document.querySelector('.three-mount canvas')?.dataset.simulationSessionBuilds)>0)
  await page.getByRole('combobox',{name:'CLO-style workspace layout presets'}).selectOption('materials')
  await page.getByRole('button',{name:'Browse fabrics'}).click()
  const search=page.getByRole('textbox',{name:'Search library'})
  const tiles=page.locator('.asset-library-content button.asset-template.garment-tile[title^="Create "]')
  await search.fill('')
  result.checks.catalogCount=await tiles.count()
  assert.equal(result.checks.catalogCount,400)
  const panel=page.locator('.panel-section').filter({has:page.getByText('Physical fabric',{exact:true})}).first()
  const select=panel.locator('select').first()
  const preview=page.locator('.fabric-material-preview-canvas canvas')
  const rough=page.locator('.slider-row').filter({has:page.getByText('Surface roughness',{exact:true})}).locator('input[type=range]')
  const capture=async name=>{await page.waitForTimeout(600);const pixels=await preview.screenshot({animations:'disabled'});const filename=`QA-400-optical-${name}.png`;fs.writeFileSync(path.join(out,filename),pixels);result.captures.push(filename);return pixels}
  const setRough=async value=>{await rough.evaluate((el,v)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,String(v));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},value);await page.waitForTimeout(500)}
  const choose=async id=>{await select.selectOption(id);await preview.waitFor({state:'visible'});await page.waitForTimeout(450);assert.equal(await select.inputValue(),id)}
  await search.fill('Rigid Denim')
  await tiles.first().click()
  await choose('denim')
  const buildDenim=Number(await simulation.getAttribute('data-simulation-session-builds'))
  const denimBefore=await capture('denim-before')
  await setRough(0.10)
  const denimAfter=await capture('denim-after')
  result.checks.denimChanged=!denimBefore.equals(denimAfter)
  result.checks.denimSimulationStable=Number(await simulation.getAttribute('data-simulation-session-builds'))===buildDenim
  await choose('patentLeather')
  const buildPatent=Number(await simulation.getAttribute('data-simulation-session-builds'))
  const patentBefore=await capture('patent-before')
  await setRough(0.97)
  const patentAfter=await capture('patent-after')
  result.checks.patentChanged=!patentBefore.equals(patentAfter)
  result.checks.patentSimulationStable=Number(await simulation.getAttribute('data-simulation-session-builds'))===buildPatent
  await choose('polyMesh')
  const poly=await capture('poly-mesh')
  await choose('powerMesh')
  const power=await capture('power-mesh')
  result.checks.meshCanvasDifferent=!poly.equals(power)
  // These screenshots must be visually reviewed for *open holes*: differing pixels alone cannot establish alpha cutouts.
  const paths=new Set(['denim','patentLeather','polyMesh','powerMesh'].flatMap(id=>['colorSrc','normalSrc','roughnessSrc'].map(ch=>FABRIC_PRESETS[id]?.texture?.[ch]).filter(v=>typeof v==='string'&&v.startsWith('/fabric-scans'))))
  const ambient='/fabric-scans-ambientcg/Fabric046/'
  for(const ch of ['color','normal','roughness'])paths.add(`${ambient}${ch}.jpg`)
  const http=[]
  for(const p of paths){const response=await page.request.get(`${base}${p}`);http.push({path:p,status:response.status(),type:response.headers()['content-type']});assert.equal(response.status(),200,p);assert.match(response.headers()['content-type']||'',/image\//)}
  result.checks.httpMaps=http
  // Only an attributed optional local bridge connection refusal can be informational.
  // Keep console messages and failed requests in the report even when classified optional.
  result.errors=result.consoleErrors.filter(m=>!(/ERR_CONNECTION_REFUSED/.test(m.text)&&result.optionalBridgeFailures.some(r=>m.location?.url===r.url||m.location?.url===r.url.replace(/\?.*/,''))))
  result.checks.noBrowserErrors=result.errors.length===0
  result.checks.optionalBridgeUnavailable=result.optionalBridgeFailures.length
  result.checks.noFailedImages=result.failedImages.length===0
  result.checks.nonBridgeFailures=result.failedRequests.filter(r=>!result.optionalBridgeFailures.includes(r))
  assert.ok(result.checks.denimChanged,'Denim optical preview unchanged')
  assert.ok(result.checks.patentChanged,'Patent optical preview unchanged')
  assert.ok(result.checks.denimSimulationStable&&result.checks.patentSimulationStable,'Simulation rebuilt during optical edit')
  assert.ok(result.checks.meshCanvasDifferent,'Mesh variants render identically')
  assert.ok(result.checks.noBrowserErrors&&result.checks.noFailedImages,'Browser errors or failed PBR images')
  result.pass=true
} catch(e){result.error=String(e);process.exitCode=1} finally {await browser?.close();console.log(JSON.stringify(result,null,2))}
