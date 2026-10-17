/* EXO / Atelier Objects - development-image case studies.
   All garment images are from local EXO/MIKRISTIAN source projects or a
   procedural Blender concept made specifically for EXO. No product photography,
   validated cloth physics, production approval, or pattern download is implied.
*/
const base='./project-media/';
const CASES=[
 {id:'moto-study',label:'01 / FORM STUDY',title:'Architectural layer.',subtitle:'A study in volume, shadow and raised seam architecture.',creator:'EXO Studio',category:'ORIGINAL PROCEDURAL CGI CONCEPT',
  summary:'A newly modeled artistic garment concept. Its hood, padding and structure are illustrative volumes, not a manufacturable sewing pattern or a MIKRISTIAN production sample.',detail:'VOLUME / PADDED SURFACES / RAISED SEAM LANGUAGE',
  findings:['Circular hood opening and dimensional relief mark the sculptural silhouette.','The raised vertical lines are surface geometry; seam allowance and trapunto construction are not specified.','Material behavior, drape, pattern feasibility and physical fit remain untested.'],
  images:[
   {src:base+'moto-study-34.webp',name:'Three-quarter / form',kind:'Original Blender CGI concept'},
   {src:base+'moto-study-front.webp',name:'Front / construction',kind:'Original Blender CGI concept'},
   {src:base+'moto-study-detail.webp',name:'Detail / raised seams',kind:'Original Blender CGI concept'}],
  type:'concept'},
 {id:'denim-study',label:'02 / FIT RESEARCH',title:'501 denim study.',subtitle:'A development archive documenting silhouette and distress details.',creator:'MIKRISTIAN LAB',category:'3D DEVELOPMENT RENDERS',
  summary:'Existing Garment Studio 501-style construction and wash development renders. These images are visual development references, not photographs, calibrated fit proof, or final manufacturer-approved denim.',detail:'SILHOUETTE / WASH / POCKETS / DISTRESS',
  findings:['Front, side and back angles show the digital leg silhouette and pocket placement.','The knee and hem close-ups document rendered distress placement and cuff details.','The mannequin pose and digital surface finish cannot independently verify fit or manufacturing readiness.'],
  images:[
   {src:base+'denim501-34.webp',name:'Three-quarter / silhouette',kind:'Original 501 render'},
   {src:base+'denim501-front.webp',name:'Front / leg proportion',kind:'Original 501 render'},
   {src:base+'denim501-side.webp',name:'Side / silhouette',kind:'Original 501 render'},
   {src:base+'denim501-back.webp',name:'Back / pockets',kind:'Original 501 render'},
   {src:base+'denim501-knee.webp',name:'Knee / distress',kind:'Original 501 render'},
   {src:base+'denim501-cuff.webp',name:'Hem / cuff',kind:'Original 501 render'}],
  type:'development'}
];
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image=(src,alt,lazy=true)=>'<img src="'+html(src)+'" alt="'+html(alt)+'" decoding="async" loading="'+(lazy?'lazy':'eager')+'">';
export function mountGarmentExhibition(node){
 if(!node)return {destroy(){},setVisible(){}};
 let focusBefore=null,caseIndex=0,viewIndex=0,open=false;
 node.className='exo-garment-exhibition';
 node.innerHTML='<div class="exge-rule"><span>EXO ATELIER / VISUAL RESEARCH</span><span>ORIGINAL DEVELOPMENT OBJECTS <i>© 2026</i></span></div>'
  +'<div class="exge-heading"><div><span>RESEARCH, NOT RETAIL</span><h3>Garments in progress<span>.</span></h3></div><p>Form studies, material experiments and construction research. Explore the object and the making behind it.</p></div>'
  +'<div class="exge-works">'+CASES.map((g,i)=>'<button class="exge-work exge-'+g.type+'" type="button" data-exge-open="'+i+'" aria-label="Inspect '+html(g.title)+' across multiple angles">'
    +'<span class="exge-photo">'+image(g.images[0].src,g.title+' - '+g.images[0].name,false)+'<span class="exge-photo-tag">'+html(g.category)+'</span><span class="exge-photo-index">'+String(i+1).padStart(2,'0')+' / '+String(CASES.length).padStart(2,'0')+'</span><span class="exge-cta">EXPLORE OBJECT <span aria-hidden="true">↗</span></span></span>'
    +'<span class="exge-meta"><span><small>'+html(g.label)+'</small><strong>'+html(g.title)+'</strong><span>'+html(g.subtitle)+'</span></span><b aria-hidden="true">↗</b></span></button>').join('')+'</div>'
  +'<div class="exge-foot"><span>RENDERED VISUAL STUDIES. NOT FINISHED PRODUCT PHOTOGRAPHY.</span><span>VIEW AS RESEARCH ↗</span></div>'
  +'<div class="exge-modal" hidden><div class="exge-shade" data-exge-close></div><section class="exge-dialog" role="dialog" aria-modal="true" aria-labelledby="exge-dialog-title">'
  +'<header class="exge-top"><span>EXO / OBJECT INSPECTION</span><button type="button" class="exge-close" data-exge-close aria-label="Close garment study">CLOSE <span aria-hidden="true">×</span></button></header>'
  +'<div class="exge-inspect"><div class="exge-main"><div class="exge-stage"><span class="exge-stage-kicker">EXO ATELIER / STUDY ARCHIVE</span><button class="exge-zoom" type="button" data-exge-zoom aria-pressed="false" aria-label="Magnify the study render">MAGNIFY +</button><img class="exge-main-image" src="" alt=""><span class="exge-image-caption" aria-live="polite"></span><button type="button" class="exge-arrow exge-back" data-exge-prev aria-label="Previous view">←</button><button type="button" class="exge-arrow exge-next" data-exge-next aria-label="Next view">→</button></div><div class="exge-strip-heading"><span>IMAGE INDEX / CLICK TO INSPECT</span><span class="exge-progress" aria-live="polite"></span></div><div class="exge-views" role="group" aria-label="Select study viewing angle"></div></div>'
  +'<div class="exge-info"><small class="exge-caption"></small><h2 id="exge-dialog-title"></h2><p class="exge-subtitle"></p><div class="exge-discipline"></div><div class="exge-spec"><span>MEDIA</span><strong class="exge-view-mode"></strong><span>AVAILABLE VIEWS</span><strong class="exge-view-count"></strong><span>PROJECT SOURCE</span><strong class="exge-creator"></strong></div><div class="exge-honesty"><strong>RESEARCH NOTES</strong><ol class="exge-findings"></ol><p class="exge-explanation"></p></div><div class="exge-info-end">EXO ATELIER / DOCUMENTED DEVELOPMENT</div></div></div></section></div>';
 const q=s=>node.querySelector(s), all=s=>[...node.querySelectorAll(s)];
 const modal=q('.exge-modal');
 function paint(){
  const g=CASES[caseIndex],v=g.images[viewIndex];
  q('.exge-stage').classList.remove('exge-magnified');
  q('.exge-zoom').setAttribute('aria-pressed','false');
  q('.exge-zoom').textContent='MAGNIFY +';
  q('.exge-main-image').src=v.src;
  q('.exge-main-image').alt=g.title+' — '+v.name;
  q('.exge-image-caption').textContent=v.kind+' / '+v.name;
  q('.exge-caption').textContent=g.label+' / '+g.category;
  q('#exge-dialog-title').textContent=g.title;
  q('.exge-subtitle').textContent=g.subtitle;
  q('.exge-discipline').textContent=g.detail;
  q('.exge-creator').textContent=g.creator;
  q('.exge-view-mode').textContent=g.type==='concept'?'ORIGINAL PROCEDURAL CGI':'3D DEVELOPMENT RENDER';
  q('.exge-explanation').textContent=g.summary;
  q('.exge-findings').innerHTML=g.findings.map(f=>'<li>'+html(f)+'</li>').join('');
  q('.exge-view-count').textContent=g.images.length+' RESEARCH VIEWS';
  q('.exge-progress').textContent=String(viewIndex+1).padStart(2,'0')+' / '+String(g.images.length).padStart(2,'0');
  q('.exge-views').innerHTML=g.images.map((item,i)=>'<button type="button" data-exge-view="'+i+'" aria-pressed="'+String(i===viewIndex)+'" aria-label="'+html(item.name)+'">'+image(item.src,item.name)+'<span>'+html(item.name)+'</span></button>').join('');
  q('.exge-stage').classList.toggle('exge-is-denim',g.type==='development');
 }
 function show(index){
  focusBefore=document.activeElement;caseIndex=index;viewIndex=0;open=true;paint();
  modal.hidden=false;document.body.classList.add('exge-open');q('.exge-close').focus();
 }
 function close(){
  if(!open)return;open=false;modal.hidden=true;document.body.classList.remove('exge-open');
  if(focusBefore?.isConnected)focusBefore.focus();
  focusBefore=null;
 }
 function move(delta){const g=CASES[caseIndex];viewIndex=(viewIndex+delta+g.images.length)%g.images.length;paint();}
 function click(e){
  const btn=e.target.closest('button');if(!btn)return;
  if(btn.dataset.exgeOpen!==undefined){show(Number(btn.dataset.exgeOpen));return;}
  if(btn.hasAttribute('data-exge-close')){close();return;}
  if(!open)return;
  if(btn.hasAttribute('data-exge-prev'))move(-1);
  if(btn.hasAttribute('data-exge-next'))move(1);
  if(btn.hasAttribute('data-exge-zoom')){const zoomed=q('.exge-stage').classList.toggle('exge-magnified');btn.setAttribute('aria-pressed',String(zoomed));btn.textContent=zoomed?'RESET −':'MAGNIFY +';}
  if(btn.dataset.exgeView!==undefined){viewIndex=Number(btn.dataset.exgeView);paint();}
 }
 function onShade(e){if(e.target===q('.exge-shade'))close();}
 function key(e){
  if(!open)return;
  if(e.key==='Escape'){e.preventDefault();close();}
  if(e.key==='ArrowRight'){e.preventDefault();move(1);}
  if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}
  if(e.key==='Tab'){
   const buttons=all('.exge-modal button:not(:disabled)').filter(el=>el.getClientRects().length);
   if(!buttons.length)return;
   if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}
   else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}
  }
 }
 node.addEventListener('click',click);modal.addEventListener('click',onShade);document.addEventListener('keydown',key);
 return {destroy(){close();node.removeEventListener('click',click);modal.removeEventListener('click',onShade);document.removeEventListener('keydown',key);node.replaceChildren();},setVisible(on){node.hidden=!on;if(!on)close();}};
}
