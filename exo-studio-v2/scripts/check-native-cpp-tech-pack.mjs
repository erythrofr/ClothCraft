import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { buildTechPack } from '../src/core/measurements.js'

const cli=process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const protocol='garment-studio.native-cad.v1'
function native(project) {
  const child=spawnSync(cli,[],{input:JSON.stringify({protocol,op:'export-tech-pack',document:project})+'\n',
    encoding:'utf8',maxBuffer:64*1024*1024,timeout:30000})
  if (child.error) throw child.error
  assert.equal(child.status,0,child.stderr)
  const result=JSON.parse(child.stdout.trim())
  assert.equal(result.ok,true,`native failed: ${result.error}`)
  assert.equal(result.factoryCertified,false)
  assert.equal(result.fitAccepted,false)
  return result.techPack
}

const tee=createDefaultProject()
const hoodie=createZipHoodieTemplate()
const priced=structuredClone(hoodie)
priced.fabrics.main.pricePerMeter=22.75
priced.productionSpec={...priced.productionSpec, currency:'EUR'}
priced.customMeasurements=[{id:'hem-check',label:'Custom "Hem"',pieceId:'front',
  a:{x:-10,y:5},b:{x:10,y:9},toleranceCm:0.25}]
const textured=structuredClone(tee)
textured.fabrics.main.texture={name:'cotton.png',normalName:'normal.png',roughnessName:'rough.png',
  repeatWidthCm:17.5,repeatHeightCm:20,rotationDeg:45}
textured.fabrics.main.surfaceFamily='twill'
textured.pieces[0].buttonholes=[{id:'buttonhole-1',x:1,y:2,lengthCm:2.7}]
const compact=structuredClone(tee)
compact.grading={baseSize:'M',sizes:['S','M','L'],widthPerSizeCm:2,lengthPerSizeCm:1}

const cases=[['foundation-tee',tee],['zip-hoodie',hoodie],['priced-custom',priced],
  ['textured-and-trimmed',textured],['three-sizes',compact]]
let sizeReports=0,measurementRows=0,markerRows=0,materialRows=0
for (const [name,project] of cases) {
  const before=structuredClone(project)
  const expected=JSON.parse(JSON.stringify(buildTechPack(project)))
  const actual=native(project)
  try {assert.deepEqual(actual,expected)}
  catch(error) {
    // Print only the first meaningful divergent path and values.
    function diff(a,b,path='root') {
      if (Object.is(a,b)) return null
      if (a && b && typeof a==='object' && typeof b==='object') {
        const keys=new Set([...Object.keys(a),...Object.keys(b)])
        for (const key of keys) { const d=diff(a[key],b[key],`${path}.${key}`);if (d) return d }
        return null
      }
      return {path,actual:a,expected:b}
    }
    throw new Error(`${name}: first mismatch: ${JSON.stringify(diff(actual,expected))}; ${error.message.slice(0,600)}`)
  }
  assert.deepEqual(project,before,`${name}: project mutated`)
  assert.deepEqual(native(project),actual,`${name}: nondeterministic native output`)
  sizeReports+=Object.keys(actual.sizeMeasurements).length
  measurementRows+=Object.values(actual.sizeMeasurements).reduce((n,rows)=>n+rows.length,0)
  markerRows+=Object.values(actual.markers).reduce((n,record)=>n+Object.keys(record.byFabric).length,0)
  materialRows+=actual.materials.length
}
console.log(JSON.stringify({pass:true,implementation:'native C++17 structured tech packs',
  cases:cases.length,sizeReports,measurementRows,markerRows,materialRows,
  fullJsonParity:true,sourcePreserved:true,factoryCertified:false,fitAccepted:false}))
