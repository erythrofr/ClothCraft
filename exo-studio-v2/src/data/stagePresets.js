/**
 * Original procedural interpretations of publicly indexed CLO CONNECT listings.
 * The listing thumbnails/models were unavailable for inspection; these are
 * design cues, not reproductions or downloadable CONNECT assets.
 */
const ROOT = 'https://connect.clo-set.com'
const records = [
  ['R01','runway','Kev-in-Design scene 31','9cd729d4e27746daa268b793ba52ffe0','Circular runway, radial luminaire arrays','circular','#9ca3b2'],
  ['R02','runway','Mountain runway','28aad02e57414a63a27d0aa8545c901c','Mountain forms, misty horizon and raised catwalk','mountain','#82939b'],
  ['R03','runway','Side Molding Mirror Stage','c4b283e416ed462ca376fc135b17c736','Symmetrical molding and reflective panels','mirror','#d9d3cc'],
  ['R04','runway','Silver line Detail Stage','485e3b1c60ed45b292abdaeb27d21e9e','Long illuminated catwalk with metallic trim','linear','#a7adb7'],
  ['R05','runway','Free runway stage','fb6d66aa35f54fd69069f987a7499813','Original modular runway concept; original asset image uninspected','modular','#c5c0b6'],
  ['S01','studio','Studio scene design','500cae37e1e5483c82625c81c1524204','Natural styling, plants, seamless backdrops','botanical','#cfc9ba'],
  ['S02','studio','Pink studio scene','afbb89eb727f4d7c993c026a9a50b7ac','Pink cyclorama and diffusion boards','cyclorama','#e5a6bc'],
  ['S03','studio','Fashion Studio Scene for CLO 3D Rendering','48ae4f2b32c14094af83003622238567','Neutral sweep with banks of light','cyclorama','#d9d4cc'],
  ['S04','studio','Luxury Black Marble Scene','f18e360bd59344e0adf1323d1a00ba11','Black stone, gilded framing and showroom plinths','marble','#292d32'],
  ['S05','studio','Stage-HHT-12','c4b62fa6a98b47109950b1686c23ddf3','Raised circular stage and adjustable fixtures','podium','#8e9298'],
  ['S06','studio','Stage-HHT-11','ae79d5c7b1f84664bf60118f656e3b5e','Two-tone photographic stage with textile drops','duotone','#d2d0cc'],
  ['S07','studio','Backdrop stage scene','1e420605d8a74cd3831e2f364966fb4c','Architectural relief and dramatic rim lighting','architectural','#91849b'],
  ['S08','studio','KW 05 STUDIO','ab482daffe4841239ca3832e25230b6f','Modular minimal platform and standing panels','modular','#a3a8a5'],
  ['S09','studio','scene- romantic wedding stage','18cc8e5802394463bf1c7df820ac5ee7','Floral arch and warm practical lighting','floral','#e4c7b9'],
  ['S10','studio','Entrance gate scene','bd89936f4775407abb3fc6cb648eea90','Landscaped gate, planters and water feature','garden','#8c9e8d'],
  ['S11','studio','Stage-HHT-17','f7555fc1652e407c883fa1e159deb61f','Lightweight pose platform and markers','podium','#c1b4a6'],
  ['S12','studio','SLBS DARK GREEN','8f305583f33e4b33a7820d5cff2c96dc','Dark forest-green curved backdrop','cyclorama','#203f36'],
  ['S13','studio','Mirror metall room Type scene','4065a352d5aa4e2d81b16291dd27a0d7','Staggered brushed metal reflectors','mirror','#a0a6aa'],
  ['S14','studio','Industrial Stage','a37277da3c6c4d28be123f4ba77bbd9a','Concrete deck, structural trusses and factory walls','industrial','#666d70'],
  ['S15','studio','Infinite Mirrors room Scene for Kpop mirror','2ac1db9f602e497b854bb627f7f319d8','Repeated reflective portal frames and dark metal','tunnel','#6c737b'],
]
const overrideUrl = {
  R05: `${ROOT}/zh/detail/fb6d66aa35f54fd69069f987a7499813`,
  S14: `${ROOT}/ko/detail/a37277da3c6c4d28be123f4ba77bbd9a`,
}
export const STAGE_PRESETS = Object.freeze(records.map(([id,kind,name,slug,description,archetype,baseColor]) => Object.freeze({
  id, name, kind, description, archetype,
  sceneHints: Object.freeze([description, archetype]),
  referenceUrl: overrideUrl[id] || `${ROOT}/detail/${slug}`,
  palette: Object.freeze({ base: baseColor }),
  sceneFile: `/stage-scenes/${id}.glb`,
  sourceStatus: 'EXO-owned Blender room geometry; original interpretation of public listing',
})))
export const listStagePresets = (kind) => kind ? STAGE_PRESETS.filter(p => p.kind === kind) : [...STAGE_PRESETS]
export const getStagePreset = (id) => STAGE_PRESETS.find(p => p.id === id) ?? null
