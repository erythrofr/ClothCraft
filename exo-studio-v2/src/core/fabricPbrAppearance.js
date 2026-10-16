/**
 * Appearance-only balancing for documented, licensed PBR source photos.
 *
 * Three.js uses the green channel of roughnessMap multiplied by
 * material.roughness. Independently authored CC0 scan maps often have
 * different brightness baselines: unbalanced, they unexpectedly overpower
 * EXO's roughness slider when switching between fabric families.
 *
 * Rebase scans to a near-neutral multiplier while retaining the relative
 * measured-looking yarn texture. NOT a BRDF measurement of an EXO specimen.
 * Original maps are never mutated or rewritten on disk.
 */
const bound=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min))
const licensedScan=texture=>Boolean(
  texture?.scanAssetId && texture.license==='CC0' &&
  /^\/(?:fabric-scans|fabric-scans-ambientcg)\//.test(texture.roughnessSrc||'')
)

export function roughnessVariationStrength(fabric={}) {
 const name=String(fabric.name||'').toLowerCase()
 const family=String(fabric.surfaceFamily||'').toLowerCase()
 if(/patent|gloss|coated|waxed|laminat/.test(name))return .26
 if(/velvet|suede|nubuck|fleece|sherpa|bouclé|boucle/.test(name))return .62
 if(/silk|satin|charmeuse/.test(name))return .30
 if(/denim|canvas|twill|corduroy|terry|rib/.test(name)||/twill|corduroy|terry|rib/.test(family))return .57
 if(/leather/.test(name))return .38
 return .44
}

/** Pure per-pixel neutralization; g is the source map's linear roughness. */
export function balanceRoughnessByte(g,mean,contrast=.45) {
 const relative=(bound(g,0,255)-bound(mean,0,255))/255
 const neutral=1 + relative*bound(contrast,0,1.5)
 return Math.round(255*bound(neutral,.78,1))
}

/** True iff a licensed scan has a documented roughness source to balance. */
export function shouldBalanceFabricRoughness(fabric={}) {
 return licensedScan(fabric.texture)
}

/** Apply in an origin-clean browser canvas, returning null when unavailable.
 * Unlike a fabric scan replacement, the transformed canvas preserves map
 * grain and is an optical grading layer over the original raw PBR asset.
 */
export function balanceScannedRoughness(sourceImage,fabric={},options={}) {
 if(!shouldBalanceFabricRoughness(fabric) ||
    typeof document==='undefined'||typeof document.createElement!=='function'||!sourceImage)return null
 if(sourceImage.complete===false||sourceImage.naturalWidth===0||sourceImage.naturalHeight===0)return null
 const dim=(requested,natural)=>Math.round(bound(Number(requested||natural||512),1,1536))
 const width=dim(options.width,sourceImage.naturalWidth||sourceImage.width)
 const height=dim(options.height,sourceImage.naturalHeight||sourceImage.height)
 try{
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d',{willReadFrequently:true})
  if(!ctx)return null
  ctx.drawImage(sourceImage,0,0,width,height)
  const pixels=ctx.getImageData(0,0,width,height),data=pixels.data
  let sum=0,count=0
  // Sample every pixel on small swatches; on photographs use a prime-number
  // interval. Fixed 8-pixel strides can alias a regular eight-yarn weave and
  // shift its mean, causing severe clipping on some checked textiles.
  const stride=data.length<=16384?4:4*23
  for(let i=0;i<data.length;i+=stride) {
   if(!data[i+3])continue
   sum+=data[i+1];count++
  }
  const mean=count?sum/count:255
  const contrast=roughnessVariationStrength(fabric)
  for(let i=0;i<data.length;i+=4){
   if(!data[i+3])continue
   const gray=balanceRoughnessByte(data[i+1],mean,contrast)
   data[i]=gray;data[i+1]=gray;data[i+2]=gray
  }
  ctx.putImageData(pixels,0,0)
  return canvas
 }catch {
  // Tainted external images or absent canvas support cannot be painted.
  // Three.js can still use the unprocessed licensed source roughness map.
  return null
 }
}
