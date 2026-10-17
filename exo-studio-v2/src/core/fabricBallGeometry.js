import * as THREE from 'three'

export const FABRIC_BALL_SWATCH_CM=270

/** Rest-pattern UV remains flat even when the display mesh is folded. */
export function fabricBallGeometryDiagnostics(geometry){
  const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),index=geometry.getIndex()
  const dimensions=geometry.userData?.sourceLengthCm||FABRIC_BALL_SWATCH_CM
  const area=(ax,ay,az,bx,by,bz,cx,cy,cz)=>{
    const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az
    return Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)*.5
  }
  let minRatio=Infinity,maxRatio=0,sumRest=0,sumDraped=0,invalidTriangles=0
  for(let i=0;i<index.count;i+=3){
    const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2)
    const flat=area(uv.getX(a)*dimensions/100,0,uv.getY(a)*dimensions/100,
      uv.getX(b)*dimensions/100,0,uv.getY(b)*dimensions/100,
      uv.getX(c)*dimensions/100,0,uv.getY(c)*dimensions/100)
    const draped=area(p.getX(a),p.getY(a),p.getZ(a),p.getX(b),p.getY(b),p.getZ(b),p.getX(c),p.getY(c),p.getZ(c))
    if(!Number.isFinite(flat)||!Number.isFinite(draped)||flat<=1e-12){invalidTriangles++;continue}
    const ratio=draped/flat
    minRatio=Math.min(minRatio,ratio);maxRatio=Math.max(maxRatio,ratio)
    sumRest+=flat;sumDraped+=draped
  }
  return {triangles:index.count/3,invalidTriangles,
    minAreaRatio:Number.isFinite(minRatio)?minRatio:null,maxAreaRatio:maxRatio||null,
    totalAreaRatio:sumRest?sumDraped/sumRest:null,
    illustrativeOnly:true}
}

// A *square* cloth sample resting on a display sphere. Coordinates represent
// the same continuous sheet across the dome and four longer hanging corners.
// Gravity-like sag and angular pleats respond to preset mass/bend but are a
// deterministic optical approximation, NOT measured cloth mechanics.
//
// Unlike a revolved cylinder, a square grid produces realistic corner
// overhang and asymmetric hem edges. 2D UV follows the source fabric sheet
// without the pole pinching of a spherical UV unwrap.
export function createFabricBallGeometry(fabric={}, {segments=104,rings=104}={}) {
  const radius=.81
  const centerY=.23
  // Cloth must leave the ball near its equator. A smaller release radius
  // leaves the real support sphere protruding through the hanging sheet.
  const contactRadius=.785
  const halfSize=FABRIC_BALL_SWATCH_CM/200
  const bend=THREE.MathUtils.clamp(Number(fabric.bend??.62)||.62,.08,1.8)
  const gsm=THREE.MathUtils.clamp(Number(fabric.gsm??280)||280,60,1000)
  const mass=gsm/320
  const softness=THREE.MathUtils.clamp((1.35-bend)*.68,.24,.92)
  const contactY=centerY+Math.sqrt(radius*radius-contactRadius*contactRadius)+.013
  const positions=[],uvs=[],indices=[]
  for(let iz=0;iz<=rings;iz++){
    const v=iz/rings
    const flatZ=(v*2-1)*halfSize
    for(let ix=0;ix<=segments;ix++){
      const u=ix/segments
      const flatX=(u*2-1)*halfSize
      const r=Math.hypot(flatX,flatZ)
      const angle=Math.atan2(flatZ,flatX)
      let x=flatX,z=flatZ,y
      if(r<=contactRadius){
        y=centerY+Math.sqrt(Math.max(0,radius*radius-r*r))+.013
      }else{
        const run=r-contactRadius
        const ease=THREE.MathUtils.smoothstep(run,0,.36)
        // Edge falls mostly vertically, retaining enough skirt expansion to
        // show real folds across the light rather than self-overlapping walls.
        const drop=run*(.92+.21*mass)+run*run*(.05+.03*mass)
        // Keep projected radius monotonic along each radial grid line.
        // Strong pinching had folded triangles through the support sphere and
        // created visible holes; wrinkles belong chiefly in vertical relief.
        const pleat=softness*run*(.018*Math.sin(9*angle+.37)+.009*Math.sin(15*angle-1.1))
        const sweep=contactRadius+run*(.19+.025*bend)+pleat
        const smooth=.018*Math.sin(angle*3+.2)*Math.min(1,run*2)
        x=(sweep/r)*flatX+smooth*Math.cos(angle+.6)
        z=(sweep/r)*flatZ+smooth*Math.sin(angle+.6)
        const hemWave=ease*softness*(.044*Math.cos(9*angle-.2)+.015*Math.sin(17*angle+.4))
        const verticalFolds=ease*softness*.025*Math.sin(8*angle+2.2*run)*Math.min(1,run)
        y=contactY-drop+hemWave+verticalFolds
      }
      positions.push(x,y,z)
      // Physical weave repeat derives from the original square textile
      // pattern, not cylindrical angular coordinates; this avoids a seam.
      uvs.push(u,v)
      if(ix<segments&&iz<rings){
        const a=iz*(segments+1)+ix
        indices.push(a,a+segments+1,a+1,a+1,a+segments+1,a+segments+2)
      }
    }
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.userData={
    visualModel:'square-cloth-draped-over-sphere',
    sourceLengthCm:halfSize*2*100,
    measuredMaterial:false,
    supportedFamilies:'visual-reference-only',
  }
  return geometry
}
