import assert from 'node:assert/strict'
import {createFabricBallGeometry,fabricBallGeometryDiagnostics,FABRIC_BALL_SWATCH_CM} from '../src/core/fabricBallGeometry.js'
import {describeTextileSurface} from '../src/core/textileProcedurals.js'
import {normalizeFabricOptics} from '../src/core/fabricSurfaceModel.js'
import {fabricSwatchRepeatDimensions,fabricSwatchMapRepeats,fabricProceduralSwatchRepeats} from '../src/core/fabricPbrAppearance.js'

// Synthetic, reproducible fixtures. No photographs, calibrated mechanical values,
// native solver output, or licensed scan measurements are asserted here.
const fixtures=[
 {id:'denim',name:'Rigid denim twill',surfaceFamily:'twill',gsm:420,bend:1.45,roughness:.88,texture:{repeatWidthCm:18,repeatHeightCm:12},provenance:'procedural'},
 {id:'poplin',name:'Cotton poplin',surfaceFamily:'plain-weave',gsm:120,bend:.8,roughness:.85,texture:{repeatWidthCm:20,repeatHeightCm:20},provenance:'procedural'},
 {id:'jersey',name:'Cotton jersey',surfaceFamily:'jersey-knit',gsm:190,bend:.45,roughness:.9,texture:{repeatWidthCm:12,repeatHeightCm:10},provenance:'procedural'},
 {id:'satin',name:'Silk satin',surfaceFamily:'silk',gsm:85,bend:.18,roughness:.26,sheen:.7,texture:{repeatWidthCm:8,repeatHeightCm:15},provenance:'procedural'},
 {id:'fleece',name:'Wool fleece',surfaceFamily:'fleece-pile',gsm:320,bend:.95,roughness:.95,texture:{repeatWidthCm:20,repeatHeightCm:20},provenance:'procedural'},
 {id:'sheer',name:'Silk chiffon sheer',surfaceFamily:'sheer-weave',gsm:65,bend:.15,opacity:.45,texture:{repeatWidthCm:6,repeatHeightCm:9},provenance:'procedural'},
]
const expected=['twill','plain-weave','jersey-knit','silk','fleece-pile','sheer-weave']
const report=[]
for(const [i,fabric] of fixtures.entries()){
 const geometry=createFabricBallGeometry(fabric,{segments:48,rings:48})
 try{
  const position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv')
  assert.equal(position.count,uv.count)
  assert.equal(position.count,49*49)
  for(let j=0;j<position.count;j++){
   for(const n of [position.getX(j),position.getY(j),position.getZ(j),uv.getX(j),uv.getY(j)])assert.ok(Number.isFinite(n),`${fabric.id}: nonfinite vertex/UV ${j}`)
   assert.ok(uv.getX(j)>=0&&uv.getX(j)<=1&&uv.getY(j)>=0&&uv.getY(j)<=1,`${fabric.id}: UV outside rest sheet`)
  }
  const optics=normalizeFabricOptics(fabric),surface=describeTextileSurface(fabric),area=fabricBallGeometryDiagnostics(geometry)
  assert.equal(surface.family,expected[i])
  assert.equal(geometry.userData.sourceLengthCm,FABRIC_BALL_SWATCH_CM)
  assert.equal(geometry.userData.measuredMaterial,false)
  assert.equal(area.illustrativeOnly,true)
  assert.equal(area.invalidTriangles,0)
  assert.equal(area.triangles,48*48*2)
  for(const n of [area.minAreaRatio,area.maxAreaRatio,area.totalAreaRatio])assert.ok(Number.isFinite(n)&&n>0)
  assert.ok(area.maxAreaRatio>=area.minAreaRatio)
  assert.ok(Number.isFinite(optics.roughness)&&Number.isFinite(optics.opacity))
  const dims=fabricSwatchRepeatDimensions(fabric.texture),scan=fabricSwatchMapRepeats(dims),procedural=fabricProceduralSwatchRepeats(surface.tileCm)
  assert.ok(scan.every(n=>Number.isFinite(n)&&n>0))
  assert.ok(procedural.every(n=>Number.isFinite(n)&&n>0))
  assert.ok(surface.tileCm>0&&Number.isFinite(surface.tileCm))
  assert.ok(Math.abs(procedural[0]-FABRIC_BALL_SWATCH_CM/surface.tileCm)<1e-8)
  assert.equal(fabric.provenance,'procedural')
  report.push({id:fabric.id,family:surface.family,vertices:position.count,triangles:area.triangles,invalidTriangles:area.invalidTriangles,areaRatio:Number(area.totalAreaRatio.toFixed(4)),minTriangleRatio:Number(area.minAreaRatio.toFixed(4)),maxTriangleRatio:Number(area.maxAreaRatio.toFixed(4)),scanRepeats:scan,proceduralRepeats:procedural,opacity:optics.opacity,provenance:fabric.provenance,calibration:'unmeasured illustrative analytic mesh'})
 }finally{geometry.dispose()}
}
assert.equal(report.length,6)
console.log(JSON.stringify({pass:true,fixtureCount:report.length,swatchCm:FABRIC_BALL_SWATCH_CM,checks:['finite vertex coordinates','finite normalized flat-rest UVs','indexed mesh topology','nondegenerate area-ratio diagnostics','expected procedural family','bounded optical descriptor','finite scan/procedural repeats','explicit unmeasured provenance'],results:report},null,2))
