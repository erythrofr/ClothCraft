import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createStageEnvironment } from '../core/createStageEnvironment.js'
import './Library3DAssetPreview.css'

const CATHEDRAL_URL = '/library-3d/MIKRISTIAN_Cathedral_House.glb'
const REAL_WOOD_HANGER_URL = '/hangers/innerscene-shoulder-form.glb'
const REAL_TROUSER_HANGER_URL = '/hangers/innerscene-clip-rail.glb'
export const LIBRARY_AVATAR_URLS = Object.freeze({
  'clo-thomas': '/avatars/preview/clo-thomas.glb',
  theo: '/avatars/opensew/theo.glb',
  nora: '/avatars/opensew/nora.glb',
})
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const HANGER_THUMBNAILS = new Set(['wood', 'chrome', 'velvet', 'padded', 'trouser-clip'])
const physical = (color, roughness = .5, metalness = 0, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, metalness, ...extra })

function part(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function tube(parent, points, radius, material, segments = 32) {
  return part(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 10, false), material)
}

function woodGrainTexture() {
  const width = 256, height = 64
  const bytes = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const streak = Math.sin(y * .55 + Math.sin(x * .042 + y * .13) * 2.2) * .12
    const knot = Math.sin(x * .06 + y * .19) * .045
    const noise = (Math.sin(x * 17.11 + y * 31.37) * 43758.5453) % 1
    const v = Math.max(.75, Math.min(1.18, 1 + streak + knot + noise * .018))
    const i = (y * width + x) * 4
    bytes[i] = Math.round(151 * v); bytes[i+1] = Math.round(96 * v)
    bytes[i+2] = Math.round(55 * v); bytes[i+3] = 255
  }
  const texture = new THREE.DataTexture(bytes, width, height, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.6, .65)
  texture.needsUpdate = true
  return texture
}

// Metre-like preview dimensions are illustrative. Hooks and curved shoulder
// rails are actual shaded geometry, not image cards or billboards.
export function createLibraryHanger3D(variant = 'wood') {
  const group = new THREE.Group()
  group.name = `library-hanger-${variant}`
  const finish = String(variant).toLowerCase()
  const isChrome = /chrome|metal|wire/.test(finish)
  const isVelvet = /velvet|flock/.test(finish)
  const isPadded = /padded|satin|silk/.test(finish)
  const body = isChrome
    ? physical('#cdd2d5', .17, .94, { clearcoat: .65, clearcoatRoughness: .13 })
    : isVelvet
      ? physical('#171b1c', .93, .01, { sheen: .9, sheenRoughness: .92 })
      : isPadded
        ? physical('#33343b', .4, .01, { sheen: .8, sheenRoughness: .55 })
      : physical('#ffffff', .32, .02, { map: woodGrainTexture(), clearcoat: .32, clearcoatRoughness: .24 })
  const metal = physical('#c4c6c6', .16, .97)
  const shoulderRadius = isChrome ? .014 : isVelvet ? .048 : isPadded ? .105 : .085
  const shoulder = [[-.88, -.05, 0], [-.67, .1, 0], [-.4, .3, 0], [-.2, .4, 0], [0, .43, 0],
    [.2, .4, 0], [.4, .3, 0], [.67, .1, 0], [.88, -.05, 0]]
  if (!isChrome && !isVelvet && !isPadded) {
    // Beveled broad wooden shoulder in place of a round wire-like rail.
    const silhouette = new THREE.Shape()
    silhouette.moveTo(-.89, -.09)
    silhouette.bezierCurveTo(-.83, .05, -.37, .42, -.09, .45)
    silhouette.quadraticCurveTo(0, .46, .09, .45)
    silhouette.bezierCurveTo(.37, .42, .83, .05, .89, -.09)
    silhouette.lineTo(.83, -.17)
    silhouette.bezierCurveTo(.56, .00, .18, .23, 0, .27)
    silhouette.bezierCurveTo(-.18, .23, -.56, .00, -.83, -.17)
    silhouette.closePath()
    const geometry = new THREE.ExtrudeGeometry(silhouette, {depth:.095, bevelEnabled:true, bevelSegments:3, steps:1, bevelSize:.025, bevelThickness:.023, curveSegments:12})
    geometry.translate(0,0,-.0475)
    part(group,geometry,body)
  } else tube(group, shoulder, shoulderRadius, body, 76)
  if (isPadded) {
    // Separate seams/piping sell the rounded textile construction.
    tube(group, shoulder.map(([x,y,z]) => [x,y+.015,z+.093]), .009, physical('#5e5f68', .63), 80)
    for (const x of [-.76, -.55, -.32, 0, .32, .55, .76]) {
      const y = .43 - .45 * Math.pow(Math.abs(x)/.88, 1.8)
      part(group, new THREE.SphereGeometry(.011, 10, 8), metal, [x, y + .013, .097])
    }
  }
  if (!isChrome) {
    tube(group, [[-.83,-.07,0],[-.6,-.4,0],[0,-.43,0],[.6,-.4,0],[.83,-.07,0]], .029, body, 56)
  } else {
    tube(group, [[-.85,-.07,0],[-.68,-.43,0],[0,-.47,0],[.68,-.43,0],[.85,-.07,0]], .012, metal, 56)
  }
  part(group, new THREE.CylinderGeometry(.067,.065,.13,24), metal, [0,.43,0])
  tube(group, [[0,.44,0],[0,.64,0],[.1,.8,0],[.21,.78,0],[.27,.65,0],[.22,.55,0]], .032, metal, 48)
  part(group, new THREE.TorusGeometry(.043,.009,8,28), metal, [0,.58,0], [Math.PI/2,0,0])
  if (!isChrome) {
    const notch = physical(isVelvet ? '#252829' : '#60371e', .68)
    for (const x of [-.74,.74]) {
      part(group, new THREE.TorusGeometry(.055,.014,8,24,Math.PI), notch, [x,.06,.015], [0,0,Math.PI])
    }
  }
  group.userData = { type: 'hanger', variant: finish, source: 'EXO procedural Three.js geometry' }
  return group
}
export const createHanger3D = createLibraryHanger3D

export function createLibraryStudioStage3D(variant = 'editorial') {
  const group = new THREE.Group()
  group.name = `library-stage-${variant}`
  const dark = /dark|black|runway/.test(variant)
  const concrete = /concrete|industrial/.test(variant)
  const wall = physical(dark ? '#292a2a' : concrete ? '#888783' : '#bcb3a9', .91)
  const floor = physical(dark ? '#303032' : concrete ? '#777875' : '#aba49d', .67)
  const metal = physical('#b1a9a0',.25,.76)
  part(group,new THREE.BoxGeometry(8,.15,8),floor,[0,-1.38,0])
  part(group,new THREE.BoxGeometry(8,5,.17),wall,[0,1.07,-3.25])
  part(group,new THREE.BoxGeometry(.16,5,7),wall,[-3.4,1.07,0])
  const cyclo = physical(dark ? '#393a3a' : '#c9c1b6', .93)
  if (!concrete) {
    part(group,new THREE.CylinderGeometry(.53,.53,8,40,1,false,0,Math.PI/2),cyclo,[-2.84,-.82,-2.7],[0,Math.PI/2,Math.PI/2])
  }
  // Podium + trim edges, dimensioned to fit safely in a small preview.
  part(group,new THREE.CylinderGeometry(1.08,1.13,.21,72),physical(dark ? '#1e1e1f' : '#8d8984',.37),[0,-1.16,-.6])
  part(group,new THREE.TorusGeometry(1.09,.018,8,96),metal,[0,-1.04,-.6],[Math.PI/2,0,0])
  if (concrete) {
    for (let i=0;i<5;i++) part(group,new THREE.BoxGeometry(.023,4.9,.024),physical('#666663',.9),[-2.6+i*1.2,1.1,-3.14])
  } else {
    for (const x of [-2.5,2.5]) {
      part(group,new THREE.BoxGeometry(.045,3.4,.045),metal,[x,.5,-3.1])
      part(group,new THREE.BoxGeometry(.43,.12,.2),physical('#ddd7ce',.46),[x,2.22,-3.07])
    }
  }
  group.userData = { type:'stage', variant, source:'EXO procedural Three.js room', simulated:false }
  return group
}

function createAvatarStand3D() {
  const group = new THREE.Group()
  const skin = physical('#b1aaa2', .69)
  const base = physical('#242527', .38, .63)
  part(group,new THREE.CylinderGeometry(.68,.73,.1,50),base,[0,-1.35,0])
  part(group,new THREE.CylinderGeometry(.024,.024,1.85,16),base,[0,-.35,0])
  const torso = part(group,new THREE.CylinderGeometry(.32,.24,1.18,40),skin,[0,.36,0])
  torso.scale.z=.65
  part(group,new THREE.SphereGeometry(.23,32,24),skin,[0,1.27,0]).scale.set(1,1.24,.88)
  for(const x of [-1,1]) {
    const arm = part(group,new THREE.CylinderGeometry(.105,.08,1.09,20),skin,[x*.38,.28,0],[0,0,x*.15])
    arm.scale.z=.76
  }
  group.userData = { type:'avatar', source:'procedural display mannequin; not an anatomical scan' }
  return group
}

function disposeTree(group) {
  group.traverse(item => {
    item.geometry?.dispose?.()
    const materials = Array.isArray(item.material) ? item.material : [item.material]
    materials.forEach(mat => {
      if (!mat) return
      for (const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap']) mat[key]?.dispose?.()
      mat.dispose?.()
    })
  })
}

/** Compact, hover-ready independent WebGL preview.
 * Props: category='hanger'|'stage'|'avatar'; variant='wood'|'chrome'|'velvet'|'padded'
 * or 'editorial'|'concrete'|'dark'|'cathedral'; className; label; interactive=true.
 * Import this component from a parent hover card, without reinitializing renderer each mouse move.
 */
export default function Library3DAssetPreview({ kind, category='hanger', variant='wood', label, className='', interactive=true, height }) {
  const assetType=kind||category
  // Tile images are pre-rendered from the actual hanger mesh in Blender.
  // A full WebGL context is reserved for a hovered, interactive detail panel.
  if (assetType === 'hanger' && !interactive && HANGER_THUMBNAILS.has(variant)) {
    return <div className={`library-3d-preview library-3d-preview-static ${className}`} style={height?{height}:undefined} role="img" aria-label={`Rendered 3D ${variant} hanger`}><img src={`/hangers/${variant}.png`} alt="" loading="lazy" draggable="false" /></div>
  }
  return <LiveLibrary3DAssetPreview kind={kind} category={category} variant={variant} label={label} className={className} interactive={interactive} height={height} />
}

function LiveLibrary3DAssetPreview({ kind, category='hanger', variant='wood', label, className='', interactive=true, height }) {
  const assetType=kind||category
  const elementRef = useRef(null)
  const [error, setError] = useState(false)
  const [modelStatus, setModelStatus] = useState('procedural')
  useEffect(() => {
    const host=elementRef.current
    if (!host) return
    let renderer
    try { renderer=new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'low-power' }) }
    catch { setError(true); return }
    const scene=new THREE.Scene()
    scene.background=new THREE.Color('#161719')
    const camera=new THREE.PerspectiveCamera(36,1,.05,100)
    const stage = assetType==='stage'
    const catalogStage = stage && /^(?:R0[1-5]|S(?:0[1-9]|1[0-5]))$/.test(variant)
    const hangerView=assetType==='hanger'
    camera.position.set(stage ? (catalogStage ? 7.5 : 4) : 0,stage ? (catalogStage ? 5.3 : 1.9) : hangerView ? .17 : .25,stage ? (catalogStage ? 14 : 8) : hangerView ? 2.45 : 4.15)
    camera.lookAt(0,stage?(catalogStage?1.5:-.12):(hangerView ? .14 : .1),0)
    if(hangerView){camera.zoom=1.13;camera.updateProjectionMatrix()}
    // Room previews require restrained illumination: the brighter prop rig
    // clips pale plaster and erases subtle roughness in authored stage maps.
    scene.add(new THREE.HemisphereLight(stage ? '#e8ecf1' : '#f1f4ff',stage ? '#3e4145' : '#44414a',stage ? 1.05 : 2))
    const key=new THREE.DirectionalLight(stage ? '#fff3e7' : '#ffffff',stage ? 2.15 : 4)
    key.position.set(-3,6,5)
    key.castShadow=true
    key.shadow.mapSize.set(stage ? 768 : 1024,stage ? 768 : 1024)
    key.shadow.camera.left=stage ? -10 : -6; key.shadow.camera.right=stage ? 10 : 6
    key.shadow.camera.top=stage ? 10 : 6; key.shadow.camera.bottom=stage ? -10 : -6
    key.shadow.camera.near=.5; key.shadow.camera.far=stage ? 28 : 18
    key.shadow.bias=-.00018
    key.shadow.normalBias=stage ? .035 : .015
    scene.add(key)
    const rim=new THREE.DirectionalLight('#ffdeb9',stage ? .95 : 2.4)
    rim.position.set(3,2,-3)
    scene.add(rim)
    const cool=new THREE.DirectionalLight('#b5cbee',stage ? .45 : 1.2)
    cool.position.set(-4,-.5,2)
    scene.add(cool)
    const root=new THREE.Group()
    scene.add(root)
    let cancelled=false
    const addFallbackAvatar=()=>{
      if(cancelled)return
      const fallback=createAvatarStand3D()
      fallback.userData.source = variant==='makehuman-base'
        ? 'Procedural display stand; MakeHuman OBJ is not used in this preview'
        : 'Procedural display stand; requested GLB not available'
      root.add(fallback)
      setModelStatus('fallback')
      draw()
    }
    if(assetType==='avatar' && LIBRARY_AVATAR_URLS[variant]){
      const url=LIBRARY_AVATAR_URLS[variant]
      const controller=new AbortController()
      // A missing asset must not silently return index.html through Vite's
      // SPA history fallback and then be presented as a verified avatar.
      fetch(url,{method:'HEAD',signal:controller.signal})
        .then(response=>{
          const bytes=Number(response.headers.get('content-length')||0)
          if(!response.ok || (bytes > 4_000_000) || !/model\/gltf-binary|application\/octet-stream/i.test(response.headers.get('content-type')||'')) {
            throw new Error('GLB unavailable at hosted URL')
          }
          if(cancelled)return
          setModelStatus('loading')
          new GLTFLoader().load(url,gltf=>{
            if(cancelled){disposeTree(gltf.scene);return}
            const model=gltf.scene
            const bounds=new THREE.Box3().setFromObject(model)
            const size=bounds.getSize(new THREE.Vector3())
            if(size.lengthSq() < .000001){disposeTree(model);addFallbackAvatar();return}
            const center=bounds.getCenter(new THREE.Vector3())
            const scale=2.5/Math.max(size.y,.01)
            model.scale.setScalar(scale)
            model.position.set(-center.x*scale,-bounds.min.y*scale-1.12,-center.z*scale)
            model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true}})
            model.userData.source=url
            root.add(model)
            setModelStatus('loaded')
            draw()
          },undefined,addFallbackAvatar)
        })
        .catch(()=>{if(!cancelled)addFallbackAvatar()})
      root.userData.abortController=controller
    } else if(assetType==='avatar') {
      addFallbackAvatar()
    }
    const importedHanger = assetType==='hanger' && (variant==='wood' || variant==='trouser-clip')
    if(importedHanger) {
      new GLTFLoader().load(variant==='wood' ? REAL_WOOD_HANGER_URL : REAL_TROUSER_HANGER_URL, gltf=>{
        if(cancelled){disposeTree(gltf.scene);return}
        const model=gltf.scene
        const bounds=new THREE.Box3().setFromObject(model)
        const size=bounds.getSize(new THREE.Vector3())
        if(!Number.isFinite(size.x) || size.x<.01 || size.lengthSq()<.000001){disposeTree(model);root.add(createLibraryHanger3D(variant==='wood'?'wood':'chrome'));setModelStatus('fallback');draw();return}
        const center=bounds.getCenter(new THREE.Vector3())
        const scale=1.76/Math.max(size.x,.001)
        model.scale.setScalar(scale)
        model.position.set(-center.x*scale,.1-center.y*scale,-center.z*scale)
        model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true}})
        model.userData.source=variant==='wood'?'Innerscene Shoulder Form - Closet Accessory (CC0)':'Innerscene Clip Rail - Closet Accessory (CC0)'
        root.add(model)
        setModelStatus('imported')
        draw()
      },undefined,()=>{if(!cancelled){root.add(createLibraryHanger3D(variant==='wood'?'wood':'chrome'));setModelStatus('fallback');draw()}})
    }
    if (stage && variant==='cathedral') {
      new GLTFLoader().load(CATHEDRAL_URL, gltf => {
        if (cancelled) { disposeTree(gltf.scene); return }
        const model=gltf.scene
        let actualMeshes=0
        model.traverse(node=>{if(node.isMesh && node.geometry?.getAttribute('position')?.count>0)actualMeshes++})
        const bbox=new THREE.Box3().setFromObject(model)
        const size=bbox.getSize(new THREE.Vector3())
        if (!actualMeshes || !size.lengthSq() || !Number.isFinite(size.lengthSq())) {
          disposeTree(model)
          renderer.domElement.dataset.previewMeshCount='0'
          renderer.domElement.dataset.stageStatus='error'
          setModelStatus('error')
          draw()
          return
        }
        const center=bbox.getCenter(new THREE.Vector3())
        const scale=5.4/Math.max(size.x,size.y,size.z, .001)
        model.scale.setScalar(scale)
        model.position.copy(center.multiplyScalar(-scale))
        model.traverse(mesh => { if(mesh.isMesh) {mesh.castShadow=true;mesh.receiveShadow=true} })
        root.add(model)
        renderer.domElement.dataset.previewMeshCount=String(actualMeshes)
        renderer.domElement.dataset.stageStatus='ready'
        setModelStatus('imported')
        draw()
      },undefined,() => {if(!cancelled) {
        renderer.domElement.dataset.previewMeshCount='0'
        renderer.domElement.dataset.stageStatus='error'
        setModelStatus('error')
        draw()
      }})
    } else if (catalogStage) {
      const originalStage=createStageEnvironment(THREE,variant, loaded => {
        if (cancelled) return
        const count = loaded.userData.meshCount || 0
        renderer.domElement.dataset.previewMeshCount = String(count)
        renderer.domElement.dataset.stageStatus = loaded.userData.loadError ? 'error' : 'ready'
        setModelStatus(loaded.userData.loadError ? 'error' : 'imported')
        draw()
      })
      root.add(originalStage)
    } else if(assetType!=='avatar' && !importedHanger) root.add(stage?createLibraryStudioStage3D(variant):createLibraryHanger3D(variant))
    if (assetType==='avatar') {
      const ground=part(root,new THREE.CircleGeometry(1.46,64),physical('#29292b',.89),[0,-1.13,-.18],[-Math.PI/2,0,0])
      ground.castShadow=false
    }
    renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.toneMapping=THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure=stage ? .92 : 1.18
    renderer.shadowMap.enabled=true
    renderer.shadowMap.type=THREE.PCFSoftShadowMap
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,stage ? 1.4 : 1.7))
    renderer.domElement.setAttribute('aria-label', `3D ${assetType} preview: ${label||variant}`)
    renderer.domElement.dataset.previewStageId = stage && variant==='cathedral' ? 'cathedral' : catalogStage ? variant : ''
    renderer.domElement.dataset.previewMeshCount = String(catalogStage ? 0 : 0)
    if (catalogStage || (stage && variant==='cathedral')) renderer.domElement.dataset.stageStatus = 'loading'
    host.appendChild(renderer.domElement)
    function draw(){renderer.render(scene,camera)}
    function resize(){
      const w=Math.max(1,host.clientWidth), h=Math.max(1,host.clientHeight)
      camera.aspect=w/h
      camera.updateProjectionMatrix()
      renderer.setSize(w,h,false)
      draw()
    }
    let dragging=false,lastX=0
    const down=ev=>{dragging=true;lastX=ev.clientX;renderer.domElement.setPointerCapture?.(ev.pointerId)}
    const move=ev=>{
      if(!dragging) return
      root.rotation.y+=clamp((ev.clientX-lastX)*.013,-.2,.2)
      lastX=ev.clientX
      draw()
    }
    const up=()=>{dragging=false}
    if(interactive){
      renderer.domElement.addEventListener('pointerdown',down)
      renderer.domElement.addEventListener('pointermove',move)
      renderer.domElement.addEventListener('pointerup',up)
      renderer.domElement.addEventListener('pointercancel',up)
    }
    const resizeObserver=typeof ResizeObserver!=='undefined' ? new ResizeObserver(resize) : null
    resizeObserver?.observe(host)
    resize()
    return ()=>{
      cancelled=true
      root.userData.abortController?.abort()
      resizeObserver?.disconnect()
      renderer.domElement.removeEventListener('pointerdown',down)
      renderer.domElement.removeEventListener('pointermove',move)
      renderer.domElement.removeEventListener('pointerup',up)
      renderer.domElement.removeEventListener('pointercancel',up)
      root.traverse(node=>{if(node.userData?.stageId)node.userData.disposed=true})
      disposeTree(root)
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  },[assetType,variant,label,interactive])
  return <div className={`library-3d-preview ${className}`} ref={elementRef} role="img" aria-label={`3D preview of ${label || variant}; ${assetType==='avatar' || (assetType==='hanger' && (variant==='wood'||variant==='trouser-clip')) ? modelStatus : 'procedural'}`} data-model-status={assetType==='avatar' || (assetType==='hanger' && (variant==='wood'||variant==='trouser-clip')) ? modelStatus:undefined} style={height?{height}:undefined}>
    {error && <span className="library-3d-preview-fallback">3D preview unavailable</span>}
    {assetType==='avatar' && variant==='makehuman-base' && <span className="library-3d-preview-provenance">Procedural display stand · MakeHuman OBJ not rendered</span>}
  </div>
}
