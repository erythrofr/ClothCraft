/**
 * Field-level EXO/CLO conceptual comparison. Presence is not physical parity.
 * CLO categories are based on published help, not unobserved live editor rows.
 * No proprietary CLO preset coefficients or measured curves are included.
 */
export const CLO_FABRIC_FIELD_MATRIX = Object.freeze([
  {id:'arealMass',label:'Fabric weight / areal density',cloConcept:'Weight / density',keys:['gsm'],classification:'supported',unit:'g/m²',priority:'P0'},
  {id:'thickness',label:'Fabric thickness',cloConcept:'Thickness',keys:['thickness'],classification:'approximation',unit:'m (EXO)',priority:'P0'},
  {id:'warpTensile',label:'Warp tensile response',cloConcept:'Stretch Warp',keys:['stretchWarp'],classification:'approximation',unit:'EXO normalized authoring ratio',priority:'P0'},
  {id:'weftTensile',label:'Weft tensile response',cloConcept:'Stretch Weft',keys:['stretchWeft'],classification:'approximation',unit:'EXO normalized authoring ratio',priority:'P0'},
  {id:'shear',label:'Bias/shear mechanics',cloConcept:'Shear',keys:['shearRelative'],classification:'approximation',unit:'relative design metadata',priority:'P0'},
  {id:'warpBending',label:'Warp bending rigidity',cloConcept:'Bending Warp',keys:['bend'],classification:'approximation',unit:'EXO normalized control; not N·m',priority:'P0'},
  {id:'weftBending',label:'Weft bending rigidity',cloConcept:'Bending Weft',keys:['bend'],classification:'approximation',unit:'shared EXO control; no independent weft curve',priority:'P0'},
  {id:'contactFriction',label:'Fabric contact friction',cloConcept:'Friction / contact behavior',keys:['friction'],classification:'approximation',unit:'EXO control; contact-pair validation needed',priority:'P1'},
  {id:'shrinkage',label:'Warp/weft shrinkage',cloConcept:'Shrinkage Warp / Weft',keys:['shrinkWarp','shrinkWeft'],classification:'approximation',unit:'EXO ratios; wash-cycle recovery unverified',priority:'P1'},
  {id:'damping',label:'Damping / recovery',cloConcept:'Dynamic fabric response',keys:['damping'],classification:'approximation',unit:'EXO normalized control',priority:'P1'},
  {id:'color',label:'Base color',cloConcept:'Material color',keys:['color'],classification:'supported',unit:'hex sRGB authoring color',priority:'P1'},
  {id:'pbrSurface',label:'Surface reflectance',cloConcept:'Material roughness and reflectivity',keys:['roughness','metalness','sheen'],classification:'approximation',unit:'visual controls',priority:'P1'},
  {id:'normalDetail',label:'Bump/normal detail',cloConcept:'Normal / bump map',keys:['normalStrength'],classification:'approximation',unit:'visual strength; map provenance not guaranteed',priority:'P1'},
  {id:'textureMaps',label:'Image PBR maps',cloConcept:'Base color, normal, roughness and displacement maps',keys:['pbrMaps','maps','fabricScan'],classification:'approximation',unit:'source-dependent references',priority:'P1'},
  {id:'fabricGrain',label:'Fabric grain angle',cloConcept:'Fabric grain / texture orientation',keys:['fiberAngleDeg'],classification:'approximation',unit:'degrees; pattern-piece binding unverified',priority:'P1'},
  {id:'collision',label:'Thickness-aware collision',cloConcept:'Collision thickness / simulation interaction',keys:[],classification:'missing',unit:'solver-level behavior, cannot infer from thickness field',priority:'P0'},
  {id:'customPhysics',label:'Physical preset / calibrated custom physics',cloConcept:'Physical Property > Detail / custom settings',keys:[],classification:'missing',unit:'nonlinear directional curves + fitting',priority:'P0'},
  {id:'measurementProvenance',label:'Physical test provenance',cloConcept:'Fabric Kit / measured material creation workflow',keys:['calibration'],classification:'approximation',unit:'EXO estimated status is not measurement',priority:'P0'},
  {id:'washEffects',label:'Visual garment wash finish',cloConcept:'Material appearance/finish (conceptual only)',keys:['wash'],classification:'approximation',unit:'visual algorithm, not manufacturing chemical simulation',priority:'P2'},
  {id:'materialComposition',label:'Fiber composition and construction',cloConcept:'Fabric type / composition',keys:['composition','fiberContent'],classification:'approximation',unit:'metadata; traceability varies',priority:'P2'},
])

const hasValue = value => value !== undefined && value !== null && value !== ''
function getPresentKeys(preset,field) {
  return field.keys.filter(key=>hasValue(preset[key]))
}
export function auditFabricCloParity(preset, id=preset?.id) {
  if (!preset || !id) throw new TypeError('Fabric preset and stable ID required')
  const fields={}
  for (const field of CLO_FABRIC_FIELD_MATRIX) {
    const presentKeys=getPresentKeys(preset,field)
    const complete=field.keys.length>0 && presentKeys.length===field.keys.length
    const available=presentKeys.length>0
    let status=field.classification
    if (!available) status='missing'
    if (field.id==='measurementProvenance') {
      const calibrated=preset.calibration?.status==='measured' && Boolean(preset.calibration?.measurementId)
      status=calibrated?'supported':available?'approximation':'missing'
    }
    fields[field.id]={
      status,cloConcept:field.cloConcept,priority:field.priority,unit:field.unit,
      exoKeys:presentKeys,missingKeys:field.keys.filter(key=>!presentKeys.includes(key)),
      completeness:complete?'all':available?'partial':'none',
      ...(field.id==='measurementProvenance'?{provenanceStatus:preset.calibration?.status||'unrecorded'}:{}),
    }
  }
  return {
    id,name:preset.name||id,familyId:preset.familyId||id,finishId:preset.finishId||'reference',
    catalogVersion:preset.catalogVersion||1,fields,
    counts:Object.values(fields).reduce((counts,row)=>(counts[row.status]++,counts),{supported:0,approximation:0,missing:0}),
  }
}

export function auditCatalogCloParity(presets) {
  const records=Object.entries(presets).map(([id,preset])=>auditFabricCloParity(preset,id))
  const counts={supported:0,approximation:0,missing:0}
  const byField=Object.fromEntries(CLO_FABRIC_FIELD_MATRIX.map(field=>[field.id,{
    label:field.label,cloConcept:field.cloConcept,priority:field.priority,
    supported:0,approximation:0,missing:0,
  }]))
  for(const record of records)for(const [id,row] of Object.entries(record.fields)){
    counts[row.status]++
    byField[id][row.status]++
  }
  return {schemaVersion:1,generatedFor:'EXO 400 fabric catalogue; CLO 7 conceptual attribute parity',
    evidence:{exo:'source code field presence and declared calibration statuses',
      clo:'published CLO fabric physical/property documentation; selected fabric property editor rows not live verified',
      caveat:'supported means represented authoring data, not measured physical or visual equivalence'},
    total:records.length,fieldCount:CLO_FABRIC_FIELD_MATRIX.length,counts,byField,records}
}
