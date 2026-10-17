import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { createTemplateProject } from '../data/templates.js'
import { garmentPreviewPage } from '../core/garmentPreviewPaging.js'
import { createGarmentPreviewTextile, garmentPreviewStudioColor } from '../core/garmentPreviewFabric.js'
import {
  addPatternThread,
  inwardOffsetEdge,
  makePanelGeometry,
} from '../core/garmentPreviewGeometry.js'
import { garmentThreeViewPose } from './garmentThreeViewPose.js'
import './GarmentLibraryPreview.css'

/** Static multi-angle arrangement of source pattern pieces, inspired by IMG_6936.
 * Curvature and placement are posed illustrations; no cloth dynamics are run here. */
export default function GarmentLibraryPreview({ name = 'Garment', templateId = 'tee' }) {
  const mount = useRef(null)
  const presentation = useRef(null)
  const [layers, setLayers] = useState({ style: false, sewing: false, edges: true })
  const [piecePage, setPiecePage] = useState(0)
  const [renderFailure, setRenderFailure] = useState(false)
  const project = useMemo(() => createTemplateProject(templateId), [templateId])
  const mainFabric = project.fabrics?.main || {}
  // Do not retain another garment's pagination when the Library swaps assets.
  useEffect(() => {setPiecePage(0);setRenderFailure(false)}, [templateId])
  const previewPage = useMemo(() => garmentPreviewPage(project.pieces, piecePage), [project, piecePage])
  const { pieces } = previewPage
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
      renderer.toneMappingExposure = 1.12
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
      renderer.domElement.dataset.previewStatus = 'loading'
      renderer.domElement.dataset.previewTemplateId = templateId
      renderer.domElement.dataset.previewRenderMode = 'reference-three-view-static'
      renderer.domElement.dataset.previewViewCount = '3'
      host.appendChild(renderer.domElement)
      const camera = new THREE.OrthographicCamera(-4, 4, 2, -2, .1, 80)
      const root = new THREE.Group()

      scene.add(new THREE.HemisphereLight(0xf6f8fc, 0x454852, 1.45))
      const softbox = new THREE.DirectionalLight(0xfff1e7, 2.5)
      softbox.position.set(-3.8, 5.5, 5.2)
      scene.add(softbox)
      const rim = new THREE.DirectionalLight(0xd7e6f5, 2.3)
      rim.position.set(3.6, 1.2, -4.3)
      scene.add(rim)
      const fill = new THREE.DirectionalLight(0xe4e9f2, .7)
      fill.position.set(4, -2.4, 3.1)
      scene.add(fill)

      const textile = createGarmentPreviewTextile(resources, mainFabric)
      const studioColor = garmentPreviewStudioColor(mainFabric.color)
      renderer.domElement.dataset.previewTextileFamily = textile.family
      renderer.domElement.dataset.previewTextileProvenance = 'procedural-estimated'
      renderer.domElement.dataset.previewOriginalFabricColor = studioColor.sourceColor || ''
      renderer.domElement.dataset.previewStudioColorLifted = String(studioColor.adjusted)
      const fabric = new THREE.MeshPhysicalMaterial({
        color: studioColor.color, map: textile.map, bumpMap: textile.bumpMap, bumpScale: .00045,
        metalness: 0, roughness: .84, sheen: .3, sheenRoughness: .82,
        clearcoat: 0, side: THREE.DoubleSide,
      })
      const lining = new THREE.MeshPhysicalMaterial({
        color: studioColor.color, map: textile.map, bumpMap: textile.bumpMap, bumpScale: .00045,
        metalness: 0, roughness: .95, side: THREE.DoubleSide,
      })
      const clothEdge = new THREE.MeshStandardMaterial({ color: '#777b7a', roughness: 1, side: THREE.DoubleSide })
      resources.push(fabric, lining, clothEdge)

      let meshCount = 0
      let triangleCount = 0
      let edgeCount = 0
      const panelTriangleCounts = new Map()
      const allLayers = []
      pieces.forEach((piece, index) => {
        const pose = garmentThreeViewPose(piece, templateId, index, pieces.length)
        const panel = makePanelGeometry(piece, pose, resources)
        if (!panel) return
        // Collect each source piece as one unit, so the side diagram can omit
        // the far sleeve without removing individual lines or fabric finishes.
        const pieceGroup = new THREE.Group()
        pieceGroup.name = 'source-piece-' + piece.id
        pieceGroup.userData.sourcePieceId = piece.id
        root.add(pieceGroup)
        const surface = new THREE.Mesh(panel.geometry, piece.id === 'back' ? lining : fabric)
        surface.name = piece.id + '-source-posed-panel'
        surface.userData.sourcePieceId = piece.id
        surface.userData.isSurface = true
        surface.userData.presentationOnly = true
        pieceGroup.add(surface)
        const rimMesh = new THREE.Mesh(panel.edgeGeometry, clothEdge)
        rimMesh.userData.sourcePieceId = piece.id
        rimMesh.userData.presentationOnly = true
        pieceGroup.add(rimMesh)
        meshCount += 2
        triangleCount += panel.triangles
        panelTriangleCounts.set(piece.id, panel.triangles)
        edgeCount += piece.points.length

        // The stroke is tied directly to the sampled source cut boundary.
        addPatternThread(pieceGroup, [...panel.boundary.points, panel.boundary.points[0]], pose, resources, {
          color: '#686d6c', radius: .0033, layer: 'edges', lift: .014,
        })
        for (const edgeIndex of seamEdges.get(piece.id) || []) {
          addPatternThread(pieceGroup, inwardOffsetEdge(piece, edgeIndex, .55), pose, resources, {
            color: '#8a8d88', radius: .0029, dashed: true, lift: .018,
          })
        }
        // One/two row topstitches use each drafted edge number and actual offset.
        for (const stitch of piece.topstitches || []) {
          const count = Math.max(1, Math.min(3, stitch.rows || 1))
          for (let row = 0; row < count; row += 1) {
            const offset = Number(stitch.offsetCm || 0.7) + row * Number(stitch.rowGapCm || 0.45)
            addPatternThread(pieceGroup, inwardOffsetEdge(piece, stitch.edgeIndex, offset), pose, resources, {
              color: '#969994', radius: .004, lift: .025,
            })
          }
        }
        // Rib finish lies along the true neckline drafting edges on both torso panels.
        if (templateId === 'tee' && ['front', 'back'].includes(piece.id)) {
          for (const edgeIndex of [9, 10, 11]) {
            addPatternThread(pieceGroup, inwardOffsetEdge(piece, edgeIndex, .29), pose, resources, {
              color: '#aeb0ac', radius: .009, lift: .022, layer: 'style',
            })
          }
        }
        for (const line of piece.internalLines || []) {
          const points = line.points || line
          if (!Array.isArray(points) || points.length < 2) continue
          addPatternThread(pieceGroup, points, pose, resources, { color: '#989995', radius: .0035, layer: 'style' })
        }
      })
      // Render all three orthographic views in one frame. Clones share the
      // exact same source-derived geometries and materials, avoiding three
      // independent WebGL contexts or separate loading and disposal cycles.
      const showcase = new THREE.Group()
      const frontView = root
      const sideView = root.clone(true)
      const backView = root.clone(true)
      // A pattern arrangement side study shows a single nearby rolled sleeve;
      // projecting both sleeves causes them to cross the torso profiles.
      const farSleeve = ['tee', 'hoodie', 'zip-hoodie'].includes(templateId)
        ? sideView.children.find(child => child.userData.sourcePieceId === 'sleeve-left')
        : null
      if (farSleeve) sideView.remove(farSleeve)
      const layout = [
        { group: frontView, x: -2.5, yaw: 0, name: 'front' },
        // A true 90-degree profile collapses the deliberately thin, unsewn
        // panels to hairlines. An oblique side study shows their rolled depth.
        { group: sideView, x: 0, yaw: -1.02, name: 'side' },
        { group: backView, x: 2.5, yaw: Math.PI, name: 'back' },
      ]
      for (const view of layout) {
        view.group.position.x = view.x
        view.group.rotation.y = view.yaw
        view.group.name = 'garment-' + view.name + '-view'
        showcase.add(view.group)
      }
      scene.add(showcase)
      renderer.domElement.dataset.previewViews = layout.map(view => view.name).join(',')
      renderer.domElement.dataset.previewMeshCount = String(meshCount * layout.length - (farSleeve ? 2 : 0))
      renderer.domElement.dataset.previewTriangleCount = String(triangleCount * layout.length - (farSleeve ? panelTriangleCounts.get('sleeve-left') || 0 : 0))
      renderer.domElement.dataset.previewSourcePieceCount = String(previewPage.total)
      renderer.domElement.dataset.previewDisplayedPieceCount = String(pieces.length)
      renderer.domElement.dataset.previewHiddenPieceCount = String(previewPage.total - pieces.length)
      renderer.domElement.dataset.previewInvalidPieceCount = String(previewPage.invalidCount)
      renderer.domElement.dataset.previewPage = String(previewPage.page + 1)
      renderer.domElement.dataset.previewPageCount = String(previewPage.pageCount)
      renderer.domElement.dataset.previewSourcePieceIds = pieces.map(piece => piece.id).join(',')
      renderer.domElement.dataset.previewSourceEdgeCount = String(edgeCount)
      renderer.domElement.dataset.previewStatus = meshCount ? 'ready' : 'empty'
      // Fit the entire triptych at every host aspect ratio without orbiting.
      const bounds = new THREE.Box3().setFromObject(showcase)
      const size = bounds.getSize(new THREE.Vector3())
      const center = bounds.getCenter(new THREE.Vector3())
      const render = () => {
        const width = Math.max(1, host.clientWidth)
        const height = Math.max(1, host.clientHeight)
        if (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) ||
            renderer.domElement.height !== Math.round(height * renderer.getPixelRatio())) {
          renderer.setSize(width, height)
        }
        const aspect = width / height
        const halfHeight = Math.max(size.y * .60, size.x * .56 / aspect, 1.48)
        camera.left = -halfHeight * aspect
        camera.right = halfHeight * aspect
        camera.top = halfHeight
        camera.bottom = -halfHeight
        camera.updateProjectionMatrix()
        camera.position.set(center.x, center.y + .025, center.z + 15)
        camera.lookAt(center)
        renderer.render(scene, camera)
      }
      presentation.current = { render, canvas: renderer.domElement, allLayers }
      showcase.traverse(node => { if (node.userData?.previewLayer) allLayers.push(node) })
      for (const node of allLayers) node.visible = layers[node.userData.previewLayer] !== false
      renderer.domElement.dataset.previewVisibleDetails = String(allLayers.filter(node => node.visible).length)
      render()
      if(renderFailure)setRenderFailure(false)
      observer = new ResizeObserver(render)
      observer.observe(host)
    } catch (error) {
      console.error('Garment preview rendering failed', error)
      if (renderer?.domElement) renderer.domElement.dataset.previewStatus = 'failed'
      setRenderFailure(true)
    }
    return () => {
      observer?.disconnect()
      if (presentation.current?.canvas === renderer?.domElement) presentation.current = null
      if (renderer?.domElement.parentNode === host) host.removeChild(renderer.domElement)
      for (const resource of resources) resource.dispose()
      renderer?.dispose()
      renderer?.forceContextLoss()
    }
  }, [pieces, seamEdges, templateId, project, mainFabric])

  useEffect(() => {
    const view = presentation.current
    if (!view) return
    for (const node of view.allLayers) node.visible = layers[node.userData.previewLayer] !== false
    view.canvas.dataset.previewVisibleDetails = String(view.allLayers.filter(node => node.visible).length)
    view.render()
  }, [layers, project])

  return <div className="exo-garment-mini">
    <div className="exo-garment-mini-topline"><span className="exo-garment-mini-live" />3D PATTERN ARRANGEMENT<span>SIMULTANEOUS VIEWS</span></div>
    <div className="exo-garment-mini-gallery">
      <div ref={mount} className="exo-garment-mini-canvas" role="img" data-template-id={templateId} data-piece-count={project.pieces?.length || 0} data-seam-count={project.seams?.length || 0} aria-label={name + ': front, side and back views of gently curved sewing pattern panels in one fixed image'}>
        {renderFailure && <div className="exo-garment-mini-fallback" role="status">
          <strong>3D preview unavailable</strong>
          <span>{name} · {previewPage.total} drafted source pieces</span>
          <span>{pieces.map(piece=>piece.name || piece.id).join(' · ')}</span>
          <small>The original pattern remains available. Select its Library tile to open it in the workspace.</small>
        </div>}
      </div>
      <div className="exo-garment-mini-view-labels" aria-hidden="true"><span>01 · FRONT</span><span>02 · SIDE</span><span>03 · BACK</span></div>
    </div>
    <div className="exo-garment-mini-caption">
      {previewPage.pageCount>1 ? `${previewPage.start+1}–${previewPage.end} OF ${previewPage.total}` : previewPage.total} SOURCE PANELS
      <span /> {project.seams?.length || 0} SEAM LINKS <span /> {mainFabric.name || 'UNSPECIFIED FABRIC'} · ILLUSTRATIVE LIGHT
    </div>
    {previewPage.pageCount>1 ? <div className="exo-garment-mini-pagination" role="group" aria-label="Preview source pattern pages">
      <button type="button" disabled={previewPage.page===0} onClick={()=>setPiecePage(p=>Math.max(0,p-1))} aria-label="Previous source panels">←</button>
      <span>GROUP {previewPage.page+1} / {previewPage.pageCount} · UNSEWN PATTERNS</span>
      <button type="button" disabled={previewPage.page===previewPage.pageCount-1} onClick={()=>setPiecePage(p=>Math.min(previewPage.pageCount-1,p+1))} aria-label="Next source panels">→</button>
    </div> : <div className="exo-garment-mini-note">CURVED SOURCE PATTERNS · FRONT / SIDE / BACK</div>}
    {!renderFailure && <div className="exo-garment-mini-switches">{[['style', 'Style lines'], ['sewing', 'Sewing lines'], ['edges', 'Pattern edges']].map(([key, label]) => <button key={key} type="button" aria-pressed={layers[key]} onClick={() => setLayers(current => ({ ...current, [key]: !current[key] }))}>{label}</button>)}</div>}
  </div>
}
