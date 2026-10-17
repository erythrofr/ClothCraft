import React from 'react'
import toolbarIconManifest from '../assets/toolbar-icons/manifest.json'

// Standalone SVGs are generated from Garment Studio's original vector artwork
// and kept in a versionable asset pack. Preserve the inline React geometry as
// the fallback for non-toolbar use and dynamic currentColor variants.
const toolbarIconIds = new Set(toolbarIconManifest.files.map(file => file.id))
const toolbarSvgUrls = import.meta.glob('../assets/toolbar-icons/*.svg', { eager:true, query:'?url', import:'default' })
const svgUrlFor = (id) => toolbarSvgUrls[`../assets/toolbar-icons/${id}.svg`]

// Original vector icon system drawn for Garment Studio. Tool-specific geometry
// follows the visual conventions of garment CAD: outlines of pattern pieces,
// edit nodes, paired stitch lines, fabric folds, sewing hardware and 3D axes.
// It is a functional approximation, not copied CLO artwork.
const Pattern = ({ points = false, children }) => <>
  <path d="M7 4.5 17 4 20 17.5 16.5 20H5L4 9Z"/>
  {points && <><rect x="5.4" y="3" width="3" height="3" rx=".3" fill="currentColor" stroke="none"/><rect x="15.5" y="2.5" width="3" height="3" rx=".3" fill="currentColor" stroke="none"/><rect x="18.5" y="16.5" width="3" height="3" rx=".3" fill="currentColor" stroke="none"/><rect x="3.5" y="8" width="3" height="3" rx=".3" fill="currentColor" stroke="none"/></>}
  {children}
</>
const MiniShirt = () => <path d="m8.1 3-2.4 2L2.2 8.9l3.5 3.4 2-2v10.1h8.6V10.3l2 2 3.5-3.4L18.3 5l-2.4-2c-1.7 2.2-6.1 2.2-7.8 0Z"/>
const MiniTrousers = () => <path d="M6 3h12l1.2 17.5h-5.3L12 11.3l-1.9 9.2H4.8Z"/>
const Dot = ({ x, y }) => <circle cx={x} cy={y} r="1.4" fill="currentColor" stroke="none"/>
const Cursor = () => <path d="m4 2.6 1.2 16.2 3.7-5.1 4.2 7.2 2.7-1.6-4.1-7.1 6.3-.6Z"/>
// Distinct functional CAD silhouettes, drawn from first principles. The
// beveled-corner polygon, drafting triangles, and sewing machine use the same
// visual grammar as professional garment CAD without bundling CLO artwork.
const PolygonTool = () => <>
  {/* Five straight edges, with the upper-right corner visibly CUT OFF.
      No internal crease: this is a polygon, not a folded document symbol. */}
  <path d="M3.6 3.7h10.1l6.7 6.7v10H3.6Z" fill="currentColor" fillOpacity=".25" strokeWidth="1.55"/>
</>
const TriangleTool = () => <>
  <path d="M4 19.6H19.7V4.2Z" fill="#39d5ec" stroke="#75e5f6" strokeWidth=".8"/>
  <path d="M4 19.6h15.7V4.2" stroke="#deffff" strokeOpacity=".35" strokeWidth=".7"/>
</>
const TriangleNodes = () => <>
  <path d="M4.2 18.8 18.7 17.2 14 5Z" strokeWidth="1.15"/>
  <circle cx="4.2" cy="18.8" r="1.9" fill="currentColor" stroke="none"/>
  <circle cx="18.7" cy="17.2" r="1.9" fill="currentColor" stroke="none"/>
  <circle cx="14" cy="5" r="1.9" fill="currentColor" stroke="none"/>
</>
const SewingMachine = () => <>
  {/* The overhanging arm, feed plate, needle and top spool read as a sewing
      machine even at the tool-rail's small 20-pixel display size. */}
  <path d="M3 19h18v2H3Z" fill="currentColor" fillOpacity=".32" strokeWidth="1.2"/>
  <path d="M4.5 7.7c.1-2 1.2-3 3.3-3h8.5c2.4 0 4 1.6 4 4v7.1h-4.1v-3.1H9.6v4.2H4.5Z" fill="currentColor" fillOpacity=".20" strokeWidth="1.35"/>
  <path d="M8.4 4.7V2.5h5.6v2.2M11.2 12.7v6.2M9.7 18h3.1M15.5 12.7v4.3M4.5 16.9h5" strokeWidth="1.15"/>
  <circle cx="18" cy="8.6" r="1.35" fill="var(--icon-fill,#252b32)" strokeWidth="1"/>
  <path d="M11.2 15.2h3.2" stroke="#45cfe8" strokeWidth="1.25"/>
</>
// The following tiny silhouette primitives deliberately prioritize readable
// shapes at 18–20px; a small icon should not need a tooltip to distinguish a
// sewing connection, an edge edit, or an arrangement operation.
const SewPair = () => <>
  <path d="M3.6 4.5 9.1 3l1.2 18-6.7-2.5ZM14.8 3l5.6 1.5v14L13.7 21Z" fill="currentColor" fillOpacity=".09" strokeWidth="1.2"/>
  <path d="M9.6 5.5 14.5 5.5M9.9 10.1h4.1m-3.7 4.5h3.4m-3.1 4h2.8" stroke="#55d8e9" strokeWidth="1.15" strokeDasharray="1.2 1.2"/>
  <circle cx="9.6" cy="5.5" r="1.1" fill="currentColor" stroke="none"/>
  <circle cx="14.5" cy="5.5" r="1.1" fill="currentColor" stroke="none"/>
</>
const CurvedEdge = () => <>
  <path d="M4 19C4 6 18 19 20 5" strokeWidth="1.85"/>
  <path d="M4 19 8.2 10M20 5l-6.3 8" strokeWidth=".85" strokeDasharray="2 1.7" strokeOpacity=".7"/>
  <circle cx="4" cy="19" r="1.7" fill="currentColor" stroke="none"/>
  <circle cx="20" cy="5" r="1.7" fill="currentColor" stroke="none"/>
  <rect x="7.1" y="8.9" width="2.5" height="2.5" rx=".3" fill="currentColor" stroke="none"/>
  <rect x="12.6" y="11.7" width="2.5" height="2.5" rx=".3" fill="currentColor" stroke="none"/>
</>

function Artwork({ id }) {
  switch (id) {
    case 'sewing-machine': case 'sew-machine': case 'sewing-inspector':
      return <SewingMachine/>
    case 'polygon': case 'polygon-tool': case 'create-polygon':
      return <PolygonTool/>
    case 'triangle': case 'draft-triangle':
      return <TriangleTool/>
    case 'triangle-nodes': case 'edit-polygon':
      return <TriangleNodes/>
    case 'select-3d': case 'transform':
      return <><path d="m5 8 7-3.8L19 8v8l-7 4-7-4Z" fill="currentColor" fillOpacity=".10"/><path d="m5 8 7 4 7-4M12 12v8" strokeOpacity=".65"/><path d="M12 12V1.5m0 0-2.1 3m2.1-3 2.1 3" stroke="#48d3e8" strokeWidth="1.55"/><path d="M12 12h10m0 0-3-2m3 2-3 2" stroke="#ed8b65" strokeWidth="1.5"/><path d="M12 12 4 19m0 0 3.6-.5M4 19l1-3.3" stroke="#9bc7f1" strokeWidth="1.4"/><circle cx="12" cy="12" r="1.55" fill="currentColor"/></>
    case 'move-3d': case 'move':
      return <><path d="m4.5 6.5 7.5-4 7.5 4v9L12 20l-7.5-4.5Z" strokeOpacity=".42"/><path d="M12 12V1.5m0 0-2.5 3m2.5-3 2.5 3" stroke="#4ed8ef" strokeWidth="1.7"/><path d="M12 12h10m0 0-3-2.5m3 2.5-3 2.5" stroke="#ed8b65" strokeWidth="1.7"/><path d="M12 12 4 20m0 0 3.5-.7M4 20l.7-3.5" stroke="#a2c8fb" strokeWidth="1.5"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/></>
    case 'rotate-3d': case 'rotate':
      return <><ellipse cx="12" cy="12" rx="9.5" ry="4.8" transform="rotate(-35 12 12)" stroke="#6ac9f2" strokeWidth="1.35"/><ellipse cx="12" cy="12" rx="9.5" ry="4.8" transform="rotate(35 12 12)" stroke="#ed9977" strokeWidth="1.35"/><circle cx="12" cy="12" r="6.1" strokeOpacity=".6" strokeDasharray="2.4 1.8"/><path d="m12 7 4.2 2.4v5.2L12 17l-4.2-2.4V9.4Z" fill="currentColor" fillOpacity=".13"/><path d="m19.6 4.9 2.1 3.2-3.8-.2M4.4 19.1l-2.1-3.2 3.8.2" strokeWidth="1.35"/></>
    case 'hand':
      return <><path d="M8.4 11.4V6.2c0-1.7 2.3-1.8 2.3 0v4.3-6.4c0-1.8 2.5-1.8 2.5 0v6.4-5.3c0-1.8 2.5-1.8 2.5 0v5.3-3.2c0-1.7 2.4-1.7 2.4 0v7.3c0 4-2.9 6.8-6.9 6.8-2.9 0-4.4-1.2-5.6-3.6l-2.9-4.2c-1-1.7 1.2-3.1 2.6-1.7L8.4 14Z"/></>
    case 'surface': case 'analysis':
      return <><MiniShirt/><path d="M7.8 10.2 10 8.2l2.3 2.2 2.1-2.1 2 2.5-2.2 2.2 1.3 3.3H8.2l1.3-3.1Z" fill="#58c9de" fillOpacity=".43" strokeWidth=".8"/><path d="m8.4 15.2 2.1-2.3 2 1.6 2.2-2.4 1.4 2.2" stroke="#efae75" strokeWidth="1.15"/><path d="M9 18h6" strokeDasharray="1 1"/></>
    case 'wireframe': case 'grid':
      return <><path d="m12 2.5 8.6 5v9L12 21.5l-8.6-5v-9Z"/><path d="m3.4 7.5 17.2 9M20.6 7.5 3.4 16.5M12 2.5v19M7.7 5v14M16.3 5v14M3.4 12h17.2" strokeWidth=".75"/></>
    case 'seam-links': case 'seams':
      return <><path d="M3.5 4.5 9.5 3l1.2 18-7.2-2.5ZM14.5 3 20.5 4.5v14L13.3 21Z" fill="currentColor" fillOpacity=".09"/><path d="M10.8 6.5 13.4 6.5M11 10.5l2.1 0m-1.9 4 1.8 0m-1.6 4 1.3 0" stroke="#51d5ee" strokeWidth="1.35" strokeDasharray="1.1 1.1"/><circle cx="9.9" cy="6.5" r="1" fill="currentColor"/><circle cx="14.1" cy="6.5" r="1" fill="currentColor"/><path d="M9.9 6.5h4.2M10.2 15h3.6" strokeWidth=".9" strokeDasharray="1.3 1.3"/></>
    case 'select-2d': case 'select':
      return <><TriangleTool/><path d="m1.9 3.5 1 9.4 2.5-3.1 2 3.5 1.4-.8-2.1-3.4 4.1-.6Z" fill="var(--icon-fill,#252b32)" strokeWidth=".95"/></>
    case 'points': case 'point':
      return <TriangleNodes/>
    case 'split':
      return <><path d="M3.3 6.2 20.5 4.4v13.7L3.3 20Z" strokeOpacity=".64"/><path d="M3.3 6.2 20.5 4.4" strokeWidth="1.6"/><rect x="10.1" y="3.8" width="3.1" height="3.1" rx=".45" fill="currentColor" stroke="none"/><path d="M11.65 1.4v8.2M7.6 5.5h8.1" strokeWidth="1.1"/><path d="m16.8 12 3.4 0m-1.7-1.7v3.4" strokeWidth="1.1"/></>
    case 'curve':
      return <CurvedEdge/>
    case 'internal':
      return <><path d="M3.2 4.2h17.6v15.6H3.2Z" strokeOpacity=".5"/><path d="M6 17.5 12 6l6 11.5" strokeWidth="1.45"/><path d="M12 6v11.5" strokeWidth=".95" strokeDasharray="1.8 1.6"/><circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"/><path d="m9.8 14.7 2.2 2.8 2.2-2.8" strokeWidth="1.05"/></>
    case 'notch':
      return <><path d="M3.2 5.5h7.1L12 9.3l1.7-3.8h7.1v13.8H3.2Z" fill="currentColor" fillOpacity=".09" strokeWidth="1.35"/><path d="m10.3 5.5 1.7 3.8 1.7-3.8" strokeWidth="1.75"/><path d="M12 1.6v4" strokeWidth=".95" strokeDasharray="1 1.1"/><circle cx="12" cy="9.3" r="1" fill="currentColor" stroke="none"/></>
    case 'measure':
      return <><path d="M3.1 16.9 16.2 3.8l4.6 4.6L7.7 21.5Z" fill="currentColor" fillOpacity=".10" strokeWidth="1.25"/><path d="m14.5 5.5 3.4 3.4M12.1 7.9l2.2 2.2M9.7 10.3l3.4 3.4M7.3 12.7l2.2 2.2M4.9 15.1l3.4 3.4" strokeWidth="1.05"/><circle cx="6.5" cy="18.1" r=".75" fill="currentColor" stroke="none"/></>
    case 'pin':
      return <><circle cx="12" cy="5.6" r="3.2" fill="currentColor" fillOpacity=".16" strokeWidth="1.25"/><path d="M12 8.8v12.7l-1.2-3.3 1.2 3.3 1.2-3.3" strokeWidth="1.35"/><path d="M9.7 5.6h4.6" strokeWidth=".85"/><path d="M5 13.5h4M15 13.5h4" strokeDasharray="1.4 1.2" strokeOpacity=".65"/></>
    case 'sew':
      return <SewingMachine/>
    case 'sew-pair': case 'free-sew':
      return <SewPair/>
    case 'fastener':
      return <><path d="M3.3 4.8h8.1v14.4H3.3ZM12.6 4.8h8.1v14.4h-8.1Z" strokeOpacity=".65"/><circle cx="9.2" cy="12" r="2.6" fill="currentColor" fillOpacity=".2"/><circle cx="9.2" cy="12" r=".8" fill="currentColor" stroke="none"/><path d="M12 12h4.5m-2-2 2 2-2 2" strokeWidth="1.2"/><path d="M17 8.5v7" strokeDasharray="1.3 1.2"/></>
    case 'fabric':
      return <><path d="M4.2 7.2 14.5 4v13.5L4.2 21Z" fill="currentColor" fillOpacity=".13"/><ellipse cx="15.5" cy="10.5" rx="5.1" ry="6.4"/><ellipse cx="15.5" cy="10.5" rx="2.1" ry="2.8" strokeWidth="1.35"/><path d="M4.2 7.2V21m.5-10 6.5-2.1m-6.5 6 6.5-2.1" strokeWidth="1"/><path d="M6 19.7 13 17" strokeWidth="1.3"/></>
    case 'graphics':
      return <><MiniShirt/><rect x="8.2" y="9.7" width="7.6" height="7.5" rx=".5" fill="currentColor" fillOpacity=".13" strokeWidth="1"/><path d="m9.1 16 2-2.6 1.5 1.5 1.6-2.3 1 1.3" strokeWidth="1.15"/><circle cx="13.8" cy="11.7" r=".85" fill="currentColor" stroke="none"/></>
    case 'buttons':
      return <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5.8" strokeDasharray="1 1"/><circle cx="9.7" cy="9.7" r="1" fill="currentColor"/><circle cx="14.3" cy="9.7" r="1" fill="currentColor"/><circle cx="9.7" cy="14.3" r="1" fill="currentColor"/><circle cx="14.3" cy="14.3" r="1" fill="currentColor"/></>
    case 'buttonholes':
      return <><rect x="3" y="8.5" width="18" height="7" rx="3.5" strokeWidth="1.3"/><path d="M6 12h12" strokeWidth="1.6"/><path d="M5.2 8.8v6.4M7.3 8.5v7m2.1-7v7m2.1-7v7m2.1-7v7m2.1-7v7m2.1-7v7m2.1-6.7v6.4" strokeWidth=".75" strokeDasharray="1.2 1.1"/><path d="M4.5 18.5h15" strokeWidth=".8" strokeDasharray="2 1.6"/></>
    case 'topstitch':
      return <><path d="M4 3.8h16v16.4H4Z" fill="currentColor" fillOpacity=".07"/><path d="M7.3 6.7v10.6h9.4V6.7" strokeWidth="1.45" strokeDasharray="1.5 1.25"/><path d="M5.7 6.7v11.1m12.6-11.1v11.1" strokeWidth=".65" strokeOpacity=".5"/><path d="m9.3 10 2.7 2 2.7-2m-5.4 4 2.7 2 2.7-2" strokeWidth=".75"/></>
    case 'puckering':
      return <><path d="M2.7 6.6q2.7-5.3 5.4 0t5.4 0t5.4 0t2.4 0M2.7 17.4q2.7-5.3 5.4 0t5.4 0t5.4 0t2.4 0" strokeWidth="1.65"/><path d="M3.4 12h17.2" strokeDasharray="1.2 1.3" strokeWidth="1.15"/><path d="m7.2 8.8-1 6.4m6-6.4 1 6.4m4.5-6.4-1 6.4" strokeWidth=".75" strokeOpacity=".7"/></>
    case 'trim':
      return <><path d="M5 2.5h14v19H5Z" strokeOpacity=".55"/><path d="M11 4v16m2-16v16" strokeWidth="1.1" strokeDasharray="1.4 1.2"/><path d="m8.5 8 3.5 2 3.5-2m-7 7 3.5-2 3.5 2" strokeWidth="1.2"/><rect x="9.1" y="4" width="5.8" height="4.2" rx=".7" fill="currentColor" fillOpacity=".25"/><path d="M12 8.2v4.2" strokeWidth="1.6"/></>
    case 'grading':
      return <><path d="M3.4 8.8 13 2.8l7.7 14.8-10 4.1Z" strokeOpacity=".38"/><path d="M5.2 8.2 13.2 4.5l5.7 13.3-9.2 2.6Z" strokeDasharray="1.8 1.5" strokeWidth="1.05"/><path d="M7.1 7.4 14 6.2l3.3 11.9-8 1.4Z" strokeWidth="1.4"/><path d="M18.2 5.2h4.2m-2.1-2.1v4.2M2.2 18.4h4.2" strokeWidth=".9"/></>
    case 'pom':
      return <><MiniShirt/><path d="M7.5 13.5h9" strokeWidth="1.5"/><path d="m7.5 13.5 2.3-1.8m-2.3 1.8 2.3 1.8M16.5 13.5l-2.3-1.8m2.3 1.8-2.3 1.8" strokeWidth="1.15"/><path d="M7.5 10.5v6m9-6v6" strokeWidth=".85" strokeDasharray="1.4 1.1"/></>
    case 'scene':
      return <><path d="M3 3h18v18H3Z" strokeOpacity=".5"/><path d="M7 5.7h13M7 12h13M7 18.3h13" strokeOpacity=".65"/><path d="m4.7 5.7 1.1 1.2 1.1-1.2m-2.2 6.3 1.1 1.2 1.1-1.2" strokeWidth=".9"/><path d="m10 7.7 2.5-1.4 2.5 1.4v2.8l-2.5 1.3-2.5-1.3Z" fill="currentColor" fillOpacity=".14"/><path d="m10 14.2 2.5-1.4 2.5 1.4v2.8l-2.5 1.3-2.5-1.3Z" fill="currentColor" fillOpacity=".14"/></>
    case 'material':
      return <><path d="M3.2 4.2h11.4l5.9 5.9v9.7H3.2Z" fill="currentColor" fillOpacity=".08"/><path d="m14.6 4.2 5.9 5.9h-5.9Z" fill="currentColor" fillOpacity=".16"/><path d="M6.1 11h8.4M6.1 14h8.4M6.1 17h8.4" strokeWidth=".9"/><circle cx="9" cy="11" r="1.45" fill="var(--icon-fill,#27292d)"/><circle cx="12" cy="14" r="1.45" fill="var(--icon-fill,#27292d)"/><circle cx="8" cy="17" r="1.45" fill="var(--icon-fill,#27292d)"/></>
    case 'pattern-properties':
      return <><path d="M4.2 3.2h11l4.5 4.5v13.1H4.2Z"/><path d="M15.2 3.2v4.5h4.5M7.3 11h9.2M7.3 14.1h7M7.3 17.2h5" strokeWidth="1"/><circle cx="17.9" cy="17.5" r="2" fill="var(--icon-fill,#27292f)" strokeWidth="1"/></>
    case 'fabric-roll':
      return <><path d="M4.4 6.5 15 4.1v12.4L4.4 19Z" fill="currentColor" fillOpacity=".22"/><ellipse cx="15" cy="10.4" rx="5" ry="6.3"/><ellipse cx="15" cy="10.4" rx="2.15" ry="2.7"/><path d="M4.4 6.5v12.4M5 9l7.8-2" strokeWidth="1"/></>
    case 'sewing-stitch':
      return <><path d="M3.2 6 8.4 4l1.3 16-6.5-2ZM15.5 4l5.3 2v12l-6.5 2Z" fill="currentColor" fillOpacity=".08"/><path d="m9 8 3 2 3-2m-6 5 3 2 3-2m-6 5 3 2 3-2" strokeWidth="1.45"/><path d="M12 3v18" strokeWidth=".9" strokeDasharray="1 1.5"/></>
    case 'avatar':
      return <><circle cx="12" cy="5" r="2.5"/><path d="M8 9.5 6 13l-1 5m11-8.5 2 3.5 1 5M8.5 9h7l1 6.2-2.1 1.1V22h-2.1v-5H11.6v5H9.5v-5.7l-2.1-1.1Z"/></>
    case 'render':
      return <><path d="M4 8H2v12h20V8h-4l-2.4-3.5H8Z"/><circle cx="12" cy="13.8" r="4.2"/><circle cx="12" cy="13.8" r="1.2" fill="currentColor"/><path d="M8.5 2.5H15" strokeWidth=".9"/></>
    case 'duplicate-piece':
      return <><path d="M4 6h11l3 10H8Z"/><path d="M7.7 3H18l3 11" strokeDasharray="1.8 1.5"/><path d="M17.5 18.5h6m-3-3v6" strokeWidth="1.5"/></>
    case 'panel':
      return <><rect x="2.5" y="3" width="19" height="18" rx="1"/><path d="M15 3v18M17.2 7h2M17.2 10h2M17.2 13h2" strokeWidth=".9"/></>
    case 'simulation-modes':
      return <><path d="M12 2v11M8.5 9.8 12 13.5l3.5-3.7"/><path d="M4 17h16l-3.5 4h-9Z" strokeWidth="1.4"/></>
    case 'settings':
      return <><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="9" cy="6" r="2" fill="var(--icon-fill,#262729)"/><circle cx="16" cy="12" r="2" fill="var(--icon-fill,#262729)"/><circle cx="7" cy="18" r="2" fill="var(--icon-fill,#262729)"/></>
    case 'fit':
      return <><MiniShirt/><path d="M12 7.5v10M9 12.5l3-3 3 3m-5 4h4" strokeWidth="1.4"/><path d="M3 18h3m12 0h3" strokeDasharray="1 1"/></>
    case 'simulate':
      return <><path d="M5 4h14L16 16l-4 5-4-5Z"/><path d="M12 2v15M8.5 13.5 12 17l3.5-3.5"/><path d="M8 6h8" strokeDasharray="1.5 1"/></>
    case 'reset':
      return <><MiniShirt/><path d="M3 12a9 9 0 0 1 15.5-5.5M18.5 6.5h-5m5 0V2m2.4 10a9 9 0 0 1-15.5 5.5M5.4 17.5h5m-5 0V22" strokeWidth="1.2"/></>
    case 'camera':
      return <><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" strokeWidth="1.5"/><path d="m9 9 3-1.6L15 9v5l-3 1.6L9 14Z" fill="currentColor" fillOpacity=".16"/><path d="m9 9 3 1.7L15 9m-3 1.7v4.9" strokeWidth=".85"/></>
    case 'mirror':
      return <><path d="M12 2v20" strokeDasharray="2 1.5"/><path d="m9 5-6 2v11l6 2ZM15 5l6 2v11l-6 2Z"/><path d="m10 12-2-2m2 2-2 2M14 12l2-2m-2 2 2 2"/></>
    case 'export':
      return <><path d="M4 15v6h16v-6M12 2v14m-4-4 4 4 4-4"/><path d="M7 6h10" strokeDasharray="1.5 2"/></>
    case 'seam-weld':
      return <><path d="M3 7h7v11H3ZM14 7h7v11h-7Z"/><path d="M10 9l2 2 2-2m-4 6 2-2 2 2" strokeWidth="1.5"/><path d="M12 5v14" strokeDasharray="1 1.5"/></>
    case 'add-piece':
      return <><Pattern/><path d="M17 2v9m-4.5-4.5h9" strokeWidth="2"/></>
    case 'delete-piece':
      return <><Pattern/><path d="M7 10 17 19M17 10 7 19" strokeWidth="1.8"/></>
    case 'grid-2d':
      return <><path d="M3 3h18v18H3Z"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18" strokeWidth=".85"/></>
    case 'pressure':
      return <><MiniShirt/><path d="M9 9q-2 3 0 6m3-7q-2 4 0 9m3-8q-2 3 0 6" strokeWidth="1.1"/></>
    case 'orbit':
      return <><path d="m8 8 4-3 4 3-4 3Z M8 8v7l4 3 4-3V8"/><ellipse cx="12" cy="12" rx="10" ry="5.2" transform="rotate(-25 12 12)" strokeDasharray="3 2"/><path d="m19 7 2 1-1.1 2.5" strokeWidth="1.4"/></>
    // CLO reference-only operations receive their own original glyphs. These
    // indicate the operation's identity, not support for an unavailable action.
    case 'fold-arrangement': case 'fold-garment':
      return <><path d="M3 5h12l6 7-9 8H3Z" fill="currentColor" fillOpacity=".08"/><path d="M15 5 12 12l9 0M12 12l0 8" strokeDasharray={id==='fold-arrangement'?'2 1':undefined}/><path d="m6 9 3 3-3 3"/></>
    case 'redrape':
      return <><MiniShirt/><path d="M3 19a9 9 0 0 0 16 0m0 0-4-.5m4 .5-1-4" strokeWidth="1.5"/><path d="M9 11q3 3 6 0" strokeDasharray="2 1"/></>
    case 'motion':
      return <><circle cx="10" cy="5" r="2"/><path d="m9 8-3 6 4 3-2 5m2-9 6 2 4 5m-11-8 6-3"/><path d="m18 3 4 4-4 4" strokeWidth="1.5"/></>
    case 'pen-3d':
      return <><path d="m3 9 9-5 9 5v9l-9 4-9-4Z" strokeOpacity=".45"/><path d="m5 17 11-11 3 3-11 11-4 1Z" fill="currentColor" fillOpacity=".18"/><path d="m4 21 4-1"/></>
    case 'graphic-transform':
      return <><rect x="6" y="6" width="12" height="12" rx="1"/><path d="m9 15 2-3 2 2 2-3"/><path d="M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5"/></>
    case 'button-move':
      return <><circle cx="10" cy="12" r="6"/><circle cx="8" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="14" r="1" fill="currentColor"/><path d="M17 4h5m-2.5-2.5v5M17 19h5m-2.5-2.5v5"/></>
    case 'zipper':
      return <><path d="M6 2v20m12-20v20M9 3v13m6-13v13"/><path d="M9 5h6M9 8h6M9 11h6M9 14h6" strokeDasharray="1.5 1"/><rect x="10" y="15" width="4" height="5" rx="1" fill="currentColor" fillOpacity=".35"/></>
    case 'piping':
      return <><path d="M3 5c9-4 9 18 18 14" strokeWidth="4" strokeOpacity=".3"/><path d="M3 5c9-4 9 18 18 14" strokeWidth="1.6"/><path d="M5 3 2 7m19 10-3 4"/></>
    case 'binding':
      return <><path d="M3 4h18v16H3Z" strokeOpacity=".35"/><path d="M3 4h5v16H3m13-16h5v16h-5" fill="currentColor" fillOpacity=".2"/><path d="M8 4v16m8-16v16" strokeDasharray="2 2"/></>
    case 'press': case 'steam':
      return <><path d="M4 16q8-13 16 0v3H4Z"/><path d="M6 21h12"/><path d="M8 3q-3 3 0 6m5-6q-3 3 0 6m5-6q-3 3 0 6" strokeDasharray={id==='steam'?'2 1':undefined}/></>
    case 'fullness':
      return <><path d="M3 5h18v14H3Z"/><path d="M8 6v12m8-12v12" strokeDasharray="2 1"/><path d="m5 12 3-3 3 3m2 0 3 3 3-3"/></>
    case 'trace':
      return <><Pattern/><path d="m8 7 9-1 2 10-7 2" strokeDasharray="2 2" strokeWidth="2"/></>
    case 'seam-allowance':
      return <><Pattern/><path d="M2 7 5 2l14-1 4 18-5 4H2" strokeDasharray="2 1.5" strokeWidth="1"/></>
    case 'walk-pattern':
      return <><path d="M3 19q2-15 15-15"/><path d="M6 19q2-12 12-12" strokeDasharray="2 2"/><path d="m14 3 4 1-1 4M5 15l-2 4 4 1"/></>
    case 'seam-taping':
      return <><path d="M3 3h8v18H3Zm10 0h8v18h-8Z" strokeOpacity=".55"/><path d="M11 3h2v18h-2Z" fill="currentColor" fillOpacity=".45"/><path d="M12 4v16" strokeDasharray="1 2"/></>
    case 'sublayer':
      return <><path d="m3 7 9-5 9 5-9 5Zm0 5 9 5 9-5M3 17l9 5 9-5"/><path d="M12 12v5" strokeDasharray="1 1"/></>
    case 'fill-pattern':
      return <><Pattern/><path d="m8 13 4 4 9-10" strokeWidth="2"/><path d="M6 8h9" strokeDasharray="1 2"/></>
    default:
      return <><Cursor/></>
  }
}

export default function CadToolIcon({ id, size = 18, className = '', strokeWidth = 1.3 }) {
  if (toolbarIconIds.has(id) && svgUrlFor(id)) {
    return <img className={`cad-tool-icon ${className}`} src={svgUrlFor(id)} alt="" width={size} height={size} data-icon-id={id} data-icon-format="svg" aria-hidden="true" draggable="false"/>
  }
  return <svg className={`cad-tool-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <Artwork id={id}/>
  </svg>
}
