// Bounded garment optical controls, distinct from the XPBD/PPF mechanical
// material. Visual plausibility does NOT imply lab-measured textile physics.
const clamp = (value, minimum, maximum, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(minimum, Math.min(maximum, n)) : fallback
}

export function normalizeFabricOptics(fabric = {}) {
  return {
    opacity: clamp(fabric.opacity, .05, 1, 1),
    // Vertex displacement is an optical finish only. It is not collision
    // geometry and cannot substitute for measured textile thickness.
    displacementMm: clamp(fabric.displacementMm, 0, 2, 0),
    roughness: clamp(fabric.roughness, .04, 1, .82),
    metalness: clamp(fabric.metalness, 0, 1, 0),
    sheen: clamp(fabric.sheen, 0, 1, .22),
    sheenRoughness: clamp(fabric.sheenRoughness, .04, 1, .84),
    normalStrength: clamp(fabric.normalStrength, 0, 4, 1),
    anisotropy: clamp(fabric.fiberAnisotropy, 0, 1, .16),
    anisotropyRotation: clamp(fabric.fiberAngleDeg, -180, 180, 0) * Math.PI / 180,
    clearcoat: clamp(fabric.clearcoat, 0, 1, 0),
    clearcoatRoughness: clamp(fabric.clearcoatRoughness, .04, 1, .45),
    colorVariation: clamp(fabric.colorVariation, 0, 1, .25),
    weaveScaleCm: clamp(fabric.weaveScaleCm, .3, 10, 3),
  }
}

// A periodic neutral albedo multiplier lets individual yarns catch light
// without baking a new tint into the user's chosen fabric color. Used as an
// sRGB canvas map that multiplies MeshPhysicalMaterial.color, not as a raw
// hex color replacement.
export function textileAlbedoMultiplier(family, u, v, variation = .25) {
  const amount = Math.max(0, Math.min(1, Number(variation) || 0))
  const waves = family === 'twill'
    ? .5 * Math.cos(2 * Math.PI * (28 * u + 10 * v))
    : family === 'rib-knit'
      ? .65 * Math.cos(2 * Math.PI * 15 * u)
      : family === 'leather' || family === 'suede'
        ? .25 * Math.cos(2 * Math.PI * (7 * u + 13 * v))
        : .3 * Math.cos(2 * Math.PI * 28 * u) + .3 * Math.cos(2 * Math.PI * 31 * v)
  return Math.max(.82, Math.min(1, 1 - amount * (.07 + .04 * waves)))
}
