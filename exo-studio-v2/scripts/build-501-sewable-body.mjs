import { create501JeansTemplate } from '../src/data/jeans501.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

// An explicit 4-panel sewing prototype for CLO. Use the *original* corner
// vertices, rather than turning each Bezier arc into 10+ microscopic segments.
// Sewing can then select whole straight runs or use CLO Free Sewing across a
// small number of corners; refine curved contours after first successful drape.
const project=create501JeansTemplate()
const order=['left-front-leg','left-back-leg','right-front-leg','right-back-leg']
const panels=order.map(id=>structuredClone(project.pieces.find(p=>p.id===id)))
for(const p of panels){
  if(!p) throw new Error('Missing panel')
  if(p.id.endsWith('back-leg')){
    p.points=[{x:0,y:106.4},{x:-2.1,y:91},...p.points.slice(2,10),{x:21.6,y:111.7}]
  }
}
const rows=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES']
const metadata=[]
let left=6
for(const p of panels){
  const minX=Math.min(...p.points.map(a=>a.x)),maxX=Math.max(...p.points.map(a=>a.x))
  const vertices=p.points.map(v=>({x:v.x-minX+left,y:v.y+3}))
  const layer=p.id.replaceAll('-','_').toUpperCase()
  rows.push('0','POLYLINE','8',layer,'66','1','70','1')
  for(const v of vertices) rows.push('0','VERTEX','8',layer,'10',(v.x*10).toFixed(4),'20',(v.y*10).toFixed(4),'30','0')
  rows.push('0','SEQEND','8',layer)
  metadata.push({id:p.id,offsetCm:left,contour:vertices,segments:vertices.length})
  left+=maxX-minX+9
}
rows.push('0','ENDSEC','0','EOF')
const out=path.join(homedir(),'Documents','CLO_Automation','501_Original_Jeans_W32L32')
await mkdir(out,{recursive:true})
await writeFile(path.join(out,'501_Body4_V6_EASY_SEW.dxf'),rows.join('\n'))
await writeFile(path.join(out,'501_Body4_V6_EASY_SEW.json'),JSON.stringify({order,metadata,notes:'Straight sewing scaffold: 11 front / 11 back contours. CLO sew outseams, inseams, front and back rises; 1:1 fit is not yet achieved.'},null,2))
console.log(JSON.stringify({file:path.join(out,'501_Body4_V6_EASY_SEW.dxf'),panels:panels.length,vertices:metadata.map(d=>d.segments)}))
