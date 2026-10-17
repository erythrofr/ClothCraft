import { FABRIC_PRESETS } from '../data/defaultProject.js'

// The existing preset catalog owns the scans and numerical authoring defaults.
// This presentation layer does not assign laboratory calibration to those numbers.
const EXAMPLES = Object.freeze([
  { id: 'black-french-terry-hoodie', presetId: 'fleece', family: 'french-terry', construction: 'loop-back knitted French terry', use: 'black heavyweight hoodie', visualMatch: 'construction-reference', note: 'The terry scan is a reference texture; garment color is tinted to the preset black.' },
  { id: 'raw-indigo-denim', presetId: 'rawDenim', family: 'raw-denim', construction: 'indigo warp-faced woven denim twill', use: 'rigid raw denim pants', visualMatch: 'construction-reference', note: 'Denim reference scan; indigo shade and unsanforized behavior are illustrative.' },
  { id: 'ribbed-cotton', presetId: 'ribKnit', family: 'rib-cotton', construction: 'stretch rib cotton knit', use: 'ribbed cuffs and neckline', visualMatch: 'proxy', note: 'Jersey melange is a knit surface proxy, not a verified rib-knit scan.' },
  { id: 'washed-garment-leather', presetId: 'softLeather', family: 'washed-leather', construction: 'soft leather hide with an illustrative washed finish', use: 'washed leather jacket', visualMatch: 'proxy', note: 'Leather scan supports grain only; no scanned or measured wash treatment is represented.' },
  { id: 'nylon-ripstop', presetId: 'nylonRipstop', family: 'nylon', construction: 'lightweight woven ripstop nylon', use: 'technical nylon shell', visualMatch: 'proxy', note: 'Fabric046 is a licensed woven appearance reference; actual nylon composition and ripstop construction are unverified.' },
])

const mapKeys = Object.freeze({ color: 'src', normal: 'normalSrc', roughness: 'roughnessSrc' })

export function createFabricRealismShowcase(presets = FABRIC_PRESETS) {
  return EXAMPLES.map(example => {
    const preset = presets[example.presetId]
    if (!preset?.texture) throw new Error(`Missing showcase preset scan: ${example.presetId}`)
    const texture = preset.texture
    const maps = Object.fromEntries(Object.entries(mapKeys).map(([kind, key]) => [kind, {
      uri: texture[key], colorSpace: kind === 'color' ? 'sRGB' : 'linear',
      origin: 'scan', license: texture.license,
    }]))
    const repeatCm = Object.freeze({ width: texture.repeatWidthCm, height: texture.repeatHeightCm })
    return Object.freeze({
      ...example,
      name: preset.name,
      color: preset.color,
      material: Object.freeze({
        color: preset.color, roughness: preset.roughness, metalness: preset.metalness,
        sheen: preset.sheen, sheenRoughness: preset.sheenRoughness,
        normalStrength: preset.normalStrength, fiberAnisotropy: preset.fiberAnisotropy,
        maps: Object.freeze(maps),
        repeatCm, rotationDeg: texture.rotationDeg ?? 0,
      }),
      texture: Object.freeze({
        scanAssetId: texture.scanAssetId, provider: texture.scanSource,
        sourceUrl: texture.originalSourceUrl, license: texture.license,
        match: example.visualMatch, repeatCm,
        scaleStatus: texture.physicalScaleStatus,
        originalPhotoColor: texture.originalPhotoColor === true,
        mapUris: Object.freeze(Object.fromEntries(Object.entries(maps).map(([kind, value]) => [kind, value.uri]))),
      }),
      physics: Object.freeze({
        status: 'estimated', source: 'EXO preset authoring defaults; no sample laboratory measurements',
        gsm: preset.gsm, thicknessMeters: preset.thickness,
        stretchWarp: preset.stretchWarp, stretchWeft: preset.stretchWeft,
        bend: preset.bend, damping: preset.damping, friction: preset.friction,
      }),
    })
  })
}

export const FABRIC_REALISM_SHOWCASE = Object.freeze(createFabricRealismShowcase())
export const getFabricRealismShowcase = id => FABRIC_REALISM_SHOWCASE.find(entry => entry.id === id || entry.presetId === id) ?? null

// Simple flat props usable by both a React preview and static community cards.
export function fabricRealismPreviewProps(id) {
  const item = getFabricRealismShowcase(id)
  if (!item) return null
  return {
    id: item.id, title: item.name, subtitle: item.use,
    color: item.material.color, maps: item.material.maps,
    repeatCm: item.material.repeatCm, roughness: item.material.roughness,
    metalness: item.material.metalness, normalStrength: item.material.normalStrength,
    sourceUrl: item.texture.sourceUrl, license: item.texture.license,
    visualMatch: item.visualMatch, physicsStatus: item.physics.status,
  }
}
