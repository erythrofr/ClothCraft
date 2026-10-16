// Symmetric unfold for a half-pattern along one straight fold/cut edge.
// CLO reference: 2D Edit Pattern > Unfold (public creator field guide).
// This is an independent geometry implementation. It does NOT implement
// CLO's proprietary parametric linked-symmetry data model.
import { mirrorPointAcrossLine } from './draftingConstructions.js'
import { inspectDraftTopology } from './draftingTopology.js'

const near = (a,b) => Math.hypot(a.x-b.x,a.y-b.y) < .001

export function unfoldDraftPiece(piece, foldEdgeIndex) {
  const points = piece?.points || []
  const n = points.length
  if (n < 3 || !Number.isInteger(foldEdgeIndex) || foldEdgeIndex < 0 || foldEdgeIndex >= n) {
    throw new Error('Select a valid straight fold edge of a closed half-pattern')
  }
  if (piece.locked) throw new Error('Unlock this pattern before unfolding')
  if (piece.curves?.[foldEdgeIndex]) throw new Error('Unfold requires a straight fold edge')
  const a = points[foldEdgeIndex], b = points[(foldEdgeIndex+1)%n]
  if (near(a,b)) throw new Error('Fold edge must have a nonzero length')
  const dx=b.x-a.x, dy=b.y-a.y
  const norm=Math.hypot(dx,dy), ux=dx/norm,uy=dy/norm
  const reflectVector = v => {
    const projection=2*(ux*v.x+uy*v.y)
    return {x:projection*ux-v.x, y:projection*uy-v.y}
  }
  const reflect = vertex => {
    const next=mirrorPointAcrossLine(vertex,a,b)
    const copy={...vertex,x:next.x,y:next.y}
    if (vertex.gradeRule?.enabled) {
      const vector=reflectVector({
        x:Number(vertex.gradeRule.dxPerSize||0),
        y:Number(vertex.gradeRule.dyPerSize||0),
      })
      copy.gradeRule={...vertex.gradeRule,dxPerSize:vector.x,dyPerSize:vector.y}
    }
    if (copy.id) copy.id=String(copy.id)+'-unfold'
    return copy
  }
  const walk=Array.from({length:n},(_,i)=>(foldEdgeIndex+1+i)%n)
  const reflected=walk.slice(1,-1).reverse().map(index=>reflect(points[index]))
  const newPoints=[...walk.map(index=>({...points[index]})),...reflected]
  const newCount=newPoints.length
  const edgeMap={}
  const mirroredEdgeMap={}
  const newCurves={}
  const newAllowances={}
  for(let k=0;k<n-1;k++){
    const oldEdge=walk[k]
    const reflectedEdge=newCount-1-k
    edgeMap[oldEdge]=k
    mirroredEdgeMap[oldEdge]=reflectedEdge
    const curve=piece.curves?.[oldEdge]
    if(curve) {
      newCurves[k]={...curve}
      const mirrored=mirrorPointAcrossLine({x:curve.cx,y:curve.cy},a,b)
      newCurves[reflectedEdge]={cx:mirrored.x,cy:mirrored.y}
    }
    const allowance=piece.edgeSeamAllowances?.[oldEdge]
    if(allowance!==undefined){
      newAllowances[k]=allowance
      newAllowances[reflectedEdge]=allowance
    }
  }
  const foldNotch=(piece.notches||[]).find(notch=>notch.edgeIndex===foldEdgeIndex)
  if(foldNotch) throw new Error('Remove notches from the fold edge before unfolding')
  const newNotches=[]
  for(const notch of piece.notches||[]){
    const mapped=edgeMap[notch.edgeIndex]
    if(!Number.isInteger(mapped)) continue
    newNotches.push({...notch,edgeIndex:mapped})
    newNotches.push({...notch,id:String(notch.id||'notch')+'-unfold',
      edgeIndex:mirroredEdgeMap[notch.edgeIndex],t:1-Number(notch.t??.5),
      matchGroupId:null,matchedSeamId:null})
  }
  const newInternal=[...(piece.internalLines||[]).map(line=>({...line}))]
  for(const line of piece.internalLines||[]){
    const left=mirrorPointAcrossLine(line.a,a,b)
    const right=mirrorPointAcrossLine(line.b,a,b)
    if(near(left,line.a)&&near(right,line.b)) continue
    newInternal.push({...line,id:String(line.id||'internal')+'-unfold',
      name:(line.name||'Internal')+' mirror',a:left,b:right})
  }
  const expanded={
    ...piece, points:newPoints, curves:newCurves,
    edgeSeamAllowances:newAllowances,notches:newNotches,internalLines:newInternal,
    name:String(piece.name||'Pattern').replace(/\s*\(half\)$/i,'')+' · Unfolded',
  }
  const topology=inspectDraftTopology(expanded,{curveSamples:24})
  if(!topology.valid) throw new Error('Unfold would overlap/cross the pattern: '+topology.errors[0])
  const before=inspectDraftTopology(piece,{curveSamples:24})
  if(!before.valid) throw new Error('The original half-pattern must have a valid closed cutline')
  if(Math.abs(topology.areaCm2 - before.areaCm2*2)>Math.max(.025,before.areaCm2*.005)) {
    throw new Error('Unfolded area must equal twice the original half-pattern area')
  }
  return {piece:expanded,edgeMap,mirroredEdgeMap,foldEdgeIndex,areaCm2:topology.areaCm2}
}
