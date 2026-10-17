import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { simplifiedClothBoundary, measureClothBoundaryDeviation } from '../src/core/clothMeshing.js'

const cli=process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
function native(op,args) {
  const child=spawnSync(cli,{input:JSON.stringify({
    protocol:'garment-studio.native-cad.v1',document:{pieces:[],seams:[]},op,args,
  })+'\n',encoding:'utf8'})
  if(child.error)throw child.error
  assert.equal(child.status,0,child.stderr)
  const result=JSON.parse(child.stdout.trim())
  assert.equal(result.ok,true,result.error)
  return result
}
const ellipse=(n,wiggle=0)=>Array.from({length:n},(_,i)=>{
  const theta=2*Math.PI*i/n
  return {x:10*Math.cos(theta)+wiggle*Math.sin(theta*13),
    y:7*Math.sin(theta)+wiggle*Math.cos(theta*11),pointId:'v'+i}
})
const samples=[
  [],[{x:0,y:0}],ellipse(16),ellipse(80),ellipse(128,.01),ellipse(256,.15),
]
let checked=0
for(const source of samples) {
  const before=structuredClone(source)
  for(const toleranceCm of [0,.015,.08,.2]) {
    const js=simplifiedClothBoundary(source,toleranceCm)
    const cpp=native('cloth-simplify-boundary',{source,toleranceCm}).boundary
    assert.deepEqual(cpp,js)
    const jsError=measureClothBoundaryDeviation(source,js)
    const cppError=native('cloth-boundary-deviation',{source,simplified:cpp}).deviationCm
    if(Number.isFinite(jsError))assert.ok(Math.abs(jsError-cppError)<1e-8,
      `Boundary deviation native ${cppError} differs JS ${jsError}`)
    assert.deepEqual(source,before,'authored pattern must not change')
    checked++
  }
}
console.log(`C++ adaptive cloth meshing JS parity passed: ${checked} contour/tolerance cases, metadata and source preserved`)
