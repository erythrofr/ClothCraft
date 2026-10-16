import React, { useState } from 'react'
import CadToolIcon from './CadToolIcon.jsx'
import './ObjectBrowserHierarchy.css'
import {
  ChevronDown, ChevronRight, CircleDot, Cloud, Folder, Grid2X2,
  Image, Layers3, List, MoreHorizontal, Palette, Search, Shirt, Eye, EyeOff, Lock, Unlock,
  SlidersHorizontal, Sparkles, Star, StretchHorizontal, UserRound,
} from 'lucide-react'

/** CLO's spatial organization, not a claim that unfinished engines already work. */
export { CLO_MENUS } from '../core/cloMenus.js'

export const OBJECT_TABS = [
  { id: 'Fabric', icon: Shirt },
  { id: 'Graphic', icon: Image }, { id: 'Button', icon: CircleDot },
  { id: 'Buttonhole', icon: StretchHorizontal }, { id: 'Topstitch', icon: MoreHorizontal },
  { id: 'Puckering', icon: SlidersHorizontal },
  { id: 'Grading', icon: Grid2X2 }, { id: 'POM', icon: List },
]
const OBJECT_TAB_ART = {
  Scene:'scene', Fabric:'fabric', Graphic:'graphics', Button:'buttons',
  Buttonhole:'buttonholes', Topstitch:'topstitch', Puckering:'puckering',
  Trim:'trim', Grading:'grading', POM:'pom',
}
const OBJECT_CATEGORY_ART = {
  '2D Pattern':'pattern-properties',
  'Sewing':'sew',
  '3D Form':'select-3d',
  'Material':'fabric',
  'Environment':'render',
}

export const OBJECT_HIERARCHY = [
  {title:'2D Pattern', children:[['Pattern Pieces','Pattern','Scene'],['Internal Lines','Pattern','Scene'],['Grading & Measurements','Production','POM']]},
  {title:'Sewing', children:[['Sewing Relationships','Sewing','Scene'],['Buttons','Sewing','Button'],['Buttonholes','Sewing','Buttonhole'],['Topstitch','Sewing','Topstitch']]},
  {title:'3D Form', children:[['Arrangement','Pattern','Scene'],['Avatar','Avatar','Scene'],['Simulation & Fit','Fit','Scene']]},
  {title:'Material', children:[['Fabric Editor','Fabric','Fabric'],['Graphics & Texture','Fabric','Graphic'],['Trims','Sewing','Trim']]},
  {title:'Environment', children:[['Studio Lighting','Render','Scene'],['Render Settings','Render','Scene']]},
]

export function BulletListIcon(){return <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round"><circle cx="3.5" cy="4.3" r="1.25" fill="currentColor" stroke="none"/><circle cx="3.5" cy="10" r="1.25" fill="currentColor" stroke="none"/><circle cx="3.5" cy="15.7" r="1.25" fill="currentColor" stroke="none"/><path d="M7.5 4.3h10M7.5 10h10M7.5 15.7h10"/></svg>}

const libraryCategories = ['Garment', 'Avatar', 'Hanger', 'Fabric', 'Hardware and Trims', 'Material', 'Stage', 'Patterns']

export function GarmentSilhouette({ type = 'tee' }) {
  const isPants = /pants|jeans|501/i.test(type)
  const isSkirt = /skirt/i.test(type)
  const isHood = /hood/i.test(type)
  return <svg className="garment-silhouette" viewBox="0 0 64 72" role="img" aria-label={`${type} pattern silhouette`}>
    <defs><linearGradient id="garment-tile-shade" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fafafa"/><stop offset="1" stopColor="#aab6c4"/></linearGradient></defs>
    {isPants ? <path d="M19 8 H45 L49 63 H36 L32 32 L28 63 H15 Z"/> : isSkirt
      ? <path d="M23 11 H41 L52 63 H12 Z"/>
      : <path d={isHood ? 'M22 15 Q19 3 32 2 Q46 3 43 15 L53 21 L62 38 L50 45 L45 34 L45 65 H19 V34 L14 45 L2 38 L11 21 Z' : 'M23 12 L16 17 L2 30 L12 43 L20 36 L20 64 H44 V36 L52 43 L62 30 L48 17 L41 12 Q32 20 23 12 Z'} />}
    <path className="garment-stitch" d={isPants ? 'M32 9 V32 M19 17 H45' : isSkirt ? 'M21 18 H43' : 'M22 21 Q32 28 42 21 M20 58 H44'}/>
  </svg>
}

export function LibraryChrome({ category, setCategory, search, setSearch, thumbnails, setThumbnails, children }) {
  return <>
    <div className="clo-library-top"><strong>Library</strong><div className="clo-library-top-icons" aria-label="Library quick categories">
      <button className={category === 'Garment' ? 'active' : ''} aria-label="Browse garments" aria-pressed={category === 'Garment'} title="Garment library" onClick={() => setCategory('Garment')}><Star size={16}/></button>
      <button className={category === 'Avatar' ? 'active' : ''} aria-label="Browse avatars" aria-pressed={category === 'Avatar'} title="Avatar library" onClick={() => setCategory('Avatar')}><Cloud size={16}/></button>
      <button className={category === 'Fabric' ? 'active' : ''} aria-label="Browse fabrics" aria-pressed={category === 'Fabric'} title="Fabric library" onClick={() => setCategory('Fabric')}><Shirt size={16}/></button>
      <span className="clo-library-icon-spacer"/>
      <span className="clo-library-scope">LOCAL</span>
    </div></div>
    <div className="clo-library-categories" role="navigation" aria-label="Library categories">
      {libraryCategories.map((item) => <button key={item} aria-current={category === item ? 'page' : undefined} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}><ChevronRight size={12}/><Folder size={13}/><span>{item}</span></button>)}
    </div>
    <div className="clo-library-search"><Search size={14}/><input aria-label="Search library" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search assets…"/>{search && <button aria-label="Clear asset search" title="Clear search" onClick={() => setSearch('')}>×</button>}<button aria-label={thumbnails ? 'Switch to list view' : 'Switch to thumbnail view'} title={thumbnails ? 'List view' : 'Thumbnail view'} onClick={() => setThumbnails(value => !value)}>{thumbnails ? <List size={15}/> : <Grid2X2 size={15}/>}</button></div>
    <div className={`asset-library-content ${thumbnails ? 'thumbnail-mode' : 'list-mode'}`}><span className="asset-section-heading"><Folder size={12}/> {category.toUpperCase()} <ChevronDown size={11}/></span>{children}</div>
  </>
}

export function ObjectBrowser({ tab, setTab, project, setSelectedPieceId, setSelectedFabricId, onApplyFabric, setActiveSection, selectedPieceId, selectedFabricId, onAddFabric, onAddPattern, onTogglePieceProperty, onSelectedObjectChange,
  nativeMode=false,nativePanelRefs=[],nativeFabricRefs=[],nativeSelectedObject,onNativePanelSelect,onNativeFabricSelect }) {
  const [objectSearch, setObjectSearch] = useState('')
  const [categoryMenuOpen,setCategoryMenuOpen]=useState(false)
  const [categoryExpanded,setCategoryExpanded]=useState('2D Pattern')
  const fabrics = nativeMode ? nativeFabricRefs.map(f=>[f.id,f]) : Object.entries(project.fabrics || {})
  const allPieces = nativeMode?nativePanelRefs:(project.pieces || [])
  const sceneItems = [{ id: 'avatar', name: nativeMode?'Native avatar':project.avatar?.name || 'Avatar', icon: UserRound, type:'avatar', action: () => setActiveSection('Avatar') },
    ...allPieces.map(piece => ({ id: piece.id, name: piece.name, icon: Shirt, type:'pattern',pieceId:piece.id,
      action: () => {if(nativeMode)onNativePanelSelect?.(piece.id);else setSelectedPieceId(piece.id);setActiveSection('Pattern')} }))]
  const getRows = () => {
    if (tab === 'Scene') return sceneItems
    if (tab === 'Fabric') return fabrics.map(([id, item]) => ({
      id,name:item.name||id,color:item.color||item.appearance?.color,icon:Shirt,type:'fabric',
      action:()=>{if(nativeMode)onNativeFabricSelect?.(id);else setSelectedFabricId(id);setActiveSection('Fabric')}}))
    if(nativeMode)return []
    if (tab === 'Graphic') return allPieces.flatMap(piece => (piece.graphics || []).map((item,i) => ({ id: item.id??`${piece.id}-graphic-${i}`,pieceId:piece.id,itemId:item.id??i, name: `${piece.name} · Graphic`, icon: Image, action: () => { setSelectedPieceId(piece.id); setActiveSection('Fabric') } })))
    if (tab === 'Button' || tab === 'Buttonhole') return allPieces.flatMap(piece => (piece[tab === 'Button' ? 'buttons' : 'buttonholes'] || []).map((item, i) => ({ id: `${piece.id}-${item.id ?? i}`,pieceId:piece.id,itemId:item.id??i, name: `${piece.name} · ${tab} ${i + 1}`, icon: CircleDot, action: () => { setSelectedPieceId(piece.id); setActiveSection('Sewing') } })))
    if (tab === 'Topstitch') return allPieces.flatMap(piece => (piece.topstitches || []).map((item, i) => ({ id: `${piece.id}-${item.id ?? i}`,pieceId:piece.id,itemId:item.id??i, name: `${piece.name} · Topstitch ${i + 1}`, icon: MoreHorizontal, action: () => { setSelectedPieceId(piece.id); setActiveSection('Sewing') } })))
    if (tab === 'Trim') return [...(project.fasteners || []).map((item, i) => ({ id: `fastener-${i}`, name: item.name || `Fastener ${i + 1}`, icon: CircleDot, action: () => setActiveSection('Sewing') })), ...allPieces.flatMap(piece => (piece.zippers || []).map((item, i) => ({ id: `${piece.id}-zip-${i}`, name: `${piece.name} · Zipper`, icon: StretchHorizontal, action: () => { setSelectedPieceId(piece.id); setActiveSection('Sewing') } })))]
    if (tab === 'Grading') return (project.grading?.sizes || []).map((name) => ({ id: name, name: `Size ${name}`, icon: Grid2X2, action: () => setActiveSection('Production') }))
    if (tab === 'POM') return (project.customMeasurements || []).map((measurement, i) => ({ id: measurement.id || i, name: measurement.name || `POM ${i + 1}`, icon: List, action: () => setActiveSection('Production') }))
    return []
  }
  const rows = getRows()
  const filteredRows = rows.filter(row => row.name.toLowerCase().includes(objectSearch.trim().toLowerCase()))
  return <section className="clo-object-browser" aria-label="Object Browser">
    <div className="clo-panel-header"><strong>Object Browser</strong><span>{categoryMenuOpen ? `${OBJECT_HIERARCHY.length} GROUPS` : `${rows.length} ITEMS`}</span></div>
    <div className="clo-object-tabs" role="tablist" aria-label="Object Browser types">
      <button className={`clo-object-bullet-menu-trigger clo-object-tab-menu ${categoryMenuOpen ? 'active' : ''}`}
        type="button" role="tab" aria-selected={categoryMenuOpen}
        aria-label="Object Browser category list" aria-controls="clo-object-hierarchy-menu"
        title="Object Browser categories"
        onClick={()=>setCategoryMenuOpen(value=>!value)}><BulletListIcon/></button>
      {OBJECT_TABS.map(({id}) => <button key={id} type="button" role="tab" aria-label={id} aria-selected={!categoryMenuOpen && tab === id} title={id} className={!categoryMenuOpen && tab === id ? 'active' : ''} onClick={() => {
        setTab(id);setCategoryMenuOpen(false);onSelectedObjectChange?.(null)
        const workspace={Fabric:'Fabric',Graphic:'Fabric',Button:'Sewing',Buttonhole:'Sewing',Topstitch:'Sewing',Puckering:'Sewing',Grading:'Production',POM:'Production'}[id]
        if(workspace)setActiveSection(workspace)
      }}><CadToolIcon id={OBJECT_TAB_ART[id]} size={21}/><span>{id}</span></button>)}
    </div>
    {categoryMenuOpen ? <>
      <div className="clo-object-actions"><span>OBJECT CATEGORIES · SELECT A GROUP</span></div>
      <nav id="clo-object-hierarchy-menu" className="clo-object-hierarchy-menu" aria-label="Object Browser categories">
      {OBJECT_HIERARCHY.map(item=><div className="clo-object-hierarchy-group" key={item.title}>
        <button type="button" className={categoryExpanded===item.title?'expanded':''} aria-expanded={categoryExpanded===item.title} onClick={()=>setCategoryExpanded(categoryExpanded===item.title?'':item.title)}><ChevronRight size={13}/><CadToolIcon id={OBJECT_CATEGORY_ART[item.title]} size={17}/><strong>{item.title}</strong></button>
        {categoryExpanded===item.title && <div className="clo-object-hierarchy-children">{item.children.map(([label,section,objectTab])=><button type="button" key={label} onClick={()=>{setActiveSection(section);setTab(objectTab);setCategoryMenuOpen(false)}}>{label}</button>)}</div>}
      </div>)}
      </nav>
    </> : <>
    <div className="clo-object-actions"><span>{tab === 'Fabric' ? nativeMode?'SELECT NATIVE FABRIC TO EDIT':'SELECT A SWATCH TO INSPECT · APPLY IN FABRIC EDITOR' : tab === 'Scene' ? nativeMode?'RUST 3D / 2D GARMENT':'3D / 2D Scene' : tab} · {rows.length} {rows.length === 1 ? 'item' : 'items'}</span>{!nativeMode&&['Fabric','Scene'].includes(tab) && <button onClick={() => tab === 'Fabric' ? onAddFabric() : onAddPattern()}>+ Add {tab === 'Fabric' ? 'fabric' : 'pattern'}</button>}</div>
    {tab === 'Fabric' && fabrics.length > 0 && (() => {
      const item = nativeMode
        ? nativeFabricRefs.find(f=>f.id===nativeSelectedObject?.id)||fabrics[0][1]
        : project.fabrics?.[selectedFabricId] || fabrics[0][1]
      return <div className="clo-fabric-preview" aria-label="Selected fabric preview">
        <div className="clo-fabric-preview-tile" style={{background:item.color || '#737989'}}><div className="clo-fabric-weave"/></div>
        <div className="clo-fabric-preview-details"><strong>{item.name || 'Material'}</strong>{nativeMode?
          <span>Rust fabric · {item.id} · select to inspect physical values</span>:
          <><span>{item.gsm ?? '—'} GSM · {(Number(item.thickness || .002) * 1000).toFixed(1)} mm</span><span>Warp {Math.round((item.stretchWarp || 0) * 100)}% · Weft {Math.round((item.stretchWeft || 0) * 100)}%</span></>}</div>
      </div>
    })()}
    <div className="clo-object-search"><Search size={13}/><input aria-label="Search Object Browser" placeholder="Filter objects…" value={objectSearch} onChange={event => setObjectSearch(event.target.value)}/>{objectSearch && <button type="button" aria-label="Clear object search" onClick={() => setObjectSearch('')}>×</button>}</div>
    <div className="clo-object-list" role="list">
      {filteredRows.length ? filteredRows.map(({ id, name, icon: Icon, color, action, pieceId, itemId, type }) => {
        const piece = !nativeMode && tab === 'Scene' ? allPieces.find(item => item.id === id) : null
        const current=nativeMode?nativeSelectedObject?.id===id:(id === selectedPieceId || id === selectedFabricId)
        return <div key={id} role="listitem" className={`clo-object-row ${current ? 'selected' : ''}`}>
          {piece ? <button type="button" className="clo-object-mini-action" aria-label={`${piece.visible3d === false ? 'Show' : 'Hide'} ${name} in 3D`} title="Toggle 3D visibility" onClick={() => onTogglePieceProperty?.(id, 'visible3d')} >{piece.visible3d === false ? <EyeOff size={13}/> : <Eye size={13}/>}</button> : <span className="clo-row-visible" aria-hidden="true">✓</span>}
          <button type="button" className="clo-object-select" aria-current={current?'true':undefined} onClick={()=>{onSelectedObjectChange?.({source:nativeMode?'native':'draft',type:type||tab,id,name,pieceId,itemId});action?.()}}>{color ? <span className="clo-material-swatch" style={{background:color}}/> : <Icon size={16}/>}<span className="clo-object-row-name">{name}</span></button>
          {piece ? <button type="button" className="clo-object-mini-action" aria-label={`${piece.locked ? 'Unlock' : 'Lock'} ${name}`} title="Toggle pattern editing lock" onClick={() => onTogglePieceProperty?.(id, 'locked')}>{piece.locked ? <Lock size={13}/> : <Unlock size={13}/>}</button> : <MoreHorizontal size={13}/>}
        </div>
      }) : <div className="clo-object-empty">{objectSearch ? 'No matching objects.' : `No ${tab.toLowerCase()} objects in the project yet.`}</div>}
    </div>
    </>}
  </section>
}
