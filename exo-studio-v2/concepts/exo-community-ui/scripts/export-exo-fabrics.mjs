#!/usr/bin/env node
// Generate a portable display index from the authoritative EXO material catalog.
// Run from any directory: node concepts/exo-community-ui/scripts/export-exo-fabrics.mjs
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { FABRIC_PRESETS } from '../../../src/data/defaultProject.js'

const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '../fabric-index.json')
const source = Object.values(FABRIC_PRESETS)
const assert = (condition, message) => { if (!condition) throw new Error(message) }
assert(source.length === 400, `Expected 400 EXO fabrics, found ${source.length}`)
const byId = new Map(source.map(preset => [preset.id, preset]))
assert(byId.size === 400, 'Duplicate EXO fabric IDs')

const cleanText = (value, limit = 240) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit)
  : ''
const asNumber = value => Number.isFinite(value) ? value : null
const finishLabels = {
  fine: 'Fine / Light Construction', dense: 'Dense / Firm Construction',
  softened: 'Soft-Hand / Broken-In Finish', crisp: 'Crisp / Structured Finish',
}
const familyIdOf = preset => preset.familyId || preset.materialFamilyId || preset.id
const familyNameOf = preset => cleanText(byId.get(familyIdOf(preset))?.name || preset.name, 120)
const classify = preset => {
  const s = `${preset.surfaceFamily || ''} ${familyNameOf(preset)} ${preset.name}`.toLowerCase()
  if (/denim/.test(s)) return 'Denim'
  if (/leather|suede/.test(s)) return 'Leather & Suede'
  if (/wool|cashmere|alpaca|mohair/.test(s)) return 'Wool & Animal Fibers'
  if (/silk|satin|chiffon|organza/.test(s)) return 'Silk & Sheers'
  if (/linen|hemp|ramie/.test(s)) return 'Linen & Bast Fibers'
  if (/nylon|polyester|synthetic|softshell|ripstop|neoprene|mesh|quilted/.test(s)) return 'Technical & Synthetics'
  if (/rib|knit|jersey|interlock|fleece|terry|scuba/.test(s)) return 'Knits & Fleece'
  if (/cotton|poplin|canvas|twill|corduroy|velvet|chino/.test(s)) return 'Cotton & Wovens'
  return 'Specialty & Other'
}
const records = source.map((preset, sourceIndex) => {
  assert(typeof preset.id === 'string' && typeof preset.name === 'string', `Invalid ID/name at ${sourceIndex}`)
  const familyId = familyIdOf(preset)
  assert(byId.has(familyId), `Unknown family ID for ${preset.id}: ${familyId}`)
  const family = familyNameOf(preset)
  const group = classify(preset)
  const finish = preset.finishId ? finishLabels[preset.finishId] || cleanText(preset.finishId, 70) : 'Original Construction'
  const status = preset.calibration?.status === 'estimated' ? 'estimated' : 'unverified'
  const composition = typeof preset.composition === 'string' && preset.composition.trim()
    ? cleanText(preset.composition, 160) : null
  const tags = [...new Set([group, family, finish, preset.surfaceFamily && cleanText(preset.surfaceFamily, 70), preset.finishId ? 'Variant' : 'Archetype'].filter(Boolean))]
  return {
    id: cleanText(preset.id, 100), name: cleanText(preset.name, 180),
    familyId: cleanText(familyId, 100), family, group, finish,
    construction: cleanText(preset.construction, 240) || null,
    gsm: asNumber(preset.gsm), color: /^#[\da-f]{6}$/i.test(preset.color || '') ? preset.color.toLowerCase() : null,
    roughness: asNumber(preset.roughness), stretchWarp: asNumber(preset.stretchWarp),
    stretchWeft: asNumber(preset.stretchWeft), composition, tags, status,
  }
})

records.sort((a, b) => Number(a.familyId !== a.id) - Number(b.familyId !== b.id)
  || source.findIndex(s => s.id === a.id) - source.findIndex(s => s.id === b.id))
assert(records.length === 400 && records.slice(0, 80).every(p => p.id === p.familyId), 'Archetype ordering/count invariant failed')
assert(records.slice(80).every(p => p.id !== p.familyId), 'Variant ordering invariant failed')
assert(new Set(records.map(p => p.id)).size === 400, 'Export IDs must be unique')

const payload = {
  metadata: {
    schemaVersion: 1,
    source: 'src/data/defaultProject.js — FABRIC_PRESETS',
    generator: 'concepts/exo-community-ui/scripts/export-exo-fabrics.mjs',
    generatedAt: new Date().toISOString(),
    count: records.length, archetypeCount: 80, variantCount: 320,
    measurements: 'EXO illustrative starting points; unverified unless source calibration states otherwise',
    includesExternalTextures: false,
  },
  fabrics: records,
}
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`Exported ${records.length} fabric records (80 archetypes, 320 variants) to ${outputPath}`)
