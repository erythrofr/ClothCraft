import {presetForFabric} from "../core/clothcraftFabrics.js"
import React, {useEffect, useId, useMemo, useRef, useState} from 'react'
import ClothCraftCornerTools from './ClothCraftCornerTools.jsx'
import ClothCraftStudioSilhouette from './ClothCraftStudioSilhouette.jsx'
import {getBounds, frontAvatarRegistration, horizontalPatternSpans, verticalPatternSpans, previewPoint, rotatedLayoutAroundCenter} from '../core/clothcraft2dGeometry.js'

const COLORS = ['#527e91', '#d29465', '#7a9e79', '#a889b2', '#c3ab5d', '#76a5a4']
const SEAM_COLORS = ['#eb775e', '#55aecd', '#dbb44c', '#8dc575', '#a98cd9', '#dd91b9']
// Solid CAD control-point fills must contrast with light/white fabric.
// Vertex, curve and seam correspondence dots have distinct visual roles.
const POINT_COLORS = {vertex:'#206DAB',selectedVertex:'#E56A26',curve:'#7451BA',outline:'#243746'}
const INITIAL_VIEW = [-1.1, -.24, 2.2, 2]
const finite = value => Number.isFinite(value)
const formatCm = metres => `${(metres * 100).toFixed(1)} cm`

function transform(panel, range, uv) {
  const a = (panel.layout_rotation_degrees || 0) * Math.PI / 180
  return [range.layout[0] + uv[0] * Math.cos(a) - uv[1] * Math.sin(a),
    range.layout[1] + uv[0] * Math.sin(a) + uv[1] * Math.cos(a)]
}

function weighted(weights, values) {
  if (!Array.isArray(weights) || !values.length) return null
  const result = [0, 0]
  for (const [index, weight] of weights) {
    if (!values[index] || !finite(weight)) return null
    result[0] += values[index][0] * weight
    result[1] += values[index][1] * weight
  }
  return result
}

function Dimensions({points, selected, panel, boundaries, uv, clipId, preview}) {
  if (points.length < 3) return null
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const width = maxX - minX, height = maxY - minY
  if (!(width > .015 && height > .015)) return null
  const line = '#67767b', offset = .045, arrow = .009
  const y = maxY + offset, x = maxX + offset
  const font = {fontSize: '.019', fill: '#55656a', textAnchor: 'middle', paintOrder: 'stroke', stroke: '#eef0ef', strokeWidth: '.008'}
  return <g pointerEvents="none" opacity={selected ? .95 : .65}>
    <line x1={minX} x2={maxX} y1={y} y2={y} stroke={line} strokeWidth=".002"/>
    <path d={`M${minX + arrow},${y - arrow / 2}L${minX},${y}L${minX + arrow},${y + arrow / 2} M${maxX - arrow},${y - arrow / 2}L${maxX},${y}L${maxX - arrow},${y + arrow / 2}`} stroke={line} fill="none" strokeWidth=".002"/>
    <line x1={minX} x2={minX} y1={maxY + .012} y2={y + .012} stroke={line} strokeWidth=".001"/>
    <line x1={maxX} x2={maxX} y1={maxY + .012} y2={y + .012} stroke={line} strokeWidth=".001"/>
    <text x={(minX + maxX) / 2} y={y - .009} {...font}>{formatCm(width)}</text>
    <line x1={x} x2={x} y1={minY} y2={maxY} stroke={line} strokeWidth=".002"/>
    <path d={`M${x - arrow / 2},${minY + arrow}L${x},${minY}L${x + arrow / 2},${minY + arrow} M${x - arrow / 2},${maxY - arrow}L${x},${maxY}L${x + arrow / 2},${maxY - arrow}`} stroke={line} fill="none" strokeWidth=".002"/>
    <line x1={maxX + .012} x2={x + .012} y1={minY} y2={minY} stroke={line} strokeWidth=".001"/>
    <line x1={maxX + .012} x2={x + .012} y1={maxY} y2={maxY} stroke={line} strokeWidth=".001"/>
    <text x={x + .014} y={(minY + maxY) / 2} fontSize=".019" fill="#55656a" paintOrder="stroke" stroke="#eef0ef" strokeWidth=".008">{formatCm(height)}</text>
    {selected && /front|back|bodice|torso/i.test(`${panel?.id} ${panel?.name}`) &&
      height >= .25 && width >= .20 && <g clipPath={`url(#${clipId})`}>
      {[{f: .46, label: 'CHEST'}, {f: .72, label: 'BELLY'}].map(({f, label}) => {
        const level = minY + height*f
        const shapeSpans = horizontalPatternSpans(boundaries, uv, level)
        // T-shirt sleeves are part of the same flat silhouette. Measuring
        // across the entire outline there would count arm fabric as chest.
        // Bound the measurement by the true left/right torso side seams when
        // both cross this level; the clip path remains a safety fallback.
        const torsoSides = boundaries?.['side-left'] && boundaries?.['side-right']
          ? {'side-left':boundaries['side-left'],'side-right':boundaries['side-right']}
          : null
        const torsoSpans = torsoSides ? horizontalPatternSpans(torsoSides, uv, level) : []
        const spans = torsoSpans.length === 1 && shapeSpans.some(([a,b])=>
          torsoSpans[0][0]>=a-.001 && torsoSpans[0][1]<=b+.001)
          ? torsoSpans : shapeSpans
        const length = spans.reduce((sum, [a,b]) => sum + b-a, 0)
        const widest = [...spans].sort((a,b) => (b[1]-b[0])-(a[1]-a[0]))[0]
        if (!widest) return null
        return <g key={label} data-measure-guide={label.toLowerCase()}>
          {spans.map(([a,b],i) => <line key={i} x1={a+.001} x2={b-.001} y1={level} y2={level}
            stroke="#27798a" strokeWidth=".0045" strokeDasharray=".024 .012"/>)}
          {widest[1]-widest[0] > .23 && <text x={(widest[0]+widest[1])/2} y={level-.014} fontSize=".027"
            fontWeight="600" textAnchor="middle" fill="#245460"
            paintOrder="stroke" stroke="#f2f3ee" strokeWidth=".005">
            {label} · {formatCm(length)}
          </text>}
        </g>
      })}
      {/front/i.test(`${panel?.id} ${panel?.name}`) && (() => {
        // Work in the pattern's local axes so the center line rotates with
        // the cut piece, including during live rotation previews.
        const angle=((panel.layout_rotation_degrees || 0)*Math.PI/180) +
          (preview?.kind==='rotate' ? preview.angle : 0)
        const c=Math.cos(angle), s=Math.sin(angle)
        const local=uv.map(p=>p && [p[0]*c+p[1]*s,-p[0]*s+p[1]*c])
        const outline=Object.values(boundaries || {}).flat().map(i=>local[i]).filter(Boolean)
        const bounds=getBounds(outline)
        if (!bounds) return null
        const chest=horizontalPatternSpans(boundaries,local,bounds.minY+bounds.height*.46)
        const torso=boundaries?.['side-left'] && boundaries?.['side-right']
          ? horizontalPatternSpans({'side-left':boundaries['side-left'],'side-right':boundaries['side-right']},local,bounds.minY+bounds.height*.46)
          : []
        const across=torso.length===1 ? torso : chest
        const main=across.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0]
        const centerX=main ? (main[0]+main[1])/2 : bounds.cx
        const spans=verticalPatternSpans(boundaries,local,centerX)
        const longest=[...spans].sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0]
        if (!longest || longest[1]-longest[0]<.16) return null
        const inset=Math.min(.008,(longest[1]-longest[0])*.04)
        const world=y=>[centerX*c-y*s,centerX*s+y*c]
        const a=world(longest[0]+inset), b=world(longest[1]-inset)
        return <line data-measure-guide="center-front" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          stroke="#27798a" strokeWidth=".0045" strokeDasharray=".024 .012" />
      })()}
    </g>}
  </g>
}

function SelectionMarquee2D({points, panel, onStart, disabled}) {
  const b = getBounds(points)
  if (!b || b.width < .02 || b.height < .02) return null
  const handles = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]
  const x = sign => sign===-1?b.minX:sign===1?b.maxX:b.cx
  const y = sign => sign===-1?b.minY:sign===1?b.maxY:b.cy
  const rotationY=b.minY-.07
  return <g data-2d-marquee={panel.id} aria-label={`2D transform selection: ${panel.name}`}>
    <rect x={b.minX} y={b.minY} width={b.width} height={b.height}
      fill="none" stroke="#2d646f" strokeWidth=".0025" strokeDasharray=".009 .006" pointerEvents="none"/>
    <rect data-2d-marquee-move={panel.id} x={b.minX} y={b.minY}
      width={b.width} height={b.height} fill="none" stroke="transparent" strokeWidth=".022"
      style={{cursor:disabled?'default':'move'}} pointerEvents="stroke"
      onPointerDown={e => onStart(e,panel,undefined,'move')}/>
    <line x1={b.cx} y1={b.minY} x2={b.cx} y2={rotationY}
      stroke="#2d646f" strokeWidth=".002" pointerEvents="none"/>
    <circle data-2d-rotate={panel.id} cx={b.cx} cy={rotationY} r=".012"
      fill="#fff" stroke="#2d646f" strokeWidth=".003" style={{cursor:'grab'}}
      onPointerDown={e => onStart(e,panel,undefined,'rotate')}/>
    {handles.map(([hx,hy]) => <rect key={`${hx},${hy}`} data-2d-scale-guide={`${hx},${hy}`}
      x={x(hx)-.008} y={y(hy)-.008} width=".016" height=".016"
      fill="#fff" stroke="#2d646f" strokeWidth=".0027" pointerEvents="none"/>)}
    <circle cx={b.cx} cy={b.cy} r=".007" stroke="#2d646f" strokeWidth=".002"
      fill="#fff" pointerEvents="none"/>
    <path d={`M${b.cx-.012} ${b.cy}h.024 M${b.cx} ${b.cy-.012}v.024`}
      stroke="#2d646f" strokeWidth=".0017" pointerEvents="none"/>
  </g>
}

/**
 * Linked metric board. Props are compatible with the original ClothCraftWorkspace Board:
 * s, active, pick, hover, edit, mode, busy, onPolygon.
 * Optional overlays: showMeasurements, showSilhouette, showSeamDots (default true).
 * Dimensions measure each panel's current rotated bounding box in material space.
 * Chest and belly guide heights are proportional landmarks; horizontal
 * lengths use the actual cut outline / torso side edges (not circumference).
 */
export default function ClothCraftBoardV2({
  s, active, selection, pick = () => {}, hover = () => {}, edit = () => {},
  mode = 'edit', busy = false, onPolygon = () => {},
  onChangeMode = () => {}, onContextMenuRequest = () => {},
  showMeasurements = true, showSilhouette = true, showSeamDots = true, showAvatar = true,
}) {
  const svg = useRef(null), drag = useRef(null), [view, setView] = useState(INITIAL_VIEW), [draft, setDraft] = useState([])
  const [preview, setPreview] = useState(null)
  const [tape, setTape] = useState([])
  // Both Edit Points and Edit Curves share the upstream 'edit' mode, but
  // neither should receive the 2D pattern-transform marquee.
  const [tool2d, setTool2d] = useState('select')
  useEffect(() => {
    const receiveTool = event => {
      const tool = event?.detail?.tool
      const modes = {select:'edit',point:'edit',curve:'edit',sew:'sew',internal:'line',line:'line',measure:'edit'}
      if (!Object.hasOwn(modes,tool)) return
      setTool2d(tool)
      setDraft([])
      setTape([])
      onChangeMode(modes[tool])
    }
    window.addEventListener('exo-clothcraft-select-2d-tool',receiveTool)
    return () => window.removeEventListener('exo-clothcraft-select-2d-tool',receiveTool)
  },[onChangeMode])
  const transform2d = mode === 'edit' && tool2d === 'select'
  const [viewPreset, setViewPreset] = useState('FRONT')
  const uid = useId().replace(/:/g, '')
  const panels = useMemo(() => {
    if (!s?.panels || !s?.template?.panels || !s?.uv) return []
    return s.panels.map((range, i) => {
      const panel = s.template.panels.find(p => p.id === range.id)
      if (!panel) return null
      const localIndices = Object.values(range.boundaries || {}).flat()
      const unique = [...new Set(localIndices)]
      const points = unique.map(n => s.uv[n] && transform(panel, range, s.uv[n])).filter(Boolean)
      return {panel, range, color: COLORS[i % COLORS.length], points}
    }).filter(Boolean)
  }, [s])
  const boardUV = useMemo(() => {
    if (!s?.uv) return []
    const map = []
    for (const item of panels) {
      const [first, last] = item.range.vertices || []
      for (let i = first; i < last; i++) if (s.uv[i])
        map[i] = previewPoint(transform(item.panel, item.range, s.uv[i]),
          preview?.panelId === item.panel.id ? preview : null)
    }
    return map
  }, [s, panels, preview])
  const bounds = useMemo(() => {
    const points = panels.flatMap(p => p.points)
    if (!points.length) return {cx:0, cy:0, minX:-.3, maxX:.3, minY:0, maxY:1}
    const xs = points.map(p => p[0]), ys = points.map(p => p[1])
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys)
    return {cx:(minX+maxX)/2, cy:(minY+maxY)/2, minX,maxX,minY,maxY}
  },[panels])
  // FRONT matches our original Garment Studio front-body drafting convention:
  // the *front garment* is centered over the avatar on the dark X=0 axis.
  // A whole-board midpoint incorrectly places the body between front and back.
  // GRID keeps the upstream ClothCraft side-by-side layout centered as a set.
  // Both transforms affect presentation only. UVs, seam links, physical metres,
  // pointer inversions and upstream authored panel origins stay unchanged.
  const wholeFront=panels.find(({panel})=>String(panel.id).toLowerCase()==='front')
  const frontPieces=wholeFront?[wholeFront]:panels.filter(({panel})=>/front|bodice/i.test(`${panel.id} ${panel.name}`))
  const frontParts=frontPieces.length?frontPieces:[panels[0]].filter(Boolean)
  const frontBounds=getBounds(frontParts.flatMap(item=>item.points)) || bounds
  const originalAlignment = useRef(null)
  const documentKey = s?.template?.id ?? s?.template?.name ?? null
  if (panels.length && (!originalAlignment.current || originalAlignment.current.key !== documentKey)) {
    const registration=frontAvatarRegistration(frontParts.map(item=>({...item,uv:s?.uv})),s?.avatar)
    const frontOffset=[-(registration?.centerX ?? frontBounds.cx), .76-frontBounds.cy]
    originalAlignment.current = {
      key: documentKey,
      front: frontOffset,
      grid: [-bounds.cx, .76-bounds.cy],
      // Register the actual body mesh shoulder span against the authored front
      // shoulder edges. This guide-only translation is fixed per document so
      // moving a panel never causes the fabric to snap back to the figure.
      avatarX:registration?.matchedShoulders ? registration.avatarX : 0,
      avatarY:registration?.matchedShoulders ? registration.avatarY+frontOffset[1] : .95,
      shoulderY:(registration?.shoulderY ?? frontBounds.minY)+frontOffset[1],
    }
  }
  // Freeze this offset during edits: otherwise moving the front panel would
  // recompute its origin every frame and visually snap the shirt back to X=0.
  const offset = viewPreset === 'FRONT'
    ? (originalAlignment.current?.front || [0,0])
    : (originalAlignment.current?.grid || [0,0])
  const displayed = {minX:bounds.minX+offset[0],maxX:bounds.maxX+offset[0],minY:bounds.minY+offset[1],maxY:bounds.maxY+offset[1]}
  const spanX = displayed.maxX-displayed.minX, spanY=displayed.maxY-displayed.minY
  // The figure remains 1.75m tall in physical board coordinates, registered
  // by actual front shoulders. Never resize its shape to a pattern bounding box.
  const avatarAnchorX = originalAlignment.current?.avatarX ?? 0
  const avatarAnchorY = originalAlignment.current?.avatarY ?? .95
  const avatarVisible = showAvatar && showSilhouette && viewPreset === 'FRONT' && s?.avatar?.positions?.length > 0
  const focus = (onlySelected=false) => {
    let b=displayed
    if(onlySelected && (selection?.panel || active?.panel)){
      const entry=panels.find(p=>p.panel.id===(selection?.panel || active?.panel))
      if(entry?.points.length){
        const xs=entry.points.map(p=>p[0]+offset[0]),ys=entry.points.map(p=>p[1]+offset[1])
        b={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}
      }
    } else if (avatarVisible) {
      // Frame all includes the full body, including its feet and head, rather
      // than zooming to only the bodice and cutting away the guide figure.
      b={minX:Math.min(b.minX,avatarAnchorX-.56),maxX:Math.max(b.maxX,avatarAnchorX+.56),
        minY:Math.min(b.minY,avatarAnchorY-.875),maxY:Math.max(b.maxY,avatarAnchorY+.875)}
    }
    const pad=.22
    const w=Math.max(.9,b.maxX-b.minX+pad*2),h=Math.max(.9,b.maxY-b.minY+pad*2)
    const width=Math.max(w,h*1.1)
    setView([(b.minX+b.maxX-width)/2,(b.minY+b.maxY-width/1.1)/2,width,width/1.1])
  }
  const initialized = useRef(null)
  useEffect(()=>{
    const key=s?.template?.id ?? s?.template?.name ?? null
    if(key !== initialized.current && panels.length){
      initialized.current=key
      // FRONT keeps x=0 centered on the visible figure; extend both sides
      // enough to retain the complete neighboring back panel, rather than
      // clipping its sleeve at the right edge of a split viewport.
      const largestExtent = Math.max(Math.abs(displayed.minX),Math.abs(displayed.maxX))
      const w=Math.max(2.15,2*(largestExtent+.17),(spanY+.65)*1.1,
        avatarAnchorY>0 ? (Math.max(displayed.maxY,avatarAnchorY+.875)-Math.min(displayed.minY,avatarAnchorY-.875)+.22)*1.1 : 0)
      setView([-w/2,avatarAnchorY-w/2.2,w,w/1.1])
    }
  },[s?.template?.id,s?.template?.name,panels.length,spanX,spanY])
  const point = e => {
    const el = svg.current
    const matrix = el?.getScreenCTM()
    if (!matrix) return null
    const p = el.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    const q = p.matrixTransform(matrix.inverse())
    return [q.x-offset[0], q.y-offset[1]]
  }
  const start = (e, panel, anchor, kind='move', handle=null) => {
    if (busy || ['sew', 'pen', 'line'].includes(mode) || e.button !== 0) return
    if (anchor === undefined && !transform2d) {
      // Point and curve tools select the fabric without translating it.
      e.stopPropagation()
      pick({panel: panel.id})
      return
    }
    const startPoint = point(e)
    if (!startPoint) return
    e.stopPropagation()
    svg.current.setPointerCapture(e.pointerId)
    const entry=panels.find(item => item.panel.id===panel.id)
    const b=getBounds(entry?.points)
    drag.current = {panel, anchor, start: startPoint, kind, handle, bounds:b}
    setPreview(null)
    pick({panel: panel.id, ...(anchor !== undefined ? {anchor} : {})})
  }
  const updatePreview = (e, d) => {
    const q=point(e)
    if (!q || !d?.bounds) return null
    const delta=q.map((n,i)=>n-d.start[i])
    if (d.kind==='rotate') {
      const b=d.bounds, angle=Math.atan2(q[1]-b.cy,q[0]-b.cx)-
        Math.atan2(d.start[1]-b.cy,d.start[0]-b.cx)
      const normalized=Math.atan2(Math.sin(angle),Math.cos(angle))
      const snapped=e.shiftKey?Math.round(normalized/(Math.PI/12))*(Math.PI/12):normalized
      return {panelId:d.panel.id,kind:'rotate',angle:snapped,center:[b.cx,b.cy]}
    }
    // CLO-like straight-axis / diagonal constraint while translating.
    if (e.shiftKey) {
      const [dx,dy]=delta, ax=Math.abs(dx),ay=Math.abs(dy)
      if(ax>ay*1.75)delta[1]=0
      else if(ay>ax*1.75)delta[0]=0
      else {const length=Math.min(ax,ay);delta[0]=Math.sign(dx)*length;delta[1]=Math.sign(dy)*length}
    }
    return {panelId:d.panel.id,kind:'move',delta}
  }
  const move = e => {
    const d=drag.current
    if (!d || d.pan || d.anchor!==undefined) return
    const next=updatePreview(e,d)
    d.lastPreview=next
    setPreview(next)
  }
  const up = e => {
    const d = drag.current
    drag.current = null
    setPreview(null)
    if (!d) return
    const q = point(e)
    if (!q) return
    const delta = q.map((n, i) => n - d.start[i])
    if (Math.hypot(...delta) < .002) {
      if (d.pan && d.background) pick(null)
      return
    }
    if (d.pan) {
      setView(v => [v[0] - delta[0], v[1] - delta[1], v[2], v[3]])
      return
    }
    const range = s.panels.find(p => p.id === d.panel.id)
    if (!range) return
    if(d.anchor===undefined && d.kind==='rotate') {
      const p=updatePreview(e,d)
      if(!p || Math.abs(p.angle)<.004)return
      const degrees=p.angle*180/Math.PI
      edit({kind:'BoardTransform',panel:d.panel.id,
        origin:rotatedLayoutAroundCenter(range.layout,degrees,p.center),
        rotation_degrees:(d.panel.layout_rotation_degrees||0)+degrees})
      return
    }
    if (d.anchor !== undefined) {
      const a = -(d.panel.layout_rotation_degrees || 0) * Math.PI / 180
      const local = [delta[0] * Math.cos(a) - delta[1] * Math.sin(a), delta[0] * Math.sin(a) + delta[1] * Math.cos(a)]
      if (typeof d.anchor === 'string') {
        const [, edge, index] = d.anchor.split(':')
        const polygon = structuredClone(d.panel.polygon)
        if (!polygon.curves?.[edge]?.[Number(index)]) return
        polygon.curves[edge][Number(index)] = polygon.curves[edge][Number(index)].map((n, i) => n + local[i])
        edit({kind: 'Shape', panel: d.panel.id, polygon})
      } else {
        const origin = d.panel.polygon?.points?.[d.anchor]
        if (origin) edit({kind: 'Anchor', panel: d.panel.id, anchor: d.anchor, position: origin.map((n, i) => n + local[i])})
      }
    } else {
      const p=updatePreview(e,d)
      edit({kind: 'BoardTransform', panel: d.panel.id,
        origin: range.layout.map((n, i) => n + (p?.delta?.[i] ?? delta[i])),
        rotation_degrees: d.panel.layout_rotation_degrees || 0})
    }
  }
  const zoom = e => {
    e.preventDefault()
    const localCursor = point(e)
    if (!localCursor) return
    const cursor = [localCursor[0]+offset[0],localCursor[1]+offset[1]]
    const factor = e.deltaY > 0 ? 1.1 : .9
    setView(v => {
      const width = Math.max(.08, Math.min(15, v[2] * factor))
      const scale = width / v[2]
      return [cursor[0] - (cursor[0] - v[0]) * scale, cursor[1] - (cursor[1] - v[1]) * scale, width, v[3] * scale]
    })
  }
  const isDrawing = mode === 'pen' || mode === 'line'
  const measuring = mode === 'edit' && tool2d === 'measure'
  const markCanvas = e => {
    if (busy || e.button !== 0 || (!isDrawing && !measuring)) return
    const p = point(e)
    if (!p) return
    // Capture before fabric/edge handlers consume the pointer event. Internal
    // lines must be drawable directly on the selected fabric surface.
    e.stopPropagation()
    e.preventDefault()
    if (isDrawing) setDraft(old => [...old,p])
    else setTape(old => old.length === 1 ? [old[0],p] : [p])
  }
  return <div className="cc-board" style={{position: 'relative', background: '#c6c7c9'}}>
    <ClothCraftCornerTools dimension="2d" mode={mode} activeTool={tool2d} onChangeMode={onChangeMode}
      onChangeTool={setTool2d} disabled={busy}/>
    <div role="group" aria-label="2D board view controls" style={{position:'absolute',top:8,right:10,zIndex:3,display:'flex',gap:3,alignItems:'center',border:'1px solid #c2ccce',borderRadius:7,padding:3,background:'rgba(241,244,244,.94)',boxShadow:'0 2px 6px #00000012'}}>
      <span style={{fontSize:10,fontWeight:700,color:'#61757b',padding:'0 7px'}}>2D</span>
      {['FRONT','GRID'].map(preset=><button key={preset} type="button" aria-pressed={viewPreset===preset} onClick={()=>setViewPreset(preset)} style={{fontSize:10,letterSpacing:'.06em',fontWeight:700,border:'none',borderRadius:4,padding:'5px 9px',cursor:'pointer',color:viewPreset===preset?'#fff':'#566970',background:viewPreset===preset?'#50656d':'transparent'}}>{preset}</button>)}
    </div>
    <div className="cc-canvas-tools" style={{top:44,left:'auto',right:10}}>
      <button type="button" onClick={() => focus()}>Frame all</button>
      <button type="button" onClick={() => focus(true)}>Focus selected</button>
      <button type="button" onClick={() => setView(v=>[-v[2]/2,avatarAnchorY-v[3]/2,v[2],v[3]])}>Center axis</button>
      {isDrawing && <>
        <button type="button" disabled={busy || draft.length < (mode === 'line' ? 2 : 3)} onClick={() => {onPolygon(draft); setDraft([])}}>{mode === 'line' ? 'Create internal line' : 'Close pattern'} ({draft.length})</button>
        <button type="button" onClick={() => setDraft([])}>Cancel</button>
      </>}
      {measuring && <button type="button" disabled={!tape.length} onClick={()=>setTape([])}>Clear tape</button>}
    </div>
    <svg ref={svg} viewBox={view.join(' ')} preserveAspectRatio="xMidYMid meet" style={{background: '#c6c7c9'}}
      aria-label="Metric 2D pattern board with linked sewing and measurements"
      onPointerDownCapture={markCanvas}
      onClickCapture={e => {if (!busy && (isDrawing || measuring)) e.stopPropagation()}}
      onPointerMove={move} onPointerUp={up} onPointerCancel={() => {drag.current = null;setPreview(null)}}
      onContextMenu={e => {
        e.preventDefault()
        const element = e.target.closest?.('[data-edge], [data-panel]')
        const edgeKey=element?.getAttribute('data-edge')
        const panelId=element?.getAttribute('data-panel')
        const [edgePanel, ...edgeParts] = edgeKey ? edgeKey.split(':') : []
        const hit=edgeKey ? {panel:edgePanel,edge:edgeParts.join(':')} : panelId ? {panel:panelId} : null
        onContextMenuRequest({x:e.clientX,y:e.clientY,dimension:'2d',hit})
      }}
      onPointerDown={e => {
        if (isDrawing || measuring) return
        if (e.button !== 0) return
        const p = point(e)
        if (!p) return
        drag.current = {pan: true, background: e.target===svg.current, start: p}
        svg.current.setPointerCapture(e.pointerId)
      }}
      onWheel={zoom}>
      <defs>
        <pattern id={`${uid}-minor`} width=".05" height=".05" patternUnits="userSpaceOnUse">
          <path d="M .05 0 L 0 0 0 .05" fill="none" stroke="rgba(77,78,82,.16)" strokeWidth=".0028"/>
        </pattern>
        <pattern id={`${uid}-major`} width=".25" height=".25" patternUnits="userSpaceOnUse">
          <path d="M .25 0 L 0 0 0 .25" fill="none" stroke="rgba(75,76,79,.27)" strokeWidth=".0038"/>
        </pattern>
      </defs>
      <rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill="#c6c7c9" pointerEvents="none"/>
      <rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill={`url(#${uid}-minor)`} opacity={viewPreset==='GRID'?1:.6} pointerEvents="none"/>
      <rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill={`url(#${uid}-major)`} opacity={viewPreset==='GRID'?1:.65} pointerEvents="none"/>
      <line x1={view[0]-view[2]} x2={view[0]+view[2]*2} y1=".76" y2=".76" stroke="#9aaeb3" strokeWidth=".002" pointerEvents="none"/>
      <line x1="0" x2="0" y1={view[1]-view[3]} y2={view[1]+view[3]*2} stroke="#424b4f" strokeWidth=".006" pointerEvents="none"/>
      <g pointerEvents="none" fontSize=".022" fill="#6c8188">
        <text x=".02" y=".745">X</text><text x=".015" y=".805">Y</text>
      </g>
      {avatarVisible && s?.avatar?.triangles?.length > 0 && <g pointerEvents="none" opacity=".66" transform={`translate(${avatarAnchorX} ${avatarAnchorY})`} aria-label="Centered front avatar silhouette"
        data-registered-shoulder-y={originalAlignment.current?.shoulderY} data-avatar-anchor-x={avatarAnchorX} data-avatar-anchor-y={avatarAnchorY}>
        <ClothCraftStudioSilhouette avatar={s.avatar}/>
      </g>}
      <g transform={`translate(${offset[0]} ${offset[1]})`}>
      {panels.map(({panel, range, color, points}, panelIndex) => {
        const selected = selection !== undefined ? selection?.panel === panel.id : active?.panel === panel.id
        const currentPreview=preview?.panelId===panel.id ? preview : null
        const livePoints=points.map(p=>previewPoint(p,currentPreview))
        const shapePath=(s.triangles || []).slice(...range.triangles).map(tri =>
          'M' + tri.map(index => boardUV[index]?.join(',')).filter(Boolean).join('L') + 'Z').join('')
        const clipId=`${uid}-pattern-${panelIndex}`
        const label=previewPoint(range.layout,currentPreview)
        return <g key={panel.id} onPointerEnter={() => hover({panel: panel.id})} onPointerLeave={() => hover(null)}>
          <defs><clipPath id={clipId}><path d={shapePath}/></clipPath></defs>
          <path data-panel={panel.id} d={shapePath}
            fill={presetForFabric(s.template.fabrics.find(f=>f.id===panel.fabric))?.appearance.color || "#f4f4f3"} fillOpacity={1}
            style={{cursor:busy?'default':transform2d?'move':'default'}}
            onPointerDown={e => start(e, panel)}
            onClick={e => {e.stopPropagation(); pick({panel: panel.id})}}/>
          {selected && transform2d && <SelectionMarquee2D
            points={livePoints} panel={panel} onStart={start} disabled={busy}/>}
          {Object.entries(range.boundaries || {}).map(([edge, indices]) => <polyline key={edge} data-edge={`${panel.id}:${edge}`}
            points={indices.map(i => boardUV[i]?.join(',')).filter(Boolean).join(' ')}
            fill="none" stroke={selected && active.edge === edge ? '#ef6339' : selected ? '#d79e2d' : '#374e57'}
            strokeWidth={selected && active.edge === edge ? '.009' : selected ? '.0047' : '.003'}
            style={{cursor: 'crosshair'}}
            onPointerDown={e => e.stopPropagation()}
            onPointerEnter={e => {e.stopPropagation(); hover({panel: panel.id, edge})}}
            onClick={e => {e.stopPropagation(); pick({panel: panel.id, edge})}}/>)}
          <text x={label[0]} y={label[1] - .035} fontSize=".027" fill="#34454a" pointerEvents="none">{panel.name}</text>
          {showMeasurements && <Dimensions points={livePoints} selected={selected}
            panel={panel} boundaries={range.boundaries} uv={boardUV} clipId={clipId} preview={currentPreview}/>}
          {selected && mode === 'edit' && tool2d === 'point' && panel.polygon?.points?.map((uv, n) => {
            const p = previewPoint(transform(panel, range, uv),currentPreview)
            return <circle key={n} data-control-point="vertex" data-panel-id={panel.id} cx={p[0]} cy={p[1]} r=".0105"
              fill={active?.anchor===n ? POINT_COLORS.selectedVertex : POINT_COLORS.vertex}
              stroke={POINT_COLORS.outline} strokeWidth=".0025" onPointerDown={e => start(e, panel, n)}/>
          })}
          {selected && mode === 'edit' && tool2d === 'curve' && Object.entries(panel.polygon?.curves || {}).flatMap(([edge, controls]) => controls.map((uv, index) => {
            const p = previewPoint(transform(panel, range, uv),currentPreview)
            const edgeIndex = panel.polygon.edges.indexOf(edge)
            const original = panel.polygon.points[(edgeIndex + index) % panel.polygon.points.length]
            if (!original) return null
            const anchor = previewPoint(transform(panel, range, original),currentPreview)
            return <g key={`${edge}-${index}`}>
              <line x1={anchor[0]} y1={anchor[1]} x2={p[0]} y2={p[1]} stroke="#527e91" strokeWidth=".002"/>
              <circle data-control-point="curve" data-panel-id={panel.id} cx={p[0]} cy={p[1]} r=".009"
                fill={POINT_COLORS.curve} stroke={POINT_COLORS.outline} strokeWidth=".002"
                onPointerDown={e => start(e, panel, `c:${edge}:${index}`)}/>
            </g>
          }))}
        </g>
      })}
      {(s?.seams || []).flatMap((seam, i) => {
        const spec = s.template?.seams?.find(item => item.id === seam.id)
        if (!spec) return []
        // A selected *piece* should not flood the board with hundreds of
        // cross-panel correspondence lines. Spotlight full seam structure
        // only when an actual colored boundary is hovered/selected.
        const emphasized = !!active?.edge && [spec.a, spec.b].some(b => b?.panel === active.panel && b.edge === active.edge)
        const color = SEAM_COLORS[i % SEAM_COLORS.length]
        return (seam.guides || []).filter((_, j) => j % (emphasized ? 3 : 16) === 0).flatMap((pair, j) => {
          const a = weighted(pair[0], boardUV), b = weighted(pair[1], boardUV)
          if (!a || !b) return []
          return <g key={`${seam.id}-${j}`} pointerEvents="none">
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={emphasized ? '#ef6339' : color}
              strokeWidth={emphasized ? '.003' : '.00125'} strokeDasharray=".01 .012" opacity={emphasized ? 1 : .42}/>
            {showSeamDots && <>
              <circle data-control-point="seam" cx={a[0]} cy={a[1]} r={emphasized ? '.008' : '.006'} fill={color} stroke={POINT_COLORS.outline} strokeWidth=".0015"/>
              <circle data-control-point="seam" cx={b[0]} cy={b[1]} r={emphasized ? '.008' : '.006'} fill={color} stroke={POINT_COLORS.outline} strokeWidth=".0015"/>
            </>}
          </g>
        })
      })}
      {draft.length > 0 && <polyline points={draft.map(p => p.join(',')).join(' ')} fill="none" stroke="#ef6339" strokeWidth=".005" pointerEvents="none"/>}
      {measuring && tape.map((p,i)=><circle key={i} data-tape-point={i} cx={p[0]} cy={p[1]} r=".010" fill="#fff" stroke="#166478" strokeWidth=".003" pointerEvents="none"/>)}
      {measuring && tape.length===2 && <g data-tape-measurement="true" pointerEvents="none">
        <line x1={tape[0][0]} y1={tape[0][1]} x2={tape[1][0]} y2={tape[1][1]} stroke="#166478" strokeWidth=".004" strokeDasharray=".012 .007"/>
        <text x={(tape[0][0]+tape[1][0])/2} y={(tape[0][1]+tape[1][1])/2-.025} textAnchor="middle" fontSize=".029" fontWeight="600" fill="#164654" stroke="#eaf0f0" strokeWidth=".008" paintOrder="stroke">{formatCm(Math.hypot(tape[1][0]-tape[0][0],tape[1][1]-tape[0][1]))}</text>
      </g>}
      </g>
    </svg>
    <span className="cc-hint">50 mm grid · Select / Transform shows 2D box · drag to move · click gray to deselect · chest/belly guides stay inside fabric</span>
  </div>
}
