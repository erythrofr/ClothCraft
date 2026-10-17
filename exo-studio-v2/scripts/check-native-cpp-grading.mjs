import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createDefaultProject } from '../src/data/defaultProject.js'
import { createTeeTemplate, createZipHoodieTemplate } from '../src/data/templates.js'
import { gradeProject, buildSizeRun } from '../src/core/grading.js'
import { edgeLength, samplePieceBoundary, seamAllowanceBoundary } from '../src/core/project.js'
import { parseDxfPatterns } from '../src/core/dxf.js'

const bin = process.env.GARMENT_CPP_CLI || 'native_cpp/build-cmake/garment_cad_cli'
let comparedPoints = 0
let comparedCurves = 0
let comparedSeams = 0

function request(document, op, args = {}) {
  const call = spawnSync(bin, {
    encoding: 'utf8',
    input: JSON.stringify({ protocol: 'garment-studio.native-cad.v1', document, op, args }) + '\n',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30000,
  })
  if (call.error) throw call.error
  assert.equal(call.status, 0, call.stderr)
  return JSON.parse(call.stdout.trim())
}

function near(a, b, context) {
  assert.ok(Number.isFinite(a) && Number.isFinite(b), `nonfinite ${context}`)
  assert.ok(Math.abs(a - b) <= 0.0001, `${context}: JS=${a}, native=${b}`)
}

function compare(source, js, native, size) {
  assert.equal(native.previewSize, size)
  assert.deepEqual(native.pieces.map(p => p.id), js.pieces.map(p => p.id))
  assert.deepEqual(native.seams, source.seams, 'all sewing relationships survive grading')
  assert.deepEqual(native.fabrics, source.fabrics, 'fabric definitions remain untouched')
  assert.equal(native.revision, source.revision, 'preview grading is read-only')
  assert.equal(native.version, source.version, 'project version preserved')
  for (let i = 0; i < js.pieces.length; i += 1) {
    const a = js.pieces[i], b = native.pieces[i]
    assert.equal(b.points.length, a.points.length)
    assert.equal(b.gradeSize, a.gradeSize)
    for (let p = 0; p < a.points.length; p += 1) {
      near(a.points[p].x, b.points[p].x, `${size}:${a.id}:point${p}:x`)
      near(a.points[p].y, b.points[p].y, `${size}:${a.id}:point${p}:y`)
      for (const key of Object.keys(source.pieces[i].points[p]).filter(k => k !== 'x' && k !== 'y')) {
        assert.deepEqual(b.points[p][key], source.pieces[i].points[p][key])
      }
      comparedPoints += 1
    }
    for (const [edge, control] of Object.entries(a.curves || {})) {
      near(control.cx, b.curves[edge].cx, `${size}:${a.id}:curve${edge}:cx`)
      near(control.cy, b.curves[edge].cy, `${size}:${a.id}:curve${edge}:cy`)
      comparedCurves += 1
    }
    for (let l = 0; l < (a.internalLines || []).length; l += 1) {
      for (const end of ['a', 'b']) {
        near(a.internalLines[l][end].x, b.internalLines[l][end].x, `${size}:${a.id}:line${l}:${end}:x`)
        near(a.internalLines[l][end].y, b.internalLines[l][end].y, `${size}:${a.id}:line${l}:${end}:y`)
      }
    }
    for (let edge = 0; edge < a.points.length; edge += 1) {
      near(edgeLength(a, edge), edgeLength(b, edge), `${size}:${a.id}:length${edge}`)
    }
  }
  for (const seam of js.seams || []) {
    const a = js.pieces.find(p => p.id === seam.a.pieceId)
    const b = js.pieces.find(p => p.id === seam.b.pieceId)
    const an = native.pieces.find(p => p.id === seam.a.pieceId)
    const bn = native.pieces.find(p => p.id === seam.b.pieceId)
    near(edgeLength(a, seam.a.edgeIndex), edgeLength(an, seam.a.edgeIndex), `${size}:seam:${seam.id}:a`)
    near(edgeLength(b, seam.b.edgeIndex), edgeLength(bn, seam.b.edgeIndex), `${size}:seam:${seam.id}:b`)
    comparedSeams += 1
  }
  for (let i = 0; i < (js.customMeasurements || []).length; i += 1) {
    for (const end of ['a', 'b']) {
      if (!js.customMeasurements[i][end]) continue
      near(js.customMeasurements[i][end].x, native.customMeasurements[i][end].x, `${size}:measurement${i}:${end}:x`)
      near(js.customMeasurements[i][end].y, native.customMeasurements[i][end].y, `${size}:measurement${i}:${end}:y`)
    }
  }
}

const projects = [createDefaultProject(), createTeeTemplate(), createZipHoodieTemplate()]
// Explicit designer rule, an annotated interior line and independent graded
// measurements exercise the general path, distinct from seam-locked tee.
const custom = structuredClone(projects[0])
custom.productionSpec = { gradingModel: 'designer-point-rules' }
custom.pieces[0].points[0].gradeRule = { enabled: true, dxPerSize: 1.25, dyPerSize: -2.5 }
custom.pieces[0].internalLines = [{ id: 'test-interior', a: { x: -4, y: 12 }, b: { x: 4, y: 20 }, label: 'preserve' }]
custom.customMeasurements = [{ id: 'chestline', pieceId: custom.pieces[0].id, a: { x: -12, y: 22 }, b: { x: 12, y: 22 } }]
projects.push(custom)

for (const project of projects) {
  const source = structuredClone(project)
  const base = project.grading?.baseSize || 'M'
  const sizes = project.grading?.sizes?.length ? project.grading.sizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  for (const size of sizes) {
    const response = request(project, 'grade-size', { size })
    assert.equal(response.ok, true, `native ${project.name} ${size} failed: ${response.error}`)
    compare(project, gradeProject(project, size), response.document, size)
  }
  const all = request(project, 'grade-run')
  assert.equal(all.ok, true, `native size run failed: ${all.error}`)
  assert.deepEqual(Object.keys(all.sizes).sort(), sizes.slice().sort())
  const jsRun = buildSizeRun(project)
  for (const size of sizes) compare(project, jsRun[size], all.sizes[size], size)
  assert.deepEqual(project, source, 'native and JS previews must never edit the source')
  assert.equal(request(project, 'grade-size', { size: 'NOT-A-SIZE' }).ok, false)
  assert.equal(request(project, 'document').document.revision, source.revision)
  assert.ok(sizes.includes(base))
}

// One complete native graded DXF run, parsed through the existing JS importer.
// The manufacturing output is intentionally stitchline-only for now.
const productionSource=projects[0]
const nativeDxfRun=request(productionSource,'export-dxf-run',{samplesPerCurve:24})
assert.equal(nativeDxfRun.ok,true,nativeDxfRun.error)
const sizeKeys=productionSource.grading.sizes
assert.deepEqual(Object.keys(nativeDxfRun.dxfBySize).sort(),sizeKeys.slice().sort())
const contourBounds={}
for (const size of sizeKeys) {
  const dxf=nativeDxfRun.dxfBySize[size]
  assert.ok(dxf.includes('$INSUNITS\n70\n4\n'),`${size} DXF must declare mm`)
  const parsed=parseDxfPatterns(dxf)
  assert.equal(parsed.pieces.length,productionSource.pieces.length,`${size} all cut outlines`) 
  const front=parsed.pieces.find(piece=>piece.name.toUpperCase()==='FRONT') || parsed.pieces[0]
  const original=gradeProject(productionSource,size).pieces[0]
  const actualContour=samplePieceBoundary(original,24).points
  const minX=Math.min(...actualContour.map(p=>p.x))
  const maxX=Math.max(...actualContour.map(p=>p.x))
  const foundMinX=Math.min(...front.points.map(p=>p.x))
  const foundMaxX=Math.max(...front.points.map(p=>p.x))
  near(maxX-minX,foundMaxX-foundMinX,`${size}:graded DXF actual width`)
  contourBounds[size]=foundMaxX-foundMinX
}
assert.ok(contourBounds.XXL>contourBounds.XS,'graded DXF size run must vary physical geometry')
const isolatedDxf=request(productionSource,'export-dxf',{size:'L'})
assert.equal(isolatedDxf.ok,true,isolatedDxf.error)
assert.equal(isolatedDxf.dxf,nativeDxfRun.dxfBySize.L)
assert.equal(request(productionSource,'export-dxf',{size:'BAD'}).ok,false)

// Verify the *cut* contour, not merely the stitchline, against the existing
// JS per-edge allowance algorithm at equivalent quadratic sampling density.
let cutSamples=0
for (const source of [productionSource, projects[2]]) {
  for (const size of ['XS','M','XL']) {
    const graded=gradeProject(source,size)
    const output=request(source,'export-dxf',{size,withSeamAllowances:true,samplesPerCurve:24})
    assert.equal(output.ok,true,output.error)
    assert.equal(output.includesSeamAllowances,true)
    const parsed=parseDxfPatterns(output.dxf)
    assert.equal(parsed.pieces.length,graded.pieces.length)
    for (let i=0;i<graded.pieces.length;i += 1) {
      const jsOutline=seamAllowanceBoundary(graded.pieces[i],24)
      const nativeOutline=parsed.pieces[i].points
      assert.equal(nativeOutline.length,jsOutline.length,`${size}:${graded.pieces[i].id}:contour sample count`)
      const a=jsOutline[0], b=nativeOutline[0]
      for (let j=0;j<jsOutline.length;j += 1) {
        near(nativeOutline[j].x-b.x,jsOutline[j].x-a.x,`${size}:${graded.pieces[i].id}:cut ${j} dx`)
        near(nativeOutline[j].y-b.y,jsOutline[j].y-a.y,`${size}:${graded.pieces[i].id}:cut ${j} dy`)
        cutSamples += 1
      }
    }
  }
}
assert.ok(cutSamples>250,'cut contour comparison must cover many sampled curve points')

const sizeClothCraft=request(productionSource,'clothcraft-export',{size:'L'})
assert.equal(sizeClothCraft.ok,true,sizeClothCraft.error)
assert.equal(sizeClothCraft.size,'L')
assert.ok(sizeClothCraft.interchange)

const unsafe = structuredClone(projects[0])
unsafe.grading.widthPerSizeCm = 99999
assert.equal(request(unsafe, 'grade-size', { size: 'XXL' }).ok, false,
  'overlarge grade values must fail rather than produce invalid CAD')
const duplicate = structuredClone(projects[0])
duplicate.grading.sizes = ['M', 'M']
assert.equal(request(duplicate, 'grade-run').ok, false, 'duplicated size labels must be rejected')

console.log(JSON.stringify({ pass: true, implementation: 'native C++17',
  projectsCompared: projects.length, eachSizeComparedTwice: true,
  pointCoordinatesCompared: comparedPoints, curveControlsCompared: comparedCurves,
  seamPairsCompared: comparedSeams, exactCutOutlineSamplesCompared:cutSamples,
  invalidSizeAndGeometryRejected: true }))
