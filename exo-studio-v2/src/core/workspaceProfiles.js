// Saved CLO-inspired workspace profiles are independent of the garment
// document. Switching between these must never change cloth, pattern points,
// garment sewing, materials, physics state or undo/redo history.
export const WORKSPACE_PROFILE_KEY = 'garment-studio-workspace-profile-v1'
export const WORKSPACE_VIEW_KEY = 'garment-studio-workspace-windows-v1'
export const VIEWPORT_LAYOUTS = Object.freeze({ split: '3D + 2D', stack: '3D over 2D', '3d': '3D only', '2d': '2D only' })

export const WORKSPACE_PROFILES = Object.freeze({
  drafting: Object.freeze({ name: '2D Pattern + 3D', section: 'Pattern', tab: 'Scene',
    tool: 'point', viewportTool: 'transform', libraryWidth: 196, inspectorWidth: 432,
    objectBrowserHeight: 306, objectBrowserVisible: true, topTabsVisible: true, libraryVisible: true, inspectorVisible: true,
    viewportLayout: 'split', viewportSplit: 44 }),
  sewing: Object.freeze({ name: 'Sewing + Fit', section: 'Sewing', tab: 'Scene',
    tool: 'sew', viewportTool: 'orbit', libraryWidth: 174, inspectorWidth: 434,
    objectBrowserHeight: 280, objectBrowserVisible: true, topTabsVisible: true, libraryVisible: false, inspectorVisible: true,
    viewportLayout: 'split', viewportSplit: 55 }),
  materials: Object.freeze({ name: 'Materials + Rendering', section: 'Fabric', tab: 'Fabric',
    tool: 'select', viewportTool: 'orbit', libraryWidth: 232, inspectorWidth: 460,
    objectBrowserHeight: 355, objectBrowserVisible: true, topTabsVisible: true, libraryVisible: true, inspectorVisible: true,
    viewportLayout: 'split', viewportSplit: 64 }),
  render: Object.freeze({ name: 'Render Studio', section: 'Render', tab: 'Scene',
    tool: 'select', viewportTool: 'orbit', libraryWidth: 174, inspectorWidth: 375,
    objectBrowserHeight: 245, objectBrowserVisible: false, topTabsVisible: true, libraryVisible: false, inspectorVisible: true,
    viewportLayout: '3d', viewportSplit: 65 }),
})

const clamp = (number, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(number)))
const SECTIONS = new Set(['Pattern', 'Sewing', 'Fabric', 'Avatar', 'Fit', 'Production', 'Render'])
const TABS = new Set(['Scene', 'Fabric', 'Graphic', 'Button', 'Buttonhole', 'Topstitch', 'Puckering', 'Trim', 'Grading', 'POM'])
const TOOLS = new Set(['select', 'point', 'split', 'curve', 'internal', 'pin', 'notch', 'sew', 'fastener', 'measure'])
const VIEWPORT_TOOLS = new Set(['transform', 'orbit', 'move', 'rotate', 'hand'])
const VIEWPORT_LAYOUT_IDS = new Set(Object.keys(VIEWPORT_LAYOUTS))
const pick = (value, allowed, fallback) => allowed.has(value) ? value : fallback
const size = (value, minimum, maximum, fallback) => {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return fallback
  return clamp(value, minimum, maximum)
}

export function normalizeWorkspaceProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid workspace profile')
  return {
    name: typeof value.name === 'string' ? value.name.slice(0, 80) : 'Custom workspace',
    section: pick(value.section, SECTIONS, 'Pattern'),
    tab: pick(value.tab, TABS, 'Scene'),
    tool: pick(value.tool, TOOLS, 'select'),
    viewportTool: pick(value.viewportTool, VIEWPORT_TOOLS, 'transform'),
    libraryWidth: size(value.libraryWidth, 160, 350, 232),
    inspectorWidth: size(value.inspectorWidth, 295, 540, 392),
    objectBrowserHeight: size(value.objectBrowserHeight, 230, 650, 390),
    objectBrowserVisible: value.objectBrowserVisible !== false,
    topTabsVisible: value.topTabsVisible !== false,
    libraryVisible: value.libraryVisible !== false,
    inspectorVisible: value.inspectorVisible !== false,
    viewportLayout: pick(value.viewportLayout, VIEWPORT_LAYOUT_IDS, 'split'),
    viewportSplit: size(value.viewportSplit, 20, 80, 50),
  }
}
