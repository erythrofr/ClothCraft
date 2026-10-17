/** Native ClothCraft selection dimensions, measured from the exact active
 * VBD mesh (3D) and authored UV pattern (2D), never from the unrelated EXO
 * draft. Mesh positions and UV are metres, return values are centimetres. */
const finitePoint = (p, dimensions) => Array.isArray(p) && p.length >= dimensions && p.slice(0, dimensions).every(Number.isFinite)

export function boundaryLength(indices, points, dimensions = 3) {
  if (!Array.isArray(indices) || indices.length < 2 || !Array.isArray(points)) return null
  let length = 0
  for (let i = 1; i < indices.length; i++) {
    const a = points[indices[i - 1]], b = points[indices[i]]
    if (!finitePoint(a, dimensions) || !finitePoint(b, dimensions)) return null
    length += Math.hypot(...a.slice(0, dimensions).map((v, d) => v - b[d]))
  }
  return Number.isFinite(length) ? length * 100 : null
}

// A sewn segment may cover only part of a named pattern boundary. Evaluate
// its 3D length on that exact rest-arclength interval, interpolating between
// the live positions at the same UV/material coordinates. Full-edge metrics
// must not silently be substituted for a partial sewing relationship.
function measuredSewingInterval(snapshot,side){
  const panel=snapshot?.panels?.find(p=>p.id===side?.panel)
  const indices=panel?.boundaries?.[side?.edge||side?.side]
  const range=side?.range||[0,1]
  if(!Array.isArray(indices)||indices.length<2||!Array.isArray(range)||range.length!==2||
    range.some(n=>!Number.isFinite(n))||range[0]<0||range[1]>1||range[0]>=range[1])return null
  const uv=indices.map(i=>snapshot.uv?.[i]),live=indices.map(i=>snapshot.positions?.[i])
  if(uv.some(p=>!finitePoint(p,2))||live.some(p=>!finitePoint(p,3)))return null
  const segments=uv.slice(1).map((p,i)=>Math.hypot(p[0]-uv[i][0],p[1]-uv[i][1]))
  const total=segments.reduce((a,b)=>a+b,0)
  if(!(total>0))return null
  const start=total*range[0],end=total*range[1]
  let cum=0,dist=0
  for(let i=0;i<segments.length;i++){
    const span=segments[i],lo=Math.max(start,cum),hi=Math.min(end,cum+span)
    if(hi>lo&&span>0){
      const interpolate=t=>live[i].slice(0,3).map((v,k)=>v+(live[i+1][k]-v)*t)
      const a=interpolate((lo-cum)/span),b=interpolate((hi-cum)/span)
      dist+=Math.hypot(...a.map((v,k)=>v-b[k]))
    }
    cum+=span
  }
  return {length2DCm:(end-start)*100,length3DCm:dist*100}
}

export function measureNativeSelection(snapshot, selected) {
  if(selected?.seamId&&snapshot?.template?.seams){
    const seam=snapshot.template.seams.find(item=>item.id===selected.seamId)
    if(!seam)return null
    const first=measuredSewingInterval(snapshot,seam.a)
    const second=measuredSewingInterval(snapshot,seam.b)
    const compiled=snapshot.seams?.find(item=>item.id===seam.id)
    return {
      kind:'sewing',source:'rust',seamId:seam.id,panelId:seam.a?.panel,panelName:`Sewing · ${seam.id}`,
      edgeId:seam.a?.edge||null,revision:snapshot.revision,
      first:{panel:seam.a?.panel,edge:seam.a?.edge,length2DCm:first?.length2DCm??null,length3DCm:first?.length3DCm??null},
      second:{panel:seam.b?.panel,edge:seam.b?.edge,length2DCm:second?.length2DCm??null,length3DCm:second?.length3DCm??null},
      reversed:Boolean(seam.reverse_b),allowEase:Boolean(seam.allow_ease),
      nativeStiffnessNPerM2:Number.isFinite(seam.stiffness)?seam.stiffness:null,
      gapMm:Number.isFinite(compiled?.gap_m)?compiled.gap_m*1000:null,
    }
  }
  if (!snapshot?.template?.panels || !selected?.panel) return null
  const panel = snapshot.template.panels.find(p => p.id === selected.panel)
  const meshPanel = snapshot.panels?.find(p => p.id === selected.panel)
  if (!panel || !meshPanel) return null
  const edges = meshPanel.boundaries || {}
  if (selected.edge && !Object.hasOwn(edges, selected.edge)) return null
  const selectedEdges = selected.edge ? [selected.edge] : Object.keys(edges)
  const measured = selectedEdges.map(id => ({
    edgeId: id,
    flatCm: boundaryLength(edges[id], snapshot.uv, 2),
    drapedCm: boundaryLength(edges[id], snapshot.positions, 3),
  }))
  const allMeasured = measured.every(e => Number.isFinite(e.flatCm) && Number.isFinite(e.drapedCm))
  const length2DCm = allMeasured ? measured.reduce((total, e) => total + e.flatCm, 0) : null
  const length3DCm = allMeasured ? measured.reduce((total, e) => total + e.drapedCm, 0) : null
  const seams = (snapshot.template.seams || []).filter(spec =>
    [spec.a, spec.b].some(side => side?.panel === selected.panel && (!selected.edge || side?.edge === selected.edge)))
  const material=snapshot.template.fabrics?.find(f=>f.id===panel.fabric)
  return {
    kind: selected.edge ? 'line' : 'pattern', source: 'rust',
    panelId:panel.id, panelName:panel.name, edgeId:selected.edge || null,
    fabricId:panel.fabric, revision:snapshot.revision,
    fabricName: material?.name || panel.fabric,
    materialThicknessMm: Number.isFinite(material?.properties?.thickness)?material.properties.thickness*1000:null,
    grainAngleDeg: Number.isFinite(panel.grain_degrees)?panel.grain_degrees:null,
    meshTargetEdgeMm: Number.isFinite(panel.polygon?.meshing?.target_edge_m)?panel.polygon.meshing.target_edge_m*1000:null,
    meshVertexCount:Array.isArray(meshPanel.vertices)?meshPanel.vertices[1]-meshPanel.vertices[0]:null,
    meshTriangleCount:Array.isArray(meshPanel.triangles)?meshPanel.triangles[1]-meshPanel.triangles[0]:null,
    positionCm:Array.isArray(panel.placement?.translation)? panel.placement.translation.map(x=>x*100):null,
    rotationDeg:panel.placement?.rotation_degrees || null,
    length2DCm, length3DCm,
    elongationPercent:length2DCm > 0 && length3DCm != null ? (length3DCm / length2DCm - 1) * 100 : null,
    edgeCount:selectedEdges.length,
    seamIds:seams.map(spec=>spec.id),
    targetLengthCm: selected.edge ? Number.isFinite(panel.polygon?.target_lengths?.[selected.edge])
      ? panel.polygon.target_lengths[selected.edge] * 100 : null : null,
  }
}
