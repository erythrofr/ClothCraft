import assert from 'node:assert/strict'
import {createFabricBallGeometry,FABRIC_BALL_SWATCH_CM,fabricBallGeometryDiagnostics} from '../src/core/fabricBallGeometry.js'
import {fabricSwatchMapRepeats,fabricSwatchRepeatDimensions,fabricProceduralSwatchRepeats} from '../src/core/fabricPbrAppearance.js'

assert.deepEqual(fabricSwatchMapRepeats({repeatWidthCm:20,repeatHeightCm:9},270),[13.5,30])
assert.deepEqual(fabricSwatchMapRepeats({},270),[13.5,13.5])
for(const invalid of [undefined,null,'',0,-10,'oops',Infinity,NaN]){
 const dims=fabricSwatchRepeatDimensions({repeatWidthCm:invalid,repeatHeightCm:invalid})
 assert.deepEqual(dims,{repeatWidthCm:20,repeatHeightCm:20})
 assert.deepEqual(fabricSwatchMapRepeats(dims),[13.5,13.5])
}
assert.deepEqual(fabricSwatchRepeatDimensions({repeatWidthCm:.1,repeatHeightCm:9}),{repeatWidthCm:.5,repeatHeightCm:9})
// One 3 cm procedural yarn tile retains 90 repetitions regardless of the
// photographic scan's 9 x 20 cm authored repeat rectangle.
for(const scan of [{repeatWidthCm:9,repeatHeightCm:20},{repeatWidthCm:-1,repeatHeightCm:NaN},{}, {repeatWidthCm:.1,repeatHeightCm:40}]){
 const dims=fabricSwatchRepeatDimensions(scan)
 const [rx,ry]=fabricSwatchMapRepeats(dims)
 const proceduralSource=[dims.repeatWidthCm/3,dims.repeatHeightCm/3]
 const combined=proceduralSource.map((n,i)=>n*[rx,ry][i])
 assert.ok(combined.every(n=>Math.abs(n-90)<1e-9))
 assert.deepEqual(fabricProceduralSwatchRepeats(3),[90,90])
}
const samples=[{name:'denim',bend:1.45,gsm:420},{name:'silk',bend:.18,gsm:70}]
for(const sample of samples){
 const mesh=createFabricBallGeometry(sample,{segments:42,rings:42})
 const d=fabricBallGeometryDiagnostics(mesh)
 assert.equal(mesh.userData.sourceLengthCm,FABRIC_BALL_SWATCH_CM)
 assert.equal(d.triangles,42*42*2)
 assert.equal(d.invalidTriangles,0)
 assert.ok(Number.isFinite(d.totalAreaRatio)&&d.totalAreaRatio>0)
 assert.ok(d.minAreaRatio>0)
 assert.equal(d.illustrativeOnly,true)
 console.log(`${sample.name}: triangles=${d.triangles}, area ratio=${d.totalAreaRatio.toFixed(3)}, triangle range=${d.minAreaRatio.toFixed(3)}..${d.maxAreaRatio.toFixed(3)}`)
 mesh.dispose()
}
console.log('PASS fabric swatch dimensions, map repeat calibration, geometry diagnostics')
