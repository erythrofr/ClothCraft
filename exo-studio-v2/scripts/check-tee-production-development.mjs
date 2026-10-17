import assert from 'node:assert/strict'
import { createTeeTemplate } from '../src/data/templates.js'
import { gradeProject } from '../src/core/grading.js'
import { edgeLength, getEdgeSeamAllowance, seamLengthReport } from '../src/core/project.js'
import { buildTechPack, measureProject, measurementRunToCSV } from '../src/core/measurements.js'
import { projectToDxf } from '../src/core/dxf.js'

const base = createTeeTemplate()
assert.equal(base.pieces.length, 4, 'Front, back and independent left and right sleeves are required')
assert.equal(base.seams.length, 14)
assert.equal(base.productionSpec?.approvalStatus, 'FIT_SAMPLE_AND_FACTORY_VALIDATION_REQUIRED')
assert.equal(base.productionSpec.gradingModel, 'seam-locked-affine-v1')
assert.ok(base.productionSpec.neckband.requiresSeparateNeckbandCutPattern,
  'Do not treat a proposed neckband width as a complete physically approved rib pattern')

const front = base.pieces.find(piece => piece.id === 'front')
const back = base.pieces.find(piece => piece.id === 'back')
const left = base.pieces.find(piece => piece.id === 'sleeve-left')
const right = base.pieces.find(piece => piece.id === 'sleeve-right')
assert.deepEqual(left.points, right.points, 'Short sleeves must be left-right symmetric in 2D')
assert.ok(Math.abs(front.points[2].x) < Math.abs(front.points[3].x),
  'Armhole should scoop toward the torso, not project outward like an attached sleeve')
assert.equal(back.points[7].x, -front.points[2].x)
assert.ok(edgeLength(front, 10) !== edgeLength(back, 10), 'Front and back neck depths must differ')
assert.equal(getEdgeSeamAllowance(front, 4), 2.5)
assert.equal(getEdgeSeamAllowance(back, 4), 2.5)
assert.equal(getEdgeSeamAllowance(left, 3), 2.5)
assert.equal(getEdgeSeamAllowance(front, 10), .7)
assert.equal(getEdgeSeamAllowance(front, 0), 1)

const notches = base.pieces.flatMap(piece => (piece.notches || []).map(notch => ({ piece, notch })))
assert.ok(notches.length >= 8)
for (const { notch } of notches) {
  assert.ok(notch.matchGroupId && notch.matchedSeamId, 'All tee sleeve alignment marks need matching seam IDs')
  assert.ok(base.seams.some(seam => seam.id === notch.matchedSeamId))
  assert.ok(notches.some(other => other.notch !== notch && other.notch.matchGroupId === notch.matchGroupId),
    'A factory notch cannot be orphaned')
}

const rows=[]
for (const size of base.grading.sizes) {
  const project=gradeProject(base,size)
  const seams=project.seams.map(seam => ({ name: seam.name, ...seamLengthReport(project,seam) }))
  const worst=Math.max(...seams.map(report => report.mismatchPercent))
  assert.ok(worst < .5, `${size} sleeve/torso stitchline mismatch ${worst.toFixed(3)}%`)
  const pom=measureProject(project)
  const reading=id=>pom.find(measurement=>measurement.id===id)?.cm
  for(const id of ['body-length','chest-half','waist-half','hem-half','front-armhole','sleeve-length','bicep-half','cuff-half']){
    assert.ok(Number.isFinite(reading(id)) && reading(id)>0, `${size} missing POM ${id}`)
  }
  const dxf=projectToDxf(project,size)
  for (const marker of ['CUT_','SA_','NOTCH_','GRAIN_','EOF']) assert.ok(dxf.includes(marker),`${size} missing DXF ${marker}`)
  assert.doesNotMatch(dxf,/(?:NaN|Infinity)/)
  rows.push({size,bodyLengthCm:reading('body-length'),chestHalfCm:reading('chest-half'),waistHalfCm:reading('waist-half'),worstSeamMismatchPercent:Number(worst.toFixed(3))})
}
for (let i=1;i<rows.length;i++) assert.ok(rows[i].chestHalfCm > rows[i-1].chestHalfCm)
const packageSpec=buildTechPack(base)
assert.equal(packageSpec.productionSpec?.gradingModel,'seam-locked-affine-v1')
assert.equal(packageSpec.patternPieces.length,4)
assert.equal(packageSpec.construction.length,14)
const csv=measurementRunToCSV(base)
assert.ok(csv.includes('Stomach') || csv.includes('waist'))
assert.ok(csv.includes('Cuff circumference (sleeve flat)'))
console.log(JSON.stringify({pass:true,baseSize:base.grading.baseSize,pieces:4,seams:14,matchingNotches:notches.length,measurementsBySize:rows,physicalFactoryApproval:'REQUIRED'},null,2))
