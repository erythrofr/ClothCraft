import { createTeeTemplate } from '../src/data/templates.js'
import { buildSimulation, stepSimulation } from '../src/core/physics.js'
const heights=process.argv.slice(2).map(Number).filter(Number.isFinite)
for(const heightCm of heights.length?heights:[160,180,200]){
  const project=createTeeTemplate();project.avatar.heightCm=heightCm
  const sim=buildSimulation(project)
  const meta=new Map()
  for(const [pieceId,piece] of sim.pieces.entries())piece.particles.forEach((p,index)=>meta.set(p,{pieceId,index,flat:piece.flatVertices[index],wrap:p.wrapMode,seam:p.seamBoundary,side:p.constructionSideZ}))
  const readWorst=()=>{
    const structural=sim.constraints.filter(c=>c.type==='structural'&&c.rest>1e-7)
    const top=structural.map(c=>({ratio:c.a.position.distanceTo(c.b.position)/c.rest-1,rest:c.rest,d:c.a.position.distanceTo(c.b.position),a:meta.get(c.a),b:meta.get(c.b),pa:c.a.position.toArray(),pb:c.b.position.toArray()})).sort((a,b)=>Math.abs(b.ratio)-Math.abs(a.ratio))
    return top.slice(0,3)
  }
  for(let frame=0;frame<=120;frame++){
    if(frame>0)stepSimulation(sim,project,1/60)
    if([0,1,5,10,30,60,90,120].includes(frame)){
      const best=readWorst()
      const min=Math.min(...[...sim.pieces.values()].flatMap(x=>x.particles).map(x=>x.position.y))
      console.log(JSON.stringify({heightCm,frame,max:sim.strain?.max,avg:sim.strain?.average,minY:min,mostStretched:best},null,frame===120?2:0))
    }
  }
}
