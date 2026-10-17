// Artwork belongs to the EXO browser workspace, not to the Rust physical
// garment template. IndexedDB avoids localStorage's small image-data quota.
const DB='exo-native-garment-artwork-v1'
const STORE='graphics'

function connection(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('Artwork storage is unavailable in this browser'));return}
    const request=indexedDB.open(DB,1)
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE)
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error||new Error('Artwork database failed'))
  })
}
async function action(key,value,write){
  const db=await connection()
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,write?'readwrite':'readonly')
      const request=write?tx.objectStore(STORE).put(value,key):tx.objectStore(STORE).get(key)
      request.onsuccess=()=>resolve(request.result)
      request.onerror=()=>reject(request.error||new Error('Artwork write failed'))
      tx.onabort=()=>reject(tx.error||new Error('Artwork storage was interrupted'))
    })
  }finally{db.close()}
}
export const readNativeGraphics=async key=>{const data=await action(key,undefined,false);return Array.isArray(data)?data:[]}
export const saveNativeGraphics=(key,graphics)=>action(key,graphics,true)

// Full pattern panel identity protects against reusing a stored graphic on an
// unrelated preset with a coincidentally similar name.
export function garmentGraphicDocumentKey(snapshot){
  const template=snapshot?.template
  if(!template?.panels?.length)return null
  return [template.id||template.name||'untitled',...template.panels.map(p=>p.id)].join('::')
}
