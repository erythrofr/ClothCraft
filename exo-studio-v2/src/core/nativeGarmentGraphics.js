import * as THREE from 'three'

const MAX_BYTES = 8 * 1024 * 1024
const MAX_PIXELS = 16_000_000
const MAX_DATA_URL_LENGTH = 24 * 1024 * 1024
export const GARMENT_GRAPHICS_DOCUMENT_VERSION = 1
const SVG_ELEMENTS = new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','linearGradient','radialGradient','stop','clipPath','mask','use','title','desc','text','tspan'])
const SVG_ATTRIBUTES = new Set(['xmlns','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','points','d','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','stroke-opacity','opacity','transform','gradientUnits','gradientTransform','offset','stop-color','stop-opacity','id','clip-path','mask','href','preserveAspectRatio','font-size','font-family','font-weight','text-anchor','letter-spacing','paint-order','display','visibility'])
const SVG_PRESENTATION = new Set(['fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','stroke-opacity','opacity','stop-color','stop-opacity','clip-path','mask','font-size','font-family','font-weight','text-anchor','letter-spacing','paint-order','display','visibility'])
const SAFE_LOCAL_SVG_REF = /^url\(\s*['"]?#[\w.-]+['"]?\s*\)$/
// Imported Illustrator/Inkscape files commonly put paint information into .st0/.cls-1 CSS.
// Resolve simple class rules to SVG presentation attributes, then remove all CSS.
function safePresentationDeclarations(style) {
  const attrs = {}
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon < 1) continue
    const key = declaration.slice(0,colon).trim().toLowerCase()
    const value = declaration.slice(colon+1).trim()
    if (!SVG_PRESENTATION.has(key) || !value || value.length > 256) continue
    if (/[{}<>\\]|!important|@import|expression\s*\(|javascript:|data:|https?:|file:/i.test(value)) continue
    if (/url\s*\(/i.test(value) && !SAFE_LOCAL_SVG_REF.test(value)) continue
    attrs[key] = value
  }
  return attrs
}

/** Strict SVG subset. External references, CSS, embedded images, scripts and animation are excluded. */
export function sanitizeGarmentSVG(input) {
  if (typeof input !== 'string' || input.length > MAX_BYTES || /<!doctype|<!entity|<\?xml-stylesheet/i.test(input)) throw new Error('Unsupported SVG document')
  const documentNode = new DOMParser().parseFromString(input, 'image/svg+xml')
  if (documentNode.querySelector('parsererror') || documentNode.documentElement.localName !== 'svg') throw new Error('Invalid SVG')
  const stylesByClass = new Map()
  for (const styleNode of documentNode.querySelectorAll('style')) {
    const css = styleNode.textContent || ''
    if (css.length > 131072 || /@import|@font-face|@media|url\s*\((?!\s*['"]?#)/i.test(css)) continue
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const attrs = safePresentationDeclarations(match[2])
      for (const selector of match[1].split(',')) {
        const classMatch = /^\.([\w-]+)$/.exec(selector.trim())
        if (classMatch) stylesByClass.set(classMatch[1], {...stylesByClass.get(classMatch[1]), ...attrs})
      }
    }
  }
  const walk = node => {
    for (const child of [...node.children]) {
      if (!SVG_ELEMENTS.has(child.localName) || child.namespaceURI !== 'http://www.w3.org/2000/svg') { child.remove(); continue }
      walk(child)
    }
    const classNames = (node.getAttribute('class') || '').split(/\s+/)
    const inline = safePresentationDeclarations(node.getAttribute('style') || '')
    for (const className of classNames) {
      for (const [name,value] of Object.entries(stylesByClass.get(className) || {})) {
        if (!node.hasAttribute(name)) node.setAttribute(name,value)
      }
    }
    for (const [name,value] of Object.entries(inline)) node.setAttribute(name,value)
    for (const attr of [...node.attributes]) {
      const value = attr.value.trim()
      const isRef = ['href', 'clip-path', 'mask', 'fill', 'stroke'].includes(attr.localName)
      const localRef = SAFE_LOCAL_SVG_REF.test(value)
      if (!SVG_ATTRIBUTES.has(attr.name) || attr.namespaceURI || /(?:url\(|@import|expression\s*\(|javascript:|data:|https?:|file:|\\)/i.test(value) && !localRef || (attr.localName === 'href' && !/^#[\w.-]+$/.test(value)) || (isRef && /url\(/i.test(value) && !localRef)) node.removeAttributeNode(attr)
    }
  }
  walk(documentNode.documentElement)
  const root = documentNode.documentElement
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const dimension = value => {
    const parsed = /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/.exec(value || '')
    return parsed ? Number(parsed[1]) : NaN
  }
  const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const viewWidth = vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? vb[2] : (dimension(root.getAttribute('width')) || 300)
  const viewHeight = vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? vb[3] : (dimension(root.getAttribute('height')) || 150)
  if (!(Number.isFinite(viewWidth) && Number.isFinite(viewHeight) && viewWidth > 0 && viewHeight > 0)) throw new Error('Invalid SVG dimensions')
  if (vb.length !== 4 || !(vb[2] > 0 && vb[3] > 0)) root.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`)
  // Rasterize vectors large enough to remain sharp on the garment; browsers default
  // un-sized SVGs to a blurry 300x150 bitmap if explicit dimensions are omitted.
  const ratio = viewWidth / viewHeight
  root.setAttribute('width', String(Math.max(1,Math.round(2048 * Math.min(1,ratio)))))
  root.setAttribute('height', String(Math.max(1,Math.round(2048 * Math.min(1,1 / ratio)))))
  const sanitized = new XMLSerializer().serializeToString(documentNode.documentElement)
  return new Blob([sanitized], {type: 'image/svg+xml'})
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Artwork could not be decoded'))
    img.src = url
  })
}

// Dragging a graphic updates placement repeatedly. Reuse already decoded artwork
// rather than decoding the same large PNG during every 3D frame rebuild.
const decodedArtworks = new Map()
function loadGraphicImage(dataUrl) {
  if (!decodedArtworks.has(dataUrl)) {
    const pending = loadImage(dataUrl).catch(error => {
      decodedArtworks.delete(dataUrl)
      throw error
    })
    decodedArtworks.set(dataUrl,pending)
    if (decodedArtworks.size > 12) decodedArtworks.delete(decodedArtworks.keys().next().value)
  }
  return decodedArtworks.get(dataUrl)
}

/** Import raster or sanitized vector artwork as a self-contained PNG for safe persistence. */
export async function importGarmentArtwork(file) {
  if (!file || file.size > MAX_BYTES || file.size === 0) throw new Error('Artwork must be between 1 byte and 8 MB')
  const suffix = /\.(svg|png|jpe?g)$/i.exec(file.name || '')?.[1]?.toLowerCase()
  const type = (file.type || ({svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'}[suffix]) || '').toLowerCase()
  if (!['image/svg+xml','image/png','image/jpeg'].includes(type)) throw new Error('Choose an SVG, PNG or JPEG')
  const blob = type === 'image/svg+xml' ? sanitizeGarmentSVG(await file.text()) : file
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    const width = image.naturalWidth, height = image.naturalHeight
    if (!width || !height || width * height > MAX_PIXELS || width > 8192 || height > 8192) throw new Error('Artwork dimensions exceed supported limits')
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    context.drawImage(image, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    return {id: globalThis.crypto?.randomUUID?.() || `art-${Date.now()}`, name: file.name, dataUrl, width, height, format: 'image/png'}
  } finally { URL.revokeObjectURL(url) }
}

export function createGarmentGraphic(artwork, panel) {
  if (!artwork?.dataUrl?.startsWith('data:image/png;base64,')) throw new Error('Artwork must be imported first')
  if (typeof panel !== 'string' || !panel) throw new Error('Select a garment panel')
  return {...artwork, panel, center: [0.5, 0.5], scale: 0.42, rotation: 0, side: 'front', visible: true}
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min))

/** Normalized artwork bounds: center is measured from panel UV's left/top, scale is width / panel width. */
export function normalizeGarmentGraphic(input, {panels} = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid graphic record')
  if (typeof input.dataUrl !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.dataUrl) || input.dataUrl.length > MAX_DATA_URL_LENGTH) throw new Error('Graphic must contain a valid embedded PNG')
  if (typeof input.panel !== 'string' || !input.panel.trim() || input.panel.length > 256 || (panels?.length && !panels.some(p => p.id === input.panel))) throw new Error('Graphic references an unknown panel')
  const center = Array.isArray(input.center) && input.center.length === 2 ? input.center : [.5, .5]
  const side = ['front', 'back', 'both'].includes(input.side) ? input.side : 'front'
  return {
    id: String(input.id || globalThis.crypto?.randomUUID?.() || `art-${Date.now()}`).slice(0, 128),
    name: String(input.name || 'Artwork').slice(0, 256),
    panel: input.panel,
    dataUrl: input.dataUrl,
    format: 'image/png',
    width: Math.round(clamp(input.width, 1, 8192)),
    height: Math.round(clamp(input.height, 1, 8192)),
    center: [clamp(center[0], 0, 1), clamp(center[1], 0, 1)],
    scale: clamp(input.scale ?? .42, .03, 1.5),
    rotation: clamp(input.rotation ?? 0, -180, 180),
    side,
    visible: input.visible !== false,
  }
}

/** JSON-safe local project format. Binary artwork stays embedded for offline reopen. */
export function serializeGarmentGraphics(graphics = []) {
  if (!Array.isArray(graphics) || graphics.length > 100) throw new Error('Invalid graphics collection')
  return {version: GARMENT_GRAPHICS_DOCUMENT_VERSION, graphics: graphics.map(graphic => normalizeGarmentGraphic(graphic))}
}

export function deserializeGarmentGraphics(document, options = {}) {
  if (!document || document.version !== GARMENT_GRAPHICS_DOCUMENT_VERSION || !Array.isArray(document.graphics) || document.graphics.length > 100) throw new Error('Unsupported garment graphics document')
  const graphics = document.graphics.map(graphic => normalizeGarmentGraphic(graphic, options))
  if (new Set(graphics.map(graphic => graphic.id)).size !== graphics.length) throw new Error('Duplicate graphic IDs')
  return graphics
}

/** Used by editor drags and the renderer; UV v axis is bottom-up, UI y is top-down. */
export function graphicPlacementInUV(graphic) {
  const record = normalizeGarmentGraphic(graphic)
  return {u: record.center[0], v: 1 - record.center[1], widthUV: record.scale, rotationRadians: -record.rotation * Math.PI / 180}
}

/**
 * A printable UV projection anchored to the Rust triangle topology. Must be rebuilt with each
 * new solver snapshot: mesh.geometry is the current frame's deformed panel surface.
 * Graphics coordinates are relative to this panel's UV bounding box.
 * Returned child must be disposed with its parent. `side` is a surface-facing render setting.
 */
export function createGarmentGraphicOverlay(panelMesh, graphics = [], {resolution = 1024, face = 'front'} = {}) {
  const originalUV = panelMesh?.geometry?.getAttribute('uv')
  const records = graphics.flatMap(graphic => {try {const g = normalizeGarmentGraphic(graphic); return g.visible && (g.side === face || g.side === 'both') ? [g] : []} catch {return []}})
  if (!originalUV || !records.length) return null
  const bounds = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity}
  for (let i = 0; i < originalUV.count; i++) {
    bounds.minX = Math.min(bounds.minX, originalUV.getX(i)); bounds.maxX = Math.max(bounds.maxX, originalUV.getX(i))
    bounds.minY = Math.min(bounds.minY, originalUV.getY(i)); bounds.maxY = Math.max(bounds.maxY, originalUV.getY(i))
  }
  const spanX = bounds.maxX - bounds.minX, spanY = bounds.maxY - bounds.minY
  if (!(spanX > 1e-9 && spanY > 1e-9)) return null
  const geometry = panelMesh.geometry.clone()
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - bounds.minX) / spanX, (uv.getY(i) - bounds.minY) / spanY)
  uv.needsUpdate = true
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = clamp(resolution, 128, 2048)
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false
  // MeshStandardMaterial receives the native deformed cloth normals and lighting,
  // so print shading follows folds instead of appearing flat over the garment.
  // Rust panels do not guarantee their winding faces outward: some garment
  // fronts arrive back-facing relative to the avatar camera. Draw the printed
  // FRONT on either winding so it remains visible on the authored panel; the
  // garment panel and UVs still define the geometry it follows.
  const material = new THREE.MeshStandardMaterial({map: texture, transparent: true, alphaTest: .001, depthWrite: false, roughness: .88, metalness: 0, side: face === 'back' ? THREE.BackSide : THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2})
  const overlay = new THREE.Mesh(geometry, material)
  overlay.name = 'Native garment UV graphic'
  overlay.renderOrder = (panelMesh.renderOrder || 0) + 1
  overlay.raycast = () => {}
  // SceneV2's disposeTree disposes material.userData.ownedTexture on every
  // snapshot change. Mark this layer before its async raster paint can finish.
  material.userData.ownedTexture = {dispose() { overlay.userData.disposed = true; texture.dispose() }}
  Promise.all(records.map(async record => {
    try {return {record, image: await loadGraphicImage(record.dataUrl)}} catch {return null}
  })).then(items => {
    if (overlay.userData.disposed) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const item of items) {
      if (!item) continue
      const {record, image} = item
      const placement = graphicPlacementInUV(record)
      const width = placement.widthUV * canvas.width
      const height = width * image.naturalHeight / image.naturalWidth * spanX / spanY
      ctx.save()
      ctx.translate(placement.u * canvas.width, placement.v * canvas.height)
      ctx.rotate(placement.rotationRadians)
      ctx.drawImage(image, -width / 2, -height / 2, width, height)
      ctx.restore()
    }
    texture.needsUpdate = true
  })
  return overlay
}

/** Dispose returned layers when the solver replaces its panel mesh. */
export function disposeGarmentGraphicOverlays(overlays = []) {
  for (const overlay of overlays) {
    overlay.userData.disposed = true
    overlay.parent?.remove(overlay)
    overlay.geometry?.dispose()
    overlay.material?.userData?.ownedTexture?.dispose()
    overlay.material?.dispose()
  }
}

/** Attaches front and reverse printed layers to one deforming panel mesh. */
export function attachGarmentGraphics(panelMesh, graphics = []) {
  const overlays = ['front', 'back'].map(face => createGarmentGraphicOverlay(panelMesh, graphics, {face})).filter(Boolean)
  for (const overlay of overlays) panelMesh.add(overlay)
  return overlays
}
