import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { analyzePpfStagingSeams } from '../ppf_backend/stagingDiagnostics.mjs'

const payload = JSON.parse(readFileSync('blender_bridge/output/ppf-native-contact-ab/pinned-long.json', 'utf8'))
const report = analyzePpfStagingSeams(payload)
assert.equal(report.seamGroups, 14)
assert.equal(report.nearAssembled, false)
assert.ok(report.maximumInitialSeamGapCm >= 30)
assert.ok(report.worstSeams.some(s => s.id.startsWith('seam-')))
assert.ok(report.warning)
const fixture = { shell: { vertices: [[0, 0, 0], [.005, 0, 0]], stitchEdges: [{a:0,b:1,seamId:'short'}] } }
assert.equal(analyzePpfStagingSeams(fixture).nearAssembled, true)
console.log(JSON.stringify(report, null, 2))
