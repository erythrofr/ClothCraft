import fs from 'node:fs'
import path from 'node:path'
import { createTemplateProject } from '../src/data/templates.js'
import { buildNativeSimulationPayload } from '../src/core/backends/nativePayload.js'
import { buildDressedPpfPayload, ppfPayloadSummary, validatePpfPayload } from '../src/core/backends/ppfPayload.js'

const template = process.argv[2] || 'tee'
const nativeResultPath = process.argv[3] || `native_backend/output/${template}.native-result.json`
const output = process.argv[4] || `blender_bridge/fixtures/${template}-dressed-unwelded.ppf.json`
const frameCount = Math.max(10, Number(process.argv[5] || 24))

const project = createTemplateProject(template)
const nativePayload = buildNativeSimulationPayload(project)
const nativeResult = JSON.parse(fs.readFileSync(nativeResultPath, 'utf8'))
const payload = buildDressedPpfPayload(project, nativePayload, nativeResult, { frameCount })
const validation = validatePpfPayload(payload)
if (!validation.ok) throw new Error(validation.errors.join('; '))

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(payload, null, 2) + '\n')
console.log(JSON.stringify({ template, nativeResultPath, output, ...ppfPayloadSummary(payload), sourceFrames: nativeResult.frames }, null, 2))
