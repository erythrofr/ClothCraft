// An explicit conditioning report for generated 2D cloth triangles. ShapeUtils
// ear-clipping plus uniform subdivision can produce long, thin elements which
// destabilize anisotropic strain constraints even when sewing lengths match.
// Inputs are local pattern coordinates in centimeters (Vector2 or [x,y]).
function point(value) {
  return Array.isArray(value) ? value : [value?.x, value?.y]
}

export function inspectClothMesh(vertices = [], faces = [], { aspectLimit = 25, minimumAltitudeCm = 0.2, worstCount = 8 } = {}) {
  let maximumAspect = 0
  let minimumAltitude = Infinity
  let minimumArea = Infinity
  let degenerateFaces = 0
  let slenderFaces = 0
  const worst = []
  for (let index = 0; index < faces.length; index++) {
    const triangle = faces[index]
    if (!Array.isArray(triangle) || triangle.length !== 3 || triangle.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length)) {
      throw new RangeError(`Invalid cloth face ${index}`)
    }
    const [[ax,ay],[bx,by],[cx,cy]] = triangle.map(i => point(vertices[i]))
    if (![ax,ay,bx,by,cx,cy].every(Number.isFinite)) throw new RangeError(`Non-finite rest coordinates in face ${index}`)
    const twiceArea = Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))
    const areaCm2 = twiceArea*.5
    const longestEdgeCm = Math.max(Math.hypot(bx-ax,by-ay),Math.hypot(cx-bx,cy-by),Math.hypot(ax-cx,ay-cy))
    const shortestAltitudeCm = longestEdgeCm ? twiceArea / longestEdgeCm : 0
    const aspect = shortestAltitudeCm ? longestEdgeCm/shortestAltitudeCm : Infinity
    maximumAspect = Math.max(maximumAspect,aspect)
    minimumAltitude = Math.min(minimumAltitude,shortestAltitudeCm)
    minimumArea = Math.min(minimumArea,areaCm2)
    if (areaCm2 < 1e-7 || longestEdgeCm < 1e-7) degenerateFaces++
    if (aspect > aspectLimit || shortestAltitudeCm < minimumAltitudeCm) slenderFaces++
    if (aspect > aspectLimit || shortestAltitudeCm < minimumAltitudeCm) {
      worst.push({ index, triangle: [...triangle], aspect, shortestAltitudeCm, longestEdgeCm, areaCm2 })
    }
  }
  worst.sort((a,b)=>b.aspect-a.aspect || a.index-b.index)
  return {
    faces:faces.length,
    vertices:vertices.length,
    maximumAspect: Number.isFinite(maximumAspect) ? +maximumAspect.toFixed(3) : null,
    minimumAltitudeCm: Number.isFinite(minimumAltitude) ? +minimumAltitude.toFixed(4) : null,
    minimumAreaCm2: Number.isFinite(minimumArea) ? +minimumArea.toFixed(5) : null,
    degenerateFaces,
    slenderFaces,
    qualityApproved: degenerateFaces===0 && slenderFaces===0 && faces.length>0,
    thresholds: {aspectLimit,minimumAltitudeCm},
    worst: worst.slice(0,worstCount).map(item=>({
      ...item,
      aspect: +item.aspect.toFixed(3),
      shortestAltitudeCm: +item.shortestAltitudeCm.toFixed(4),
      longestEdgeCm: +item.longestEdgeCm.toFixed(4),
      areaCm2: +item.areaCm2.toFixed(5),
    })),
  }
}
