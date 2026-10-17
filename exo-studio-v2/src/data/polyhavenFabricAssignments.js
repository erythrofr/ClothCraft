/**
 * Manually curated visual reference scan matching for the 80 fixed EXO
 * construction archetypes. Scans are PHOTOGRAPHIC VISUAL REFERENCES only.
 * Matching a textile-family normal/roughness map is NOT a measured or exact
 * material certificate. Never imply a cotton canvas scan measures hemp or wool.
 *
 * null explicitly means a true suitable scan was not sourced: keep original
 * structure-specific procedural yarn maps rather than apply a false photo.
 *
 * Every child __fine/__dense/__softened/__crisp inherits its base visual scan.
 */
export const POLYHAVEN_ARCHETYPE_SCAN_IDS = Object.freeze({
 jersey:'cotton_jersey',
 fleece:'terry_cloth',
 denim:'denim_fabric_06',
 silk:'crepe_satin',
 interfacing:'stretch_poplin',
 cottonPoplin:'stretch_poplin',
 cottonCanvas:'hessian_380',
 woolSuiting:'poly_wool_herringbone',
 woolMelton:'caban',
 softLeather:'brown_leather',
 suede:'scuba_suede',
 lightNylon:'terlenka',
 nylonRipstop:null,
 linen:'rough_linen',
 silkSatin:'crepe_satin',
 ribKnit:'jersey_melange',
 stretchDenim:'denim_fabric_03',
 velvet:'velour_velvet',
 silkChiffon:'crepe_georgette',
 silkOrganza:'crepe_georgette',
 cottonCorduroy:'ribbed_corduroy',
 scubaKnit:'bi_stretch',
 technicalSoftshell:'bi_stretch',
 cottonLightJersey:'cotton_jersey',
 cottonHeavyJersey:'cotton_jersey',
 cottonInterlock:'jersey_melange',
 cottonPique:'waffle_pique_cotton',
 waffleKnit:'waffle_pique_cotton',
 cottonRib1x1:'jersey_melange',
 cottonRib2x2:'jersey_melange',
 frenchTerryMid:'terry_cloth',
 frenchTerryHeavy:'terry_cloth',
 brushedFleece:'jogging_melange',
 polarFleece:'polar_fleece',
 sherpa:'curly_teddy_natural',
 cottonFlannel:'caban',
 cottonOxford:'stretch_poplin',
 cottonBroadcloth:'stretch_poplin',
 cottonChambray:'stretch_poplin',
 cottonTwill:'poly_wool_herringbone',
 cottonDuck:'hessian_380',
 waxedCanvas:'hessian_380',
 linenShirting:'rough_linen',
 linenHeavy:'rough_linen',
 hempCanvas:'hessian_380',
 rawDenim:'denim_fabric_06',
 lightDenim:'denim_fabric_04',
 heavyDenim:'denim_fabric_05',
 denimCottonElastane:'denim_fabric_03',
 woolFlannel:'caban',
 woolGabardine:'poly_wool_herringbone',
 woolTweed:'poly_wool_herringbone',
 boucle:'wool_boucle',
 cashmereKnit:'knitted_fleece',
 viscoseChallis:'stretch_poplin',
 tencelTwill:'poly_wool_herringbone',
 rayonCrepe:'crepe_georgette',
 silkCharmeuse:'crepe_satin',
 silkGeorgette:'crepe_georgette',
 polySatin:'crepe_satin',
 polyTaffeta:'terlenka',
 polyMesh:null,
 powerMesh:null,
 spandexTricot:'bi_stretch',
 neoprene:null,
 shellNylon:'terlenka',
 ripstopUltralight:null,
 polyTulle:null,
 veganLeather:'fabric_leather_01',
 lambskin:'fabric_leather_02',
 nappaLeather:'fabric_leather_02',
 pebbledLeather:'brown_leather',
 vegetableLeather:'brown_leather',
 patentLeather:'leather_white',
 nubuck:'scuba_suede',
 suedeLambskin:'scuba_suede',
 fauxSuede:'scuba_suede',
 velour:'velour_velvet',
 fauxFur:'curly_teddy_natural',
 quiltedNylon:null,
})

// Accurate terminology for UI: matching labels explicitly distinguish a
// same-construction reference from e.g. wool fabric used as visual cotton
// twill surrogate. Shared scanned images are NEVER 400 independent scans.
export const SCAN_CONSTRUCTION_PROXY_IDS = Object.freeze(new Set([
 'silk','interfacing','cottonCanvas','suede','lightNylon','silkChiffon',
 'silkOrganza','scubaKnit','technicalSoftshell','cottonRib1x1',
 'cottonRib2x2','cottonFlannel','cottonOxford','cottonChambray',
 'cottonTwill','cottonDuck','waxedCanvas','hempCanvas','woolGabardine',
 'woolTweed','cashmereKnit','viscoseChallis','tencelTwill',
 'polyTaffeta','spandexTricot','shellNylon','veganLeather',
 'lambskin','nappaLeather','vegetableLeather','patentLeather',
 'nubuck','suedeLambskin','fauxSuede',
]))

// Additional CC0 reference photos actually inspected from ambientCG's 1K PBR
// images. Only map a construction when its photographed structure is relevant.
// 1K assets have their OWN provenance, NOT Poly Haven provenance, and many do
// not declare physical scan size (these are flagged as scale-unknown).
export const AMBIENTCG_ARCHETYPE_SCAN_OVERRIDES=Object.freeze({
  nylonRipstop:'Fabric046',        // visible reinforcement grid
  ripstopUltralight:'Fabric047',   // lighter reinforcement grid
  quiltedNylon:'Fabric048',       // quilt grid polyester surface proxy
  neoprene:'Fabric082A',          // smooth synthetic textile visual proxy
  technicalSoftshell:'Fabric049', // gridded coated/technical shell proxy
  shellNylon:'Fabric048',         // smooth light coated textile proxy
  cottonCanvas:'Fabric062',      // coarse plain-woven canvas reference
  cottonDuck:'Fabric066',        // rougher strong weave
  cottonOxford:'Fabric061',      // small yarn crossings
  cottonTwill:'Fabric077',       // fine diagonal cotton twill / denim proxy
  cottonFlannel:'Fabric034',     // wool-like felt/lofty proxy for brushed pile
  woolMelton:'Fabric034',        // felted wool structure
  woolFlannel:'Fabric034',       // wool/felted woven structure
  linenHeavy:'Fabric066',        // rough plain weave
  polyTaffeta:'Fabric082A',      // fine smooth synthetic
  lightDenim:'Fabric077',        // blue jean diagonal weave
  denimCottonElastane:'Fabric069', // denim twill, stretch still estimated
  pebbledLeather:'Leather037',   // leather grain
  vegetableLeather:'Leather023', // brown leather, tanning chemistry NOT proven
  lambskin:'Leather038',         // smooth leather reference, skin origin unknown
  nappaLeather:'Leather026',     // smooth fine leather, temper not measured
  patentLeather:'Leather024',    // glossy/red smooth leather proxy
  nubuck:'Leather039',           // visually suede-like grain, nap not measured
  suedeLambskin:'Leather039',    // suede-like nap, species not verified
  suede:'Leather039',            // suede-like visual reference
  fauxSuede:'Leather039',        // natural-to-synthetic optical proxy only
  waxedCanvas:'Fabric062',      // actual wax finish not established
  woolTweed:'Fabric085',        // coarse wool photo (different yarns)
  polarFleece:'Fabric084',       // photographed brushed, soft microfiber
  // Distinct photographed constructions reduce repeated stock imagery
  // without mislabeling photographic references as measured cloth.
  softLeather:'Leather028',      // different fine-grain leather reference
  cottonBroadcloth:'Fabric036', // plain smooth shirting weave reference
  cottonChambray:'Fabric081A',  // blue finely woven cloth, chambray proxy
  lightNylon:'Fabric070',       // sportswear cloth, synthetic shell proxy
  viscoseChallis:'Fabric036',   // smooth woven surrogate, not tested viscose
})

export const AMBIENTCG_CONSTRUCTION_PROXY_IDS=Object.freeze(new Set([
  'quiltedNylon','neoprene','technicalSoftshell','shellNylon',
  'cottonTwill','cottonFlannel','denimCottonElastane','vegetableLeather',
  'lambskin','nappaLeather','patentLeather','nubuck','suedeLambskin',
  'fauxSuede','waxedCanvas','woolTweed','polarFleece',
  'cottonChambray','lightNylon','viscoseChallis',
]))
