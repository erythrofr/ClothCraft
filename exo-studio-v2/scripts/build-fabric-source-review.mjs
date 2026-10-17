// Compile the installed, SHA-256-traced scan-audit into small, read-only UI
// review metadata. This is an optical *heuristic* report, NOT a measured BRDF
// and never substitutes for actual photographic color or physics calibration.
import {readFileSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'

const evidence=JSON.parse(readFileSync('docs/reports/EXO_400_SCAN_IMAGE_METRICS.json','utf8'))
assert.equal(evidence.summary.source_count,67)
assert.equal(evidence.summary.map_count,201)
const byAsset={}
let flagged=0
const important=new Set(['normal_vector_length_review','near_constant_roughness','directional_banding_candidate'])
for(const [source,record] of Object.entries(evidence.sources)){
 const parts=source.split('/')
 const assetId=parts.at(-1)
 const provider=parts.at(-2)==='fabric-scans-ambientcg'?'ambientCG':'Poly Haven'
 const key=provider+':'+assetId
 assert.equal(Object.keys(record.maps).length,3)
 const channels={}
 for(const [kind,item] of Object.entries(record.maps)){
  assert.match(item.sha256,/^[a-f0-9]{64}$/i)
  channels[kind]={
   sha256:item.sha256,
   flags:(item.flags||[]).filter(flag=>important.has(flag)),
  }
 }
 const warningCount=Object.values(channels).reduce((sum,entry)=>sum+entry.flags.length,0)
 flagged+=warningCount
 byAsset[key]={assetId,provider,channels,needsReview:warningCount>0}
}
assert.equal(Object.keys(byAsset).length,67)
const output={
 schemaVersion:1,kind:'visual-heuristic-not-laboratory-measurement',
 note:'Audit flags require visual confirmation. Flat roughness and normal maps may be correct for smooth textiles.',
 sources:Object.fromEntries(Object.entries(byAsset).sort(([a],[b])=>a.localeCompare(b))),
}
writeFileSync('src/data/scanOpticalReview.generated.json',JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify({ok:true,sourceAssets:Object.keys(byAsset).length,
  flaggedMaps:Object.values(byAsset).filter(a=>a.needsReview).length,
  warningTags:flagged}))
