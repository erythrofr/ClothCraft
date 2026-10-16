import fs from 'node:fs'
import path from 'node:path'
import { createTemplateProject } from '../src/data/templates.js'
import { buildExplodedPpfPayload, ppfPayloadSummary, validatePpfPayload } from '../src/core/backends/ppfPayload.js'

const template = process.argv[2] || 'tee'
const output = process.argv[3] || `blender_bridge/fixtures/${template}-exploded.ppf.json`
const frameCount = Math.max(10, Number(process.argv[4] || 48))
const project = createTemplateProject(template)
// A measured sewing-strength experiment can override the PPF-specific fabric
// spring without changing the user's live XPBD material or saved projects.
// PPF treats stitch_stiffness as a raw force coefficient, NOT a 0..1 blend.
if (process.env.PPF_STITCH_STIFFNESS !== undefined) {
  const stiffness = Number(process.env.PPF_STITCH_STIFFNESS)
  if (!Number.isFinite(stiffness) || stiffness <= 0 || stiffness > 1e6) {
    throw new Error('PPF_STITCH_STIFFNESS must be a finite number in (0, 1000000]')
  }
  project.simulation.ppfStitchStiffness = stiffness
}
const payload = buildExplodedPpfPayload(project, { frameCount })
const validation = validatePpfPayload(payload)
if (!validation.ok) throw new Error(validation.errors.join('; '))
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(payload, null, 2) + '\n')
console.log(JSON.stringify({ template, output, ...ppfPayloadSummary(payload), arrangement: payload.shell.arrangement }, null, 2))
