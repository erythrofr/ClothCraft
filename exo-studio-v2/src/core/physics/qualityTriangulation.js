// Conservative edge-flip quality optimization on the already sampled cloth
// polygon. Boundary coordinates, vertex indices and cut/sewing edge paths
// remain unchanged; only interior diagonals of valid convex quads can flip.
// Does NOT guarantee a high-quality mesh: bad boundary sampling and needle
// triangles still require constrained remeshing with interior points.

const coordinates = value => Array.isArray(value) ? value : [value.x,value.y]
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
const key = (a,b) => a<b ? `${a}:${b}` : `${b}:${a}`

function triangleQuality(v,triangle) {
  const [a,b,c]=triangle.map(i=>coordinates(v[i]))
  const twiceArea=Math.abs(cross(a,b,c))
  const longest=Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1]))
  return twiceArea>1e-11 ? (longest*longest/twiceArea) : Infinity
}

function orientLike(vertices,original,proposed) {
  const sign=Math.sign(cross(...original.map(i=>coordinates(vertices[i]))))
  const nextSign=Math.sign(cross(...proposed.map(i=>coordinates(vertices[i]))))
  return nextSign===sign ? proposed : [proposed[0],proposed[2],proposed[1]]
}

export function optimizeTriangleQuality(mesh,{passes=8,minImprovement=0.01}={}) {
  const vertices=mesh.vertices
  const faces=mesh.faces.map(face=>[...face])
  let totalFlips=0
  for (let pass=0;pass<passes;pass++) {
    const edges=new Map()
    faces.forEach((face,index)=>{
      for(let i=0;i<3;i++) {
        const a=face[i],b=face[(i+1)%3],opposite=face[(i+2)%3],k=key(a,b)
        if(!edges.has(k))edges.set(k,[])
        edges.get(k).push({index,a,b,opposite})
      }
    })
    let changed=0
    // The edge adjacency was computed at the start of the pass. Once a face
    // flips its prior edges are stale, so it must not be considered again
    // until adjacency is rebuilt on the next pass; otherwise boundary edges
    // can accidentally change even though the local four-vertex test passes.
    const usedFaces=new Set()
    for(const pair of edges.values()) {
      if(pair.length!==2)continue // keep every boundary and non-manifold edge
      const [left,right]=pair
      if(usedFaces.has(left.index)||usedFaces.has(right.index))continue
      const a=left.a,b=left.b,c=left.opposite,d=right.opposite
      if(new Set([a,b,c,d]).size!==4)continue
      // A valid convex quadrilateral has c,d on opposite sides of AB and
      // a,b on opposite sides of its proposed replacement diagonal CD.
      const [pa,pb,pc,pd]=[a,b,c,d].map(i=>coordinates(vertices[i]))
      const s1=cross(pa,pb,pc),s2=cross(pa,pb,pd)
      const t1=cross(pc,pd,pa),t2=cross(pc,pd,pb)
      if(s1*s2>=-1e-10 || t1*t2>=-1e-10)continue
      // No triangle should flip orientation relative to the original mesh.
      const nextA=orientLike(vertices,faces[left.index],[c,d,a])
      const nextB=orientLike(vertices,faces[right.index],[d,c,b])
      const originalWorst=Math.max(triangleQuality(vertices,faces[left.index]),triangleQuality(vertices,faces[right.index]))
      const nextWorst=Math.max(triangleQuality(vertices,nextA),triangleQuality(vertices,nextB))
      if(!(nextWorst<originalWorst*(1-minImprovement)))continue
      faces[left.index]=nextA
      faces[right.index]=nextB
      usedFaces.add(left.index)
      usedFaces.add(right.index)
      changed++
    }
    totalFlips+=changed
    if(!changed)break
  }
  return {vertices,faces,flips:totalFlips}
}
