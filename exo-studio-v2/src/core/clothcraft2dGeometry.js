/** Geometry helpers for the EXO V2 2D pattern board. All coordinates are metres. */
export function getBounds(points) {
  if (!points?.length) return null
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null
  return {minX, maxX, minY, maxY, cx:(minX + maxX)/2, cy:(minY + maxY)/2,
    width:maxX - minX, height:maxY - minY}
}

/**
 * Registration landmarks for a *visual* front-view avatar guide. Both pattern
 * and body coordinates are metres; no pattern placement or simulation state is
 * changed. Prefer real shoulder/neck boundary points to a sleeves-wide box,
 * because uneven sleeves and off-centre necklines otherwise shift the figure.
 * The projected body is normalized to a 1.75m SVG reference height.
 */
export function frontAvatarRegistration(front, avatar, referenceHeight = 1.75) {
  const fronts=Array.isArray(front)?front.filter(Boolean):front?[front]:[]
  const points=fronts.flatMap(item=>item.points || [])
  const bounds=getBounds(points)
  if (!bounds) return null
  const transformPoint = (item,index) => {
    const range=item.range, panel=item.panel, src=item.uv
    const uv=src?.[index]
    if (!Array.isArray(uv) || !uv.every(Number.isFinite)) return null
    const rad=(panel?.layout_rotation_degrees || 0)*Math.PI/180
    return [range.layout[0]+uv[0]*Math.cos(rad)-uv[1]*Math.sin(rad),
      range.layout[1]+uv[0]*Math.sin(rad)+uv[1]*Math.cos(rad)]
  }
  const collect=names=>fronts.flatMap(item=>[...new Set(Object.entries(item.range?.boundaries || {})
    .filter(([key])=>names.some(name=>name.test(key)))
    .flatMap(([,indices])=>indices))].map(index=>transformPoint(item,index)).filter(Boolean))
  const neckline=collect([/^neck/i])
  const shoulders=collect([/^shoulder/i])
  const neckBounds=getBounds(neckline)
  const shoulderBounds=getBounds(shoulders)
  const centerX=neckBounds?.cx ?? shoulderBounds?.cx ?? bounds.cx
  const shoulderY=shoulderBounds?.cy ?? bounds.minY
  const vertices=(avatar?.positions || []).filter(p=>Array.isArray(p)&&p.length>=2&&
    Number.isFinite(p[0])&&Number.isFinite(p[1]))
  const ext=getBounds(vertices.map(p=>[p[0],p[1]]))
  // A mesh has no semantic shoulder bones. Match the actual upper-body width
  // profile to the front's shoulder-line span, within the upper-torso band.
  // This moves the reference figure by only the measured difference and keeps
  // the original proportions from the active 3D mesh (no fabricated anatomy).
  const height=ext?.height || referenceHeight
  let shoulderFraction=.79, shoulderCenter=ext?.cx || 0
  if (ext && height>.2 && shoulderBounds && shoulderBounds.width>.04) {
    let best=Infinity
    for(let f=.76;f<=.84;f+=.005){
      const y=ext.minY+height*f, halfBand=height*.006
      const slice=vertices.filter(p=>Math.abs(p[1]-y)<=halfBand)
      if(slice.length<10)continue
      const xs=slice.map(p=>p[0]), min=Math.min(...xs),max=Math.max(...xs)
      const difference=Math.abs((max-min)*referenceHeight/height-shoulderBounds.width)
      if(difference<best){best=difference;shoulderFraction=f;shoulderCenter=(min+max)/2}
    }
  }
  const localShoulderY=(.5-shoulderFraction)*referenceHeight
  // The projected SVG currently has its origin at the avatar mesh bounds
  // center. Remove any asymmetry from the mannequin pose at shoulder level.
  const localShoulderX=(shoulderCenter-(ext?.cx || 0))*referenceHeight/height
  return {centerX,shoulderY,matchedShoulders:!!shoulderBounds,avatarX:-localShoulderX,
    avatarY:shoulderY-localShoulderY,shoulderFraction}
}

/** True cut outline crossings paired by the even-odd fill rule.
 * Boundaries are Rust mesh panel ordered per-edge boundary indices.
 * Half-open endpoints avoid double counting at joined polygon vertices.
 */
export function horizontalPatternSpans(boundaries, uv, y) {
  if (!Number.isFinite(y)) return []
  const intersections = []
  for (const indices of Object.values(boundaries || {})) {
    for (let i = 1; i < indices.length; i++) {
      const a = uv[indices[i-1]], b = uv[indices[i]]
      if (!a || !b || ![...a, ...b].every(Number.isFinite)) continue
      if ((a[1] <= y && y < b[1]) || (b[1] <= y && y < a[1]))
        intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
    }
  }
  intersections.sort((a,b) => a-b)
  const spans = []
  for (let i = 0; i + 1 < intersections.length; i += 2)
    if (intersections[i+1] - intersections[i] > .005)
      spans.push([intersections[i], intersections[i+1]])
  return spans
}

/** Intersections with the true cut perimeter at a given pattern-space X.
 * Pairs use half-open endpoints to avoid double counting shared vertices.
 */
export function verticalPatternSpans(boundaries, uv, x) {
  if (!Number.isFinite(x)) return []
  const intersections=[]
  for (const indices of Object.values(boundaries || {})) {
    for (let i=1;i<indices.length;i++) {
      const a=uv[indices[i-1]], b=uv[indices[i]]
      if (!a || !b || ![...a,...b].every(Number.isFinite)) continue
      if ((a[0]<=x && x<b[0]) || (b[0]<=x && x<a[0]))
        intersections.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]))
    }
  }
  intersections.sort((a,b)=>a-b)
  const spans=[]
  for (let i=0;i+1<intersections.length;i+=2)
    if (intersections[i+1]-intersections[i]>.005) spans.push([intersections[i],intersections[i+1]])
  return spans
}

export function previewPoint(point, preview) {
  if (!preview) return point
  if (preview.kind === 'move') return [point[0]+preview.delta[0],point[1]+preview.delta[1]]
  const cx=preview.center[0], cy=preview.center[1]
  const x=point[0]-cx
  const y=point[1]-cy
  const a=preview.kind==='rotate'?preview.angle:0
  return [cx + x*Math.cos(a) - y*Math.sin(a), cy + x*Math.sin(a) + y*Math.cos(a)]
}

export function rotatedLayoutAroundCenter(layout, deltaDegrees, center) {
  const d=deltaDegrees*Math.PI/180
  const vx=center[0]-layout[0], vy=center[1]-layout[1]
  return [center[0]-(vx*Math.cos(d)-vy*Math.sin(d)),
    center[1]-(vx*Math.sin(d)+vy*Math.cos(d))]
}
