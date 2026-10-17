// Analytic drafting geometry in centimeters. No numerical sampling, no eval,
// no implicit rounding and no writes to the original pattern document.
import { assertDraftCoordinate, precisePointEdit } from './draftingPrecision.js'

const epsilon=1e-10

export function constructionReferencePoint(piece, oneBasedIndex) {
  const n=Number(oneBasedIndex)
  if (!Number.isInteger(n) || n<1 || n>piece?.points?.length) {
    throw new Error(`Reference index must be a pattern point between 1 and ${piece?.points?.length ?? 0}`)
  }
  const point=piece.points[n-1]
  return {x:assertDraftCoordinate(point.x,'Reference X'),y:assertDraftCoordinate(point.y,'Reference Y')}
}

export function lineIntersection(a,b,c,d) {
  const u={x:b.x-a.x,y:b.y-a.y}
  const v={x:d.x-c.x,y:d.y-c.y}
  const cross=u.x*v.y-u.y*v.x
  if (Math.abs(cross)<epsilon) throw new Error('Construction lines are parallel or coincident')
  const t=((c.x-a.x)*v.y-(c.y-a.y)*v.x)/cross
  return {x:a.x+t*u.x,y:a.y+t*u.y}
}

export function projectOntoLine(point,a,b) {
  const u={x:b.x-a.x,y:b.y-a.y}
  const norm=u.x*u.x+u.y*u.y
  if (norm<epsilon*epsilon) throw new Error('Construction reference line has zero length')
  const t=((point.x-a.x)*u.x+(point.y-a.y)*u.y)/norm
  return {x:a.x+t*u.x,y:a.y+t*u.y}
}

export function pointAlongLine(a,b,distanceCm,{perpendicular=false}={}) {
  const delta={x:b.x-a.x,y:b.y-a.y}
  const norm=Math.hypot(delta.x,delta.y)
  if (norm<epsilon) throw new Error('Construction reference line has zero length')
  const distance=assertDraftCoordinate(distanceCm,'Construction offset')
  const unit=perpendicular
    ? {x:-delta.y/norm,y:delta.x/norm}
    : {x:delta.x/norm,y:delta.y/norm}
  return {x:a.x+unit.x*distance,y:a.y+unit.y*distance}
}

export function mirrorPointAcrossLine(point,a,b) {
  const foot=projectOntoLine(point,a,b)
  return {x:foot.x*2-point.x,y:foot.y*2-point.y}
}

export const DRAFT_CONSTRUCTION_MODES=Object.freeze({
  line: 'Point at measured distance along A → B',
  normal: 'Perpendicular at measured distance from A',
  foot: 'Project selected point onto line A–B',
  mirror: 'Mirror selected point across line A–B',
  intersection: 'Intersection of infinite lines A–B and C–D',
})

export function preciseConstructionEdit(piece, pointIndex, options={}) {
  const {
    construction='line', a=1,b=2,c=3,d=4,distanceCm=0,
  }=options
  if (!Object.hasOwn(DRAFT_CONSTRUCTION_MODES,construction)) throw new Error('Unsupported construction operation')
  if (!piece?.points?.[pointIndex]) throw new Error('Invalid pattern point')
  const refA=constructionReferencePoint(piece,a)
  const refB=constructionReferencePoint(piece,b)
  const existing=piece.points[pointIndex]
  let point
  switch(construction) {
    case 'line':
      point=pointAlongLine(refA,refB,distanceCm)
      break
    case 'normal':
      point=pointAlongLine(refA,refB,distanceCm,{perpendicular:true})
      break
    case 'foot':
      point=projectOntoLine(existing,refA,refB)
      break
    case 'mirror':
      point=mirrorPointAcrossLine(existing,refA,refB)
      break
    default:
      point=lineIntersection(refA,refB,
        constructionReferencePoint(piece,c),
        constructionReferencePoint(piece,d))
  }
  return precisePointEdit(piece,pointIndex,{...point,mode:'absolute'})
}
