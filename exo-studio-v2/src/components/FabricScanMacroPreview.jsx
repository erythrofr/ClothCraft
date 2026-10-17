import {useEffect,useRef} from 'react'
import {tintLicensedFabricScan} from '../core/photographicScanToning.js'

const permittedScan=src=>typeof src==='string'&&/^\/fabric-scans(?:-ambientcg)?\//.test(src)
const sensible=(n,fallback)=>Number.isFinite(Number(n))&&Number(n)>0?Number(n):fallback

/** Real photographic yarn close-up, cropped from the licensed PBR scan.
 * This is a separately marked inspection inset, never a fake displacement
 * claim for the rendered drape. It uses the same dye/wash grade as the sphere.
 */
export default function FabricScanMacroPreview({fabric={}}){
 const canvasRef=useRef(null)
 const uri=fabric.texture?.src
 useEffect(()=>{
  const canvas=canvasRef.current
  if(!canvas||!permittedScan(uri))return
  let cancelled=false
  const img=new Image()
  img.onload=()=>{
   if(cancelled)return
   const width=img.naturalWidth||img.width
   const height=img.naturalHeight||img.height
   // The scan's repeat size is a *visual preset*, not a microscope-verified
   // measurement. A 1.8 cm crop is labelled "approx" for this reason.
   const repeatWidth=sensible(fabric.texture?.repeatWidthCm,20)
   const repeatHeight=sensible(fabric.texture?.repeatHeightCm,20)
   const cropW=Math.max(12,Math.min(width,Math.round(width*1.8/repeatWidth)))
   const cropH=Math.max(12,Math.min(height,Math.round(height*1.8/repeatHeight)))
   const graded=tintLicensedFabricScan(img,{color:fabric.color,wash:fabric.wash||null},
    {width:Math.min(1536,width),height:Math.min(1536,height)})
   const source=graded||img
   const sw=source.width||width,sh=source.height||height
   const cw=Math.min(sw,Math.max(12,Math.round(cropW*sw/width)))
   const ch=Math.min(sh,Math.max(12,Math.round(cropH*sh/height)))
   canvas.width=192;canvas.height=192
   const ctx=canvas.getContext('2d')
   if(!ctx)return
   ctx.imageSmoothingEnabled=true
   ctx.imageSmoothingQuality='high'
   ctx.drawImage(source,Math.round((sw-cw)/2),Math.round((sh-ch)/2),cw,ch,0,0,192,192)
   canvas.dataset.scanMacroReady='true'
   canvas.dataset.scanMacroWidthCm='1.8'
  }
  img.onerror=()=>{if(!cancelled)canvas.dataset.scanMacroReady='false'}
  img.src=uri
  return()=>{cancelled=true;img.onload=null;img.onerror=null;img.src=''}
 },[fabric,uri])
 if(!permittedScan(uri))return null
 return <div className="exo-fabric-flat-macro" aria-label={`${fabric.name||'Fabric'} real scanned weave close-up, approximate 1.8 centimeter area`}>
  <canvas ref={canvasRef} aria-hidden="true"/>
  <span>WEAVE · ~1.8 CM</span>
 </div>
}
