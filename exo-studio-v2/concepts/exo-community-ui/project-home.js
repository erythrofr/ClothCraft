import {CATEGORIES} from './project-media.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));

export function mountProjectHomepage(container,{projects,onOpen,onExplore,onProfile,onMarketplace}={}){
 if(!container||!Array.isArray(projects)||!projects.length)return {destroy(){}};
 const featured=projects.filter(p=>p.featured);
 const slides=(featured.length?featured:projects).slice(0,8), curated=[projects[2],projects[1],projects[3],projects[8]].filter(Boolean);
 let index=0,interval=null,observer=null,visibility=true,hover=false,dragX=null,reduced=window.matchMedia('(prefers-reduced-motion: reduce)'),removed=false,updated=0;
 const photo=p=>`<img src="${esc(p.image)}" alt="${esc(p.alt||p.title)}" loading="lazy" decoding="async">`;
 const tile=p=>`<article class="exh-curator-tile"><button type="button" data-project="${esc(p.id)}" aria-label="Open ${esc(p.title)}"><span class="exh-curator-image">${photo(p)}<span class="exh-curator-hover">VIEW PROJECT ↗</span></span><span class="exh-curator-category">${esc(p.category.toUpperCase())} · ${esc(p.source)}</span><strong>${esc(p.title)}</strong><small>${esc(p.creator)}</small></button></article>`;
 container.className='exo-home-revamp';
 container.innerHTML=`<section class="exh-landing">
  <div class="exh-kickerline"><span><b></b> EXO COMMUNITY / ORIGINAL DIGITAL WORK</span><span>MADE BY THE PEOPLE WHO MAKE THINGS.</span></div>
  <div class="exh-hero-layout"><div class="exh-hero-text">
    <span class="exh-eyebrow">THE CREATOR ARCHIVE / VOLUME 001</span>
    <h1>Made to<br><em>be seen.</em></h1>
    <p>Discover digital fashion, fabrics, environments and the people building them. A place for every project, from the first line to the final frame.</p>
    <div class="exh-hero-buttons"><button data-home-action="market">Explore the marketplace <span>↗</span></button><button data-home-action="explore">See what creators are making <span>↗</span></button></div>
    <div class="exh-hero-aside"><span>CREATIVE WORKS / SELECTED</span><span>${String(projects.length).padStart(2,'0')} RESEARCH PROJECTS</span></div>
   </div>
   <div class="exh-hero-visual" aria-roledescription="carousel" aria-label="Featured creator projects">
     <div class="exh-main-photo"><img id="exh-active-photo" src="${esc(slides[0].image)}" alt="${esc(slides[0].alt||slides[0].title)}" fetchpriority="high" decoding="async"><div class="exh-image-grain" aria-hidden="true"></div></div>
     <div class="exh-photo-head"><span>FEATURED PROJECT / ${String(slides.length).padStart(2,'0')}</span><span class="exh-photo-caption-top">EXO / COMMUNITY SPOTLIGHT</span></div>
     <div class="exh-orbit-control"><div class="exh-orbit-rim"></div>${[1,2,3].map((n,i)=>`<button type="button" class="exh-orbit-thumb exh-orbit-position-${i}" data-orbit="${n}" aria-label="Show next project ${n}"><img src="${esc(slides[n%slides.length].image)}" alt="" loading="lazy"></button>`).join('')}<div class="exh-orbit-core">DISCOVER<br><span>↗</span></div></div>
     <div class="exh-photo-shade" aria-hidden="true"></div>
     <div class="exh-photo-info"><div><span id="exh-active-source">01 / ${esc(slides[0].category.toUpperCase())}</span><h2 id="exh-active-title">${esc(slides[0].title)}</h2><p id="exh-active-description">${esc(slides[0].description)}</p><button type="button" id="exh-open-project">Explore project ↗</button></div></div>
     <div class="exh-controls"><button type="button" id="exh-prev" aria-label="Previous project">←</button><div class="exh-progress-track" role="group" aria-label="Choose featured project">${slides.map((s,i)=>`<button data-slide="${i}" type="button" aria-label="Show project ${i+1}: ${esc(s.title)}" aria-current="${i===0?'true':'false'}"><span></span></button>`).join('')}</div><button type="button" id="exh-next" aria-label="Next project">→</button><span id="exh-counter">01 / ${String(slides.length).padStart(2,'0')}</span></div>
   </div></div>
   <div class="exh-under-hero"><span>SCROLL TO DISCOVER <b>↓</b></span><span>AN OPEN ATELIER FOR DIGITAL CREATORS.</span></div>
 </section>
 <section class="exh-curators exh-reveal" id="curators-picks"><div class="exh-section-meta"><span>01 / EDITOR'S CHOICE</span><span>SELECTED FROM ACTIVE EXO PROJECT WORKSPACES</span></div><div class="exh-section-heading"><div><span class="exh-eyebrow">CURATED BY THE COMMUNITY</span><h2>What we're <em>looking at.</em></h2></div><button data-home-action="explore">EXPLORE ALL CREATOR PROJECTS <span>↗</span></button></div><div class="exh-curator-grid">${curated.map(tile).join('')}</div></section>
 <section class="exh-marquee-band" aria-label="Community topics"><div class="exh-marquee-inner"><span>FORM & FUNCTION</span><i>✳</i><span>MATERIAL & TEXTURE</span><i>✳</i><span>PEOPLE & PROCESS</span><i>✳</i><span>FORM & FUNCTION</span><i>✳</i><span>MATERIAL & TEXTURE</span><i>✳</i><span>PEOPLE & PROCESS</span><i>✳</i></div></section>
 <section class="exh-shop-intro exh-reveal"><div><span class="exh-eyebrow">02 / THE EXO COLLECTION</span><h2>Find your<br><em>next starting point.</em></h2><p>Garments, fabrics, trims, avatars and scenes, in one searchable studio library.</p></div><div class="exh-category-icons" role="group" aria-label="Marketplace categories">${CATEGORIES.filter(c=>c!=='Patterns').map((name,i)=>`<button type="button" data-home-category="${esc(name)}" class="${i===0?'active':''}" aria-pressed="${i===0?'true':'false'}"><span>${['✳','◫','▧','⌁','◎','▤'][i]}</span><b>${esc(name)}</b><small>↗</small></button>`).join('')}</div></section>`;
 const q=s=>container.querySelector(s),all=s=>[...container.querySelectorAll(s)];
 function cycle(n,user=false){
   index=(n+slides.length)%slides.length;
   const item=slides[index],hero=q('#exh-active-photo');
   hero.classList.add('exh-switching');
   hero.src=item.image;hero.alt=item.alt||item.title;
   q('#exh-active-source').textContent=String(index+1).padStart(2,'0')+' / '+item.category.toUpperCase();
   q('#exh-active-title').textContent=item.title;
   q('#exh-active-description').textContent=item.description;
   q('#exh-counter').textContent=String(index+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');
   all('[data-slide]').forEach(b=>{
     const active=Number(b.dataset.slide)===index;
     b.setAttribute('aria-current',String(active));b.setAttribute('aria-pressed',String(active));
     const bar=b.querySelector('span');
     if(active){bar.style.animation='none';void bar.offsetWidth;bar.style.animation='';}
   });
   all('[data-orbit]').forEach((b,i)=>{b.dataset.orbit=String((index+i+1)%slides.length);b.querySelector('img').src=slides[(index+i+1)%slides.length].image});
   clearTimeout(updated);updated=setTimeout(()=>hero.classList.remove('exh-switching'),reduced.matches?0:470);
   if(user)restart();
 }
 function stop(){if(interval!==null){clearInterval(interval);interval=null;}container.classList.add('exh-carousel-paused');}
 function start(){stop();if(!removed&&!reduced.matches&&visibility&&!hover&&!document.hidden){container.classList.remove('exh-carousel-paused');interval=setInterval(()=>cycle(index+1),5500);}}
 function restart(){start();}
 function onClick(e){
   const b=e.target.closest('button');if(!b)return;
   if(b.id==='exh-prev')cycle(index-1,true);
   else if(b.id==='exh-next')cycle(index+1,true);
   else if(b.dataset.slide!==undefined)cycle(Number(b.dataset.slide),true);
   else if(b.dataset.orbit!==undefined)cycle(Number(b.dataset.orbit),true);
   else if(b.id==='exh-open-project')onOpen?.(slides[index]);
   else if(b.dataset.project)onOpen?.(projects.find(p=>p.id===b.dataset.project));
   else if(b.dataset.homeAction==='explore')onExplore?.();
   else if(b.dataset.homeAction==='market')onMarketplace?.('All');
   else if(b.dataset.homeCategory)onMarketplace?.(b.dataset.homeCategory);
 }
 const visual=q('.exh-hero-visual');
 function down(e){dragX=e.clientX;}
 function up(e){if(dragX===null)return;const delta=e.clientX-dragX;dragX=null;if(Math.abs(delta)>48)cycle(index+(delta<0?1:-1),true);}
 function visibilityChange(){if(document.hidden)stop();else start();}
 function mediaChange(){start();}
 container.addEventListener('click',onClick);
 visual.addEventListener('pointerdown',down);
 visual.addEventListener('pointerup',up);
 visual.addEventListener('pointercancel',()=>dragX=null);
 visual.addEventListener('mouseenter',()=>{hover=true;stop()});
 visual.addEventListener('mouseleave',()=>{hover=false;start()});
 visual.addEventListener('focusin',()=>{hover=true;stop()});
 visual.addEventListener('focusout',e=>{if(!visual.contains(e.relatedTarget)){hover=false;start()}});
 document.addEventListener('visibilitychange',visibilityChange);
 reduced.addEventListener?.('change',mediaChange);
 if('IntersectionObserver'in window){
  observer=new IntersectionObserver(entries=>{
   for(const e of entries){
    if(e.target===visual){visibility=e.intersectionRatio>.14;visibility?start():stop();}
    else if(e.isIntersecting){e.target.classList.add('exh-in-view');observer.unobserve(e.target);}
   }
  },{threshold:[0,.15,.25]});
  observer.observe(visual);
  all('.exh-reveal').forEach(el=>observer.observe(el));
 }else{all('.exh-reveal').forEach(el=>el.classList.add('exh-in-view'));start();}
 return {destroy(){removed=true;stop();clearTimeout(updated);observer?.disconnect();document.removeEventListener('visibilitychange',visibilityChange);reduced.removeEventListener?.('change',mediaChange);container.removeEventListener('click',onClick);visual.removeEventListener('pointerdown',down);visual.removeEventListener('pointerup',up);container.replaceChildren();},pause:stop,resume:start,cycle};
}
