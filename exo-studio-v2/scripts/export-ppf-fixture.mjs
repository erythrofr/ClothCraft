import fs from 'node:fs'
import path from 'node:path'
import { createTemplateProject } from '../src/data/templates.js'
import { buildPpfPayload, ppfPayloadSummary, validatePpfPayload } from '../src/core/backends/ppfPayload.js'

const template = process.argv[2] || 'tee'
const output = process.argv[3] || `blender_bridge/fixtures/${template}.ppf.json`
const project = createTemplateProject(template)
const payload = buildPpfPayload(project)
const validation = validatePpfPayload(payload)
if (!validation.ok) throw new Error(validation.errors.join('; '))
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(payload, null, 2) + '\n')
console.log(JSON.stringify({ template, output, ...ppfPayloadSummary(payload) }, null, 2))
