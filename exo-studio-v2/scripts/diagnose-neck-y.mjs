import {createTeeTemplate} from '../src/data/templates.js'
import {buildSimulation,stepSimulation} from '../src/core/physics.js'
for(const heightCm of [160,200])for(const [name,modify] of Object.entries({
 yOnly:()=>{},yWeak:s=>s.anchorConstraints.forEach(c=>c.type==='fit-anchor'&&(c.stiffness=.01)),
 yTiny:s=>s.anchorConstraints.forEach(c=>c.type==='fit-anchor'&&(c.stiffness=.003)),
 xyzWeak:s=>s.anchorConstraints.forEach(c=>c.type==='fit-anchor'&&(delete c.axes,c.stiffness=.01)),
 none:s=>s.anchorConstraints=s.anchorConstraints.filter(c=>c.type!=='fit-anchor'),
 })){const p=createTeeTemplate();p.avatar.heightCm=heightCm;const s=buildSimulation(p);modify(s);for(let i=0;i<120;i++)stepSimulation(s,p,1/60);let gap=0;for(const c of s.seamConstraints)gap+=c.a.position.distanceTo(c.b.position);gap/=Math.max(1,s.seamConstraints.length);console.log(JSON.stringify({heightCm,name,peakRatio:+s.strain.max.toFixed(3),meanRatio:+s.strain.average.toFixed(3),seamGapM:+gap.toFixed(5)}))}
