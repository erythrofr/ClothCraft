import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { homedir } from 'node:os'
import { create501JeansTemplate } from '../src/data/jeans501.js'
import { samplePieceBoundary, pieceArea } from '../src/core/project.js'
import { parseDxfPatterns } from '../src/core/dxf.js'

// CLO standalone Auto Sewing -> Pants may work more reliably with the shell
// cut as 4 primary panels. Yoke seam remains an internal reference until its
// construction is independently sewn after the drape/fit test.
const original = create501JeansTemplate({ waist: 32, inseam: 32 })
const parts = original.pieces.filter(p => /^(left|right)-(front-leg|back-leg)$/.test(p.id))
for (const p of parts) {
  if (p.id.includes('back-leg')) {
    // Upper back height: level with front side seam at outseam, rising gently
    // towards centre back. The upper yoke is integrated for first-drape only.
    p.points = [
      { x: 0, y: 106.4 },
      { x: -2.1, y: 91 },
      ...p.points.slice(2, 10),
      { x: 21.6, y: 111.7 },
    ]
    // Keep the original assembly join as a 2D construction guideline.
    p.internalLines = [{ id: `${p.id}-back-yoke-seam`, type: 'construction',
      a: { x: -1.2, y: 95.6 }, b: { x: 23.35, y: 95.6 } }]
    // remove curves based on cut-off original location where necessary
    p.curves = {
      1: { cx: -3.0, cy: 83 },
      5: { cx: 22.0, cy: 61 },
      6: { cx: 28.54, cy: 77.8 },
      7: { cx: 24.0, cy: 81.4 },
      8: { cx: 24.0, cy: 90.2 },
      10: { cx: 10.0, cy: 110 },
    }
  }
}

const out = process.argv[2] || path.join(homedir(),'Documents','CLO_Automation','501_Original_Jeans_W32L32')
await mkdir(out,{recursive:true})
let lines = ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES']
let offset = 0
function crosses(a,b,c,d){
  const orient=(u,v,w)=>(v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x)
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b)
  return ((o1>1e-6&&o2< -1e-6)||(o1< -1e-6&&o2>1e-6)) &&
         ((o3>1e-6&&o4< -1e-6)||(o3< -1e-6&&o4>1e-6))
}
function validateNoSelfCross(piece, outline){
 for(let i=0;i<outline.length;i++)for(let j=i+2;j<outline.length;j++){
  if(i===0&&j===outline.length-1)continue
  if(crosses(outline[i],outline[(i+1)%outline.length],
      outline[j],outline[(j+1)%outline.length])){
    throw new Error(`Self-intersecting pattern ${piece.id}: edges ${i} and ${j}`)
  }
 }
}
for (const p of parts) {
  const outline = samplePieceBoundary(p, 10).points
  validateNoSelfCross(p,outline)
  const minX = Math.min(...outline.map(x => x.x)); const maxX = Math.max(...outline.map(x=>x.x))
  lines.push('0','POLYLINE','8',p.id.replaceAll('-','_').toUpperCase(),'66','1','70','1')
  for (const q of outline) lines.push('0','VERTEX','8',p.id.replaceAll('-','_').toUpperCase(),
    '10',((q.x-minX+offset)*10).toFixed(3),'20',(q.y*10).toFixed(3),'30','0')
  lines.push('0','SEQEND','8',p.id.replaceAll('-','_').toUpperCase())
  offset += maxX-minX+8
}
lines.push('0','ENDSEC','0','EOF')
const dxf = lines.join('\n')
const imported = parseDxfPatterns(dxf)
if (imported.pieces.length !== 4) throw new Error(`Expected 4 main shell pieces, got ${imported.pieces.length}`)
for (const [i,p] of parts.entries()) if (Math.abs(pieceArea(imported.pieces[i])-pieceArea(p))/pieceArea(p)>0.01) throw new Error(`Bad area: ${p.id}`)
const location = path.join(out,'501_Original_Straight_Body4_V5_CLEAN.dxf')
await writeFile(location,dxf)
await writeFile(path.join(out,'501_Body4_AutoSew_Notes.md'),
  '# 501 Body Four: CLO3D Auto Sewing Fit Prototype\n\n'+
  'Body shell only: left/right front and left/right back. Back yoke integrated in back panels to test fit and auto-sewing. '+
  'Use CLO3D Sewing > Auto Sewing > Garment Type: Pants; do not automatically select skirts. '+
  'Do not expect pockets, waistband, decorative seams, button fly or hardware in this prototype. '+
  'Use the full 24-piece pattern DXF for the construction version.\n')
console.log(JSON.stringify({file:location,parts:imported.pieces.length, widthsCm:parts.map(p=>({part:p.id,area:+pieceArea(p).toFixed(2)}))},null,2))
