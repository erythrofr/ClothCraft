import {createFabricSurface} from '../core/clothcraftFabricSurface.js'
import React, {useEffect, useRef, useState} from 'react'
import ClothCraftCornerTools from './ClothCraftCornerTools.jsx'
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {TransformControls} from 'three/addons/controls/TransformControls.js'
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js'

const COLORS = ['#638da2', '#d49b70', '#8caf87', '#b69bc7', '#ceb96d', '#82b7b1']
const SEAM_COLORS = ['#eb775e', '#55aecd', '#dbb44c', '#8dc575', '#a98cd9', '#dd91b9']
const setMarkerDiagnostics = (canvas, counts, visible) => {
  if (!canvas) return
  const total = counts.reduce((sum, count) => sum + count, 0)
  canvas.dataset.seamMarkerCount = String(total)
  canvas.dataset.seamMarkerVisibleCount = String(visible ? total : 0)
  canvas.dataset.seamMarkerColors = JSON.stringify(SEAM_COLORS.filter((_, index) => counts[index] > 0))
  canvas.dataset.seamMarkerPalette = JSON.stringify(SEAM_COLORS)
}
const degrees = values => values.map(value => THREE.MathUtils.degToRad(Number(value) || 0))
const finiteVec = values => Array.isArray(values) && values.length >= 3 && values.slice(0, 3).every(Number.isFinite)
const v3 = values => new THREE.Vector3(...values)
const disposeTree = object => {
  object.traverse(child => {
    child.geometry?.dispose()
    const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : []
    for (const material of materials) {material.userData?.ownedTexture?.dispose(); material.dispose()}
  })
}
const replaceChildren = group => {
  for (const child of [...group.children]) {
    group.remove(child)
    disposeTree(child)
  }
}
const weighted = (entries, points) => {
  const out = new THREE.Vector3()
  for (const entry of entries || []) {
    if (!Array.isArray(entry)) continue
    const [index, weight] = entry
    if (finiteVec(points?.[index]) && Number.isFinite(weight)) out.addScaledVector(v3(points[index]), weight)
  }
  return out
}
const material = (color, options = {}) => new THREE.MeshStandardMaterial({
  color, side: THREE.DoubleSide, roughness: .82, metalness: .025, ...options,
})
const buildIndexedMesh = (positions, triangles, color, uv = null) => {
  const indices = [...new Set(triangles.flat().filter(i => Number.isInteger(i) && finiteVec(positions?.[i])))]
  const remap = new Map(indices.map((value, index) => [value, index]))
  const validTriangles = triangles.filter(tri => tri.length === 3 && tri.every(index => remap.has(index)))
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(indices.flatMap(index => positions[index]), 3))
  if(uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(indices.flatMap(index => uv[index] || [0,0]),2))
  geometry.userData.nativeVertices=indices
  geometry.setIndex(validTriangles.flatMap(tri => tri.map(index => remap.get(index))))
  if (validTriangles.length) geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, material(color))
}
const line = (a, b, color, opacity = 1) => {
  const geometry = new THREE.BufferGeometry().setFromPoints([a, b])
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({color, transparent: opacity < 1, opacity, depthTest: true}))
}

/**
 * ClothCraft Rust snapshot visualizer. Positions and triangle indices are Rust-world coordinates (metres).
 * onPlace({kind:'Place', panel, placement:{translation:[x,y,z],rotation_degrees:[x,y,z]}})
 * onStretchDrag is optional and receives {panel,delta:[x,y,z],point:[x,y,z],origin:[x,y,z]}.
 * A Place edit requests a solver reinitialization through the host; this view cannot guarantee
 * that moved simulated vertices remain at their visualized positions after the new snapshot.
 */
export default function ClothCraftSceneV2({
  snapshot, active, selected, mode = 'edit', onPick, onHover, onPlace,
  onChangeMode = () => {}, toolsDisabled = false,
  showAvatar = true, showSeams = true, wireframe = false,
  showBoundingBox = false, showContactDots = true, spread = 0,
  onStretchDrag, onStretchStart, onStretchCancel, environmentPreset = 'studio', showFloor = true,
  onContextMenuRequest, onCanvasActivate,
}) {
  const host = useRef(null)
  const sceneRef = useRef(null)
  const [grabRefresh, setGrabRefresh] = useState(0)
  const propsRef = useRef({})
  propsRef.current = {snapshot, active, selected, mode, onPick, onHover, onPlace, showAvatar,
    showSeams, wireframe, showBoundingBox, showContactDots, spread, onStretchDrag, onStretchStart, onStretchCancel, environmentPreset, showFloor,
    onContextMenuRequest, onCanvasActivate}

  useEffect(() => {
    const hostNode = host.current
    if (!hostNode) return
    const scene = new THREE.Scene()
    // The original EXO GarmentViewport daylight backdrop and fog are part of
    // the studio, independent of the Rust geometry displayed in this scene.
    const backdropCanvas = document.createElement('canvas')
    backdropCanvas.width = 8
    backdropCanvas.height = 512
    const backdropContext = backdropCanvas.getContext('2d')
    const backdropGradient = backdropContext.createLinearGradient(0, 0, 0, 512)
    backdropGradient.addColorStop(0, '#919298')
    backdropGradient.addColorStop(.48, '#d4d5d9')
    backdropGradient.addColorStop(1, '#f2f2f7')
    backdropContext.fillStyle = backdropGradient
    backdropContext.fillRect(0, 0, 8, 512)
    const studioBackdrop = new THREE.CanvasTexture(backdropCanvas)
    studioBackdrop.colorSpace = THREE.SRGBColorSpace
    scene.background = studioBackdrop
    scene.fog = new THREE.Fog(0xe9e9eb, 6, 16)
    const camera = new THREE.PerspectiveCamera(34, 1, .005, 150)
    camera.position.set(2.4, 1.65, 3.1)
    const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false})
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    hostNode.appendChild(renderer.domElement)
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const roomEnvironment = new RoomEnvironment()
    const studioEnvironment = pmremGenerator.fromScene(roomEnvironment, .04).texture
    roomEnvironment.dispose()
    scene.environment = studioEnvironment

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.95, 0)
    controls.enableDamping = true
    controls.dampingFactor = .07
    controls.zoomToCursor = true
    controls.minDistance = .15
    controls.maxDistance = 15
    const ambient = new THREE.HemisphereLight(0xffffff, 0xb7b7bc, 1.85)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xfffcf8, 2.6)
    key.position.set(2.5, 4.5, 3.1)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xe2ecff, .85)
    fill.position.set(-3, 2, -2.5)
    scene.add(fill)

    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 96), material('#ebebed', {roughness:.94,metalness:0}))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -.005
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(5.5, 22, 0xaeb0b4, 0xdddddf)
    grid.position.y = .002
    scene.add(grid)
    const axes = new THREE.Group()
    axes.add(line(new THREE.Vector3(0,.013,-2.75),new THREE.Vector3(0,.013,2.75),'#8b8c91',.52))
    grid.add(axes)
    // Subtle studio centerline from floor to above the mannequin. The regular
    // 6-metre metric floor grid and orientation axes remain intact.
    const centerGuide = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.12, 0)]),
      new THREE.LineDashedMaterial({color:'#729bb0',dashSize:.08,gapSize:.045,transparent:true,opacity:.46,depthTest:true}),
    )
    centerGuide.computeLineDistances()
    grid.add(centerGuide)
    const cloth = new THREE.Group()
    const avatar = new THREE.Group()
    const boundaries = new THREE.Group()
    const seams = new THREE.Group()
    const dots = new THREE.Group()
    const boxes = new THREE.Group()
    scene.add(cloth, avatar, boundaries, seams, dots, boxes)

    const pivot = new THREE.Object3D()
    scene.add(pivot)
    const transform = new TransformControls(camera, renderer.domElement)
    scene.add(transform.getHelper())
    transform.setSize(.65)
    transform.setSpace('world')
    transform.setMode('translate')
    const rings = new THREE.Group()
    scene.add(rings)
    const pickRings = []
    for (const [axis,color] of Object.entries({x:0xef6967,y:0x76d38f,z:0x76aaff,free:0xe9f4ff})) {
      const visual = new THREE.Mesh(new THREE.TorusGeometry(1,.014,8,120),
        new THREE.MeshBasicMaterial({color,transparent:true,opacity:axis==='free'?.63:.97,depthTest:false,depthWrite:false}))
      const picker = new THREE.Mesh(new THREE.TorusGeometry(1,.065,8,120),
        new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthTest:false,depthWrite:false,side:THREE.DoubleSide}))
      picker.userData.rotationAxis=axis
      if(axis==='x'){visual.rotation.y=Math.PI/2;picker.rotation.y=Math.PI/2}
      if(axis==='y'){visual.rotation.x=-Math.PI/2;picker.rotation.x=-Math.PI/2}
      if(axis==='free'){visual.scale.setScalar(1.24);picker.scale.setScalar(1.24)}
      visual.renderOrder=95;picker.renderOrder=96
      rings.add(visual,picker);pickRings.push(picker)
    }
    rings.visible=false
    const ray = new THREE.Raycaster()
    ray.params.Line.threshold = .012
    const pointer = new THREE.Vector2()
    const state = {scene, camera, renderer, controls, cloth, avatar, boundaries, seams, dots, boxes,
      floor, grid, ambient, key, fill, studioBackdrop,
      pivot, transform, ray, pointer, panelMeshes: new Map(), panelOffsets: new Map(),
      down: null, dragging: false, nativeStart: null, handleStart: null, requestId: null,
      sceneSnapshot: null, rings, ringDrag:null, ringEnabled:false, stretchGrab:null,
      stretchCommitPending:false, pendingGrabSnapshot:false}
    sceneRef.current = state
    const transformMode = () => ['move3d','rotate3d','transform'].includes(propsRef.current.mode)
    const hideGizmo = () => {
      state.ringEnabled = false
      rings.visible = false
      transform.detach()
      transform.visible = false
      transform.enabled = false
      delete renderer.domElement.dataset.gizmoCenterX
      delete renderer.domElement.dataset.gizmoCenterY
      delete renderer.domElement.dataset.gizmoRingRadius
      renderer.domElement.dataset.gizmoVisible = 'false'
    }
    hideGizmo()
    const updateRings = () => {
      rings.visible=state.ringEnabled
      if(!rings.visible)return
      rings.position.copy(pivot.position)
      rings.quaternion.copy(pivot.quaternion)
      rings.scale.setScalar(.25)
      // Match our original GarmentViewport's projected gizmo center metadata;
      // used for browser input regression, not to approximate ring geometry.
      const projected=pivot.position.clone().project(camera)
      renderer.domElement.dataset.gizmoCenterX=String((projected.x+1)*renderer.domElement.clientWidth*.5)
      renderer.domElement.dataset.gizmoCenterY=String((1-projected.y)*renderer.domElement.clientHeight*.5)
      const cameraRight=new THREE.Vector3(.25,0,0).applyQuaternion(camera.quaternion).add(pivot.position).project(camera)
      renderer.domElement.dataset.gizmoRingRadius=String(Math.abs(cameraRight.x-projected.x)*renderer.domElement.clientWidth*.5)
      renderer.domElement.dataset.gizmoVisible='true'
      const face=pivot.quaternion.clone().invert().multiply(camera.quaternion)
      for(const child of rings.children)if(child.userData.rotationAxis==='free'||child.scale.x>1.2)child.quaternion.copy(face)
      rings.updateMatrixWorld(true)
    }
    const angleAt = event => {
      const rect=renderer.domElement.getBoundingClientRect(), projected=pivot.position.clone().project(camera)
      return Math.atan2(event.clientY-(rect.top+(1-projected.y)*rect.height/2),
        event.clientX-(rect.left+(projected.x+1)*rect.width/2))
    }
    const ringHit = event => {
      if(!rings.visible)return null
      const rect=renderer.domElement.getBoundingClientRect()
      const center=pivot.position.clone().project(camera)
      const right=new THREE.Vector3(.25,0,0).applyQuaternion(camera.quaternion).add(pivot.position).project(camera)
      const radius=Math.abs(right.x-center.x)*rect.width/2
      if(Math.hypot(event.clientX-(rect.left+(center.x+1)*rect.width/2),event.clientY-(rect.top+(1-center.y)*rect.height/2))<radius*.6)return null
      pointer.set((event.clientX-rect.left)*2/rect.width-1,1-(event.clientY-rect.top)*2/rect.height)
      ray.setFromCamera(pointer,camera)
      return ray.intersectObjects(pickRings,false)[0]?.object.userData.rotationAxis||null
    }
    const startPose = id => {
      const mesh=state.panelMeshes.get(id)
      const placement=propsRef.current.snapshot?.template?.panels?.find(p=>p.id===id)?.placement
      if(!mesh||!placement)return null
      return {id,mesh,placement:structuredClone(placement),center:pivot.position.clone(),
        quaternion:pivot.quaternion.clone(), vertices:mesh.geometry.attributes.position.array.slice(),
        meshPosition:mesh.position.clone()}
    }
    const previewPose = pose => {
      if(!pose)return
      const spin=pivot.quaternion.clone().multiply(pose.quaternion.clone().invert())
      const translation=pivot.position.clone().sub(pose.center)
      const attr=pose.mesh.geometry.attributes.position
      for(let i=0;i<attr.count;i++){
        const value=new THREE.Vector3(pose.vertices[i*3],pose.vertices[i*3+1],pose.vertices[i*3+2])
          .add(pose.meshPosition).sub(pose.center).applyQuaternion(spin).add(pose.center).add(translation).sub(pose.meshPosition)
        attr.setXYZ(i,value.x,value.y,value.z)
      }
      attr.needsUpdate=true;pose.mesh.geometry.computeVertexNormals()
      const moved=point=>point.clone().sub(pose.center).applyQuaternion(spin).add(pose.center).add(translation)
      for(const group of [state.seams,state.boundaries]){
        for(const guide of group.children){
          const links=guide.userData.links||[guide.userData.panel,guide.userData.panel]
          const originals=guide.userData.basePoints
          if(!originals)continue
          const positions=guide.geometry.attributes.position
          originals.forEach((point,index)=>{
            const next=links[index]===pose.id?moved(point):point
            positions.setXYZ(index,next.x,next.y,next.z)
          })
          positions.needsUpdate=true
        }
      }
      for(const cloud of state.dots.children){
        const markers=cloud.userData.markers||[]
        const dummy=new THREE.Object3D()
        markers.forEach((marker,index)=>{
          dummy.position.copy(marker.panel===pose.id?moved(marker.point):marker.point)
          dummy.updateMatrix();cloud.setMatrixAt(index,dummy.matrix)
        })
        cloud.instanceMatrix.needsUpdate=true
      }
      updateRings()
    }
    const commitPose = pose => {
      if(!pose)return
      const translation=pivot.position.clone().sub(pose.center)
      const spin=pivot.quaternion.clone().multiply(pose.quaternion.clone().invert())
      const baseRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...degrees(pose.placement.rotation_degrees||[0,0,0])))
      const euler=new THREE.Euler().setFromQuaternion(spin.multiply(baseRotation),'XYZ')
      if(translation.lengthSq()>1e-12||pivot.quaternion.angleTo(pose.quaternion)>1e-5)
        propsRef.current.onPlace?.({kind:'Place',panel:pose.id,placement:{
          ...pose.placement,translation:(pose.placement.translation||[0,0,0]).map((value,i)=>value+translation.getComponent(i)),
          rotation_degrees:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg)}})
    }

    const hit = event => {
      const rect = renderer.domElement.getBoundingClientRect()
      if (!rect.width || !rect.height) return null
      pointer.set(2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height)
      ray.setFromCamera(pointer, camera)
      const edge = ray.intersectObjects(boundaries.children, false).find(item => item.object.userData?.edge)
      const surface = ray.intersectObjects(cloth.children, false)[0]
      return edge && (!surface || edge.distance < surface.distance + .018)
        ? edge.object.userData : surface?.object.userData || null
    }
    // Keep the cloth responsive under the pointer while one Rust brush edit is
    // prepared. Solver positions remain authoritative after pointer release.
    // ClothCraft atelier.rs::pick_and_drag: triangle barycentric spring,
    // ray-normal drag plane, continuous solver updates; release removes force.
    const finishStretch = (event, cancelled) => {
      const grab=state.stretchGrab
      if(!grab)return
      state.stretchGrab=null
      controls.enabled=true
      renderer.domElement.style.cursor=''
      if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId)
      propsRef.current.onStretchCancel?.()
      renderer.domElement.dataset.fabricGrabState='idle'
    }
    state.cancelStretch=()=>{if(state.stretchGrab)finishStretch({pointerId:state.stretchGrab.pointerId},true)}
    const contextMenu = event => {
      event.preventDefault()
      event.stopPropagation()
      const picked = hit(event)
      // Client coordinates let the workspace's shared portal position the menu
      // correctly even when this canvas is nested in a resizable split pane.
      propsRef.current.onContextMenuRequest?.({
        x: event.clientX, y: event.clientY,
        hit: picked?.panel ? {panel: picked.panel, edge: picked.edge ?? null} : null,
      })
    }
    const pointerDown = event => {
      propsRef.current.onCanvasActivate?.()
      if (event.button !== 0) return
      if (state.stretchCommitPending) {event.preventDefault();return}
      const axis=transformMode()?ringHit(event):null
      if(axis&&propsRef.current.selected?.panel){
        const pose=startPose(propsRef.current.selected.panel)
        if(pose){
          const direction=axis==='free'?camera.getWorldDirection(new THREE.Vector3()).negate():
            new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0).applyQuaternion(pose.quaternion)
          state.ringDrag={pose,direction:direction.normalize(),previous:angleAt(event),accumulated:0}
          controls.enabled=false;transform.enabled=false
          renderer.domElement.setPointerCapture(event.pointerId)
          event.preventDefault();event.stopImmediatePropagation()
          return
        }
      }
      state.down = {x: event.clientX, y: event.clientY, hit: hit(event)}
      if (propsRef.current.mode === 'move3d' && state.down.hit?.panel && !state.transform.dragging && !state.transform.axis) {
        const id = state.down.hit.panel
        const surface = ray.intersectObjects(cloth.children, false).find(item => item.object.userData?.panel === id)
        const mesh = state.panelMeshes.get(id)
        const panel = propsRef.current.snapshot?.template?.panels?.find(item => item.id === id)
        if (mesh && surface && panel?.placement) {
          const start = surface.point.clone()
          state.move = {pointerId:event.pointerId,id, mesh, start, last:start.clone(), origin:mesh.position.clone(),pivotOrigin:pivot.position.clone(),
            plane:new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),start),
            placement:structuredClone(panel.placement)}
          controls.enabled = false
          renderer.domElement.setPointerCapture(event.pointerId)
          propsRef.current.onPick?.({panel:id})
        }
      }
      if (propsRef.current.mode === 'stretch3d' && typeof propsRef.current.onStretchDrag === 'function') {
        const surface=ray.intersectObjects(cloth.children,false)[0]
        const occluder=ray.intersectObjects(avatar.children,false)[0]
        if (surface?.object.userData?.panel && (!occluder||occluder.distance>=surface.distance-1e-5)) {
          const origin=surface.point.clone()
          state.down.hit={panel:surface.object.userData.panel}
          const mesh=surface.object,indices=mesh.geometry.userData.nativeVertices
          const face=surface.face,local=mesh.worldToLocal(origin.clone()),position=mesh.geometry.attributes.position
          const a=new THREE.Vector3().fromBufferAttribute(position,face.a),b=new THREE.Vector3().fromBufferAttribute(position,face.b),c=new THREE.Vector3().fromBufferAttribute(position,face.c)
          const bary=THREE.Triangle.getBarycoord(local,a,b,c,new THREE.Vector3())
          if(!bary)return
          const vertices=[face.a,face.b,face.c].map(i=>indices[i]),weights=bary.toArray()
          state.stretchGrab={pointerId:event.pointerId,panel:mesh.userData.panel,vertices,weights,origin,last:origin.clone(),
            plane:new THREE.Plane().setFromNormalAndCoplanarPoint(ray.ray.direction.clone(),origin)}
          renderer.domElement.dataset.fabricGrabState='dragging'
          controls.enabled=false
          renderer.domElement.setPointerCapture(event.pointerId)
          renderer.domElement.style.cursor='grabbing'
          propsRef.current.onStretchStart?.({vertices,weights,target:origin.toArray()})
          event.preventDefault()
          event.stopImmediatePropagation()
        }
      }
    }
    const pointerMove = event => {
      if(state.ringDrag){
        const drag=state.ringDrag,next=angleAt(event)
        let delta=next-drag.previous
        if(delta>Math.PI)delta-=2*Math.PI
        if(delta< -Math.PI)delta+=2*Math.PI
        drag.previous=next;drag.accumulated+=delta
        pivot.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(drag.direction,drag.accumulated).multiply(drag.pose.quaternion))
        previewPose(drag.pose)
        event.preventDefault()
        return
      }
      if (state.dragging) return
      const axis=transformMode()?ringHit(event):null
      transform.enabled=transformMode()&&!axis
      renderer.domElement.style.cursor=state.stretchGrab?'grabbing':axis?'crosshair':propsRef.current.mode==='stretch3d'?'grab':''
      const current = hit(event)
      if (!state.stretchGrab) propsRef.current.onHover?.(current)
      if (state.move && event.buttons === 1) {
        const point = ray.ray.intersectPlane(state.move.plane,new THREE.Vector3())
        if (point) {
          state.move.last.copy(point)
          const delta = point.clone().sub(state.move.start)
          state.move.mesh.position.copy(state.move.origin).add(delta)
          pivot.position.copy(state.move.pivotOrigin).add(delta)
          updateRings()
          // Update active sewing guides in-place while the selected cloth is
          // pulled away. All untouched panel endpoints stay at the draped pose.
          for (const guide of state.seams.children) {
            const links=guide.userData?.links,points=guide.userData?.basePoints
            if (!links || !points) continue
            const attr=guide.geometry.attributes.position
            for(let index=0;index<2;index++){
              const p=points[index].clone()
              if(links[index]===state.move.id)p.add(delta)
              attr.setXYZ(index,p.x,p.y,p.z)
            }
            attr.needsUpdate=true
          }
          for(const boundary of state.boundaries.children){
            if(boundary.userData.panel!==state.move.id)continue
            const attr=boundary.geometry.attributes.position
            boundary.userData.basePoints?.forEach((point,index)=>{
              const next=point.clone().add(delta)
              attr.setXYZ(index,next.x,next.y,next.z)
            })
            attr.needsUpdate=true
          }
          const dummy=new THREE.Object3D()
          for(const cloud of state.dots.children){
            ;(cloud.userData.markers||[]).forEach((marker,index)=>{
              dummy.position.copy(marker.point).add(marker.panel===state.move.id?delta:new THREE.Vector3())
              dummy.updateMatrix();cloud.setMatrixAt(index,dummy.matrix)
            })
            cloud.instanceMatrix.needsUpdate=true
          }
        }
        return
      }
      if (state.stretchGrab && event.buttons === 1) {
        const point=ray.ray.intersectPlane(state.stretchGrab.plane,new THREE.Vector3())
        if (point) {
          state.stretchGrab.last.copy(point)
          propsRef.current.onStretchDrag?.({vertices:state.stretchGrab.vertices,weights:state.stretchGrab.weights,target:point.toArray()})
        }
        event.preventDefault()
      }
    }
    const pointerUp = event => {
      if (state.stretchGrab) {
        const wasClick=state.down && Math.hypot(event.clientX-state.down.x,event.clientY-state.down.y)<5
        const picked=state.down?.hit
        finishStretch(event,event.type==='pointercancel')
        if(wasClick&&event.type!=='pointercancel')propsRef.current.onPick?.(picked)
        state.down=null
        return
      }
      if(state.ringDrag){
        const drag=state.ringDrag
        if(event.type==='pointercancel'){pivot.quaternion.copy(drag.pose.quaternion);previewPose(drag.pose)}
        else commitPose(drag.pose)
        state.ringDrag=null;controls.enabled=true;transform.enabled=transformMode()
        if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId)
        return
      }
      if (state.move) {
        const movement=state.move.last.clone().sub(state.move.start)
        const p=state.move.placement
        if (event.type!=='pointercancel' && movement.lengthSq()>1e-8) {
          const translation=(p.translation||[0,0,0]).map((n,i)=>n+movement.getComponent(i))
          propsRef.current.onPlace?.({kind:'Place',panel:state.move.id,placement:{...p,translation}})
        } else {state.move.mesh.position.copy(state.move.origin);setGrabRefresh(value=>value+1)}
        state.move=null
        controls.enabled=true
        if (renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId)
      }
      if (state.down && !state.dragging && Math.hypot(event.clientX - state.down.x, event.clientY - state.down.y) < 5)
        propsRef.current.onPick?.(hit(event))
      state.down = null
      state.stretchPlane = null
      state.stretchPoint = null
      state.stretchLast = null
    }
    const pointerLeave = () => {propsRef.current.onHover?.(null); if(!state.move&&!state.stretchGrab){state.down=null;state.stretchPlane=null}}
    const draggingChanged = event => {
      state.dragging = !!event.value
      controls.enabled = !event.value
      if (event.value) {
        state.handleStart = {position: pivot.position.clone(), rotation: pivot.quaternion.clone()}
        state.transformPose=startPose(propsRef.current.selected?.panel)
        const p = propsRef.current.snapshot?.template?.panels?.find(panel => panel.id === propsRef.current.selected?.panel)
        if (p) state.nativeStart = structuredClone(p.placement)
      }
    }
    const transformEnd = () => {
      if(state.transformPose){
        commitPose(state.transformPose)
        state.transformPose=null;state.nativeStart=null;state.handleStart=null
        return
      }
      const id = propsRef.current.selected?.panel
      if (!id || !state.nativeStart || !state.handleStart) return
      const base = state.nativeStart
      const movement = pivot.position.clone().sub(state.handleStart.position)
      const translation = (base.translation || [0, 0, 0]).map((coordinate, index) => coordinate + movement.getComponent(index))
      const baseQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...degrees(base.rotation_degrees || [0, 0, 0]), 'XYZ'))
      const rotationDelta = pivot.quaternion.clone().multiply(state.handleStart.rotation.clone().invert())
      const updatedEuler = new THREE.Euler().setFromQuaternion(rotationDelta.multiply(baseQuaternion), 'XYZ')
      const rotation_degrees = [updatedEuler.x, updatedEuler.y, updatedEuler.z].map(THREE.MathUtils.radToDeg)
      if (movement.lengthSq() > 1e-12 || rotation_degrees.some((value, index) => Math.abs(value - (base.rotation_degrees?.[index] || 0)) > 1e-5))
        propsRef.current.onPlace?.({kind: 'Place', panel: id, placement: {translation, rotation_degrees}})
      state.nativeStart = null
      state.handleStart = null
    }
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointerdown', pointerDown, true)
    renderer.domElement.removeEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('contextmenu', contextMenu)
    renderer.domElement.addEventListener('pointerup', pointerUp)
    renderer.domElement.addEventListener('pointercancel', pointerUp)
    const cancelLostGrab=()=>{state.cancelStretch?.();if(state.move)pointerUp({type:'pointercancel',pointerId:state.move.pointerId,clientX:NaN,clientY:NaN})}
    renderer.domElement.addEventListener('lostpointercapture',cancelLostGrab)
    window.addEventListener('blur',cancelLostGrab)
    renderer.domElement.addEventListener('pointerleave', pointerLeave)
    transform.addEventListener('dragging-changed', draggingChanged)
    const transformPreview=()=>previewPose(state.transformPose)
    transform.addEventListener('objectChange', transformPreview)
    transform.addEventListener('mouseUp', transformEnd)
    const resize = () => {
      if (!hostNode.isConnected) return
      const {width, height} = hostNode.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(hostNode)
    resize()
    const render = () => {
      state.requestId = requestAnimationFrame(render)
      updateRings()
      controls.update()
      renderer.render(scene, camera)
    }
    render()
    return () => {
      cancelAnimationFrame(state.requestId)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', pointerDown, true)
      renderer.domElement.removeEventListener('pointermove', pointerMove)
      renderer.domElement.removeEventListener('contextmenu', contextMenu)
      renderer.domElement.removeEventListener('pointerup', pointerUp)
      renderer.domElement.removeEventListener('pointercancel', pointerUp)
      renderer.domElement.removeEventListener('lostpointercapture',cancelLostGrab)
      window.removeEventListener('blur',cancelLostGrab)
      renderer.domElement.removeEventListener('pointerleave', pointerLeave)
      transform.removeEventListener('dragging-changed', draggingChanged)
      transform.removeEventListener('mouseUp', transformEnd)
      transform.removeEventListener('objectChange', transformPreview)
      transform.detach()
      transform.dispose()
      controls.dispose()
      replaceChildren(cloth); replaceChildren(avatar); replaceChildren(boundaries)
      replaceChildren(seams); replaceChildren(dots); replaceChildren(boxes)
      disposeTree(rings)
      scene.environment = null
      studioEnvironment.dispose()
      pmremGenerator.dispose()
      studioBackdrop.dispose()
      floor.geometry.dispose();floor.material.dispose()
      grid.geometry.dispose()
      for (const value of [grid.material, axes.material]) {
        for (const mat of Array.isArray(value)?value:[value]) mat?.dispose?.()
      }
      disposeTree(axes)
      centerGuide.geometry.dispose()
      centerGuide.material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    state.floor.visible = showFloor
    state.grid.visible = showFloor
    const lighting = {
      studio: {hemi:1.85,key:2.6,rim:.85},
      softbox: {hemi:2.35,key:2.15,rim:.62},
      dramatic: {hemi:1.05,key:3.4,rim:1.65},
      neutral: {hemi:1.95,key:2.3,rim:.8},
    }[environmentPreset] || {hemi:1.85,key:2.6,rim:.85}
    state.ambient.intensity = lighting.hemi
    state.key.intensity = lighting.key
    state.fill.intensity = lighting.rim
    state.renderer.domElement.dataset.studioLightingPreset = environmentPreset
    state.renderer.domElement.dataset.studioFloorVisible = String(showFloor)
  }, [environmentPreset, showFloor])

  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    const {cloth, boundaries, seams, dots, avatar, boxes, panelMeshes, panelOffsets} = state
    for (const group of [cloth, boundaries, seams, dots, avatar, boxes]) replaceChildren(group)
    panelMeshes.clear()
    panelOffsets.clear()
    if (!snapshot) {
      state.markerCounts = SEAM_COLORS.map(() => 0)
      setMarkerDiagnostics(state.renderer.domElement, state.markerCounts, false)
      return
    }
    const world = snapshot.positions || []
    const panels = snapshot.panels || []
    const templatePanels = snapshot.template?.panels || []
    const offsetMagnitude = typeof spread === 'number' && Number.isFinite(spread) ? Math.max(0, spread) : (spread ? .3 : 0)
    panels.forEach((panel, index) => {
      const piece = templatePanels.find(item => item.id === panel.id)
      const triangleRange = Array.isArray(panel.triangles) ? snapshot.triangles.slice(panel.triangles[0], panel.triangles[1]) : []
      const panelMesh = buildIndexedMesh(world, triangleRange, COLORS[index % COLORS.length], snapshot.uv)
      panelMesh.material.dispose()
      panelMesh.material = createFabricSurface(snapshot.template?.fabrics?.find(f=>f.id===piece?.fabric),piece?.grain_degrees||0)
      const offset = new THREE.Vector3()
      if (offsetMagnitude) {
        const angle = (index / Math.max(1, panels.length)) * 2 * Math.PI
        offset.set(Math.cos(angle) * offsetMagnitude, 0, Math.sin(angle) * offsetMagnitude)
      }
      panelMesh.position.copy(offset)
      panelMesh.userData = {panel: panel.id}
      panelMesh.material.wireframe = wireframe
      panelMesh.castShadow = true
      panelMesh.receiveShadow = true
      cloth.add(panelMesh)
      panelMeshes.set(panel.id, panelMesh)
      panelOffsets.set(panel.id, offset)
      for (const [edge, indices] of Object.entries(panel.boundaries || {})) {
        if (indices.length < 2) continue
        const vertices = indices.filter(i => finiteVec(world[i])).map(i => v3(world[i]).add(offset))
        if (vertices.length < 2) continue
        const geometry = new THREE.BufferGeometry().setFromPoints(vertices)
        const outline = new THREE.Line(geometry, new THREE.LineBasicMaterial({color: '#566875', transparent: true, opacity: .76}))
        outline.userData = {panel: panel.id, edge}
        outline.userData.basePoints=vertices.map(value=>value.clone())
        boundaries.add(outline)
      }
      if (!piece) return
    })
    // Keep precisely the Rust guide endpoints, with clear, unlit marks that
    // remain legible against the garment even at grazing camera angles.
    const dotGeometry = new THREE.SphereGeometry(.008, 8, 6)
    const sharedDotMaterials = SEAM_COLORS.map(color => new THREE.MeshBasicMaterial({
      color, depthTest:false, depthWrite:false, toneMapped:false,
    }))
    // One instanced draw call per seam color, regardless of guide count.
    const dotPositions = SEAM_COLORS.map(() => [])
    ;(snapshot.seams || []).forEach((seam, index) => {
      const colorIndex = index % SEAM_COLORS.length
      const spec = snapshot.template?.seams?.find(item => item.id === seam.id)
      const highlighted = !!active && [spec?.a, spec?.b].some(side => side?.panel === active.panel && (!active.edge || side.edge === active.edge))
      ;(seam.guides || []).forEach((pair, pairIndex) => {
        if (!Array.isArray(pair) || pair.length !== 2) return
        const ends = pair.map((weights, sideIndex) => {
          const value = weighted(weights, world)
          const panelId = sideIndex ? spec?.b?.panel : spec?.a?.panel
          return value.add(panelOffsets.get(panelId) || new THREE.Vector3())
        })
        if (showSeams && (highlighted || pairIndex % 3 === 0)) {
          const guide=line(ends[0], ends[1], highlighted ? '#f07847' : SEAM_COLORS[colorIndex], highlighted ? 1 : .62)
          guide.userData={links:[spec?.a?.panel,spec?.b?.panel],basePoints:ends.map(point=>point.clone())}
          seams.add(guide)
        }
        if (showSeams && showContactDots && (highlighted || pairIndex % 2 === 0))
          dotPositions[colorIndex].push({point:ends[0].clone(),panel:spec?.a?.panel},{point:ends[1].clone(),panel:spec?.b?.panel})
      })
    })
    sharedDotMaterials.forEach((mat, index) => {
      const positions = dotPositions[index]
      if (!positions.length) {mat.dispose(); return}
      const mesh = new THREE.InstancedMesh(dotGeometry.clone(), mat, positions.length)
      const dummy = new THREE.Object3D()
      positions.forEach(({point}, i) => {
        dummy.position.copy(point)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.frustumCulled = false
      mesh.renderOrder = 85
      mesh.userData.markers=positions
      dots.add(mesh)
    })
    state.markerCounts = dotPositions.map(positions => positions.length)
    setMarkerDiagnostics(state.renderer.domElement, state.markerCounts, showSeams && showContactDots)
    dotGeometry.dispose()
    if (snapshot.avatar?.positions?.length && snapshot.avatar?.triangles?.length) {
      const bodyMesh=buildIndexedMesh(snapshot.avatar.positions, snapshot.avatar.triangles, '#555b64')
      bodyMesh.material.metalness=0;bodyMesh.material.roughness=.95
      avatar.add(bodyMesh)
      state.renderer.domElement.dataset.avatarColor='#555b64'
    }
    avatar.visible = showAvatar
    state.renderer.domElement.dataset.avatarVisible = String(showAvatar && avatar.children.length > 0)
    boundaries.visible = showSeams
    seams.visible = showSeams
    dots.visible = showSeams && showContactDots
    state.renderer.domElement.dataset.fabricPresets=JSON.stringify([...panelMeshes.values()].map(m=>m.material.userData.fabricPreset))
    state.renderer.domElement.dataset.nativeGrabActive=String(Boolean(snapshot.grabActive))
    state.renderer.domElement.dataset.simulationTime=String(snapshot.time)
    state.sceneSnapshot = snapshot
  }, [snapshot, spread, grabRefresh])

  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    state.avatar.visible = showAvatar
    state.renderer.domElement.dataset.avatarVisible = String(showAvatar && state.avatar.children.length > 0)
    state.boundaries.visible = showSeams
    state.seams.visible = showSeams
    state.dots.visible = showSeams && showContactDots
    setMarkerDiagnostics(state.renderer.domElement, state.markerCounts || SEAM_COLORS.map(() => 0), state.dots.visible)
    for (const mesh of state.panelMeshes.values()) mesh.material.wireframe = wireframe
    const currentPanel = selected?.panel
    for (const [id, mesh] of state.panelMeshes) {
      const hover = active?.panel === id
      // Preserve the fabric surface during linked selection; emissive supplies the highlight.
      mesh.material.emissive.set(hover ? '#5a3111' : '#000000')
      mesh.material.emissiveIntensity = hover ? .24 : 0
    }
    for (const boundary of state.boundaries.children) {
      const highlighted = boundary.userData.panel === active?.panel && (!active.edge || active.edge === boundary.userData.edge)
      boundary.material.color.set(highlighted ? '#f0794c' : '#566875')
      boundary.material.opacity = highlighted ? 1 : .76
    }
    replaceChildren(state.boxes)
    if (showBoundingBox && currentPanel && state.panelMeshes.has(currentPanel)) {
      const bounds = new THREE.Box3().setFromObject(state.panelMeshes.get(currentPanel))
      if (!bounds.isEmpty()) state.boxes.add(new THREE.Box3Helper(bounds, '#e99b50'))
    }
    const nativePanel = snapshot?.template?.panels?.find(panel => panel.id === currentPanel)
    if (nativePanel && ['move3d', 'rotate3d','transform'].includes(mode) && state.panelMeshes.has(currentPanel) && !state.dragging && !state.ringDrag && !state.move) {
      const bounds = new THREE.Box3().setFromObject(state.panelMeshes.get(currentPanel))
      bounds.getCenter(state.pivot.position)
      state.pivot.rotation.set(0, 0, 0)
      state.transform.setMode('translate')
      state.transform.attach(state.pivot)
      state.transform.visible = true
      state.transform.enabled = true
      state.ringEnabled=true
    } else if (!state.dragging&&!state.ringDrag&&!state.move) {
      state.ringEnabled=false
      state.rings.visible=false
      state.transform.detach()
      state.transform.visible=false
      state.transform.enabled=false
      delete state.renderer.domElement.dataset.gizmoCenterX
      delete state.renderer.domElement.dataset.gizmoCenterY
      delete state.renderer.domElement.dataset.gizmoRingRadius
      state.renderer.domElement.dataset.gizmoVisible='false'
    }
  }, [snapshot, active?.panel, active?.edge, selected?.panel, mode, showAvatar,
    showSeams, wireframe, showBoundingBox, showContactDots, spread])

  useEffect(()=>{if(mode!=='stretch3d')sceneRef.current?.cancelStretch?.()},[mode])

  const view = position => {
    const state = sceneRef.current
    if (!state) return
    const target = new THREE.Vector3(0, .96, 0)
    state.controls.target.copy(target)
    state.camera.position.copy(target.clone().add(new THREE.Vector3(...position)))
    state.camera.lookAt(target)
    state.controls.update()
  }
  return <div ref={host} className="cc-scene" aria-label="EXO 3D garment scene: Rust geometry, interactive transform gizmo and sewing guides">
    <ClothCraftCornerTools dimension="3d" mode={mode} onChangeMode={onChangeMode} disabled={toolsDisabled}/>
    <div className="cc-v2-orientation" role="group" aria-label="3D viewport orientation widget"
      style={{left:'auto',right:12,top:12,padding:3,background:'rgba(231,238,242,.94)'}}>
      <strong title="World orientation">XYZ</strong>
      <button type="button" onClick={() => view([0, .05, 3.3])} title="Front camera: looking along Z">F</button>
      <button type="button" onClick={() => view([3.3, .05, 0])} title="Right camera: looking along X">R</button>
      <button type="button" onClick={() => view([0, 3.4, .02])} title="Top camera: looking down Y">T</button>
      <button type="button" onClick={() => view([2.4, .7, 3.1])} title="Perspective orbit camera">3D</button>
    </div>
  </div>
}
