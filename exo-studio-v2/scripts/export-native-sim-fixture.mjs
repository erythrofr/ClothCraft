import fs from 'node:fs'
import path from 'node:path'
import { createTemplateProject } from '../src/data/templates.js'
import { buildNativeSimulationPayload, nativePayloadSummary } from '../src/core/backends/nativePayload.js'

const template = process.argv[2] || 'tee'
const output = process.argv[3] || `native_backend/fixtures/${template}.native-sim.json`
const project = createTemplateProject(template)
const payload = buildNativeSimulationPayload(project, {
  quality: process.env.GS_NATIVE_QUALITY || undefined,
  clothModel: process.env.GS_NATIVE_CLOTH_MODEL || undefined,
  bendingModel: process.env.GS_NATIVE_BENDING_MODEL || undefined,
  lowerBodySeamRecovery: process.env.GS_NATIVE_LOWER_BODY_SEAM_RECOVERY == null
    ? undefined
    : Number(process.env.GS_NATIVE_LOWER_BODY_SEAM_RECOVERY),
  lowerBodyJunctionRecovery: process.env.GS_NATIVE_LOWER_BODY_JUNCTION_RECOVERY == null
    ? undefined
    : Number(process.env.GS_NATIVE_LOWER_BODY_JUNCTION_RECOVERY),
})
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(payload, null, 2) + '\n')
console.log(JSON.stringify({ template, output, ...nativePayloadSummary(payload) }, null, 2))
