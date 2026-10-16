import {normalizeWashSpec, washRgbMultiplier} from './clothWashProcedurals.js'

// Visual pigment and wash preview; color-space-aware enough for browser sRGB
// swatches without pretending to simulate actual chemical treatment.
const clamp = (x, max = 255) => Math.max(0, Math.min(max, Number.isFinite(x) ? x : 0))
const byte = x => Math.round(clamp(Number(x)))
const srgbToLinear = c => { const x = clamp(c) / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4 }
const linearToSrgb = x => { const y = Math.max(0, Math.min(1, x)); return byte(255 * (y <= .0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - .055)) }

/** Pure RGB 0–255 preview. Raw or strength=0 preserves original bytes. */
export function washPixelColor(baseRgb, u, v, washSpec = {}) {
  const base = [0, 1, 2].map(i => byte(Array.isArray(baseRgb) || ArrayBuffer.isView(baseRgb) ? baseRgb[i] : baseRgb?.[['r', 'g', 'b'][i]]))
  const spec = normalizeWashSpec(washSpec)
  if (spec.type === 'raw' || spec.strength === 0) return base
  const m = washRgbMultiplier(u, v, spec)
  return washPixelColorWithMultiplier(base,m)
}

/** Fast path for photographed 1K color maps: expensive procedural Fourier
 * masks can be rasterized once, while per-pixel sRGB pigment grading is kept.
 */
export function washPixelColorWithMultiplier(baseRgb,m=[1,1,1]) {
  const base = [0,1,2].map(i=>byte(baseRgb[i]))
  const linear = base.map(srgbToLinear)
  const luminosity = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722
  const saturation = (Math.max(...base) - Math.min(...base)) / 255
  const neutralize = Math.min(.85, .2 + saturation * .48)
  return linear.map((channel, i) => {
    const delta = m[i] - 1
    // Fading lifts even dark dye into a bright, less saturated shade. Keep
    // pigment detail instead of clipping multipliers against a dark base.
    const faded = delta >= 0
      ? channel + (1 - channel) * (1 - Math.exp(-Math.max(0, delta) * 1.9)) * (1 - neutralize * .18)
      : channel * Math.exp(delta * 1.55)
    const target = delta >= 0 ? luminosity + (1 - luminosity) * (1 - Math.exp(-delta * 1.9)) : faded
    const mixed = delta >= 0 ? faded * (1 - neutralize * .28) + target * neutralize * .28 : faded
    return linearToSrgb(mixed)
  })
}

/** Periodic interpolation of one reusable digital wash mask, with bounds.
 * Rasterizing a 128-256 px torus before applying a 1024 px photographic
 * color image is materially faster than resampling five noise octaves for
 * every image pixel, with no 3D-solver changes.
 */
export function createWashMultiplierLut(input={},size=192) {
  const spec=normalizeWashSpec(input)
  const width=Math.min(512,Math.max(16,Math.round(Number(size)||192)))
  const data=new Float32Array(width*width*3)
  if(spec.type==='raw'||spec.strength===0)data.fill(1)
  else for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    const rgb=washRgbMultiplier(x/width,y/width,spec)
    const offset=(y*width+x)*3
    data[offset]=rgb[0];data[offset+1]=rgb[1];data[offset+2]=rgb[2]
  }
  return {size:width,data}
}

export function sampleWashMultiplierLut(lut,u,v) {
  const size=lut?.size,data=lut?.data
  if(!Number.isSafeInteger(size)||size<=0||data?.length!==size*size*3)return [1,1,1]
  const x=((Number.isFinite(u)?u:0)%1+1)%1*size
  const y=((Number.isFinite(v)?v:0)%1+1)%1*size
  const ix=Math.floor(x),iy=Math.floor(y),xx=x-ix,yy=y-iy
  const i2=(ix+1)%size,j2=(iy+1)%size
  const idx=(cx,cy,k)=>(cy*size+cx)*3+k
  return [0,1,2].map(k=>{
    const top=data[idx(ix,iy,k)]*(1-xx)+data[idx(i2,iy,k)]*xx
    const bottom=data[idx(ix,j2,k)]*(1-xx)+data[idx(i2,j2,k)]*xx
    return top*(1-yy)+bottom*yy
  })
}

const hexColor = hex => {
  const raw = String(hex ?? '').trim().replace(/^#/, '')
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return null
  const full = raw.length === 3 ? [...raw].map(c => c + c).join('') : raw
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16))
}

const size = (value, fallback) => {
  const n = Number(value ?? fallback)
  return Number.isFinite(n) && n > 0 && n <= 8192 ? Math.floor(n) || 1 : null
}

/** Synchronous browser helper. Returns null on missing DOM, unloaded/tainted
 * imagery or unsupported canvas; never resets sourceImage.crossOrigin since
 * changing it after load could trigger a new unsafe request.
 *
 * sourceImage may be an HTMLImageElement, HTMLCanvasElement, ImageBitmap or
 * another drawImage-compatible object. When omitted, baseColorHex creates a
 * uniformly dyed swatch. Source alpha is preserved.
 */
export function washTextureImage(sourceImage, washSpec = {}, {baseColorHex, width, height} = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null
  const base = hexColor(baseColorHex)
  if (!sourceImage && !base) return null
  const naturalWidth = sourceImage?.naturalWidth ?? sourceImage?.videoWidth ?? sourceImage?.width
  const naturalHeight = sourceImage?.naturalHeight ?? sourceImage?.videoHeight ?? sourceImage?.height
  const w = size(width, sourceImage ? naturalWidth : 256)
  const h = size(height, sourceImage ? naturalHeight : 256)
  if (!w || !h) return null
  if (sourceImage && (sourceImage.complete === false || sourceImage.naturalWidth === 0 || sourceImage.naturalHeight === 0)) return null
  try {
    const canvas = document.createElement('canvas')
    if (!canvas) return null
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', {willReadFrequently: true})
    if (!ctx) return null
    if (sourceImage) ctx.drawImage(sourceImage, 0, 0, w, h)
    else { ctx.fillStyle = '#' + base.map(c => c.toString(16).padStart(2, '0')).join(''); ctx.fillRect(0, 0, w, h) }
    const pixels = ctx.getImageData(0, 0, w, h)
    const data = pixels.data
    const spec = normalizeWashSpec(washSpec)
    if (spec.type === 'raw' || spec.strength === 0) return canvas
    const lut=createWashMultiplierLut(spec)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const index = (y * w + x) * 4
      if (data[index + 3] === 0) continue
      const c = washPixelColorWithMultiplier([data[index], data[index + 1], data[index + 2]],
        sampleWashMultiplierLut(lut,x/w,y/h))
      data[index] = c[0]
      data[index + 1] = c[1]
      data[index + 2] = c[2]
    }
    ctx.putImageData(pixels, 0, 0)
    return canvas
  } catch {
    // Canvas security errors from cross-origin images, unsupported drawImage,
    // and context errors all safely decline a preview.
    return null
  }
}
