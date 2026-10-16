/** Read-only checks on design estimates. Limits are screening heuristics, not lab specifications. */
import { describeTextileSurface, meshYarnCoverage } from './textileProcedurals.js'
const finite = v => typeof v === 'number' && Number.isFinite(v)
const add = (warnings,code,severity,field,message,action) => warnings.push({code,severity,field,message,action})

export const CONSTRUCTION_ENVELOPES = Object.freeze({
  'mesh/open': {gsm:[8,550],mm:[.025,6],extension:[0,2],bend:[0,1],optic:[0,1]},
  'leather/suede': {gsm:[80,1800],mm:[.12,8],extension:[0,1.5],bend:[0,1],optic:[0,1]},
  'silk/sheer': {gsm:[8,500],mm:[.015,4],extension:[0,1.5],bend:[0,1],optic:[0,1]},
  'terry': {gsm:[80,1000],mm:[.15,12],extension:[0,1.5],bend:[0,1],optic:[0,1]},
  'fleece/pile': {gsm:[50,1200],mm:[.15,18],extension:[0,1.8],bend:[0,1],optic:[0,1]},
  'denim/twill': {gsm:[50,1100],mm:[.06,9],extension:[0,1.6],bend:[0,1],optic:[0,1]},
  'coated/composite': {gsm:[15,1800],mm:[.02,18],extension:[0,2],bend:[0,1],optic:[0,1]},
  'cotton/woven': {gsm:[15,1100],mm:[.03,12],extension:[0,1.5],bend:[0,1],optic:[0,1]},
  'knit/stretch': {gsm:[15,1100],mm:[.04,15],extension:[0,3],bend:[0,1],optic:[0,1]},
  'other textile': {gsm:[8,1800],mm:[.01,20],extension:[0,3],bend:[0,1],optic:[0,1]},
})

export function constructionFamily(preset) {
  const id=String(preset.familyId||preset.id||'').replace(/__(fine|dense|softened|crisp)$/,'')
  const name=`${id} ${preset.name||''} ${preset.surfaceFamily||''}`.toLowerCase()
  if (/mesh|tulle|open.weave|netting/.test(name)) return 'mesh/open'
  if (/leather|suede|nubuck|lambskin|nappa/.test(name)) return 'leather/suede'
  if (/silk|chiffon|organza|georgette|sheer|charmeuse/.test(name)) return 'silk/sheer'
  if (/terry|towell/.test(name)) return 'terry'
  if (/fleece|sherpa|fur|pile|velour|velvet/.test(name)) return 'fleece/pile'
  if (/denim|twill|gabardine|chambray|corduroy/.test(name)) return 'denim/twill'
  if (/coated|coating|waxed|softshell|neoprene|scuba|quilted|interfacing|patent/.test(name)) return 'coated/composite'
  if (/jersey|knit|rib|spandex|lycra|interlock|pique|waffle/.test(name)) return 'knit/stretch'
  if (/cotton|canvas|duck|poplin|linen|hemp|flannel|oxford|broadcloth|wool|tweed|basket|plain.weave/.test(name)) return 'cotton/woven'
  return 'other textile'
}

const qualityGrade = (warnings,calibration) => {
  const structural=warnings.filter(w=>w.severity==='error').length
  const reviews=warnings.filter(w=>w.severity==='review').length
  const evidence=calibration?.status==='measured' && calibration?.evidenceUri && calibration?.sampleId
  return {diagnostic:structural?'D':reviews?'C':'B', evidence:evidence?'requires verification of supplied sample evidence':'unmeasured', productionReady:false}
}

export function diagnoseFabricConstruction(preset, id=preset?.id) {
  if (!preset || typeof preset!=='object') throw new TypeError('Fabric preset object required')
  const warnings=[]
  const family=constructionFamily({...preset,id})
  const envelope=CONSTRUCTION_ENVELOPES[family]
  const measures={gsm:preset.gsm,thicknessMm:finite(preset.thickness)?preset.thickness*1000:null,stretchWarp:preset.stretchWarp,stretchWeft:preset.stretchWeft,bend:preset.bend,roughness:preset.roughness,sheen:preset.sheen,opacity:preset.opacity??1}
  for(const [field,limits] of Object.entries({gsm:envelope.gsm,thicknessMm:envelope.mm,stretchWarp:envelope.extension,stretchWeft:envelope.extension,bend:envelope.bend,roughness:envelope.optic,sheen:envelope.optic,opacity:envelope.optic})) {
    const v=measures[field]
    if(!finite(v)) add(warnings,'INVALID_VALUE','error',field,`${field} must be a finite numeric value`,'Supply a finite, unit-correct parameter')
    else if(v<limits[0]||v>limits[1]) add(warnings,'OUTSIDE_FAMILY_ENVELOPE','review',field,`${field} ${v} outside broad ${family} screening envelope ${limits.join('–')}`,'Confirm specimen construction, units, and physical measurements before changing this estimate')
  }
  if(finite(preset.thickness)&&preset.thickness<=0) add(warnings,'NONPOSITIVE_THICKNESS','error','thickness','Thickness must be positive','Correct thickness unit in metres')
  if(finite(preset.gsm)&&preset.gsm<=0) add(warnings,'NONPOSITIVE_GSM','error','gsm','GSM must be positive','Correct areal mass in g/m²')
  const ratio=measures.thicknessMm>0&&measures.gsm>0?measures.gsm/measures.thicknessMm:null
  if(ratio!==null && (ratio<25||ratio>3000)) add(warnings,'MASS_THICKNESS_RATIO','review','gsm/thickness',`Areal mass / apparent thickness = ${ratio.toFixed(1)} kg/m³ bulk apparent density; loft, voids and pressure can alter this`, 'Measure thickness at specified pressure and verify mass; distinguish coating and pile from solid polymer density')
  if(finite(measures.stretchWarp)&&finite(measures.stretchWeft)) {
    if(measures.stretchWarp<0||measures.stretchWeft<0) add(warnings,'NEGATIVE_EXTENSION','error','stretchWarp/stretchWeft','Negative extension is not meaningful for this parameter','Correct directional extension estimates')
    const high=Math.max(measures.stretchWarp,measures.stretchWeft),low=Math.min(measures.stretchWarp,measures.stretchWeft)
    if(high>.15 && low>0 && high/low>20) add(warnings,'EXTREME_ANISOTROPY','review','stretchWarp/stretchWeft',`Directional extension ratio ${(high/low).toFixed(1)}; unusual but possible for engineered elastics`, 'Check warp/weft orientation and use force–extension curves in each direction')
  }
  let meshCutout=null
  if(family==='mesh/open') {
    const surface=describeTextileSurface(preset)
    const topology=surface.family==='mesh'?surface.meshTopology:null
    const coverage=topology ? Array.from({length:64*64},(_,i)=>meshYarnCoverage(topology,(i%64+.37)/64,(Math.floor(i/64)+.19)/64)) : []
    const coversYarn=coverage.some(v=>v>.6)
    const exposesHole=coverage.some(v=>v<.4)
    const generated=Boolean(topology&&coversYarn&&exposesHole)
    const uploadedOpacity=Boolean(preset.texture?.opacitySrc)
    meshCutout={topology,generated,uploadedOpacity,renderPath:uploadedOpacity?'uploaded-opacity-override':generated?'generated-alphaMap':'none',physicalOpenings:false}
    if(generated&&!uploadedOpacity) add(warnings,'OPEN_STRUCTURE_PROCEDURAL_CUTOUT','info','texture.alphaMap',`${topology} provides varying yarn coverage; renderer uses a generated alphaMap and alphaTest to show visual holes only`, 'Inspect render at garment scale; physical simulation/collision geometry remains continuous')
    else if(uploadedOpacity) add(warnings,'OPEN_STRUCTURE_UPLOADED_OPACITY','info','texture.opacitySrc','Uploaded opacity texture overrides generated mesh coverage in the renderer', 'Inspect uploaded alpha map for actual holes; cloth collision mesh remains continuous')
    else add(warnings,'OPEN_STRUCTURE_CUTOUT_MISSING','review','texture.alphaMap','No verified procedural or uploaded mesh cutout path for this construction', 'Provide a verified alpha map or mesh topology, and inspect hole visibility')
  }
  if((family==='leather/suede'||family==='coated/composite') && /patent/i.test(preset.name||'') && finite(preset.roughness)&&preset.roughness>.75) add(warnings,'PATENT_OPTICS','review','roughness','Patent finish has unusually diffuse shader roughness','Inspect measured gloss and clearcoat reference under fixed lighting')
  const photo=preset.photoReference||{}
  const texture=preset.texture||{}
  const scanMatch=texture.scanMatch||photo.match||null
  const sourceProxy=scanMatch==='proxy'||scanMatch==='construction-proxy'||/proxy/i.test(scanMatch||'')
  if(sourceProxy) add(warnings,'VISUAL_SOURCE_PROXY','info','texture.scanMatch',`Photo source ${texture.scanAssetId||photo.assetId||'unknown'} is a visual construction proxy`, 'Acquire exact construction reference or photograph the actual fabric; never infer mechanics from texture')
  if(texture.scanAssetId && !scanMatch) add(warnings,'SCAN_MATCH_UNSPECIFIED','review','texture.scanMatch','Photographic material scan has no explicit construction match classification','Record whether scan is exact-construction, approximate, or proxy')
  if(!texture.scanAssetId) add(warnings,'PROCEDURAL_OPTICS','info','texture','No linked licensed photo scan in current preset','Validate procedural yarn pattern and texture against physical fabric photograph')
  if(preset.calibration?.status!=='measured') add(warnings,'ESTIMATED_PROPERTIES','info','calibration.status','Mechanics and optics are estimates; no sample-specific laboratory calibration','Collect GSM, controlled-pressure thickness, warp/weft/bias curves, bending and shear data')
  else if(!preset.calibration?.evidenceUri || !preset.calibration?.sampleId) add(warnings,'MEASUREMENT_PROVENANCE_MISSING','review','calibration','Measured status lacks auditable specimen ID or evidence URI','Attach a validated specimen evidence record')
  return {id:id||preset.id,name:preset.name||id,family,values:measures,apparentDensityKgM3:ratio,meshCutout,scan:{assetId:texture.scanAssetId||null,match:scanMatch,proxy:sourceProxy},calibrationStatus:preset.calibration?.status||'unreported',grade:qualityGrade(warnings,preset.calibration),warnings}
}

export function diagnoseFabricCatalog(catalog) {
  if(!catalog||typeof catalog!=='object'||Array.isArray(catalog)) throw new TypeError('Catalog object expected')
  const fabrics=Object.entries(catalog).map(([id,preset])=>diagnoseFabricConstruction(preset,id))
  const byFamily={},bySeverity={error:0,review:0,info:0},byCode={},byDiagnosticGrade={A:0,B:0,C:0,D:0}
  for(const fabric of fabrics){byFamily[fabric.family]=(byFamily[fabric.family]||0)+1;byDiagnosticGrade[fabric.grade.diagnostic]++;for(const warning of fabric.warnings){bySeverity[warning.severity]++;byCode[warning.code]=(byCode[warning.code]||0)+1}}
  return {schemaVersion:1,scope:'heuristic screening of EXO preset estimates; NOT certified measurements',total:fabrics.length,uniqueIds:new Set(fabrics.map(x=>x.id)).size,summary:{byFamily,bySeverity,byCode,byDiagnosticGrade,physicalCalibrationConfirmed:0,sourceProxyCount:fabrics.filter(f=>f.scan.proxy).length,reviewFabricCount:fabrics.filter(f=>f.warnings.some(w=>w.severity==='review'||w.severity==='error')).length},fabrics}
}
