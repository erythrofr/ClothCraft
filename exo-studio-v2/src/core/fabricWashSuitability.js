/**
 * Textile-family guidance for *digital appearance references*, NOT a
 * manufacturer treatment recipe or a claim about actual chemical behavior.
 * Fabric composition, finishes, dyes, elastane, coatings and manufacturer
 * tests are required before specifying any production wash.
 */
import {WASH_EFFECTS,normalizeWashSpec} from './clothWashProcedurals.js'

const named=(fabric)=>String([fabric?.name,fabric?.surfaceFamily,fabric?.construction].filter(Boolean).join(' ')).toLowerCase()

export function classifyDigitalWashSubstrate(fabric={}) {
 const name=named(fabric)
 if(/faux.?fur|sherpa|polar.?fleece|brushed.?fleece/.test(name))return 'pile'
 if(/patent.?leather|nappa|lambskin|leather|suede|nubuck|vegan.?leather/.test(name))return 'skin'
 if(/neoprene|scuba|shell|softshell|laminat|ripstop|coated|waxed|nylon|polyester|poly.?satin|spandex|synthetic|pvc/.test(name))return 'synthetic'
 if(/silk|satin|chiffon|organza|georgette|tulle|cashmere/.test(name))return 'delicate'
 if(/wool|tweed|melton|boucle|felt|flannel/.test(name))return 'animal'
 if(/denim|jean|cotton.?twill|canvas|duck|chambray/.test(name))return 'sturdy-cellulosic'
 if(/cotton|hemp|linen|flax|rayon|tencel|lyocell|viscose|terry|jersey|pique|rib/.test(name))return 'cellulosic'
 return 'unverified'
}

const REFERENCE_EFFECTS={
  'sturdy-cellulosic':new Set(['raw','rinse','enzyme','stone','acid','bleach','ozone','garment-dye','vintage','pigment','pp','whiskers','abrasion','faded-seams','tie-dye','distress']),
  cellulosic:new Set(['raw','rinse','enzyme','ozone','garment-dye','vintage','pigment','bleach','tie-dye','abrasion']),
  animal:new Set(['raw','rinse','vintage','pigment']),
  delicate:new Set(['raw','rinse','vintage','pigment']),
  skin:new Set(['raw','vintage','pigment','abrasion']),
  synthetic:new Set(['raw','rinse','vintage','pigment','abrasion','tie-dye']),
  pile:new Set(['raw','rinse','vintage']),
  unverified:new Set(['raw','rinse','vintage']),
}

const EXPLANATIONS={
  'sturdy-cellulosic':'Visual wear and fading references can suit some robust cotton constructions, especially denim; dye chemistry, shrinkage and hardware effects still require physical sampling.',
  cellulosic:'Digital garment-wash style is illustrative; knits and lightweight cellulose textiles can be damaged, distorted or shrink during actual manufacturing.',
  animal:'Treat this only as an optical concept. Protein fibers and wool finishes need their own mill-specified processes, not a denim recipe.',
  delicate:'Delicate or high-sheen construction: use a restrained visual finish. Any real wet-processing specification requires specialist sampling.',
  skin:'Leather, coated leather and suede depend on tanning and finishing systems, not textile denim chemical washes. Simulate only visual patina.',
  synthetic:'Technical coatings, nylon/polyester, stretch and laminates may behave unlike cellulosic denim. Test a manufacturer-approved finishing method.',
  pile:'Pile/nap finish and fiber damage require validation; a digital color grade cannot reproduce pile flattening, shedding or mechanical degradation.',
  unverified:'Fiber composition/finish unspecified. The wash effect is purely illustrative until its manufacturer determines an appropriate method.',
}

export function digitalWashSuitability(fabric={},wash={type:'raw'}) {
 const substrate=classifyDigitalWashSubstrate(fabric)
 const spec=normalizeWashSpec(wash)
 const familiar=REFERENCE_EFFECTS[substrate]?.has(spec.type)??false
 return {
  substrate,
  effect:spec.type,
  status:spec.type==='raw'?'none':familiar?'illustrative-reference':'specialty-review',
  recommendation:EXPLANATIONS[substrate],
  caution:!familiar&&spec.type!=='raw'
    ?`The ${WASH_EFFECTS[spec.type].label} is not a typical reference effect for this fabric family; review with the manufacturer. This is a visual preview only.`
    :null,
  chemistryMeasured:false,
 }
}

/** Which restrained optical finish to apply to an EXO Soft-Hand variant.
 * Does not suggest a wet/chemical factory treatment.
 */
export function suggestedSoftHandVisualWash(fabric={}) {
 const substrate=classifyDigitalWashSubstrate(fabric)
 if(substrate==='sturdy-cellulosic'||substrate==='cellulosic')
   return {type:'enzyme',strength:.31}
 if(substrate==='skin')return {type:'vintage',strength:.14}
 if(substrate==='synthetic'||substrate==='delicate'||substrate==='animal'||substrate==='pile')
   return {type:'rinse',strength:.12}
 return {type:'vintage',strength:.12}
}
