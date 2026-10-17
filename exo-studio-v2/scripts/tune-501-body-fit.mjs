import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createPantsTemplate } from '../src/data/templates.js'
import { buildNativeSimulationPayload } from '../src/core/backends/nativePayload.js'
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'

const dest = 'native_backend/output/jeans-501-param-search'
fs.mkdirSync(dest, { recursive: true })
const binary = path.resolve('native_backend/bin/garment_xpbd_cli')

function makeProject({top,leg,hem,shift}) {
  const project = createPantsTemplate()
  project.id = '501-straight-fit-search'
  project.name = '501-Style Indigo Denim On-Body Fit'
  project.templateId = 'jeans-501-fit'
  project.fabrics.main = {...FABRIC_PRESETS.denim, id:'main', name:'Rigid Indigo Denim 13.5 oz',
    color:'#263c5e', gsm:458, thickness:0.0029, bend:0.89, stretchWarp:0.012, stretchWeft:0.015}
  for(const p of project.pieces) {
    const isFront = p.id.includes('front')
    const old=p.points
    p.points=old.map((pt,i)=>{
      const blend = Math.max(0,Math.min(1,pt.y/100))
      const midBlend = Math.max(0,1-Math.abs(pt.y-60)/55)
      const scale = hem*(1-blend)+top*blend+midBlend*(leg-(hem*(1-blend)+top*blend))
      const center = isFront?-13.1:-14.4
      const y=pt.y >= 98 ? pt.y*1.07
        : pt.y >= 62 ? (pt.y+shift)*1.07
        : pt.y > 0 ? (pt.y+shift*Math.max(0,pt.y-3)/70)*1.07
        : 0
      return {x:center+(pt.x-center)*scale, y}
    })
    p.simulationResolution=2
    p.seamAllowance=1.2
    if(p.id.includes('back'))p.arrangement3d.y=-0.01
    if(p.id.includes('front'))p.arrangement3d.y=-0.01
  }
  project.avatar.model='theo'
  return project
}

const all=[]
for(const top of [.86,.89,.92,.95]) for(const shift of [4,8,11]) {
  const cfg={top,leg:.955,hem:.945,shift}
  const project=makeProject(cfg)
  const payload=buildNativeSimulationPayload(project)
  const token = `top${String(top).replace('.','')}-shift${shift}`
  const inp=path.resolve(dest,token+'.payload.json')
  const out=path.resolve(dest,token+'.result.json')
  fs.writeFileSync(inp,JSON.stringify(payload))
  try{
    execFileSync(binary,[inp,out,'120'],{timeout:30000,encoding:'utf8'})
    const result=JSON.parse(fs.readFileSync(out,'utf8'))
    const s=result.stats
    const meanGap=s.seamAverageDistance
    const maxGap=s.seamMaxDistance
    const strain=s.structuralStrainAverage
    const peak=s.structuralStrainMax
    const score=strain + 3*meanGap + 1.25*maxGap + .005*peak
    all.push({...cfg,token,score, strain, peak, meanGap, maxGap,finite:s.finite})
  }catch(e){all.push({...cfg,token,error:String(e.message).slice(0,80)})}
}
all.sort((a,b)=>(a.score??1e9)-(b.score??1e9))
fs.writeFileSync(path.resolve(dest,'results.json'),JSON.stringify(all,null,2))
console.log(JSON.stringify(all.map(x=>({
  id:x.token, score:x.score?.toFixed(4), strain:x.strain?.toFixed(4),
  peak:x.peak?.toFixed(2),seamMm:x.meanGap?(x.meanGap*1e3).toFixed(1):'?', maxSeamMm:x.maxGap?(x.maxGap*1e3).toFixed(1):'?'
})),null,2))
if(!all[0]?.error) {
  const best=makeProject(all[0])
  const f='blender_bridge/fixtures/jeans-501-fit-optimized.garment.json'
  fs.writeFileSync(f,JSON.stringify(best,null,2))
  fs.copyFileSync(path.resolve(dest,all[0].token+'.result.json'),'native_backend/output/jeans-501-fit-optimized.native-result.json')
  fs.copyFileSync(path.resolve(dest,all[0].token+'.payload.json'),'native_backend/output/jeans-501-fit-optimized.native-payload.json')
  console.log('BEST',JSON.stringify(all[0]),'PROJECT',f)
}
