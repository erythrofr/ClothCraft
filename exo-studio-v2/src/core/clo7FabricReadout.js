/**
 * Field-level comparison with publicly documented CLO 7.x Property Editor.
 * Does not parse proprietary CLO .zfab presets or invent material strengths.
 * EXO stretch fractions and scalar bend are NOT CLO strength intensities.
 */
const num=(n,decimals=2)=>Number.isFinite(Number(n))?Number(Number(n).toFixed(decimals)):null
const field=(id,label,value,unit,status,note)=>({id,label,value,unit,status,note})
const numeric=(id,label,n,unit,status,note,decimals=2)=>field(id,label,n==null?null:num(n,decimals),unit,status,note)
const unavailable=(id,label,note)=>field(id,label,null,'','not-implemented',note)
export const CLO7_FABRIC_REFERENCE_URLS=Object.freeze({
  physical:'https://support.clo3d.com/hc/en-us/articles/115000483047-Physical-Property-Detail-Setting',
  stretch:'https://support.clo3d.com/hc/en-us/articles/115000483087-Adjust-Stretch-Weft-Warp-Shear',
  bending:'https://support.clo3d.com/hc/en-us/articles/115000483187-Adjust-Bending-Weft-Warp',
  buckling:'https://support.clo3d.com/hc/en-us/articles/115002685527-Adjust-Buckling-Stiffness',
  friction:'https://support.clo3d.com/hc/en-us/articles/115002797948-Adjust-Friction-Coefficient',
  surface:'https://support.clo3d.com/hc/en-us/articles/360047317454-Set-Fabric-Materials',
  measurement:'https://support.clo3d.com/hc/en-us/articles/360041074334-Fabric-Kit-Manual',
})
export function clo7FabricReadout(fabric={}) {
  const calibration=fabric.calibration?.status||'estimated'
  const sourced=fabric.photoReference?.assetId||fabric.texture?.scanAssetId||null
  const origin=fabric.photoReference?.provider||fabric.texture?.scanSource||null
  const uncalibrated='EXO design estimate, not a CLO preset intensity or a measured force-extension curve.'
  const sections=[
    {id:'physical',label:'Physical properties · actual EXO solver inputs',rows:[
      numeric('mass','Weight / areal mass',fabric.gsm,'g/m²','solver-input','Areal mass affects gravity/drape. Verify with a weighed specimen.',1),
      numeric('thickness','Thickness',fabric.thickness==null?null:fabric.thickness*1000,'mm','solver-input','Specimen thickness needs pressure/test provenance.',3),
      numeric('warpStretch','Stretch · warp (EXO extension)',fabric.stretchWarp==null?null:fabric.stretchWarp*100,'%','solver-input',uncalibrated),
      numeric('weftStretch','Stretch · weft (EXO extension)',fabric.stretchWeft==null?null:fabric.stretchWeft*100,'%','solver-input',uncalibrated),
      unavailable('shear','Shear · bias resistance','No independently adjustable main-solver shear coefficient or measured bias curve.'),
      numeric('bend','Bending · combined',fabric.bend,'EXO 0–1','solver-input','One normalized bending control, not CLO warp/weft/bias intensities.',3),
      unavailable('bendWarp','Bending · warp','No independent directional bending control in the main EXO solver.'),
      unavailable('bendWeft','Bending · weft','No independent directional bending control in the main EXO solver.'),
      unavailable('bendBias','Bending · bias','No independent bias bending constitutive control in the main EXO solver.'),
      unavailable('bucklingRatio','Buckling ratio','Not independently modeled; drape folding is emergent from current cloth solver.'),
      unavailable('bucklingStiffness','Buckling stiffness · warp/weft/bias','No CLO-like calibrated buckling stiffness input in the main solver.'),
      numeric('friction','Friction',fabric.friction,'EXO scalar','solver-input','A scalar EXO contact parameter, not a specimen-specific cloth-to-cloth test.',3),
      numeric('damping','Motion damping',fabric.damping??.985,'EXO ratio','solver-input','Time-step motion damping; not measured mechanical hysteresis.',3),
      numeric('shrinkWarp','Shrinkage · warp',(fabric.shrinkWarp??0)*100,'%','solver-input','Construction shrinkage input, not actual process testing.'),
      numeric('shrinkWeft','Shrinkage · weft',(fabric.shrinkWeft??0)*100,'%','solver-input','Construction shrinkage input, not actual process testing.'),
    ]},
    {id:'optical',label:'Visual / optical materials',rows:[
      field('color','Selected color',fabric.color||null,'HEX','optical-only','Uncalibrated colorway; no measured spectral reflectance.'),
      numeric('roughness','Roughness',fabric.roughness??.82,'0–1','optical-only','Three.js PBR control and optional roughness image.'),
      numeric('sheen','Yarn sheen',fabric.sheen??.22,'0–1','optical-only','Fiber highlight approximation.'),
      numeric('anisotropy','Directional highlight',fabric.fiberAnisotropy??.16,'0–1','optical-only','Directional reflectance, not warp/weft stretch.'),
      numeric('normalStrength','Normal map intensity',fabric.normalStrength??1,'×','optical-only','Shader microrelief, not collision geometry.'),
      numeric('opacity','Opacity',fabric.opacity??1,'0–1','optical-only','Visual transparency only.'),
      field('source','Color/normal/roughness source',sourced?(origin+' / '+sourced):'procedural or user asset','','source-only','Photographic family proxies are not exact swatch scans.'),
      field('repeat','Image repeat',(fabric.texture?.repeatWidthCm&&fabric.texture?.repeatHeightCm)
        ?(num(fabric.texture.repeatWidthCm)+' × '+num(fabric.texture.repeatHeightCm)):null,'cm','optical-only',
      'Some 20cm stock repeat dimensions are illustrative rather than measured.'),
      unavailable('frontBackSide','Independent front/back/side materials','CLO documents three independent surface faces. EXO uses one shared cloth face material.'),
    ]},
    {id:'evidence',label:'Laboratory evidence / calibration gaps',rows:[
      field('status','Specimen calibration status',calibration,'','source-only','Only an independently verified laboratory specimen validates drape.'),
      field('specimen','Traceable specimen ID',fabric.calibrationEvidence?.specimenId||null,'','source-only','Leave blank unless user-supplied evidence identifies a tested lot.'),
      unavailable('nonlinearCurves','Nonlinear warp/weft/bias force curves','Evidence importer can keep observations, but does not calibrate all native nonlinear coefficients.'),
      field('scanProvenance','Visual asset attribution',fabric.photoReference?.assetUrl||null,'','source-only','Asset license and provenance do not validate physical properties.'),
    ]},
  ]
  return {reference:'CLO 7.x official documented property categories; live UI access unverified',
    calibration,sections,referenceUrls:CLO7_FABRIC_REFERENCE_URLS}
}
