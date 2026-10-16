/**
 * EXO apparel hardware library, v1. All dimensional values are illustrative
 * starting sizes in millimetres, not manufacturer specifications or measurements
 * copied from CLO. Validate against supplier drawings before production.
 *
 * Integration: piece.buttons[] -> button presets; piece.buttonholes[] -> holes;
 * piece.zippers[] -> zipper presets. GarmentViewport currently draws buttons,
 * buttonholes, zippers and attachment markers as simplified overlay geometry.
 * Rivets, buckles and snap halves currently need a placement/editor bridge.
 * These records are asset descriptions only: they do not add fabric cuts,
 * perforation, collision, mass, fastener mechanics or zipper teeth simulation.
 * Physical claims (strength, corrosion, nickel release, wash resistance) require
 * supplier testing. PBR suggestions are artistic ranges, not scan-derived data.
 */

const pbr = (baseColor, metalness, roughness, extra = {}) =>
  Object.freeze({ baseColor, metalness, roughness, ...extra })

const entry = (id, kind, name, dimensionsMm, material, finish, appearance, construction, options = {}) =>
  Object.freeze({
    id, kind, name, dimensionsMm: Object.freeze(dimensionsMm),
    material, finish, pbr: appearance, construction,
    ...options,
    measurementStatus: 'illustrative-estimate',
  })

export const HARDWARE_PRESETS = Object.freeze({
  fourHoleShirtButton: entry('four-hole-shirt-button', 'button', 'Four-hole shirt button',
    { diameter: 11, thickness: 2, holeDiameter: 1.4, holeSpacing: 4 },
    'polyester resin', 'polished ivory', pbr('#e9e2d4', 0, 0.32),
    'Sew through four holes; check thread shank clearance for fabric thickness',
    { mount: 'sew-through', holes: 4 }),
  twoHoleButton: entry('two-hole-button', 'button', 'Two-hole workwear button',
    { diameter: 15, thickness: 2.8, holeDiameter: 1.8, holeSpacing: 6 },
    'polyester resin', 'matte charcoal', pbr('#282828', 0, 0.7),
    'Sew through two holes', { mount: 'sew-through', holes: 2 }),
  coatShankButton: entry('coat-shank-button', 'button', 'Metal coat shank button',
    { diameter: 22, frontThickness: 3, shankHeight: 4.5, eyeDiameter: 2.8 },
    'zinc alloy', 'antique brass look', pbr('#89704c', 0.85, 0.39),
    'Rear loop shank with reinforced attachment', { mount: 'shank' }),
  denimTackButton: entry('denim-tack-button', 'button', 'Jeans tack button',
    { capDiameter: 17, capHeight: 4, tackShaftDiameter: 2.5, nominalInstalledStack: 2.5 },
    'metal alloy cap and tack', 'aged copper look', pbr('#a56b40', 0.88, 0.43),
    'Two-part tack; exact shaft and grip must match supplier and waistband stack',
    { mount: 'tack' }),
  jeanFlyButton: entry('jean-fly-button', 'button', 'Small jeans fly tack',
    { capDiameter: 13, capHeight: 3, tackShaftDiameter: 2.2 },
    'metal alloy cap and tack', 'antique brass look', pbr('#9b7b48', 0.88, 0.42),
    'Press-set tack through a supported placket', { mount: 'tack' }),
  horizontalButtonhole: entry('horizontal-buttonhole', 'buttonhole', 'Woven buttonhole',
    { length: 18, stitchBorderWidth: 2.4, openingWidth: 1.5 },
    'thread and cut fabric', 'matching stitching', pbr('#303033', 0, 0.85),
    'Buttonhole length and reinforcement depend on button profile and material; opening is schematic',
    { orientationDeg: 0 }),
  keyholeButtonhole: entry('keyhole-buttonhole', 'buttonhole', 'Tailored keyhole buttonhole',
    { length: 27, stitchedWidth: 3, eyeDiameter: 5 },
    'thread and cut fabric', 'dark stitched edge', pbr('#262626', 0, 0.84),
    'Reinforced eye for shank button; cut geometry and stitches require implementation',
    { openingShape: 'keyhole' }),
  invisibleZipper: entry('invisible-zipper', 'zipper', 'Invisible dress zipper',
    { nominalChainWidth: 3, tapeWidthEachSide: 12, sliderLength: 12 },
    'nylon coil and polyester tape', 'color matched', pbr('#ded7cc', 0.05, 0.75),
    'Concealed coil; model tape, teeth, slider and stop separately',
    { zipperType: 'invisible-coil', separating: false }),
  coilZipper5: entry('coil-zipper-5', 'zipper', 'Coil zipper size 5',
    { nominalChainWidth: 5, tapeWidthEachSide: 14, sliderLength: 18, pullLength: 24 },
    'nylon coil, polyester tape and metal slider', 'black nickel look', pbr('#33363a', 0.55, 0.5),
    'Select separating or closed-end end stops to suit garment',
    { zipperType: 'coil', sizeCode: '5', separating: true }),
  metalJeanZipper4: entry('metal-jeans-zipper', 'zipper', 'Metal jeans fly zipper',
    { nominalChainWidth: 4, tapeWidthEachSide: 12, sliderLength: 16, pullLength: 20 },
    'metal teeth, polyester tape and metal slider', 'brass look', pbr('#b18a48', 0.86, 0.34),
    'Closed-end fly; zipper length, bottom stop and top stops vary with pattern',
    { zipperType: 'metal', separating: false }),
  moldedZipper8: entry('molded-zipper-8', 'zipper', 'Molded outerwear zipper',
    { nominalChainWidth: 8, tapeWidthEachSide: 16, sliderLength: 24, pullLength: 28 },
    'acetal teeth, polyester tape and metal slider', 'matte black', pbr('#17191c', 0.06, 0.74),
    'Molded individual teeth; slider stops and insertion pin depend on chosen supplier',
    { zipperType: 'molded', separating: true }),
  sewOnSnap: entry('sew-on-snap', 'snap', 'Sew-on snap fastener',
    { diameter: 12, assembledHeight: 4, sewHoleDiameter: 1.5 },
    'stainless steel', 'polished steel', pbr('#b9bec1', 0.92, 0.31),
    'Mating stud/socket sewn separately through perimeter eyelets',
    { components: ['stud', 'socket'] }),
  ringSpringSnap: entry('ring-spring-snap', 'snap', 'Ring spring press snap',
    { capDiameter: 15, assembledHeight: 6, nominalFabricStack: 2 },
    'brass alloy', 'satin nickel look', pbr('#a2a9ae', 0.85, 0.43),
    'Four-piece press set: cap, socket, stud and post; choose post length by stack',
    { components: ['cap', 'socket', 'stud', 'post'] }),
  denimCopperRivet: entry('denim-copper-rivet', 'rivet', 'Jeans pocket rivet',
    { headDiameter: 9, headHeight: 2, postDiameter: 2.2, nominalFabricStack: 2.5 },
    'copper-plated metal', 'aged copper look', pbr('#b16e3f', 0.89, 0.42),
    'Set cap and post through reinforced pocket corner; test grip and burrs',
    { components: ['cap', 'post'] }),
  flatRivet: entry('flat-rivet', 'rivet', 'Flat fashion rivet',
    { headDiameter: 7, headHeight: 1.5, postDiameter: 2 },
    'brass alloy', 'polished silver look', pbr('#bec1c6', 0.9, 0.25),
    'Decorative press rivet; verify backing and fabric reinforcement'),
  prongBuckle: entry('prong-buckle', 'buckle', 'Single-prong belt buckle',
    { innerWidth: 35, outerWidth: 43, outerHeight: 40, frameThickness: 4, pinDiameter: 3 },
    'zinc alloy', 'brushed gunmetal', pbr('#575c60', 0.82, 0.49, { anisotropy: 0.25 }),
    'Frame and pivoting prong; strap hole geometry and friction require a separate model',
    { strapNominalWidth: 35 }),
  slideAdjuster: entry('slide-adjuster', 'buckle', 'Strap tri-glide adjuster',
    { innerWidth: 25, outerWidth: 31, outerHeight: 20, barThickness: 3 },
    'steel', 'matte black coating', pbr('#292b2c', 0.78, 0.62),
    'Three-bar adjuster for folded webbing; strap path and slip load require validation',
    { strapNominalWidth: 25 }),
  dRing: entry('d-ring', 'buckle', 'D-ring',
    { innerWidth: 25, innerHeight: 24, wireDiameter: 4 },
    'welded steel', 'satin steel look', pbr('#a0a5aa', 0.88, 0.41),
    'Sewn strap loop holds ring; require collision and fabric attachment for simulation',
    { strapNominalWidth: 25 }),
})

export const HARDWARE_KINDS = Object.freeze(['button', 'buttonhole', 'zipper', 'snap', 'rivet', 'buckle'])

export function listHardwarePresets(kind) {
  const items = Object.values(HARDWARE_PRESETS)
  return kind ? items.filter(preset => preset.kind === kind) : items
}

export function getHardwarePreset(id) {
  return Object.values(HARDWARE_PRESETS).find(preset => preset.id === id) ?? null
}

/**
 * Converts supported presets to existing piece-local annotations. Coordinates
 * x/y are local pattern centimetres; returns null for hardware with no native
 * annotation type. This does not mutate a garment piece or add fastener physics.
 */
export function hardwareToPatternAnnotation(id, { x = 0, y = 0, annotationId = id } = {}) {
  const preset = getHardwarePreset(id)
  if (!preset) return null
  if (preset.kind === 'button') return {
    id: annotationId, x, y, diameterCm: preset.dimensionsMm.diameter
      ? preset.dimensionsMm.diameter / 10 : preset.dimensionsMm.capDiameter / 10,
    color: preset.pbr.baseColor, hardwarePresetId: id,
  }
  if (preset.kind === 'buttonhole') return {
    id: annotationId, x, y, lengthCm: preset.dimensionsMm.length / 10,
    widthCm: (preset.dimensionsMm.openingWidth ?? preset.dimensionsMm.stitchedWidth) / 10,
    orientationDeg: preset.orientationDeg ?? 0, color: preset.pbr.baseColor,
    hardwarePresetId: id,
  }
  return null
}
