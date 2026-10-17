import {uniqueId} from './project.js'
import {pieceCenter, topstitchPaths, zipperPaths, offsetEdgePath} from './trims.js'

/** Commands for the persisted EXO draft garment document, not Rust native edits.
 * Caller must pass the returned project through its existing undoable mutateProject
 * transaction. No action in this module claims to construct rigid-body hardware.
 */
export const DRAFT_HARDWARE_COMMANDS = Object.freeze(['button','buttonhole','topstitch','zipper','binding'])
const collection = Object.freeze({button:'buttons',buttonhole:'buttonholes',topstitch:'topstitches',zipper:'zippers',binding:'bindings'})

function finite(value, name, min, max) {
  if(typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`${name} must be a finite number between ${min} and ${max}`)
  return value
}
function validEdge(piece, edgeIndex) {
  if(!Number.isSafeInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= piece.points.length)
    throw new RangeError('An existing pattern edge is required')
  const path=offsetEdgePath(piece,edgeIndex,0,8)
  if(path.length < 2 || !path.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)) ||
      Math.hypot(path.at(-1).x-path[0].x,path.at(-1).y-path[0].y)<1e-6)
    throw new RangeError('A nondegenerate pattern edge is required')
}
function coords(piece, options) {
  const center=pieceCenter(piece)
  return {x:finite(options.x??center.x,'x',-500,500),y:finite(options.y??center.y,'y',-500,500)}
}

/** In-place draft operation; call ONLY inside the app's undoable mutateProject callback.
 * Throws before mutation on bad input; returns the persisted annotation metadata.
 */
export function applyDraftHardwareAction(project, command) {
  if(!project || !Array.isArray(project.pieces) || !command || typeof command!=='object')
    throw new TypeError('An editable draft project and command are required')
  const {kind,pieceId,edgeIndex,...options}=command
  if(!Object.hasOwn(collection,kind))throw new RangeError(`Unsupported draft construction command: ${kind}`)
  const piece=project.pieces.find(item=>item.id===pieceId)
  if(!piece || !Array.isArray(piece.points) || piece.points.length<3 || piece.locked)
    throw new RangeError('Select an unlocked pattern with valid points')
  if(kind==='topstitch'||kind==='zipper'||kind==='binding')validEdge(piece,edgeIndex)
  const id=uniqueId(kind)
  let item
  if(kind==='button') {
    item={id,...coords(piece,options),diameterCm:finite(options.diameterCm??1.2,'diameterCm',0.1,20),
      holes:finite(options.holes??4,'holes',0,8),color:options.color??'#303030'}
    if(!Number.isInteger(item.holes))throw new RangeError('holes must be an integer')
  } else if(kind==='buttonhole') {
    item={id,...coords(piece,options),lengthCm:finite(options.lengthCm??2.4,'lengthCm',0.1,30),
      widthCm:finite(options.widthCm??0.35,'widthCm',0.01,20),
      orientationDeg:finite(options.orientationDeg??0,'orientationDeg',-360,360),color:options.color??'#575757'}
  } else if(kind==='topstitch') {
    item={id,edgeIndex,offsetCm:finite(options.offsetCm??0.7,'offsetCm',0,20),
      rows:finite(options.rows??1,'rows',1,3),rowGapCm:finite(options.rowGapCm??0.45,'rowGapCm',0.01,10),
      stitchLengthMm:finite(options.stitchLengthMm??3,'stitchLengthMm',0.1,25),color:options.color??'#8d8d8d'}
    if(!Number.isInteger(item.rows))throw new RangeError('rows must be an integer')
    if(!topstitchPaths(piece,item).every(path=>path.length>=2))throw new RangeError('Unable to construct topstitch paths')
  } else if(kind==='zipper') {
    item={id,edgeIndex,widthCm:finite(options.widthCm??1.2,'widthCm',0.15,10),
      offsetCm:finite(options.offsetCm??0,'offsetCm',-5,5),sliderFraction:finite(options.sliderFraction??1,'sliderFraction',0,1),
      fastened:Boolean(options.fastened??true),twoWay:Boolean(options.twoWay??false),
      ...(options.hardwarePresetId?{hardwarePresetId:options.hardwarePresetId}:{})}
    if(!zipperPaths(piece,item).every(path=>path.length>=2))throw new RangeError('Unable to construct zipper tape paths')
  } else {
    item={id,edgeIndex,widthCm:finite(options.widthCm??1.8,'widthCm',0.1,20),
      ratio:finite(options.ratio??0.96,'ratio',0.5,1.2),stiffness:finite(options.stiffness??0.72,'stiffness',0,1),
      color:options.color??'#3b3b3b'}
  }
  if(typeof item.color==='string'&&!/^#[0-9a-fA-F]{6}$/.test(item.color))
    throw new RangeError('Color must be #RRGGBB')
  if(!Array.isArray(piece[collection[kind]]))piece[collection[kind]]=[]
  piece[collection[kind]].push(item)
  return {ok:true,engine:'exo-draft',kind,pieceId,id,collection:collection[kind],item}
}

/** Safe dry-run transaction, useful for validation and integration tests. */
export function constructDraftHardware(project,command) {
  const next=structuredClone(project)
  const result=applyDraftHardwareAction(next,command)
  return {...result,project:next}
}
