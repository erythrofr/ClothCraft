import assert from 'node:assert/strict'
import { curveChordCoordinates, preciseCurveEdit, precisePointEdit, quadraticArcLength,
  quadraticAtLengthFraction, quadraticAt } from '../src/core/draftingPrecision.js'
import { edgeLength, edgePointAt, seamLengthReport, cloneProject } from '../src/core/project.js'

const close = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected} ± ${tolerance}, got ${actual}`)

const base = { id:'front', seamAllowance:1, points:[
  {x:0,y:0,id:'p0'}, {x:10,y:0,id:'p1'}, {x:10,y:20,id:'p2'}, {x:0,y:20,id:'p3'},
], curves:{} }

const a=base.points[0], b=base.points[1]
close(edgeLength(base,0),10)
const straight = preciseCurveEdit(base,0,{mode:'chord',alongCm:0,depthCm:0})
close(straight.cx,5); close(straight.cy,0)
base.curves[0]=straight
close(edgeLength(base,0),10)

const raised=preciseCurveEdit(base,0,{mode:'chord',alongCm:'2.5',depthCm:'6'})
close(raised.cx,7.5);close(raised.cy,6)
assert.deepEqual(curveChordCoordinates(a,{x:raised.cx,y:raised.cy},b),{alongCm:2.5,depthCm:6})
const reconstructed=preciseCurveEdit(base,0,{mode:'absolute',cx:String(raised.cx),cy:String(raised.cy)})
assert.deepEqual(reconstructed,raised)
base.curves[0]=raised

// 10,000-chord independent numerical length approximates the exact integral.
const samples=10000
let previous=a,numericLength=0
for(let i=1;i<=samples;i++){
  const next=quadraticAt(a,{x:raised.cx,y:raised.cy},b,i/samples)
  numericLength+=Math.hypot(next.x-previous.x,next.y-previous.y)
  previous=next
}
close(edgeLength(base,0),numericLength,3e-6)
close(quadraticArcLength(a,{x:raised.cx,y:raised.cy},b,0,.5) +
  quadraticArcLength(a,{x:raised.cx,y:raised.cy},b,.5,1),edgeLength(base,0),1e-8)
const halfway=quadraticAtLengthFraction(a,{x:raised.cx,y:raised.cy},b,.5)
close(quadraticArcLength(a,{x:raised.cx,y:raised.cy},b,0,halfway.parameter),edgeLength(base,0)/2,5e-7)
close(edgePointAt(base,0,.5).point.x,halfway.point.x,1e-7)

const other=cloneProject(base);other.id='back';other.curves[0]={...raised}
const garment={pieces:[base,other]}
const sewing={id:'test-seam',a:{pieceId:'front',edgeIndex:0},b:{pieceId:'back',edgeIndex:0}}
close(seamLengthReport(garment,sewing).difference,0,1e-10)
other.curves[0]=preciseCurveEdit(other,0,{mode:'chord',alongCm:0,depthCm:3})
assert.ok(seamLengthReport(garment,sewing).difference>0.1,'Seam walk must react to numeric control changes')

const old=cloneProject(base)
const next=precisePointEdit(base,1,{mode:'polar',lengthCm:12,angleDeg:0})
close(next.x,12);close(next.y,0);assert.equal(next.id,'p1')
assert.deepEqual(old,base,'Numeric editing must return new points rather than mutate authored source')
assert.throws(()=>precisePointEdit(base,1,{mode:'absolute',x:0,y:0}),/Adjacent/)
assert.throws(()=>preciseCurveEdit(base,0,{mode:'absolute',cx:'',cy:'3'}),/finite/)
assert.throws(()=>preciseCurveEdit(base,0,{mode:'chord',alongCm:Infinity,depthCm:1}),/finite/)
assert.throws(()=>preciseCurveEdit({...base,locked:true},0,{mode:'absolute',cx:1,cy:2}),/Unlock/)
assert.throws(()=>preciseCurveEdit(base,100,{mode:'absolute',cx:1,cy:2}),/Invalid/)

console.log('Precision drafting: analytic curve length, seam report, inverse chord controls, point and invalid-input tests PASS')
