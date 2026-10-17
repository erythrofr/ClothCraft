import React,{useEffect,useState} from 'react'

// A real Rust seam-property edit, not the illustrative Property Editor.
// The parent submits one revision-guarded native command; no local garment
// material, saved drape or seam geometry is changed until Rust confirms it.
export default function ClothCraftNativeSeamEditor({seams=[],selectedSeamId,busy=false,onEdit}) {
 const [seamId,setSeamId]=useState('')
 const [reversed,setReversed]=useState(false)
 const [ease,setEase]=useState(false)
 const [stiffness,setStiffness]=useState('50000')
 const current=seams.find(item=>item.id===seamId)||seams[0]
 useEffect(()=>{
  if(!seams.length){setSeamId('');return}
  setSeamId(current=>seams.some(item=>item.id===selectedSeamId)?selectedSeamId:
    seams.some(item=>item.id===current)?current:seams[0].id)
 },[selectedSeamId,seams.map(item=>item.id).join('|')])
 useEffect(()=>{
  if(!current)return
  setReversed(Boolean(current.reverse_b))
  setEase(Boolean(current.allow_ease))
  setStiffness(String(current.stiffness))
 },[current?.id,current?.reverse_b,current?.allow_ease,current?.stiffness])
 if(!seams.length)return null
 const numeric=Number(stiffness)
 const valid=Number.isFinite(numeric)&&numeric>=1000&&numeric<=1000000
 const changed=current&&(reversed!==Boolean(current.reverse_b)||ease!==Boolean(current.allow_ease)||numeric!==Number(current.stiffness))
 return <section className="cc-native-seam-editor" data-native-seam-editor="true" aria-label="Native sewing relationship editor">
  <strong>EDIT SEWING · RUST CONSTRAINT</strong>
  <label>Relationship
   <select aria-label="Choose native seam" value={current?.id||''} disabled={busy}
    onChange={event=>setSeamId(event.target.value)}>
    {seams.map(seam=><option key={seam.id} value={seam.id}>{seam.id} · {seam.a.panel} ↔ {seam.b.panel}</option>)}
   </select>
  </label>
  <label>Reverse second edge <input type="checkbox" aria-label="Reverse native seam B"
   checked={reversed} disabled={busy} onChange={event=>setReversed(event.target.checked)}/></label>
  <label>Allow unequal edge lengths <input type="checkbox" aria-label="Allow native seam easing"
   checked={ease} disabled={busy} onChange={event=>setEase(event.target.checked)}/></label>
  <label>Coupling stiffness (N/m²)
   <input aria-label="Native seam stiffness" type="number" min="1000" max="1000000" step="1000"
    value={stiffness} disabled={busy} onChange={event=>setStiffness(event.target.value)}/>
  </label>
  <button type="button" data-native-seam-update="true" disabled={busy||!changed||!valid}
   onClick={()=>onEdit?.({seam:current.id,reverse:reversed,ease,stiffness:numeric})}>Apply native sewing changes</button>
  {!valid&&<small role="status">Use stiffness between 1,000 and 1,000,000 N/m².</small>}
  <small>Compiles a physical sewing constraint, preserves both named edge references and supports Rust Undo/Redo. Changing seam physics resets the simulated pose.</small>
 </section>
}
