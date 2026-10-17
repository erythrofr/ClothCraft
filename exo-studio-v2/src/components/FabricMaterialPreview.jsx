import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { makeProceduralTextileMaps } from '../core/textileProcedurals.js'
import { normalizeFabricOptics } from '../core/fabricSurfaceModel.js'
import { normalizeWashSpec } from '../core/clothWashProcedurals.js'
import { washTextureImage } from '../core/clothWashImage.js'
import { tintLicensedFabricScan } from '../core/photographicScanToning.js'
import { balanceScannedRoughness,shouldBalanceFabricRoughness } from '../core/fabricPbrAppearance.js'
import {createPreviewDrapeGeometry} from './FabricDrapeBallPreview.jsx'
import {FABRIC_BALL_SWATCH_CM} from '../core/fabricBallGeometry.js'
import {fabricSwatchRepeatDimensions} from '../core/fabricPbrAppearance.js'

// Independent two-scale PBR preview (finish ball + real-centimeter fibre patch),
// not a second cloth solver. A full-size sphere alone hides a 0.5–1 mm yarn
// pattern after texture minification, making dramatically different textiles
// appear incorrectly identical. The patch explicitly shows a 1.8 cm sample.
export default function FabricMaterialPreview({fabric = {}, onOpticalChange}) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const viewRef = useRef(null)
  const mapsRef = useRef([])
  const mapKeyRef = useRef('')
  const [unavailable, setUnavailable] = useState(false)
  const [viewMode, setViewMode] = useState('compare')
  const [lightAngle, setLightAngle] = useState(35)
  const [lightPower, setLightPower] = useState(2.8)
  const [macroWidth, setMacroWidth] = useState(1.8)

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
    renderer.setSize(320,228)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18
    renderer.domElement.setAttribute('aria-label','3D fabric material ball preview')
    renderer.domElement.style.width='100%'
    renderer.domElement.style.height='100%'
    container.append(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#101214')
    const camera = new THREE.PerspectiveCamera(38,320/228,.1,20)
    camera.position.set(0,.04,4.2)
    scene.add(new THREE.HemisphereLight('#f7f9ff','#37383d',1.25))
    const key=new THREE.DirectionalLight('#ffffff',2.8)
    key.position.set(-2.3,3,4)
    scene.add(key)
    const fill=new THREE.DirectionalLight('#ccd8ef',.75)
    fill.position.set(3,-1,1)
    scene.add(fill)
    // Broad edge lights reveal relief on dark textiles without baking a
    // white wash into the scanned albedo map or claiming physical reflectance.
    const rim=new THREE.DirectionalLight('#fff2df',1.3)
    rim.position.set(-3,-.8,-2)
    scene.add(rim)
    const material=new THREE.MeshPhysicalMaterial({color:'#c4c4c4',roughness:.85,side:THREE.DoubleSide})
    const geometry=new THREE.SphereGeometry(.76,96,64)
    const mesh=new THREE.Mesh(geometry,material)
    mesh.position.x=-.91
    scene.add(mesh)
    const swatchGeometry=new THREE.PlaneGeometry(1.56,1.56,20,20)
    const swatch=new THREE.Mesh(swatchGeometry,material)
    swatch.position.x=.92
    swatch.rotation.y=-.12
    scene.add(swatch)
    // The draped sheet is an optical demonstration of folds (no cloth solver).
    // It samples the SAME PBR maps that the actual garment viewport uses.
    const drapeGeometry=new THREE.PlaneGeometry(2.7,2.26,88,72)
    const positions=drapeGeometry.getAttribute('position')
    const drapeXY=Float32Array.from(positions.array)
    const drape=new THREE.Mesh(drapeGeometry,material)
    drape.rotation.x=-.08
    drape.visible=false
    scene.add(drape)
    const ball=new THREE.Mesh(createPreviewDrapeGeometry(),material)
    ball.visible=false
    scene.add(ball)
    // A blurred contact pool visually grounds the draped fabric without an
    // expensive realtime shadow pass on every fabric inspector instance.
    const shadowCanvas=document.createElement('canvas')
    shadowCanvas.width=128
    shadowCanvas.height=128
    const shadowContext=shadowCanvas.getContext('2d')
    if(shadowContext){
      const gradient=shadowContext.createRadialGradient(64,64,9,64,64,63)
      gradient.addColorStop(0,'rgba(0,0,0,.52)')
      gradient.addColorStop(.45,'rgba(0,0,0,.24)')
      gradient.addColorStop(1,'rgba(0,0,0,0)')
      shadowContext.fillStyle=gradient
      shadowContext.fillRect(0,0,128,128)
    }
    const shadowTexture=new THREE.CanvasTexture(shadowCanvas)
    const shadowGeometry=new THREE.PlaneGeometry(2.4,1.12)
    const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,opacity:.8,side:THREE.DoubleSide})
    const contactShadow=new THREE.Mesh(shadowGeometry,shadowMaterial)
    contactShadow.rotation.x=-Math.PI/2.8
    contactShadow.position.set(0,-1.1,-.33)
    scene.add(contactShadow)
    const drapeUVs=drapeGeometry.getAttribute('uv')
    const macroUvs=swatchGeometry.getAttribute('uv')
    const macroBaseUvs=Float32Array.from(macroUvs.array)
    const drapeBaseUvs=Float32Array.from(drapeUVs.array)
    let patchWidth=1.8
    let activeMode='compare'
    let disposed=false
    let currentFabric={}
    const setMacroScale=(fabric)=>{
      currentFabric=fabric
      ball.geometry.dispose()
      ball.geometry=createPreviewDrapeGeometry(fabric)
      const {repeatWidthCm:widthCm,repeatHeightCm:heightCm}=fabricSwatchRepeatDimensions(fabric?.texture)
      // The sculpted ball is a 270 cm sheet; its source UVs cover only [0,1].
      // Express those UVs in scan-sized tiles, like the flat macro/drape panels.
      const ballUVs=ball.geometry.getAttribute('uv')
      for(let i=0;i<ballUVs.count;i++)ballUVs.setXY(i,
        ballUVs.getX(i)*FABRIC_BALL_SWATCH_CM/widthCm,
        ballUVs.getY(i)*FABRIC_BALL_SWATCH_CM/heightCm)
      ballUVs.needsUpdate=true
      // Broad optical fold style reflects the EXO *estimated* bend and mass
      // categories. Accurate gravity, collision and stress belong to XPBD.
      const bend=Math.max(.1,Math.min(1.3,Number(fabric?.bend??.65)))
      const gsm=Math.max(60,Math.min(900,Number(fabric?.gsm??300)))
      const looseness=Math.max(.55,Math.min(1.55,(1.25-bend)*1.55))
      const weight=gsm/460
      for(let i=0;i<positions.count;i++){
        const x=drapeXY[i*3],y=drapeXY[i*3+1]
        const gravity=(.065+.09*weight)*(1-(y+1.13)/2.26)
        const wave=looseness*(.16*Math.sin(x*(5.5+2*bend)+y*.4)+.055*Math.cos(x*13-y*.5))
        positions.setXYZ(i,x+Math.sin(y*2.4+x*.8)*.03*looseness,y,wave-gravity)
      }
      positions.needsUpdate=true
      drapeGeometry.computeVertexNormals()
      for(let i=0;i<macroUvs.count;i++) {
        macroUvs.setXY(i,macroBaseUvs[i*2]*patchWidth/widthCm,macroBaseUvs[i*2+1]*patchWidth/heightCm)
      }
      macroUvs.needsUpdate=true
      for(let i=0;i<drapeUVs.count;i++) {
        drapeUVs.setXY(i,drapeBaseUvs[i*2]*64/widthCm,drapeBaseUvs[i*2+1]*53/heightCm)
      }
      drapeUVs.needsUpdate=true
    }
    const render=()=>renderer.render(scene,camera)
    const setMode=mode=>{
      activeMode=mode
      const cloth=mode==='drape'
      const fabricBall=mode==='ball'
      const compare=mode==='compare'
      drape.visible=cloth
      ball.visible=fabricBall||compare
      mesh.visible=mode==='macro'
      swatch.visible=mode==='macro'||compare
      ball.position.x=compare?-.92:0
      ball.scale.setScalar(compare?.61:1)
      swatch.position.x=compare?1.02:0
      swatch.scale.setScalar(compare?.76:1)
      mesh.position.x=mode==='macro'?-.9:0
      contactShadow.visible=fabricBall||compare
      contactShadow.position.x=compare?-.92:0
      contactShadow.position.y=compare?-.78:-1.1
      contactShadow.scale.setScalar(compare?.72:1)
      const aspect=Math.max(.4,container.clientWidth/Math.max(1,container.clientHeight))
      camera.position.z=(cloth?4.5:fabricBall?3.9:compare?4.85:4.2)*(compare?Math.max(1,1.4/aspect):1)
      render()
    }
    const setLight=(degrees,power)=>{
      const radians=THREE.MathUtils.degToRad(degrees)
      key.position.set(Math.sin(radians)*4.5,2.2,Math.cos(radians)*4.5)
      key.intensity=power
      render()
    }
    const setPatchWidth=cm=>{patchWidth=cm;setMacroScale(currentFabric);render()}
    const move=(event)=>{
      const bounds=renderer.domElement.getBoundingClientRect()
      const x=Math.max(0,Math.min(1,(event.clientX-bounds.left)/Math.max(1,bounds.width)))
      const y=Math.max(0,Math.min(1,(event.clientY-bounds.top)/Math.max(1,bounds.height)))
      mesh.rotation.y=(x-.5)*.85
      mesh.rotation.x=(y-.5)*.45
      swatch.rotation.y=(x-.5)*.24
      swatch.rotation.x=(y-.5)*.12
      drape.rotation.y=(x-.5)*.3
      drape.rotation.x=-.08+(y-.5)*.16
      ball.rotation.y=(x-.5)*.75
      ball.rotation.x=(y-.5)*.18
      render()
    }
    renderer.domElement.addEventListener('pointermove',move)
    const resize=()=>{
      const width=Math.max(1,container.clientWidth)
      const height=Math.max(1,container.clientHeight)
      camera.aspect=width/height
      const compare=activeMode==='compare'
      camera.position.z=(activeMode==='drape'?4.5:activeMode==='ball'?3.9:compare?4.85:4.2)*(compare?Math.max(1,1.4/camera.aspect):1)
      camera.updateProjectionMatrix()
      renderer.setSize(width,height,false)
      render()
    }
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null
    observer?.observe(container)
    rendererRef.current=renderer
    viewRef.current={material,render:()=>{if(!disposed)render()},setMacroScale,setMode,setLight,setPatchWidth,isDisposed:()=>disposed}
    resize()
    render()
    return ()=>{
      disposed=true
      viewRef.current?.deactivateLoads?.()
      observer?.disconnect()
      renderer.domElement.removeEventListener('pointermove',move)
      mapsRef.current.forEach(map=>map?.dispose?.())
      mapsRef.current=[]
      mapKeyRef.current=''
      material.dispose()
      geometry.dispose()
      swatchGeometry.dispose()
      drapeGeometry.dispose()
      ball.geometry.dispose()
      shadowGeometry.dispose()
      shadowMaterial.dispose()
      shadowTexture.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      viewRef.current=null
      rendererRef.current=null
    }
  },[])

  useEffect(()=>{
    viewRef.current?.setMode(viewMode)
    viewRef.current?.setLight(lightAngle,lightPower)
    viewRef.current?.setPatchWidth(macroWidth)
  },[viewMode,lightAngle,lightPower,macroWidth,unavailable])

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
      texture.repeatWidthCm,texture.repeatHeightCm,texture.rotationDeg,texture.scanAssetId,
      texture.license,fabric.wash,fabric.color,fabric.bend,fabric.gsm])
    if (signature !== mapKeyRef.current) {
      const generated=makeProceduralTextileMaps(fabric)
      const loader=new THREE.TextureLoader()
      const owned=[]
      let active=true
      const load=(field,isColor,fallback)=>{
        const src=texture[field]
        if (!src) return fallback
        const loaded=loader.load(src,(value)=>{
          if(!active||view.isDisposed())return
          if((isColor&&(washed||licensedPhoto)) ||
             (field==='roughnessSrc'&&shouldBalanceFabricRoughness(fabric))){
            const original=value.image
            const dimensions={
              width:Math.min(1024,original?.naturalWidth||original?.width||512),
              height:Math.min(1024,original?.naturalHeight||original?.height||512),
            }
            try{
              const canvas=field==='roughnessSrc'
                ? balanceScannedRoughness(original,fabric,dimensions)
                : licensedPhoto
                ? tintLicensedFabricScan(original,fabric,dimensions)
                : washTextureImage(original,wash,dimensions)
              if(canvas){value.image=canvas;value.needsUpdate=true}
            }catch{/* Cross-origin or unreadable scans retain their loaded original. */}
          }
          view.render()
        },undefined,()=>{if(active&&!view.isDisposed())view.render()})
        loaded.wrapS=THREE.RepeatWrapping
        loaded.wrapT=THREE.RepeatWrapping
        // Three's default isotropic filtering visibly washes out textile
        // yarns at glancing angles, especially on draped and tilted patches.
        loaded.anisotropy=8
        loaded.minFilter=THREE.LinearMipmapLinearFilter
        loaded.magFilter=THREE.LinearFilter
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
      // Generated maps are owned even when an uploaded scan overrides a channel.
      const nextMaps=[albedo,normal,roughness,metalness,opacity,displacement,...owned]
        .filter((map,index,array)=>Boolean(map) && array.indexOf(map)===index)
      for(const map of [generated?.colorMap,generated?.normalMap,generated?.roughnessMap,generated?.alphaMap]){
        if(map&&!nextMaps.includes(map))map.dispose()
      }
      // Deactivate old async image callbacks before releasing GPU textures.
      view.deactivateLoads?.()
      view.deactivateLoads=()=>{active=false}
      mapsRef.current.forEach(map=>map?.dispose?.())
      mapsRef.current=nextMaps
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

  return <div className="fabric-material-preview" aria-label="Interactive physically based fabric surface preview">
    <div className="fabric-material-preview-tools" role="group" aria-label="Fabric preview view">
      <button type="button" aria-pressed={viewMode==='compare'} onClick={()=>setViewMode('compare')}>Swatch + drape</button>
      <button type="button" aria-pressed={viewMode==='ball'} onClick={()=>setViewMode('ball')}>Fabric on ball</button>
      <button type="button" aria-pressed={viewMode==='macro'} onClick={()=>setViewMode('macro')}>Yarn / finish</button>
      <button type="button" aria-pressed={viewMode==='drape'} onClick={()=>setViewMode('drape')}>Draped surface</button>
    </div>
    <div className="fabric-material-preview-canvas" ref={containerRef} style={{background:fabric.color||'#777'}}>
      {unavailable && <span>3D preview unavailable · garment material remains editable</span>}
    </div>
    <div className="fabric-material-preview-meta"><strong>LIVE PBR · {fabric.texture?.scanAssetId?'LICENSED SCAN':'PROCEDURAL'} · {Math.round(Number(fabric.gsm||0))} GSM (EST.)</strong><span>{viewMode==='macro'?macroWidth.toFixed(1)+' cm yarn detail':viewMode==='compare'?'Flat fibre swatch and draped square on a sphere':viewMode==='ball'?'Fabric-covered 3D ball and hanging folds':'64 × 53 cm optical drape'} · drag pointer to rotate</span></div>
    <div className="fabric-material-preview-controls">
      <label>Light direction <output>{lightAngle}°</output><input type="range" min="-180" max="180" step="5" value={lightAngle} onChange={e=>setLightAngle(Number(e.target.value))}/></label>
      <label>Light strength <output>{lightPower.toFixed(1)}</output><input type="range" min=".3" max="5" step=".1" value={lightPower} onChange={e=>setLightPower(Number(e.target.value))}/></label>
      {viewMode==='macro' && <label>Inspection width <output>{macroWidth.toFixed(1)} cm</output><input type="range" min=".5" max="8" step=".5" value={macroWidth} onChange={e=>setMacroWidth(Number(e.target.value))}/></label>}
      {typeof onOpticalChange==='function' && <>
        {[
          ['roughness','Fabric roughness',.04,1,.02,.82],
          ['normalStrength','Yarn normal relief',0,3,.1,1],
          ['sheen','Fabric sheen',0,1,.02,.22],
          ['clearcoat','Coated finish reflection',0,1,.02,0],
        ].map(([field,label,min,max,step,fallback])=><label key={field}>{label}
          <output>{Number(fabric[field]??fallback).toFixed(2)}</output>
          <span className="fabric-material-optical-inputs">
            <input aria-label={`${label} slider`} type="range" min={min} max={max} step={step} value={fabric[field]??fallback}
              onChange={e=>onOpticalChange(field,Number(e.target.value))}/>
            <input aria-label={`${label} value`} type="number" min={min} max={max} step={step} value={fabric[field]??fallback}
              onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value)&&value>=min&&value<=max)onOpticalChange(field,value)}}/>
          </span>
        </label>)}
      </>}
    </div>
    <p className="fabric-material-preview-note">Light direction and inspection zoom are preview controls. Optical roughness, sheen, normal detail and coated finish also update the assigned 3D garment material. The shown folds are an optical reference rather than a simulated fit or fabric lab test; physical bend and weight are separate.</p>
  </div>
}
