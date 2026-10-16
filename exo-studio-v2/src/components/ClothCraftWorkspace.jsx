import {createPortal} from 'react-dom'
import React,{useState,useEffect,useRef,useCallback} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {TransformControls} from 'three/addons/controls/TransformControls.js'
import ClothCraftFabricLibrary from './ClothCraftFabricLibrary.jsx'
import ClothCraftSceneV2 from './ClothCraftSceneV2.jsx'
import ClothCraftBoardV2 from './ClothCraftBoardV2.jsx'
import ClothCraftContextMenu from './ClothCraftContextMenu.jsx'
import {measureNativeSelection} from '../core/clothcraftSelectionMetrics.js'
import {Scissors,Shirt,Layers,UserRound,Activity,Factory,Sun,FolderOpen,Save,Download,Undo2,Redo2,Play,Pause,RotateCcw,MousePointer2,PenTool,Move3D,Rotate3D,Search,Settings2,Eye,EyeOff,Grid2X2,Box,ChevronRight,FilePlus2,BookOpen} from 'lucide-react'
import './ClothCraftWorkspace.css'
import './ClothCraftExoShell.css'
const BASE=import.meta.env.VITE_CLOTHCRAFT_BRIDGE_URL||'http://127.0.0.1:5193'
const COLORS=['#527e91','#d29465','#7a9e79','#a889b2','#c3ab5d','#76a5a4']
const EXO_SECTIONS=[['Pattern',Shirt],['Sewing',Scissors],['Fabric',Layers],['Avatar',UserRound],['Fit',Activity],['Production',Factory],['Render',Sun]]
const weighted=(weights,values)=>weights.reduce((p,[i,w])=>p.map((n,k)=>n+values[i][k]*w),values[0].map(()=>0))
function boardPoint(s,i){const range=s.panels.find(p=>i>=p.vertices[0]&&i<p.vertices[1]),p=s.template.panels.find(p=>p.id===range.id),a=(p.layout_rotation_degrees||0)*Math.PI/180,[u,v]=s.uv[i];return[range.layout[0]+u*Math.cos(a)-v*Math.sin(a),range.layout[1]+u*Math.sin(a)+v*Math.cos(a)]}
function Scene({snapshot,active,selected,mode,onPick,onHover,onPlace,showAvatar=true,showSeams=true,wireframe=false}){
 const host=useRef(),engine=useRef(),latest=useRef();latest.current={onPick,onHover,onPlace,selected}
 useEffect(()=>{
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e6e7e5');
  const camera=new THREE.PerspectiveCamera(35,1,.01,100);camera.position.set(2,1.4,3)
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.current.appendChild(renderer.domElement)
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.95,0);controls.enableDamping=true
  scene.add(new THREE.HemisphereLight(0xffffff,0x77736e,2.2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(2,4,3);scene.add(light)
  const grid=new THREE.GridHelper(4,40,0xb5b8b5,0xd0d2cf);scene.add(grid)
  const cloth=new THREE.Group(),body=new THREE.Group(),lines=new THREE.Group();scene.add(cloth,body,lines)
  const pivot=new THREE.Object3D();scene.add(pivot);const transform=new TransformControls(camera,renderer.domElement);scene.add(transform.getHelper());
  transform.addEventListener('dragging-changed',e=>{controls.enabled=!e.value})
  transform.addEventListener('mouseUp',()=>{if(latest.current.selected)latest.current.onPlace({kind:'Place',panel:latest.current.selected.panel,placement:{translation:pivot.position.toArray(),rotation_degrees:[pivot.rotation.x,pivot.rotation.y,pivot.rotation.z].map(n=>THREE.MathUtils.radToDeg(n))}})})
  const ray=new THREE.Raycaster();ray.params.Line.threshold=.008
  const hit=e=>{const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const boundary=ray.intersectObjects(lines.children).find(h=>h.object.userData.edge);const surface=ray.intersectObjects(cloth.children)[0];if(boundary&&(!surface||boundary.distance<=surface.distance+.025))return boundary.object.userData;return surface?.object.userData||null}
  let down=null;const start=e=>{down=[e.clientX,e.clientY]},move=e=>latest.current.onHover(hit(e)),end=e=>{if(!transform.dragging&&down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<4)latest.current.onPick(hit(e));down=null}
  renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',end)
  const resize=new ResizeObserver(()=>{const {width,height}=host.current.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()});resize.observe(host.current)
  let frame;const draw=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw)};draw();engine.current={cloth,body,lines,transform,pivot}
  return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();transform.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});renderer.dispose();renderer.domElement.remove();engine.current=null}
 },[])
 useEffect(()=>{
  if(!snapshot||!engine.current)return
  const {cloth,body,lines}=engine.current
  const clear=g=>{for(const o of [...g.children]){o.geometry?.dispose();o.material?.dispose();g.remove(o)}}
  clear(cloth);clear(lines)
  const mesh=(positions,triangles,color)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions.flat(),3));g.setIndex(triangles.flat());g.computeVertexNormals();return new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:.92}))}
  if(snapshot.avatar&&engine.current.avatarData!==snapshot.avatar){clear(body);body.add(mesh(snapshot.avatar.positions,snapshot.avatar.triangles,'#c5c0b7'));engine.current.avatarData=snapshot.avatar}
  snapshot.panels.forEach((p,i)=>{const m=mesh(snapshot.positions,snapshot.triangles.slice(...p.triangles),active?.panel===p.id?'#e4b66d':COLORS[i%COLORS.length]);m.userData={panel:p.id};cloth.add(m)
   for(const [edge,indices] of Object.entries(p.boundaries)){
    const selected=active?.panel===p.id&&(!active.edge||active.edge===edge)
    const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(indices.map(n=>new THREE.Vector3(...snapshot.positions[n]))),new THREE.LineBasicMaterial({color:selected?'#f2693d':'#43555a',depthTest:true}));l.userData={panel:p.id,edge};lines.add(l)
   }
  })
  snapshot.seams.forEach((seam,i)=>{const spec=snapshot.template.seams.find(s=>s.id===seam.id);const emphasized=active&&[spec.a,spec.b].some(b=>b.panel===active.panel&&(!active.edge||b.edge===active.edge));seam.guides.forEach((pair,j)=>{if(!emphasized&&j%4)return;const points=pair.map(w=>new THREE.Vector3(...weighted(w,snapshot.positions)));const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:emphasized?'#f2693d':COLORS[i%COLORS.length],transparent:true,opacity:emphasized?1:.35}));lines.add(l)})})
 },[snapshot,active?.panel,active?.edge])
 useEffect(()=>{const e=engine.current;if(!e)return;e.body.visible=showAvatar;e.lines.visible=showSeams;e.cloth.traverse(o=>{if(o.isMesh&&o.material)o.material.wireframe=wireframe})},[showAvatar,showSeams,wireframe,snapshot?.revision,active?.panel,active?.edge])
 useEffect(()=>{const e=engine.current;if(!e)return;const p=snapshot?.template.panels.find(p=>p.id===selected?.panel);if(p&&['move3d','rotate3d'].includes(mode)){e.pivot.position.fromArray(p.placement.translation);e.pivot.rotation.set(...p.placement.rotation_degrees.map(n=>THREE.MathUtils.degToRad(n)));e.transform.setMode(mode==='move3d'?'translate':'rotate');e.transform.attach(e.pivot)}else e.transform.detach()},[snapshot?.revision,selected?.panel,mode])
 return <div className="cc-scene" ref={host} aria-label="ClothCraft 3D garment and original mannequin"/>
}
function Board({s,active,pick,hover,edit,mode,busy,onPolygon}){
 const svg=useRef(),drag=useRef(),[view,setView]=useState([-0.15,-.15,2.4,1.9]),[draft,setDraft]=useState([])
 const point=e=>{const p=svg.current.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const n=p.matrixTransform(svg.current.getScreenCTM().inverse());return[n.x,n.y]}
 const screen=(p,uv)=>{const a=(p.layout_rotation_degrees||0)*Math.PI/180,r=s.panels.find(r=>r.id===p.id);return[r.layout[0]+uv[0]*Math.cos(a)-uv[1]*Math.sin(a),r.layout[1]+uv[0]*Math.sin(a)+uv[1]*Math.cos(a)]}
 const start=(e,p,anchor)=>{if(busy||mode==='sew'||mode==='pen'||mode==='line'||e.button!==0)return;e.stopPropagation();svg.current.setPointerCapture(e.pointerId);drag.current={p,anchor,start:point(e)};pick({panel:p.id,...(typeof anchor==='number'?{anchor}:{})})}
 const up=e=>{const d=drag.current;drag.current=null;if(!d)return;const q=point(e),delta=q.map((n,i)=>n-d.start[i]);if(Math.hypot(...delta)<.002)return;if(d.pan){setView(v=>[v[0]-delta[0],v[1]-delta[1],v[2],v[3]]);return}const r=s.panels.find(p=>p.id===d.p.id);if(d.anchor!==undefined){const a=-(d.p.layout_rotation_degrees||0)*Math.PI/180;const local=[delta[0]*Math.cos(a)-delta[1]*Math.sin(a),delta[0]*Math.sin(a)+delta[1]*Math.cos(a)];if(typeof d.anchor==='string'){const [,edge,j]=d.anchor.split(':');const polygon=structuredClone(d.p.polygon);polygon.curves[edge][Number(j)]=polygon.curves[edge][Number(j)].map((n,i)=>n+local[i]);edit({kind:'Shape',panel:d.p.id,polygon})}else edit({kind:'Anchor',panel:d.p.id,anchor:d.anchor,position:d.p.polygon.points[d.anchor].map((n,i)=>n+local[i])})}else edit({kind:'BoardTransform',panel:d.p.id,origin:r.layout.map((n,i)=>n+delta[i]),rotation_degrees:d.p.layout_rotation_degrees||0})}
 return <div className="cc-board"><div className="cc-canvas-tools"><button onClick={()=>setView([-.15,-.15,2.4,1.9])}>Frame all</button>{(mode==='pen'||mode==='line')&&<><button disabled={draft.length<(mode==='line'?2:3)||busy} onClick={()=>{onPolygon(draft);setDraft([])}}>{mode==='line'?'Create internal line':'Close pattern'} ({draft.length})</button><button onClick={()=>setDraft([])}>Cancel</button></>}</div><svg ref={svg} viewBox={view.join(' ')} onPointerUp={up} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{if((mode==='pen'||mode==='line')&&!busy){setDraft(p=>[...p,point(e)]);return}drag.current={pan:true,start:point(e)};svg.current.setPointerCapture(e.pointerId)}} onWheel={e=>{const factor=e.deltaY>0?1.1:.9;setView(v=>[v[0],v[1],v[2]*factor,v[3]*factor])}} aria-label="Linked metric 2D pattern board">
  <defs><pattern id="cc-grid" width=".05" height=".05" patternUnits="userSpaceOnUse"><path d="M .05 0 L 0 0 0 .05" fill="none" stroke="#dde0dc" strokeWidth=".001"/></pattern></defs><rect x="-50" y="-50" width="100" height="100" fill="url(#cc-grid)"/>
  {s.panels.map((r,i)=>{const p=s.template.panels.find(p=>p.id===r.id),selected=active?.panel===p.id;return <g key={p.id} onPointerEnter={()=>hover({panel:p.id})} onPointerLeave={()=>hover(null)}>
   <path data-panel={p.id} d={s.triangles.slice(...r.triangles).map(t=>'M'+t.map(n=>screen(p,s.uv[n]).join(',')).join('L')+'Z').join('')} fill={selected?'#f4deb7':COLORS[i%COLORS.length]} fillOpacity=".72" onPointerDown={e=>start(e,p)} onClick={e=>{e.stopPropagation();pick({panel:p.id})}}/>
   {Object.entries(r.boundaries).map(([edge,indices])=><polyline data-edge={`${p.id}:${edge}`} key={edge} points={indices.map(n=>screen(p,s.uv[n]).join(',')).join(' ')} fill="none" stroke={selected&&active.edge===edge?'#ef6339':'#374e57'} strokeWidth={selected&&active.edge===edge?'.009':'.003'} style={{cursor:'crosshair'}} onPointerDown={e=>e.stopPropagation()} onPointerEnter={e=>{e.stopPropagation();hover({panel:p.id,edge})}} onClick={e=>{e.stopPropagation();pick({panel:p.id,edge})}}/>)}
   <text x={r.layout[0]} y={r.layout[1]-.035} fontSize=".027" fill="#34454a">{p.name}</text>
   {selected&&mode==='edit'&&p.polygon?.points.map((uv,n)=>{const q=screen(p,uv);return <circle key={n} cx={q[0]} cy={q[1]} r=".009" fill="#fff" stroke="#f2693d" strokeWidth=".003" onPointerDown={e=>start(e,p,n)}/>})}
   {selected&&mode==='edit'&&Object.entries(p.polygon?.curves||{}).flatMap(([edge,controls])=>controls.map((uv,j)=>{const q=screen(p,uv),n=p.polygon.edges.indexOf(edge),anchor=screen(p,p.polygon.points[(n+j)%p.polygon.points.length]);return <g key={`${edge}-${j}`}><line x1={anchor[0]} y1={anchor[1]} x2={q[0]} y2={q[1]} stroke="#527e91" strokeWidth=".002"/><circle cx={q[0]} cy={q[1]} r=".008" fill="#527e91" stroke="white" strokeWidth=".002" onPointerDown={e=>start(e,p,`c:${edge}:${j}`)}/></g>}))}
  </g>})}
  {s.seams.flatMap((seam,i)=>{const spec=s.template.seams.find(s=>s.id===seam.id),em=active&&[spec.a,spec.b].some(b=>b.panel===active.panel&&(!active.edge||b.edge===active.edge));const uv=s.uv.map((_,i)=>boardPoint(s,i));return seam.guides.filter((_,j)=>em||j%4===0).map((pair,j)=>{const a=weighted(pair[0],uv),b=weighted(pair[1],uv);return <line key={`${i}-${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={em?'#ef6339':COLORS[i%COLORS.length]} strokeWidth={em?'.003':'.0015'} strokeDasharray=".01 .008" opacity={em?1:.35} pointerEvents="none"/>})})}
  {draft.length>0&&<polyline points={draft.map(p=>p.join(',')).join(' ')} fill="none" stroke="#ef6339" strokeWidth=".005" pointerEvents="none"/>}
 </svg><span className="cc-hint">50 mm grid · drag point to reshape · drag panel to arrange · wheel to zoom</span></div>
}
export default function ClothCraftWorkspace({embedded=false,exoSection='Pattern',exoLayout='split',exoSplit=50,environmentPreset='studio'}){
 const [s,setS]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[selected,setSelected]=useState(null),[hovered,setHovered]=useState(null),[mode,setMode]=useState('edit'),[pair,setPair]=useState([]),[reverse,setReverse]=useState(true),[ease,setEase]=useState(false),[playing,setPlaying]=useState(false),[size,setSize]=useState([300,400]),[shape,setShape]=useState('rectangle'),[toolPanel,setToolPanel]=useState(''),[lineId,setLineId]=useState(''),[ruffleWidth,setRuffleWidth]=useState(60),[ruffleRatio,setRuffleRatio]=useState(1.5),[edgeLength,setEdgeLength]=useState(100),[ranges,setRanges]=useState([[0,1],[0,1]])
 const [showBoundingBox,setShowBoundingBox]=useState(false),[showContactDots,setShowContactDots]=useState(true),[showMeasurements,setShowMeasurements]=useState(true),[showSilhouette,setShowSilhouette]=useState(true)
 const [section,setSection]=useState('Pattern'),[libraryTab,setLibraryTab]=useState('Pieces'),[filter,setFilter]=useState(''),[showAvatar,setShowAvatar]=useState(true),[showSeams,setShowSeams]=useState(true),[wireframe,setWireframe]=useState(false),[layout,setLayout]=useState('split'),[libraryOpen,setLibraryOpen]=useState(true),[inspectorOpen,setInspectorOpen]=useState(true)
 const [contextMenu,setContextMenu]=useState(null)
 const [inspectorFabricId,setInspectorFabricId]=useState(null)
 const [fabricHost,setFabricHost]=useState(null)
 // The Fabric Property Editor region may first mount when a Fabric object is
 // selected (after the workspace already switched tabs). Reacquire the portal
 // host on actual native asset selection/revision, not only on section change.
 useEffect(()=>{setFabricHost(embedded?document.getElementById('cc-native-fabric-inspector'):null)},
  [embedded,exoSection,inspectorFabricId,s?.revision])
 const workspaceRoot=useRef(null), shortcutsFocused=useRef(false)
 const state=useRef(),running=useRef(false),runToken=useRef(0),lock=useRef(false),resumeAfterGrab=useRef(false),grabPause=useRef(Promise.resolve());state.current=s
 const request=useCallback(async(data)=>{if(lock.current)return null;lock.current=true;setBusy(true);setError('');try{const res=await fetch(BASE+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.current?.revision,...data})});const result=await res.json();if(result.data?.template){const next={...result.data,avatar:result.data.avatar||(data.op==='open'?null:state.current?.avatar)};state.current=next;setS(next)}if(!res.ok||!result.ok)throw Error(result.error||'ClothCraft request failed');return result.data}catch(e){setError(e.message.includes('OGC initial intersection')?'A panel overlaps the avatar or another panel. Use Move to place it fully clear, then switch to Hand or press SIM. Reset Panels restores the initial arrangement.':e.message);running.current=false;setPlaying(false);return null}finally{lock.current=false;setBusy(false)}},[])
 useEffect(()=>{request({op:'snapshot',avatar:true});const pause=()=>{running.current=false;fetch(BASE+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'pause'}),keepalive:true}).catch(()=>{})};window.addEventListener('pagehide',pause);return()=>{running.current=false;window.removeEventListener('pagehide',pause)}},[request])
 const edit=async c=>{if(running.current){running.current=false;setPlaying(false);while(lock.current)await new Promise(r=>setTimeout(r,20));await request({op:'pause'})}return request({op:'edit',command:c})}
 const pick=value=>{if(embedded)window.dispatchEvent(new CustomEvent('exo-clothcraft-native-pick',{detail:value||null}));setInspectorFabricId(null);if(!value){setSelected(null);setHovered(null);setPair([]);return}setSelected(value);if(mode==='sew'&&value.edge)setPair(p=>p.length===1?[p[0],value]:[value])}
 useEffect(()=>{
  if(!embedded)return undefined
  const chooseFabric=event=>{const id=event.detail?.id;setInspectorFabricId(typeof id==='string'?id:null)}
  const onPropertyEdit=async event=>{
   const d=event.detail||{}
   const outcome={requestId:d.requestId,ok:false,error:'Property could not be saved'}
   const allowedField=['name','itemNo'].includes(d.field)||
     (d.kind==='fabric'&&['construction','supplier','owner'].includes(d.field))
   if(!['pattern','fabric'].includes(d.kind)||!allowedField||typeof d.id!=='string'){
     outcome.error='Unsupported native property edit'
   }else if(running.current||lock.current){
     outcome.error='Pause simulation before editing properties'
   }else{
     const data=await request({op:'set-property',target:d.kind==='pattern'?'panel':'fabric',
       id:d.id,field:d.field,value:d.value,revision:d.revision})
     if(data){outcome.ok=true;delete outcome.error}
     else outcome.error='Native property update failed; check the workspace notice'
   }
   window.dispatchEvent(new CustomEvent('exo-clothcraft-property-result',{detail:outcome}))
  }
  window.addEventListener('exo-clothcraft-select-fabric',chooseFabric)
  window.addEventListener('exo-clothcraft-edit-property',onPropertyEdit)
  return()=>{
   window.removeEventListener('exo-clothcraft-select-fabric',chooseFabric)
   window.removeEventListener('exo-clothcraft-edit-property',onPropertyEdit)
  }
 },[embedded,request])
 useEffect(()=>{
  const onPropertyCommand=event=>{
   const detail=event.detail
   if(detail?.type!=='target-length'||!state.current?.template||running.current)return
   const panel=state.current.template.panels.find(p=>p.id===detail.panel)
   if(!panel?.polygon?.edges?.includes(detail.edge)||!Number.isFinite(detail.cm)||detail.cm<=0||detail.cm>1000)return
   void request({op:'line-spec',panel:detail.panel,edge:detail.edge,target_m:detail.cm/100})
  }
  window.addEventListener('exo-clothcraft-property-command',onPropertyCommand)
  return()=>window.removeEventListener('exo-clothcraft-property-command',onPropertyCommand)
 },[])
 useEffect(()=>{
  const onSelectSeam=event=>{
   const id=event.detail?.seamId
   if(!id){pick(null);return}
   const spec=state.current?.template?.seams?.find(s=>s.id===id)
   if(!spec)return
   setSelected({panel:spec.a.panel,edge:spec.a.edge||spec.a.side,kind:'sewing',seamId:id})
   setHovered(null)
  }
  window.addEventListener('exo-clothcraft-select-seam',onSelectSeam)
  return()=>window.removeEventListener('exo-clothcraft-select-seam',onSelectSeam)
 },[])
 const save=async(download=false)=>{const data=await request({op:'save'});if(!data)return;setNotice('Workspace saved with editable patterns, seams and drape.');if(download){const blob=new Blob([JSON.stringify(data.project,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='exo-clothcraft-fitting-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}}
 const play=async()=>{
  // Starting SIM after Select/Move/Rotate switches to the live Fabric Hand
  // tool, exactly as the native ClothCraft grab workflow. Keep a single
  // simulation loop: the subsequent mode effect must not start a second one.
  const token=++runToken.current
  if(running.current){running.current=false;setPlaying(false);while(lock.current)await new Promise(r=>setTimeout(r,20));await request({op:'pause'});return}
  while(lock.current)await new Promise(r=>setTimeout(r,20))
  if(token!==runToken.current)return
  const started=await request({op:'play'});if(!started||token!==runToken.current)return
  running.current=true;setPlaying(true)
  modeIntent.current='stretch3d'
  setMode('stretch3d')
  while(running.current&&token===runToken.current){
   await new Promise(r=>setTimeout(r,100))
   if(!running.current||token!==runToken.current)break
   const result=await request({op:'snapshot'})
   if(!result||result.running===false)break
  }
  if(token===runToken.current){running.current=false;setPlaying(false)}
 }
 // Mode changes own automatic physics. A pending release must never restart
 // the solver after Select/reset, and an old poll loop must not stop a new one.
 const modeIntent=useRef(mode), modeTransition=useRef(0), previousMode=useRef(mode)
 modeIntent.current=mode
 useEffect(()=>{
  if(previousMode.current===mode)return
  previousMode.current=mode
  const transition=++modeTransition.current
  if(mode!=='stretch3d'){
   livePointer.current.held=false;livePointer.current.ready=false
   void queueLiveGrab(null)
   ++runToken.current;running.current=false;resumeAfterGrab.current=false;setPlaying(false)
  }
  void (async()=>{
   await grabPause.current
   while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
   if(transition!==modeTransition.current)return
   if(mode==='stretch3d'){
    if(!running.current&&!resumeAfterGrab.current)void play()
   }else await request({op:'pause'})
  })()
 },[mode])
 const selectedPanel=s?.template.panels.find(p=>p.id===selected?.panel),active=hovered||selected
 const openPreset=async preset=>{if(s&&!window.confirm('Open a new ClothCraft fixture? Export your current project first if you want to keep a separate copy.'))return;running.current=false;setPlaying(false);setPair([]);setSelected(null);await request({op:'open',preset})}
 const importFile=async e=>{const file=e.target.files?.[0];if(!file)return;try{const project=JSON.parse(await file.text());if(s&&!window.confirm('Replace this workspace with the imported project?'))return;await request({op:'open',...(project.template?{project}:{document:project})});setSelected(null)}catch(err){setError(err.message)}e.target.value=''}
 const boundary=(x,i)=>({panel:x.panel,edge:x.edge,side:'top',range:ranges[i]})
 const activateSection=value=>{setSection(value);if(value==='Sewing')setMode('sew');else if(mode==='sew')setMode('edit');setPair([])}
 const changeViewportMode=value=>{
  if(!['edit','sew','line','move3d','rotate3d','stretch3d'].includes(value))return
  setMode(value)
  setPair([])
  if(value==='sew'||value==='line')setSection('Sewing')
 }
 const openViewportContext=({x,y,dimension,hit})=>{
  shortcutsFocused.current=true
  if(hit?.panel){setSelected(hit);setHovered(null)}
  setContextMenu({x,y,dimension,hit:hit||null})
 }
 const requestHistory=async op=>{
  if(running.current)return
  // React updates the panel list slightly before the prior backend request's
  // busy flag clears. Keyboard repeat/rapid Undo→Redo must wait for the lock
  // rather than silently dropping the second native history operation.
  while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
  if((op==='undo'&&state.current?.canUndo)||(op==='redo'&&state.current?.canRedo))
   return request({op})
  return null
 }
 const contextItems=(()=>{
  if(!contextMenu)return []
  const item=(id,label,shortcut,disabled=false,danger=false)=>({id,label,shortcut,disabled,danger})
  if(contextMenu.dimension==='shortcuts')return [
    item('undo','Undo','⌘Z',!s?.canUndo||busy||playing),
    item('redo','Redo','⌘⇧Z',!s?.canRedo||busy||playing),
    item('save','Save project','⌘S',busy),
    item('select','Select / edit','V'),item('draw','Draw pattern','B'),
    item('sew','Sew boundaries','E'),item('internal','Internal line','I'),
    item('move','Move 3D garment','G'),item('rotate','Rotate 3D garment','R'),
    item('hand','Fabric hand / stretch','H'),
    item('simulate',playing?'Pause simulation':'Start simulation','Space',busy&&!playing),
    item('delete','Delete selected pattern','⌫',!selected?.panel||busy||playing),
  ]
  const is2D=contextMenu.dimension==='2d'
  const hasPanel=Boolean(contextMenu.hit?.panel)
  const canEdit=!busy&&!playing
  const common=[
    item('undo','Undo','⌘Z',!s?.canUndo||!canEdit),
    item('redo','Redo','⌘⇧Z',!s?.canRedo||!canEdit),
    {separator:true},
  ]
  const panelActions=hasPanel ? [
    item('select','Select pattern','V'),
    item(is2D?'internal':'hand',is2D?'Draw internal line':'Fabric hand / stretch',is2D?'I':'H'),
    item('duplicate','Duplicate pattern','',!canEdit),
    item('mirror','Mirror pattern','',!canEdit),
    item('delete','Delete pattern','⌫',!canEdit,true),
    {separator:true},
  ] : []
  const viewActions=is2D ? [
    item('draw','Draw new pattern','B',!canEdit),
    item('sew','Sew boundaries','E',!canEdit),
  ] : [
    item('orbit','Orbit / select','V'),
    item('move','Move garment','G'),
    item('rotate','Rotate garment','R'),
    item('hand','Fabric hand / stretch','H'),
    {separator:true},
    item('avatar',showAvatar?'Hide avatar':'Show avatar'),
    item('wireframe',wireframe?'Hide wireframe':'Show wireframe'),
    item('seams',showSeams?'Hide seam links':'Show seam links'),
    item('simulate',playing?'Pause simulation':'Start simulation','Space',busy&&!playing),
  ]
  return [...common,...panelActions,...viewActions,{separator:true},item('shortcuts','Keyboard shortcuts','?')]
 })()
 const executeContextAction=(id,context)=>{
  const panel=context?.hit?.panel || (context?.dimension==='shortcuts'?selected?.panel:null)
  switch(id){
   case 'undo':if(!playing)void requestHistory('undo');break
   case 'redo':if(!playing)void requestHistory('redo');break
   case 'save':if(!busy)void save(false);break
   case 'select':case 'orbit':changeViewportMode('edit');break
   case 'draw':setMode('pen');setSection('Pattern');setPair([]);break
   case 'internal':changeViewportMode('line');break
   case 'sew':changeViewportMode('sew');break
   case 'move':changeViewportMode('move3d');break
   case 'rotate':changeViewportMode('rotate3d');break
   case 'hand':changeViewportMode('stretch3d');break
   case 'duplicate':if(panel&&!busy&&!playing)void edit({kind:'Duplicate',panel});break
   case 'mirror':if(panel&&!busy&&!playing)void edit({kind:'Mirror',panel,axis:'x',copy_side:1});break
   case 'delete':
    if(panel&&!busy&&!playing&&window.confirm('Remove the selected pattern and its sewing relationships?'))void edit({kind:'RemovePanel',panel})
    break
   case 'avatar':setShowAvatar(v=>!v);break
   case 'wireframe':setWireframe(v=>!v);break
   case 'seams':setShowSeams(v=>!v);break
   case 'simulate':if(!busy||playing)void play();break
   case 'shortcuts':setContextMenu({x:Math.round(window.innerWidth/2-120),y:Math.round(window.innerHeight/2-200),dimension:'shortcuts',hit:null});break
   default:break
  }
 }
 // Preserve the original EXO keyboard focus when users work elsewhere in the
 // native app. Modifier shortcuts only intercept keys while this workspace
 // has been activated, and never while entering property values or file names.
 useEffect(()=>{
  const activate=event=>{
   if(event.target.closest?.('.cc-native-context-menu'))return
   shortcutsFocused.current=Boolean(workspaceRoot.current?.contains(event.target))
  }
  const keyboard=event=>{
   if(!shortcutsFocused.current||event.defaultPrevented)return
   const target=event.target
   if(target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]'))return
   const key=event.key.toLowerCase()
   const modifier=event.metaKey||event.ctrlKey
   let action=null
   if(modifier&&!event.altKey){
    if(key==='z')action=event.shiftKey?'redo':'undo'
    else if(key==='y')action='redo'
    else if(key==='s')action='save'
   } else if(!event.altKey&&!modifier&&!event.shiftKey){
    const map={v:'select',b:'draw',e:'sew',i:'internal',g:'move',r:'rotate',h:'hand',' ':'simulate','?':'shortcuts'}
    action=map[key]||null
    if(key==='delete'||key==='backspace')action='delete'
   } else if(!modifier&&!event.altKey&&event.key==='?')action='shortcuts'
   if(event.key==='Escape'){
    action='select'
    setContextMenu(null)
    setPair([])
    setSelected(null)
   }
   if(!action)return
   event.preventDefault()
   event.stopPropagation()
   event.stopImmediatePropagation?.()
   setContextMenu(null)
   executeContextAction(action,{dimension:'shortcuts',hit:selected})
  }
  document.addEventListener('pointerdown',activate,true)
  window.addEventListener('keydown',keyboard,true)
  return()=>{document.removeEventListener('pointerdown',activate,true);window.removeEventListener('keydown',keyboard,true)}
 },[busy,playing,selected,s?.canUndo,s?.canRedo,contextMenu])
 const downloadText=(content,filename,type)=>{const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
 const exportClothObj=()=>{if(!s)return;const lines=['# EXO ClothCraft Studio research cloth OBJ (not factory fit)','o cloth'];s.positions.forEach(p=>lines.push(`v ${p.join(' ')}`));s.triangles.forEach(t=>lines.push(`f ${t.map(n=>n+1).join(' ')}`));downloadText(lines.join('\n'),'exo-clothcraft-simulation.obj','text/plain');setNotice('Exported the current Rust cloth mesh as a reference OBJ (not fit certified).')}
 const exportPatternSvg=()=>{if(!s)return;const pts=[],lines=s.panels.flatMap((range,i)=>Object.values(range.boundaries).map(indices=>{const coordinates=indices.map(index=>boardPoint(s,index)).map(v=>v.map(n=>n*1000));pts.push(...coordinates);return `<polyline points="${coordinates.map(v=>v.map(n=>n.toFixed(3)).join(',')).join(' ')}" fill="none" stroke="${COLORS[i%COLORS.length]}" stroke-width="1" stroke-linecap="round"/>`}));if(!pts.length)return;const minX=Math.min(...pts.map(p=>p[0]))-50,minY=Math.min(...pts.map(p=>p[1]))-50,maxX=Math.max(...pts.map(p=>p[0]))+50,maxY=Math.max(...pts.map(p=>p[1]))+50;downloadText(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX-minX} ${maxY-minY}"><title>EXO ClothCraft material-space reference only; not a factory pattern</title>${lines.join('')}</svg>`,'exo-clothcraft-pattern-reference.svg','image/svg+xml');setNotice('Saved visual SVG guide. Not a factory pattern or print-to-scale DXF.')}
 // Upstream live mouse spring: coalesce pointer targets, never pause physics
 // or overwrite particles. The solver owns all visible cloth deformation.
 const livePointer=useRef({pending:undefined,sending:false,held:false})
 const queueLiveGrab=async value=>{
  const q=livePointer.current;q.pending=value
  if(q.sending)return
  q.sending=true
  try{
   while(q.pending!==undefined){
    const grab=q.pending;q.pending=undefined
    const response=await fetch(BASE+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'grab',grab})})
    const result=await response.json()
    if(!response.ok||!result.ok)throw Error(result.error||'Live cloth grab failed')
   }
  }catch(error){setError(error.message);q.pending=undefined;q.held=false}
  finally{q.sending=false}
 }
 const startClothGrab=async grab=>{
  livePointer.current.held=true;livePointer.current.ready=false;livePointer.current.target=grab
  while(lock.current)await new Promise(resolve=>setTimeout(resolve,10))
  if(!livePointer.current.held||modeIntent.current!=='stretch3d')return
  if(!running.current){void play();while(lock.current)await new Promise(resolve=>setTimeout(resolve,10))}
  if(livePointer.current.held&&running.current){livePointer.current.ready=true;void queueLiveGrab(livePointer.current.target)}
 }
 const cancelClothGrab=()=>{livePointer.current.held=false;livePointer.current.ready=false;void queueLiveGrab(null)}
 // Reset the *3D simulated pose*, not the authored pattern or sewn edges.
 // This is safe even if the user hits Reset while physics or a fabric grab is
 // running: stop automatic stepping, finish any pending operation, then ask
 // Rust to restore the editable garment's original off-body initial_state.
 const resetPatternPosition=async()=>{
  modeIntent.current='edit';previousMode.current='edit';++modeTransition.current;++runToken.current;setMode('edit')
  if(!state.current?.template){
   const recovered=await request({op:'recover-off-body'})
   if(recovered){
    setSelected(null);setHovered(null);setPair([]);setMode('edit')
    setNotice('Recovered off-body panels from the saved garment. The original project and drape were backed up before recovery. Press SIM to try again.')
   }
   return
  }
  running.current=false
  resumeAfterGrab.current=false
  setPlaying(false)
  await grabPause.current
  while(lock.current)await new Promise(resolve=>setTimeout(resolve,20))
  // A diverged solver may return an error from pause/snapshot even after
  // stopping. Reset must use the cached last-authoritative revision, rather
  // than failing because a previous OGC intersection blocks snapshots.
  await request({op:'pause'})
  await request({op:'snapshot'})
  const result=await request({op:'reset',revision:state.current?.revision})
  if(!result)return
  setPair([])
  setSelected(null)
  setHovered(null)
  setMode('edit')
  setNotice('Patterns returned to their original off-body positions. Pattern shapes, sewing links and materials are preserved. Press SIM to drape again.')
 }
 const pullClothPoint=grab=>{
  livePointer.current.target=grab
  if(livePointer.current.held&&livePointer.current.ready&&modeIntent.current==='stretch3d'&&running.current)void queueLiveGrab(grab)
 }
 const placeVisiblePanel=async command=>{
  const original=state.current?.template?.panels?.find(panel=>panel.id===command.panel)
  if(!original||!command?.placement)return
  if(running.current){running.current=false;setPlaying(false);while(lock.current)await new Promise(resolve=>setTimeout(resolve,20));await request({op:'pause'})}
  // Authored Place arranges flat panels BEFORE simulation. Once draped, move
  // the current solver particles, preserving the other panels' exact pose.
  if(!(state.current?.time>0))return edit(command)
  const prior=original.placement
  const translation_delta=command.placement.translation.map((n,i)=>n-(prior.translation[i]||0))
  const rotation_delta_degrees=command.placement.rotation_degrees.map((n,i)=>n-(prior.rotation_degrees[i]||0))
  const result=await request({op:'pose-panel',panel:command.panel,translation_delta,rotation_delta_degrees})
  if(result)setNotice(`Repositioned ${original.name} as simulated cloth; other draped panels stayed fixed. Connected seams relax on the next physics step.`)
  return result
 }
 const showPiece=item=>{setSelected({panel:item});setHovered(null)}
 const filtered=value=>value.toLowerCase().includes(filter.trim().toLowerCase())
 useEffect(()=>{
  if(!embedded)return undefined
  const dispatch=event=>{
   const command=event.detail
   if(command==='toggle-sim')void play()
   else if(command==='undo'&&!busy)void request({op:'undo'})
   else if(command==='redo'&&!busy)void request({op:'redo'})
   else if(command==='save'&&!busy)void save(false)
   else if(command==='export'&&!busy)void save(true)
   else if(command==='reset'||command==='reset-position')void resetPatternPosition()
   else if(command==='step'&&!busy)void request({op:'step',steps:1})
   else if(command==='duplicate-selected'&&!busy&&selected?.panel)void edit({kind:'Duplicate',panel:selected.panel})
   else if(command==='mirror-selected'&&!busy&&selected?.panel)void edit({kind:'Mirror',panel:selected.panel,axis:'x',copy_side:1})
   else if(command==='delete-selected'&&!busy&&selected?.panel){
    if(window.confirm('Remove the selected ClothCraft panel and all its seams?'))void edit({kind:'RemovePanel',panel:selected.panel})
   }
   else if(command==='wireframe')setWireframe(x=>!x)
   else if(command==='seams')setShowSeams(x=>!x)
   else if(command==='avatar')setShowAvatar(x=>!x)
   else if(typeof command==='string'&&command.startsWith('set-wireframe:'))setWireframe(command.endsWith('true'))
   else if(typeof command==='string'&&command.startsWith('set-seams:'))setShowSeams(command.endsWith('true'))
   else if(typeof command==='string'&&command.startsWith('select:')){
    const id=command.slice(7).toLowerCase()
    const matching=state.current?.template?.panels.find(p=>p.id.toLowerCase()===id||p.name.toLowerCase()===id)
    if(matching)setSelected({panel:matching.id})
   }
   else if(typeof command==='string'&&command.startsWith('mode:')){setMode(command.slice(5));setPair([])}
  }
  window.addEventListener('exo-clothcraft-command',dispatch)
  return()=>window.removeEventListener('exo-clothcraft-command',dispatch)
 },[embedded,busy,play,request])
 useEffect(()=>{
  if(!embedded||!s)return
  const panelRefs=(s.template?.panels||[]).map(p=>({
    id:p.id,name:p.name,type:'pattern',itemNo:s.propertyMetadata?.panels?.[p.id]?.itemNo||'',
    fabricId:p.fabric,
  }))
  const fabricRefs=(s.template?.fabrics||[]).map(f=>({
    id:f.id,name:f.name,type:'fabric',itemNo:s.propertyMetadata?.fabrics?.[f.id]?.itemNo||'',
    properties:f.properties||null,
  }))
  const measuredSelection=measureNativeSelection(s,selected)
  const activePanel=panelRefs.find(p=>p.id===measuredSelection?.panelId)
  window.dispatchEvent(new CustomEvent('exo-clothcraft-status',{detail:{
   name:s.template?.name||'ClothCraft garment',revision:s.revision||0,
   panels:s.template?.panels?.length||0,seams:s.template?.seams?.length||0,
   panelRefs,fabricRefs,
   seamRefs:s.template?.seams?.map(seam=>({id:seam.id,first:seam.a?.panel,second:seam.b?.panel}))||[],
   vertices:s.positions?.length||0, time:s.time||0,running:playing,busy,mode,
   canUndo:Boolean(s.canUndo),canRedo:Boolean(s.canRedo),
   selection:measuredSelection?{...measuredSelection,itemNo:activePanel?.itemNo||''}:null,
  }}))
 },[embedded,playing,busy,mode,selected?.panel,selected?.edge,selected?.seamId,s?.revision,s?.positions,s?.propertyMetadata,s?.template?.name,s?.template?.panels?.length,s?.template?.fabrics,s?.template?.seams?.length,s?.canUndo,s?.canRedo,Math.floor(s?.time||0)])
 if(embedded){
  const layout=exoLayout==='3d'?'3d':exoLayout==='2d'?'2d':exoLayout==='stack'?'stack':'split'
  const nativeFabricPanel=inspectorFabricId?
    s?.template?.panels?.find(p=>p.fabric===inspectorFabricId)||null:selectedPanel
  return <div ref={workspaceRoot} className={`cc-embedded-root cc-embedded-${layout}`} aria-label="ClothCraft linked native Rust 3D and 2D editors" data-native-clothcraft="true" style={{'--cc-embedded-split':`${exoSplit}%`}}>
   <ClothCraftContextMenu context={contextMenu} items={contextItems} onChoose={executeContextAction} onClose={()=>setContextMenu(null)}/>
   {(error||notice)&&<div className={error?'cc-error':'cc-notice'} role="status">{error||notice}<button onClick={()=>{setError('');setNotice('')}}>×</button></div>}
   {exoSection==='Fabric'&&(fabricHost?createPortal(<ClothCraftFabricLibrary snapshot={s} panel={nativeFabricPanel} busy={busy||playing} onEdit={edit}/>,fabricHost):<div className="cc-native-fabric-dock"><ClothCraftFabricLibrary snapshot={s} panel={nativeFabricPanel} busy={busy||playing} onEdit={edit}/></div>)}
   <div className="cc-embedded-main">
    <section className="cc-view cc-viewport-3d" aria-label="ClothCraft 3D garment viewport"><ClothCraftSceneV2 snapshot={s} active={hovered||selected} selected={selected} mode={mode==='stretch3d'?'stretch3d':playing||busy?'edit':mode} onContextMenuRequest={event=>openViewportContext({...event,dimension:'3d'})} onCanvasActivate={()=>{shortcutsFocused.current=true}} onChangeMode={changeViewportMode} toolsDisabled={busy&&!playing} onPick={pick} onHover={setHovered} onPlace={placeVisiblePanel} showAvatar={showAvatar} showSeams={showSeams} wireframe={wireframe} showBoundingBox={showBoundingBox} showContactDots={showContactDots} onStretchStart={startClothGrab} onStretchCancel={cancelClothGrab} onStretchDrag={pullClothPoint} environmentPreset={environmentPreset}/></section>
    <section className="cc-view cc-viewport-2d" aria-label="ClothCraft 2D pattern viewport">{s&&<ClothCraftBoardV2 showMeasurements={showMeasurements} showSilhouette={showSilhouette} showAvatar={showAvatar} showSeamDots={showContactDots} s={s} selection={selected} active={hovered||selected} pick={pick} hover={setHovered} edit={edit} mode={mode} onChangeMode={changeViewportMode} onContextMenuRequest={openViewportContext} busy={busy||playing} onPolygon={points=>{if(mode==='line'){if(!selectedPanel){setError('Select a panel before drawing an internal line.');return}const r=s.panels.find(p=>p.id===selectedPanel.id),a=-(selectedPanel.layout_rotation_degrees||0)*Math.PI/180;const local=points.map(p=>{const u=p[0]-r.layout[0],v=p[1]-r.layout[1];return[u*Math.cos(a)-v*Math.sin(a),u*Math.sin(a)+v*Math.cos(a)]});edit({kind:'InternalLine',panel:selectedPanel.id,points:local,tangents:local.map(()=>[0,0])})}else edit({kind:'Polygon',points,tangents:points.map(()=>[0,0]),fabric:s.template.fabrics[0].id})}}/>}</section>
   </div>
   <div className="cc-embedded-bottom"><div><button className={mode==='edit'?'active':''} onClick={()=>setMode('edit')}><MousePointer2 size={13}/> Select / edit</button><button className={mode==='sew'?'active':''} onClick={()=>{setMode('sew');setPair([])}}><Scissors size={13}/> Sew edges</button><button className={mode==='pen'?'active':''} onClick={()=>setMode('pen')}><PenTool size={13}/> Draw</button><button className={mode==='line'?'active':''} onClick={()=>setMode('line')}>Internal line</button><button onClick={()=>setMode('move3d')} className={mode==='move3d'?'active':''}>Move 3D</button><button onClick={()=>setMode('rotate3d')} className={mode==='rotate3d'?'active':''}>Rotate 3D</button><button onClick={()=>setMode('stretch3d')} className={mode==='stretch3d'?'active':''} title="Pull a fabric region without resetting other panels">Grab / stretch</button><button onClick={()=>void resetPatternPosition()} title="Reset all simulated cloth to initial spaced-out assembly">Spread panels</button></div><div><button className={showAvatar?'active':''} onClick={()=>setShowAvatar(x=>!x)}>Avatar</button><button className={showSeams?'active':''} onClick={()=>setShowSeams(x=>!x)}>Seams</button><button className={wireframe?'active':''} onClick={()=>setWireframe(x=>!x)}>Wireframe</button><button className={showBoundingBox?'active':''} onClick={()=>setShowBoundingBox(x=>!x)}>Bounds</button><button className={showContactDots?'active':''} onClick={()=>setShowContactDots(x=>!x)}>Seam dots</button><button className={showMeasurements?'active':''} onClick={()=>setShowMeasurements(x=>!x)}>Dimensions</button></div></div>
   <div className="cc-embedded-footer"><strong>{busy?'Computing…':playing?'Running Rust simulation':'Rust session ready'}</strong><span>{s?.positions.length??0} vertices · {s?.time?.toFixed(3)??'—'} s · Seam gap {s?.metrics?.max_seam_gap_m!=null?(s.metrics.max_seam_gap_m*1000).toFixed(2)+' mm':'—'} · P95 stretch {s?.metrics?.extension_p95_percent?.toFixed(2)??'—'}%</span><small>Physical fit not certified</small></div>
  </div>
 }
 return <main ref={workspaceRoot} className="cc-workspace cc-exo-shell"><ClothCraftContextMenu context={contextMenu} items={contextItems} onChoose={executeContextAction} onClose={()=>setContextMenu(null)}/><header className="cc-header"><div className="cc-brand"><Box size={18}/><strong>EXO <span>SAMPLE 3D</span></strong><small>× CLOTHCRAFT ENGINE</small></div><div className="cc-exo-menus"><button onClick={()=>setLibraryOpen(v=>!v)} aria-label="Toggle asset library"><FolderOpen size={15}/> LIBRARY</button><button onClick={()=>setInspectorOpen(v=>!v)} aria-label="Toggle property editor"><Settings2 size={15}/> PROPERTIES</button><select aria-label="EXO workspace section" value={section} onChange={e=>activateSection(e.target.value)}>{EXO_SECTIONS.map(([name])=><option key={name}>{name}</option>)}</select><select aria-label="Viewport layout" value={layout} onChange={e=>setLayout(e.target.value)}><option value="split">3D + 2D</option><option value="3d">3D focus</option><option value="2d">2D focus</option></select></div><div className="cc-header-actions"><label className="cc-button" title="Open ClothCraft or compatible EXO garment project"><FolderOpen size={14}/> Open project<input type="file" accept=".json" hidden disabled={busy||playing} onChange={importFile}/></label><button onClick={()=>save(false)} disabled={busy||playing||!s} title="Save current Rust garment project"><Save size={15}/> Save</button><button onClick={()=>save(true)} disabled={busy||playing||!s}><Download size={15}/> Save / export</button><a href="?desktop=1" title="Open the full EXO interface">FULL EXO <ChevronRight size={14}/></a></div></header>
 <div className="cc-project-bar"><div><strong>GARMENT STUDIO</strong><span>{s?.template.name||'Loading ClothCraft project…'}</span><small>REV {s?.revision??'—'} · {s?.template.panels.length??0} PANELS · {s?.template.seams.length??0} SEAMS</small></div><div className="cc-project-fittings"><span className="cc-online-dot"/> RUST VBD + OGC <span className="cc-project-status">{playing?'SIMULATING':busy?'WORKING':'READY'}</span></div></div>
 <nav className="cc-toolbar"><div>{[['edit','Select / edit',MousePointer2],['sew','Sew edges',Scissors],['pen','Draw pattern',PenTool],['line','Internal line',Layers],['move3d','Move 3D',Move3D],['rotate3d','Rotate 3D',Rotate3D]].map(([key,label,Icon])=><button key={key} title={label} aria-pressed={mode===key} className={mode===key?'active':''} onClick={()=>{setMode(key);setPair([]);if(key==='sew')setSection('Sewing');else if(key==='line')setSection('Sewing');else if(key==='pen')setSection('Pattern')}}><Icon size={15}/>{label}</button>)}</div><div><button disabled={busy||playing||!s?.canUndo} onClick={()=>request({op:'undo'})}><Undo2 size={15}/>Undo</button><button disabled={busy||playing||!s?.canRedo} onClick={()=>request({op:'redo'})}><Redo2 size={15}/>Redo</button><button disabled={(!playing&&busy)||!s} className="cc-primary" onClick={play}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?'Pause':'Simulate'}</button><button disabled={busy||playing||!s} onClick={()=>request({op:'step',steps:1})}>Single step</button><button disabled={busy||playing||!s} onClick={()=>void resetPatternPosition()}><RotateCcw size={15}/>Reset arrangement</button></div></nav>
 {(error||notice)&&<div className={error?'cc-error':'cc-notice'} role="status">{error||notice}<button onClick={()=>{setError('');setNotice('')}}>×</button></div>}
 <div className={`cc-body cc-layout-${layout} ${libraryOpen?'':'cc-no-library'} ${inspectorOpen?'':'cc-no-inspector'}`}>
 <nav className="cc-exo-rail" aria-label="EXO tool categories">{EXO_SECTIONS.map(([name,Icon])=><button key={name} className={section===name?'active':''} aria-pressed={section===name} title={name} onClick={()=>activateSection(name)}><Icon size={19}/><span>{name}</span></button>)}</nav>
 {libraryOpen&&<aside className="cc-pieces" aria-label="EXO asset browser"><div className="cc-side-title"><span>ASSET BROWSER</span><FolderOpen size={15}/></div><div className="cc-library-tabs">{['Pieces','Seams','Library','History'].map(tab=><button key={tab} className={tab===libraryTab?'active':''} onClick={()=>setLibraryTab(tab)}>{tab}</button>)}</div><label className="cc-search"><Search size={14}/><input aria-label="Search library items" value={filter} onChange={e=>setFilter(e.target.value)} placeholder={`Find ${libraryTab.toLowerCase()}…`}/></label>
 {libraryTab==='Pieces'&&<><h3>GARMENT · {s?.template.panels.length??0} PANELS</h3><p>{s?.template.name||'Connecting…'}</p>{s?.template.panels.filter(p=>filtered(p.name)).map((p,i)=><button data-piece={p.id} key={p.id} className={active?.panel===p.id?'active':''} onMouseEnter={()=>setHovered({panel:p.id})} onMouseLeave={()=>setHovered(null)} onClick={()=>showPiece(p.id)}><i style={{background:COLORS[i%COLORS.length]}}/>{p.name}<ChevronRight size={13}/></button>)}</>}
 {libraryTab==='Seams'&&<><h3>SEWING RELATIONSHIPS · {s?.template.seams.length??0}</h3>{s?.template.seams.filter(item=>filtered(item.id)).map(seam=><div className="cc-seam-row" key={seam.id} onMouseEnter={()=>setHovered({panel:seam.a.panel,edge:seam.a.edge})} onMouseLeave={()=>setHovered(null)}><button onClick={()=>{setSelected({panel:seam.a.panel,edge:seam.a.edge,kind:'sewing',seamId:seam.id});activateSection('Sewing')}}>{seam.id}</button><button aria-label={`Delete seam ${seam.id}`} disabled={busy||playing} onClick={()=>edit({kind:'RemoveSeam',seam:seam.id})}>×</button></div>)}</>}
 {libraryTab==='Library'&&<><h3>STARTING BLOCKS</h3>{[['T-shirt','tshirt'],['Dress','dress']].filter(([name])=>filtered(name)).map(([name,preset])=><button key={preset} disabled={busy||playing} onClick={()=>openPreset(preset)}><Shirt size={15}/>{name} fixture</button>)}<h3>NEW PATTERN ELEMENTS</h3><button onClick={()=>{activateSection('Pattern');setShape('rectangle')}}><FilePlus2 size={14}/> Rectangle</button><button onClick={()=>{activateSection('Pattern');setShape('ellipse')}}><FilePlus2 size={14}/> Ellipse</button><button onClick={()=>{activateSection('Pattern');setMode('pen')}}><PenTool size={14}/> Draw custom outline</button></>}
 {libraryTab==='History'&&<><h3>SESSION HISTORY</h3><p>Revision {s?.revision??0}</p><button disabled={!s?.canUndo||busy||playing} onClick={()=>request({op:'undo'})}><Undo2 size={15}/> Undo last edit</button><button disabled={!s?.canRedo||busy||playing} onClick={()=>request({op:'redo'})}><Redo2 size={15}/> Redo last edit</button><p>The Rust editing history supports undo/redo; save a project for persistent revisions.</p></>}
 <footer>EXO asset workspace · ClothCraft physics<br/>Unsupported EXO-specific production features remain in Full EXO</footer></aside>}
 <section className="cc-view cc-viewport-3d"><h2><span><Box size={14}/> 3D GARMENT</span><small>ClothCraft linked viewport · Orbit / select</small></h2><ClothCraftSceneV2 snapshot={s} active={active} selected={selected} mode={mode==='stretch3d'?'stretch3d':playing||busy?'edit':mode} onContextMenuRequest={event=>openViewportContext({...event,dimension:'3d'})} onCanvasActivate={()=>{shortcutsFocused.current=true}} onChangeMode={changeViewportMode} toolsDisabled={busy&&!playing} onPick={pick} onHover={setHovered} onPlace={placeVisiblePanel} showAvatar={showAvatar} showSeams={showSeams} wireframe={wireframe} showBoundingBox={showBoundingBox} showContactDots={showContactDots} onStretchStart={startClothGrab} onStretchCancel={cancelClothGrab} onStretchDrag={pullClothPoint} environmentPreset={environmentPreset}/></section><section className="cc-view cc-viewport-2d"><h2><span><Grid2X2 size={14}/> 2D PATTERN</span><small>True material geometry · metres</small></h2>{s&&<ClothCraftBoardV2 showMeasurements={showMeasurements} showSilhouette={showSilhouette} showAvatar={showAvatar} showSeamDots={showContactDots} s={s} selection={selected} active={active} pick={pick} hover={setHovered} edit={edit} mode={mode} onChangeMode={changeViewportMode} onContextMenuRequest={openViewportContext} busy={busy||playing} onPolygon={points=>{if(mode==='line'){if(!selectedPanel){setError('Select a panel before drawing an internal line.');return}const r=s.panels.find(p=>p.id===selectedPanel.id),a=-(selectedPanel.layout_rotation_degrees||0)*Math.PI/180;const local=points.map(p=>{const u=p[0]-r.layout[0],v=p[1]-r.layout[1];return[u*Math.cos(a)-v*Math.sin(a),u*Math.sin(a)+v*Math.cos(a)]});edit({kind:'InternalLine',panel:selectedPanel.id,points:local,tangents:local.map(()=>[0,0])})}else edit({kind:'Polygon',points,tangents:points.map(()=>[0,0]),fabric:s.template.fabrics[0].id})}}/>}</section>
 {inspectorOpen&&<aside className="cc-inspector" aria-label="EXO property editor"><div className="cc-inspector-heading"><span>PROPERTY EDITOR</span><strong>{section.toUpperCase()}</strong></div><div className="cc-inspector-context"><small>{selectedPanel?'ACTIVE PATTERN':'NO PATTERN SELECTED'}</small><strong>{selectedPanel?.name||'Project settings'}</strong>{selected?.edge&&<span>Edge: {selected.edge}</span>}</div>
 {section==='Pattern'&&<p className="cc-section-intro">Author material-space patterns with ClothCraft's original 2D and 3D editors.</p>}
 {section==='Sewing'&&<p className="cc-section-intro">Select two boundaries in either viewport, inspect their correspondence, then sew using Rust's native authoring engine.</p>}
 {section==='Fabric'&&<p className="cc-section-intro">Edit the selected panel's actual physical material values in the ClothCraft solver.</p>}
 {section==='Avatar'&&<><fieldset><legend>AVATAR · COLLISION BODY</legend><p>Current body: ClothCraft CC0 MakeHuman mannequin. Its triangles feed Rust VBD + OGC contact.</p><label><span>Show avatar</span><input type="checkbox" checked={showAvatar} onChange={e=>setShowAvatar(e.target.checked)}/></label><small>Additional EXO avatars, including Thomas, can be used in Full EXO. They are not yet switchable in this persistent Rust session.</small></fieldset><fieldset><legend>BODY MESH DIAGNOSTICS</legend><p>{s?.avatar?.positions.length??'—'} vertices · {s?.avatar?.triangles.length??'—'} triangles</p></fieldset></>}
 {section==='Fit'&&<><fieldset><legend>RUST SIMULATION</legend><p>{s?.backend||'Connecting Rust solver…'}</p><button disabled={busy||!s} onClick={play}>{playing?'Pause simulation':'Simulate garment'}</button><button disabled={busy||playing||!s} onClick={()=>request({op:'step',steps:1})}>Single step</button><button disabled={busy||playing||!s} onClick={()=>void resetPatternPosition()}>Reset arrangement</button></fieldset><fieldset><legend>LIVE CONTACT / FIT</legend><p>Physics time: {s?.time?.toFixed(3)??'—'} s</p><p>Worst seam gap: {s?.metrics?.max_seam_gap_m!=null?(s.metrics.max_seam_gap_m*1000).toFixed(2)+' mm':'—'}</p><p>Stretch p95: {s?.metrics?.extension_p95_percent?.toFixed(2)??'—'}%</p><p>Active contacts: {s?.metrics?.contacts??'—'}</p><p className="cc-warning">Collision and garment fit are experimental. These numbers do not certify a production-ready fit.</p></fieldset></>}
 {section==='Production'&&<><fieldset><legend>EXO FILE OUTPUT</legend><button disabled={busy||playing||!s} onClick={()=>save(true)}><Download size={14}/> Export editable fitting project JSON</button><button disabled={!s} onClick={exportClothObj}><Box size={14}/> Export current drape OBJ</button><button disabled={!s} onClick={exportPatternSvg}><Grid2X2 size={14}/> Export pattern reference SVG</button><p>Visual SVG is not a print-to-scale factory pattern. Full EXO has the grading, DXF, tech packs and production handoff tools.</p><a href="?desktop=1" className="cc-go-classic">Open full EXO production workspace <ChevronRight size={13}/></a></fieldset></>}
 {section==='Render'&&<><fieldset><legend>3D DISPLAY</legend><label>Avatar body<input type="checkbox" checked={showAvatar} onChange={e=>setShowAvatar(e.target.checked)}/></label><label>Seam correspondences<input type="checkbox" checked={showSeams} onChange={e=>setShowSeams(e.target.checked)}/></label><label>Cloth wireframe<input type="checkbox" checked={wireframe} onChange={e=>setWireframe(e.target.checked)}/></label></fieldset><fieldset><legend>VIEWPORT LAYOUT</legend><select aria-label="Render viewport layout" value={layout} onChange={e=>setLayout(e.target.value)}><option value="split">Side by side</option><option value="3d">3D focus</option><option value="2d">2D focus</option></select><p>Studio lighting and material rendering in Full EXO are separate from ClothCraft's physical material controls.</p></fieldset></>}
 {section==='Sewing'&&<fieldset><legend>Sewing correspondence</legend><p>{pair.map(p=>`${p.panel} / ${p.edge}`).join(' → ')||'Pick two edges in either view'}</p><label><input type="checkbox" checked={reverse} onChange={e=>setReverse(e.target.checked)}/> Reverse second edge</label><label><input type="checkbox" checked={ease} onChange={e=>setEase(e.target.checked)}/> Allow easing / unequal lengths</label>{ranges.map((range,i)=><label key={i}>Edge {'AB'[i]} interval{range.map((n,j)=><input key={j} aria-label={`Edge ${'AB'[i]} ${j?'end':'start'}`} type="number" min="0" max="1" step=".05" value={n} onChange={e=>setRanges(v=>v.map((r,k)=>k===i?r.map((n,l)=>l===j?Number(e.target.value):n):r))}/>)}</label>)}<button disabled={busy||pair.length!==2} onClick={async()=>{const r=await edit({kind:'Sew',a:boundary(pair[0],0),b:boundary(pair[1],1),reverse,ease});if(r)setPair([])}}>Create seam</button><button onClick={()=>setPair([])}>Cancel</button></fieldset>}
 {section==='Pattern'&&<fieldset><legend>Add pattern</legend><select value={shape} onChange={e=>setShape(e.target.value)}><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="sector">Arc sector</option></select>{size.map((n,i)=><label key={i}>{i?'Height':'Width'} (mm)<input type="number" value={n} min="5" max="10000" onChange={e=>setSize(v=>v.map((n,k)=>k===i?Number(e.target.value):n))}/></label>)}<button disabled={busy||!s} onClick={()=>edit({kind:'Primitive',shape,size:size.map(n=>n/1000),origin:[0,0],fabric:s.template.fabrics[0].id})}>Create piece</button></fieldset>}
 {selectedPanel&&['Pattern','Fabric'].includes(section)&&<>{section==='Pattern'&&<><fieldset><legend>Pattern operations</legend><button disabled={busy||playing} onClick={()=>edit({kind:'Duplicate',panel:selectedPanel.id})}>Duplicate</button>{['x','y'].map(axis=><button key={axis} disabled={busy||playing} onClick={()=>edit({kind:'Mirror',panel:selectedPanel.id,axis,copy_side:1})}>Mirror {axis.toUpperCase()}</button>)}<button disabled={busy||playing} onClick={()=>{if(confirm('Remove this panel and its sewing relationships?'))edit({kind:'RemovePanel',panel:selectedPanel.id})}}>Remove piece</button></fieldset><fieldset><legend>3D arrangement</legend>{['translation','rotation_degrees'].map(key=><div key={key}><small>{key==='translation'?'Position (m)':'Rotation (°)'}</small>{selectedPanel.placement[key].map((n,i)=><label key={`${selectedPanel.id}-${key}-${i}-${n}`}>{'XYZ'[i]}<input type="number" step={key==='translation'?'.01':'5'} defaultValue={n} disabled={busy||playing} onBlur={e=>edit({kind:'Place',panel:selectedPanel.id,placement:{...selectedPanel.placement,[key]:selectedPanel.placement[key].map((n,j)=>i===j?Number(e.target.value):n)}})}/></label>)}</div>)}</fieldset></>}{section==='Fabric'&&<ClothCraftFabricLibrary snapshot={s} panel={selectedPanel} busy={busy||playing} onEdit={edit}/>}</>}
 {section==='Pattern'&&selectedPanel?.polygon&&<fieldset><legend>Points and curves</legend><select aria-label="Pattern point" value={selected?.anchor??0} onChange={e=>setSelected({panel:selectedPanel.id,anchor:Number(e.target.value)})}>{selectedPanel.polygon.points.map((_,i)=><option key={i} value={i}>Point {i+1}</option>)}</select>{selectedPanel.polygon.points[selected?.anchor??0]?.map((n,i)=><label key={`${selectedPanel.id}-${selected?.anchor}-${i}-${n}`}>{i?'Y':'X'} (mm)<input type="number" defaultValue={n*1000} disabled={busy||playing} onBlur={e=>{const anchor=selected?.anchor??0,position=[...selectedPanel.polygon.points[anchor]];position[i]=Number(e.target.value)/1000;edit({kind:'Anchor',panel:selectedPanel.id,anchor,position})}}/></label>)}<button disabled={busy||playing} onClick={()=>edit({kind:'CurvePoint',panel:selectedPanel.id,anchor:selected?.anchor??0,curved:true})}>Curve point</button><button disabled={busy||playing} onClick={()=>edit({kind:'CurvePoint',panel:selectedPanel.id,anchor:selected?.anchor??0,curved:false})}>Straighten point</button><button disabled={busy||playing} onClick={()=>edit({kind:'RemovePoint',panel:selectedPanel.id,point:selected?.anchor??0})}>Remove point</button></fieldset>}
 {section==='Sewing'&&selected?.edge&&<fieldset><legend>Boundary length</legend><label>Length (mm)<input type="number" min="1" value={edgeLength} onChange={e=>setEdgeLength(Number(e.target.value))}/></label><button disabled={busy||playing} onClick={()=>edit({kind:'TargetLength',panel:selected.panel,edge:selected.edge,target_m:edgeLength/1000})}>Set target length</button><button disabled={busy||playing} onClick={()=>edit({kind:'SplitBoundary',panel:selected.panel,edge:selected.edge,at_m:edgeLength/1000})}>Split at distance</button></fieldset>}
 {section==='Pattern'&&selectedPanel&&<fieldset><legend>Combine patterns / cut holes</legend><select aria-label="Boolean tool panel" value={toolPanel} onChange={e=>setToolPanel(e.target.value)}><option value="">Choose second panel</option>{s.template.panels.filter(p=>p.id!==selectedPanel.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{['union','difference','intersection'].map(operation=><button key={operation} disabled={busy||!toolPanel} onClick={()=>edit({kind:'Boolean',a:selectedPanel.id,b:toolPanel,operation,keep_tool:true})}>{operation==='union'?'Join':operation==='difference'?'Subtract / hole':'Intersection'}</button>)}</fieldset>}
 {section==='Sewing'&&selectedPanel?.polygon?.lines?.length>0&&<fieldset><legend>Internal sewing / ruffle</legend><select value={lineId||selectedPanel.polygon.lines[0].id} onChange={e=>setLineId(e.target.value)}>{selectedPanel.polygon.lines.map(l=><option key={l.id} value={l.id}>{l.id}</option>)}</select><label>Width (mm)<input type="number" value={ruffleWidth} onChange={e=>setRuffleWidth(Number(e.target.value))}/></label><label>Gather ratio<input type="number" step=".1" value={ruffleRatio} onChange={e=>setRuffleRatio(Number(e.target.value))}/></label><button disabled={busy||playing} onClick={()=>edit({kind:'Ruffle',panel:selectedPanel.id,line:lineId||selectedPanel.polygon.lines[0].id,width:ruffleWidth/1000,ratio:ruffleRatio})}>Create and sew ruffle</button><button disabled={busy||playing} onClick={()=>edit({kind:'RemoveLine',panel:selectedPanel.id,line:lineId||selectedPanel.polygon.lines[0].id})}>Remove internal line</button></fieldset>}
 </aside>}</div><footer className="cc-status"><span>{busy?'Computing…':playing?'Simulating':'Ready'} · {s?.backend||'Connecting to native workspace'}</span><span>{s?.positions.length||0} vertices · {s?.time?.toFixed(3)||'0'} s · Seam gap {s?.metrics?.max_seam_gap_m!=null?(s.metrics.max_seam_gap_m*1000).toFixed(2)+' mm':'—'} · P95 stretch {s?.metrics?.extension_p95_percent?.toFixed(2)??'—'}%</span><small>{s?.metrics?.max_seam_gap_m>.015&&s?.time>4?'Seams remain open — adjust arrangement':'Normal contact · no friction · fit not certified'}</small></footer></main>
}
