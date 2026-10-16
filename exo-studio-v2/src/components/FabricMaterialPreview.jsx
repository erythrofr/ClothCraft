import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { makeProceduralTextileMaps } from '../core/textileProcedurals.js'
import { normalizeFabricOptics } from '../core/fabricSurfaceModel.js'
import { normalizeWashSpec } from '../core/clothWashProcedurals.js'
import { washTextureImage } from '../core/clothWashImage.js'
import { tintLicensedFabricScan } from '../core/photographicScanToning.js'
import { balanceScannedRoughness,shouldBalanceFabricRoughness } from '../core/fabricPbrAppearance.js'

// Independent two-scale PBR preview (finish ball + real-centimeter fibre patch),
// not a second cloth solver. A full-size sphere alone hides a 0.5–1 mm yarn
// pattern after texture minification, making dramatically different textiles
// appear incorrectly identical. The patch explicitly shows a 1.8 cm sample.
export default function FabricMaterialPreview({fabric = {}}) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const viewRef = useRef(null)
  const mapsRef = useRef([])
  const mapKeyRef = useRef('')
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'low-power'})
    } catch {
      setUnavailable(true)
      return undefined
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2))
    renderer.setSize(260,172)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.domElement.setAttribute('aria-label','3D fabric material ball preview')
    renderer.domElement.style.width='100%'
    renderer.domElement.style.height='100%'
    container.append(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#282c32')
    const camera = new THREE.PerspectiveCamera(38,260/172,.1,20)
    camera.position.set(0,.04,3.6)
    scene.add(new THREE.HemisphereLight('#f7f9ff','#454149',2.1))
    const key=new THREE.DirectionalLight('#ffffff',3.25)
    key.position.set(-2.3,3,4)
    scene.add(key)
    const fill=new THREE.DirectionalLight('#acccff',1.45)
    fill.position.set(3,-1,1)
    scene.add(fill)
    const material=new THREE.MeshPhysicalMaterial({color:'#c4c4c4',roughness:.85,side:THREE.DoubleSide})
    const geometry=new THREE.SphereGeometry(.79,96,64)
    const mesh=new THREE.Mesh(geometry,material)
    mesh.position.x=-.91
    scene.add(mesh)
    const swatchGeometry=new THREE.PlaneGeometry(1.56,1.56,20,20)
    const swatch=new THREE.Mesh(swatchGeometry,material)
    swatch.position.x=.92
    swatch.rotation.y=-.12
    scene.add(swatch)
    const macroUvs=swatchGeometry.getAttribute('uv')
    const macroBaseUvs=Float32Array.from(macroUvs.array)
    const setMacroScale=(fabric)=>{
      const widthCm=Math.max(.5,Number(fabric?.texture?.repeatWidthCm ?? 20)||20)
      const heightCm=Math.max(.5,Number(fabric?.texture?.repeatHeightCm ?? 20)||20)
      for(let i=0;i<macroUvs.count;i++) {
        macroUvs.setXY(i,macroBaseUvs[i*2]*1.8/widthCm,macroBaseUvs[i*2+1]*1.8/heightCm)
      }
      macroUvs.needsUpdate=true
    }
    const render=()=>renderer.render(scene,camera)
    const move=(event)=>{
      const bounds=renderer.domElement.getBoundingClientRect()
      const x=Math.max(0,Math.min(1,(event.clientX-bounds.left)/Math.max(1,bounds.width)))
      const y=Math.max(0,Math.min(1,(event.clientY-bounds.top)/Math.max(1,bounds.height)))
      mesh.rotation.y=(x-.5)*.85
      mesh.rotation.x=(y-.5)*.45
      swatch.rotation.y=(x-.5)*.24
      swatch.rotation.x=(y-.5)*.12
      render()
    }
    renderer.domElement.addEventListener('pointermove',move)
    rendererRef.current=renderer
    viewRef.current={material,render,setMacroScale}
    render()
    return ()=>{
      renderer.domElement.removeEventListener('pointermove',move)
      mapsRef.current.forEach(map=>map?.dispose?.())
      mapsRef.current=[]
      mapKeyRef.current=''
      material.dispose()
      geometry.dispose()
      swatchGeometry.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      viewRef.current=null
      rendererRef.current=null
    }
  },[])

  useEffect(()=>{
    const view=viewRef.current
    if (!view) return
    const optics=normalizeFabricOptics(fabric)
    const wash=normalizeWashSpec(fabric.wash)
    const washed=wash.type!=='raw' && wash.strength>0
    const licensedPhoto=Boolean(fabric.texture?.scanAssetId)
    const material=view.material
    material.color.set((washed||licensedPhoto)?'#ffffff':fabric.color || '#c4c4c4')
    material.roughness=optics.roughness
    material.metalness=optics.metalness
    material.normalScale.set(optics.normalStrength,optics.normalStrength)
    material.sheen=optics.sheen
    material.sheenRoughness=optics.sheenRoughness
    material.anisotropy=optics.anisotropy
    material.anisotropyRotation=optics.anisotropyRotation
    material.clearcoat=optics.clearcoat
    material.clearcoatRoughness=optics.clearcoatRoughness
    material.displacementScale=optics.displacementMm/1000
    material.displacementBias=-optics.displacementMm/2000
    material.transparent=optics.opacity < .99 || Boolean(fabric.texture?.opacitySrc)
    material.opacity=optics.opacity
    material.depthWrite=optics.opacity >= .99 && !fabric.texture?.opacitySrc

    const texture=fabric.texture || {}
    const signature=JSON.stringify([fabric.name,fabric.surfaceFamily,fabric.weaveScaleCm,
      fabric.colorVariation,fabric.thickness,texture.src,texture.normalSrc,
      texture.roughnessSrc,texture.metalnessSrc,texture.opacitySrc,texture.displacementSrc,
      texture.repeatWidthCm,texture.repeatHeightCm,texture.rotationDeg,fabric.wash,fabric.color])
    if (signature !== mapKeyRef.current) {
      const generated=makeProceduralTextileMaps(fabric)
      const loader=new THREE.TextureLoader()
      const owned=[]
      const load=(field,isColor,fallback)=>{
        const src=texture[field]
        if (!src) return fallback
        fallback?.dispose?.()
        const loaded=loader.load(src,(value)=>{
          if((isColor&&(washed||licensedPhoto)) ||
             (field==='roughnessSrc'&&shouldBalanceFabricRoughness(fabric))){
            const original=value.image
            const dimensions={
              width:Math.min(768,original?.naturalWidth||original?.width||512),
              height:Math.min(768,original?.naturalHeight||original?.height||512),
            }
            const canvas=field==='roughnessSrc'
              ? balanceScannedRoughness(original,fabric,dimensions)
              : licensedPhoto
              ? tintLicensedFabricScan(original,fabric,dimensions)
              : washTextureImage(original,wash,dimensions)
            if(canvas){value.image=canvas;value.needsUpdate=true}
          }
          view.render()
        },undefined,()=>view.render())
        loaded.wrapS=THREE.RepeatWrapping
        loaded.wrapT=THREE.RepeatWrapping
        loaded.colorSpace=isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace
        loaded.rotation=THREE.MathUtils.degToRad(Number(texture.rotationDeg||0))
        loaded.center.set(.5,.5)
        owned.push(loaded)
        return loaded
      }
      const albedo=load('src',true,generated?.colorMap||null)
      const normal=load('normalSrc',false,generated?.normalMap||null)
      const roughness=load('roughnessSrc',false,generated?.roughnessMap||null)
      const metalness=load('metalnessSrc',false,null)
      const opacity=load('opacitySrc',false,generated?.alphaMap||null)
      const displacement=load('displacementSrc',false,null)
      mapsRef.current.forEach(map=>map?.dispose?.())
      mapsRef.current=[albedo,normal,roughness,metalness,opacity,displacement,...owned]
        .filter((map,index,array)=>Boolean(map) && array.indexOf(map)===index)
      view.setMacroScale(fabric)
      material.map=albedo
      material.normalMap=normal
      material.roughnessMap=roughness
      material.metalnessMap=metalness
      material.alphaMap=opacity
      material.alphaTest=Boolean(generated?.alphaMap)&&!texture.opacitySrc ? .40 : 0
      material.displacementMap=displacement
      material.needsUpdate=true
      mapKeyRef.current=signature
    }
    view.render()
  },[fabric])

  return <div className="fabric-material-preview">
    <div className="fabric-material-preview-canvas" ref={containerRef} style={{background:fabric.color||'#777'}}>
      {unavailable && <span>3D preview unavailable · garment material remains editable</span>}
    </div>
    <div className="fabric-material-preview-meta"><strong>LIVE PBR · YARN CLOSEUP</strong><span>Finish / 1.8 cm textile · move to rotate</span></div>
  </div>
}
