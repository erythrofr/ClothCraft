import assert from 'node:assert/strict'
import {FABRIC_PRESETS} from '../src/data/defaultProject.js'
import {describeTextileSurface,meshYarnCoverage,makeProceduralTextileMaps} from '../src/core/textileProcedurals.js'
const presets=Object.values(FABRIC_PRESETS)
assert.equal(presets.length,400)
const averages={}
// Prime sample dimension avoids synchronizing with 12- and 14-cell textile
// lattices. A 96x96 integration grid aliases tulle diagonals at one phase.
const sampleSize=97
for(const id of ['polyMesh','powerMesh','polyTulle']) {
 const spec=describeTextileSurface(FABRIC_PRESETS[id])
 assert.equal(spec.family,'mesh')
 let coverage=0
 for(let y=0;y<sampleSize;y++)for(let x=0;x<sampleSize;x++){
  const u=(x+.5)/sampleSize,v=(y+.5)/sampleSize
  const alpha=meshYarnCoverage(spec.meshTopology,u,v)
  assert.ok(Number.isFinite(alpha)&&alpha>=0&&alpha<=1)
  coverage+=alpha
  assert.ok(Math.abs(alpha-meshYarnCoverage(spec.meshTopology,u+1,v))<1e-10)
  assert.ok(Math.abs(alpha-meshYarnCoverage(spec.meshTopology,u,v-1))<1e-10)
 }
 averages[id]=coverage/(sampleSize*sampleSize)
}
assert.ok(averages.polyMesh>.7 && averages.polyMesh<1,
 'Sports ventilation should be more closed than sheer tulle')
assert.ok(averages.powerMesh>.25 && averages.powerMesh<.7,
 'Compression mesh should use reinforced diagonal strands')
assert.ok(averages.polyTulle>.08 && averages.polyTulle<.4,
 'Tulle should have a high open-area fraction')
assert.ok(averages.polyTulle<averages.powerMesh&&averages.powerMesh<averages.polyMesh)

const originalDocument=globalThis.document
globalThis.document={
 createElement(kind){
  assert.equal(kind,'canvas')
  const image={width:0,height:0}
  const ctx={
   createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),
   putImageData(pixels){image.pixels=pixels.data},
  }
  image.getContext=()=>ctx
  return image
 },
}
const uncovered=presets.filter(item=>!item.texture?.scanAssetId)
assert.equal(uncovered.length,15)
const generated=[]
for(const fabric of uncovered){
 const maps=makeProceduralTextileMaps(fabric)
 assert.ok(maps?.normalMap&&maps?.colorMap&&maps?.roughnessMap,
  `Missing truthful procedural backup for ${fabric.id}`)
 assert.ok(maps.normalMap.image.pixels.some((px,index)=>index%4===0 && px!==128),
  `Normal map must not be uniformly flat: ${fabric.id}`)
 const spec=describeTextileSurface(fabric)
 if(spec.family==='mesh'){
  const alpha=maps.alphaMap?.image?.pixels
  assert.ok(alpha&&alpha.length===256*256*4,`Missing open fabric cutout ${fabric.id}`)
  let opaque=0,open=0
  for(let i=0;i<alpha.length;i+=4){
   if(alpha[i]>=240)opaque++
   if(alpha[i]<=15)open++
  }
  assert.ok(opaque>100&&open>100,`Fabric apertures must include threads and holes ${fabric.id}`)
 } else assert.equal(maps.alphaMap,null,`Nonmesh must not invent holes ${fabric.id}`)
 maps.colorMap.dispose();maps.normalMap.dispose();maps.roughnessMap.dispose();maps.alphaMap?.dispose()
 generated.push({id:fabric.id,family:spec.family,topology:spec.meshTopology})
}
globalThis.document=originalDocument
console.log(JSON.stringify({ok:true,total:400,proceduralBackupsChecked:uncovered.length,
  meshAreaCoverage:averages,openMaskTopologyChecked:true,
  physicsHolesClaimed:false,generated}))
