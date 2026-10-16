import React, {useEffect,useState} from 'react'

// One row, one authoritative object ID. Never report a mutation as completed
// before the draft transaction / Rust bridge returns a successful result.
export default function CloEditableIdentity({field,label,value='',kind,objectId,editable=true,onCommit}) {
  const [draft,setDraft]=useState(String(value??''))
  const [error,setError]=useState('')
  const [saving,setSaving]=useState(false)
  useEffect(()=>{setDraft(String(value??''));setError('')},[value,kind,objectId,field])
  const commit=async()=>{
    if(!editable||saving||draft===String(value??''))return
    const next=draft.trim()
    if(field==='name'&&!next){setError('Name cannot be empty');return}
    const limit=['supplier','owner','construction'].includes(field)?128:96
    if(next.length>limit){setError('Maximum '+limit+' characters');return}
    setSaving(true)
    try{
      const result=await onCommit?.(field,next)
      if(!result||result.ok!==true){setError(result?.error||'Edit was not saved');return}
      setError('')
    }catch(err){setError(err?.message||'Edit was not saved')}
    finally{setSaving(false)}
  }
  const id='clo-pe-identity-'+kind+'-'+objectId+'-'+field
  return <div className="clo-pe-edit-field clo-pe-identity" data-property-field={field}>
    <label htmlFor={id}>{label}</label>
    <input id={id} aria-label={label} type="text" value={draft}
      maxLength={['supplier','owner','construction'].includes(field)?128:96}
      disabled={saving} readOnly={!editable}
      title={editable?'Edit the selected '+kind+' '+label:'Type is determined by the object; conversion is not implemented'}
      onChange={event=>setDraft(event.target.value)}
      onBlur={()=>void commit()}
      onKeyDown={event=>{
        if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}
        if(event.key==='Escape'){setDraft(String(value??''));setError('');event.currentTarget.blur()}
      }}/>
    {error&&<small role="alert" className="clo-pe-field-error">{error}</small>}
  </div>
}
