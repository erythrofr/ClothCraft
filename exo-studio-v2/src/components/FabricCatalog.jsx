import React, { useMemo, useState } from 'react'
import { fabricSwatchStyle } from '../core/fabricSwatchStyle.js'
import LibraryAssetHover from './LibraryAssetHover.jsx'
import FabricDrapeBallPreview from './FabricDrapeBallPreview.jsx'
import FabricScanFlatPreview from './FabricScanFlatPreview.jsx'
import './FabricCatalog.css'

/** One catalog shared by the EXO draft and ClothCraft native workspaces. */
export default function FabricCatalog({ groups, projectFabrics, search, coverage, nativeMode, onApplyPreset, onActivatePreset, onAssignFabric, onInspectDraft }) {
  const [family, setFamily] = useState('All')
  const [inspected, setInspected] = useState(null)
  const catalog = useMemo(() => groups.flatMap(([category, entries]) => entries.map(([id, fabric]) => ({ id, fabric, category }))), [groups])
  const availableGroups = useMemo(() => groups.map(([name]) => name), [groups])
  const filtered = useMemo(() => catalog.filter(({fabric,category}) => (family === 'All' || category === family) && `${fabric.name} ${category} ${fabric.texture?.scanSource || ''}`.toLowerCase().includes(search.trim().toLowerCase())), [catalog, family, search])
  const detail = inspected && catalog.find(entry => entry.id === inspected)
  const activate = (id, options={}) => (onActivatePreset || (nativeMode ? onInspectDraft : onApplyPreset))?.(id, options)
  return <div className="exo-fabric-catalog" aria-label="Fabric preset catalog">
    <div className="exo-fabric-catalog-intro"><strong>{catalog.length} fabric presets</strong></div>
    <label className="exo-fabric-family-label" htmlFor="exo-fabric-family">Filter fabric family</label>
    <select id="exo-fabric-family" value={family} onChange={event => setFamily(event.target.value)}>
      <option value="All">All fabric families ({catalog.length})</option>
      {availableGroups.map(group => <option key={group} value={group}>{group}</option>)}
    </select>
    <p className="exo-fabric-gesture-hint">Double-click to apply · Shift + double-click for all pieces</p>
    {!nativeMode && Object.keys(projectFabrics || {}).length > 0 && <section className="exo-fabric-project" aria-label="Project fabric swatches">
      <h4>Project swatches</h4>
      {Object.entries(projectFabrics).filter(([, fabric]) => (fabric.name || '').toLowerCase().includes(search.toLowerCase())).map(([id, fabric]) => <LibraryAssetHover key={id} category="Fabric" id={`project-${id}`} title={fabric.name || 'Project fabric'} description="Project material swatch; click to assign it to the selected garment pattern." details={[["Weight",Number.isFinite(fabric.gsm)?`${fabric.gsm} GSM (estimated)`:'Not calibrated'],["Roughness",Number.isFinite(fabric.roughness)?fabric.roughness.toFixed(2):'Unspecified']]} source="The enlarged swatch shows the selected project material's actual color or linked texture." preview={<div className="exo-fabric-preview-image" style={fabricSwatchStyle(fabric)}>{fabric.texture?.src && /^\/fabric-scans(?:-ambientcg)?\//.test(fabric.texture.src) && <img src={fabric.texture.src} alt={`${fabric.name} project fabric texture`}/>}</div>}><button type="button" onClick={() => onAssignFabric(id)} title={`Apply ${fabric.name} to selected pattern`}><span className="exo-fabric-chip" style={fabricSwatchStyle(fabric)} aria-hidden="true"/><span>{fabric.name}</span><small>Apply</small></button></LibraryAssetHover>)}
    </section>}
    <div className="exo-fabric-results" role="status">{filtered.length} matching presets</div>
    <div className="exo-fabric-list" role="list" aria-label="Fabric presets">
      {filtered.map(({id,fabric,category}) => <div className={`exo-fabric-entry ${inspected===id?'inspected':''}`} role="listitem" key={id}>
        <LibraryAssetHover category="Fabric" id={id} title={fabric.name} description={`${category} · ${fabric.texture?.scanAssetId ? 'Photo reference' : 'Procedural material'}`} details={[["Construction",fabric.construction||category],["Composition",fabric.composition||'Not verified'],["Weight",Number.isFinite(fabric.gsm)?`${fabric.gsm} GSM · estimated`:'Unverified'],["Thickness",Number.isFinite(fabric.thickness)?`${(fabric.thickness*1000).toFixed(2)} mm · estimated`:'Unverified'],["Stretch warp/weft",`${fabric.stretchWarp??'—'} / ${fabric.stretchWeft??'—'} (preset)`],["Roughness",Number.isFinite(fabric.roughness)?fabric.roughness.toFixed(2):'Unverified'],["Texture",fabric.texture?.scanAssetId?'Color · normal · roughness':'Generated appearance'],["Supplier",fabric.supplier||'Not recorded'],["Owner",fabric.owner||'Not recorded']]} source="The enlarged flat swatch and ball use the same dye/wash transformation. The fold shape is illustrative until tested." preview={<div className="exo-fabric-hover-dual" aria-label={`${fabric.name} toned flat swatch and draped fabric sphere`}><FabricScanFlatPreview fabric={fabric}/><div className="exo-fabric-hover-drape"><FabricDrapeBallPreview fabric={fabric} height={420} compact/><span>3D DRAPE · FOLDS</span></div></div>}>
        <button type="button" className="exo-fabric-entry-main" data-fabric-preset={id} onClick={() => setInspected(inspected===id ? null : id)} onDoubleClick={e => { e.preventDefault(); activate(id,{allPieces:e.shiftKey}) }} onKeyDown={e => { if (e.key === 'Enter' && (e.altKey || e.shiftKey)) { e.preventDefault(); activate(id,{allPieces:e.shiftKey}) } }} aria-expanded={inspected===id} aria-label={`Inspect ${fabric.name}. Double click to apply, or press Alt Enter.`}>
          <span className="exo-fabric-thumb" style={fabric.texture?.scanAssetId ? { backgroundColor: fabric.color || '#777' } : fabricSwatchStyle(fabric)} aria-hidden="true">
            {fabric.texture?.scanAssetId && /^\/fabric-scans(?:-ambientcg)?\//.test(fabric.texture?.src || '') && <img src={fabric.texture.src} alt="" loading="lazy" decoding="async"/>}
          </span>
          <span className="exo-fabric-entry-copy"><strong>{fabric.name}</strong><small>{category}</small><small>{fabric.texture?.scanAssetId ? `CC0 photo · ${fabric.texture.scanMatch === 'family-proxy' ? 'family proxy' : 'reference'}` : 'Procedural appearance'}</small></span>
          <span className="exo-fabric-entry-expand" aria-hidden="true">{inspected===id?'−':'+'}</span>
        </button></LibraryAssetHover>
        {inspected===id && <div className="exo-fabric-detail">
          <p>{fabric.texture?.scanAssetId ? `Source: ${fabric.texture.scanSource || 'licensed CC0 source'} · ${fabric.texture.scanAssetId}. This scan may represent a related fabric family.` : 'Generated visual approximation; no photographic scan attached.'}</p>
          <p>Estimated mass: {Number.isFinite(fabric.gsm) ? `${fabric.gsm} g/m²` : 'unavailable'} · Calibration: {fabric.calibration?.status || 'unverified'}</p>
          {fabric.texture?.originalSourceUrl && <a href={fabric.texture.originalSourceUrl} target="_blank" rel="noopener noreferrer">View original scan source</a>}
          <button type="button" onClick={() => activate(id)}>{nativeMode ? 'Apply to selected Rust panel' : 'Add to project and apply'}</button>
        </div>}
      </div>)}
      {!filtered.length && <p className="exo-fabric-empty">No fabrics match this search and family. Try another filter.</p>}
    </div>
    {detail && <span className="exo-fabric-selected-sr" role="status">Inspecting {detail.fabric.name}</span>}

  </div>
}
