import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTemplateProject } from '../src/data/templates.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const template = process.argv[2] || 'tee'
const output = process.argv[3] || path.join(root, 'blender_bridge', 'fixtures', `${template}.garment.json`)
const project = createTemplateProject(template)
project.updatedAt = '2000-01-01T00:00:00.000Z'
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(project, null, 2) + '\n')
console.log(JSON.stringify({ template, output, pieces: project.pieces.length, seams: project.seams.length, fabrics: Object.keys(project.fabrics || {}).length }, null, 2))
