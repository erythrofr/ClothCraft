import * as THREE from 'three'
import { normalizeFabricOptics, textileAlbedoMultiplier } from './fabricSurfaceModel.js'
import { normalizeWashSpec } from './clothWashProcedurals.js'
import { washPixelColor } from './clothWashImage.js'

const TWO_PI = Math.PI * 2
const fract = x => x - Math.floor(x)
const periodicNoise = (u, v) => {
  // Periodic, deterministic fine fibre irregularity. Seamless at the 3 cm
  // tile edges and stable across renders; no per-frame random noise/flicker.
  const a = Math.sin(TWO_PI * (13*u+19*v))
  const b = Math.cos(TWO_PI * (37*u-23*v))
  const c = Math.sin(TWO_PI * (59*u+43*v))
  return (a*.52+b*.31+c*.17)
}

// Simple periodic yarn geometry rather than the same crossed sinusoid for
// every woven textile. A weave has two distinct yarn systems; which yarn
// floats above the other varies by interlacement. These are procedural
// approximations, NOT microscopy scans or mechanical textile calibration.
function wovenYarnRelief(u, v, threads = 32, interlacement = 'plain') {
  // Integer yarn counts ensure that the generated tile is seamless.
  const warp = Math.pow((Math.cos(TWO_PI * threads * u) + 1) * .5, 1.8)
  const weft = Math.pow((Math.cos(TWO_PI * threads * v) + 1) * .5, 1.8)
  const warpId = Math.floor(threads * u + .5)
  const weftId = Math.floor(threads * v + .5)
  let warpAbove = (warpId + weftId) % 2 === 0
  if (interlacement === 'twill') warpAbove = ((warpId + weftId) % 4 + 4) % 4 !== 0
  if (interlacement === 'satin') warpAbove = ((warpId + 2 * weftId) % 5 + 5) % 5 !== 0
  // Cross-over only modulates where both yarns meet; zero at the edges of
  // each thread, avoiding discontinuous shading/normal-map steps.
  return .40 * warp + .40 * weft + (warpAbove ? .23 : -.23) * warp * weft
}

export function describeTextileSurface(fabric={}) {
  const optics = normalizeFabricOptics(fabric)
  const name = String(fabric.name || fabric.id || '').toLowerCase()
  let family = 'plain-weave'
  if (/quilted|batting/.test(name))family='quilted'
  else if (/neoprene|laminated foam/.test(name))family='foam-laminate'
  else if (/ripstop/.test(name)) family = 'ripstop'
  else if (/corduroy|wale/.test(name)) family = 'corduroy'
  else if (/velvet|velour|plush/.test(name)) family = 'velvet'
  else if (/organza|chiffon|voile/.test(name)) family = 'sheer-weave'
  else if (/rib/.test(name)) family = 'rib-knit'
  else if (/jersey|single.?knit|cotton.?knit|tee/.test(name)) family = 'jersey-knit'
  else if (/fleece|terry/.test(name)) family = 'terry-knit'
  else if (/denim|jean|twill/.test(name)) family = 'twill'
  else if (/suede|nap/.test(name)) family = 'suede'
  else if (/leather/.test(name)) family = 'leather'
  else if (/silk|satin/.test(name)) family = 'silk'
  else if (/nylon|polyester/.test(name)) family = 'synthetic'
  // Preserve functional structure details for these two composite families,
  // even when an older project had a generic surfaceFamily='synthetic'.
  if (fabric.surfaceFamily && fabric.surfaceFamily !== 'auto' &&
      !/quilted|batting|neoprene|laminated foam/.test(name)) family = fabric.surfaceFamily
  const tileCm = optics.weaveScaleCm
  const meshTopology=family==='mesh'
    ?(/tulle|netting/.test(name)?'tulle-net'
      :/power.?mesh|compression.?mesh/.test(name)?'power-mesh'
      :/athletic|sport|polyester.?mesh/.test(name)?'athletic-mesh'
      :'mesh-grid')
    :null
  const normalGain = {
    'jersey-knit': .76, 'rib-knit': .88, 'terry-knit': 1.04,
    'waffle-knit': 1.07, 'fleece-pile': 1.0, 'basket-weave': .85,
    crepe: .72, boucle: 1.10, mesh: .86,
    twill: .88, 'plain-weave': .75, synthetic: .46,
    silk: .30, suede: .66, leather: .67, ripstop: .63,
    velvet: .82, 'sheer-weave': .27, corduroy: 1.05,
    'foam-laminate': .62, quilted: 1.20,
  }[family] ?? .75
  return {family, tileCm, normalGain,meshTopology}
}

const smoothstep=(left,right,value)=>{
 const x=Math.max(0,Math.min(1,(value-left)/(right-left)))
 return x*x*(3-2*x)
}

/** Structure-dependent thread masks for the three core garment meshes.
 * These are periodic approximate 2D yarn silhouettes, NOT knitted yarn
 * topology, and they must never alter physical solver collision holes.
 */
export function meshYarnCoverage(topology='mesh-grid',u=0,v=0) {
 if(topology==='tulle-net'){
  // Bias net: repeating triangular/diamond strands, mostly open.
  const a=Math.abs(Math.sin(TWO_PI*12*(u+v)))
  const b=Math.abs(Math.sin(TWO_PI*12*(u-v)))
  return 1-smoothstep(.105,.185,Math.min(a,b))
 }
 if(topology==='power-mesh'){
  // Dense diagonal stable-elastic net with broader load-carrying yarns.
  const a=Math.abs(Math.sin(TWO_PI*14*(u+v)))
  const b=Math.abs(Math.sin(TWO_PI*14*(u-v)))
  return 1-smoothstep(.28,.48,Math.min(a,b))
 }
 if(topology==='athletic-mesh'){
  // Circular ventilation holes embedded in an otherwise closed knit.
  const s=Math.cos(TWO_PI*12*u),t=Math.cos(TWO_PI*12*v)
  const radius=Math.sqrt((1-s)*.5+(1-t)*.5)
  return smoothstep(.36,.50,radius)
 }
 const a=Math.abs(Math.cos(TWO_PI*12*u))
 const b=Math.abs(Math.cos(TWO_PI*12*v))
 return smoothstep(.70,.88,Math.max(a,b))
}

export function textileRelief(family, u, v, meshTopology='mesh-grid') {
  const wx = TWO_PI * 28*u, wy = TWO_PI * 31*v
  const n = periodicNoise(u, v)
  if (family==='jersey-knit') return .42*Math.cos(wx+.64*Math.sin(wy))+.27*Math.cos(wy)+.10*n
  if (family==='rib-knit') return .56*Math.cos(TWO_PI*15*u)+.23*Math.cos(wx+.52*Math.sin(wy))+.13*n
  if (family==='corduroy') return .78*Math.cos(TWO_PI*14*u)+.12*Math.cos(TWO_PI*70*u)+.09*n
  if (family==='terry-knit') return .32*Math.cos(wx+.61*Math.sin(wy))+.23*Math.cos(wy)+.21*Math.cos(TWO_PI*(11*u+11*v))+.18*n
  if (family==='waffle-knit') {
    const cells=Math.cos(TWO_PI*9*u)*Math.cos(TWO_PI*9*v)
    return .45*Math.abs(cells)+.19*Math.cos(wx+.5*Math.sin(wy))+.13*n
  }
  if (family==='fleece-pile') return .32*Math.cos(TWO_PI*(41*u+29*v))*.5+.35*n+.15*Math.cos(TWO_PI*69*v)
  if (family==='basket-weave') return .73*wovenYarnRelief(u,v,22,'plain')+.13*Math.cos(TWO_PI*11*u)*Math.cos(TWO_PI*11*v)+.08*n
  if (family==='crepe') return .24*wovenYarnRelief(u,v,35)+.28*n+.12*Math.sin(TWO_PI*(61*u+47*v))
  if (family==='quilted') {
    // A raised repeating padded-cell appearance (NOT seam topology).
    const cells=(.5-.5*Math.cos(TWO_PI*5*u))*(.5-.5*Math.cos(TWO_PI*5*v))
    const stitchDistance=Math.min(Math.abs(Math.sin(TWO_PI*5*u)),Math.abs(Math.sin(TWO_PI*5*v)))
    return .83*cells-.16*Math.exp(-stitchDistance*16)+.10*n
  }
  if (family==='foam-laminate')return .17*n+.15*Math.cos(TWO_PI*(53*u+39*v))
  if (family==='boucle') return .21*wovenYarnRelief(u,v,14)+.36*Math.sin(TWO_PI*(23*u+19*v))**2+.2*n
  if (family==='mesh') {
    return .60*meshYarnCoverage(meshTopology,u,v)+.08*n
  }
  if (family==='twill') return wovenYarnRelief(u,v,32,'twill')+.09*n
  if (family==='silk') return .45*wovenYarnRelief(u,v,40,'satin')+.045*n
  if (family==='synthetic') return .20*Math.cos(TWO_PI*42*u)*Math.cos(TWO_PI*40*v)+.08*n
  if (family==='ripstop') {
    const plain=.62*wovenYarnRelief(u,v,36)
    // Raised reinforcing yarns at a periodic 6x6 intersection grid.
    const latticeU=Math.pow(Math.max(0,Math.cos(TWO_PI*6*u)),18)
    const latticeV=Math.pow(Math.max(0,Math.cos(TWO_PI*6*v)),18)
    return plain+.47*(latticeU+latticeV)+.05*n
  }
  if (family==='sheer-weave') return .30*wovenYarnRelief(u,v,44)+.03*n
  if (family==='velvet') return .33*Math.cos(TWO_PI*51*u)*Math.cos(TWO_PI*53*v)+.24*n
  if (family==='leather') return .23*Math.sin(TWO_PI*(7*u+13*v))*.5+.26*Math.cos(TWO_PI*(9*u-5*v))+.15*n
  if (family==='suede') return .23*n+.18*Math.sin(TWO_PI*(19*u+17*v))
  return wovenYarnRelief(u,v,32)+.095*n
}

function makeCanvasTexture(canvas, colorSpace, repeat, orientation=0) {
  const texture=new THREE.CanvasTexture(canvas)
  texture.wrapS=THREE.RepeatWrapping
  texture.wrapT=THREE.RepeatWrapping
  texture.colorSpace=colorSpace
  texture.anisotropy=8
  texture.repeat.set(repeat.x,repeat.y)
  texture.center.set(.5,.5)
  texture.rotation=orientation
  texture.needsUpdate=true
  return texture
}

// Default physical-fibre micro-normal + micro-roughness, without painting a
// fake photo over the swatch's real dyed color. Uploads always override the
// corresponding generated channel. Grain follows the same measured 3D UVs.
export function makeProceduralTextileMaps(fabric={}) {
  if (typeof document==='undefined') return null
  const spec=describeTextileSurface(fabric)
  const optics=normalizeFabricOptics(fabric)
  const wash=normalizeWashSpec(fabric.wash)
  const washed=wash.type!=='raw'&&wash.strength>0
  const rawHex=/^#[0-9a-f]{6}$/i.test(fabric.color||'')?fabric.color:'#b8b8b8'
  const dyedRgb=[1,3,5].map(i=>parseInt(rawHex.slice(i,i+2),16))
  const resolution=256
  const count=resolution*resolution
  const heights=new Float32Array(count)
  let minimum=Infinity,maximum=-Infinity
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++) {
    const value=textileRelief(spec.family,x/resolution,y/resolution,spec.meshTopology)
    heights[y*resolution+x]=value
    minimum=Math.min(minimum,value);maximum=Math.max(maximum,value)
  }
  const normalCanvas=document.createElement('canvas')
  const roughnessCanvas=document.createElement('canvas')
  const colorCanvas=document.createElement('canvas')
  const opacityCanvas=spec.family==='mesh'?document.createElement('canvas'):null
  normalCanvas.width=normalCanvas.height=roughnessCanvas.width=roughnessCanvas.height=colorCanvas.width=colorCanvas.height=resolution
  if(opacityCanvas)opacityCanvas.width=opacityCanvas.height=resolution
  const normalCtx=normalCanvas.getContext('2d', {willReadFrequently:false})
  const roughnessCtx=roughnessCanvas.getContext('2d', {willReadFrequently:false})
  const colorCtx=colorCanvas.getContext('2d', {willReadFrequently:false})
  const opacityCtx=opacityCanvas?.getContext('2d',{willReadFrequently:false})
  if (!normalCtx || !roughnessCtx || !colorCtx) return null
  const normalPixels=normalCtx.createImageData(resolution,resolution)
  const roughPixels=roughnessCtx.createImageData(resolution,resolution)
  const colorPixels=colorCtx.createImageData(resolution,resolution)
  const alphaPixels=opacityCtx?.createImageData(resolution,resolution)
  const gain=spec.normalGain*Math.max(.4,Math.min(1.6,Number(fabric.thickness||.002)/.002))
  const norm=(x,y)=>heights[((y+resolution)%resolution)*resolution+((x+resolution)%resolution)]
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++) {
    const idx=(y*resolution+x)*4
    const dx=(norm(x+1,y)-norm(x-1,y))*.5
    const dy=(norm(x,y+1)-norm(x,y-1))*.5
    const nx=-dx*gain*2,ny=-dy*gain*2,nz=1
    const inverse=1/Math.hypot(nx,ny,nz)
    normalPixels.data[idx]=Math.round(127.5+127.5*nx*inverse)
    normalPixels.data[idx+1]=Math.round(127.5+127.5*ny*inverse)
    normalPixels.data[idx+2]=Math.round(127.5+127.5*nz*inverse)
    normalPixels.data[idx+3]=255
    const variation=(heights[y*resolution+x]-minimum)/Math.max(1e-6,maximum-minimum)
    const baseRoughness={silk:190,'sheer-weave':204,synthetic:214,leather:212,
      'waffle-knit':240,'fleece-pile':251,'basket-weave':232,
      crepe:238,boucle:249,mesh:231,
      twill:231,'jersey-knit':235,'rib-knit':230,'terry-knit':246,
      velvet:245,corduroy:247,suede:250,ripstop:221,'plain-weave':234}[spec.family] ?? 232
    const roughness=Math.round(Math.max(0,Math.min(255,baseRoughness+(variation-.5)*22)))
    roughPixels.data[idx]=roughPixels.data[idx+1]=roughPixels.data[idx+2]=roughness
    roughPixels.data[idx+3]=255
    const multiplier=textileAlbedoMultiplier(spec.family,x/resolution,y/resolution,optics.colorVariation)
    const channel=Math.round(multiplier*255)
    if(washed){
      // Bake the actual dyed base color first, then non-destructively grade a
      // tileable digital wash. Garment shader switches to white tint, so dark
      // denim can fade lighter rather than being multiplied by dark pigment.
      const faded=washPixelColor(dyedRgb.map(c=>Math.round(c*multiplier)),x/resolution,y/resolution,wash)
      colorPixels.data[idx]=faded[0];colorPixels.data[idx+1]=faded[1];colorPixels.data[idx+2]=faded[2]
    } else {
      colorPixels.data[idx]=colorPixels.data[idx+1]=colorPixels.data[idx+2]=channel
    }
    colorPixels.data[idx+3]=255
    if(alphaPixels){
      // Per-construction alpha yarn apertures. Yarn itself stays optically
      // opaque; separate cutout avoids making the cloth ghost-transparent.
      // This is not physical holes in the collision/tearing mesh.
      const alpha=Math.round(255*meshYarnCoverage(spec.meshTopology,x/resolution,y/resolution))
      alphaPixels.data[idx]=alphaPixels.data[idx+1]=alphaPixels.data[idx+2]=alpha
      alphaPixels.data[idx+3]=255
    }
  }
  normalCtx.putImageData(normalPixels,0,0)
  roughnessCtx.putImageData(roughPixels,0,0)
  colorCtx.putImageData(colorPixels,0,0)
  if(opacityCtx)opacityCtx.putImageData(alphaPixels,0,0)
  // createGeometry produces UV = localPatternCm / fabric.repeatWidthCm.
  // Scale the procedural map so one yarn tile is truly 3 cm, even alongside
  // a large user-uploaded photographic color texture with its own repeat.
  const repeat={
    x:Math.max(.5,Number(fabric.texture?.repeatWidthCm??20))/spec.tileCm,
    y:Math.max(.5,Number(fabric.texture?.repeatHeightCm??20))/spec.tileCm,
  }
  const rotation=THREE.MathUtils.degToRad(Number(fabric.texture?.rotationDeg || 0))
  return {
    colorMap:makeCanvasTexture(colorCanvas,THREE.SRGBColorSpace,repeat,rotation),
    normalMap:makeCanvasTexture(normalCanvas,THREE.NoColorSpace,repeat,rotation),
    roughnessMap:makeCanvasTexture(roughnessCanvas,THREE.NoColorSpace,repeat,rotation),
    alphaMap:opacityCanvas?makeCanvasTexture(opacityCanvas,THREE.NoColorSpace,repeat,rotation):null,
    family:spec.family,
    tileCm:spec.tileCm,
  }
}
