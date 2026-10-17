/**
 * EXO's versioned 400-item design catalog generator.
 *
 * Counts are meaningful garment *specifications* (construction × hand/weight
 * treatment), not 400 experimentally characterized material species.
 * Four construction treatments add different GSM, fabric thickness, stretch,
 * bending, friction and finish optics to each of the 80 reference archetypes.
 * All are clearly tagged ESTIMATED until a linked fabric test certifies them.
 *
 * No CLO/ZFAB proprietary scans, commercial preset values or textures are
 * copied. Existing identifiers must never be changed: project files persist
 * these IDs and manufacturing annotations refer to them.
 */
import {suggestedSoftHandVisualWash} from '../core/fabricWashSuitability.js'
const clip=(v,min,max)=>Math.max(min,Math.min(max,v))
const round=(n,places=3)=>Number(n.toFixed(places))
const RGB=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16))
const HEX=values=>`#${values.map(n=>Math.round(clip(n,0,255)).toString(16).padStart(2,'0')).join('')}`
const tint=(hex,rgb,mix)=>{
 if (!/^#[\da-f]{6}$/i.test(hex||''))return '#787878'
 return HEX(RGB(hex).map((part,index)=>part*(1-mix)+rgb[index]*mix))
}
const cleanName=name=>String(name)
 .replace(/\b(?:ultralight|lightweight|midweight|heavyweight|light|heavy|soft|thick)\b\s*/ig,'')
 .replace(/\b\d+(?:\.\d+)?\s*oz\b/ig,'')
 .replace(/\s+/g,' ').trim()

const variantDefinitions=[
 {
  suffix:'fine',
  title:'Fine / Light Construction',
  mass:.74,thickness:.81,bend:-.085,stretch:1.13,friction:.96,
  roughness:-.025,sheen:.025,tint:[243,244,239],colorMix:.065,
  sheenRoughness:-.055,anisotropy:.055,colorVariation:-.035,normalScale:.88,
  notes:'Finer count / lower areal mass; more pliant relative to the parent construction.',
 },
 {
  suffix:'dense',
  title:'Dense / Firm Construction',
  mass:1.23,thickness:1.16,bend:.07,stretch:.86,friction:1.08,
  roughness:.02,sheen:-.025,tint:[31,33,34],colorMix:.045,
  sheenRoughness:.025,anisotropy:.08,colorVariation:.035,normalScale:1.12,
  notes:'Denser structural build; higher bending response and lower easy extension.',
 },
 {
  suffix:'softened',
  title:'Soft-Hand / Broken-In Finish',
  mass:.965,thickness:1.03,bend:-.105,stretch:1.12,friction:.93,
  roughness:.045,sheen:-.025,tint:[205,198,185],colorMix:.095,
  sheenRoughness:.07,anisotropy:-.075,colorVariation:.12,normalScale:1.17,
  washType:'enzyme',washIntensity:.31,
  notes:'Illustrative relaxed/softened finish, with optional optical vintage wear.',
 },
 {
  suffix:'crisp',
  title:'Crisp / Structured Finish',
  mass:1.08,thickness:1.03,bend:.085,stretch:.88,friction:1.05,
  roughness:-.065,sheen:.035,tint:[67,67,64],colorMix:.052,
  sheenRoughness:-.075,anisotropy:.035,colorVariation:-.055,normalScale:.92,
  notes:'Structured finishing/lamination approximation; not certified chemical coating.',
 },
]

function makeVariation(id, base, variant) {
 const name=`${cleanName(base.name)} · ${variant.title} · ${Math.round(base.gsm*variant.mass)} GSM`
 const originalOpacity=base.opacity??1
 const shearFactor=variant.suffix==='dense'?1.20:variant.suffix==='crisp'?1.17:variant.suffix==='fine'?.86:.81
 const adaptedWash=variant.washType?suggestedSoftHandVisualWash(base):null
 const wash=adaptedWash?{
  ...adaptedWash,
  scale:1,seed:Math.abs(Array.from(id).reduce((h,c)=>h*31+c.charCodeAt(0),13))%997,
  placement:{x:.5,y:.5},rotation:0,
 }:undefined
 return {
  ...base,
  id:`${id}__${variant.suffix}`,name,
  familyId:id,materialFamilyId:id,finishId:variant.suffix,
  catalogVersion:2,construction:variant.notes,
  gsm:round(clip(base.gsm*variant.mass,24,1350),1),
  thickness:round(clip(base.thickness*variant.thickness,.00012,.014),7),
  stretchWarp:round(clip(base.stretchWarp*variant.stretch,0,.78),6),
  stretchWeft:round(clip(base.stretchWeft*variant.stretch,0,.89),6),
  bend:round(clip(base.bend+variant.bend,.12,.985),4),
  friction:round(clip(base.friction*variant.friction,.05,.95),4),
  shearRelative:round(shearFactor,3), // metadata; React's solver lacks direct shear.
  roughness:round(clip((base.roughness??.8)+variant.roughness,.065,.995),4),
  sheen:round(clip((base.sheen??.1)+variant.sheen,.025,.96),4),
  sheenRoughness:round(clip((base.sheenRoughness??.84)+variant.sheenRoughness,.09,.99),4),
  fiberAnisotropy:round(clip((base.fiberAnisotropy??.18)+variant.anisotropy,0,.95),4),
  colorVariation:round(clip((base.colorVariation??.24)+variant.colorVariation,.01,.93),4),
  clearcoat:base.clearcoat??0,
  opacity:originalOpacity,
  color:tint(base.color||'#787878',variant.tint,variant.colorMix),
  normalStrength:round(clip((base.normalStrength??1)*variant.normalScale,.05,3),3),
  weaveScaleCm:round(clip((base.weaveScaleCm??3)*(variant.suffix==='fine'?.88:variant.suffix==='dense'?1.08:1),.35,9.9),2),
  ...(wash?{wash}:{}),
  calibration:{
    status:'estimated',source:'EXO design-derived variant; no physical swatch measurements',
    parentId:id,variant:variant.suffix,
    methodsRequired:['areal mass','thickness at defined pressure','warp/weft/bias force curves','shear','bending','surface friction','PBR reflectance'],
  },
  presetSource:'EXO 400 material library · unmeasured constructed specification',
 }
}

/** Extend exactly 80 fixed archetypes to 400 total distinct specifications. */
export function extendTo400FabricPresets(referencePresets) {
 const base=Object.entries(referencePresets)
 if (base.length!==80) {
  throw new Error(`Catalog-400 requires 80 fixed reference archetypes; found ${base.length}. Migrate with a versioned spec before regenerating IDs.`)
 }
 const output={}
 for(const [id,record] of base) {
  for(const treatment of variantDefinitions) {
   const spec=makeVariation(id,record,treatment)
   if(referencePresets[spec.id]||output[spec.id])throw new Error(`Fabric id collision: ${spec.id}`)
   output[spec.id]=spec
  }
 }
 if (base.length+Object.keys(output).length!==400)throw new Error('Fabric catalog count invariant')
 return output
}

export const FABRIC_CATALOG_400_TREATMENTS=Object.freeze(variantDefinitions.map(({suffix,title,notes})=>({id:suffix,title,notes})))
