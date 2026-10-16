import { createWashMultiplierLut, sampleWashMultiplierLut, washPixelColorWithMultiplier } from './clothWashImage.js'
import { normalizeWashSpec } from './clothWashProcedurals.js'

const clip=(n,min,max)=>Math.min(max,Math.max(Number.isFinite(n)?n:min,min))
const targetRgb=hex=>/^#[\da-f]{6}$/i.test(hex||'')
 ?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)):[185,181,175]
const luminance=rgb=>(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])/255
const norm=(n)=>Math.round(clip(n,0,255))

/** Dye/tonal retargeting of a photographed CC0 scan to the EXO variant.
 * Preserves authentic yarn albedo contrast; NEVER asserts that the dyed
 * appearance matches a physical factory sample or alters scan normals.
 */
export function regradeScannedPixel(rgb, averageLuminance, desiredRgb) {
 const mean=clip(averageLuminance,.06,.94)
 const brightness=luminance(rgb)
 const ratio=clip(Math.pow((brightness+.075)/(mean+.075),.88),.45,1.65)
 // Retain small original slub/pattern hue variation, but change dominant dye.
 const hue=rgb.map(channel=>channel/255-brightness)
 return desiredRgb.map((channel,i)=>
   norm(channel*ratio+hue[i]*19*(.4+channel/255)))
}

/** Generate a swatch colorway from an original photographic scan.
 * Does not mutate the source image. Preserves alpha and returns null if
 * the image is unavailable, not origin-clean or the browser lacks canvas.
 */
export function tintLicensedFabricScan(sourceImage,fabric={}, options={}) {
 if(typeof document==='undefined'||typeof document.createElement!=='function'||!sourceImage)return null
 const width=Math.min(2048,Math.max(1,Math.trunc(Number(options.width||sourceImage.naturalWidth||sourceImage.width||512))))
 const height=Math.min(2048,Math.max(1,Math.trunc(Number(options.height||sourceImage.naturalHeight||sourceImage.height||512))))
 if(sourceImage.complete===false||sourceImage.naturalWidth===0||sourceImage.naturalHeight===0)return null
 try{
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const context=canvas.getContext('2d',{willReadFrequently:true})
  if(!context)return null
  context.drawImage(sourceImage,0,0,width,height)
  const pixels=context.getImageData(0,0,width,height),data=pixels.data
  let sum=0,count=0
  // The scan's average brightness, not source dye hue, drives yarn contrast.
  // A fixed power-of-two stride aliases regular weaving and ripstop grids.
  // Use complete small-swatch coverage or a coprime skip on larger photos.
  const stride=data.length<=16384?4:4*23
  for(let i=0;i<data.length;i+=stride){
   if(data[i+3]===0)continue
   sum+=luminance([data[i],data[i+1],data[i+2]]);count++
  }
  const mean=count?sum/count:.5
  const tint=targetRgb(fabric.color)
  const wash=normalizeWashSpec(fabric.wash)
  const washed=wash.type!=='raw'&&wash.strength>0
  const lut=washed?createWashMultiplierLut(wash,192):null
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const index=4*(y*width+x)
   if(data[index+3]===0)continue
   let color=regradeScannedPixel([data[index],data[index+1],data[index+2]],mean,tint)
   if(washed)color=washPixelColorWithMultiplier(color,
      sampleWashMultiplierLut(lut,x/width,y/height))
   data[index]=color[0];data[index+1]=color[1];data[index+2]=color[2]
  }
  context.putImageData(pixels,0,0)
  return canvas
 }catch{
  return null
 }
}
