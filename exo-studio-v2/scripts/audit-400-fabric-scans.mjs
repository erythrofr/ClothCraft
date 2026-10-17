import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, relative, isAbsolute, join } from 'node:path'
import { FABRIC_PRESETS,FABRIC_SCAN_COVERAGE } from '../src/data/defaultProject.js'
import { createFabricAssetRegistry } from '../src/core/fabricAssetRegistry.js'
import verified from '../src/data/polyhavenVerifiedRegistry.generated.json' with {type:'json'}
import ambient from '../src/data/ambientcgScans.generated.json' with {type:'json'}

const presets=Object.values(FABRIC_PRESETS)
assert.equal(presets.length,400)
const ambientMapAssets=Object.values(ambient.assets).flatMap(scan=>
 ['color','normal','roughness'].map(kind=>({
   id:`ambientcg_${scan.id}_${kind}`,
   kind,origin:'scan',license:'CC0',licensePermission:true,
   uri:scan.maps[kind].src,sha256:scan.maps[kind].sha256,
   provenance:{source:scan.assetUrl,creator:'ambientCG',acquiredAt:'2026-10-16',
     captureMethod:'photography',sourceLicense:'CC0-1.0',
     physicalScaleStatus:scan.physicalScaleStatus},
   repeatMm:{widthMm:scan.scanWidthCm*10,heightMm:scan.scanHeightCm*10},
   image:{width:1024,height:1024,mipLevels:1,tileable:true},
   colorSpace:kind==='color'?'sRGB':'linear',
   ...(kind==='normal'?{normalConvention:'OpenGL'}:{}),
 })))
const photoAssets=[...verified.assets,...ambientMapAssets]
const licenseById=new Map(photoAssets.map(item=>[item.id,item]))
const publicRoot=realpathSync('public')
const anomalyWarnings=[]
const physicalRepeatBySource=new Map()
const seenSourceKinds=new Map()
for(const asset of photoAssets){
 assert.match(asset.uri,/^\/fabric-scans(?:-ambientcg)?\/[a-zA-Z0-9_-]+\/(color|normal|roughness)\.(jpg|png|webp)$/,'Scan must be deployed inside an approved fabric-scans public upload root')
 assert.equal(asset.colorSpace,asset.kind==='color'?'sRGB':'linear',`${asset.id}: wrong color-space metadata`)
 assert.equal(asset.origin,'scan',`${asset.id}: incorrect provenance class`)
 assert.equal(asset.license,'CC0',`${asset.id}: source license`)
 const diskPath=resolve('public',asset.uri.slice(1))
 const actualRoot=realpathSync(diskPath)
 assert.ok(relative(publicRoot,actualRoot)&&!relative(publicRoot,actualRoot).startsWith('..')&&!isAbsolute(relative(publicRoot,actualRoot)),`${asset.id}: scan escapes public root`)
 const key=asset.id.replace(/_(color|normal|roughness)$/,'')
 const kinds=seenSourceKinds.get(key)||new Set()
 assert.ok(!kinds.has(asset.kind),`${key}: repeated ${asset.kind} map`)
 kinds.add(asset.kind);seenSourceKinds.set(key,kinds)
 const previous=physicalRepeatBySource.get(key)
 if(previous) assert.ok(Math.abs(previous.widthMm-asset.repeatMm.widthMm)<.01&&Math.abs(previous.heightMm-asset.repeatMm.heightMm)<.01,`${key}: inconsistent map repeat scales`)
 else physicalRepeatBySource.set(key,asset.repeatMm)
}
assert.equal(seenSourceKinds.size,FABRIC_SCAN_COVERAGE.uniqueLicensedScans,'All imported CC0 photographic scan sources must be registered')
for(const [source,kinds] of seenSourceKinds) assert.deepEqual([...kinds].sort(),['color','normal','roughness'],`${source}: incomplete map set`)
const assignments={}
const parentSharing={}
for(const fabric of presets) {
  if(fabric.materialFamilyId) {
    parentSharing[fabric.id]=fabric.materialFamilyId
    continue
  }
  const source=fabric.texture?.scanAssetId
  if(!source)continue
  const prefix=fabric.texture.scanSource==='ambientCG'?'ambientcg':'polyhaven'
  assignments[fabric.id]={
   color:`${prefix}_${source}_color`,
   normal:`${prefix}_${source}_normal`,
   roughness:`${prefix}_${source}_roughness`,
  }
}
for(const [id,maps] of Object.entries(assignments))
 for(const [kind,assetId] of Object.entries(maps))
  assert.equal(licenseById.get(assetId)?.kind,kind,`Invalid ${id}:${kind}`)
const registry=createFabricAssetRegistry(FABRIC_PRESETS,{
  assets:photoAssets,assignments,parentSharing,
})
const coverage=registry.coverage()
assert.equal(coverage.total,400)
assert.equal(coverage.grades.A,FABRIC_SCAN_COVERAGE.photographicReferences)
const reportRows=presets.map(fabric=>{
 const evidence=registry.resolve(fabric.id)
 const archetype=fabric.materialFamilyId||fabric.id
 const source=fabric.photoReference?.assetId||''
 const scan=evidence.maps.color
 if(source){
   assert.equal(scan?.provenance.source,fabric.texture.originalSourceUrl)
   assert.equal(fabric.texture.normalSrc,evidence.maps.normal?.uri)
   assert.equal(fabric.texture.roughnessSrc,evidence.maps.roughness?.uri)
  assert.ok(fabric.texture.repeatWidthCm>0&&fabric.texture.repeatHeightCm>0)
  assert.equal(fabric.texture.src,scan?.uri,`${fabric.id}: color file mismatch`)
  assert.equal(fabric.photoReference?.assetId,fabric.texture.scanAssetId,`${fabric.id}: source id mismatch`)
  assert.equal(fabric.photoReference?.license,'CC0',`${fabric.id}: preset license mismatch`)
  const expected=scan?.repeatMm
  if(expected){
   const widthRatio=fabric.texture.repeatWidthCm*10/expected.widthMm
   const heightRatio=fabric.texture.repeatHeightCm*10/expected.heightMm
   assert.ok(widthRatio>.95&&widthRatio<1.05&&heightRatio>.95&&heightRatio<1.05,`${fabric.id}: obvious scan physical repeat mismatch`)
  }
  assert.ok(['family-proxy','construction-reference'].includes(fabric.photoReference.match),`${fabric.id}: missing proxy classification`)
 }
 const measured=fabric.calibration?.status==='measured'
 return {
  id:fabric.id,name:fabric.name,masterArchetype:archetype,
  constructionVariant:fabric.finishId||'original',
  visualScanId:source,
  scanProvider:fabric.photoReference?.provider||'none',
  physicalScaleStatus:fabric.photoReference?.physicalScaleStatus||'no scan',
  sourceNeedsOpticalReview:Boolean(fabric.photoReference?.visualReviewFlags?.length),
  sourceOpticalReviewFlags:(fabric.photoReference?.visualReviewFlags||[]).join(';'),
  actualTextileRepeatMeasured: false,
  scanMatch:source?(fabric.photoReference.match==='family-proxy'?'related-family-proxy':'construction-reference'):'procedural-fallback',
  photographicColorScan:!!evidence.maps.color,
  photographicNormalScan:!!evidence.maps.normal,
  photographicRoughnessScan:!!evidence.maps.roughness,
  appearanceEvidenceGrade:evidence.grade,
  physicsEvidence:measured?'measured':'estimated',
  sourceUrl:scan?.provenance.source||'',
  license:scan?.license||'EXO-original-procedural',
  previewType:source?'photo-sourced dye-graded PBR':'structure-specific-generated-PBR',
  gsm:fabric.gsm,thicknessMm:Math.round(fabric.thickness*10000)/10,
  stretchWarpPct:Number((fabric.stretchWarp*100).toFixed(3)),
  stretchWeftPct:Number((fabric.stretchWeft*100).toFixed(3)),
  roughness:fabric.roughness,
  wash:fabric.wash?.type||'raw',
 }
})
const report={
  generatedAt:'2026-10-16',catalogTotal:400,
  uniqueRealCC0ScanMaterials:FABRIC_SCAN_COVERAGE.uniqueLicensedScans,
  installedSourcesByProvider:{polyHaven:FABRIC_SCAN_COVERAGE.polyHavenInstalled,
    ambientCG:FABRIC_SCAN_COVERAGE.ambientCgInstalled},
  uniqueReferencedSourcePhotos:new Set(reportRows.filter(r=>r.visualScanId).map(r=>r.scanProvider+':'+r.visualScanId)).size,
  sharedPhotoReferencePresets:FABRIC_SCAN_COVERAGE.photographicReferences,
  proceduralMaterialPresets:FABRIC_SCAN_COVERAGE.proceduralFallbacks,
  directConstructionVisualMatches:reportRows.filter(r=>r.scanMatch==='construction-reference').length,
  relatedFamilyProxies:reportRows.filter(r=>r.scanMatch==='related-family-proxy').length,
  measuredMechanicalPresets:reportRows.filter(r=>r.physicsEvidence==='measured').length,
  catalogPhysicsEstimated:reportRows.filter(r=>r.physicsEvidence==='estimated').length,
  sourceOpticalReviewPresetCount:reportRows.filter(r=>r.sourceNeedsOpticalReview).length,
  illustrativeRepeatScalePresetCount:reportRows.filter(r=>r.physicalScaleStatus==='unknown-illustrative-20cm').length,
 appearanceGrades:coverage.grades,
  evidenceInterpretation:'Grade A confirms a complete licensed optical scan map triplet only. It is not an exact textile construction match or measured mechanical data.',
  nearDuplicatePolicy:'Installed photographs are shared across fabric families and all construction variants; repeated source pixels are never independently measured or unique photographed materials.',
  flaggedAnomalies:anomalyWarnings,
  artifacts:{scannerLicense:['https://polyhaven.com/license','https://docs.ambientcg.com/books/website-licensing/page/license-information'],
    warning:'Photo scan grade A is ONLY for optical maps, not exact fabric mechanical calibration. Shared photo textures and unknown physical repeat scales require per-specimen validation.'},
  fabrics:reportRows,
}
const folder=join('docs','reports')
mkdirSync(folder,{recursive:true})
writeFileSync(join(folder,'EXO_400_FABRICS_COVERAGE.json'),JSON.stringify(report,null,2)+'\n')
const fields=Object.keys(reportRows[0])
const cell=v=>`"${String(v??'').replaceAll('"','""')}"`
writeFileSync(join(folder,'EXO_400_FABRICS_COVERAGE.csv'),[fields.map(cell).join(','),...reportRows.map(row=>fields.map(field=>cell(row[field])).join(','))].join('\n')+'\n')
const manifest={assets:photoAssets,assignments,parentSharing}
writeFileSync(join(folder,'EXO_400_LICENSED_SCAN_REGISTRY.json'),JSON.stringify(manifest,null,2)+'\n')
const hashes=[]
for (const map of photoAssets) {
 const file=join('public',map.uri.slice(1))
 const digest=createHash('sha256').update(readFileSync(file)).digest('hex')
 assert.equal(digest,map.sha256,`Invalid asset: ${file}`)
 hashes.push({id:map.id,sha256:digest})
}
assert.equal(hashes.length,FABRIC_SCAN_COVERAGE.uniqueLicensedScans*3)
console.log(JSON.stringify({ok:true,total:400,verifiedMapFiles:hashes.length,
  uniqueRealPhotos:report.uniqueRealCC0ScanMaterials,
  uniqueReferencedPhotos:report.uniqueReferencedSourcePhotos,
  assignedPhotoReferences:report.sharedPhotoReferencePresets,
  relatedFamilyProxies:report.relatedFamilyProxies,
  exactMaterialPhysicsMeasured:report.measuredMechanicalPresets,
  sourceOpticalReviewPresets:report.sourceOpticalReviewPresetCount,
  illustrativeRepeatScalePresets:report.illustrativeRepeatScalePresetCount,
  proceduralFallbacks:report.proceduralMaterialPresets,
  gradeAppearance:coverage.grades},null,2))
