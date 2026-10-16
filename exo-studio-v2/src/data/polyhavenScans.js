import SCANS from './polyhavenScans.generated.json' with { type:'json' }
import AMBIENT from './ambientcgScans.generated.json' with {type:'json'}
import SOURCE_REVIEW from './scanOpticalReview.generated.json' with {type:'json'}
import {
 POLYHAVEN_ARCHETYPE_SCAN_IDS, SCAN_CONSTRUCTION_PROXY_IDS,
 AMBIENTCG_ARCHETYPE_SCAN_OVERRIDES,AMBIENTCG_CONSTRUCTION_PROXY_IDS,
} from './polyhavenFabricAssignments.js'

const assets=SCANS.assets||{}
export const POLYHAVEN_SCAN_INSTALL_COUNT=Object.keys(assets).length
const ambientAssets=AMBIENT.assets||{}
export const AMBIENTCG_SCAN_INSTALL_COUNT=Object.keys(ambientAssets).length

/** Attach actual licensed 1k scanned PBR channels to each eligible preset.
 * Share one original sample among construction variants, but never assert
 * that a family proxy is an exact specimen scan or a mechanical measurement.
 */
export function installPolyHavenFabricReferences(presets) {
 const bases=Object.entries(presets).filter(([,fabric])=>!fabric.materialFamilyId)
 if (bases.length!==80)throw new Error('Expected the 80 base fabric constructions')
 const assigned=new Set()
 for(const [id,record] of Object.entries(presets)){
  const archetype=record.materialFamilyId||id
  if (!(archetype in POLYHAVEN_ARCHETYPE_SCAN_IDS))
   throw new Error(`Missing scan mapping for EXO archetype ${archetype}`)
  const ambientId=AMBIENTCG_ARCHETYPE_SCAN_OVERRIDES[archetype]
  const requested=ambientId||POLYHAVEN_ARCHETYPE_SCAN_IDS[archetype]
  const scan=ambientId?ambientAssets[ambientId]:(requested&&assets[requested])
  const provider=ambientId?'ambientCG':'Poly Haven'
  const sourceReview=scan ? SOURCE_REVIEW.sources?.[provider+':'+requested]:null
  const status=scan?'CC0-photographic-reference':'procedural-no-suitable-photo'
  const match=ambientId
   ?(AMBIENTCG_CONSTRUCTION_PROXY_IDS.has(archetype)?'family-proxy':'construction-reference')
   :(SCAN_CONSTRUCTION_PROXY_IDS.has(archetype)?'family-proxy':'construction-reference')
  record.photoReference=scan?{
    status, match,assetId:requested,assetUrl:scan.assetUrl,license:'CC0',provider,
    physicalScaleStatus:scan.physicalScaleStatus||'nominal provider texture dimensions; NOT a measurement of this EXO sample',
    visualReviewFlags:sourceReview?.needsReview
      ?Object.entries(sourceReview.channels).flatMap(([kind,item])=>
        item.flags.map(flag=>`${kind}:${flag}`)):[],
    parentConstructionId:archetype,
  }:{
    status,requestedAssetId:requested||null,match:'no-suitable-reference',
    missing:'Retains structure-specific generated fabric normals and color',
  }
  // Photo provenance is appearance-only. Never promote calibration.status.
  if (!record.calibration)record.calibration={
    status:'estimated',
    source:'EXO material design starting point; no per-preset calibrated laboratory curves',
  }
  if(scan){
    if(!scan.maps?.color||!scan.maps?.normal||!scan.maps?.roughness)
      throw new Error(`Incomplete PBR scan ${requested}`)
    record.texture={
      ...(record.texture||{}),
      src:scan.maps.color.src,
      normalSrc:scan.maps.normal.src,
      roughnessSrc:scan.maps.roughness.src,
      repeatWidthCm:scan.scanWidthCm,
      repeatHeightCm:scan.scanHeightCm,
      rotationDeg:0,
      scanAssetId:requested,
      scanSource:provider,
      license:'CC0',
      originalSourceUrl:scan.assetUrl,
      scanMatch:match,
      physicalScaleStatus:record.photoReference.physicalScaleStatus,
      originalPhotoColor:true,
      photoReferenceIsShared:true,
      name:`${scan.name} (CC0 reference)`,
    }
    assigned.add(id)
  }
 }
 return {
  total:Object.keys(presets).length,
  photographicReferences:assigned.size,
  proceduralFallbacks:Object.keys(presets).length-assigned.size,
  uniqueLicensedScans:POLYHAVEN_SCAN_INSTALL_COUNT+AMBIENTCG_SCAN_INSTALL_COUNT,
  polyHavenInstalled:POLYHAVEN_SCAN_INSTALL_COUNT,
  ambientCgInstalled:AMBIENTCG_SCAN_INSTALL_COUNT,
 }
}
