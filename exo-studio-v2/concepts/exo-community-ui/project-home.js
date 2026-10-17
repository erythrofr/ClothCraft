// EXO's looping square-image carousel draws its continuous wrap and circular CSS-3D
// positioning from the local Mason Terra gallery-stack/orbit/ribbon studies.
// This is an original, dependency-free implementation using actual project images.
import {CATEGORIES} from './project-media.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mod=(n,m)=>((n%m)+m)%m;
const clamp=(a,lo,hi)=>Math.max(lo,Math.min(hi,a));

export function mountProjectHomepage(container,{projects,onOpen,onExplore,onMarketplace}={}){
 if(!container||!Array.isArray(projects)||!projects.length)return {destroy(){}};
 // Show the whole archive, not a backdrop plus a few decorative thumbnails.
 const first=['atelier-01','cathedral-03','garment-02','studio-09','world-10','exterior-11','nyc-07'];
 const slides=[...first.map(id=>projects.find(p=>p.id===id)).filter(Boolean),...projects.filter(p=>!first.includes(p.id))];
 // Prefer the six strongest original project images to unfinished UI captures.
 const curated=['cathedral-03','garment-02','studio-09','atelier-01','nyc-07','world-10']
   .map(id=>projects.find(p=>p.id===id)).filter(Boolean);
 const denimStory=projects.find(p=>p.id==='garment-02');
 const storyAngles=(Array.isArray(denimStory?.gallery)?denimStory.gallery:[]).filter(v=>v?.src&&v?.label).slice(0,5);
 let position=0,target=null,raf=0,lastTime=0,active=-1,visible=true,hovered=false,focused=false,removed=false,archiveOpen=false,archiveFocus=null;
 let manualUntil=0,drag=null,blockClick=false,observer=null,suspended=false,pausedByUser=false,storyAngle=0;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const photo=p=>`<img src="${esc(p.image)}" alt="${esc(p.alt||p.title)}" loading="lazy" decoding="async">`;
 const tile=(p,i)=>`<article class="exh-curator-tile" style="--exh-order:${i}"><button type="button" data-project="${esc(p.id)}" aria-label="Open ${esc(p.title)}"><span class="exh-curator-image"><img src="${esc(p.image)}" alt="${esc(p.alt||p.title)}" loading="eager" decoding="async"><span class="exh-curator-hover">EXPLORE THE PROJECT <span aria-hidden="true">↗</span></span><span class="exh-curator-overlay"><small><span class="exh-curator-number">${String(i+1).padStart(2,'0')} / ${String(curated.length).padStart(2,'0')}</span> ${esc(p.category.toUpperCase())} / ${esc(p.creator)}</small><strong>${esc(p.title)}</strong></span></span></button></article>`;
 container.className='exo-home-revamp';
 container.innerHTML=`<section class="exh-landing exh-infinite-landing">
  <div class="exh-gallery-shell">
    <div class="exh-gallery-meta"><span><i></i> EXO DESIGN ARCHIVE</span><span>DRAG · SWIPE · USE ARROWS</span></div>
    <div class="exh-hero-visual exh-infinite-visual" aria-label="Continuously rotating gallery of large square project photographs" aria-roledescription="carousel">
      <div class="exh-gallery-horizon" aria-hidden="true"></div>
      <div class="exh-carousel-cards">
       ${slides.map((p,i)=>`<button type="button" class="exh-carousel-card" data-category="${esc(p.category)}" data-gallery-index="${i}" ${i?'data-orbit="'+i+'"':''} aria-label="${esc(p.title)} — select this project" aria-current="${i===0?'true':'false'}"><img ${i===0?'id="exh-active-photo" ':''}src="${esc(p.image)}" alt="${esc(p.alt||p.title)}" ${i===0?'fetchpriority="high" loading="eager"':'loading="lazy"'} decoding="async"><span class="exh-carousel-gradient"></span><span class="exh-carousel-label">${String(i+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')} &nbsp;·&nbsp; ${esc(p.category.toUpperCase())}</span><span class="exh-carousel-caption"><strong>${esc(p.title)}</strong><small>${esc(p.creator)} &nbsp;↗</small></span></button>`).join('')}
      </div>
      <button type="button" class="exh-gallery-arrow exh-gallery-left" id="exh-prev" aria-label="Previous featured project"><span>←</span></button>
      <button type="button" class="exh-gallery-arrow exh-gallery-right" id="exh-next" aria-label="Next featured project"><span>→</span></button>
    </div>
    <div class="exh-gallery-foot"><div class="exh-gallery-current"><span id="exh-active-source">01 / ${esc(slides[0].category.toUpperCase())}</span><div><h2 id="exh-active-title">${esc(slides[0].title)}</h2><p id="exh-active-description">${esc(slides[0].description)}</p></div></div><div class="exh-gallery-navigation"><div class="exh-progress-track" role="group" aria-label="Go to a project">${slides.map((p,i)=>`<button type="button" data-slide="${i}" aria-label="Show project ${i+1}: ${esc(p.title)}" aria-current="${i===0?'true':'false'}"><span></span></button>`).join('')}</div><span id="exh-counter">01 / ${String(slides.length).padStart(2,'0')}</span><button type="button" id="exh-motion-control" aria-pressed="false" aria-label="Pause automatic gallery movement">PAUSE <span aria-hidden="true">Ⅱ</span></button><button id="exh-view-archive" type="button" aria-haspopup="dialog">THE FULL ARCHIVE <span aria-hidden="true">↗</span></button><button id="exh-open-project" type="button">VIEW PROJECT ↗</button></div></div>
  </div>
  <div class="exh-under-hero"><span>SCROLL TO DISCOVER <b>↓</b></span><span>REAL PROJECT RENDERS / INFINITE GALLERY MOTION</span></div>
 </section>
 <section class="exh-curators exh-reveal" id="curators-picks"><div class="exh-section-meta"><span>01 / EDITORIAL SELECTION</span><span>${curated.length} SELECTED ORIGINAL PROJECTS</span></div><div class="exh-section-heading"><div><span class="exh-eyebrow">THE WORK / BEHIND THE DESIGN</span><h2>Curator <em>picks.</em></h2></div><button data-home-action="explore">EXPLORE FOR YOU <span>↗</span></button></div><div class="exh-curator-grid">${curated.map(tile).join('')}</div><div class="exh-curators-bottom"><span>ORIGINAL WORK FROM OUR DESIGN ENVIRONMENTS.</span><span>GARMENTS &nbsp; / &nbsp; MATERIALS &nbsp; / &nbsp; ARCHITECTURE</span></div></section>
 ${storyAngles.length>=3?`<section class="exh-editorial-story" id="exh-editorial-story" aria-label="Denim design process case study">
   <div class="exh-story-topline"><span>02 / THE PROCESS</span><span>MIKRISTIAN LAB &nbsp; — &nbsp; DIGITAL DENIM DEVELOPMENT</span></div>
   <div class="exh-story-title"><div><small>EXO / IN FOCUS</small><h2>Look <em>closer.</em></h2></div><p>A design is more than one image. Inspect the angles and details behind this digital construction study.</p></div>
   <div class="exh-story-stage">
     <div class="exh-story-image"><img id="exh-story-image" src="${esc(storyAngles[0].src)}" alt="${esc(storyAngles[0].alt)}" loading="eager" decoding="async" width="900" height="1125"><span class="exh-story-image-number" id="exh-story-image-number">01 / ${String(storyAngles.length).padStart(2,'0')}</span><span class="exh-story-image-type">ORIGINAL GARMENT DEVELOPMENT RENDER</span></div>
     <aside class="exh-story-aside"><div><span class="exh-story-index">OBJECT STUDY / 001</span><h3>501 / Digital<br>Denim Study.</h3><p>The same digital garment, seen from different directions. An exploration of silhouette, surface and construction rather than a finished product photograph.</p></div>
       <div class="exh-story-selector" role="group" aria-label="Select denim development view">${storyAngles.map((g,i)=>`<button type="button" data-story-angle="${i}" aria-pressed="${i===0}" aria-label="Show denim ${esc(g.label.toLowerCase())} view"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(g.label)}</strong><span aria-hidden="true">↗</span></button>`).join('')}</div>
       <button type="button" class="exh-story-open" data-story-open>VIEW THE FULL STUDY <span aria-hidden="true">↗</span></button>
     </aside>
   </div>
   <div class="exh-story-bottom"><span>SELECT A VIEW TO COMPARE THE DIGITAL DEVELOPMENT RENDERS.</span><span>RESEARCH MODEL / NO APPROVED PHYSICAL FIT DATA</span></div>
 </section>`:''}
 <div class="exh-archive-view" id="exh-archive-view" hidden>
  <div class="exh-archive-shade" data-archive-close></div>
  <section class="exh-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="exh-archive-title">
   <div class="exh-archive-top"><div><span class="exh-archive-kicker">EXO / DIGITAL COLLECTION VOL. 001</span><h2 id="exh-archive-title">The complete archive<span>.</span></h2></div><button type="button" class="exh-archive-close" data-archive-close aria-label="Close project archive">CLOSE <span aria-hidden="true">×</span></button></div>
   <div class="exh-archive-grid">${slides.map((p,i)=>`<button type="button" class="exh-archive-work" data-archive-index="${i}" aria-label="Open project ${esc(p.title)}"><span class="exh-archive-image">${photo(p)}</span><span class="exh-archive-detail"><span>${String(i+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')} &nbsp; ${esc(p.category.toUpperCase())}</span><strong>${esc(p.title)}</strong><small>${esc(p.creator)} <span aria-hidden="true">↗</span></small></span></button>`).join('')}</div>
   <p class="exh-archive-note">Actual project renders and development screenshots from the local EXO, MIKRISTIAN and XTENDED workspaces. Social profiles are illustrative.</p>
  </section>
 </div>`;
 const q=s=>container.querySelector(s),all=s=>[...container.querySelectorAll(s)];
 const cards=all('.exh-carousel-card'),stage=q('.exh-infinite-visual');
 const format=i=>String(i+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');
 function currentIndex(){return mod(Math.round(position),slides.length);}
 function paint(force=false){
  const count=slides.length;
  const width=stage.clientWidth||window.innerWidth;
 const radius=width<650?Math.max(365,width*1.1):Math.min(1120,Math.max(720,width*.75));
  const front=currentIndex(),selected=target!==null?mod(Math.round(target),slides.length):front;
  cards.forEach((el,i)=>{
   let d=i-position;d-=Math.round(d/count)*count;
   const angle=d*2*Math.PI/count,near=Math.abs(d),c=Math.cos(angle);
   const x=Math.sin(angle)*radius, y=(1-c)*34;
   const z=(c-1)*310;
   const scale=clamp(1-near*.09,.55,1);
   const opacity=near>3.52?0:near>2.65?clamp((3.52-near)/.87,0,1):1;
   el.style.transform=`translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateY(${(-Math.sin(angle)*24).toFixed(2)}deg) rotateZ(${(Math.sin(angle)*-3).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
   el.style.opacity=String(opacity);
   el.style.zIndex=String(100-Math.round(near*12));
   el.style.pointerEvents=near>2.65?'none':'auto';
   const nearFocusable=near<2.1;
   if(el.tabIndex!== (nearFocusable?0:-1))el.tabIndex=nearFocusable?0:-1;
   if(el.getAttribute('aria-hidden')!==String(!nearFocusable))el.setAttribute('aria-hidden',String(!nearFocusable));
   if(el.getAttribute('aria-current')!==String(i===front))el.setAttribute('aria-current',String(i===front));
   if(i===selected){el.removeAttribute('data-orbit');}else{el.dataset.orbit=String(i);}
  });
  if(force||selected!==active){
   active=selected;
   const item=slides[selected];
   all('#exh-active-photo').forEach(img=>img.removeAttribute('id'));
   cards[selected].querySelector('img')?.setAttribute('id','exh-active-photo');
   q('#exh-active-source').textContent=format(selected)+' · '+item.category.toUpperCase();
   q('#exh-active-title').textContent=item.title;
   q('#exh-active-description').textContent=item.description;
   q('#exh-counter').textContent=format(selected);
   all('[data-slide]').forEach(btn=>btn.setAttribute('aria-current',String(Number(btn.dataset.slide)===selected)));
  }
 }
 function autoAllowed(t){return !removed&&!suspended&&!archiveOpen&&!pausedByUser&&visible&&!document.hidden&&!reduce.matches&&!drag&&t>manualUntil;}
 function frame(t){
  raf=0;
  if(removed)return;
  const dt=lastTime?Math.min(45,t-lastTime):16;lastTime=t;
  if(!drag){
   if(target!==null){position+=(target-position)*Math.min(1,dt*.0105);if(Math.abs(target-position)<.001){position=target;target=null;}}
   else if(autoAllowed(t)){position+=dt*.00020;}
  }
  if(Math.abs(position)>slides.length*500){position=mod(position,slides.length);if(target!==null)target=mod(target,slides.length);}
  paint();
  // In pause/reduced-motion state, don't keep twelve composited photo cards
  // repainting at 60 fps merely to hold a stationary camera pose.
  if(visible&&!suspended&&!document.hidden&&(target!==null||(!pausedByUser&&!reduce.matches)))raf=requestAnimationFrame(frame);
 }
 function start(){if(removed||raf)return;lastTime=0;raf=requestAnimationFrame(frame);}
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0;lastTime=0;}
 function moveTo(n,manual=true){
  if(manual)manualUntil=performance.now()+1700;
  target=n;
  if(reduce.matches){position=n;target=null;paint(true);}
  else{paint(true);start();}
 }
 function cycle(n){
  const now=Math.round(position),want=mod(Math.round(n),slides.length);
  let d=want-mod(now,slides.length);if(d>slides.length/2)d-=slides.length;if(d< -slides.length/2)d+=slides.length;
  moveTo(now+d);
 }
 function shift(direction){moveTo(Math.round(target===null?position:target)+direction);}
 function onClick(e){
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='exh-motion-control'){
   pausedByUser=!pausedByUser;
   b.setAttribute('aria-pressed',String(pausedByUser));
   b.setAttribute('aria-label',pausedByUser?'Resume automatic gallery movement':'Pause automatic gallery movement');
   b.innerHTML=pausedByUser?'RESUME <span aria-hidden="true">▶</span>':'PAUSE <span aria-hidden="true">Ⅱ</span>';
   if(pausedByUser&&target===null)stop();else start();
   return;
  }
  if(b.hasAttribute('data-story-angle')){selectStoryAngle(Number(b.dataset.storyAngle));return;}
  if(b.hasAttribute('data-story-open')){if(denimStory)onOpen?.(denimStory);return;}
  if(b.id==='exh-view-archive'){openArchive();return;}
  if(b.hasAttribute('data-archive-close')){closeArchive();return;}
  if(b.dataset.archiveIndex!==undefined){const p=slides[Number(b.dataset.archiveIndex)];closeArchive();if(p)onOpen?.(p);return;}
  if(blockClick){e.preventDefault();e.stopPropagation();blockClick=false;return;}
  if(b.id==='exh-prev')shift(-1);
  else if(b.id==='exh-next')shift(1);
  else if(b.dataset.slide!==undefined)cycle(Number(b.dataset.slide));
  else if(b.dataset.galleryIndex!==undefined){
   const i=Number(b.dataset.galleryIndex);
   if(i!==currentIndex())cycle(i);else onOpen?.(slides[i]);
  }
  else if(b.id==='exh-open-project')onOpen?.(slides[currentIndex()]);
  else if(b.dataset.project)onOpen?.(projects.find(p=>p.id===b.dataset.project));
  else if(b.dataset.homeAction==='explore')onExplore?.();
  else if(b.dataset.homeAction==='market')onMarketplace?.('All');
  else if(b.dataset.homeCategory)onMarketplace?.(b.dataset.homeCategory);
 }
 function selectStoryAngle(index){
  if(!storyAngles.length)return;
  storyAngle=mod(index,storyAngles.length);
  const item=storyAngles[storyAngle],img=q('#exh-story-image');
  if(!img)return;
  img.src=item.src;img.alt=item.alt||'Digital garment development view';
  q('#exh-story-image-number').textContent=String(storyAngle+1).padStart(2,'0')+' / '+String(storyAngles.length).padStart(2,'0');
  all('[data-story-angle]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.storyAngle)===storyAngle)));
 }
 function openArchive(){
  if(archiveOpen)return;
  archiveOpen=true;archiveFocus=document.activeElement;
  q('#exh-archive-view').hidden=false;
  document.body.classList.add('exh-archive-open');
  q('.exh-archive-close')?.focus();
 }
 function closeArchive(){
  if(!archiveOpen)return;
  archiveOpen=false;q('#exh-archive-view').hidden=true;
  document.body.classList.remove('exh-archive-open');
  if(archiveFocus?.isConnected)archiveFocus.focus();
  archiveFocus=null;
 }
 function onArchiveKey(e){
  if(!archiveOpen)return;
  if(e.key==='Escape'){e.preventDefault();closeArchive();return;}
  if(e.key==='Tab'){
   const tabbable=all('#exh-archive-view button:not([disabled])');
   if(!tabbable.length)return;
   if(e.shiftKey&&document.activeElement===tabbable[0]){e.preventDefault();tabbable[tabbable.length-1].focus();}
   else if(!e.shiftKey&&document.activeElement===tabbable[tabbable.length-1]){e.preventDefault();tabbable[0].focus();}
  }
 }
 function onArchiveShade(e){if(e.target.closest('[data-archive-close]'))closeArchive();}
 function down(e){
  if(e.button!==0||reduce.matches)return;
  // Arrow controls must keep their normal click target. Pointer capture on the
  // ancestor was swallowing clicks even though the gallery itself could drag.
  if(e.target.closest('.exh-gallery-arrow'))return;
  // A drag can begin before the preceding arrow/card animation has settled.
  // Start from the selected destination, never an intermediate orbit frame.
  if(target!==null){position=target;target=null;paint(true);}
  drag={x:e.clientX,position,moved:false};
  if(!e.target.closest('button'))try{stage.setPointerCapture?.(e.pointerId);}catch{}
 }
 function dragMove(e){
  if(!drag)return;
  const dx=e.clientX-drag.x;
  if(Math.abs(dx)>8&&!drag.moved){
   drag.moved=true;
   // Cards remain clickable for a tap. Once the pointer starts a real drag,
   // capture on the stage so it can continue across overlapping 3D cards.
   try{stage.setPointerCapture?.(e.pointerId);}catch{}
  }
  position=drag.position-dx/Math.max(210,Math.min(340,stage.clientWidth*.25));
  target=null;manualUntil=performance.now()+2600;paint();
 }
 function up(e){if(!drag)return;const delta=e.clientX-drag.x;if(Math.abs(delta)>8&&!drag.moved){drag.moved=true;position=drag.position-delta/Math.max(210,Math.min(340,stage.clientWidth*.25));}blockClick=drag.moved;const closest=Math.round(position);drag=null;moveTo(closest);try{stage.releasePointerCapture(e.pointerId);}catch{}if(blockClick)setTimeout(()=>{blockClick=false},90);}
 function wheel(e){if(Math.abs(e.deltaX)<8&&!e.shiftKey)return;e.preventDefault();manualUntil=performance.now()+2000;target=null;position+= (e.deltaX||e.deltaY)*.0022;paint();}
 function visibilityChange(){if(document.hidden)stop();else start();}
 function motionChange(){container.classList.toggle('exh-carousel-paused',reduce.matches);if(reduce.matches){target=null;position=Math.round(position);paint(true);}start();}
 function focusIn(){focused=true;}
 function focusOut(e){if(!stage.contains(e.relatedTarget))focused=false;}
 function pointerEnter(){hovered=true;}
 function pointerLeave(){hovered=false;}
 function navigationWheel(e){wheel(e);}
 container.addEventListener('click',onClick);
 q('#exh-archive-view').addEventListener('click',onArchiveShade);
 document.addEventListener('keydown',onArchiveKey);
 stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',dragMove);
 stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
 stage.addEventListener('wheel',navigationWheel,{passive:false});
 stage.addEventListener('mouseenter',pointerEnter);stage.addEventListener('mouseleave',pointerLeave);
 stage.addEventListener('focusin',focusIn);stage.addEventListener('focusout',focusOut);
 document.addEventListener('visibilitychange',visibilityChange);
 reduce.addEventListener?.('change',motionChange);
 const onResize=()=>paint(true);window.addEventListener('resize',onResize,{passive:true});
 if('IntersectionObserver'in window){
  observer=new IntersectionObserver(entries=>{for(const entry of entries){
   if(entry.target===stage){visible=entry.intersectionRatio>.08;visible?start():stop();}
   else if(entry.isIntersecting){entry.target.classList.add('exh-in-view');observer.unobserve(entry.target);}
  }},{threshold:[0,.1,.2]});
  observer.observe(stage);all('.exh-reveal').forEach(el=>observer.observe(el));
 }else{all('.exh-reveal').forEach(el=>el.classList.add('exh-in-view'));}
 container.classList.toggle('exh-carousel-paused',reduce.matches);
 paint(true);start();
 return {destroy(){closeArchive();removed=true;stop();observer?.disconnect();document.removeEventListener('keydown',onArchiveKey);document.removeEventListener('visibilitychange',visibilityChange);reduce.removeEventListener?.('change',motionChange);window.removeEventListener('resize',onResize);container.removeEventListener('click',onClick);stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',dragMove);stage.removeEventListener('pointerup',up);stage.removeEventListener('pointercancel',up);stage.removeEventListener('wheel',navigationWheel);stage.removeEventListener('mouseenter',pointerEnter);stage.removeEventListener('mouseleave',pointerLeave);stage.removeEventListener('focusin',focusIn);stage.removeEventListener('focusout',focusOut);container.replaceChildren();},pause(){suspended=true;stop();closeArchive();},resume(){suspended=false;start();},cycle};
}
