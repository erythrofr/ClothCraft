import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { projectToDxf, parseDxfPatterns } from '../src/core/dxf.js'

const cli=process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const original=createDefaultProject()
const hoodie=createZipHoodieTemplate()
const specialized=structuredClone(original)
specialized.pieces[0].grainAngleDeg=21
specialized.pieces[0].notches=[
  {id:'s',edgeIndex:1,t:0.32,depthCm:0.6,type:'single'},
  {id:'d',edgeIndex:6,t:0.61,depthCm:0.5,type:'double'}]
specialized.pieces[0].buttonholes=[{id:'b',x:4,y:18,lengthCm:3.2,orientationDeg:26}]
specialized.pieces[0].internalLines=[
  {id:'f',type:'fold',a:{x:-6,y:10},b:{x:-8,y:35}},
  {id:'d',type:'dart',a:{x:0,y:10},b:{x:1,y:30},widthCm:3},
  {id:'p',type:'pleat',a:{x:4,y:12},b:{x:5,y:30},count:4,spacingCm:3.5}]
const escaped=structuredClone(hoodie)
escaped.pieces[0].name='Front <Left> & Sleeve'
const projects=[original,hoodie,specialized,escaped]
function native(project) {
  const call={protocol:'garment-studio.native-cad.v1',op:'export-construction-dxf',document:project,args:{size:'M'}}
  const child=spawnSync(cli,{input:JSON.stringify(call)+'\n',encoding:'utf8',maxBuffer:32*1024*1024})
  if(child.error) throw child.error
  assert.equal(child.status,0,child.stderr)
  return JSON.parse(child.stdout.trim())
}
function close(a,b,name,tolerance=0.012) {
  assert.ok(Number.isFinite(a)&&Number.isFinite(b),name+': nonfinite')
  assert.ok(Math.abs(a-b)<=tolerance,name+': '+a+' != '+b)
}
function entityCounts(source) {
  const lines=source.split('\n'),counts={}
  for(let i=0;i+1<lines.length;i+=2)
    if(lines[i]==='0') counts[lines[i+1]]=(counts[lines[i+1]]||0)+1
  return counts
}
let points=0,notches=0,internal=0,holes=0
for(let caseIndex=0;caseIndex<projects.length;caseIndex++) {
  const project=projects[caseIndex],backup=structuredClone(project)
  const jsText=projectToDxf(project,'M')
  const response=native(project)
  assert.equal(response.ok,true,'native construction DXF: '+response.error)
  assert.equal(response.factoryCertified,false)
  assert.equal(response.units,'mm')
  assert.ok(response.dxf.includes('$INSUNITS\n70\n4'))
  const types=entityCounts(response.dxf),expectedTypes=entityCounts(jsText)
  for(const type of ['POLYLINE','VERTEX','SEQEND','LINE','TEXT'])
    assert.equal(types[type]||0,expectedTypes[type]||0,'entity type '+type+' in case '+caseIndex)
  const browser=parseDxfPatterns(jsText),compiled=parseDxfPatterns(response.dxf)
  assert.equal(compiled.pieces.length,browser.pieces.length)
  for(let i=0;i<browser.pieces.length;i++) {
    const a=browser.pieces[i],b=compiled.pieces[i]
    assert.equal(a.name,b.name)
    assert.equal(a.points.length,b.points.length)
    for(let j=0;j<a.points.length;j++) {
      close(a.points[j].x,b.points[j].x,'boundary x',0.0002)
      close(a.points[j].y,b.points[j].y,'boundary y',0.0002)
      points++
    }
    for(const key of ['notches','internalLines','buttonholes'])
      assert.equal(a[key]?.length||0,b[key]?.length||0,'missing construction '+key)
    close(a.grainAngleDeg||0,b.grainAngleDeg||0,'grain angle',0.001)
    notches+=a.notches?.length||0
    internal+=a.internalLines?.length||0
    holes+=a.buttonholes?.length||0
    for(let j=0;j<(a.buttonholes?.length||0);j++) {
      close(a.buttonholes[j].x,b.buttonholes[j].x,'buttonhole x')
      close(a.buttonholes[j].y,b.buttonholes[j].y,'buttonhole y')
      close(a.buttonholes[j].lengthCm,b.buttonholes[j].lengthCm,'buttonhole length')
    }
  }
  assert.deepEqual(project,backup,'native export modified source')
  assert.equal(native(project).dxf,response.dxf,'native construction DXF not repeatable')
}
const unsafe=structuredClone(original)
unsafe.id='valid\n0\nLINE'
assert.equal(native(unsafe).ok,false,'DXF group code injection was not rejected')
console.log(JSON.stringify({pass:true,native:'C++17',cases:projects.length,
  verticesCompared:points,notchesCompared:notches,internalLinesCompared:internal,
  buttonholesCompared:holes,matchingEntityCounts:true,
  sourcePreserved:true,deterministic:true,factoryCertified:false}))
