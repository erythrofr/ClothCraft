import React, {useRef, useState} from 'react'
import {createGarmentGraphic, importGarmentArtwork, normalizeGarmentGraphic, serializeGarmentGraphics, deserializeGarmentGraphics} from '../core/nativeGarmentGraphics.js'
import './ClothCraftGraphicEditor.css'

// Demo asset: Nike swoosh trademark, sourced from Wikimedia Commons.
// This is a garment-editor placement example, not an endorsed Nike product.
const BRAND_SAMPLE_URL = '/graphic-presets/nike-swoosh.svg'

/** Controlled panel artwork editor. Parent stores `graphics` and passes onChange(nextGraphics). */
export default function ClothCraftGraphicEditor({graphics = [], onChange = () => {}, panelId, panels = [], disabled = false}) {
  const inputRef = useRef(null)
  const layoutRef = useRef(null)
  const previewRef = useRef(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const selected = graphics.find(graphic => graphic.id === selectedId) || graphics.find(graphic => graphic.panel === panelId) || graphics[0]
  const update = (id, patch) => {
    try {onChange(graphics.map(graphic => graphic.id === id ? normalizeGarmentGraphic({...graphic, ...patch}) : graphic));setError('')}
    catch (e) {setError(e.message)}
  }
  const currentPanel = panelId || panels[0]?.id
  async function addFiles(event) {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length) return
    if (!currentPanel) {setError('Select a garment panel before adding artwork.');return}
    setBusy(true)
    setError('')
    try {
      const imported = []
      if (graphics.length + files.length > 100) throw new Error('Maximum of 100 graphics per garment')
      for (const file of files) imported.push(normalizeGarmentGraphic(createGarmentGraphic(await importGarmentArtwork(file), currentPanel)))
      onChange([...graphics, ...imported])
      setSelectedId(imported.at(-1).id)
    } catch (e) { setError(e?.message || 'Artwork import failed') }
    finally {setBusy(false)}
  }
  async function addBrandSample() {
    if (disabled || busy || !currentPanel) return
    setBusy(true)
    setError('')
    try {
      if (graphics.length >= 100) throw new Error('Maximum of 100 graphics per garment')
      const response = await fetch(BRAND_SAMPLE_URL)
      if (!response.ok) throw new Error('The example Nike SVG is unavailable')
      const source = await response.text()
      const artwork = await importGarmentArtwork(new File([source], 'Nike swoosh.svg', {type:'image/svg+xml'}))
      const graphic = normalizeGarmentGraphic({
        ...createGarmentGraphic(artwork, currentPanel),
        name: 'Nike Swoosh · Example SVG',
        center: [.5, .62],
        scale: .55,
      })
      onChange([...graphics, graphic])
      setSelectedId(graphic.id)
    } catch (error) {
      setError(error?.message || 'Unable to add the sample SVG')
    } finally {
      setBusy(false)
    }
  }
  function dragPlacement(event) {
    if (disabled || !selected || !previewRef.current) return
    const bounds = previewRef.current.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    update(selected.id, {center: [Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))]})
  }
  function exportLayout() {
    try {
      const blob = new Blob([JSON.stringify(serializeGarmentGraphics(graphics), null, 2)], {type:'application/json'})
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'garment-graphics.json'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {setError(e.message)}
  }
  async function restoreLayout(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      if (file.size > 80 * 1024 * 1024) throw new Error('Layout file exceeds 80 MB')
      const imported = deserializeGarmentGraphics(JSON.parse(await file.text()), {panels})
      onChange(imported)
      setSelectedId(imported[0]?.id || null)
    } catch (e) { setError(e?.message || 'Unable to restore artwork layout') }
    finally {setBusy(false)}
  }
  return <section className="cc-graphic-editor" aria-label="Garment graphic editor">
    <header className="cc-graphic-header"><div><strong>Graphics</strong><small>Printed artwork on the garment surface</small></div><button type="button" onClick={() => inputRef.current?.click()} disabled={busy || disabled || !currentPanel}>+ Add</button></header>
    <input ref={inputRef} type="file" accept="image/svg+xml,image/png,image/jpeg,.svg,.png,.jpg,.jpeg" multiple hidden onChange={addFiles}/>
    <input ref={layoutRef} type="file" accept="application/json,.json" hidden onChange={restoreLayout}/>
    {error && <p className="cc-graphic-error" role="alert">{error}</p>}
    {busy && <p role="status" className="cc-graphic-info">Preparing artwork…</p>}
    <div className="cc-graphic-sample">
      <div className="cc-graphic-sample-art"><img src={BRAND_SAMPLE_URL} alt="Nike swoosh SVG example"/></div>
      <div className="cc-graphic-sample-text"><strong>Nike swoosh SVG example</strong><small>Demo of placing a trademarked logo on a T-shirt panel. This is a visual editing example, not a Nike-endorsed garment. Move and scale it below; the 3D preview follows the cloth surface.</small>
        <button type="button" onClick={addBrandSample} disabled={busy || disabled || !currentPanel}>Place example on garment</button>
      </div>
    </div>
    {!graphics.length && <div className="cc-graphic-empty">Choose the example above or use + Add to import your own SVG, PNG or JPEG. Select the front torso panel to print across the T-shirt chest.</div>}
    <div className="cc-graphic-list">{graphics.map(graphic => <button type="button" key={graphic.id} className={`cc-graphic-item ${graphic.id === selected?.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(graphic.id)}><img src={graphic.dataUrl} alt=""/><span>{graphic.name || 'Untitled graphic'}<small>{graphic.panel}</small></span></button>)}</div>
    <div className="cc-graphic-layout-actions">
      <button type="button" disabled={busy || disabled} onClick={() => layoutRef.current?.click()}>Restore layout JSON</button>
      {!!graphics.length && <button type="button" disabled={busy} onClick={exportLayout}>Export layout JSON</button>}
    </div>
    {selected && <div className="cc-graphic-controls">
      <div className="cc-graphic-preview-caption">Panel placement preview · drag artwork to position</div>
      <div ref={previewRef} className="cc-graphic-preview" role="group" aria-label="Graphic position on selected panel" onPointerDown={event => {if (disabled) return;event.currentTarget.setPointerCapture(event.pointerId);dragPlacement(event)}} onPointerMove={event => {if (event.buttons === 1 && event.currentTarget.hasPointerCapture(event.pointerId)) dragPlacement(event)}}>
        <div className="cc-graphic-preview-panel"><img draggable="false" alt="" src={selected.dataUrl} style={{left:`${(selected.center?.[0] ?? .5)*100}%`,top:`${(selected.center?.[1] ?? .5)*100}%`,width:`${(selected.scale ?? .42)*100}%`,transform:`translate(-50%, -50%) rotate(${selected.rotation ?? 0}deg)`,opacity:selected.visible === false ? .3 : 1}}/></div>
      </div>
      <label>Panel<select value={selected.panel} disabled={disabled} onChange={e => update(selected.id, {panel:e.target.value})}>{[...new Set([selected.panel, ...panels.map(p => p.id)])].map(id => <option key={id} value={id}>{panels.find(p => p.id === id)?.name || id}</option>)}</select></label>
      <label>Surface<select value={selected.side || 'front'} disabled={disabled} onChange={e => update(selected.id, {side:e.target.value})}><option value="front">Front face</option><option value="back">Back face</option><option value="both">Both faces</option></select></label>
      {[['Horizontal position',0],['Vertical position',1]].map(([label, axis]) => <label key={axis}>{label}<input type="range" min="0" max="1" step=".005" value={selected.center?.[axis] ?? .5} disabled={disabled} onChange={e => update(selected.id,{center:axis === 0 ? [+e.target.value,selected.center?.[1] ?? .5] : [selected.center?.[0] ?? .5,+e.target.value]})}/><output>{Math.round((selected.center?.[axis] ?? .5)*100)}%</output></label>)}
      <label>Scale<input type="range" min=".03" max="1.5" step=".01" value={selected.scale ?? .42} disabled={disabled} onChange={e => update(selected.id,{scale:+e.target.value})}/><output>{Math.round((selected.scale ?? .42)*100)}%</output></label>
      <label>Rotation<input type="range" min="-180" max="180" step="1" value={selected.rotation || 0} disabled={disabled} onChange={e => update(selected.id,{rotation:+e.target.value})}/><output>{selected.rotation || 0}°</output></label>
      <div className="cc-graphic-actions"><label><input type="checkbox" checked={selected.visible !== false} disabled={disabled} onChange={e => update(selected.id,{visible:e.target.checked})}/> Visible</label><button type="button" disabled={disabled} onClick={() => {onChange(graphics.filter(g => g.id !== selected.id));setSelectedId(null)}}>Remove</button></div>
    </div>}
  </section>
}
