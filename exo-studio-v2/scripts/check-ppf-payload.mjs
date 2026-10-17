import assert from 'node:assert/strict'
import { createTemplateProject } from '../src/data/templates.js'
import { buildPpfPayload, ppfPayloadSummary, validatePpfPayload } from '../src/core/backends/ppfPayload.js'

const templates = ['tee', 'hoodie', 'zip-hoodie', 'pants']

const rows = []
for (const templateId of templates) {
  const project = createTemplateProject(templateId)
  const payload = buildPpfPayload(project)
  const validation = validatePpfPayload(payload)
  if (!validation.ok) throw new Error(`${templateId}: ${validation.errors.join('; ')}`)
  const summary = ppfPayloadSummary(payload)
  if (summary.pieces !== project.pieces.length) throw new Error(`${templateId}: piece count mismatch ${summary.pieces} != ${project.pieces.length}`)
  if (summary.vertices < 100 || summary.faces < 100) throw new Error(`${templateId}: shell compiler produced too little geometry`)
  if (summary.stitchEdges < project.seams.length) throw new Error(`${templateId}: seam compiler lost sewing topology (${summary.stitchEdges} edges for ${project.seams.length} seams)`)
  const faceEdges = new Set()
  for (const [a, b, c] of payload.shell.faces) {
    for (const [u, v] of [[a,b],[b,c],[c,a]]) faceEdges.add(u < v ? `${u}:${v}` : `${v}:${u}`)
  }
  const pureStitches = payload.shell.stitchEdges.filter(({ a, b }) => !faceEdges.has(a < b ? `${a}:${b}` : `${b}:${a}`))
  if (pureStitches.length !== payload.shell.stitchEdges.length) throw new Error(`${templateId}: a stitch edge is already part of a shell triangle and would not be detected as a loose stitch in PPF`)
  rows.push({ templateId, ...summary, pureLooseStitches: pureStitches.length })
}

const teeProject = createTemplateProject('tee')
const teePayload = buildPpfPayload(teeProject)
const expectPayloadRejection = (change, expected) => {
  const candidate = structuredClone(teePayload)
  change(candidate)
  const check = validatePpfPayload(candidate)
  assert.equal(check.ok, false, `Invalid solver payload must be rejected: ${expected}`)
  assert.ok(check.errors.some(error => error.includes(expected)), `Expected ${expected}, got ${check.errors.join('; ')}`)
}
expectPayloadRejection(payload => { payload.shell.vertices[0][0] = Number.NaN }, 'PPF vertex 0')
expectPayloadRejection(payload => { payload.shell.faces[0] = [0, 0, 1] }, 'invalid PPF face 0')
expectPayloadRejection(payload => { payload.shell.faces[0] = [0, 0, 0] }, 'invalid PPF face 0')
expectPayloadRejection(payload => { payload.shell.stitchEdges[0].a = payload.shell.stitchEdges[0].b }, 'invalid PPF stitch edge 0')
expectPayloadRejection(payload => { payload.shell.stitchEdges[0].seamId = '' }, 'invalid PPF stitch edge 0')
expectPayloadRejection(payload => { payload.shell.stitchEdges[1] = {...payload.shell.stitchEdges[0]} }, 'duplicate PPF stitch pair')
expectPayloadRejection(payload => {
  const [a,b] = payload.shell.faces[0]
  payload.shell.stitchEdges[0] = {...payload.shell.stitchEdges[0],a,b}
}, 'lies on a fabric triangle edge')
expectPayloadRejection(payload => {
  payload.avatar.mode = 'local-thomas-body-mesh'
  delete payload.scene.avatarRepresentation
}, 'Thomas PPF payload must explicitly choose')
assert.equal(teePayload.scene.avatarContactGap, .001, 'PPF avatar must request an absolute 1 mm gap')
assert.equal(teePayload.scene.avatarContactOffset, 0, 'PPF avatar must not inherit an outward offset')
assert.equal(teePayload.fabrics.main.material.contactGap, .001, 'PPF cloth must request an absolute 1 mm gap')
assert.equal(teePayload.fabrics.main.material.strainLimitPercent, 5, 'PPF strain limiter must be explicitly requested')
for (const seam of teeProject.seams) {
  if (!teePayload.shell.stitchEdges.some((edge) => edge.seamId === seam.id)) {
    throw new Error(`PPF missed the real stitch pairs for seam ${seam.id}`)
  }
}
const strengthTestProject = createTemplateProject('tee')
strengthTestProject.simulation.ppfStitchStiffness = 3.5
const strengthTest = buildPpfPayload(strengthTestProject)
if (strengthTest.fabrics.main.material.stitchStiffness !== 3.5) {
  throw new Error('PPF sewing spring strength was not serialized into the solver material')
}
const primaryFabricId = teeProject.pieces[0]?.fabricId || Object.keys(teeProject.fabrics || {})[0]
const primaryFabric = teePayload.fabrics[primaryFabricId]?.material
const expectedDensity = Number(teeProject.fabrics[primaryFabricId]?.gsm ?? 180) / 1000
if (!primaryFabric) throw new Error(`PPF primary fabric mapping missing for ${primaryFabricId}`)
if (Math.abs(primaryFabric.shellDensity - expectedDensity) > 1e-9) throw new Error(`PPF fabric density should be ${expectedDensity} kg/m², got ${primaryFabric.shellDensity}`)
if (primaryFabric.shrinkX !== 1 || primaryFabric.shrinkY !== 1) throw new Error('PPF zero-shrink mapping changed')

console.log(JSON.stringify(rows, null, 2))
