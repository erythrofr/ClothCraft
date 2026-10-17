import assert from 'node:assert/strict'
import { createFabricBallGeometry } from '../src/core/fabricBallGeometry.js'

// Headless numerical fallback when the test machine has exhausted WebGL
// contexts. This checks geometry honestly, not material-rendering correctness.
const supportRadius=.72
const supportY=.23
const sizes=[]
for(const {name,gsm,bend} of [
  {name:'Silk Twill',gsm:95,bend:.42},
  {name:'Rigid Denim',gsm:390,bend:.91},
]){
  const segments=104,rings=104
  const mesh=createFabricBallGeometry({name,gsm,bend},{segments,rings})
  const p=mesh.getAttribute('position')
  const uv=mesh.getAttribute('uv')
  const normals=mesh.getAttribute('normal')
  assert.equal(p.count,(segments+1)*(rings+1))
  assert.equal(mesh.index.count,segments*rings*6)
  assert.equal(uv.count,p.count)
  assert.equal(normals.count,p.count)
  assert.equal(mesh.userData.sourceLengthCm,270)
  let intersects=0,nonfinite=0
  let hem=Infinity
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i)
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))nonfinite++
    if(Math.hypot(x,y-supportY,z)<supportRadius-.002)intersects++
    if(y<hem)hem=y
  }
  assert.equal(nonfinite,0,'Every geometry vertex must be finite')
  assert.equal(intersects,0,'Display ball must never intersect the visual cloth surface')
  const cornerY=p.getY(0)
  const sideY=p.getY(Math.floor(segments/2))
  assert.ok(cornerY<sideY-.08,'Square fabric must hang deeper at its corners than at a side midpoint')
  sizes.push({name,gsm,bend,vertices:p.count,triangles:mesh.index.count/3,hemY:hem,cornerY,sideY,intersections:intersects,nonfinite})
  mesh.dispose()
}
assert.ok(sizes[1].hemY<sizes[0].hemY-.05,'Heavier fabric should hang lower in this documented illustrative model')
console.log(JSON.stringify({pass:true,visualOnly:true,models:sizes},null,2))
