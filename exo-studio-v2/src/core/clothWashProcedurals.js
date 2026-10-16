/** Pure, seamless, non-destructive digital wash appearance approximations.
 * These masks represent visual styling, not chemical treatment or fiber physics.
 * RGB values use normalized linear or display-domain channels consistently with
 * the caller; this module does not perform color-space conversion.
 */
const TAU = 2 * Math.PI
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))
const finite = (x, fallback) => Number.isFinite(Number(x)) ? Number(x) : fallback
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const hash = (a, b, seed) => { const n = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453123; return n - Math.floor(n) }

export const WASH_EFFECTS = Object.freeze({
  raw: {label: 'Raw / no wash', category: 'base', visualOnly: true},
  rinse: {label: 'Rinse', category: 'overall', visualOnly: true},
  enzyme: {label: 'Enzyme look', category: 'overall', visualOnly: true},
  stone: {label: 'Stone wash look', category: 'mottled', visualOnly: true},
  acid: {label: 'Acid / marble wash look', category: 'mottled', visualOnly: true},
  bleach: {label: 'Bleached look', category: 'mottled', visualOnly: true},
  ozone: {label: 'Ozone fade look', category: 'overall', visualOnly: true},
  'garment-dye': {label: 'Garment dyed look', category: 'pigment', visualOnly: true},
  vintage: {label: 'Vintage fade', category: 'overall', visualOnly: true},
  pigment: {label: 'Pigment dyed look', category: 'pigment', visualOnly: true},
  pp: {label: 'PP-inspired localized fade', category: 'localized', visualOnly: true},
  whiskers: {label: 'Whisker fade lines', category: 'localized', visualOnly: true},
  abrasion: {label: 'Surface abrasion look', category: 'localized', visualOnly: true},
  'faded-seams': {label: 'Faded seams', category: 'edge', visualOnly: true},
  'tie-dye': {label: 'Tie dye', category: 'pattern', visualOnly: true},
  distress: {label: 'Distressed surface look', category: 'localized', visualOnly: true},
})

const ALIASES = {none: 'raw', unwashed: 'raw', marble: 'acid', 'acid-marble': 'acid', 'stone-wash': 'stone', 'enzyme-wash': 'enzyme', 'potassium-permanganate': 'pp', potassium: 'pp', 'pp-spray': 'pp', 'tie dye': 'tie-dye', 'garment dye': 'garment-dye', 'faded seams': 'faded-seams'}
const BLENDS = new Set(['overlay', 'soft-light', 'screen', 'multiply'])

/** Serialized, user-editable wash settings. Rotation in degrees. */
export function normalizeWashSpec(input = {}) {
  const spec = typeof input === 'string' ? {type: input} : input && typeof input === 'object' ? input : {}
  const rawType = String(spec.type ?? spec.effect ?? 'raw').toLowerCase().trim()
  const type = ALIASES[rawType] ?? rawType
  const place = spec.placement && typeof spec.placement === 'object' ? spec.placement : {}
  return {
    type: Object.hasOwn(WASH_EFFECTS, type) ? type : 'raw',
    strength: clamp(finite(spec.strength, 1)),
    scale: clamp(finite(spec.scale, 1), .1, 32),
    placement: {x: clamp(finite(place.x ?? spec.x, .5)), y: clamp(finite(place.y ?? spec.y, .5))},
    rotation: clamp(finite(spec.rotation, 0), -3600, 3600),
    seed: Math.trunc(clamp(finite(spec.seed, 0), -1000000, 1000000)),
    // Visual-only appearance controls. Zero and overlay preserve legacy output.
    absorbency: clamp(finite(spec.absorbency, 0)),
    cycleDuration: clamp(finite(spec.cycleDuration, 0)),
    seamAbrasion: clamp(finite(spec.seamAbrasion, 0)),
    blend: BLENDS.has(spec.blend) ? spec.blend : 'overlay',
  }
}

// Periodic Fourier noise with integer wavevectors: same sample on opposite tile
// edges, including with arbitrary orientation, placement and fractional scale.
function noise(u, v, seed, scale = 1) {
  let sum = 0, weightSum = 0
  for (let i = 0; i < 5; i++) {
    const frequency = [1, 2, 4, 8, 16][i]
    const a = 1 + Math.round(scale * frequency)
    const b = 1 + Math.round(scale * frequency * 1.4)
    const weight = 1 / (1 + i * .68)
    const phase = hash(i + 1, 2, seed) * TAU
    const phase2 = hash(i + 5, 9, seed) * TAU
    const wave = .5 * Math.sin(TAU * (a * u + b * v) + phase) + .5 * Math.cos(TAU * (b * u - a * v) + phase2)
    sum += wave * weight
    weightSum += weight
  }
  return clamp(.5 + .5 * sum / weightSum)
}

function channels(u, v, s) {
  u = finite(u, 0)
  v = finite(v, 0)
  const x = finite(u, 0) - s.placement.x
  const y = finite(v, 0) - s.placement.y
  const a = s.rotation * Math.PI / 180
  // Torus coordinates preserve wrapping regardless of rotation.
  const cx = Math.sin(TAU * x), cy = Math.sin(TAU * y)
  const px = cx * Math.cos(a) + cy * Math.sin(a)
  const py = cy * Math.cos(a) - cx * Math.sin(a)
  const n = noise(u, v, s.seed, s.scale)
  const fine = noise(u, v, s.seed + 109, s.scale * 3)
  const broad = noise(u, v, s.seed + 37, s.scale * .3)
  const radial = Math.hypot(px, py)
  return {px, py, n, fine, broad, radial}
}

/** RGB multipliers [r,g,b], ordinarily 0..1.5, stable at tile boundaries. */
export function washRgbMultiplier(u, v, spec = {}) {
  const s = normalizeWashSpec(spec)
  if (s.type === 'raw' || s.strength === 0) return [1, 1, 1]
  const {px, py, n, fine, broad, radial} = channels(u, v, s)
  const spot = 1 - smooth(.2, 1.4, radial * Math.sqrt(s.scale) / (1 + .55 * s.cycleDuration))
  const mottled = smooth(.39, .74, n * .7 + fine * .3)
  const seam = Math.pow(1 - Math.abs(Math.sin(TAU * finite(u, 0))), 11) + Math.pow(1 - Math.abs(Math.sin(TAU * finite(v, 0))), 11)
  let light = 0, warmth = 0, coolness = 0
  switch (s.type) {
    case 'rinse': light = .045 + .025 * n; break
    case 'enzyme': light = .08 + .11 * fine; break
    case 'stone': light = .07 + .3 * mottled + .06 * broad; break
    case 'acid': light = .08 + .62 * smooth(.51, .63, n * .8 + fine * .2); break
    case 'bleach': light = .22 + .46 * smooth(.3, .76, broad * .6 + n * .4); warmth = .025; break
    case 'ozone': light = .16 + .12 * broad; coolness = .045; break
    case 'garment-dye': light = -.19 + .11 * fine; warmth = .085; break
    case 'vintage': light = .15 + .23 * broad; warmth = .12; break
    case 'pigment': light = -.11 + .25 * fine; warmth = .14; break
    case 'pp': light = .79 * spot * (.55 + .45 * fine); warmth = .04 * spot; break
    case 'whiskers': {
      const line = Math.abs(Math.sin((py * 11 + px * px * 2.5) * s.scale + n * 1.2))
      light = .57 * spot * (1 - smooth(.1, .28, line))
      break
    }
    case 'abrasion': light = .56 * spot * smooth(.4, .74, fine); break
    case 'faded-seams': light = .65 * clamp(seam) * (.65 + .35 * fine); break
    case 'tie-dye': {
      const rings = Math.sin(17 * radial * s.scale + 8 * n)
      light = .12 + .65 * smooth(-.4, .65, rings)
      coolness = .16 * (1 - smooth(-.4, .65, rings))
      break
    }
    case 'distress': light = .83 * spot * smooth(.61, .79, fine) * smooth(.4, .7, n); break
    default: return [1, 1, 1]
  }
  // Fade increases reflectance; dark overdye reduces it. Gently tint select looks.
  const intensity = s.strength * (1 + .4 * s.absorbency + .35 * s.cycleDuration)
  // Continuous periodic edge distance; strongest at U/V = 0/1, negligible
  // beyond the first 8% of each tile. Do not imply real seam placement.
  const edgeDistance = (coordinate) => {
    const t = ((finite(coordinate, 0) % 1) + 1) % 1
    return Math.min(t, 1 - t)
  }
  const edge = 1 - smooth(0, .08, Math.min(edgeDistance(u), edgeDistance(v)))
  const edgeLift = s.seamAbrasion * s.strength * .48 * edge
  const gain = clamp(1 + intensity * light, .3, 1.5)
  const base = [gain + intensity * warmth, gain + intensity * (warmth * .26 + coolness * .2), gain + intensity * coolness]
  return base.map(value => {
    const delta = value - 1
    // Overlay = legacy arithmetic. Other modes map the visual pigment delta,
    // preserving the neutral point and keeping each channel safely bounded.
    let adjusted = delta
    if (s.blend === 'soft-light') adjusted *= .72
    else if (s.blend === 'screen') adjusted *= delta >= 0 ? 1.22 : .56
    else if (s.blend === 'multiply') adjusted *= delta >= 0 ? .55 : 1.3
    return clamp(1 + adjusted + edgeLift, .25, 1.5)
  })
}

/** Sample a non-destructive effect over an unchanged normalized base RGB color. */
export function sampleWashColor(baseRgb, u, v, spec = {}) {
  const rgb = Array.isArray(baseRgb) ? baseRgb : [baseRgb?.r, baseRgb?.g, baseRgb?.b]
  const multiplier = washRgbMultiplier(u, v, spec)
  return [0, 1, 2].map(i => clamp(finite(rgb[i], 0) * multiplier[i]))
}
