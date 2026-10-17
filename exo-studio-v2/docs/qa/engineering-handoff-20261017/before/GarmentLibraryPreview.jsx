import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { createTemplateProject } from '../data/templates.js'
import {
  addPatternThread,
  createKnitTextures,
  garmentPreviewPose,
  inwardOffsetEdge,
  makePanelGeometry,
} from '../core/garmentPreviewGeometry.js'
import { buildAssembledTee } from './assembledTeePreviewGeometry.js'
import './GarmentLibraryPreview.css'

/** Garment assembly study built from real template outlines, seams and source topstitches.
 * Curvature and placement are posed illustrations; no cloth dynamics are run here. */
export default function GarmentLibraryPreview({ name = 'Garment', templateId = 'tee' }) {
  const mount = useRef(null)
  const presentation = useRef(null)
  const drag = useRef(null)
  const [layers, setLayers] = useState({ style: true, sewing: true, edges: true })
  const [viewMode,setViewMode]=useState('three-quarter')
  const project = useMemo(() => createTemplateProject(templateId), [templateId])
  const pieces = useMemo(() => (project.pieces || []).filter(piece => piece.points?.length >= 3).slice(0, 14), [project])
  const seamEdges = useMemo(() => {
    const result = new Map()
    for (const seam of project.seams || []) {
      for (const end of [seam.a, seam.b]) {
        if (!end?.pieceId || !Number.isInteger(end.edgeIndex)) continue
        if (!result.has(end.pieceId)) result.set(end.pieceId, new Set())
        result.get(end.pieceId).add(end.edgeIndex)
      }
    }
    return result
  }, [project])

  useEffect(() => {
    const host = mount.current
    if (!host) return undefined
    const resources = []
    let renderer
    let observer
    try {
      const scene = new THREE.Scene()
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.08
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.domElement.dataset.previewStatus = 'loading'
      renderer.domElement.dataset.previewTemplateId = templateId
      renderer.domElement.dataset.previewRenderMode = templateId === 'tee' && viewMode !== 'exploded' ? 'pattern-derived-tee-assembly' : 'posed-source-pattern-study'
      host.appendChild(renderer.domElement)
      const camera = new THREE.PerspectiveCamera(34, 1, .1, 80)
      const root = new THREE.Group()
      scene.add(root)

      scene.add(new THREE.HemisphereLight(0xf6f8fc, 0x454852, 1.30))
      const softbox = new THREE.DirectionalLight(0xfff1e7, 2.5)
      softbox.position.set(-3.8, 5.5, 5.2)
      scene.add(softbox)
      const rim = new THREE.DirectionalLight(0xd7e6f5, 2.3)
      rim.position.set(3.6, 1.2, -4.3)
      scene.add(rim)
      const fill = new THREE.DirectionalLight(0xe4e9f2, .7)
      fill.position.set(4, -2.4, 3.1)
      scene.add(fill)

      const textile = createKnitTextures(resources)
      const fabric = new THREE.MeshPhysicalMaterial({
        color: '#d1d0cb', map: textile.map, bumpMap: textile.bumpMap, bumpScale: .012,
        metalness: 0, roughness: .84, sheen: .94, sheenRoughness: .82,
        clearcoat: .025, clearcoatRoughness: .96, side: THREE.DoubleSide,
      })
      const lining = new THREE.MeshPhysicalMaterial({
        color: '#b5b7b4', map: textile.map, bumpMap: textile.bumpMap, bumpScale: .008,
        metalness: 0, roughness: .95, side: THREE.DoubleSide,
      })
      const clothEdge = new THREE.MeshStandardMaterial({ color: '#777b7a', roughness: 1, side: THREE.DoubleSide })
      resources.push(fabric, lining, clothEdge)

      let meshCount = 0
      let triangleCount = 0
      let edgeCount = 0
      const allLayers = []
      if (templateId === 'tee' && viewMode !== 'exploded') {
        const assembled=buildAssembledTee(project,fabric,resources)
        root.add(assembled)
        const meshes = assembled.children.filter(child => child.isMesh)
        meshCount = meshes.length
        triangleCount = meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position?.count ?? 0) / 3, 0)
        edgeCount = pieces.reduce((sum, piece) => sum + piece.points.length, 0)
      } else pieces.forEach((piece, index) => {
        const pose = garmentPreviewPose(piece, templateId, index, pieces.length)
        const panel = makePanelGeometry(piece, pose, resources)
        if (!panel) return
        const surface = new THREE.Mesh(panel.geometry, piece.id === 'back' ? lining : fabric)
        surface.name = piece.id + '-source-posed-panel'
        surface.userData.sourcePieceId = piece.id
        surface.userData.isSurface = true
        root.add(surface)
        const rimMesh = new THREE.Mesh(panel.edgeGeometry, clothEdge)
        rimMesh.userData.sourcePieceId = piece.id
        root.add(rimMesh)
        meshCount += 2
        triangleCount += panel.triangles
        edgeCount += piece.points.length

        // The stroke is tied directly to the sampled source cut boundary.
        addPatternThread(root, [...panel.boundary.points, panel.boundary.points[0]], pose, resources, {
          color: '#686d6c', radius: .0033, layer: 'edges', lift: .014,
        })
        for (const edgeIndex of seamEdges.get(piece.id) || []) {
          addPatternThread(root, inwardOffsetEdge(piece, edgeIndex, .55), pose, resources, {
            color: '#8a8d88', radius: .0029, dashed: true, lift: .018,
          })
        }
        // One/two row topstitches use each drafted edge number and actual offset.
        for (const stitch of piece.topstitches || []) {
          const count = Math.max(1, Math.min(3, stitch.rows || 1))
          for (let row = 0; row < count; row += 1) {
            const offset = Number(stitch.offsetCm || 0.7) + row * Number(stitch.rowGapCm || 0.45)
            addPatternThread(root, inwardOffsetEdge(piece, stitch.edgeIndex, offset), pose, resources, {
              color: '#969994', radius: .004, lift: .025,
            })
          }
        }
        // Rib finish lies along the true neckline drafting edges on both torso panels.
        if (templateId === 'tee' && ['front', 'back'].includes(piece.id)) {
          for (const edgeIndex of [9, 10, 11]) {
            addPatternThread(root, inwardOffsetEdge(piece, edgeIndex, .29), pose, resources, {
              color: '#aeb0ac', radius: .009, lift: .022,
            })
          }
        }
        for (const line of piece.internalLines || []) {
          const points = line.points || line
          if (!Array.isArray(points) || points.length < 2) continue
          addPatternThread(root, points, pose, resources, { color: '#989995', radius: .0035, layer: 'style' })
        }
      })
      root.rotation.y = viewMode === 'front' ? 0 : viewMode === 'exploded' ? -.2 : -.65
      root.rotation.x = viewMode === 'front' ? 0 : -.045
      renderer.domElement.dataset.previewAngle = String(root.rotation.y)
      renderer.domElement.dataset.previewMeshCount = String(meshCount)
      renderer.domElement.dataset.previewTriangleCount = String(triangleCount)
      renderer.domElement.dataset.previewSourcePieceCount = String(pieces.length)
      renderer.domElement.dataset.previewSourceEdgeCount = String(edgeCount)
      renderer.domElement.dataset.previewStatus = meshCount ? 'ready' : 'empty'
      // Keep the actual source geometry in view on small hover cards and mobile.
      const bounds = new THREE.Box3().setFromObject(root)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      camera.lookAt(center)
      const render = () => {
        const width = Math.max(1, host.clientWidth)
        const height = Math.max(1, host.clientHeight)
        if (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) ||
            renderer.domElement.height !== Math.round(height * renderer.getPixelRatio())) {
          renderer.setSize(width, height)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
        }
        const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
        const horizontal = vertical * Math.max(.45, width / height)
        const distance = Math.max(size.y / (2 * vertical), size.x / (2 * horizontal), 2.2) * 1.2
        camera.position.set(center.x + .05, center.y + .05, center.z + distance)
        camera.lookAt(center)
        renderer.render(scene, camera)
      }
      presentation.current = { root, render, canvas: renderer.domElement, allLayers }
      root.traverse(node => { if (node.userData?.previewLayer) allLayers.push(node) })
      for (const node of allLayers) node.visible = layers[node.userData.previewLayer] !== false
      renderer.domElement.dataset.previewVisibleDetails = String(allLayers.filter(node => node.visible).length)
      render()
      observer = new ResizeObserver(render)
      observer.observe(host)
    } catch (error) {
      console.error('Garment preview rendering failed', error)
      if (renderer?.domElement) renderer.domElement.dataset.previewStatus = 'failed'
    }
    return () => {
      observer?.disconnect()
      if (presentation.current?.canvas === renderer?.domElement) presentation.current = null
      if (renderer?.domElement.parentNode === host) host.removeChild(renderer.domElement)
      for (const resource of resources) resource.dispose()
      renderer?.dispose()
      renderer?.forceContextLoss()
    }
  }, [pieces, seamEdges, templateId, project, viewMode])

  useEffect(() => {
    const view = presentation.current
    if (!view) return
    for (const node of view.allLayers) node.visible = layers[node.userData.previewLayer] !== false
    view.canvas.dataset.previewVisibleDetails = String(view.allLayers.filter(node => node.visible).length)
    view.render()
  }, [layers, project])

  const turn = (yaw, pitch = 0) => {
    const view = presentation.current
    if (!view) return
    view.root.rotation.y = THREE.MathUtils.clamp(view.root.rotation.y + yaw, -Math.PI, Math.PI)
    view.root.rotation.x = THREE.MathUtils.clamp(view.root.rotation.x + pitch, -.5, .5)
    view.canvas.dataset.previewAngle = String(view.root.rotation.y)
    view.render()
  }
  return <div className="exo-garment-mini">
    <div className="exo-garment-mini-topline"><span className="exo-garment-mini-live" />{templateId === 'tee' ? 'GARMENT ASSEMBLY VIEW' : 'CURVED SOURCE PANELS'}<span>3D</span></div>
    <div ref={mount} className="exo-garment-mini-canvas" role="img" data-template-id={templateId} data-piece-count={project.pieces?.length || 0} data-seam-count={project.seams?.length || 0} aria-label={name + ': posed 3D study of original sewing pattern panels and seam paths'}
      onPointerDown={event => { drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => {
        if (drag.current?.id !== event.pointerId) return
        const dx = event.clientX - drag.current.x
        const dy = event.clientY - drag.current.y
        drag.current.x = event.clientX
        drag.current.y = event.clientY
        turn(dx * .008, -dy * .006)
      }}
      onPointerUp={() => { drag.current = null }}
      onPointerCancel={() => { drag.current = null }} />
    <div className="exo-garment-mini-views" role="group" aria-label="Garment inspection view">{[['front','FRONT'],['three-quarter','3/4 VIEW'],['exploded','PATTERN EXPLODED']].map(([key,label])=><button key={key} type="button" aria-pressed={viewMode===key} onClick={()=>setViewMode(key)}>{label}</button>)}</div>
    <div className="exo-garment-mini-caption">{project.pieces?.length || 0} SOURCE PANELS <span /> {project.seams?.length || 0} SEAM LINKS <span /> FABRIC SURFACE</div>
    <div className="exo-garment-mini-rotate"><button type="button" onClick={() => turn(-.32)} aria-label="Rotate garment left">↶</button><span>DRAG TO ORBIT · ILLUSTRATIVE ASSEMBLY</span><button type="button" onClick={() => turn(.32)} aria-label="Rotate garment right">↷</button></div>
    <div className="exo-garment-mini-switches">{[['style', 'Style lines'], ['sewing', 'Sewing lines'], ['edges', 'Pattern edges']].map(([key, label]) => <button key={key} type="button" aria-pressed={layers[key]} onClick={() => setLayers(current => ({ ...current, [key]: !current[key] }))}>{label}</button>)}</div>
  </div>
}
