import {createTeeTemplate} from '../src/data/templates.js'
import {buildSimulation,stepSimulation,getAvatarUpperBodyDimensions} from '../src/core/physics.js'
for(const heightCm of [160,180,200]) for(const [mode,threshold] of [['baseline',-1],['allTorso',0],['upperTorso',.75],['shoulderOnly',.90]]) {
 const p=createTeeTemplate();p.avatar.heightCm=heightCm;const s=buildSimulation(p)
 const heightScale=heightCm/180
 const sideCount={count:0}
 if(threshold>=0) for(const piece of s.pieces.values()) for(const particle of piece.particles) {
   if(!['front','back'].includes(particle.wrapMode)||particle.patternV < threshold)continue
   particle.constructionSideZ=particle.wrapMode==='front'?1:-1;sideCount.count++
 }
 let maxPeak=0
 for(let f=0;f<120;f++){stepSimulation(s,p,1/60); maxPeak=Math.max(maxPeak,s.strain.max)}
 const seam=s.seamConstraints.reduce((sum,c)=>sum+c.a.position.distanceTo(c.b.position),0)/s.seamConstraints.length
 const shoulderParticles=[...s.pieces.values()].flatMap(piece=>piece.particles).filter(q=>['front','back'].includes(q.wrapMode)&&q.patternV>.85)
 const shoulder=getAvatarUpperBodyDimensions(p.avatar);const distance=shoulderParticles.reduce((sum,q)=>sum+Math.abs(q.position.y-(shoulder.shoulderCenterY + shoulder.shoulderCapRadiusY*.5)),0)/shoulderParticles.length
 console.log(JSON.stringify({heightCm,mode,n:sideCount.count,avgStrain:+s.strain.average.toFixed(3),peak:+s.strain.max.toFixed(3),maxPeak:+maxPeak.toFixed(3),gap:+seam.toFixed(4),shoulderElevationError:+distance.toFixed(3)}))
}
