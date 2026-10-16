/** CLO7 observed positions matched to verified EXO Rust V2 controls. Pure, declarative.
 * Keys use dimension prefixes because CLO repeats A01/B01 across 3D and 2D.
 * 'native' means a meaningful V2 change exists, not CLO feature parity.
 * 'inspect' is read-only or display-only; never treat as an editing command.
 * 'unavailable' is disabled pending native implementation.
 */
import {CLO7_3D_A,CLO7_3D_B,CLO7_2D_A,CLO7_2D_B} from '../data/clo7ToolbarOrder.js'

const SUPPORTED = Object.freeze({
  "3d:A01": "simulation.toggle",
  "3d:A02": "viewport3d.selectMove",
  "3d:A06": "sewing.freeSew",
  "3d:A07": "sewing.freeSew",
  "3d:A14": "arrangement.reset3d",
  "2d:A01": "pattern2d.selectTransform",
  "2d:A02": "pattern2d.editPoints",
  "2d:A04": "pattern2d.drawPolygon",
  "2d:A05": "pattern2d.drawInternalLine",
  "2d:B02": "sewing.freeSew",
  "2d:B03": "sewing.freeSew"
})
const INSPECTION = Object.freeze({
  "3d:A05": "sewing.inspectSeams",
  "2d:B01": "sewing.inspectSeams",
  "3d:B07": "fabric.inspectProperties",
  "2d:B07": "fabric.inspectProperties",
  "3d:A19": "dimensions.show",
  "3d:A20": "dimensions.show",
  "2d:A11": "dimensions.measureTemporary",
  "2d:A12": "dimensions.measureTemporary",
  "2d:B04": "sewing.inspectSeams"
})
const NATIVE_REASONS = Object.freeze({
  "3d:A02": "Native Rust Place/pose-panel changes selected garment placement; no CLO gizmo parity claim.",
  "3d:A06": "Select two garment edge ranges in the native 3D viewport to author a segment sewing relationship; requires actual valid edges.",
  "3d:A07": "Select two garment edges in the native 3D viewport to sew them with the existing Rust seam operation.",
  "3d:A14": "Native Rust reset restores the 3D initial off-body pose while preserving authored 2D patterns, material and sewing relations.",
  "2d:A01": "Native BoardTransform changes 2D panel placement.",
  "2d:A02": "Native MovePoints/CurvePoint edit existing pattern points.",
  "2d:A04": "Native Polygon creates authored pattern geometry.",
  "2d:A05": "Native InternalLine authors panel interior lines.",
  "2d:B02": "Native Rust Sew pairs selected 2D boundary ranges, with undo and edge validation.",
  "2d:B03": "Native Sew joins selected boundary ranges; requires two valid boundary selections.",
  "3d:A01": "Native step changes simulated cloth state; pause stops scheduled steps."
})
const INSPECTION_REASON = 'Related native information is viewable, but this CLO editing operation is not implemented.'
const INSPECTION_REASONS = Object.freeze({
  "2d:A11":"Click two positions on the native 2D pattern to measure exact metric distance. This is a temporary tape overlay, not an authored production POM.",
  "2d:A12":"Temporary two-click tape measure is available on the native 2D board. Saved and graded CLO POM construction remains unimplemented.",
  "2d:B04":"Select a native sewing relationship to inspect both connected 2D/3D boundary lengths and simulated gap; automatic sewing-length correction is not implemented.",
})
const MISSING_REASON = 'No equivalent verified Rust V2 operation; keep this reference tool disabled.'
const missingImplementation = label => {
 const name=String(label).toLowerCase()
 if(/styleline|3d pen|base pen|3d pattern.*line|line \(3d pattern\)/.test(name))
   return 'Needs persistent 3D projected pen/stroke geometry with editable anchors, surface attachment, undo and export. Existing 2D construction lines are not a substitute.'
 if(/seam taping|steam|press|puckering/.test(name))
   return 'Requires a solver-backed textile finishing or reinforcement constraint, with material/temperature parameters and measurable cloth response. EXO does not yet simulate this manufacturing process.'
 if(/piping|binding|zipper|fasten button/.test(name))
   return 'Requires typed 3D trim geometry, attachment/sewing topology, rigid or deformable contact, material/style assets, and undo. EXO draft trim annotations alone do not satisfy this.'
 if(/button|topstitch|graphic/.test(name))
   return 'Needs native object selection/placement and a typed instance/style model linked to the cloth surface. Related EXO draft annotations exist, but are not yet native CLO-equivalent geometry.'
 if(/trace|fullness|notch|seam allowance|walk pattern|pleats|grading|base polygon/.test(name))
   return 'Requires a native parametric drafting operation that updates real pattern points/segments and survives undo, reopen and production export. Current EXO draft tools are not native Rust equivalents.'
 if(/arrangement|fold|hi-res|redrape|re-drape/.test(name))
   return 'Requires a dedicated arrangement, fold or remeshing operation that preserves authored patterns and measures resulting cloth state. Use supported native move/reset/simulation controls until verified.'
 if(/tack|edit sewing|sewing/.test(name))
   return 'Requires first-class seam/tack selection and editing with valid boundary pair relationships, attachment constraints and reversible native operations; only selected simpler sewing modes work so far.'
 if(/avatar|measure|motion/.test(name))
   return 'Requires typed avatar measurements, animation tracks or garment measurement objects that remain attached to native 3D geometry; no matching authoring command is currently available.'
 if(/texture|fill|sublayer/.test(name))
   return 'Requires a native pattern-side paint/layer/UV tool with persistent material masks, per-face maps and reversible edits. The separate Fabric workspace handles existing material properties.'
 return MISSING_REASON
}

export const CLO7_NATIVE_TOOL_CAPABILITIES = Object.freeze(
  [
    ['3d','A',CLO7_3D_A],['3d','B',CLO7_3D_B],
    ['2d','A',CLO7_2D_A],['2d','B',CLO7_2D_B],
  ].flatMap(([dimension,column,slots])=>slots.map(slot=>{
    const id=`${dimension}:${slot.id}`
    const nativeAction=SUPPORTED[id]
    const inspectionAction=INSPECTION[id]
    const mode=nativeAction?'native':inspectionAction?'inspect':'unavailable'
    return Object.freeze({
      id, label:slot.label, dimension, column, position:slot.id,
      mode, ...(nativeAction?{nativeAction}:{}),
      reason:mode==='native'?(NATIVE_REASONS[id]||'Verified native V2 action with meaningful state changes.'):mode==='inspect'?(INSPECTION_REASONS[id]||INSPECTION_REASON):missingImplementation(slot.label),
      ...(inspectionAction?{inspectionAction}:{}),
    })
  }))
)
export const CLO7_NATIVE_TOOL_BY_ID = Object.freeze(Object.fromEntries(
  CLO7_NATIVE_TOOL_CAPABILITIES.map(capability=>[capability.id,capability])
))
export const getClo7NativeCapability = (dimension,position) =>
  CLO7_NATIVE_TOOL_BY_ID[`${dimension}:${position}`] ?? null
