/** Export the actual W32/L32 501-derived 4-panel shell to native XPBD.
 *
 * This is the on-body test garment, not the 24-piece pocket/trim assembly.
 * The cut geometry shares the construction script's eleven-vertex back-yoke-
 * integrated draft. Keep both original CLO ZPRJ and native fixtures intact.
 */
import fs from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { create501JeansTemplate } from '../src/data/jeans501.js'
import { buildNativeSimulationPayload, nativePayloadSummary } from '../src/core/backends/nativePayload.js'
import { edgeLength } from '../src/core/project.js'

const output = process.argv[2] || path.join(homedir(), 'Documents/CLO_Automation/501_Original_Jeans_W32L32/On_Body_Simulation')
fs.mkdirSync(output, { recursive: true })
const project = create501JeansTemplate({ waist:32, inseam:32 })
project.name = '501-Style W32 L32 | On-Body Four-Panel Fitting Shell'
project.id = '501-w32l32-onbody-shell'
project.avatar = {
  ...project.avatar,
  name:'180cm Masculine Fit Dummy',
  model:'makehuman-base',
  heightCm:180, waistCm:78, hipCm:94,
}
project.pieces = project.pieces.filter(p => /^(left|right)-(front-leg|back-leg)$/.test(p.id))
for (const piece of project.pieces) {
  piece.simulationResolution = 2
  piece.topstitches = []
  piece.buttons=[]
  piece.internalLines=[]
  piece.notches=[]
  if (piece.id.includes('back-leg')) {
    // 7 landmark cut points: combine yoke into one fitting panel and use one
    // continuous inner-thigh curve. Precise multiple seam segments in the
    // production block can be restored *after* the body drape is validated.
    piece.points = [
      {x:0,y:106.4}, {x:-3.75,y:73}, {x:-.25,y:0},
      {x:20.79,y:0}, {x:26.75,y:73}, {x:23.8,y:87.3},
      {x:21.6,y:111.7},
    ]
    piece.curves={0:{cx:-2.2,cy:95},1:{cx:-3.7,cy:38},3:{cx:22.3,cy:34},4:{cx:29,cy:80.7},6:{cx:10.4,cy:111.7}}
  } else {
    piece.points=[
      {x:0,y:106.4},{x:-2.5,y:73},{x:.1,y:0},
      {x:19.7,y:0},{x:24.05,y:73},{x:20.25,y:86.5},
      {x:20.3,y:106.4},
    ]
    piece.curves={0:{cx:-2.4,cy:95},1:{cx:-2.5,cy:35},3:{cx:21,cy:36},4:{cx:26.7,cy:79.5}}
  }
  const side=piece.id.startsWith('left-')?-1:1
  const front=piece.id.includes('front-leg')
  piece.arrangement3d={
    x:side*0.15, y:-0.01, z:front?0.14:-0.14,
    wrap:`${side<0?'left':'right'}-leg-${front?'front':'back'}`,
    flip:side>0,
  }
}
const seams=[]
const add=(name,a,ae,b,be,reverseB=false)=>seams.push({id:name,name,type:'normal',a:{pieceId:a,edgeIndex:ae},b:{pieceId:b,edgeIndex:be},reverseB})
for(const side of ['left','right']){
  const f=`${side}-front-leg`,b=`${side}-back-leg`
  for (const edge of [0,1]) add(`${side}-outseam-${edge}`,f,edge,b,edge)
  for (const edge of [3,4]) add(`${side}-inseam-${edge}`,f,edge,b,edge)
}
add('front-center-rise','left-front-leg',5,'right-front-leg',5)
add('back-center-rise','left-back-leg',5,'right-back-leg',5)
project.seams=seams
project.simulation={...project.simulation,
  gravity:9.81, iterations:7, substeps:2,
  collisionMargin:0.012, selfCollision:true, selfCollisionMargin:0.002,
}
for (const seam of project.seams) {
 const a=project.pieces.find(p=>p.id===seam.a.pieceId)
 const b=project.pieces.find(p=>p.id===seam.b.pieceId)
 const ea=edgeLength(a,seam.a.edgeIndex),eb=edgeLength(b,seam.b.edgeIndex)
 if(Math.abs(ea-eb)/Math.max(ea,eb)>.26)throw Error(`Large seam mismatch ${seam.id}: ${ea}/${eb}`)
}
const payload=buildNativeSimulationPayload(project,{quality:'draft',lowerBodySeamRecovery:.9,lowerBodyJunctionRecovery:.9})
const stem='jeans-501-w32l32-onbody-shell-v3'
const pp=path.join(output,stem+'.native-payload.json')
const pj=path.join(output,stem+'.garment.json')
fs.writeFileSync(pp,JSON.stringify(payload,null,2)+'\n')
fs.writeFileSync(pj,JSON.stringify(project,null,2)+'\n')
console.log(JSON.stringify({projectPath:pj,payloadPath:pp,outputDir:output,assemblySeams:seams.length,...nativePayloadSummary(payload)},null,2))
