/**
 * Explicit native V2 routing for macOS/CLO menu actions.
 * Never allow a garment-writing V1 menu command to silently modify the
 * shadow React project while the visible document lives in Rust.
 * UI/workspace navigation is intentionally handled by App's shared switch.
 */
const NATIVE_COMMANDS = Object.freeze({
  'file.new':'file:new',
  'file.open':'file:open',
  'file.save':'save',
  'file.export':'export',
  'edit.undo':'undo',
  'edit.redo':'redo',
  'edit.delete':'delete-selected',
  '3d.simulate':'toggle-sim',
  '3d.reset':'reset',
  '3d.orbit':'mode:edit',
  '3d.transform':'mode:move3d',
  '3d.move':'mode:move3d',
  '3d.rotate':'mode:rotate3d',
  '3d.hand':'mode:stretch3d',
  '3d.camera':'fit-camera',
  '3d.seams':'seams',
  '2d.mirror':'mirror-selected',
  '2d.add':'mode:pen',
})

const NATIVE_2D_TOOLS = Object.freeze({
  '2d.select':{tool:'select',section:'Pattern'},
  '2d.points':{tool:'point',section:'Pattern'},
  '2d.split':{tool:'split',section:'Pattern'},
  '2d.curve':{tool:'curve',section:'Pattern'},
  '2d.internal':{tool:'internal',section:'Sewing'},
  '2d.notch':{tool:'notch',section:'Pattern'},
  '2d.allowance':{tool:'allowance',section:'Pattern'},
  '2d.measure':{tool:'measure',section:'Pattern'},
  'sewing.sew':{tool:'sew',section:'Sewing'},
})

const UNSUPPORTED = Object.freeze({
  '2d.pin':'Persistent physical cloth pins are not available in native V2 yet; temporary Fabric Hand grabbing is supported.',
  'sewing.fastener':'Native button and snap attachment is not implemented yet. The draft asset browser does not create a physical fastener.',
  'display.grid':'The native 2D board grid is controlled within the native board; the legacy grid toggle does not affect it.',
  'materials.add':'Adding a new material through the legacy palette is not a native Rust edit. Select an existing native fabric instead.',
  'materials.graphic':'Legacy graphics upload does not attach imagery to native Rust cloth yet.',
  'avatar.import':'Importing the avatar through the legacy picker does not change the native Rust avatar. Use a supported native fixture.',
})

export function getCloNativeMenuRoute(action) {
  if (Object.hasOwn(NATIVE_COMMANDS,action)) return {type:'command',command:NATIVE_COMMANDS[action]}
  if (Object.hasOwn(NATIVE_2D_TOOLS,action)) return {type:'tool',...NATIVE_2D_TOOLS[action]}
  if (Object.hasOwn(UNSUPPORTED,action)) return {type:'unsupported',reason:UNSUPPORTED[action]}
  if (action==='3d.fit') return {type:'fit'}
  if (action==='display.surface'||action==='display.strain') return {type:'analysis',value:action.split('.')[1]}
  if (action==='display.wireframe') return {type:'command',command:'wireframe'}
  return null
}
