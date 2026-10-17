/** Lab evidence ingestion for EXO. No estimates are promoted to measurements. */
import { estimateTensileStiffness } from './fabricCalibration.js'

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const num = (n, label, zero = false) => {
  if (typeof n !== 'number' || !Number.isFinite(n) || (zero ? n < 0 : n <= 0))
    throw new TypeError(`${label}: expected ${zero ? 'nonnegative' : 'positive'} finite number`)
  return n
}
const text = (s, label) => {
  if (typeof s !== 'string' || !s.trim()) throw new TypeError(`${label}: required nonempty string`)
  return s.trim()
}
const object = (v, label) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError(`${label}: expected object`)
  return v
}
const unit = (v, expected, label) => {
  if (v !== expected) throw new TypeError(`${label}: expected unit ${expected}`)
}
const measurement = (v, expected, label) => {
  object(v, label)
  unit(v.unit, expected, label)
  num(v.value, `${label}.value`)
  if (own(v, 'uncertainty')) num(v.uncertainty, `${label}.uncertainty`, true)
  return v.value
}
const optionalMeasurement = (v, expected, label) => v == null ? null : measurement(v, expected, label)
const uri = (v, label) => {
  text(v, label)
  const parsed = new URL(v)
  if (!['https:', 'http:', 'doi:', 'file:'].includes(parsed.protocol)) throw new TypeError(`${label}: unsupported URI scheme`)
  return v
}

/**
 * Schema v1 expects exact sample-specific provenance and quantitative units.
 * Observations use extensionMm and forceN, OR forcePerWidth {value,unit:'N/mm'}.
 * Extension is referenced to gaugeLengthMm, never interpreted as a percentage.
 */
export function validateFabricEvidence(record, catalog) {
  object(record, 'record')
  if (record.schemaVersion !== 1) throw new TypeError('schemaVersion must equal 1')
  const fabricId = text(record.fabricId, 'fabricId')
  if (catalog && !own(catalog, fabricId)) throw new RangeError(`Unknown fabricId: ${fabricId}`)
  object(record.provenance, 'provenance')
  text(record.provenance.sampleId, 'provenance.sampleId')
  uri(record.provenance.evidenceUri, 'provenance.evidenceUri')
  text(record.provenance.sourceReference, 'provenance.sourceReference')
  if (record.provenance.method != null) text(record.provenance.method, 'provenance.method')
  if (record.provenance.condition != null) text(record.provenance.condition, 'provenance.condition')
  const m = object(record.measurements, 'measurements')
  if (m.arealMass != null) {
    if (!['g/m²','kg/m²'].includes(m.arealMass.unit)) throw new TypeError('arealMass: expected g/m² or kg/m²')
    num(m.arealMass.value, 'arealMass.value')
    if (own(m.arealMass, 'uncertainty')) num(m.arealMass.uncertainty, 'arealMass.uncertainty', true)
  }
  optionalMeasurement(m.thickness, 'mm', 'thickness')
  for (const axis of ['warp','weft']) {
    const curve = m.tensile?.[axis]
    if (curve == null) continue
    object(curve, `${axis} tensile curve`)
    num(curve.widthMm, `${axis}.widthMm`)
    num(curve.gaugeLengthMm, `${axis}.gaugeLengthMm`)
    if (!Array.isArray(curve.observations) || curve.observations.length < 2) throw new TypeError(`${axis}: require two measured points`)
    let previous = 0
    for (const [i, p] of curve.observations.entries()) {
      object(p, `${axis}.observations[${i}]`)
      num(p.extensionMm, `${axis}.extensionMm`)
      if (p.extensionMm <= previous || p.extensionMm > curve.gaugeLengthMm) throw new RangeError(`${axis}: extensions must increase and remain within gauge length`)
      previous = p.extensionMm
      if (own(p, 'forceN') === own(p, 'forcePerWidth')) throw new TypeError(`${axis}: supply exactly one of forceN or forcePerWidth`)
      if (own(p, 'forceN')) num(p.forceN, `${axis}.forceN`)
      else measurement(p.forcePerWidth, 'N/mm', `${axis}.forcePerWidth`)
      if (own(p, 'uncertainty')) {
        object(p.uncertainty, `${axis}.uncertainty`)
        if (own(p.uncertainty, 'extensionMm')) num(p.uncertainty.extensionMm, `${axis}.uncertainty.extensionMm`, true)
        if (own(p.uncertainty, 'forceN')) num(p.uncertainty.forceN, `${axis}.uncertainty.forceN`, true)
      }
    }
  }
  for (const axis of ['warp','weft']) optionalMeasurement(m.bending?.[axis], 'N·m', `bending.${axis}`)
  optionalMeasurement(m.shear, 'N/m', 'shear')
  if (!m.arealMass && !m.thickness && !m.tensile?.warp && !m.tensile?.weft && !m.shear && !m.bending?.warp && !m.bending?.weft)
    throw new TypeError('At least one physical measurement required')
  return structuredClone(record)
}

const measured = (value, evidence, method) => ({value, status:'measured', sampleId:evidence.provenance.sampleId, evidenceUri:evidence.provenance.evidenceUri, sourceReference:evidence.provenance.sourceReference, method})
const approximation = (value, evidence, reason) => ({value, status:'derived-approximation', sampleId:evidence.provenance.sampleId, evidenceUri:evidence.provenance.evidenceUri, reason})
export function calibrateFabricEvidence(input, catalog) {
  const evidence = validateFabricEvidence(input, catalog)
  const m = evidence.measurements
  const physical = {}
  const solverSuggestions = {}
  if (m.arealMass) {
    const density = m.arealMass.value * (m.arealMass.unit === 'g/m²' ? .001 : 1)
    physical.arealMassKgM2 = measured(density, evidence, 'unit conversion')
    solverSuggestions.density = measured(density, evidence, 'areal mass kg/m²; native solver density')
  }
  if (m.thickness) {
    const thicknessM = m.thickness.value / 1000
    physical.thicknessM = measured(thicknessM, evidence, 'mm to m')
    solverSuggestions.thickness = measured(thicknessM, evidence, 'specimen thickness to native solver m')
  }
  for (const axis of ['warp','weft']) {
    const curve = m.tensile?.[axis]
    if (!curve) continue
    const observations = curve.observations.map(p => ({extensionMm:p.extensionMm, forceN:own(p,'forceN') ? p.forceN : p.forcePerWidth.value * curve.widthMm}))
    const fit = estimateTensileStiffness({widthMm:curve.widthMm, gaugeLengthMm:curve.gaugeLengthMm, observations})
    physical[`${axis}TensileFit`] = approximation(fit, evidence, 'linear fit through origin; loading history, hysteresis and solver law unverified')
    solverSuggestions[axis] = approximation(fit.stiffnessNPerM, evidence, 'effective membrane tensile fit; requires native nonlinear solver validation before assignment')
  }
  if (m.shear) {
    physical.shearNPerM = measured(m.shear.value, evidence, 'reported shear modulus in N/m')
    solverSuggestions.shear = approximation(m.shear.value, evidence, 'reported shear may use incompatible laboratory strain/fixture convention; validate with solver')
  }
  for (const axis of ['warp','weft']) if (m.bending?.[axis]) {
    physical[`bending${axis}`] = measured(m.bending[axis].value, evidence, 'reported bending rigidity N·m')
    solverSuggestions[`bend_${axis}`] = approximation(m.bending[axis].value, evidence, 'confirm specimen bending convention and solver units before assignment')
  }
  const count = [m.arealMass,m.thickness,m.tensile?.warp,m.tensile?.weft,m.shear,m.bending?.warp,m.bending?.weft].filter(Boolean).length
  const grade = count === 7 && evidence.provenance.method && evidence.provenance.condition ? 'A'
    : count >= 4 && m.tensile?.warp && m.tensile?.weft ? 'B' : count >= 2 ? 'C' : 'D'
  const original = catalog?.[evidence.fabricId]
  const differences = {}
  if (original) {
    const candidates = {gsm:physical.arealMassKgM2?.value*1000,thickness:physical.thicknessM?.value}
    for (const [field,value] of Object.entries(candidates)) {
      if (value == null || typeof original[field] !== 'number') continue
      differences[field] = {originalEstimate:original[field], measured:value, absoluteDelta:value-original[field], relativeDelta:(value-original[field])/original[field]}
    }
  }
  return {schemaVersion:1, fabricId:evidence.fabricId, grade, measuredFieldCount:count, provenance:evidence.provenance, physical, solverSuggestions, differences, flags:[...(m.tensile?.warp||m.tensile?.weft ? ['Tensile stiffness is small-strain regression, not a validated solver parameter'] : []), ...(!m.tensile?.warp || !m.tensile?.weft ? ['Both directional tensile curves are needed for anisotropic calibration'] : []), 'No graphical/PBR or friction measurements are inferred from force curves'], evidence}
}

export function ingestFabricEvidence(records, catalog) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array')
  const seen = new Set()
  return records.map(record => {
    const key = `${record?.fabricId}\0${record?.provenance?.sampleId}`
    if (seen.has(key)) throw new RangeError('Duplicate fabric/sample evidence')
    seen.add(key)
    return calibrateFabricEvidence(record,catalog)
  })
}
