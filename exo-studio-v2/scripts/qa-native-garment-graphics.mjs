import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {build} from 'esbuild'

// Focused browser regression for the SVG/PDF-free artwork import and Rust UV projection.
// Bundles into /tmp for a standalone browser test; never reads or mutates saved garments.
const bundle = '/tmp/exo-native-garment-qa-bundle.js'
await build({
  stdin: {
    contents: "import * as THREE from 'three'; import * as lib from './src/core/nativeGarmentGraphics.js'; import React from 'react'; import {createRoot} from 'react-dom/client'; import Editor from './src/components/ClothCraftGraphicEditor.jsx'; globalThis.__nativeGraphicsQA = {THREE,lib,React,createRoot,Editor}",
    resolveDir:process.cwd(),
    sourcefile:'graphics-qa-entry.js',
    loader:'js',
  },
  bundle:true,
  format:'iife',
  outfile:bundle,
  loader:{'.css':'empty'},
})
const browser = await chromium.launch({
  headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage({viewport:{width:1000,height:700}})
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('about:blank')
  await page.addScriptTag({path:bundle})
  const result = await page.evaluate(async () => {
    const {lib,THREE} = globalThis.__nativeGraphicsQA
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" onload="alert(1)">
      <style>.st0{fill:#e54020}.st1{fill:#1867dc}</style>
      <script>alert('unsafe')</script>
      <image href="https://invalid.example/evil.png"/>
      <rect class="st0" width="50" height="50"/>
      <rect class="st1" x="50" width="50" height="50"/>
      <rect x="10" y="10" width="10" height="10" style="fill:rgb(240,210,20);background:url(https://invalid.example/track)"/>
    </svg>`
    const clean = await lib.sanitizeGarmentSVG(svg).text()
    if (clean.includes('<script') || clean.includes('<image') || clean.includes('onload=') || clean.includes('https://') || clean.includes('<style')) throw Error('SVG sanitizer retained unsafe contents')
    if (!clean.includes('fill="#e54020"') || !clean.includes('fill="#1867dc"')) throw Error('Illustrator class colors were lost')
    const artwork = await lib.importGarmentArtwork(new File([svg],'logo.svg',{type:'image/svg+xml'}))
    if (artwork.width !== 2048 || artwork.height !== 1024 || !artwork.dataUrl.startsWith('data:image/png;base64,')) throw Error('SVG raster fidelity lost')
    const pngImg = new Image()
    pngImg.src = artwork.dataUrl
    await pngImg.decode()
    const pngCanvas = document.createElement('canvas')
    pngCanvas.width = pngImg.width
    pngCanvas.height = pngImg.height
    const p = pngCanvas.getContext('2d')
    p.drawImage(pngImg,0,0)
    const pixels = [[300,300],[1700,300]].map(([x,y])=>[...p.getImageData(x,y,1,1).data])
    if (!(pixels[0][0] > pixels[0][2] && pixels[1][2] > pixels[1][0])) throw Error('SVG class paint was not rasterized')
    const pngFile = new File([await new Promise(resolve=>pngCanvas.toBlob(resolve,'image/png'))],'image.png',{type:'image/png'})
    const png = await lib.importGarmentArtwork(pngFile)
    const jpegFile = new File([await new Promise(resolve=>pngCanvas.toBlob(resolve,'image/jpeg',.85))],'image.jpg',{type:'image/jpeg'})
    const jpeg = await lib.importGarmentArtwork(jpegFile)
    if (!png.dataUrl.startsWith('data:image/png;base64,') || !jpeg.dataUrl.startsWith('data:image/png;base64,')) throw Error('Raster imports were not normalized')
    const record = lib.createGarmentGraphic(png, 'front')
    const saved = lib.serializeGarmentGraphics([record])
    const [restored] = lib.deserializeGarmentGraphics(saved,{panels:[{id:'front'}]})
    if (restored.panel !== 'front' || restored.scale !== record.scale) throw Error('Layout JSON round trip failed')
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,1,0,.3,-1,1,.2,1,1,.5],3))
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([2,4,4,4,2,6,4,6],2))
    geometry.setIndex([0,1,2,1,3,2])
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial())
    const overlay = lib.createGarmentGraphicOverlay(mesh,[{...record,center:[.5,.5],scale:1,visible:true}],{resolution:512})
    if (!overlay || !overlay.material.isMeshStandardMaterial) throw Error('UV cloth overlay not created with lit material')
    const source = geometry.getAttribute('position').array
    const projected = overlay.geometry.getAttribute('position').array
    if (!source.every((value,index)=>projected[index] === value)) throw Error('Print no longer follows Rust panel triangles')
    // An attached print must follow real folded geometry through the parent
    // transform; the decal must not be an independent flat billboard.
    if (overlay.parent) throw Error('Projected graphic should not be parented before attach')
    mesh.add(overlay)
    mesh.position.set(.23,.12,-.4)
    mesh.rotation.y = .37
    mesh.updateMatrixWorld(true)
    overlay.updateMatrixWorld(true)
    for (const index of [0,2,3]) {
      const point = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'),index).applyMatrix4(mesh.matrixWorld)
      const printPoint = new THREE.Vector3().fromBufferAttribute(overlay.geometry.getAttribute('position'),index).applyMatrix4(overlay.matrixWorld)
      if (point.distanceTo(printPoint) > 1e-6) throw Error('Graphic lost registration under garment rotation')
    }
    if (overlay.geometry === geometry) throw Error('UV normalization mutated the original cloth geometry')
    if (!geometry.getAttribute('uv').array.every((value,index)=>value===[2,4,4,4,2,6,4,6][index])) throw Error('Print changed source fabric coordinates')
    const uv = overlay.geometry.getAttribute('uv').array
    if (Math.min(...uv)!==0 || Math.max(...uv)!==1) throw Error('Native meter UV did not normalize')
    await new Promise(resolve=>setTimeout(resolve,400))
    if (!overlay.material.map.needsUpdate && !overlay.material.map.image) throw Error('Print texture was not created')
    const ctx = overlay.material.map.image.getContext('2d')
    const sample = [...ctx.getImageData(256,256,1,1).data]
    if (sample[3] === 0) throw Error('Print artwork did not paint into projected texture')
    // Verify actual WebGL compositing, including alpha outside the artwork,
    // rather than merely inspecting a texture detached from the 3D scene.
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#fff')
    scene.add(new THREE.AmbientLight('#fff',3))
    const camera = new THREE.OrthographicCamera(-1.35,1.35,1.35,-1.35,.1,10)
    camera.position.set(0,.5,4)
    camera.lookAt(0,.5,0)
    const renderer = new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true})
    renderer.setSize(300,300)
    mesh.position.set(0,0,0)
    mesh.rotation.set(0,0,0)
    mesh.material.color.set('#eeeeee')
    scene.add(mesh)
    renderer.render(scene,camera)
    const pixels3d = new Uint8Array(4)
    const gl = renderer.getContext()
    gl.readPixels(100,150,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels3d)
    if (pixels3d[0] < 100 || pixels3d[0] <= pixels3d[2]) throw Error(`Rendered front print is not visible in WebGL: ${pixels3d}`)
    gl.readPixels(150,280,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels3d)
    if (Math.min(...pixels3d.slice(0,3)) < 220) throw Error('Transparent decal incorrectly colored empty canvas')
    renderer.dispose()
    const reverse = lib.createGarmentGraphicOverlay(mesh,[{...record,side:'back'}],{face:'back',resolution:256})
    if (!reverse || reverse.material.side !== THREE.BackSide) throw Error('Back print did not use reverse garment surface')
    lib.disposeGarmentGraphicOverlays([reverse])
    lib.disposeGarmentGraphicOverlays([overlay])
    if (overlay.parent) throw Error('Overlay disposal leaked a child mesh')
    return {svgColorPixels:pixels, dimensions:[artwork.width,artwork.height], overlayPixels:sample, geometryVertices:projected.length/3}
  })
  assert.equal(errors.length,0, `Browser exceptions: ${errors.join('; ')}`)
  await page.evaluate(() => {
    const {React,createRoot,Editor} = globalThis.__nativeGraphicsQA
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    globalThis.__qaGraphics = []
    const render = () => root.render(React.createElement(Editor,{
      graphics:globalThis.__qaGraphics,
      panels:[{id:'front',name:'Front T-shirt'},{id:'back',name:'Back T-shirt'}],
      panelId:'front',
      onChange(next){globalThis.__qaGraphics=next;render()},
    }))
    render()
  })
  await page.getByRole('button',{name:'+ Add'}).waitFor()
  const testSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path fill="#a33123" d="M0 0h40v40H0z"/></svg>'
  await page.locator('input[accept*="image/svg+xml"]').setInputFiles({name:'artwork.svg',mimeType:'image/svg+xml',buffer:Buffer.from(testSVG)})
  await page.locator('.cc-graphic-item').waitFor({timeout:30000})
  assert.equal(await page.locator('.cc-graphic-item').count(),1,'Upload should create one editable print')
  await page.locator('.cc-graphic-controls select').first().selectOption('back')
  await page.locator('.cc-graphic-controls input[type=range]').last().fill('35')
  assert.deepEqual(await page.evaluate(()=>globalThis.__qaGraphics.map(g=>[g.panel,g.rotation])),[['back',35]])
  await page.getByRole('button',{name:'Remove'}).click()
  assert.equal(await page.locator('.cc-graphic-item').count(),0,'Remove should clear artwork')
  assert.equal(errors.length,0, `Browser exceptions during editor interaction: ${errors.join('; ')}`)
  console.log(JSON.stringify({passed:true,...result}))
  await page.close()
} finally {
  await browser.close()
}
