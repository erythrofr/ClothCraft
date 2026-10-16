import {createTeeTemplate} from '../src/data/templates.js'
import {buildSimulation,stepSimulation,getAvatarUpperBodyDimensions} from '../src/core/physics.js'
const variant=[['baseline',{}],['neck003',{neck:.003}],['shoulder008',{shoulder:.08}],['shoulder02',{shoulder:.02}],['bothLow',{neck:.003,shoulder:.03}],['noFit',{disable:true}],['substeps4',{substeps:4}],['seamSoft',{seamStiffness:.88}]]
for(const heightCm of [180,200]) for(const [name,mode] of variant){
 const p=createTeeTemplate();p.avatar.heightCm=heightCm
 if(mode.substeps)p.simulation.substeps=mode.substeps
 if(mode.seamStiffness)p.simulation.seamStiffness=mode.seamStiffness
 if(mode.disable)p.simulation.autoFitTacks=false
 const s=buildSimulation(p);for(const c of s.anchorConstraints)if(c.type==='fit-anchor'){
   if(c.axes==='y' && mode.neck)c.stiffness=mode.neck
   if(c.axes!=='y' && mode.shoulder)c.stiffness=mode.shoulder
 }
 let max=0;for(let i=0;i<120;i++){stepSimulation(s,p,1/60);max=Math.max(max,s.strain.max)}
 const upper=getAvatarUpperBodyDimensions(p.avatar);const ps=[...s.pieces.values()].flatMap(piece=>piece.particles).filter(q=>['front','back'].includes(q.wrapMode)&&q.patternV>.85)
 const anchorY=upper.shoulderCenterY+upper.shoulderCapRadiusY*.5
 const meanY=ps.reduce((t,q)=>t+q.position.y,0)/ps.length
 const gap=s.seamConstraints.reduce((t,q)=>t+q.a.position.distanceTo(q.b.position),0)/s.seamConstraints.length
 console.log(JSON.stringify({heightCm,name,peak:+s.strain.max.toFixed(3),max:+max.toFixed(3),mean:+s.strain.average.toFixed(3),meanShoulderY:+meanY.toFixed(3),targetY:+anchorY.toFixed(3),gapM:+gap.toFixed(4)}))
}
