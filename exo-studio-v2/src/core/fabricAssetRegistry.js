/**
 * Licensed appearance assets for EXO's 400 versioned fabric specifications.
 * Registry contains metadata only. Never treat a generator as a scan or
 * inherit calibration claims when sharing a parent's appearance.
 */
export const FABRIC_MAP_KINDS = Object.freeze(['color', 'normal', 'roughness', 'opacity', 'height'])
export const FABRIC_LICENSES = Object.freeze(['original', 'CC0', 'CC-BY'])
export const FABRIC_ASSET_GRADES = Object.freeze(['A', 'B', 'C', 'D'])
const SHA256 = /^[a-f0-9]{64}$/i
const URL_OK = /^(https:\/\/|asset:\/\/|\/assets\/|\/fabric-scans\/|\/fabric-scans-ambientcg\/|\.\/|\.\.\/)/i
const ID_OK = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/
const mapKinds = new Set(FABRIC_MAP_KINDS)
const licenses = new Set(FABRIC_LICENSES)
const positive = n => Number.isFinite(n) && n > 0
const fail = message => { throw new Error(message) }
const required = (v, name) => typeof v === 'string' && v.trim() ? v.trim() : fail(`Missing ${name}`)

export function validateFabricAsset(asset) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) fail('Asset must be an object')
  const id = required(asset.id, 'asset.id')
  if (!ID_OK.test(id)) fail(`Invalid asset id: ${id}`)
  const kind = required(asset.kind, `${id}.kind`)
  if (!mapKinds.has(kind)) fail(`Unsupported map kind: ${kind}`)
  const origin = required(asset.origin, `${id}.origin`)
  if (!['scan', 'procedural'].includes(origin)) fail(`${id}: origin must be scan or procedural`)
  const license = required(asset.license, `${id}.license`)
  if (!licenses.has(license)) fail(`${id}: unlicensed or unsupported license ${license}`)
  if (asset.licensePermission !== true) fail(`${id}: explicit permission confirmation required`)
  const uri = required(asset.uri, `${id}.uri`)
  if (!URL_OK.test(uri) || /[\s?#]/.test(uri)) fail(`${id}: URI must be a safe absolute HTTPS URL or local asset path without query`)
  if (/^\/(?:assets|fabric-scans|fabric-scans-ambientcg)\//i.test(uri) &&
      (uri.includes('\\') || uri.split('/').some(segment => segment === '.' || segment === '..' || /%2e|%2f|%5c/i.test(segment))))
    fail(`${id}: local URI contains unsafe traversal or encoding`)
  if (!SHA256.test(asset.sha256 || '')) fail(`${id}: valid SHA-256 is required`)
  const source = required(asset.provenance?.source, `${id}.provenance.source`)
  const creator = required(asset.provenance?.creator, `${id}.provenance.creator`)
  const acquisition = required(asset.provenance?.acquiredAt, `${id}.provenance.acquiredAt`)
  if (!/^\d{4}-\d\d-\d\d$/.test(acquisition) || !Number.isFinite(Date.parse(acquisition))) fail(`${id}: invalid acquisition date`)
  if (license === 'CC-BY' && (!asset.provenance?.attribution || !asset.provenance?.licenseUrl))
    fail(`${id}: CC-BY requires attribution and license URL`)
  if (license === 'original' && !asset.provenance?.rightsHolder)
    fail(`${id}: original assets require rightsHolder`)
  if (origin === 'scan' && !asset.provenance?.captureMethod)
    fail(`${id}: scan requires captureMethod (e.g. photography or photogrammetry)`)
  if (origin === 'procedural' && !asset.provenance?.generator)
    fail(`${id}: procedural requires a named generator`)
  const { widthMm, heightMm } = asset.repeatMm || {}
  if (!positive(widthMm) || !positive(heightMm)) fail(`${id}: physical repeat widthMm and heightMm must be positive`)
  const { width, height, mipLevels, tileable } = asset.image || {}
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1)
    fail(`${id}: image dimensions must be positive integers`)
  if (!Number.isSafeInteger(mipLevels) || mipLevels < 1 ||
      mipLevels > 1 + Math.floor(Math.log2(Math.max(width, height))))
    fail(`${id}: invalid mipLevels for image resolution`)
  if (typeof tileable !== 'boolean') fail(`${id}: image.tileable must be declared`)
  if (!['sRGB', 'linear'].includes(asset.colorSpace)) fail(`${id}: colorSpace must be sRGB or linear`)
  if (kind === 'color' && asset.colorSpace !== 'sRGB') fail(`${id}: color map must use sRGB`)
  if (kind !== 'color' && asset.colorSpace !== 'linear') fail(`${id}: data map must use linear color space`)
  if (kind === 'normal' && !['OpenGL', 'DirectX'].includes(asset.normalConvention))
    fail(`${id}: normalConvention required for normals`)
  if (asset.tone) {
    const { exposureEV = 0, saturation = 1, hueDegrees = 0, gamma = 1 } = asset.tone
    if (![exposureEV, saturation, hueDegrees, gamma].every(Number.isFinite) || saturation < 0 || gamma <= 0)
      fail(`${id}: invalid tone transform`)
  }
  if (asset.presetIds !== undefined &&
      (!Array.isArray(asset.presetIds) || !asset.presetIds.every(x => typeof x === 'string')))
    fail(`${id}: presetIds must be an array of identifiers`)
  return { ...asset, id, kind, origin, license, uri, sha256: asset.sha256.toLowerCase(),
    provenance: { ...asset.provenance, source, creator, acquiredAt: acquisition } }
}

export function createFabricAssetRegistry(presets, { assets = [], assignments = {}, parentSharing = {} } = {}) {
  if (!presets || typeof presets !== 'object' || Array.isArray(presets)) fail('Presets must be keyed by id')
  const ids = Object.keys(presets)
  const validIds = new Set(ids)
  const byId = new Map()
  const hashes = new Map()
  for (const raw of assets) {
    const asset = validateFabricAsset(raw)
    if (byId.has(asset.id)) fail(`Duplicate asset id: ${asset.id}`)
    const existing = hashes.get(asset.sha256)
    if (existing) fail(`Duplicate SHA-256: ${asset.id} and ${existing}`)
    hashes.set(asset.sha256, asset.id)
    for (const presetId of asset.presetIds || []) if (!validIds.has(presetId))
      fail(`${asset.id}: unknown preset ${presetId}`)
    byId.set(asset.id, Object.freeze(asset))
  }
  const explicit = new Map()
  for (const [presetId, mappings] of Object.entries(assignments)) {
    if (!validIds.has(presetId)) fail(`Unknown preset assignment: ${presetId}`)
    if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) fail(`Invalid maps for ${presetId}`)
    for (const [kind, assetId] of Object.entries(mappings)) {
      if (!mapKinds.has(kind)) fail(`Invalid mapping kind ${kind}`)
      const asset = byId.get(assetId)
      if (!asset || asset.kind !== kind) fail(`Unavailable or mismatched asset ${assetId} for ${presetId}.${kind}`)
      if (asset.presetIds && !asset.presetIds.includes(presetId)) fail(`${assetId}: ${presetId} not authorized in presetIds`)
    }
    explicit.set(presetId, Object.freeze(Object.fromEntries(
      Object.entries(mappings).map(([kind, assetId]) => [kind, byId.get(assetId)])
    )))
  }
  for (const [child, parent] of Object.entries(parentSharing)) {
    if (!validIds.has(child) || !validIds.has(parent) || child === parent) fail(`Invalid parent sharing ${child} -> ${parent}`)
  }
  const resolve = (presetId, seen = new Set()) => {
    if (!validIds.has(presetId)) fail(`Unknown fabric preset: ${presetId}`)
    if (seen.has(presetId)) fail(`Cyclic parent sharing at ${presetId}`)
    seen.add(presetId)
    const parent = parentSharing[presetId]
    const inherited = parent ? resolve(parent, seen).maps : {}
    const maps = { ...inherited, ...(explicit.get(presetId) || {}) }
    for (const [kind, asset] of Object.entries(maps)) {
      if (asset.presetIds && !asset.presetIds.includes(presetId))
        fail(`${asset.id}: inherited use by ${presetId} not authorized`)
    }
    seen.delete(presetId)
    const scanCount = Object.values(maps).filter(a => a.origin === 'scan').length
    // Grades concern documented visual evidence, never mechanics/calibration:
    // A: authentic color + normal + roughness scan, physical scale, usable tiles
    // B: scanned color + at least one scanned detail map
    // C: licensed procedural imagery or a sole verified scan
    // D: no verified appearance asset
    const verified = Object.values(maps)
    const grade = maps.color?.origin === 'scan' &&
      maps.normal?.origin === 'scan' && maps.roughness?.origin === 'scan' &&
      [maps.color, maps.normal, maps.roughness].every(a => a.image.tileable) ? 'A'
      : maps.color?.origin === 'scan' && scanCount >= 2 ? 'B'
      : verified.length ? 'C' : 'D'
    return { presetId, grade, maps, parentId: parent || null, authenticScans: scanCount,
      calibratedPhysics: presets[presetId]?.calibration?.status === 'measured' }
  }
  for (const id of ids) resolve(id)
  const coverage = () => {
    const grades = { A: 0, B: 0, C: 0, D: 0 }
    const gaps = []
    for (const id of ids) {
      const item = resolve(id)
      grades[item.grade]++
      const missing = FABRIC_MAP_KINDS.filter(kind => !item.maps[kind])
      if (missing.length) gaps.push({ presetId: id, grade: item.grade, missing })
    }
    return { total: ids.length, registeredAssets: byId.size, grades,
      withAssets: ids.length - grades.D, withoutAssets: grades.D, gaps }
  }
  return Object.freeze({ resolve, coverage, getAsset: id => byId.get(id) || null,
    listAssets: () => [...byId.values()] })
}
