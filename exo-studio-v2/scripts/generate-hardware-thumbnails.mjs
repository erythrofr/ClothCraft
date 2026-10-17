/**
 * Offline product photography pass. One Chrome WebGL context renders every SKU,
 * then writes static PNGs so opening Hardware & Trims never allocates 28 canvases.
 * Run while Vite is available: node scripts/generate-hardware-thumbnails.mjs
 */
import { chromium } from 'playwright-core'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const origin = process.env.EXO_VITE_ORIGIN || 'http://127.0.0.1:5188'
const out = path.resolve('public/hardware-thumbnails')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EXO_QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 })
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  const images = await page.evaluate(async () => {
    const { THREE } = await import('/src/components/HardwareThumbnailThree.js')
    const { listHardwarePresets } = await import('/src/data/hardwarePresets.js')
    const { createHardwareButton3D } = await import('/src/components/HardwareButton3D.js')
    const { createZipperToothGeometry, createZipperSliderHousingGeometry, createZipperPullTabGeometry } = await import('/src/components/ZipperHardware3D.js')
    const presets = listHardwarePresets()
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(1)
    renderer.setSize(352, 352)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.22
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearColor('#191c21', 1)
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20)
    cam.position.set(0, 0, 5)
    cam.lookAt(0, 0, 0)
    scene.add(new THREE.AmbientLight(0xdce5fa, 1.0))
    const key = new THREE.DirectionalLight(0xfff4df, 5)
    key.position.set(-2, 4, 5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xacc9ff, 5)
    rim.position.set(3, -2, 4)
    scene.add(rim)
    const fill = new THREE.DirectionalLight(0xffffff, 2)
    fill.position.set(-1, -3, -2)
    scene.add(fill)
    // Procedural studio softboxes in a cube environment, no external HDR assets.
    const envFace = (face) => {
      const c = document.createElement('canvas')
      c.width = 256; c.height = 256
      const ctx = c.getContext('2d')
      const base = ctx.createLinearGradient(0, 0, 256, 256)
      base.addColorStop(0,'#7d8591'); base.addColorStop(.5,'#303945'); base.addColorStop(1,'#788491')
      ctx.fillStyle = base; ctx.fillRect(0,0,256,256)
      ctx.filter='blur(18px)'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(face%2 ? 42 : 24,15,face%2 ? 48 : 115,215)
      ctx.fillStyle='#e2edff'
      ctx.fillRect(174,42,37,155)
      return c
    }
    const cubeEnv = new THREE.CubeTexture(Array.from({length:6},(_,i)=>envFace(i)))
    cubeEnv.needsUpdate=true
    cubeEnv.colorSpace=THREE.SRGBColorSpace
    scene.environment=cubeEnv
    const noise = document.createElement('canvas')
    noise.width=256;noise.height=256
    const nctx=noise.getContext('2d')
    const pixels=nctx.createImageData(256,256)
    let seed=27
    for(let i=0;i<pixels.data.length;i+=4){
      seed=(seed*1664525+1013904223)>>>0
      const v=104+(seed>>>24)*.21
      pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=255
    }
    nctx.putImageData(pixels,0,0)
    const micro=new THREE.CanvasTexture(noise)
    micro.wrapS=micro.wrapT=THREE.RepeatWrapping
    micro.repeat.set(2,2)
    const contactCanvas=document.createElement('canvas')
    contactCanvas.width=256; contactCanvas.height=256
    const contactCtx=contactCanvas.getContext('2d')
    const radial=contactCtx.createRadialGradient(128,128,4,128,128,128)
    radial.addColorStop(0,'rgba(0,0,0,0.75)')
    radial.addColorStop(.5,'rgba(0,0,0,0.32)')
    radial.addColorStop(1,'rgba(0,0,0,0)')
    contactCtx.fillStyle=radial;contactCtx.fillRect(0,0,256,256)
    const shadowTexture=new THREE.CanvasTexture(contactCanvas)
    const material = (color, metalness = 0.7, roughness = 0.25) => new THREE.MeshPhysicalMaterial({
      color, metalness, roughness, clearcoat: .34, clearcoatRoughness: .14,
      envMapIntensity: 1.4, bumpMap:micro, bumpScale:metalness>.5 ? .003 : .006,
    })
    const add = (group, geo, mat, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      return mesh
    }
    const box = (g, w, h, d, m, x = 0, y = 0, z = 0) => add(g, new THREE.BoxGeometry(w, h, d), m, x, y, z)
    const ring = (g, rx, ry, radius, m, z = 0, start = 0, end = Math.PI * 2) => {
      if(Math.abs(end-start-Math.PI*2)<.001) {
        const torus=add(g,new THREE.TorusGeometry(rx,radius,12,96),m,0,0,z)
        torus.scale.y=ry/rx
        return torus
      }
      const curve = new THREE.CatmullRomCurve3(Array.from({ length: 65 }, (_, i) => {
        const a = start + (end - start) * i / 64
        return new THREE.Vector3(rx * Math.cos(a), ry * Math.sin(a), z)
      }))
      return add(g, new THREE.TubeGeometry(curve, 128, radius, 9, false), m)
    }
    const cameraFit = (range, tilt = 0) => {
      cam.left = -range; cam.right = range; cam.top = range; cam.bottom = -range
      cam.position.set(.85 + tilt, .46, 4)
      cam.updateProjectionMatrix()
      cam.lookAt(0, 0, 0)
    }
    const outputs = []
    for (const preset of presets) {
      const g = new THREE.Group()
      const p = preset.pbr
      const main = material(p.baseColor, p.metalness, p.roughness)
      const dark = material('#17191e', .3, .44)
      const steel = material('#aeb9c5', .94, .19)
      const gold = material('#bfa374', .91, .22)
      if (preset.kind === 'button') {
        const button = createHardwareButton3D({ id: preset.id, threadColor: undefined }, preset)
        button.scale.setScalar(50)
        button.rotation.set(-.35, .48, -.13)
        button.traverse(child=>{if(child.isMesh&&child.material){child.material.envMapIntensity=1.6;child.material.bumpMap=micro;child.material.bumpScale=child.material.metalness>.5?.003:.008;child.material.needsUpdate=true}})
        g.add(button)
        if(preset.id==='gold-shank-button'||preset.id==='coat-shank-button') {
          const face=material(preset.pbr.baseColor,.94,.22)
          const ornament=new THREE.Group()
          ornament.rotation.copy(button.rotation)
          g.add(ornament)
          ring(ornament,.365,.365,.013,face,.13)
          ring(ornament,.304,.304,.008,steel,.135)
          const boss=add(ornament,new THREE.SphereGeometry(.13,40,20),face,0,0,.15)
          boss.scale.z=.12
        }
        if (preset.id.includes('horn')) {
          const amber = material('#956542', .04, .42)
          for(let i=0;i<8;i++) {
            const a = i * 2.4
            const s = add(g, new THREE.TorusGeometry(.31 + i * .012, .006, 5, 72, Math.PI * 1.1), amber, 0, 0, .1)
            s.rotation.z = a
          }
        }
        if (preset.id.includes('leather')) {
          for(let i=0;i<44;i++) {
            const a = i * Math.PI * 2 / 44
            const r = .55
            add(g, new THREE.SphereGeometry(.01, 6, 4), material('#6b5141', 0, .95), Math.cos(a) * r, Math.sin(a) * r, .16)
          }
        }
        cameraFit(preset.shape === 'oval-toggle' ? 1.12 : .72, .13)
      } else if (preset.kind === 'zipper') {
        const ivory = preset.id === 'invisible-zipper'
        const isMolded=preset.zipperType==='molded'
        const isMetal=preset.zipperType==='metal'
        const tape = material(ivory ? '#d3c7b7' : preset.id === 'metal-jeans-zipper' ? '#584837' : '#252b30', .02, .94)
        tape.bumpScale=.018
        const teeth = preset.twoWay ? steel : preset.zipperType === 'metal' ? gold : preset.zipperType === 'molded' ? dark : steel
        // Woven tape and chain are separately lit objects. A fine pair of stitch
        // rails runs the full tape length, like the close-up product catalog view.
        const fabricX=[-.228,.228]
        fabricX.forEach(x=>{
          const strip=box(g,.36,2.28,.042,tape,x)
          strip.receiveShadow=true
          for(const dx of [-.154,.154]) {
            const rail=material(ivory?'#bbb09f':isMetal?'#897765':'#46515a',0,.9)
            box(g,.007,2.23,.009,rail,x+dx,0,.030)
          }
          // Distinct longitudinal reinforcing woven braid beside the chain.
          box(g,.037,2.26,.022,material(ivory?'#bfb4a5':'#343d45',0,.93),x+(x>0?-.138:.138),0,.041)
        })
        const profileScale=37
        const gWidth=(preset.dimensionsMm.nominalChainWidth||5)/1000
        // The studio model spans ~2.2 normalized units; keep each tooth below
        // its .060 pitch so metal links stay individually readable at thumbnail
        // scale rather than merging into a continuous shiny vertical bar.
        const toothGeometry=createZipperToothGeometry(gWidth, .00192, .00115,preset.zipperType||'metal')
        const toothSpacing=.060
        for (let i=0;i<36;i++){
          const y=-1.045+i*toothSpacing
          for(const side of [-1,1]){
            const tooth=add(g,toothGeometry,teeth,side*.055,y,.079)
            tooth.scale.setScalar(profileScale)
            tooth.rotation.z=side<0?0:Math.PI
            tooth.castShadow=true
          }
        }
        const sliderMetal = ivory ? steel : preset.id === 'metal-jeans-zipper' ? gold : steel
        const makeSlider = (y, direction) => {
          const assembly=new THREE.Group()
          assembly.position.y=y
          assembly.rotation.z=direction<0?Math.PI:0
          g.add(assembly)
          const housing=add(assembly,createZipperSliderHousingGeometry(gWidth,.0011),sliderMetal,0,0,.18)
          housing.scale.setScalar(profileScale)
          const neck=add(assembly,new THREE.CylinderGeometry(.053,.065,.105,24),sliderMetal,0,-.14,.34)
          neck.rotation.x=Math.PI/2
          const pull=add(assembly,createZipperPullTabGeometry(gWidth,.0011),sliderMetal,.02,-.39,.41)
          pull.scale.setScalar(profileScale)
          pull.rotation.z=-.18
          ring(assembly,.083,.108,.023,sliderMetal,.38)
        }
        if (preset.twoWay) {
          makeSlider(.66, -1)
          makeSlider(-.66, 1)
        } else makeSlider(-.06, 1)
        // Independent paired top stops and a compact separating-pin / box.
        for(const x of [-.065,.065])box(g,.100,.065,.112,teeth,x,1.10,.08)
        box(g,.19,.085,.115,teeth,0,-1.11,.08)
        if(preset.separating){
          const pin=material(isMolded?'#2b3034':isMetal?'#bca26d':'#abb4bc',isMolded?.08:.86,.35)
          box(g,.036,.24,.070,pin,-.052,-1.02,.08)
          box(g,.115,.13,.12,pin,.054,-1.05,.09)
        }
        cameraFit(1.28)
      } else if (preset.kind === 'buttonhole') {
        const backing = material('#383b43', 0, .95)
        box(g, 2.1, .7, .065, backing, 0, 0, -.06)
        box(g, preset.openingShape === 'keyhole' ? 1.3 : 1.5, .09, .05, dark, 0, 0, .01)
        if(preset.openingShape === 'keyhole') add(g,new THREE.CylinderGeometry(.145,.145,.07,48),dark,-.68,0,.01).rotation.x = Math.PI / 2
        const thread = material('#c2bab0', 0, .93)
        for(let i=0;i<50;i++) {
          const x = -0.85 + i*.034
          box(g,.012,.10,.024,thread,x,.1,.035)
          box(g,.012,.10,.024,thread,x,-.1,.035)
        }
        cameraFit(1.34)
      } else if (preset.kind === 'snap') {
        const r = preset.id === 'sew-on-snap' ? .53 : .59
        add(g,new THREE.CylinderGeometry(r,r,.17,80),main,-.28,0,0).rotation.x = Math.PI/2
        add(g,new THREE.CylinderGeometry(r*.66,r*.66,.23,72),steel,.49,0,.05).rotation.x = Math.PI/2
        ring(g,r*.46,r*.46,.045,main,.13)
        ring(g,r*.25,r*.25,.06,dark,.23)
        cameraFit(1.53)
      } else if(preset.kind === 'rivet') {
        add(g,new THREE.CylinderGeometry(.58,.58,.22,72),main,-.2,0,0).rotation.x = Math.PI / 2
        ring(g,.48,.48,.036,steel,.13)
        add(g,new THREE.CylinderGeometry(.20,.22,.44,48),main,.68,-.04,.08).rotation.x = Math.PI / 2
        cameraFit(1.4)
      } else if(preset.kind === 'buckle') {
        if(preset.id === 'd-ring') {
          const pts=[]
          for(let i=0;i<=40;i++){const a=-Math.PI/2+Math.PI*i/40;pts.push(new THREE.Vector3(.65*Math.cos(a),.65*Math.sin(a),0))}
          pts.push(new THREE.Vector3(0,-.65,0))
          const arc=new THREE.CatmullRomCurve3(pts,false,'centripetal')
          add(g,new THREE.TubeGeometry(arc,90,.07,12,false),main)
          box(g,1.3,.12,.12,main,0,-.65)
        } else {
          const corners = [[-.68,-.52],[.68,-.52],[.68,.52],[-.68,.52],[-.68,-.52]]
          const frame = new THREE.CatmullRomCurve3(corners.map(([x,y])=>new THREE.Vector3(x,y,0)),false,'centripetal')
          add(g,new THREE.TubeGeometry(frame,96,.072,12,false),main)
          if(preset.id==='slide-adjuster') {
            box(g,1.36,.14,.15,main,0,0,.05)
          } else {
            const prong=box(g,.89,.09,.10,steel,-.18,0,.09)
            prong.rotation.z=.08
          }
        }
        cameraFit(1.08)
      }
      g.rotation.x = preset.kind==='zipper' ? -.22 : -.30
      g.rotation.y = preset.kind==='button' ? 0 : -.31
      // Contact occlusion is baked underneath the object as a soft studio shadow.
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3,2.3),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,opacity:.53}))
      shadow.position.z=-.31
      shadow.scale.set(preset.kind==='zipper'?.58:1.0,preset.kind==='zipper'?1.32:.7,1)
      shadow.rotation.z=-.12
      scene.add(shadow)
      scene.add(g)
      renderer.render(scene,cam)
      outputs.push({ id:preset.id, image:renderer.domElement.toDataURL('image/png').split(',')[1] })
      scene.remove(g)
      scene.remove(shadow)
      shadow.geometry.dispose();shadow.material.dispose()
      g.traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material) { if(Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material.dispose() } })
    }
    renderer.dispose()
    cubeEnv.dispose();micro.dispose();shadowTexture.dispose()
    return outputs
  })
  for(const { id,image } of images) await writeFile(path.join(out, id + '.png'), Buffer.from(image,'base64'))
  console.log('Rendered',images.length,'hardware thumbnails:',out)
} finally {
  await browser.close()
}
