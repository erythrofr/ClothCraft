import {createTeeTemplate} from '../src/data/templates.js'
import {buildSimulation,stepSimulation} from '../src/core/physics.js'
const configs={
  baseline(){},
  removeFront(s){s.anchorConstraints=s.anchorConstraints.filter(c=>c.pieceId!=='front')},
  removeBack(s){s.anchorConstraints=s.anchorConstraints.filter(c=>c.pieceId!=='back')},
  removeBoth(s){s.anchorConstraints=s.anchorConstraints.filter(c=>c.type!=='fit-anchor')},
  targetAtRest(s){for(const c of s.anchorConstraints){if(c.type==='fit-anchor')c.target.copy(c.particle.position)}},
  frontRest(s){for(const c of s.anchorConstraints){if(c.type==='fit-anchor'&&c.pieceId==='front')c.target.copy(c.particle.position)}},
  backRest(s){for(const c of s.anchorConstraints){if(c.type==='fit-anchor'&&c.pieceId==='back')c.target.copy(c.particle.position)}},
  weak(s){for(const c of s.anchorConstraints){if(c.type==='fit-anchor')c.stiffness=0.04}},
  weaker(s){for(const c of s.anchorConstraints){if(c.type==='fit-anchor')c.stiffness=0.01}},
  restWeak(s){for(const c of s.anchorConstraints){if(c.type==='fit-anchor'){c.target.copy(c.particle.position);c.stiffness=0.04}}},
  keepY(s){for(const c of s.anchorConstraints){if(c.type==='fit-anchor'){c.target.x=c.particle.position.x;c.target.z=c.particle.position.z;c.stiffness=0.08}}},
  partialPull(s){for(const c of s.anchorConstraints){if(c.type==='fit-anchor'){c.target.lerp(c.particle.position,0.75)}}},
}
for(const heightCm of [160,200])for(const [name,alter] of Object.entries(configs)){
 const p=createTeeTemplate();p.avatar.heightCm=heightCm;const s=buildSimulation(p);alter(s)
 for(let i=0;i<120;i++)stepSimulation(s,p,1/60)
 const gaps=s.seamConstraints.map(c=>c.a.position.distanceTo(c.b.position));const average=gaps.reduce((a,b)=>a+b,0)/(gaps.length||1)
 console.log(JSON.stringify({heightCm,name,peak:+s.strain.max.toFixed(3),avg:+s.strain.average.toFixed(3),seamGapM:+average.toFixed(5)}))
}
