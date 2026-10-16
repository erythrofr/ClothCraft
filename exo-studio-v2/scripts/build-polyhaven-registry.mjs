import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { validateFabricAsset } from '../src/core/fabricAssetRegistry.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const input = resolve(root, process.argv[2] || 'src/data/polyhavenScans.generated.json')
const output = resolve(root, process.argv[3] || 'src/data/polyhavenVerifiedRegistry.generated.json')
const requireString = (v, name) => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Missing ${name}`)
  return v
}
const validHash = value => /^[a-f\d]{64}$/i.test(value || '')
const physicalSize = (v, label) => {
  if (!Number.isFinite(v) || v <= 0) throw new Error(`Invalid ${label}: physical scan repeat must be measured or documented`)
  return v * 10
}
const safeSrc = (src, id, kind) => {
  if (typeof src !== 'string' || !/^\/fabric-scans\/[A-Za-z0-9_./-]+$/.test(src) || src.split('/').includes('..'))
    throw new Error(`${id}.${kind}: unsafe /fabric-scans/ URL: ${src}`)
  return src
}
const source = existsSync(input) ? JSON.parse(readFileSync(input, 'utf8')) : null
if (!source) {
  console.error(`No Poly Haven source manifest yet: ${input}; output not replaced.`)
  process.exitCode = 2
} else {
  if (!source.assets || typeof source.assets !== 'object' || Array.isArray(source.assets)) throw new Error('Expected source.assets keyed by Poly Haven ID')
  const assets = []
  const report = { totalSources: Object.keys(source.assets).length, verifiedSources: 0, acceptedMaps: 0, rejectedSources: [] }
  for (const [sourceId, record] of Object.entries(source.assets)) {
    try {
      if (!/^[a-z\d][a-z\d_-]*$/i.test(sourceId)) throw new Error('Invalid source ID')
      if (record.id !== sourceId) throw new Error('Source ID mismatch')
      if (record.license !== 'CC0-1.0') throw new Error(`Unexpected license: ${record.license}`)
      const url = requireString(record.assetUrl, 'assetUrl')
      if (!/^https:\/\/polyhaven\.com\/a\/[\w-]+\/?$/.test(url)) throw new Error('Unverified Poly Haven asset URL')
      const name = requireString(record.name, 'name')
      const author = Array.isArray(record.authors) ? record.authors.filter(a => typeof a === 'string' && a.trim()).join(', ') :
        record.authors && typeof record.authors === 'object' ? Object.entries(record.authors).map(([person, role]) => `${person} (${role})`).join(', ') :
        typeof record.authors === 'string' ? record.authors.trim() : ''
      if (!author) throw new Error('Missing Poly Haven creator')
      const widthMm = physicalSize(record.scanWidthCm, 'scanWidthCm')
      const heightMm = physicalSize(record.scanHeightCm, 'scanHeightCm')
      const outputMaps = []
      for (const kind of ['color', 'normal', 'roughness']) {
        const map = record.maps?.[kind]
        if (!map || !validHash(map.sha256) || map.resolution !== '1k') throw new Error(`Invalid ${kind} map metadata`)
        const uri = safeSrc(map.src, sourceId, kind)
        const local = resolve(root, 'public', uri.slice(1))
        if (!local.startsWith(join(root, 'public', 'fabric-scans') + '/') || !existsSync(local))
          throw new Error(`${kind}: local file missing`)
        const actual = createHash('sha256').update(readFileSync(local)).digest('hex')
        if (actual !== map.sha256.toLowerCase()) throw new Error(`${kind}: SHA-256 mismatch`)
        const candidate = {
          id: `polyhaven_${sourceId}_${kind}`, kind, origin: 'scan', license: 'CC0',
          licensePermission: true, uri, sha256: actual,
          provenance: { source: url, creator: author, acquiredAt: '2026-10-16',
            captureMethod: 'photography', name, sourceLicense: record.license },
          repeatMm: { widthMm, heightMm },
          image: { width: 1024, height: 1024, mipLevels: 1, tileable: true },
          colorSpace: kind === 'color' ? 'sRGB' : 'linear',
          ...(kind === 'normal' ? { normalConvention: 'OpenGL' } : {}),
        }
        outputMaps.push(validateFabricAsset(candidate))
      }
      assets.push(...outputMaps)
      report.verifiedSources++
      report.acceptedMaps += outputMaps.length
    } catch (error) {
      report.rejectedSources.push({ id: sourceId, reason: String(error.message) })
    }
  }
  const hashes = new Set()
  for (const asset of assets) {
    if (hashes.has(asset.sha256)) throw new Error(`Duplicate map bytes: ${asset.id}`)
    hashes.add(asset.sha256)
  }
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, JSON.stringify({ assets, assignments: {}, parentSharing: {} }, null, 2) + '\n')
  console.log(JSON.stringify({ input, output, ...report,
    note: 'Verified photographic visual maps; no measured fabric physics claims.' }, null, 2))
}
