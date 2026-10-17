import * as THREE from 'three'

// Optical inspection sculpture. This geometry is never passed to the garment solver.
export function createInspectionDrape(fabric = {}) {
  const segments=128, rows=76, radius=.81
  const mass=Math.max(70,Math.min(950,Number(fabric.gsm)||280))
  const bend=Math.max(.07,Math.min(1.7,Number(fabric.bend)||.55))
  const softness=THREE.MathUtils.clamp(1.4-bend*.55,.55,1.4)
  const weight=THREE.MathUtils.clamp(mass/350,.25,2.7)
  const vertices=[],uv=[],indices=[]
  for(let j=0;j<=rows;j++) {
    const t=j/rows
    const onSphere=t<=.43
    const fall=onSphere?0:(t-.43)/.57
    const phi=Math.min(t/.43,1)*1.48
    const hemEnvelope=Math.pow(fall,1.32)
    for(let i=0;i<=segments;i++) {
      const a=i/segments*Math.PI*2
      // Broad, unequal pleats and secondary ripples; displacement grows along gravity.
      const primary=Math.sin(a*8+.38+fall*.17)
      const secondary=Math.sin(a*13-1.3+fall*.49)
      const tertiary=Math.cos(a*19+.6-fall*.34)
      const pleat=hemEnvelope*softness*(.115*primary+.048*secondary+.018*tertiary)
      const shoulderR=radius*Math.sin(phi)
      const rr=onSphere?shoulderR:shoulderR*(1-.07*fall)+pleat
      const irregularHem=hemEnvelope*(.045*Math.sin(a*8+.3)+.025*Math.sin(a*13-.7)+.012*Math.cos(a*23))
      const yy=onSphere?radius*Math.cos(phi):radius*Math.cos(1.48)-(1.18+.12*weight)*fall+irregularHem
      vertices.push(rr*Math.cos(a),yy,rr*Math.sin(a))
      uv.push(i/segments*3,j/rows*3.2)
      if(i<segments&&j<rows){const n=j*(segments+1)+i;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2)}
    }
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
