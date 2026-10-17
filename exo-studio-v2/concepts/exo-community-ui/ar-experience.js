// EXO manual camera composition studio. No body tracking, plane detection, or hardware projection.
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
const patternSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 340"><g fill="#d9d8d1" fill-opacity=".24" stroke="#f4f0e5" stroke-width="2"><path d="M34 55 93 24 153 47 174 114 140 131 132 286 48 286 45 132 15 111Z"/><path d="M205 47 264 24 321 55 340 111 310 132 307 286 223 286 215 131 185 114Z"/><path d="M371 50 433 65 437 268 358 268 363 105Z"/></g><g stroke="#e7dcbf" stroke-dasharray="5 5" fill="none" stroke-width="1.5"><path d="M49 126H139M89 32V276M225 126H308M264 32V276M374 105 427 105M370 255H430"/></g><g fill="#f4f0e5" font-family="sans-serif" font-size="10"><text x="52" y="309">FRONT / 01</text><text x="226" y="309">BACK / 02</text><text x="358" y="292">SLEEVE / 03</text></g></svg>`;
const defaultGarmentSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 430"><path fill="#373b40" stroke="#c2c4c7" stroke-width="3" d="M112 19 160 45 208 19 266 48 314 167 252 197 227 128 229 403 91 403 93 128 68 197 6 167 54 48Z"/><path fill="#242529" stroke="#98999e" stroke-width="3" d="M112 19Q160 101 208 19L190 6Q160 35 130 6Z"/><path fill="none" stroke="#a0a2a7" stroke-width="3" d="M93 128Q121 151 160 148T227 128M112 19Q123 89 106 167L113 368M208 19Q197 89 214 167L207 368M91 385H229"/><path fill="none" stroke="#666970" stroke-width="15" opacity=".6" d="M131 106V363M163 111V363M192 106V363"/></svg>`;
function svgData(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}

export function mountARExperience(container,{projects=[],onMarketplace=()=>{},onOpenProject=()=>{}}={}){
 if(!container) return {destroy(){}};
 let mode='garment',facing='user',stream=null,request=0,removed=false,visible=true,observer=null,objectURL=null,drag=null;
 let position={x:50,y:50,scale:1,rotation:0},corners={tl:0,tr:0,br:0,bl:0},grid=true,ruler=true,calibration=30;
 const available=(Array.isArray(projects)?projects:[]).filter(p=>p?.image);
 const selected=available.find(p=>p.category==='Garments')||available.find(p=>p.category==='Patterns')||available[0];
 const demo=available.find(p=>p.category==='Avatars')||available.find(p=>p.category==='Scenes')||available[0];
 const tableDemo=available.find(p=>p.id==='studio-09')||available.find(p=>p.category==='Scenes')||demo;
 const garmentFallback=svgData(defaultGarmentSVG),patternFallback=svgData(patternSVG);
 let asset=garmentFallback;
 const stock=mode=> mode==='garment'?garmentFallback:patternFallback;
 container.classList.add('exo-ar-root');
 container.innerHTML=`<section class="exo-ar" aria-label="EXO AR composition studio">
 <div class="exo-ar-top"><div><p class="exo-ar-eyebrow">EXO LAB / EXPERIMENTAL SPACE</p><h2>See it in your space.</h2><p class="exo-ar-sub">Compose garments and pattern pieces over a camera view. Adjust everything by hand.</p></div><button class="exo-ar-market" type="button" data-action="market">EXPLORE THE MARKETPLACE ↗</button></div>
 <div class="exo-ar-tabs" role="tablist" aria-label="Experience mode"><button type="button" role="tab" data-mode="garment" aria-selected="true">Virtual Try-On</button><button type="button" role="tab" data-mode="table" aria-selected="false">Table Projection</button></div>
 <div class="exo-ar-layout"><div class="exo-ar-stage-col"><div class="exo-ar-stage" id="exo-ar-stage" aria-label="Manual image alignment workspace">
   <img class="exo-ar-demo" alt="" src="${escapeHTML(demo?.image||'')}" ${demo?.image?'':'hidden'}>
   <video class="exo-ar-video" playsinline muted autoplay aria-label="Live camera preview" hidden></video>
   <div class="exo-ar-guide"><span class="exo-ar-live">● DEMO VIEW</span><span class="exo-ar-guide-mode">01 / VIRTUAL TRY-ON</span></div>
   <div class="exo-ar-grid" aria-hidden="true" hidden></div>
   <div class="exo-ar-ruler exo-ar-ruler-top" aria-hidden="true" hidden></div><div class="exo-ar-ruler exo-ar-ruler-side" aria-hidden="true" hidden></div>
   <div class="exo-ar-overlay" tabindex="0" role="img" aria-label="Drag to reposition the garment or pattern, use controls to resize and rotate"><img draggable="false" class="exo-ar-asset" alt="Manually placed garment artwork" src="${garmentFallback}"><div class="exo-ar-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div>
   <div class="exo-ar-stage-bottom"><span>DRAG THE ARTWORK TO REPOSITION</span><span class="exo-ar-measure">SCALE REFERENCE · 30 CM</span></div>
  </div><p class="exo-ar-disclaimer" role="note">Manual alignment preview · not body tracked / no ARKit plane detection or projector hardware control. Table view simulates placement on screen.</p><p class="exo-ar-status" role="status" aria-live="polite">Demo ready. Start your camera or try manual placement.</p></div>
 <aside class="exo-ar-control"><div class="exo-ar-control-head"><span>COMPOSITION CONTROLS</span><span>01 / 02</span></div>
  <div class="exo-ar-actions"><button type="button" data-action="camera">Start camera</button><button type="button" data-action="flip">Switch camera</button><button type="button" data-action="stop" disabled>Stop</button></div>
  <label class="exo-ar-upload">UPLOAD YOUR OWN ${'GARMENT'} / PATTERN IMAGE <input type="file" accept="image/*" aria-label="Choose garment or pattern image"></label>
  <div class="exo-ar-form"><label>Scale <output data-out="scale">100%</output><input data-control="scale" type="range" min="25" max="260" value="100"></label><label>Rotation <output data-out="rotation">0°</output><input data-control="rotation" type="range" min="-180" max="180" value="0"></label><label>Horizontal <output data-out="x">50%</output><input data-control="x" type="range" min="0" max="100" value="50"></label><label>Vertical <output data-out="y">50%</output><input data-control="y" type="range" min="0" max="100" value="50"></label></div>
  <div class="exo-ar-table-controls" hidden><div class="exo-ar-control-label">PATTERN CALIBRATION</div><label class="exo-ar-number">Reference width (cm)<input type="number" min="1" max="500" step=".5" data-control="calibration" value="30"></label><div class="exo-ar-checks"><label><input type="checkbox" data-control="grid" checked> Grid</label><label><input type="checkbox" data-control="ruler" checked> Rulers</label></div><p class="exo-ar-small">Corner handles below adjust the preview outline. Physical dimensions require an independently calibrated camera and surface.</p><div class="exo-ar-corner-inputs"><label>Top left <input type="range" min="-35" max="35" value="0" data-corner="tl"></label><label>Top right <input type="range" min="-35" max="35" value="0" data-corner="tr"></label><label>Bottom right <input type="range" min="-35" max="35" value="0" data-corner="br"></label><label>Bottom left <input type="range" min="-35" max="35" value="0" data-corner="bl"></label></div></div>
  <div class="exo-ar-control-footer"><button type="button" data-action="reset">Reset alignment</button><button type="button" data-action="snapshot">Save snapshot ↓</button><button type="button" data-action="project" ${selected?'':'disabled'}>VIEW SOURCE PROJECT ↗</button></div>
 </aside></div></section>`;
 const q=s=>container.querySelector(s), qa=s=>[...container.querySelectorAll(s)];
 const stage=q('.exo-ar-stage'),overlay=q('.exo-ar-overlay'),art=q('.exo-ar-asset'),video=q('.exo-ar-video'),status=q('.exo-ar-status');
 function report(message){status.textContent=message;}
 function cameraStop(){request++;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}video.pause();video.srcObject=null;video.hidden=true;q('[data-action="camera"]').disabled=false;q('[data-action="stop"]').disabled=true;q('.exo-ar-demo').hidden=!demo?.image;q('.exo-ar-live').textContent='● DEMO VIEW';}
 async function cameraStart(){
  cameraStop();if(!navigator.mediaDevices?.getUserMedia){report('Camera access is unavailable here. Demo placement remains available.');return;}
  const token=++request;q('[data-action="camera"]').disabled=true;report('Requesting camera permission…');
  try{
   const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}},audio:false});
   if(removed||token!==request||document.hidden||!visible){acquired.getTracks().forEach(t=>t.stop());return;}
   stream=acquired;video.srcObject=acquired;video.hidden=false;q('.exo-ar-demo').hidden=true;
   q('[data-action="stop"]').disabled=false;q('.exo-ar-live').textContent='● LIVE CAMERA';
   try{await video.play();}catch{report('Camera connected. Playback may require another tap.');return;}
   report('Live camera ready. Drag the artwork and use the alignment controls.');
   acquired.getVideoTracks()[0]?.addEventListener('ended',()=>{if(stream===acquired){cameraStop();report('Camera disconnected. Demo view restored.');}},{once:true});
  }catch(error){if(token!==request||removed)return;cameraStop();report(error?.name==='NotAllowedError'?'Camera permission denied. You can still use the demo preview.':error?.name==='NotFoundError'?'No camera found. Demo preview is available.':'Could not start camera. Secure HTTPS or localhost may be required.');}
  finally{if(token===request&&!stream)q('[data-action="camera"]').disabled=false;}
 }
 function render(){
  const backdrop=q('.exo-ar-demo');
  if(stream===null&&backdrop){const src=(mode==='table'?tableDemo:demo)?.image;if(src&&backdrop.getAttribute('src')!==src)backdrop.src=src;}
  overlay.style.left=position.x+'%';overlay.style.top=position.y+'%';
  overlay.style.transform=`translate(-50%,-50%) rotate(${position.rotation}deg) scale(${position.scale})`;
  art.src=asset;
  overlay.classList.toggle('is-pattern',mode==='table');art.alt=mode==='table'?'Manually aligned flat pattern diagram':'Manually aligned garment artwork';
  qa('[data-control="scale"],[data-control="rotation"],[data-control="x"],[data-control="y"]').forEach(el=>{const value=el.dataset.control==='scale'?Math.round(position.scale*100):position[el.dataset.control];el.value=value;});
  q('[data-out="scale"]').textContent=Math.round(position.scale*100)+'%';q('[data-out="rotation"]').textContent=position.rotation+'°';q('[data-out="x"]').textContent=Math.round(position.x)+'%';q('[data-out="y"]').textContent=Math.round(position.y)+'%';
  q('.exo-ar-grid').hidden=mode!=='table'||!grid;qa('.exo-ar-ruler').forEach(el=>el.hidden=mode!=='table'||!ruler);
  q('.exo-ar-measure').textContent=mode==='table'?'REFERENCE WIDTH · '+calibration+' CM':'MANUAL IMAGE ALIGNMENT';
  q('.exo-ar-guide-mode').textContent=mode==='table'?'02 / TABLE PROJECTION':'01 / VIRTUAL TRY-ON';
  q('.exo-ar-table-controls').hidden=mode!=='table';
  q('.exo-ar-control-head span:last-child').textContent=mode==='table'?'02 / 02':'01 / 02';
  qa('[data-mode]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.mode===mode)));
  const handles=qa('.exo-ar-corners i');handles.forEach((el,i)=>{const key=['tl','tr','br','bl'][i];el.style.transform=`translate(${i===0||i===3?-corners[key]:corners[key]}%,${i<2?-corners[key]:corners[key]}%)`;});
  q('.exo-ar-corners').style.clipPath=`polygon(${clamp(corners.tl,0,35)}% ${clamp(corners.tl,0,35)}%,${100-clamp(corners.tr,0,35)}% ${clamp(corners.tr,0,35)}%,${100-clamp(corners.br,0,35)}% ${100-clamp(corners.br,0,35)}%,${clamp(corners.bl,0,35)}% ${100-clamp(corners.bl,0,35)}%)`;
 }
 function reset(){position={x:50,y:50,scale:1,rotation:0};corners={tl:0,tr:0,br:0,bl:0};qa('[data-corner]').forEach(x=>x.value='0');render();report('Alignment reset.');}
 function switchMode(next){if(mode===next)return;mode=next;asset=objectURL||stock(mode);reset();report(mode==='table'?'Table pattern preview. Calibrate and position manually.':'Virtual try-on preview. Place and scale the silhouette manually.');}
 function photoSource(){return !video.hidden&&video.videoWidth?video:q('.exo-ar-demo').hidden?null:q('.exo-ar-demo');}
 function snapshot(){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)return;
  canvas.width=1440;canvas.height=960;
  ctx.fillStyle='#161616';ctx.fillRect(0,0,canvas.width,canvas.height);
  const source=photoSource();
  if(source){const sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;if(sw&&sh){const ratio=Math.max(canvas.width/sw,canvas.height/sh),w=sw*ratio,h=sh*ratio;ctx.drawImage(source,(canvas.width-w)/2,(canvas.height-h)/2,w,h);}}
  const image=art;if(image.complete&&image.naturalWidth){const base=mode==='table'?canvas.width*.48:canvas.width*.31, w=base*position.scale,h=w*(image.naturalHeight/image.naturalWidth);ctx.save();ctx.translate(canvas.width*position.x/100,canvas.height*position.y/100);ctx.rotate(position.rotation*Math.PI/180);ctx.drawImage(image,-w/2,-h/2,w,h);ctx.restore();}
  ctx.fillStyle='#fff';ctx.font='22px sans-serif';ctx.fillText('EXO / MANUAL ALIGNMENT PREVIEW',35,52);
  canvas.toBlob(blob=>{if(!blob){report('Snapshot could not be prepared.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='exo-'+(mode==='table'?'table-pattern':'try-on')+'-preview.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);report('Snapshot saved locally.');},'image/png');
 }
 function click(event){
  const button=event.target.closest('button');if(!button||!container.contains(button))return;
  if(button.dataset.mode)switchMode(button.dataset.mode);
  else switch(button.dataset.action){
   case 'camera':cameraStart();break;case 'stop':cameraStop();report('Camera stopped. Demo preview restored.');break;
   case 'flip':facing=facing==='user'?'environment':'user';if(stream)cameraStart();else report('Camera set to '+(facing==='user'?'front':'rear')+'. Start camera to preview.');break;
   case 'reset':reset();break;case 'snapshot':snapshot();break;
   case 'market':onMarketplace('Garments');break;case 'project':if(mode==='table'&&tableDemo)onOpenProject(tableDemo);else if(selected)onOpenProject(selected);break;
  }
 }
 function input(event){
  const el=event.target;if(el.dataset.corner){corners[el.dataset.corner]=Number(el.value);render();return;}
  if(el.dataset.control){const key=el.dataset.control;if(key==='calibration')calibration=clamp(Number(el.value)||30,1,500);else if(key==='grid')grid=el.checked;else if(key==='ruler')ruler=el.checked;else if(key==='scale')position.scale=Number(el.value)/100;else position[key]=Number(el.value);render();}
 }
 function upload(event){
  const file=event.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){report('Select an image file.');return;}
  if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(file);asset=objectURL;art.src=asset;report('Custom image loaded locally. Drag to position it.');event.target.value='';
 }
 function pointerDown(event){if(event.button!==0)return;event.preventDefault();drag={id:event.pointerId,x:event.clientX,y:event.clientY,px:position.x,py:position.y};overlay.setPointerCapture?.(event.pointerId);}
 function pointerMove(event){if(!drag||drag.id!==event.pointerId)return;const r=stage.getBoundingClientRect();position.x=clamp(drag.px+(event.clientX-drag.x)/r.width*100,0,100);position.y=clamp(drag.py+(event.clientY-drag.y)/r.height*100,0,100);render();}
 function pointerEnd(event){if(drag?.id===event.pointerId)drag=null;}
 function keydown(event){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const amount=event.shiftKey?5:1;if(event.key==='ArrowLeft')position.x=clamp(position.x-amount,0,100);if(event.key==='ArrowRight')position.x=clamp(position.x+amount,0,100);if(event.key==='ArrowUp')position.y=clamp(position.y-amount,0,100);if(event.key==='ArrowDown')position.y=clamp(position.y+amount,0,100);render();}
 function visibility(){if(document.hidden){cameraStop();report('Camera paused while this page is hidden.');}}
 function intersection(entries){visible=entries[0]?.isIntersecting??true;if(!visible&&stream){cameraStop();report('Camera stopped while this section is out of view.');}}
 container.addEventListener('click',click);container.addEventListener('input',input);q('input[type="file"]').addEventListener('change',upload);overlay.addEventListener('pointerdown',pointerDown);overlay.addEventListener('pointermove',pointerMove);overlay.addEventListener('pointerup',pointerEnd);overlay.addEventListener('pointercancel',pointerEnd);overlay.addEventListener('keydown',keydown);
 document.addEventListener('visibilitychange',visibility);if('IntersectionObserver' in window){observer=new IntersectionObserver(intersection,{threshold:0});observer.observe(container);}
 render();
 return {destroy(){if(removed)return;removed=true;cameraStop();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);container.removeEventListener('click',click);container.removeEventListener('input',input);if(objectURL)URL.revokeObjectURL(objectURL);container.replaceChildren();container.classList.remove('exo-ar-root');}};
}
