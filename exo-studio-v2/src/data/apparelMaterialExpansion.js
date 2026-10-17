// Open, editable apparel material *starting points*, not copied CLO/ZFAB
// assets or calibrated instrument readings. The host React cloth solver uses
// normalized bend/stretch controls; its numbers are NOT Young's modulus.
// Ranges here describe particular example constructions, not fibre constants.
//
// Each row: [id, name, template, color, gsm, warp%, weft%, bend, thickness mm,
//            roughness, sheen, visual structure, notes]
// Warp/weft are estimated reference load extensions. They are not material
// limits and cannot be converted to true tensile stiffness without test force.
const rows = [
 ['cottonLightJersey','Light Cotton Jersey','jersey','#e2ded7',160,11,19,.58,1.05,.83,.23,'jersey-knit','single jersey T-shirt'],
 ['cottonHeavyJersey','Heavyweight Cotton Jersey','jersey','#3f4547',285,8,15,.75,1.7,.89,.15,'jersey-knit','heavy compact jersey'],
 ['cottonInterlock','Cotton Interlock','jersey','#d4c9b7',235,14,22,.65,1.8,.86,.21,'jersey-knit','double knit'],
 ['cottonPique','Cotton Piqué','jersey','#ccbea9',225,8,14,.73,1.65,.88,.19,'plain-weave','knit piqué approximation'],
 ['waffleKnit','Cotton Waffle Knit','jersey','#c4b7a5',290,16,29,.66,2.5,.91,.13,'waffle-knit','thermal cellular knit'],
 ['cottonRib1x1','Cotton 1×1 Rib','ribKnit','#b4b1a9',245,20,40,.58,1.65,.86,.20,'rib-knit','elastic cuff and collar'],
 ['cottonRib2x2','Cotton 2×2 Rib','ribKnit','#51565b',320,20,46,.67,2.4,.88,.16,'rib-knit','wide wale rib'],
 ['frenchTerryMid','Midweight French Terry','fleece','#788380',330,8,13,.76,2.35,.89,.18,'terry-knit','loop back sweatshirting'],
 ['frenchTerryHeavy','Heavyweight French Terry','fleece','#343d3b',520,5,10,.87,4.1,.92,.10,'terry-knit','structured loop back sweatshirt'],
 ['brushedFleece','Brushed Back Sweatshirt Fleece','fleece','#596267',385,7,12,.78,3.5,.96,.12,'terry-knit','brushed fleecy backing'],
 ['polarFleece','Polyester Polar Fleece','fleece','#617083',285,8,13,.51,4.5,.98,.23,'fleece-pile','raised pile fleece'],
 ['sherpa','Polyester Sherpa','fleece','#ded0ba',390,9,14,.66,6.2,.99,.12,'fleece-pile','textured imitation shearling'],
 ['cottonFlannel','Brushed Cotton Flannel','cottonPoplin','#a7aaa5',195,2,4,.70,1.5,.95,.13,'plain-weave','brushed plain/twill shirting'],
 ['cottonOxford','Cotton Oxford Shirting','cottonPoplin','#a3b3bf',170,2,4,.76,1.1,.87,.18,'basket-weave','basket weave shirt cloth'],
 ['cottonBroadcloth','Cotton Broadcloth','cottonPoplin','#ecede9',130,1.5,2.5,.73,.9,.83,.12,'plain-weave','dense smooth shirting'],
 ['cottonChambray','Cotton Chambray','cottonPoplin','#758da3',150,1.5,3,.70,1.1,.87,.12,'plain-weave','colored warp and pale weft'],
 ['cottonTwill','Cotton Workwear Twill','cottonCanvas','#7a826c',290,1.5,2.5,.87,1.75,.86,.08,'twill','workwear chinos and trousers'],
 ['cottonDuck','Cotton Duck Canvas','cottonCanvas','#b3a47e',405,.8,1.4,.96,3.1,.96,.05,'plain-weave','dense cotton duck'],
 ['waxedCanvas','Waxed Cotton Canvas','cottonCanvas','#455344',360,1,1.5,.90,2.5,.62,.16,'plain-weave','waxed water resistant finish'],
 ['linenShirting','Lightweight Linen Shirting','linen','#d5c6a7',145,1.2,1.8,.66,.85,.90,.11,'plain-weave','linen plain weave'],
 ['linenHeavy','Heavyweight Linen','linen','#a59a7f',285,1,2,.81,1.95,.93,.09,'plain-weave','structured linen'],
 ['hempCanvas','Hemp Canvas','cottonCanvas','#b0aa8b',365,.9,1.7,.92,2.55,.95,.09,'plain-weave','heavy natural fibre canvas'],
 ['rawDenim','Raw Indigo Denim 14oz','denim','#263547',475,.8,1.5,.95,1.45,.86,.06,'twill','stiff unsanforized denim starting point'],
 ['lightDenim','Lightweight Denim','denim','#6a879d',270,1.5,2.8,.77,.95,.83,.09,'twill','light cotton jean twill'],
 ['heavyDenim','Heavyweight Denim 18oz','denim','#203044',610,.6,1.0,.97,2.3,.88,.05,'twill','very heavy workwear denim'],
 ['denimCottonElastane','Cotton Elastane Denim','stretchDenim','#354c66',350,3,18,.77,1.15,.78,.10,'twill','stretch jeans with elastane'],
 ['woolFlannel','Wool Flannel','woolSuiting','#616569',275,3,5,.68,1.9,.95,.12,'plain-weave','brushed tailored wool'],
 ['woolGabardine','Wool Gabardine','woolSuiting','#646151',280,2.3,3.2,.82,1.45,.78,.16,'twill','fine tightly woven suit twill'],
 ['woolTweed','Wool Tweed','woolMelton','#787067',410,2,3.5,.83,2.85,.96,.13,'plain-weave','lofty mixed yarn suiting'],
 ['boucle','Bouclé Wool Blend','woolMelton','#ac9e8e',460,6,8,.68,4.2,.98,.14,'boucle','loop yarns and nubs'],
 ['cashmereKnit','Cashmere Sweater Knit','ribKnit','#b9aaa2',225,12,21,.46,2.1,.98,.20,'jersey-knit','fine lofty sweater knit'],
 ['viscoseChallis','Viscose Challis','silk','#b99791',125,4,6,.33,.75,.69,.42,'plain-weave','soft fluid regenerated cellulose'],
 ['tencelTwill','Lyocell Twill','silk','#8a9d99',195,3.8,5.8,.42,.95,.65,.34,'twill','flowing cupro/lyocell-like drape'],
 ['rayonCrepe','Rayon Crêpe','silk','#96878f',145,5,7,.36,1.0,.88,.28,'crepe','fine pebbled crepe'],
 ['silkCharmeuse','Silk Charmeuse','silk','#d1bcb7',90,3,5,.30,.5,.29,.88,'silk','glossy satin face'],
 ['silkGeorgette','Silk Georgette','silkChiffon','#e0d0c6',70,4,6,.25,.42,.81,.23,'crepe','sheer crêpe yarn weave'],
 ['polySatin','Polyester Satin','silkSatin','#a29da8',155,2.5,4,.48,.85,.30,.82,'silk','synthetic glossy satin'],
 ['polyTaffeta','Polyester Taffeta','lightNylon','#687e90',100,1.5,2.5,.70,.58,.40,.49,'synthetic','crisp plain weave synthetic'],
 ['polyMesh','Athletic Polyester Mesh','lightNylon','#789596',130,15,27,.41,1.25,.72,.18,'mesh','open aperture athletic knit'],
 ['powerMesh','Nylon Spandex Power Mesh','ribKnit','#424a4f',180,28,48,.45,.9,.72,.17,'mesh','compression mesh with elastane'],
 ['spandexTricot','Stretch Nylon Spandex Tricot','ribKnit','#5b596c',240,40,55,.39,.7,.49,.30,'jersey-knit','swimwear/activewear stretch'],
 ['neoprene','Neoprene Laminated Foam','scubaKnit','#343b42',590,13,23,.91,3.8,.55,.08,'synthetic','laminate thickness; no foam volume physics'],
 ['shellNylon','Coated Nylon Jacket Shell','lightNylon','#46626c',95,1,1.5,.47,.18,.41,.34,'synthetic','light rainwear shell'],
 ['ripstopUltralight','Ultralight Nylon Ripstop','nylonRipstop','#6b7d71',55,1,2,.35,.16,.53,.26,'ripstop','parachute-like nylon'],
 ['polyTulle','Polyester Tulle Net','silkOrganza','#d3c9d0',48,10,17,.35,.4,.75,.14,'mesh','net with visible open apertures'],
 ['veganLeather','Polyurethane Coated Textile','softLeather','#3b3538',540,3,6,.86,1.2,.34,.16,'leather','synthetic leather with textile backing'],
 ['lambskin','Lambskin Garment Leather','softLeather','#4c3731',460,4,7,.64,.8,.52,.17,'leather','soft lamb skin'],
 ['nappaLeather','Nappa Cowhide Garment Leather','softLeather','#3e2b25',640,2,4,.86,1.25,.40,.14,'leather','fine smooth grain'],
 ['pebbledLeather','Pebbled Cowhide Leather','softLeather','#65473a',730,2,4,.89,1.65,.65,.10,'leather','embossed/pebbled grain'],
 ['vegetableLeather','Vegetable-Tanned Cowhide','softLeather','#996747',840,1.5,3,.97,2.2,.73,.09,'leather','firm vegetable tanned leather'],
 ['patentLeather','Patent Leather','softLeather','#24282a',660,2.5,4,.88,1.2,.10,.05,'leather','glossy synthetic coating on leather'],
 ['nubuck','Nubuck Leather','suede','#8e7668',650,2,3.2,.83,1.35,.96,.09,'suede','sanded grain leather'],
 ['suedeLambskin','Lambskin Suede','suede','#986d52',505,3,5,.66,1.1,.99,.08,'suede','fine leather nap'],
 ['fauxSuede','Microfiber Faux Suede','suede','#8a857d',320,4,8,.62,1.25,.96,.07,'suede','polyester microfibre imitation'],
 ['velour','Cotton Velour Knit','velvet','#765e6e',295,14,22,.55,2.1,.90,.38,'velvet','knitted cut pile'],
 ['fauxFur','Short Pile Faux Fur','fleece','#938b80',530,6,11,.72,8,.99,.11,'fleece-pile','pile is optical; no individual hairs'],
 ['quiltedNylon','Quilted Nylon with Batting','technicalSoftshell','#3f4b53',310,3,5,.81,6,.58,.24,'synthetic','composite thickness; seams not generated'],
]

export const APPAREL_MATERIAL_EXPANSION = Object.freeze(rows.map(([
  id,name,base,color,gsm,warpPct,weftPct,bend,thicknessMm,roughness,sheen,surfaceFamily,construction,
]) => ({
  id,name,base,construction,surfaceFamily,
  // Unit metadata makes authoring and independent calibration explicit.
  composition: null,
  calibration: {status:'estimated',source:'unmeasured design starting point',method:'requires physical swatch tests'},
  color,gsm,stretchWarp:warpPct/100,stretchWeft:weftPct/100,
  bend,thickness:thicknessMm/1000,roughness,sheen,
  // Natural cloth is dielectric; metallic appearance requires a coating.
  metalness:0,
})))

// Display grouping only; material IDs and persisted project data stay stable.
export function groupApparelPresets(presets) {
  const groups={
    'Cotton Jerseys & Sweatshirting':[],
    'Denim & Workwear':[],
    'Leather & Suede':[],
    'Shirting & Natural Wovens':[],
    'Wool & Tailoring':[],
    'Silk, Satin & Fluid Wovens':[],
    'Performance & Outerwear':[],
    'Other Textiles':[],
  }
  for(const [id,item] of Object.entries(presets)){
    const name=(id+' '+item.name).toLowerCase()
    let category='Other Textiles'
    if(/denim|jean|duck|canvas|corduroy|workwear/.test(name))category='Denim & Workwear'
    else if(/leather|suede|nubuck/.test(name))category='Leather & Suede'
    else if(/wool|cashmere|tweed|bouclé|boucle|gabardine|melton/.test(name))category='Wool & Tailoring'
    else if(/silk|satin|organza|chiffon|georgette|viscose|rayon|lyocell|tencel|crepe|crêpe/.test(name))category='Silk, Satin & Fluid Wovens'
    else if(/nylon|poly|spandex|lycra|mesh|neoprene|scuba|softshell|ripstop|technical|tulle/.test(name))category='Performance & Outerwear'
    else if(/jersey|knit|rib|french terry|fleece|sherpa|waffle|velour|sweatshirt/.test(name))category='Cotton Jerseys & Sweatshirting'
    else if(/cotton|linen|hemp|poplin|oxford|flannel|chambray|broadcloth|interfacing/.test(name))category='Shirting & Natural Wovens'
    groups[category].push([id,item])
  }
  return Object.entries(groups).filter(([,items])=>items.length)
}
