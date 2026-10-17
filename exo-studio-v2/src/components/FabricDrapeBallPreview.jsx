import React,{useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js'
import {createFabricBallGeometry,FABRIC_BALL_SWATCH_CM,fabricBallGeometryDiagnostics} from '../core/fabricBallGeometry.js'
import {makeProceduralTextileMaps} from '../core/textileProcedurals.js'
import {tintLicensedFabricScan} from '../core/photographicScanToning.js'
import {balanceScannedRoughness,shouldBalanceFabricRoughness,fabricSwatchMapRepeats,fabricSwatchRepeatDimensions,fabricProceduralSwatchRepeats} from '../core/fabricPbrAppearance.js'
import './FabricDrapeBallPreview.css'

const clamp=(number,min,max,fallback)=>Number.isFinite(Number(number))?Math.max(min,Math.min(max,Number(number))):fallback
const validScan=uri=>typeof uri==='string'&&/^\/fabric-scans(?:-ambientcg)?\//.test(uri)

// Studio specimen sculpting is intentionally separate from the native cloth
// solve. The regular UV grid maintains one continuous square fabric surface.
// Bringing contact closer to the ball's equator avoids the open "plastic cap"
// appearance of a sheet that leaves the sphere too early.
export function createPreviewDrapeGeometry(fabric={}){
  const geometry=createFabricBallGeometry(fabric,{segments:128,rings:128})
  const positions=geometry.getAttribute('position')
  const uvs=geometry.getAttribute('uv')
  const radius=.81,centerY=.23,contactRadius=.745,halfSize=FABRIC_BALL_SWATCH_CM/200
  const topContactY=centerY+Math.sqrt(radius*radius-contactRadius*contactRadius)+.014
  const bend=clamp(fabric.bend,.08,1.8,.65)
  const gsm=clamp(fabric.gsm,40,1000,280)
  const softness=clamp((1.58-bend)*.82,.23,1.08,.6)
  const mass=gsm/340
  for(let i=0;i<positions.count;i++){
    const flatX=(uvs.getX(i)*2-1)*halfSize
    const flatZ=(uvs.getY(i)*2-1)*halfSize
    const flatRadius=Math.hypot(flatX,flatZ)
    const angle=Math.atan2(flatZ,flatX)
    const capFraction=Math.min(1,flatRadius/contactRadius)
    // Shallow radial creases follow the unsupported fabric to its release edge.
    const capRidge=.036*softness*Math.pow(capFraction,3)*
      Math.pow(Math.sin(5*angle+.24+flatRadius*.38),6)
    if(flatRadius<=contactRadius){
      positions.setXYZ(i,flatX,centerY+Math.sqrt(Math.max(0,radius*radius-flatRadius*flatRadius))+.014+capRidge,flatZ)
      continue
    }
    const run=flatRadius-contactRadius
    const easing=THREE.MathUtils.smoothstep(run,0,.30)
    // Different-width pleats open gradually as the unsupported cloth falls.
    // Let their phases drift down the hem to avoid rigid, repeated flutes.
    const pleat=softness*easing*(.12*Math.sin(7*angle+.23+run*.38)+
      .057*Math.sin(13*angle-.77-run*.53)+.018*Math.cos(21*angle+.41+run*.8))
    const spread=contactRadius+run*(.35+.015*bend)+pleat
    let projectedRadius=THREE.MathUtils.lerp(flatRadius,spread,easing)
    const drop=run*(1.30+.16*mass)+.092*(1-Math.exp(-10*run))+
      run*run*(.08+.035*mass)
    // Corner overhang and cascaded folds reveal both gravity and bending.
    const corners=Math.pow(Math.abs(Math.cos(2*angle)),5)
    const hemWave=softness*easing*(.085*Math.cos(7*angle-.34+run*.55)+
      .030*Math.sin(15*angle+.45-run*.28)-.045*corners*Math.min(1,run))
    const folding=.06*softness*easing*Math.sin(7*angle+.24+run*.38)*Math.min(1,run*1.7)
    const y=topContactY-drop+hemWave+folding+
      capRidge*(1-THREE.MathUtils.smoothstep(run,0,.45))
    // Keep the optical sheet outside its display prop. This is geometric
    // visual clearance; no collision or friction claim is implied.
    const sphereCrossSection=Math.sqrt(Math.max(0,radius*radius-(y-centerY)*(y-centerY)))
    projectedRadius=Math.max(projectedRadius,sphereCrossSection+.014)
    positions.setXYZ(i,projectedRadius*flatX/flatRadius,y,projectedRadius*flatZ/flatRadius)
  }
  positions.needsUpdate=true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData={...geometry.userData,visualModel:'square-hemispherical-contact-and-folded-skirt',
    displayContactOnly:true}
  return geometry
}

/**
 * A square 270 cm cloth swatch over a presentation sphere. The optical fold
 * geometry is deterministic and responds to the material's estimated mass
 * and bend. It does not call the native Rust or browser cloth solver.
 */
export default function FabricDrapeBallPreview({fabric={},height=250,compact=false}){
  const host=useRef(null)
  const [unavailable,setUnavailable]=useState(false)
  const [lightMode,setLightMode]=useState('soft')
  useEffect(()=>{
    const element=host.current
    if(!element)return undefined
    let renderer
    try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'})}
    catch{setUnavailable(true);return undefined}
    setUnavailable(false)
    let disposed=false
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2))
    renderer.setSize(Math.max(1,element.clientWidth),Math.max(1,element.clientHeight))
    renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.toneMapping=THREE.ACESFilmicToneMapping
    // Double-sided, folded preview geometry is not a closed sewn shell.
    // Enabling directional self-shadowing on both sides generated large,
    // hard black triangular artifacts through thin fabric folds. Use the
    // soft grounding shadow below and local PBR normal shading instead.
    renderer.shadowMap.enabled=false
    renderer.shadowMap.type=THREE.PCFSoftShadowMap
    renderer.toneMappingExposure=1.10
    renderer.domElement.setAttribute('data-fabric-ball',fabric.name||'fabric')
    renderer.domElement.setAttribute('data-preview-model','square-sheet-over-sphere')
    renderer.domElement.setAttribute('aria-label',`Draped fabric specimen: ${fabric.name||'fabric'}`)
    element.append(renderer.domElement)

    const scene=new THREE.Scene()
    scene.background=new THREE.Color('#2b3036')
    const pmrem=new THREE.PMREMGenerator(renderer)
    const room=new RoomEnvironment()
    const environment=pmrem.fromScene(room,.045).texture
    room.dispose()
    scene.environment=environment
    // The room reflection rig must remain a subtle fibre highlight. At full
    // intensity it washes dark denim into grey, hiding its real dyed albedo.
    scene.environmentIntensity=.38
    const camera=new THREE.PerspectiveCamera(42,1,.1,15)
    // A high three-quarter product angle makes the continuous top of the
    // square specimen, its folds and its hanging corners legible at 160 px.
    camera.position.set(1.68,1.7,4.0)
    camera.lookAt(0,-.31,0)
    // Dark colorways should remain close to their measured/assigned albedo.
    // The prior multiple bright studio fills bleached navy denim into blue
    // grey. Soften total diffuse intensity while retaining directional folds.
    const ambient=new THREE.HemisphereLight('#f7f9ff','#555961',.66)
    scene.add(ambient)
    const lightRig=[]
    for(const [color,intensity,x,y,z] of [
      ['#ffffff',1.55,-2.2,3,3],
      ['#d8e3f6',.56,3.3,1,-.8],
      ['#f6e2ca',.29,-2,-1.5,-3],
    ]){
      const light=new THREE.DirectionalLight(color,intensity)
      light.position.set(x,y,z)
      if(x<0&&y>0){
        light.castShadow=true
        light.shadow.mapSize.set(1024,1024)
        light.shadow.camera.left=-2.4
        light.shadow.camera.right=2.4
        light.shadow.camera.top=2.8
        light.shadow.camera.bottom=-2.8
        light.shadow.camera.near=.4
        light.shadow.camera.far=12
        light.shadow.bias=-.00015
        light.shadow.normalBias=.015
        light.shadow.radius=3
      }
      scene.add(light)
      lightRig.push(light)
    }
    const texture=fabric.texture||{}
    const color=fabric.color||'#8b8581'
    const roughness=clamp(fabric.roughness,.04,1,.82)
    const material=new THREE.MeshPhysicalMaterial({
      color,side:THREE.DoubleSide,roughness,
      metalness:clamp(fabric.metalness,0,1,0),
      sheen:clamp(fabric.sheen,0,1,.22),
      sheenRoughness:clamp(fabric.sheenRoughness,.04,1,.78),
      clearcoat:/coated|waxed|patent|laminated/i.test(fabric.name||'')?clamp(fabric.reflectivity,0,1,.25)*.78:0,
      clearcoatRoughness:.27,
      anisotropy:clamp(fabric.anisotropy,0,1,/satin|silk|twill|velvet|suede|denim/i.test(fabric.name||'')?.28:.08),
      normalScale:new THREE.Vector2(clamp(fabric.normalStrength,0,3,.85),clamp(fabric.normalStrength,0,3,.85)),
    })
    // Orbit the specimen as a unit. Rotating the cloth independently from its
    // support breaks the apparent contact and makes the drape seem to float.
    const specimen=new THREE.Group()
    specimen.rotation.y=-.32
    scene.add(specimen)
    renderer.domElement.dataset.previewSharedOrbit='true'
    const cloth=new THREE.Mesh(createPreviewDrapeGeometry(fabric),material)
    cloth.castShadow=false
    cloth.receiveShadow=false
    specimen.add(cloth)
    renderer.domElement.dataset.previewMeshCount=String(cloth.geometry.getAttribute('position')?.count||0)
    const diagnostics=fabricBallGeometryDiagnostics(cloth.geometry)
    renderer.domElement.dataset.previewAreaRatio=String(diagnostics.totalAreaRatio)
    renderer.domElement.dataset.previewDistortion='illustrative'
    const support=new THREE.Mesh(
      // Geometry is posed .014m outside a radius-.81 support surface.
      // Match that size so cloth and sphere contact appears credible.
      new THREE.SphereGeometry(.796,64,48),
      new THREE.MeshStandardMaterial({color:'#454b53',metalness:.14,roughness:.58}),
    )
    support.position.y=.23
    support.castShadow=true
    support.receiveShadow=true
    specimen.add(support)

    const shadowCanvas=document.createElement('canvas')
    shadowCanvas.width=shadowCanvas.height=128
    const context=shadowCanvas.getContext('2d')
    const gradient=context?.createRadialGradient(64,64,2,64,64,64)
    if(gradient){
        gradient.addColorStop(0,'rgba(0,0,0,.22)')
        gradient.addColorStop(.52,'rgba(0,0,0,.09)')
      gradient.addColorStop(1,'rgba(0,0,0,0)')
      context.fillStyle=gradient
      context.fillRect(0,0,128,128)
    }
    const shadowTexture=new THREE.CanvasTexture(shadowCanvas)
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(3.3,3.3),
      new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}))
    floor.rotation.x=-Math.PI/2
    // The cloth corners fall below the original -1.03 floor, which hid its
    // shadow behind the specimen. Ground it below the lowest hanging folds.
    floor.position.y=-1.52
    scene.add(floor)
    // Self shadow mapping is deliberately disabled for this non-manifold
    // optical sheet. Advertise only the actual soft contact shadow, not a
    // shadow-map receiver that would silently do nothing.
    renderer.domElement.dataset.previewGroundShadow='soft-gradient'

    const textures=new Set([shadowTexture])
    const repeatDimensions=fabricSwatchRepeatDimensions(texture)
    const generated=makeProceduralTextileMaps({
      ...fabric,texture:{...texture,...repeatDimensions},
      weaveScaleCm:fabric.weaveScaleCm||3,
    })
    // createFabricBallGeometry uses UV 0..1 across a 270 cm sample. All maps
    // need a proportional repeat, otherwise one 20 cm scan stretches over a
    // 270 cm textile. Procedural maps have a smaller real yarn tile size.
    const repeatFor=(map)=>{
      if(!map)return null
      const [rx,ry]=fabricSwatchMapRepeats(repeatDimensions,FABRIC_BALL_SWATCH_CM)
      map.repeat.multiply(new THREE.Vector2(rx,ry))
      map.anisotropy=8
      map.minFilter=THREE.LinearMipmapLinearFilter
      map.wrapS=map.wrapT=THREE.RepeatWrapping
      textures.add(map)
      return map
    }
    material.map=repeatFor(generated?.colorMap)
    material.normalMap=repeatFor(generated?.normalMap)
    material.roughnessMap=repeatFor(generated?.roughnessMap)
    material.alphaMap=repeatFor(generated?.alphaMap)
    material.alphaTest=generated?.alphaMap ? .2 : 0
    material.transparent=Boolean(generated?.alphaMap)
    renderer.domElement.dataset.previewScanRepeats=fabricSwatchMapRepeats(repeatDimensions,FABRIC_BALL_SWATCH_CM).join(',')
    renderer.domElement.dataset.previewProceduralRepeats=generated?fabricProceduralSwatchRepeats(generated.tileCm,FABRIC_BALL_SWATCH_CM).join(','):'unavailable'

    const render=()=>{if(!disposed)renderer.render(scene,camera)}
    const loader=new THREE.TextureLoader()
    const load=(uri,channel,isColor)=>{
      if(!validScan(uri))return
      const map=loader.load(uri,loaded=>{
        if(disposed)return
        if(channel==='map'){
          // Tint a licensed scan to the same design color as the native
          // garment material. Keep the generated map when the scan fails.
          const tinted=tintLicensedFabricScan(loaded.image,{
            color,wash:fabric.wash||null,
          },{width:Math.min(1024,loaded.image?.naturalWidth||loaded.image?.width||512),
            height:Math.min(1024,loaded.image?.naturalHeight||loaded.image?.height||512)})
          if(tinted){
            loaded.image=tinted
            loaded.needsUpdate=true
            material.color.set('#ffffff')
          }
        }else if(channel==='roughnessMap'&&shouldBalanceFabricRoughness(fabric)){
          const balanced=balanceScannedRoughness(loaded.image,fabric,{
            width:Math.min(1024,loaded.image?.naturalWidth||loaded.image?.width||512),
            height:Math.min(1024,loaded.image?.naturalHeight||loaded.image?.height||512)})
          if(balanced){loaded.image=balanced;loaded.needsUpdate=true}
        }
        material[channel]=loaded
        material.needsUpdate=true
        render()
      },undefined,()=>render())
      map.wrapS=map.wrapT=THREE.RepeatWrapping
      map.repeat.set(...fabricSwatchMapRepeats(repeatDimensions,FABRIC_BALL_SWATCH_CM))
      map.colorSpace=isColor?THREE.SRGBColorSpace:THREE.NoColorSpace
      map.anisotropy=8
      map.minFilter=THREE.LinearMipmapLinearFilter
      textures.add(map)
    }
    load(texture.src,'map',true)
    load(texture.normalSrc,'normalMap',false)
    load(texture.roughnessSrc,'roughnessMap',false)

    const resize=()=>{
      camera.aspect=Math.max(1,element.clientWidth)/Math.max(1,element.clientHeight)
      camera.updateProjectionMatrix()
      renderer.setSize(Math.max(1,element.clientWidth),Math.max(1,element.clientHeight),false)
      render()
    }
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null
    observer?.observe(element)
    const focusPoint=new THREE.Vector3(0,-.31,0)
    const zoom=steps=>{
      const distance=camera.position.distanceTo(focusPoint)
      const target=THREE.MathUtils.clamp(distance*Math.pow(.86,steps),2.15,6.1)
      // Capture the current viewing direction BEFORE resetting the camera
      // position; copying focusPoint first would zero the direction vector
      // and collapse the lens into the cloth during the initial scroll.
      const viewingDirection=camera.position.clone().sub(focusPoint).normalize()
      camera.position.copy(focusPoint).addScaledVector(viewingDirection,target)
      camera.lookAt(focusPoint)
      renderer.domElement.dataset.previewZoomDistance=target.toFixed(2)
      render()
    }
    const wheel=event=>{event.preventDefault();zoom(event.deltaY<0?1:-1)}
    const lighting=event=>{
      const mode=event.detail?.mode||'soft'
      if(mode==='raking'){
        ambient.intensity=.26
        lightRig[0].intensity=.5
        lightRig[1].intensity=1.15
        lightRig[2].intensity=.1
      }else if(mode==='daylight'){
        ambient.intensity=.70
        lightRig[0].intensity=1.4
        lightRig[1].intensity=.45
        lightRig[2].intensity=.16
      }else{
        ambient.intensity=.66
        lightRig[0].intensity=1.55
        lightRig[1].intensity=.56
        lightRig[2].intensity=.29
      }
      renderer.domElement.dataset.previewLightMode=mode
      render()
    }
    element.addEventListener('exo-fabric-preview-lighting',lighting)
    let drag=null
    const rotate=(dx,dy)=>{
      specimen.rotation.y=THREE.MathUtils.clamp(specimen.rotation.y+dx,-Math.PI,Math.PI)
      specimen.rotation.x=THREE.MathUtils.clamp(specimen.rotation.x+dy,-.4,.4)
      renderer.domElement.dataset.previewOrbit=specimen.rotation.y.toFixed(4)+','+specimen.rotation.x.toFixed(4)
      render()
    }
    const down=event=>{
      drag=[event.clientX,event.clientY]
      renderer.domElement.setPointerCapture?.(event.pointerId)
    }
    const move=event=>{
      if(!drag)return
      rotate((event.clientX-drag[0])*.008,(event.clientY-drag[1])*.006)
      drag=[event.clientX,event.clientY]
    }
    const up=event=>{
      drag=null
      if(renderer.domElement.hasPointerCapture?.(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId)
    }
    const key=event=>{
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault()
        rotate(event.key==='ArrowLeft'?.12:event.key==='ArrowRight'?-.12:0,
          event.key==='ArrowUp'?.1:event.key==='ArrowDown'?-.1:0)
      }else if(event.key.toLowerCase()==='r'){
        specimen.rotation.set(0,-.32,0)
        renderer.domElement.dataset.previewOrbit='-0.3200,0.0000'
        render()
      }else if(event.key==='+'||event.key==='='){
        event.preventDefault()
        zoom(1)
      }else if(event.key==='-'){
        event.preventDefault()
        zoom(-1)
      }
    }
    renderer.domElement.tabIndex=0
    renderer.domElement.addEventListener('pointerdown',down)
    renderer.domElement.addEventListener('pointermove',move)
    renderer.domElement.addEventListener('pointerup',up)
    renderer.domElement.addEventListener('pointercancel',up)
    renderer.domElement.addEventListener('keydown',key)
    renderer.domElement.addEventListener('wheel',wheel,{passive:false})
    lighting({detail:{mode:lightMode}})
    resize()
    return()=>{
      disposed=true
      observer?.disconnect()
      for(const [name,handler] of [['pointerdown',down],['pointermove',move],
        ['pointerup',up],['pointercancel',up],['keydown',key],['wheel',wheel]])renderer.domElement.removeEventListener(name,handler)
      element.removeEventListener('exo-fabric-preview-lighting',lighting)
      textures.forEach(map=>map.dispose())
      cloth.geometry.dispose()
      support.geometry.dispose()
      support.material.dispose()
      floor.geometry.dispose()
      floor.material.dispose()
      material.dispose()
      scene.environment=null
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  },[fabric])
  return <div className={`exo-fabric-ball ${compact?'compact':''}`} style={{height}}
    aria-label={`3D visual fabric drape over ball: ${fabric.name||'material'}`} ref={host}>
    <button type="button" className="exo-fabric-ball-lighting" title="Cycle specimen lighting to inspect weave relief"
      aria-label={`Fabric lighting: ${lightMode}. Switch lighting`}
      onClick={()=>{
        const next=lightMode==='soft'?'raking':lightMode==='raking'?'daylight':'soft'
        setLightMode(next)
        host.current?.dispatchEvent(new CustomEvent('exo-fabric-preview-lighting',{detail:{mode:next}}))
      }}>
      {lightMode==='soft'?'SOFT LIGHT':lightMode==='raking'?'RAKING LIGHT':'DAYLIGHT'}
    </button>
    {!compact&&<span style={{position:'absolute',left:10,bottom:10,zIndex:2,fontSize:9,letterSpacing:'.06em',color:'#d9dce2',background:'rgba(14,17,22,.78)',padding:'4px 6px',borderRadius:3,pointerEvents:'none'}}>{`${FABRIC_BALL_SWATCH_CM} CM SPECIMEN · ILLUSTRATIVE DRAPE`}</span>}
    {unavailable&&<span role="status">3D preview unavailable; fabric properties remain editable.</span>}
  </div>
}
