// An openly implementable photo-to-PBR approximation. The normal channel
// derives from lightness variation; it cannot measure true yarn geometry,
// directional BRDFs or mechanical textile behavior like a fabric scanner.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const linear = channel => {
  const c = channel / 255
  return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4
}

export function estimateFabricPbrPixels(imageData, {normalStrength = 2} = {}) {
  const {width, height, data} = imageData
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 ||
      !data || data.length < width * height * 4) throw new Error('Invalid fabric image pixels')
  const luminance = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4
    luminance[i] = .2126 * linear(data[offset]) + .7152 * linear(data[offset+1]) + .0722 * linear(data[offset+2])
  }
  const sample = (x,y) => luminance[clamp(y,0,height-1)*width+clamp(x,0,width-1)]
  const normal = new Uint8ClampedArray(width * height * 4)
  const roughness = new Uint8ClampedArray(width * height * 4)
  const gain = clamp(Number(normalStrength) || 2,.1,8)
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    const index=(y*width+x)*4
    const dx=(sample(x+1,y)-sample(x-1,y))*.5 * gain
    const dy=(sample(x,y+1)-sample(x,y-1))*.5 * gain
    const reciprocal=1/Math.hypot(dx,dy,1)
    normal[index]=Math.round((1-dx*reciprocal)*127.5)
    normal[index+1]=Math.round((1-dy*reciprocal)*127.5)
    normal[index+2]=Math.round((1+reciprocal)*127.5)
    normal[index+3]=255
    let average=0, squared=0
    for (let by=-1;by<=1;by++) for (let bx=-1;bx<=1;bx++) {
      const value=sample(x+bx,y+by)
      average+=value
      squared+=value*value
    }
    average/=9
    const localVariance=Math.sqrt(Math.max(0,squared/9-average*average))
    const r=Math.round(clamp(198 + 150*localVariance,173,245))
    roughness[index]=roughness[index+1]=roughness[index+2]=r
    roughness[index+3]=255
  }
  return {width,height,normal,roughness,kind:'estimated-from-albedo'}
}

export async function generateFabricPbrFromImage(source, {maxSize=512,normalStrength=2}={}) {
  if (typeof document==='undefined' || typeof Image==='undefined') throw new Error('Requires a browser canvas')
  if (typeof source!=='string' || !source.startsWith('data:image/')) throw new Error('Requires an imported fabric image')
  const image=new Image()
  image.src=source
  await image.decode()
  const factor=Math.min(1,Math.max(16,Number(maxSize)||512)/Math.max(image.naturalWidth,image.naturalHeight))
  const width=Math.max(2,Math.round(image.naturalWidth*factor))
  const height=Math.max(2,Math.round(image.naturalHeight*factor))
  const canvas=document.createElement('canvas')
  canvas.width=width
  canvas.height=height
  const context=canvas.getContext('2d',{willReadFrequently:true})
  if (!context) throw new Error('Canvas pixel processing unavailable')
  context.drawImage(image,0,0,width,height)
  const sourcePixels=context.getImageData(0,0,width,height)
  const result=estimateFabricPbrPixels(sourcePixels,{normalStrength})
  const encode=pixels=>{
    const mapCanvas=document.createElement('canvas')
    mapCanvas.width=width
    mapCanvas.height=height
    const mapContext=mapCanvas.getContext('2d')
    if (!mapContext) throw new Error('Canvas PBR image export unavailable')
    const output=mapContext.createImageData(width,height)
    output.data.set(pixels)
    mapContext.putImageData(output,0,0)
    return mapCanvas.toDataURL('image/png')
  }
  return {
    normalSrc:encode(result.normal),
    roughnessSrc:encode(result.roughness),
    width,height,method:'estimated-from-albedo',
  }
}
