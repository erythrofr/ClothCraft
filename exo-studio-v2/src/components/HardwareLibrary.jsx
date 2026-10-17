import React,{useState} from 'react'
import {ChevronDown,ChevronRight,PackageOpen} from 'lucide-react'
import {listHardwarePresets} from '../data/hardwarePresets.js'
import LibraryAssetHover from './LibraryAssetHover.jsx'
import PremiumHardware3DPreview from './PremiumHardware3DPreview.jsx'
import './HardwareLibrary.css'

const groups=[['button','Buttons'],['buttonhole','Buttonholes'],['zipper','Zippers'],['snap','Snaps'],['rivet','Rivets'],['buckle','Buckles & Rings']]
// Curated by visual inspection of docs/hardware-contact-sheet-20261017.jpg.
// All presets stay available for legacy selections and production annotations.
const featuredIds = new Set([
  'black-matte-button','coat-shank-button','four-hole-shirt-button','gold-shank-button',
  'horn-look-button','mother-of-pearl-look','pearl-shirt-button','silver-ring-button',
  'square-fashion-button','two-hole-button',
  'coil-zipper-5','invisible-zipper','metal-jeans-zipper','molded-zipper-8','two-way-outerwear-zipper',
  'd-ring','prong-buckle','slide-adjuster',
])

function HardwareThumbnail({preset}){
  return <span className="exo-hardware-thumb" data-preview-source={preset.previewImage ? 'premium-glb-render' : 'procedural-legacy'}><img src={preset.previewImage || `/hardware-thumbnails/${preset.id}.png`} alt={`${preset.name} rendered hardware preview`} width="176" height="176" loading="lazy" decoding="async"/></span>
}

export function LibraryHardwarePreview({preset,style}){
  if(!preset)return null
  const dimensions=Object.entries(preset.dimensionsMm).map(([name,value])=>`${name.replace(/([A-Z])/g,' $1').toLowerCase()}: ${value} mm`).join(' · ')
  return <aside className="exo-hardware-hover-preview" style={style} data-hardware-preview={preset.id} aria-label={`${preset.name} enlarged 3D render`}>
    <div className="exo-hardware-preview-visual"><img src={preset.previewImage || `/hardware-thumbnails/${preset.id}.png`} alt={`${preset.name} 3D model render`} width="352" height="352" decoding="async"/><span>3D STUDIO RENDER</span></div>
    <div className="exo-hardware-preview-details"><strong>{preset.name}</strong><span>{preset.kind.toUpperCase()} · {preset.finish}</span>
      <dl><div><dt>Dimensions</dt><dd>{dimensions}</dd></div><div><dt>Material</dt><dd>{preset.material}</dd></div><div><dt>Appearance</dt><dd><span className="exo-hardware-pbr-swatch" style={{backgroundColor:preset.pbr.baseColor}}/>{preset.pbr.baseColor} · metal {preset.pbr.metalness.toFixed(2)} · roughness {preset.pbr.roughness.toFixed(2)}</dd></div><div><dt>Construction</dt><dd>{preset.construction}</dd></div></dl>
      <small>{preset.modelAsset ? 'Original 3D model rendered in Blender; illustrative dimensions and finishes.' : 'Procedural 3D visualization; illustrative dimensions and finishes.'} Verify with supplier before production.</small>
    </div>
  </aside>
}

export default function HardwareLibrary({search='',selectedPresetId,onSelectPreset}){
  const [expanded,setExpanded]=useState(()=>new Set(['button','buckle']))
  const [showAll,setShowAll]=useState(false)
  const query=search.trim().toLowerCase()
  const visiblePresets=listHardwarePresets().filter(preset=>showAll||query||featuredIds.has(preset.id)||selectedPresetId===preset.id)
  const toggle=kind=>setExpanded(previous=>{
    const next=new Set(previous)
    if(next.has(kind))next.delete(kind);else next.add(kind)
    return next
  })
  return <section className="exo-hardware-library" aria-label="Hardware and trims library">
    <div className="exo-hardware-library-summary"><PackageOpen size={14}/><strong>{visiblePresets.length} of {listHardwarePresets().length} hardware designs</strong><small>Curated real GLB buckle and ring geometry · illustrative catalog dimensions</small>
      <button type="button" className="exo-hardware-show-all" aria-pressed={showAll} onClick={()=>setShowAll(current=>!current)}>{showAll?'Featured designs':'All designs'}</button></div>
    {groups.map(([kind,title])=>{
      const items=visiblePresets.filter(item=>item.kind===kind&&`${item.name} ${item.finish} ${item.material} ${item.construction}`.toLowerCase().includes(query))
      if(!items.length)return null
      const isOpen=Boolean(query)||expanded.has(kind)
      return <div className="exo-hardware-folder" key={kind}>
        <button type="button" className="exo-hardware-folder-toggle" aria-expanded={isOpen} aria-label={`${title} folder`} onClick={()=>toggle(kind)}>
          {isOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<strong>{title}</strong><span>{items.length}</span>
        </button>
        {isOpen&&<div className="exo-hardware-folder-items" role="list" aria-label={`${title} assets`}>
          {items.map(preset=><LibraryAssetHover key={preset.id} category="hardware" id={preset.id} title={preset.name} description={`${preset.kind} · ${preset.finish}`} details={[
            ['Dimensions',Object.entries(preset.dimensionsMm||{}).map(([name,value])=>`${name.replace(/([A-Z])/g,' $1').toLowerCase()}: ${value} mm`).join(' · ')],
            ['Material',preset.material],['Finish',preset.finish],['Construction',preset.construction],
            ['PBR',`metal ${preset.pbr?.metalness?.toFixed(2)??'—'} · roughness ${preset.pbr?.roughness?.toFixed(2)??'—'}`],
          ]} source={preset.modelAsset ? 'Original EXO 3D GLB with studio-rendered thumbnail. Reference size only; supplier engineering data remains unverified.' : 'EXO procedural Three.js studio render · illustrative specifications'} preview={preset.modelAsset ? <PremiumHardware3DPreview preset={preset}/> : <div className="exo-hardware-shared-hover-media"><img src={preset.previewImage || `/hardware-thumbnails/${preset.id}.png`} alt={`${preset.name} hardware model render`} loading="eager" decoding="async"/></div>}>
          <button type="button" role="listitem" data-hardware-preset={preset.id} className={`exo-hardware-asset ${selectedPresetId===preset.id?'active':''}`} aria-pressed={selectedPresetId===preset.id} onClick={()=>onSelectPreset?.(preset)}>
            <HardwareThumbnail preset={preset}/>
            <span className="exo-hardware-asset-caption"><strong>{preset.name}</strong><small>{preset.finish}</small><small>{preset.dimensionsMm.diameter??preset.dimensionsMm.capDiameter??preset.dimensionsMm.length??preset.dimensionsMm.nominalChainWidth??preset.dimensionsMm.innerWidth??preset.dimensionsMm.width??preset.dimensionsMm.headDiameter??preset.dimensionsMm.outerWidth??'—'} mm · {preset.material}</small></span>
          </button></LibraryAssetHover>)}
        </div>}
      </div>
    })}
    {query&&!listHardwarePresets().some(item=>`${item.name} ${item.finish} ${item.material} ${item.construction}`.toLowerCase().includes(query))&&<p className="exo-hardware-empty">No matching hardware. Search by style, material, or finish.</p>}
  </section>
}
