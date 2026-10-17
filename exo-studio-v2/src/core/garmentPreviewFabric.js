import * as THREE from 'three'

/**
 * Lightweight, template-derived *illustrative* textile in the Library hover.
 * This deliberately does not load a 4K scan or pretend to be a measured PBR
 * specimen: the detail changes by the project's authored material family.
 * Both maps are disposed along with the one active hover renderer.
 */
export function garmentPreviewTextileFamily(fabric = {}) {
  const source = [
    fabric.name, fabric.surfaceFamily, fabric.texture?.scanAssetId,
    fabric.texture?.name, typeof fabric.texture === 'string' ? fabric.texture : '',
  ].join(' ').toLowerCase()
  if (/denim|indigo|jean|twill/.test(source)) return 'denim-twill'
  if (/terry|fleece|sherpa|brushed/.test(source)) return 'french-terry'
  if (/jersey|rib|knit/.test(source)) return 'jersey-knit'
  return 'plain-woven'
}

/** Presentation exposure, never a change to the authored fabric swatch. */
export function garmentPreviewStudioColor(source = '#d9dde1') {
  const authored = new THREE.Color()
  try {authored.set(source)} catch {authored.set('#d9dde1')}
  const hsl = {}
  authored.getHSL(hsl)
  // A black pattern rendered against the V2 charcoal stage cannot reveal
  // seam boundaries. Lift only very dark swatches under studio illumination;
  // the exact authored color remains available in the material record.
  const lifted = hsl.l < .16
  return {
    color: lifted ? authored.clone().lerp(new THREE.Color('#929ba3'), .49) : authored,
    adjusted: lifted,
    sourceColor: source,
  }
}

export function createGarmentPreviewTextile(resources, fabric = {}) {
  const family = garmentPreviewTextileFamily(fabric)
  const size = 320
  const pigment = document.createElement('canvas')
  const height = document.createElement('canvas')
  pigment.width = height.width = pigment.height = height.height = size
  const color = pigment.getContext('2d')
  const relief = height.getContext('2d')
  if (!color || !relief) throw new Error('Textile preview canvas unavailable')
  color.fillStyle = '#f1efed'
  color.fillRect(0, 0, size, size)
  relief.fillStyle = '#777777'
  relief.fillRect(0, 0, size, size)
  // Scans and specimen spectroscopy are deliberately not implied by these
  // deterministic browser-generated yarn silhouettes.
  const contrast = (val) => Math.max(0, Math.min(255, val))
  if (family === 'denim-twill') {
    // Denim shows a staggered 3:1 warp float and diagonal twill ridge.
    for (let y = -6; y < size + 6; y += 5) {
      for (let x = -6; x < size + 6; x += 5) {
        const phase = ((x / 5 + y / 5) % 4 + 4) % 4
        const v = Math.round(227 - phase * 3)
        color.strokeStyle = `rgb(${v},${v},${contrast(v - 2)})`
        color.lineWidth = phase === 0 ? 2.3 : 1
        color.beginPath(); color.moveTo(x - 1, y + 1); color.lineTo(x + 5, y + 6); color.stroke()
        relief.strokeStyle = phase === 0 ? '#aaaaaa' : '#868686'
        relief.lineWidth = phase === 0 ? 2.4 : 1.3
        relief.beginPath(); relief.moveTo(x - 1, y); relief.lineTo(x + 5, y + 6); relief.stroke()
      }
    }
  } else if (family === 'french-terry') {
    // Face courses plus sparse raised loops, not a continuous inflated foam.
    for (let y = -4; y < size + 4; y += 7) {
      for (let x = -4; x < size + 4; x += 9) {
        const stagger = Math.floor(y / 7) % 2 ? 4.5 : 0
        color.strokeStyle = '#e4e2e0'; color.lineWidth = 1.4
        color.beginPath();color.moveTo(x + stagger - 3,y);color.quadraticCurveTo(x + stagger,y + 6.4,x + stagger + 3,y);color.stroke()
        relief.strokeStyle = '#989898';relief.lineWidth = 2.1
        relief.beginPath();relief.moveTo(x + stagger - 3,y);relief.quadraticCurveTo(x + stagger,y + 6.6,x + stagger + 3,y);relief.stroke()
      }
    }
  } else if (family === 'jersey-knit') {
    for (let y = -5; y < size + 5; y += 6) {
      for (let x = -5; x < size + 5; x += 7) {
        const stagger = Math.floor(y / 6) % 2 ? 3.5 : 0
        color.strokeStyle = '#e0dfdc';color.lineWidth = 1.2
        color.beginPath();color.moveTo(x + stagger - 2,y);color.quadraticCurveTo(x + stagger,y + 6,x + stagger + 2,y);color.stroke()
        relief.strokeStyle = '#a2a2a2';relief.lineWidth = 1.8
        relief.beginPath();relief.moveTo(x + stagger - 2,y);relief.quadraticCurveTo(x + stagger,y + 6,x + stagger + 2,y);relief.stroke()
      }
    }
  } else {
    // Woven plain over/under warp/weft crossing.
    for (let x = 0; x < size; x += 5) {
      color.fillStyle = x % 10 ? '#e7e5e2' : '#e4e2de'
      color.fillRect(x, 0, 2, size)
      relief.fillStyle = x % 10 ? '#929292' : '#9b9b9b'
      relief.fillRect(x, 0, 2, size)
    }
    for (let y = 0; y < size; y += 5) {
      color.fillStyle = y % 10 ? '#e8e6e4' : '#edebe8'
      color.fillRect(0, y, size, 2)
      relief.fillStyle = y % 10 ? '#a1a1a1' : '#aaaaaa'
      relief.fillRect(0, y, size, 2)
    }
  }
  const map = new THREE.CanvasTexture(pigment)
  const bumpMap = new THREE.CanvasTexture(height)
  for (const texture of [map, bumpMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = 4
    // This UV scaling is the preview's schematic weave frequency, not a
    // documented cm-per-tile calibration of a physical fabric scan.
    resources.push(texture)
  }
  map.colorSpace = THREE.SRGBColorSpace
  return { map, bumpMap, family, estimated: true }
}
