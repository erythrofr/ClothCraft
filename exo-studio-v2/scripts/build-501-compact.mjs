import path from 'node:path'
import { homedir } from 'node:os'
import { mkdir, writeFile } from 'node:fs/promises'
import { create501JeansTemplate } from '../src/data/jeans501.js'
import { samplePieceBoundary, pieceArea, edgeLength } from '../src/core/project.js'
import { parseDxfPatterns } from '../src/core/dxf.js'

const project = create501JeansTemplate({ waist: 32, inseam: 32 })
const dest = process.argv[2] || path.join(homedir(),'Documents','CLO_Automation','501_Original_Jeans_W32L32')
await mkdir(dest, {recursive:true})

// A compact *multi-row* layout fixes the first version's enormous horizontal
// cutter roll, which causes CLO's Zoom Extents to make each piece tiny.
// Major legs remain together. Yokes/bands and small details follow.
const priority = (p) => {
  if (p.id.endsWith('front-leg') || p.id.endsWith('back-leg')) return 0
  if (p.id.endsWith('back-yoke')) return 1
  if (p.id.endsWith('front-waistband') || p.id.endsWith('back-waistband')) return 2
  if (p.id.endsWith('back-pocket')) return 3
  if (p.id.includes('pocket')) return 4
  if (p.id.includes('fly')) return 5
  if (p.id.startsWith('belt-loop')) return 6
  return 7
}
const pieces = [...project.pieces].sort((a,b)=>priority(a)-priority(b))
const widthCm = 182
const gapCm = 8
let cursorX=5, cursorY=6, rowHeight=0
const positioned = []
for (const p of pieces) {
  const sample = samplePieceBoundary(p,12).points
  const minX=Math.min(...sample.map(q=>q.x)), maxX=Math.max(...sample.map(q=>q.x))
  const minY=Math.min(...sample.map(q=>q.y)), maxY=Math.max(...sample.map(q=>q.y))
  const w=maxX-minX,h=maxY-minY
  if(cursorX + w + 6 > widthCm){cursorY+=rowHeight+gapCm;cursorX=5;rowHeight=0}
  const translated = sample.map(q => ({ x: q.x-minX+cursorX, y:q.y-minY+cursorY }))
  positioned.push({piece:p,points:translated,x:cursorX,y:cursorY,w,h})
  cursorX+=w+gapCm
  rowHeight=Math.max(rowHeight,h)
}
const heightCm=cursorY+rowHeight+6
const dxf=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70','4','9','$MEASUREMENT','70','1','0','ENDSEC','0','SECTION','2','ENTITIES']
for(const entry of positioned){
 const layer=entry.piece.id.replace(/[^a-z0-9_-]/gi,'_').toUpperCase()
 dxf.push('0','POLYLINE','8',layer,'66','1','70','1')
 for(const p of entry.points) dxf.push('0','VERTEX','8',layer,
   '10',(p.x*10).toFixed(3),'20',(p.y*10).toFixed(3),'30','0')
 dxf.push('0','SEQEND','8',layer)
}
dxf.push('0','ENDSEC','0','EOF')
const dxfString=dxf.join('\n')
const parsed=parseDxfPatterns(dxfString)
if(parsed.pieces.length !== pieces.length) throw new Error(`Incomplete DXF: ${parsed.pieces.length}/${pieces.length}`)
const seamQA=[]
for(const seam of project.seams){
 const a=project.pieces.find(p=>p.id===seam.a.pieceId)
 const b=project.pieces.find(p=>p.id===seam.b.pieceId)
 const lenA=edgeLength(a,seam.a.edgeIndex),lenB=edgeLength(b,seam.b.edgeIndex)
 seamQA.push({id:seam.id,a:lenA,b:lenB,mismatchPct:+(100*Math.abs(lenA-lenB)/Math.max(lenA,lenB)).toFixed(2)})
}
const failed=seamQA.filter(s=>s.mismatchPct>6)
const pxCm=5
const canvasW=Math.round((widthCm+4)*pxCm), canvasH=Math.round((heightCm+4)*pxCm)
const svgParts=[]
for (const e of positioned) {
 const fill=e.piece.fabricId==='pocket'?'#e6dec7':e.piece.active3d?'#e6ebf2':'#fafbfc'
 const poly=e.points.map(p=>`${(p.x*pxCm).toFixed(2)},${((heightCm-p.y)*pxCm).toFixed(2)}`).join(' ')
 const anchorX=(e.x)*pxCm,anchorY=(heightCm-e.y-e.h)*pxCm
 svgParts.push(`<polygon points="${poly}" fill="${fill}" stroke="#1e3046" stroke-width="1.1"/>`)
 svgParts.push(`<text x="${(anchorX+2).toFixed(1)}" y="${(anchorY-7).toFixed(1)}" font-size="8.8" font-family="Arial" fill="#344864">${e.piece.name.replaceAll('&','&amp;')}</text>`)
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"><rect width="100%" height="100%" fill="#f6f7f8"/><g transform="translate(0,4)">${svgParts.join('')}</g></svg>`
const basename='501_Original_Straight_CLO_Compact_V3'
await Promise.all([
 writeFile(path.join(dest,basename+'.dxf'),dxfString),
 writeFile(path.join(dest,basename+'.svg'),svg),
 writeFile(path.join(dest,basename+'_GarmentStudio.json'),JSON.stringify(project,null,2)),
 writeFile(path.join(dest,'501_Compact_V3_Validation.json'),JSON.stringify({
  pieces:pieces.length, seams:project.seams.length, dxfImported:parsed.pieces.length,
  dxfxMmWidth:widthCm*10,dxfxMmHeight:+(heightCm*10).toFixed(2),
  seamMismatchOver6Pct:failed, layouts:positioned.map(e=>({name:e.piece.name,x:e.x,y:e.y,width:e.w,height:e.h})),
  independentPattern: true, nativeCloSewingComplete:false,
 },null,2))
])
console.log(JSON.stringify({status:failed.length?'SEAMS_NEED_FITTING':'PASS',output:dest,
  pieces:pieces.length, sewingConnections:project.seams.length,
  badSeams:failed.length,compactLayoutCm:[widthCm,+heightCm.toFixed(1)],
  created:[basename+'.dxf',basename+'.svg',basename+'_GarmentStudio.json','501_Compact_V3_Validation.json']},null,2))
