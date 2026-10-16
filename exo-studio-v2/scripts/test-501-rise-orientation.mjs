import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {buildNativeSimulationPayload} from '../src/core/backends/nativePayload.js'
const base=JSON.parse(fs.readFileSync('blender_bridge/fixtures/jeans-501-fit-optimized.garment.json','utf8'))
const output='native_backend/output/jeans-501-rise-study'
fs.mkdirSync(output,{recursive:true})
const variants=[]
for(const front of [false,true]) for(const back of [false,true]){
 const project=structuredClone(base)
 for(const seam of project.seams){
  if(seam.id==='pants-front-rise') seam.reverseB=front
  if(seam.id==='pants-back-rise') seam.reverseB=back
 }
 const id=`front${+front}_back${+back}`
 const payload=buildNativeSimulationPayload(project)
 const inp=path.resolve(output,`${id}.payload.json`)
 const out=path.resolve(output,`${id}.result.json`)
 fs.writeFileSync(inp,JSON.stringify(payload))
 execFileSync('native_backend/bin/garment_xpbd_cli',[inp,out,'120'],{encoding:'utf8'})
 const stats=JSON.parse(fs.readFileSync(out,'utf8')).stats
 variants.push({id,front,back,finite:stats.finite,strain:stats.structuralStrainAverage,peak:stats.structuralStrainMax,seam:stats.seamAverageDistance,maxSeam:stats.seamMaxDistance})
}
console.log(JSON.stringify(variants,null,2))
