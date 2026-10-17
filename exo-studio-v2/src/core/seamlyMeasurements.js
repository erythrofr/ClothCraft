// Independent SeamlyMe measurement file interchange. This adapter reads
// documented XML measurements from the installed Seamly2D sample format.
// Seamly construction tools and formula graphs in .sm2d are NOT flattened
// or claimed to be interchangeable with the Garment Studio 2D editor.
import { XMLParser, XMLValidator } from 'fast-xml-parser'

const MAX_XML_LENGTH = 2 * 1024 * 1024
const VALID_NAME = /^[A-Za-z_][\w-]{0,127}$/
const UNIT_TO_CM = { cm: 1, mm: 0.1, inch: 2.54, in: 2.54 }

const asList = value => value == null ? [] : Array.isArray(value) ? value : [value]

const finiteMeasurement = (value, description, { allowNegative = false } = {}) => {
  if (value === '' || value == null) throw new Error(`Missing ${description}`)
  const number = Number(String(value).trim())
  if (!Number.isFinite(number) || (!allowNegative && number < 0) || Math.abs(number) > 1000000) {
    throw new Error(`Non-numeric or invalid ${description}; formula evaluation requires the Seamly2D engine`)
  }
  return number
}

export function parseSeamlyMeasurements(source, { filename = '' } = {}) {
  if (typeof source !== 'string' || source.length > MAX_XML_LENGTH) throw new Error('Seamly measurement file must be valid XML smaller than 2 MB')
  // XML external entities and doctypes have no place in simple measurement
  // interchange; rejecting them avoids surprising file/network expansion.
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source)) throw new Error('XML document types and entities are not allowed')
  const valid = XMLValidator.validate(source)
  if (valid !== true) throw new Error(`Invalid Seamly measurement XML: ${valid?.err?.msg || 'not well formed'}`)
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
    removeNSPrefix: false,
    processEntities: true,
  }).parse(source)
  const root = parsed.smis ? parsed.smis : parsed.smms
  const kind = parsed.smis ? 'smis' : parsed.smms ? 'smms' : null
  if (!root || !kind) throw new Error('Only SeamlyMe .smis or .smms measurements are supported. Import .sm2d construction using Seamly2D until the formula interpreter is implemented.')
  const unit = String(root.unit || '').trim().toLowerCase()
  const scaleToCm = UNIT_TO_CM[unit]
  if (!scaleToCm) throw new Error(`Unsupported Seamly measurement unit: ${unit || '(missing)'}`)
  const entries = asList(root['body-measurements']?.m)
  if (!entries.length || entries.length > 600) throw new Error('Expected 1–600 Seamly body measurements')
  const measurements = {}
  for (const entry of entries) {
    const name = String(entry['@_name'] || '').trim()
    if (!VALID_NAME.test(name) || Object.hasOwn(measurements, name)) throw new Error(`Invalid or duplicate Seamly measurement identifier: ${name}`)
    const raw = kind === 'smms' ? entry['@_base'] : entry['@_value']
    const baseCm = finiteMeasurement(raw, `${name} base value`) * scaleToCm
    measurements[name] = {
      name,
      baseCm: Number(baseCm.toFixed(6)),
      description: String(entry['@_description'] || entry['@_full_name'] || ''),
      ...(kind === 'smms' ? {
        sizeIncrementCm: Number((finiteMeasurement(entry['@_size_increase'] ?? '0', `${name} size increment`, { allowNegative: true }) * scaleToCm).toFixed(6)),
        heightIncrementCm: Number((finiteMeasurement(entry['@_height_increase'] ?? '0', `${name} height increment`, { allowNegative: true }) * scaleToCm).toFixed(6)),
      } : {}),
    }
  }
  return {
    format: 'garment-studio-seamlyme-measurements.v1',
    kind,
    sourceName: filename ? String(filename).slice(0, 255) : null,
    sourceUnit: unit,
    baseSize: kind === 'smms' ? root.size?.['@_base'] ?? null : null,
    baseHeight: kind === 'smms' ? root.height?.['@_base'] ?? null : null,
    note: String(root.notes || ''),
    measurementCount: Object.keys(measurements).length,
    measurements,
    assumptions: kind === 'smms'
      ? 'Base size and height values only; Seamly grading increments are preserved but not applied without its full measurement/formula evaluation.'
      : 'Individual measurement values only; this does not import or evaluate a Seamly .sm2d drafting formula dependency graph.',
  }
}

// Only directly equivalent circumference/height fields are mapped into the
// avatar. Never infer shoulders, sleeve ease, garment cut or 3D pose from
// measurements that do not share definitions.
export const SEAMLY_AVATAR_FIELDS = Object.freeze({
  height: 'heightCm',
  bust_circ: 'chestCm',
  waist_circ: 'waistCm',
  hip_circ: 'hipCm',
  neck_circ: 'neckCm',
  arm_shoulder_tip_to_wrist: 'armLengthCm',
})

export function applySeamlyMeasurements(project, library, { applyToAvatar = false } = {}) {
  if (library?.format !== 'garment-studio-seamlyme-measurements.v1') throw new Error('Invalid SeamlyMe measurement library')
  const next = {
    ...project,
    measurementLibrary: { ...(project.measurementLibrary || {}), seamly: library },
  }
  if (applyToAvatar) {
    next.avatar = { ...(project.avatar || {}) }
    for (const [name, field] of Object.entries(SEAMLY_AVATAR_FIELDS)) {
      const cm = library.measurements[name]?.baseCm
      if (Number.isFinite(cm) && cm > 0) next.avatar[field] = cm
    }
  }
  // This adapter is observational with respect to patterns and sewing. A
  // formula-driven update requires the Seamly2D tool graph evaluator.
  return next
}
