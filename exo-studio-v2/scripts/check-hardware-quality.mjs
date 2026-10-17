/** Run with node scripts/check-hardware-quality.mjs; no browser or server required. */
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { listHardwarePresets } from '../src/data/hardwarePresets.js'

const root = resolve(import.meta.dirname, '..')
const errors = []
const warn = []
const seen = new Map()
const kinds = new Set(['button', 'buttonhole', 'zipper', 'snap', 'rivet', 'buckle'])
const presets = listHardwarePresets()
for (const preset of presets) {
  if (!kinds.has(preset.kind)) errors.push(`${preset.id}: unsupported kind ${preset.kind}`)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(preset.id)) errors.push(`${preset.id}: invalid filename-safe id`)
  const sizes = Object.entries(preset.dimensionsMm ?? {})
  if (!sizes.length || sizes.some(([, n]) => !Number.isFinite(n) || n <= 0)) errors.push(`${preset.id}: dimensions must be finite positive millimetres`)
  if (!preset.material || !preset.finish || !preset.construction) errors.push(`${preset.id}: missing production description`)
  if (!(preset.pbr?.metalness >= 0 && preset.pbr.metalness <= 1 && preset.pbr.roughness >= 0 && preset.pbr.roughness <= 1)) errors.push(`${preset.id}: invalid PBR material`)
  const path = resolve(root, 'public/hardware-thumbnails', `${preset.id}.png`)
  try {
    const png = await readFile(path)
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('invalid PNG signature')
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
    if (width < 256 || height < 256 || width !== height) errors.push(`${preset.id}: small or non-square thumbnail ${width}x${height}`)
    if (png.length < 12000) warn.push(`${preset.id}: unusually small image (${png.length} bytes)`)
    const hash = createHash('sha256').update(png).digest('hex')
    if (seen.has(hash)) errors.push(`${preset.id}: identical thumbnail to ${seen.get(hash)}`)
    seen.set(hash, preset.id)
  } catch (error) { errors.push(`${preset.id}: thumbnail missing/corrupt (${error.message})`) }
}
const hangerModels = ['innerscene-shoulder-form.glb', 'innerscene-clip-rail.glb']
for (const file of hangerModels) {
  try {
    const path = resolve(root, 'public/hangers', file)
    const buffer = await readFile(path)
    if (buffer.toString('utf8', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) throw Error('invalid GLB header/version/length')
    if (buffer.toString('utf8', 16, 20) !== 'JSON') throw Error('missing GLB JSON chunk')
    const manifest = JSON.parse(buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)))
    if (!manifest.meshes?.length || !manifest.nodes?.length) throw Error('model has no mesh nodes')
    const bytes = (await stat(path)).size
    console.log(`Hanger ${file}: ${manifest.meshes.length} meshes, ${manifest.materials?.length ?? 0} materials, ${(bytes / 1024).toFixed(0)} KiB`)
  } catch (error) { errors.push(`${file}: ${error.message}`) }
}
const countByKind = Object.fromEntries([...kinds].map(kind => [kind, presets.filter(p => p.kind === kind).length]))
console.log(`Hardware ${presets.length} presets, ${seen.size} unique valid PNG files`, countByKind)
for (const msg of warn) console.warn(`WARN: ${msg}`)
for (const msg of errors) console.error(`FAIL: ${msg}`)
if (errors.length) process.exitCode = 1
