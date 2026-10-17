import {useEffect,useRef} from 'react'
import {fabricSwatchStyle} from '../core/fabricSwatchStyle.js'
import {tintLicensedFabricScan} from '../core/photographicScanToning.js'
import FabricScanMacroPreview from './FabricScanMacroPreview.jsx'

const validScan=uri=>typeof uri==='string'&&/^\/fabric-scans(?:-ambientcg)?\//.test(uri)

/** Lazily tint one enlarged flat photographic swatch with the SAME dye/wash
 * algorithm as the PBR sphere. Catalog thumbnails remain cheap CSS/images.
 * Rendering a raw source scan beside a dyed sphere falsely implied they
 * represented the same colorway; this fixes the mismatch during inspection.
 */
export default function FabricScanFlatPreview({fabric={}}){
  const canvasRef=useRef(null)
  useEffect(()=>{
    const canvas=canvasRef.current
    const uri=fabric.texture?.src
    if(!canvas||!validScan(uri))return
    let cancelled=false
    const image=new Image()
    image.onload=()=>{
      if(cancelled)return
      const tinted=tintLicensedFabricScan(image,{color:fabric.color,wash:fabric.wash||null},{width:512,height:512})
      const ctx=canvas.getContext('2d')
      if(!ctx)return
      canvas.width=512
      canvas.height=512
      ctx.drawImage(tinted||image,0,0,512,512)
      canvas.dataset.scanColorway=tinted?'toned':'source-fallback'
      canvas.dataset.scanAssetId=fabric.texture?.scanAssetId||''
    }
    image.onerror=()=>{if(!cancelled)canvas.dataset.scanColorway='unavailable'}
    image.src=uri
    return()=>{cancelled=true;image.onload=null;image.onerror=null;image.src=''}
  },[fabric])
  return <div className="exo-fabric-hover-flat" style={fabricSwatchStyle(fabric)}>
    {validScan(fabric.texture?.src)&&<canvas ref={canvasRef}
      className="exo-fabric-hover-flat-canvas"
      aria-label={`${fabric.name||'Fabric'} photographic weave tinted to selected colorway`}/>}
    <FabricScanMacroPreview fabric={fabric}/>
    <span>FLAT TEXTURE · COLORWAY</span>
  </div>
}
