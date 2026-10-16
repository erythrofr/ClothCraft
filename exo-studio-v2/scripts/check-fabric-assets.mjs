import assert from 'node:assert/strict'
import { readFileSync, existsSync, realpathSync } from 'node:fs'
import { resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { FABRIC_PRESETS } from '../src/data/defaultProject.js'
import { createFabricAssetRegistry, validateFabricAsset } from '../src/core/fabricAssetRegistry.js'

const fixture = (id, kind = 'color', origin = 'scan') => ({
  id, kind, origin, license: 'CC0', licensePermission: true,
  uri: `https://example.org/materials/${id}.png`, sha256: id.charCodeAt(0).toString(16).padStart(64, '0'),
  provenance: { source: 'example.org', creator: 'Fixture author',
    acquiredAt: '2026-10-16', captureMethod: 'controlled photography', generator: 'Test generator' },
  repeatMm: { widthMm: 100, heightMm: 100 },
  image: { width: 2048, height: 2048, mipLevels: 12, tileable: true },
  colorSpace: kind === 'color' ? 'sRGB' : 'linear',
  ...(kind === 'normal' ? { normalConvention: 'OpenGL' } : {}),
  tone: { exposureEV: 0, saturation: 1, gamma: 1, hueDegrees: 0 },
})
const [first, second] = Object.keys(FABRIC_PRESETS)
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = resolve(projectRoot, 'public')
function checkedLocalPath(uri, manifestPath) {
  let path
  if (uri.startsWith('asset://')) path = resolve(dirname(manifestPath), uri.slice('asset://'.length))
  else if (uri.startsWith('/assets/') || uri.startsWith('/fabric-scans/') || uri.startsWith('/fabric-scans-ambientcg/')) {
    const relative = uri.slice(1)
    if (uri.includes('\\') || relative.split('/').some(segment => segment === '.' || segment === '..' || /%2e|%2f|%5c/i.test(segment)))
      throw new Error(`Asset path escapes public root: ${uri}`)
    path = resolve(publicRoot, relative)
    const allowedRoot = resolve(publicRoot, relative.split('/')[0])
    if (!path.startsWith(allowedRoot + sep)) throw new Error(`Asset path escapes public root: ${uri}`)
    if (existsSync(path) && !realpathSync(path).startsWith(realpathSync(allowedRoot) + sep))
      throw new Error(`Asset path escapes public root via symlink: ${uri}`)
  } else if (uri.startsWith('./') || uri.startsWith('../')) path = resolve(dirname(manifestPath), uri)
  else throw new Error(`Unsupported local file URI: ${uri}`)
  return path
}
function verifyLocalAsset(asset, manifestPath) {
  const uri = asset.uri || ''
  if (/^https:\/\//.test(uri)) throw new Error(`${asset.id}: remote URI cannot be byte-verified offline; ingest an approved local copy`)
  const localPath = checkedLocalPath(uri, manifestPath)
  if (!existsSync(localPath)) throw new Error(`${asset.id}: source asset unavailable: ${uri}`)
  const actual = createHash('sha256').update(readFileSync(localPath)).digest('hex')
  if (actual !== asset.sha256?.toLowerCase()) throw new Error(`${asset.id}: local asset SHA-256 mismatch`)
}
assert.equal(Object.keys(FABRIC_PRESETS).length, 400, 'Expected full 400 preset catalog')
const empty = createFabricAssetRegistry(FABRIC_PRESETS)
assert.deepEqual(empty.coverage().grades, { A: 0, B: 0, C: 0, D: 400 })
const color = fixture('a', 'color')
const normal = fixture('b', 'normal')
const roughness = fixture('c', 'roughness')
assert.throws(() => validateFabricAsset({ ...color, license: 'unknown' }), /unlicensed/i)
assert.throws(() => validateFabricAsset({ ...color, licensePermission: false }), /permission/i)
assert.throws(() => validateFabricAsset({ ...color, uri: 'javascript:alert(1)' }), /URI/i)
assert.throws(() => validateFabricAsset({ ...color, sha256: 'abc' }), /SHA-256/i)
assert.throws(() => validateFabricAsset({ ...color, image: { ...color.image, mipLevels: 15 } }), /mipLevels/i)
assert.throws(() => validateFabricAsset({ ...color, image: { ...color.image, tileable: 'yes' } }), /tileable/i)
assert.throws(() => validateFabricAsset({ ...color, repeatMm: { widthMm: 0, heightMm: 100 } }), /repeat/i)
assert.throws(() => validateFabricAsset({ ...normal, normalConvention: undefined }), /normalConvention/)
assert.throws(() => createFabricAssetRegistry(FABRIC_PRESETS, { assets: [color, color] }), /Duplicate asset id/)
assert.throws(() => createFabricAssetRegistry(FABRIC_PRESETS, {
  assets: [color, { ...color, id: 'z', uri: 'https://example.org/z.png' }],
}), /Duplicate SHA-256/)
assert.throws(() => createFabricAssetRegistry(FABRIC_PRESETS, {
  assets: [color], assignments: { [first]: { normal: color.id } },
}), /mismatched/)
assert.throws(() => createFabricAssetRegistry(FABRIC_PRESETS, {
  assets: [color], assignments: { [first]: { color: 'not-downloaded' } },
}), /Unavailable/)
const tested = createFabricAssetRegistry(FABRIC_PRESETS, {
  assets: [color, normal, roughness],
  assignments: { [first]: { color: 'a', normal: 'b', roughness: 'c' } },
  parentSharing: { [second]: first },
})
assert.equal(tested.resolve(first).grade, 'A')
assert.equal(tested.resolve(second).grade, 'A')
assert.equal(tested.resolve(second).maps.normal.image.width, 2048)
assert.equal(tested.resolve(first).maps.color.repeatMm.widthMm, 100)
assert.equal(tested.resolve(first).maps.color.tone.gamma, 1)
assert.equal(tested.coverage().grades.A, 2)
assert.throws(() => createFabricAssetRegistry(FABRIC_PRESETS, {
  parentSharing: { [first]: second, [second]: first },
}), /Cyclic/)
assert.equal(checkedLocalPath('/fabric-scans/sample/color.jpg', resolve(projectRoot, 'fixture.json')),
  resolve(publicRoot, 'fabric-scans/sample/color.jpg'))
assert.throws(() => checkedLocalPath('/fabric-scans/../assets/x.jpg', resolve(projectRoot, 'fixture.json')), /escapes/)
assert.throws(() => checkedLocalPath('/fabric-scans/../../outside.jpg', resolve(projectRoot, 'fixture.json')), /escapes/)
assert.equal(checkedLocalPath('/fabric-scans-ambientcg/sample/color.jpg', resolve(projectRoot, 'fixture.json')),
  resolve(publicRoot, 'fabric-scans-ambientcg/sample/color.jpg'))
assert.equal(validateFabricAsset({ ...color, uri: '/fabric-scans-ambientcg/sample/color.jpg' }).uri,
  '/fabric-scans-ambientcg/sample/color.jpg')
for (const uri of ['/fabric-scans-ambientcg/../assets/x.jpg', '/fabric-scans-ambientcg/../../outside.jpg',
  '/fabric-scans-ambientcg/%2e%2e/secret.jpg', '/fabric-scans-ambientcg/..\\secret.jpg']) {
  assert.throws(() => validateFabricAsset({ ...color, uri }), /unsafe traversal|URI/i, uri)
  assert.throws(() => checkedLocalPath(uri, resolve(projectRoot, 'fixture.json')), /escapes/i, uri)
}
const ambientManifestPath = resolve(projectRoot, 'src/data/ambientcgScans.generated.json')
if (existsSync(ambientManifestPath)) {
  const imported = JSON.parse(readFileSync(ambientManifestPath, 'utf8'))
  const sources = Object.values(imported.assets || {})
  assert.equal(sources.length, 30, 'Expected 30 ambientCG source specimens')
  for (const source of sources) {
    assert.equal(source.license, 'CC0-1.0')
    assert.match(source.assetUrl, /^https:\/\/ambientcg\.com\/a\//)
    for (const kind of ['color', 'normal', 'roughness']) {
      const map = source.maps?.[kind]
      assert.ok(map?.src && map.sha256, `${source.id}: missing ${kind}`)
      const asset = {
        ...fixture(`ambientcg_${source.id}_${kind}`,kind), uri:map.src, sha256:map.sha256,
        provenance:{ source:source.assetUrl,creator:source.authors, acquiredAt:'2026-10-16',captureMethod:'photography' },
      }
      validateFabricAsset(asset)
      verifyLocalAsset(asset, ambientManifestPath)
    }
  }
}
const file = process.argv[2] ? resolve(process.argv[2]) : null
if (file && !existsSync(file)) throw new Error(`Asset manifest not found: ${file}`)
const manifest = file ? JSON.parse(readFileSync(file, 'utf8')) : {}
if (file) {
  for (const asset of manifest.assets || []) verifyLocalAsset(asset, file)
}
const registry = createFabricAssetRegistry(FABRIC_PRESETS, manifest)
const report = registry.coverage()
if (file) {
  assert.equal(report.total, 400, 'Combined manifest must resolve exactly 400 catalog presets')
  for (const presetId of Object.keys(FABRIC_PRESETS)) {
    const resolved = registry.resolve(presetId)
    assert.equal(resolved.presetId, presetId)
    for (const [kind, asset] of Object.entries(resolved.maps)) {
      assert.equal(asset.kind, kind, `Invalid mapped kind at ${presetId}`)
      assert.equal(registry.getAsset(asset.id)?.sha256, asset.sha256, `Unregistered map at ${presetId}`)
    }
  }
}
process.stdout.write(JSON.stringify({
  ...report,
  gaps: report.gaps,
  mode: file ? 'manifest' : 'no-manifest-baseline',
  note: 'Grades describe licensed appearance evidence only; physics measurements are independent.',
}, null, 2) + '\n')
