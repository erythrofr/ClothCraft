/** CLO7 observed positions matched to verified EXO Rust V2 controls. Pure, declarative.
 * Keys use dimension prefixes because CLO repeats A01/B01 across 3D and 2D.
 * 'native' means a meaningful V2 change exists, not CLO feature parity.
 * 'inspect' opens related EXO browser/editor workflows, never claims CLO
 * command parity or a native implementation of the reference operation.
 * 'unavailable' is disabled pending native implementation.
 */
import {CLO7_3D_A,CLO7_3D_B,CLO7_2D_A,CLO7_2D_B} from '../data/clo7ToolbarOrder.js'

const SUPPORTED = Object.freeze({
  "3d:A01": "simulation.toggle",
  "3d:A02": "viewport3d.selectMove",
  "3d:A03": "viewport3d.meshBrushSelect",
  "3d:A05": "sewing.editExisting",
  "3d:A06": "sewing.freeSew",
  "3d:A07": "sewing.freeSew",
  "3d:A13": "arrangement.reset2d",
  "3d:A15": "simulation.redrape",
  "3d:A14": "arrangement.reset3d",
  "2d:A01": "pattern2d.selectTransform",
  "2d:A02": "pattern2d.editPoints",
  "2d:A04": "pattern2d.drawPolygon",
  "2d:A05": "pattern2d.drawInternalLine",
  "2d:A06": "pattern2d.basePolygon",
  "2d:A07": "pattern2d.traceContour",
  "2d:A08": "pattern2d.placeNotch",
  "2d:A09": "pattern2d.setSeamAllowanceGuide",
  "2d:A13": "pattern2d.editAnnotation",
  "2d:A14": "pattern2d.addAnnotation",
  "2d:B01": "sewing.editExisting",
  "2d:B02": "sewing.freeSew",
  "2d:B03": "sewing.freeSew"
})
const INSPECTION = Object.freeze({
  "3d:B07": "fabric.inspectProperties",
  "2d:B07": "fabric.inspectProperties",
  "3d:B08": "graphics.inspectEditor",
  "3d:B09": "graphics.inspectEditor",
  "2d:B08": "graphics.inspectEditor",
  "2d:B09": "graphics.inspectEditor",
  "3d:B10": "hardware.inspectButtons",
  "3d:B11": "hardware.inspectButtons",
  "3d:B13": "hardware.inspectZippers",
  "3d:B14": "hardware.inspectTrims",
  "3d:B15": "hardware.inspectTrims",
  "3d:B16": "hardware.inspectTrims",
  "3d:B17": "hardware.inspectTrims",
  "3d:A17": "avatar.inspectMeasurements",
  "3d:A18": "avatar.inspectMeasurements",
  "2d:A16": "production.inspectGrading",
  "2d:A17": "production.inspectGrading",
  "2d:B10": "sewing.inspectTopstitch",
  "2d:B11": "sewing.inspectTopstitch",
  "2d:B12": "sewing.inspectPuckering",
  "2d:B13": "sewing.inspectPuckering",
  "3d:A19": "dimensions.show",
  "3d:A20": "dimensions.show",
  "2d:A11": "dimensions.measureTemporary",
  "2d:A12": "dimensions.measureTemporary",
  "2d:B04": "sewing.inspectSeams"
})
const NATIVE_REASONS = Object.freeze({
  "3d:A05": "Select an existing native seam and edit its compiled coupling stiffness, reverse orientation and easing, with revision-guarded Rust Undo/Redo.",
  "2d:B01": "Open the native Sew Editor and modify an existing actual edge-pair constraint, not merely colored stitch guides.",
  "3d:A02": "Native Rust Place/pose-panel changes selected garment placement; no CLO gizmo parity claim.",
  "3d:A03": "Paint a temporary selection of real Rust snapshot mesh vertices in the 3D viewport. The zoom-aware brush highlights selected vertices; Alt removes them and Escape clears them. This is session-only inspection, without topology edits or saved mesh authoring.",
  "3d:A06": "Select two garment edge ranges in the native 3D viewport to author a segment sewing relationship; requires actual valid edges.",
  "3d:A07": "Select two garment edges in the native 3D viewport to sew them with the existing Rust seam operation.",
  "3d:A14": "Native Rust reset restores the 3D initial off-body pose while preserving authored 2D patterns, material and sewing relations.",
  "2d:A01": "Native BoardTransform changes 2D panel placement.",
  "2d:A02": "Native MovePoints/CurvePoint edit existing pattern points.",
  "2d:A04": "Native Polygon creates authored pattern geometry.",
  "2d:A05": "Native InternalLine authors panel interior lines.",
  "2d:A06": "Create a real Rust Primitive rectangle, ellipse or sector panel using numeric dimensions; supported geometry is saved and reversible with native Undo. This is a limited base-shape workflow, not full CLO parametric polygon drafting.",
  "2d:A07": "Trace a selected native straight-edge outer contour into a separate Rust polygon panel with matching relative geometry and fabric. Curved edges and holes are rejected; native Undo/Redo and Save/reopen are supported.",
  "2d:A08": "Place a persistent 6 mm notch at a selected boundary arclength fraction in native Rust. Option-click can remove an exact stored marker. This is a manufacturing marking, not a mesh cutout.",
  "2d:A09": "Apply a persistent 10 mm per-edge cutting guide in native Rust. Option-click clears it; guide does not change stitched contour or triangulated cloth.",
  "2d:A13": "Edit an existing persistent pattern note in material coordinates; the Rust edit supports Undo and saved JSON reopen. This does not generate production POM tables.",
  "2d:A14": "Click a 2D pattern and enter annotation text to create a persistent Rust-authored drafting note with exact material position and native Undo. Alt-click an annotation to delete it.",
  "2d:B02": "Native Rust Sew pairs selected 2D boundary ranges, with undo and edge validation.",
  "2d:B03": "Native Sew joins selected boundary ranges; requires two valid boundary selections.",
  "3d:A01": "Native step changes simulated cloth state; pause stops scheduled steps."
})
const INSPECTION_REASON = 'Related native information is viewable, but this CLO editing operation is not implemented.'
const INSPECTION_REASONS = Object.freeze({
  "3d:B08":"Opens EXO's related editable curved-UV 3D graphics browser/editor. The CLO Transform Graphic command is not implemented.",
  "3d:B09":"Opens EXO's related editable curved-UV 3D graphics browser/editor. The CLO Graphic (3D Pattern) command is not implemented.",
  "2d:B08":"Opens EXO's related editable curved-UV 3D graphics browser/editor. The CLO Transform Graphic (2D) command is not implemented.",
  "2d:B09":"Opens EXO's related editable curved-UV 3D graphics browser/editor. The CLO Graphic (2D Pattern) command is not implemented.",
  "3d:B10":"Opens EXO's related editable button hardware browser/inspector. The CLO Select/Move Button command is not implemented.",
  "3d:B11":"Opens EXO's related editable button hardware browser/inspector. The CLO Button placement command is not implemented.",
  "3d:B13":"Opens EXO's related editable zipper hardware browser/inspector. The CLO Zipper command is not implemented.",
  "3d:B14":"Opens EXO's related editable trims browser/inspector. The CLO Edit Piping command is not implemented.",
  "3d:B15":"Opens EXO's related editable trims browser/inspector. The CLO Piping command is not implemented.",
  "3d:B16":"Opens EXO's related editable trims browser/inspector. The CLO Select Binding command is not implemented.",
  "3d:B17":"Opens EXO's related editable trims browser/inspector. The CLO Binding command is not implemented.",
  "3d:A17":"Opens EXO's related editable avatar measurements browser/inspector. The CLO Edit Measure (Avatar) command is not implemented.",
  "3d:A18":"Opens EXO's related editable avatar measurements browser/inspector. The CLO Basic Tape Measure (Avatar) command is not implemented.",
  "2d:A16":"Opens EXO's related editable production/grading browser/inspector. The CLO Edit Grading command is not implemented.",
  "2d:A17":"Opens EXO's related editable production/grading browser/inspector. The CLO Auto Grading command is not implemented.",
  "2d:B10":"Opens EXO's related editable sewing/topstitch browser/inspector. The CLO Edit Topstitch command is not implemented.",
  "2d:B11":"Opens EXO's related editable sewing/topstitch browser/inspector. The CLO Segment Topstitch command is not implemented.",
  "2d:B12":"Opens EXO's related puckering draft browser/editor. The CLO Edit Puckering solver operation is not implemented.",
  "2d:B13":"Opens EXO's related puckering draft browser/editor. The CLO Segment Puckering solver operation is not implemented.",
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
