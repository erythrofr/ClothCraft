import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const COLORS = ['#d3b8ae', '#ccb1a8', '#c5a99d', '#d8c1b6', '#bda8a0']

export default function ZozoReferenceDressViewer({ reference, frame, showBody = true }) {
  const mount = useRef(null)
  const position = useRef(null)
  const meshes = useRef(null)
  const initialFrame = useRef(frame)

  useEffect(() => {
    if (!mount.current || !reference) return undefined
    const element = mount.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#e3e5e8')
    const camera = new THREE.PerspectiveCamera(38, 1, .01, 40)
    camera.position.set(1.8, 1.25, 2.45)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.17
    element.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, .55, 0)
    const light = new THREE.DirectionalLight('#ffffff', 3)
    light.position.set(2, 3, 2)
    scene.add(light, new THREE.HemisphereLight('#ffffff', '#707781', 2.2))

    const geometries = []
    const materials = []
    for (let i = 0; i < reference.meshes.clothPanels.length; i++) {
      const panel = reference.meshes.clothPanels[i]
      const geometry = new THREE.BufferGeometry()
      // Shared native vertex IDs preserve the exact upstream sewing topology;
      // each panel only owns a different index buffer.
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(reference.manifest.vertexCount * 3), 3))
      geometry.setIndex(panel.indices)
      const material = new THREE.MeshStandardMaterial({ color: COLORS[i % COLORS.length], roughness: .86, metalness: 0,
        side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = `Original ZOZO ${panel.id}`
      scene.add(mesh)
      geometries.push(geometry); materials.push(material)
    }
    const bodyGeometry = new THREE.BufferGeometry()
    bodyGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(reference.manifest.vertexCount * 3), 3))
    bodyGeometry.setIndex(reference.meshes.bodyIndices)
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#71818a', metalness: .1, roughness: .78,
      side: THREE.DoubleSide, transparent: true, opacity: .68, depthWrite: false })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.name = 'Original pinned dancing body'
    scene.add(body)
    geometries.push(bodyGeometry);materials.push(bodyMaterial)
    const updateFrame = (value) => {
      const raw = reference.frameVertices(value)
      for (const geometry of geometries) {
        const attribute = geometry.attributes.position
        attribute.array.set(raw)
        attribute.needsUpdate = true
        geometry.computeVertexNormals()
        geometry.computeBoundingSphere()
      }
    }
    updateFrame(initialFrame.current)
    body.visible = showBody
    position.current = updateFrame
    meshes.current = { body }

    const resize = () => {
      const width = Math.max(1, element.clientWidth)
      const height = Math.max(1, element.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    let request = 0
    const animate = () => { controls.update(); renderer.render(scene, camera); request = window.requestAnimationFrame(animate) }
    animate()
    return () => {
      window.cancelAnimationFrame(request)
      observer.disconnect()
      position.current = null; meshes.current = null
      controls.dispose()
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      renderer.dispose()
      element.removeChild(renderer.domElement)
    }
  }, [reference])

  useEffect(() => { position.current?.(frame) }, [reference, frame])
  useEffect(() => { if (meshes.current) meshes.current.body.visible = showBody }, [showBody])

  return <div ref={mount} className="zozo-reference-canvas" data-testid="zozo-reference-viewport" data-reference-frame={frame} />
}
