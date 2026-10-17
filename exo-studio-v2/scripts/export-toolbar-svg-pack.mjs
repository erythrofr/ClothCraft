// Export every distinct Garment Studio CAD toolbar icon from its actual
// rendered React SVG, preserving existing function-specific artwork.
// The exporter uses the live app and NEVER copies CLO proprietary icon bytes.
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const app = readFileSync(join(root,'src/App.jsx'),'utf8')
const right = readFileSync(join(root,'src/components/RightToolPalette.jsx'),'utf8')
const leftMarkup = app.slice(app.indexOf('<aside className={`tool-rail'), app.indexOf('</aside>', app.indexOf('<aside className={`tool-rail')))
const left = [...leftMarkup.matchAll(/<CadToolIcon id="([^"]+)"/g)].map(x => x[1])
const rightIds = [...right.matchAll(/^  \['([\w-]+)','([^']+)'/gm)].map(x=>x[1])
const unique = [...new Set([...left,...rightIds])]
if(left.length !== 42 || rightIds.length !== 34 || unique.length < 40) throw new Error(`Unexpected toolbar inventory: left ${left.length}, right ${rightIds.length}, unique ${unique.length}`)
const output = join(root,'src/assets/toolbar-icons')
mkdirSync(output,{recursive:true})
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
try {
  const page = await browser.newPage({viewport:{width:1530,height:950}})
  await page.goto(process.env.GARMENT_UI_URL || 'http://127.0.0.1:5173/?desktop=1',{waitUntil:'networkidle'})
  const palette = await page.locator('.clo-reference-dual-bars button').evaluateAll(nodes => nodes.map(el=>({title:el.getAttribute('aria-label'),svg:el.querySelector('.cad-tool-icon')?.outerHTML})))
  const rails = await page.locator('.tool-rail > button').evaluateAll(nodes => nodes.map(el=>({title:el.getAttribute('title'),svg:el.querySelector('.cad-tool-icon')?.outerHTML})))
  if(palette.length !== 34 || rails.length !== 42) throw new Error(`UI inventory changed, cannot safely map generated assets: ${rails.length} / ${palette.length}`)
  const slots = [...rails.map((el,i)=>({...el,id:left[i],side:'left',position:i+1})),...palette.map((el,i)=>({...el,id:rightIds.indexOf(el.id)>=0?el.id:null,side:'right',position:i+1}))]
  // Right palette DOM order is column order; positions are exactly the source
  // CLO_REFERENCE_*_COLUMN arrays rather than list declaration order.
  const sourceColumns = ['CLO_REFERENCE_LEFT_COLUMN','CLO_REFERENCE_RIGHT_COLUMN'].flatMap(name=>{
    const m=right.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`))
    if(!m)throw new Error('Missing reference toolbar column '+name)
    return [...m[1].matchAll(/'([\w-]+)'/g)].map(x=>x[1])
  })
  for(let i=0;i<palette.length;i++)slots[rails.length+i].id=sourceColumns[i]
  const byId=new Map()
  const placements=[]
  for(const slot of slots){
    if(!unique.includes(slot.id)||!slot.svg)throw new Error(`Missing SVG in ${slot.side} position ${slot.position}: ${slot.id}`)
    placements.push({side:slot.side,position:slot.position,id:slot.id,title:slot.title})
    if(!byId.has(slot.id))byId.set(slot.id,slot.svg)
  }
  if(byId.size!==unique.length)throw new Error(`Incomplete SVG coverage ${byId.size}/${unique.length}`)
  const files=[]
  for(const id of unique){
    let svg=byId.get(id).replace(/\sclass="[^"]*"/g,'').replace(/\swidth="20"/,'').replace(/\sheight="20"/,'')
      .replace(/stroke="currentColor"/g,'stroke="#bbc3cc"')
      .replace('fill="none"','fill="none"')
      .replace(/var\(--icon-fill,([^)]*)\)/g,'$1')
      .replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ')
    if(!svg.includes('viewBox="0 0 24 24"'))throw new Error('SVG viewBox missing '+id)
    writeFileSync(join(output,`${id}.svg`),svg+'\n')
    files.push({id,file:`${id}.svg`,source:'Original Garment Studio CadToolIcon geometric drawing',status:'generated; CLO pixel-accuracy unverified'})
  }
  writeFileSync(join(output,'manifest.json'),JSON.stringify({schema:1,source:'locally rendered Garment Studio assets; not extracted CLO art',uniqueCount:unique.length,slotCount:placements.length,referenceExactMatches:0,files,placements},null,2)+'\n')
  console.log(JSON.stringify({uniqueAssets:unique.length,leftSlots:left.length,rightSlots:rightIds.length,sourceColumnOrder:sourceColumns,output},null,2))
}finally{await browser.close()}
