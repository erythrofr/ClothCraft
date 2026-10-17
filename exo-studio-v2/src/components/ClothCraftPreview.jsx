import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

// Isolated read-only inspection. A baked rest OBJ is not a solved garment or a fit.
export default function ClothCraftPreview({ obj, avatarObj = null, diagnostics = null, onClose, garmentName }) {
  const canvasMount = useRef(null)

  useEffect(() => {
    const mount = canvasMount.current
    if (!mount || !obj) return undefined
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dee3eb')
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 60)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    mount.appendChild(renderer.domElement)

    const meshGroup = new OBJLoader().parse(obj)
    const clothMaterial = new THREE.MeshStandardMaterial({
      color: '#4389ae', roughness: 0.76, metalness: 0.05, side: THREE.DoubleSide,
    })
    meshGroup.traverse(child => {
      if (child.isMesh) child.material = clothMaterial
    })
    scene.add(meshGroup)
    let bodyGroup = null
    let bodyMaterial = null
    if (avatarObj) {
      bodyGroup = new OBJLoader().parse(avatarObj)
      bodyMaterial = new THREE.MeshStandardMaterial({
        color: '#a7adb9', roughness: 0.85, metalness: 0,
        opacity: 0.47, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      })
      bodyGroup.traverse(child => {
        if (child.isMesh) child.material = bodyMaterial
      })
      scene.add(bodyGroup)
    }
    const bounds = new THREE.Box3().setFromObject(meshGroup)
    if (bodyGroup) bounds.union(new THREE.Box3().setFromObject(bodyGroup))
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const extent = Math.max(size.x, size.y, size.z, 0.5)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.copy(center)
    camera.position.set(center.x + extent * 1.05, center.y + extent * 0.65, center.z + extent * 1.9)
    controls.update()

    const hemi = new THREE.HemisphereLight('#ffffff', '#899caf', 3)
    const key = new THREE.DirectionalLight('#ffffff', 3)
    key.position.set(center.x + 2, center.y + 4, center.z + 5)
    scene.add(hemi, key)
    const grid = new THREE.GridHelper(Math.max(3, extent * 2), 20, '#8a94a6', '#b9c1ce')
    grid.position.set(center.x, bounds.min.y - 0.07, center.z)
    scene.add(grid)

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()
    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      clothMaterial.dispose()
      meshGroup.traverse(child => { if (child.isMesh) child.geometry.dispose() })
      if (bodyMaterial) bodyMaterial.dispose()
      bodyGroup?.traverse(child => { if (child.isMesh) child.geometry.dispose() })
      grid.geometry.dispose()
      grid.material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [obj])

  return (
    <section role="dialog" aria-label="ClothCraft geometry preview" aria-modal="true"
      style={{ position: 'fixed', zIndex: 999, inset: '7% 9%', background: '#e4e9f0',
        border: '1px solid #768397', borderRadius: 15, boxShadow: '0 18px 70px #0008',
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        justifyContent: 'space-between', padding: '12px 18px', background: '#1c2736', color: '#fff' }}>
        <div>
          <strong>{diagnostics ? 'ClothCraft Rust VBD + OGC contact trial' : 'ClothCraft Rust baked geometry'}</strong>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{garmentName} · {diagnostics ? `${diagnostics.avatarModel} · ${diagnostics.completedSteps} physical step(s)` : 'Static OBJ from template'} · not certified fit</div>
        </div>
        <button type="button" aria-label="Close ClothCraft preview" onClick={onClose}
          style={{ border: '1px solid #91a2b7', borderRadius: 7, padding: '8px 13px',
            background: '#334258', color: '#fff', cursor: 'pointer' }}>Close preview</button>
      </header>
      {diagnostics && <div role="status" style={{ padding: '10px 16px', background: '#fff0ed', color: '#722f23', fontSize: 13 }}>
        <strong>FIT NOT ACCEPTED</strong> · Seam gap {Number(diagnostics.maxSeamGapMm).toFixed(1)} mm ·
        {' '}p95 extension {Number(diagnostics.p95ExtensionPercent).toFixed(1)}% ·
        {' '}active contacts {diagnostics.activeContacts}. {diagnostics.reason}
      </div>}
      <div ref={canvasMount} style={{ flex: 1, minHeight: 0 }} />
      <footer style={{ padding: '9px 16px', background: '#f3f5f8', color: '#37445c', fontSize: 12 }}>
        Drag to orbit, scroll to zoom. Blue: {diagnostics ? 'Rust-simulated cloth' : 'baked static cloth'}.
        {avatarObj ? ' Translucent gray: selected body-only collision mesh.' : ''}
        {' '}This view is for research comparison; seam convergence and collision safety are not certified.
      </footer>
    </section>
  )
}
