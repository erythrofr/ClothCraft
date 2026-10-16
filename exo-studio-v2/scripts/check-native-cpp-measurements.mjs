import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createZipHoodieTemplate } from '../src/data/templates.js'
import { measureProject, buildMeasurementSizeRun, measurementRunToCSV } from '../src/core/measurements.js'

const cli = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
const protocol = 'garment-studio.native-cad.v1'
function native(project, op) {
  const child = spawnSync(cli, [], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    input: JSON.stringify({protocol, op, document: project})+'\n', timeout: 30000,
  })
  if (child.error) throw child.error
  assert.equal(child.status, 0, child.stderr)
  const result=JSON.parse(child.stdout.trim())
  assert.equal(result.ok, true, `${op}: ${result.error}`)
  assert.match(result.scope, /not a/)
  assert.equal(result.units,'cm')
  return result
}

const projects=[]
const tee=createDefaultProject()
const hoodie=createZipHoodieTemplate()
projects.push(['default-tee',tee],['zip-hoodie',hoodie])
const custom=structuredClone(tee)
custom.customMeasurements=[
  {id:'custom-neck',label:'Collar, custom',a:{x:-4.5,y:5.1},b:{x:16.6,y:26.4},toleranceCm:0.25},
  {id:'custom-quote',label:'Custom "Length", test',a:{x:0,y:0},b:{x:3,y:4},toleranceCm:0.05},
]
projects.push(['custom-measurements',custom])

const withoutSleeve=structuredClone(tee)
withoutSleeve.pieces=withoutSleeve.pieces.filter(p=>!p.id.startsWith('sleeve-'))
withoutSleeve.seams=withoutSleeve.seams.filter(s=>!s.a.pieceId.startsWith('sleeve-') && !s.b.pieceId.startsWith('sleeve-'))
projects.push(['sleeveless',withoutSleeve])

const smallRun=structuredClone(tee)
smallRun.grading={baseSize:'M', sizes:['S','M','L'],widthPerSizeCm:3,lengthPerSizeCm:1.2}
projects.push(['three-sizes',smallRun])
let measurements=0, graded=0, csvBytes=0
for (const [name,project] of projects) {
  const before=structuredClone(project)
  const expected=measureProject(project)
  const measured=native(project,'measure-project')
  assert.deepEqual(measured.measurements,expected,`${name}: base POM diverged from JS`)
  measurements+=expected.length
  const expectedSizes=buildMeasurementSizeRun(project)
  const run=native(project,'measure-run')
  assert.deepEqual(run.sizes,expectedSizes,`${name}: size-run POM diverged from JS`)
  graded+=Object.values(expectedSizes).reduce((n,items)=>n+items.length,0)
  const expectedCsv=measurementRunToCSV(project)
  const csv=native(project,'export-pom-csv')
  assert.equal(csv.csv,expectedCsv,`${name}: byte-exact POM CSV divergence`)
  csvBytes+=csv.csv.length
  assert.deepEqual(project,before,`${name}: source mutated`)
  assert.deepEqual(native(project,'measure-project').measurements,measured.measurements,`${name}: nondeterministic`)
}

const invalid=structuredClone(tee)
invalid.customMeasurements=[{id:'bad',a:{x:0,y:0},b:{x:Infinity,y:2}}]
// JSON cannot represent Infinity, native reader sees null and must fail closed.
const proc=spawnSync(cli,[],{input:JSON.stringify({protocol,op:'measure-project',document:invalid})+'\n',encoding:'utf8'})
assert.equal(JSON.parse(proc.stdout).ok,false,'malformed custom measurement must be rejected')

console.log(JSON.stringify({pass:true,native:'C++17 POM',cases:projects.length,measurements,
  gradedMeasurements:graded,csvBytes,byteExactCsv:true,unmodifiedSources:true,fitCertified:false}))
