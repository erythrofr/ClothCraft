import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createTeeTemplate } from '../src/data/templates.js'
import { projectToDxf, parseDxfPatterns } from '../src/core/dxf.js'

const binary=process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'

function nativeImport(dxf,args={}) {
  const call=spawnSync(binary,{input:JSON.stringify({protocol:'garment-studio.native-cad.v1',
    op:'import-dxf',args:{dxf,...args}})+'\n',encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024})
  if (call.error) throw call.error
  assert.equal(call.status,0,call.stderr)
  return JSON.parse(call.stdout.trim())
}

let comparedPieces=0,comparedVertices=0,comparedNotches=0,comparedAnnotations=0;
function compare(dxf,label,options={}) {
  const js=parseDxfPatterns(dxf,options)
  const cpp=nativeImport(dxf,options)
  assert.equal(cpp.ok,true,`${label}: ${cpp.error}`)
  assert.equal(cpp.factoryCertified,false)
  const result=cpp.import
  assert.equal(result.pieces.length,js.pieces.length,`${label}: polygon count`)
  assert.ok(Math.abs(result.scaleToCm-js.scaleToCm)<1e-12,`${label}: scale`)
  for(let i=0;i<js.pieces.length;i++) {
    const a=js.pieces[i],b=result.pieces[i]
    assert.equal(b.id,a.id)
    assert.equal(b.name,a.name)
    assert.equal(b.sourceLayer,a.sourceLayer)
    assert.equal(b.points.length,a.points.length,`${label}:points:${i}`)
    for(let j=0;j<a.points.length;j++) {
      assert.ok(Math.abs(b.points[j].x-a.points[j].x)<1e-5,`${label}:${i}:${j}:x`)
      assert.ok(Math.abs(b.points[j].y-a.points[j].y)<1e-5,`${label}:${i}:${j}:y`)
      comparedVertices++
    }
    for(const axis of ['x','y'])
      assert.ok(Math.abs(b.layout2d[axis]-a.layout2d[axis])<1e-6,`${label}:layout:${i}:${axis}`)
    assert.equal(b.fabricId,'main')
    assert.equal(b.notches.length,a.notches.length,`${label}:notches:${i}`)
    for(let j=0;j<a.notches.length;j++) {
      const mark=a.notches[j],native=b.notches[j]
      assert.equal(native.edgeIndex,mark.edgeIndex,`${label}:notch edge ${j}`)
      assert.equal(native.type,mark.type,`${label}:notch type ${j}`)
      assert.ok(Math.abs(native.t-mark.t)<1e-5,`${label}:notch t ${j}`)
      comparedNotches++
    }
    assert.ok(Math.abs(b.grainAngleDeg-a.grainAngleDeg)<1e-5,`${label}:grain:${i}`)
    assert.equal(b.buttonholes.length,a.buttonholes.length,`${label}:buttonholes:${i}`)
    assert.equal(b.internalLines.length,a.internalLines.length,`${label}:internal lines:${i}`)
    for(const attribute of ['buttonholes','internalLines']) {
      for(let j=0;j<a[attribute].length;j++) {
        const x=a[attribute][j],y=b[attribute][j]
        assert.equal(y.type,x.type,`${label}:${attribute}:${j}:type`)
        for(const key of ['lengthCm','orientationDeg','x','y'])
          if (typeof x[key]==='number')
            assert.ok(Math.abs(x[key]-y[key])<1e-5,`${label}:${attribute}:${j}:${key}`)
        for(const key of ['a','b'])
          if (x[key]) for(const dim of ['x','y'])
            assert.ok(Math.abs(x[key][dim]-y[key][dim])<1e-5,`${label}:${attribute}:${j}:${key}:${dim}`)
        comparedAnnotations++
      }
    }
    comparedPieces++
  }
  return result
}

const projects=[createDefaultProject(),createTeeTemplate()]
for (const [index,project] of projects.entries()) {
  compare(projectToDxf(project,'M'),`generated browser DXF ${index}`)
  const reversed=structuredClone(project)
  reversed.pieces.reverse()
  compare(projectToDxf(reversed,'XL'),`reordered browser DXF ${index}`)
}

const annotated=structuredClone(projects[0])
const front=annotated.pieces.find(p=>p.id==='front')
front.buttonholes=[{id:'test-hole',x:7.4,y:28.2,lengthCm:3.2,orientationDeg:26}]
front.internalLines=[{id:'test-fold',type:'fold',a:{x:-6,y:10},b:{x:-8,y:35}}]
front.grainAngleDeg=21
compare(projectToDxf(annotated,'M'),'DXF drafting annotations and grainline')

const lwpoly=['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC',
  '0','SECTION','2','ENTITIES','0','LWPOLYLINE','8','CUT_FRONT_M','90','4','70','1',
  '10','0','20','0','10','420','20','0','10','420','20','750','10','0','20','750',
  '0','ENDSEC','0','EOF'].join('\n')
compare(lwpoly,'closed LWPOLYLINE (millimetres)')
compare(lwpoly,'forced inch factor',{scaleToCm:2.54})

const lineLoop=['0','SECTION','2','HEADER','9','$INSUNITS','70','5','0','ENDSEC',
  '0','SECTION','2','ENTITIES',
  ...[[0,0,15,0],[15,0,15,25],[15,25,0,25],[0,25,0,0]].flatMap(([x1,y1,x2,y2])=>
    ['0','LINE','8','CUT_SIDE_M','10',String(x1),'20',String(y1),'11',String(x2),'21',String(y2)]),
  '0','ENDSEC','0','EOF'].join('\n')
compare(lineLoop,'stitched closed LINE edges')

const realPath='research/clo-reference/live-audit-20261014/exports/clo-male-tshirt-7piece-import.dxf'
if (existsSync(realPath)) {
  const source=readFileSync(realPath,'utf8')
  const imported=compare(source,'normalized CLO male T-shirt')
  assert.equal(imported.pieces.length,7,'verified CLO-derived patterns count')
}

for(const [dxf,label] of [
  ['', 'empty'],
  ['0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF','no geometry'],
  [lwpoly.replace('70\n1','70\n0'),'open polygon'],
]) {
  const result=nativeImport(dxf)
  assert.equal(result.ok,false,`${label}:invalid DXF must not import as valid patterns`)
}

console.log(JSON.stringify({pass:true,implementation:'native C++17',
  outlinesCompared:comparedPieces,coordinatesCompared:comparedVertices,
  notchesCompared:comparedNotches,otherAnnotationsCompared:comparedAnnotations,
  normalizedCloFixture:existsSync(realPath),factoryCertified:false,
  scope:'2D closed pattern geometry and drafting marks; sewing/ASTM metadata remains out of scope'}))
