import * as THREE from 'three'
import {presetForFabric} from './clothcraftFabrics.js'
import {normalizeWashSpec} from './clothWashProcedurals.js'
import {washPixelColor} from './clothWashImage.js'
import {tintLicensedFabricScan} from './photographicScanToning.js'
import {balanceScannedRoughness} from './fabricPbrAppearance.js'
// Tile = 8 yarn pitches in metre-based rest UVs, independent of panel size/drape.
const tau=2*Math.PI
// Periodic micro-irregularity avoids a visible discontinuity at texture tile edges.
const noise=(x,y)=>.5+.27*Math.sin(tau*(13*x+19*y)/64)+.23*Math.cos(tau*(17*x-11*y)/64)
const clamp01=x=>Math.max(0,Math.min(1,x))
function relief(kind,u,v,x,y) {
 const warp=(Math.cos(u*tau)+1)*.5
 const weft=(Math.cos(v*tau)+1)*.5
 const grain=noise(x,y)-.5
 if (kind==='twill') return clamp01(.27*warp+.27*weft+.28*Math.sin((u-v)*tau*.25)+.10*grain+.13)
 if (kind==='jersey-knit'||kind==='knit') return clamp01(.48+.25*Math.cos(u*tau+Math.sin(v*tau)*.55)+.14*Math.cos(v*tau)+.09*grain)
 if (kind==='rib-knit')return clamp01(.5+.32*Math.cos(u*tau*.5)+.12*Math.cos(v*tau)+.07*grain)
 if (kind==='waffle-knit')return clamp01(.2+.44*Math.abs(Math.cos(u*tau*.5)*Math.cos(v*tau*.5))+.09*grain)
 if (kind==='terry-knit'||kind==='fleece-pile')return clamp01(.52+.13*Math.cos(u*tau+.7*Math.sin(v*tau))+.12*Math.cos(v*tau*1.5)+.17*grain)
 if (kind==='basket-weave')return clamp01(.30+.22*Math.cos(u*tau*.5)+.22*Math.cos(v*tau*.5)+.09*grain)
 if (kind==='corduroy')return clamp01(.43+.33*Math.cos(u*tau*.5)+.07*grain)
 if (kind==='velvet'||kind==='boucle')return clamp01(.48+.22*Math.cos(u*tau*2)*Math.cos(v*tau*2)+.16*grain)
 if (kind==='crepe')return clamp01(.49+.09*(warp+weft)+.25*grain)
 if (kind==='mesh')return clamp01(.14+.8*Math.max(Math.pow(warp,5),Math.pow(weft,5)))
 if (kind==='suede')return clamp01(.48+.24*grain+.1*Math.sin((u*.41+v*.15)*tau))
 if (kind==='leather')return clamp01(.49+.12*Math.sin((u*.47+v*.29)*tau)+.12*Math.sin((u*.59-v*.33)*tau)+.12*grain)
 if (kind==='synthetic'||kind==='silk')return clamp01(.50+.11*warp+.11*weft+.04*grain)
 if (kind==='ripstop') return clamp01(.33+.12*warp+.12*weft+.31*Math.pow(Math.cos(u*tau*.125),18)+.09*grain)
 return clamp01(.3+.26*warp+.26*weft+.08*grain)
}
export function createFabricSurface(fabric,grainDegrees=0) {
 const preset=presetForFabric(fabric),a=preset?.appearance
 const wash=normalizeWashSpec(preset?.wash)
 const washed=wash.type!=='raw'&&wash.strength>0
 const material=new THREE.MeshPhysicalMaterial({
  color:washed?'#ffffff':a?.color||'#b8b4ab',side:THREE.DoubleSide,metalness:0,
  roughness:a?.roughness??.85,sheen:a?.sheen??.2,
  sheenColor:new THREE.Color('#eee9df'),sheenRoughness:.75,
  clearcoat:/patent|coated|waxed/i.test(preset?.name||'') ? .38 : 0,
  clearcoatRoughness:.28,
  anisotropy:/silk|satin|suede|velvet|twill|denim/i.test(preset?.name||'') ? .33 : .08,
 })
 material.userData.fabricPreset=preset?.id||'custom'
 material.userData.washEffect=washed?wash.type:'raw'
 if(!a)return material
 const size=64,data=new Uint8Array(size*size*4),albedo=new Uint8Array(size*size*4)
 const dyed=/^#[\da-f]{6}$/i.test(a.color||'')?[1,3,5].map(i=>parseInt(a.color.slice(i,i+2),16)):[184,180,171]
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/8,v=y/8,h=relief(a.weave,u,v,x,y)
  const n=(y*size+x)*4
  data[n]=data[n+1]=data[n+2]=Math.round(85+h*105);data[n+3]=255
  // A neutral dye multiplier lets woven crossings / nap catch the studio
  // lighting without overriding assigned fabric color or providing a photo.
  const dye=Math.round(Math.max(208,Math.min(255,229+(h-.5)*28)))
  if(washed){
   const result=washPixelColor(dyed.map(channel=>Math.round(channel*dye/255)),x/size,y/size,wash)
   albedo[n]=result[0];albedo[n+1]=result[1];albedo[n+2]=result[2]
  } else {
   albedo[n]=albedo[n+1]=albedo[n+2]=dye
  }
  albedo[n+3]=255
 }
 const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat)
 const color=new THREE.DataTexture(albedo,size,size,THREE.RGBAFormat)
 const repeats=1/(Math.max(.00015,Number(a.pitch)||.001)*8)
 for (const texture of [map,color]) {
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping
  texture.repeat.set(repeats,repeats);texture.rotation=grainDegrees*Math.PI/180
  texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter
  texture.magFilter=THREE.LinearFilter;texture.anisotropy=8;texture.needsUpdate=true
 }
 color.colorSpace=THREE.SRGBColorSpace
 map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.needsUpdate=true
 material.bumpMap=map
 material.map=color
 material.bumpScale=a.weave==='suede'?.000022 : a.weave==='leather'?.000065 : a.weave==='fleece-pile'?.00011 : .000055
 const owned=[map,color]
 let disposed=false
 const photo=preset?.photoScan
 if(photo?.scanAssetId&&typeof document!=='undefined'){
  const loader=new THREE.TextureLoader()
  const repeat={x:1/(Math.max(.5,photo.repeatWidthCm)*.01),y:1/(Math.max(.5,photo.repeatHeightCm)*.01)}
  const load=(source,key,colorChannel)=>{
   if(!source)return
   const texture=loader.load(source,(loaded)=>{
    if(disposed)return
    if(colorChannel){
      const graded=tintLicensedFabricScan(loaded.image,{
        color:photo.color, wash:photo.wash,
      },{width:Math.min(768,loaded.image?.naturalWidth||1024),height:Math.min(768,loaded.image?.naturalHeight||1024)})
      if(graded){
       loaded.image=graded;loaded.needsUpdate=true
       // Avoid multiplying the manufactured colour twice. If a canvas is
       // unavailable, leave the original dyed material tint in place.
       material.color.set('#ffffff')
      }
      material.map=loaded
    }else if(key==='normalMap'){
      material.normalMap=loaded;material.bumpMap=null
      material.normalScale=new THREE.Vector2(.65,.65)
    }else {
      const graded=balanceScannedRoughness(loaded.image,{
        name:preset.name,
        texture:photo,
      },{width:Math.min(768,loaded.image?.naturalWidth||1024),height:Math.min(768,loaded.image?.naturalHeight||1024)})
      if(graded){loaded.image=graded;loaded.needsUpdate=true}
      material.roughnessMap=loaded
    }
    material.needsUpdate=true
   })
   texture.wrapS=texture.wrapT=THREE.RepeatWrapping
   texture.repeat.set(repeat.x,repeat.y)
   texture.colorSpace=colorChannel?THREE.SRGBColorSpace:THREE.NoColorSpace
   texture.anisotropy=8
   texture.needsUpdate=true
   owned.push(texture)
  }
  load(photo.src,'map',true)
  load(photo.normalSrc,'normalMap',false)
  load(photo.roughnessSrc,'roughnessMap',false)
  material.userData.scanProvenance=photo.opticalProvenance
 }
 material.userData.ownedTexture={dispose(){
  disposed=true
  for(const texture of owned)texture.dispose()
 }}
 return material
}
