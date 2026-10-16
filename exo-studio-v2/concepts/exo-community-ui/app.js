// EXO Community / Pattern Lab concept. Offline demo only: no network or native EXO operations.
import {createPremiumScreens} from './screens-v2.js';
import {mountPatternVisualizer} from './pattern-visualizer.js';
import {mountMaterialExperience} from './materials-experience.js';
import {mountFabricStore} from './fabric-store.js';
import {PROJECTS} from './project-media.js';
import {mountProjectHomepage} from './project-home.js';
import {mountExplorePage,mountForumPage} from './community-social.js';
import {mountDesignerProfiles} from './designer-profiles.js';
const A=[
{id:'arc',title:'Arc Shoulder Hoodie',creator:'STUDIO FORM',category:'Garments',tone:'sand',price:'View only',remix:false,formats:['GLB'],kind:'hoodie',desc:'A sculptural French terry silhouette with forward shoulder articulation.',spec:{Silhouette:'Relaxed / oversize',Material:'French Terry',Sizes:'XS–XXL',Source:'Private / view-only'}},
{id:'denim',title:'Selvedge Straight Denim',creator:'MAISON ZERO',category:'Patterns',tone:'chalk',price:'Free',remix:true,formats:['DXF'],kind:'pattern',desc:'Five-pocket drafting study, grainlines, documented construction.',spec:{Formats:'DXF / SVG',Sizes:'28–38',Seams:'Illustrative',Source:'Remix-friendly concept'}},
{id:'terry',title:'Loopback French Terry',creator:'MATERIAL ARCHIVE',category:'Materials',tone:'olive',price:'Free',remix:true,formats:['PBR'],kind:'fabric',desc:'Dense loopback cotton study, procedural weave and neutral finish.',spec:{Weight:'460 GSM (sample metadata)',Appearance:'Procedural',Physics:'Unmeasured',Maps:'Albedo / normal / roughness'}},
{id:'concrete',title:'Concrete Atelier',creator:'STUDIO FORM',category:'Studios',tone:'studio',price:'$18',remix:true,formats:['GLB','BLEND'],kind:'studio',desc:'A brutalist photo set with neutral surfaces and warm lighting.',spec:{Formats:'BLEND / GLB',Cameras:'Front / ¾ / detail',Lighting:'Three rigs',Source:'Paid concept'}},
{id:'moto',title:'Moto Layer 02',creator:'MIKRISTIAN LAB',category:'Garments',tone:'ink',price:'View only',remix:false,formats:['GLB'],kind:'jacket',desc:'An architectural padded moto silhouette with original details.',spec:{Fit:'Cropped / articulated',Material:'Washed cotton/padding',Patterns:'Not shared',Source:'Visual only'}},
{id:'rib',title:'Rib Collar System',creator:'FORMLESS PATTERNS',category:'Patterns',tone:'cream',price:'$12',remix:false,formats:['DXF'],kind:'pattern',desc:'A modular collar and cuffs construction reference.',spec:{Format:'DXF / SVG',Type:'Pattern components',Sizes:'Concept graded templates',Rights:'Paid reference'}},
{id:'suede',title:'Washed Suede / 07',creator:'TEXTILE LAB',category:'Materials',tone:'clay',price:'Free',remix:false,formats:['PBR'],kind:'fabric',desc:'Soft micro-relief and directional nap with muted variation.',spec:{Surface:'Suede inspired',Maps:'Visual-only',Weight:'Unknown',Physics:'Not calibrated'}},
{id:'runway',title:'Runway / No. 04',creator:'OTHER SPACES',category:'Studios',tone:'denim',price:'$24',remix:true,formats:['BLEND','GLB'],kind:'studio',desc:'A dramatic linear showroom for multiple avatars.',spec:{Environment:'Runway',Lighting:'Spots',Cameras:'Multiple',Rights:'Paid concept'}}
];
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const safe=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const state={page:'discover',search:'',sort:'curated',discipline:new Set(),license:new Set(),format:new Set(),remix:false,labFilter:'All',labSearch:'',labFree:false,selected:null,detailTab:'Overview',saved:new Set(),imported:new Set()};
const EXTRAS=PROJECTS.filter(p=>['Trims','Avatars','Scenes','Garments'].includes(p.category)).map(p=>({id:'work-'+p.id,projectId:p.id,title:p.title,creator:p.creator,category:p.category,tone:'ink',price:'View only',remix:false,formats:['IMAGE'],kind:'studio',image:p.image,desc:p.description,spec:{Source:p.source,Status:'Original project screenshot or render'}}));
const CATEGORY_NAMES=['All','Garments','Fabrics','Trims','Avatars','Scenes','Patterns'];
let marketCategory='All',activeSocialCleanup=null,homeMount=null;
const marketName=a=>a.category==='Materials'?'Fabrics':a.category==='Studios'?'Scenes':a.category;
let artSerial=0;
function art(x){
 const k=x.kind||x,base=(k==='jacket'?'#4a504b':k==='hoodie'?'#b7ad9d':k==='fabric'?'#a1a795':'#dad8cf');
 const assetLabel=typeof x==='object'?(x.id==='rib'?'rib collar and cuff':'garment')+' illustration':k+' illustration';
 const id=++artSerial,clothId='exo-illustration-cloth-'+id,grainId='exo-illustration-grain-'+id;
 const prefix='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 405" role="img" aria-label="'+safe(assetLabel)+'"><defs><linearGradient id="'+clothId+'" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+base+'"/><stop offset=".6" stop-color="'+base+'"/><stop offset="1" stop-color="#777b73"/></linearGradient><pattern id="'+grainId+'" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 5H9M5 0V9" stroke="#434941" stroke-width=".35" opacity=".4"/></pattern></defs>';
 const hoodie='<ellipse cx="171" cy="370" rx="108" ry="16" fill="#41463d" opacity=".13"/><path d="M123 66Q120 30 168 25Q213 29 215 67L242 92L280 137L310 255L265 272L235 181L247 356Q169 368 91 356L106 181L75 271L32 256L65 136L100 91Z" fill="url(#cloth)" stroke="#55584e" stroke-width="2.5"/><path d="M123 68Q169 118 214 68L198 48Q169 36 143 49Z" fill="#85867b" stroke="#5a5e55" stroke-width="2"/><path d="M130 85Q167 134 206 85" fill="none" stroke="#dfd5c5" opacity=".4" stroke-width="3"/><path d="M109 236L224 236L213 308L123 308Z" fill="#adab9f" opacity=".8" stroke="#75766c"/><path d="M93 356Q168 367 246 357M34 255L74 267M268 271L310 255" fill="none" stroke="#ded9cc" stroke-width="5" opacity=".6"/>';
 const jacket='<path d="M123 69Q165 45 215 68L243 95L282 145L308 267L265 278L233 184L243 349L91 349L105 184L76 278L30 267L62 143L100 94Z" fill="url(#cloth)" stroke="#232a28" stroke-width="3"/><path d="M124 69Q167 113 215 69L201 48L137 48Z" fill="#717b71" stroke="#d6cdb8"/><path d="M166 117V347M109 168L147 177L146 219L105 213M196 177L233 167L238 214L197 220" stroke="#c3bcae" stroke-width="2" fill="none"/><path d="M100 114L143 146M192 145L236 114" stroke="#a5ab9e" stroke-width="7" fill="none"/>';
 const pattern='<g fill="#e8e7df" stroke="#797d73" stroke-width="2"><path d="M54 66L140 58L165 170L148 347L107 348L101 216L85 176L91 346L50 349L56 167Z"/><path d="M203 60L279 64L286 167L292 349L252 346L243 218L226 174L227 347L187 347L195 167Z"/></g><g fill="none" stroke="#ad9677" stroke-width="1.6" stroke-dasharray="4 5"><path d="M66 82H130L150 167L131 330M215 82H269L270 167L277 332"/><path d="M66 126H144M208 125H280"/></g><g fill="#999588" font-family="monospace" font-size="10"><text x="54" y="375">FRONT / M</text><text x="208" y="375">BACK / M</text></g>';
 const ribPattern='<g fill="#e8e7df" stroke="#747d7b" stroke-width="2"><path d="M48 135 Q105 42 169 54 Q233 42 292 135 L277 157 Q230 101 169 110 Q109 101 63 157Z"/><path d="M56 239 L138 226 L143 354 L62 366 Z"/><path d="M201 225 L282 239 L278 365 L196 352 Z"/></g><g stroke="#b2a180" stroke-width="1.4" fill="none" stroke-dasharray="5 5"><path d="M66 136Q169 54 273 136"/><path d="M96 246 L104 347M112 242L120 348M220 245L216 346M239 247L236 348M258 251L254 352"/></g><g fill="#adb0a8" font-family="monospace" font-size="10" text-anchor="middle"><text x="169" y="198">COLLAR / BAND</text><text x="102" y="389">CUFF 01</text><text x="239" y="389">CUFF 02</text></g>';
 const fabric='<path d="M55 66Q160 40 270 77L287 311Q173 350 54 312Z" fill="url(#cloth)" stroke="#77796c" stroke-width="2"/><path d="M60 70Q164 47 262 80L280 301Q177 341 63 306Z" fill="url(#grain)"/><path d="M62 73Q154 54 264 76M56 312Q169 345 287 310" fill="none" stroke="#ebe5d8" stroke-width="5" opacity=".55"/>';
 const studio='<path d="M13 67L169 16L327 73L325 330L169 384L11 330Z" fill="#a3a79e" stroke="#737970" stroke-width="2"/><path d="M13 67L169 16V384L11 330Z" fill="#c8c5b8"/><path d="M169 16L327 73V330L169 384Z" fill="#93978d"/><path d="M11 330L169 244L325 330L169 384Z" fill="#787a6f"/><path d="M64 105L139 82L142 265L64 302Z" fill="#d8d3c6"/><path d="M209 82L287 109V295L209 260Z" fill="#777d71"/><path d="M65 299L169 247L272 302L169 350Z" fill="#e6ddcb" stroke="#a8a494" stroke-width="2"/><path d="M171 254V344" stroke="#aea99a" stroke-dasharray="5 6"/>';
 return prefix+(x?.id==='rib'?ribPattern:k==='hoodie'?hoodie:k==='jacket'?jacket:k==='pattern'?pattern:k==='fabric'?fabric:studio).replaceAll('url(#cloth)','url(#'+clothId+')').replaceAll('url(#grain)','url(#'+grainId+')')+'</svg>';
}
const f=state;
let detailOpener=null;
let workspaceViewer=null, workspaceMaterial=null;
let galleryViewers=[];
let fabricStore=null;
function hideFabricStore(){const host=$('#fabric-store');if(host){host.hidden=true;fabricStore?.close?.();}}
function showFabricStore(){
 let host=$('#fabric-store');
 if(!host){host=document.createElement('section');host.id='fabric-store';host.setAttribute('aria-label','EXO Fabric Store');$('#catalog-section').insertBefore(host,$('#catalog-section .explore-shell'));}
 host.hidden=false;
 if(!fabricStore)fabricStore=mountFabricStore(host,{mountStudy:(node,asset)=>mountMaterialExperience(node,asset)});
 else fabricStore.refresh();
}
function galleryVisual(a){
 if(a.image)return '<span class="asset-photograph"><img src="'+safe(a.image)+'" alt="'+safe(a.title)+' project render" loading="eager" decoding="async"></span>';
 if(a.category==='Garments'||a.category==='Patterns')return '<span class="asset-preview-mount" data-preview-asset="'+safe(a.id)+'"></span>';
 if(a.category==='Materials')return '<span class="asset-textile-visual '+(a.id==='terry'?'asset-terry':'asset-suede')+'"><span class="textile-cut textile-cut-back"></span><span class="textile-cut textile-cut-front"></span><span class="textile-specimen">SURFACE REFERENCE / '+safe(a.id.toUpperCase())+'</span></span>';
 return art(a);
}
function buildGalleryPreviews(){
 galleryViewers.forEach(v=>v.destroy?.());galleryViewers=[];
 $$('.asset-preview-mount').forEach(element=>{
  const asset=A.find(a=>a.id===element.dataset.previewAsset);
  if(asset){
   galleryViewers.push(mountPatternVisualizer(element,asset,{mode:'3d'}));
   element.querySelector('.exo-pv-stage')?.setAttribute('tabindex','-1');
  }
 });
}
const viewerMaterialName=sample=>({terry:'French terry',denim:'Washed denim',twill:'Black twill',nylon:'Technical nylon',leather:'Brushed cotton',canvas:'Brushed cotton'}[sample?.id] || sample?.name || 'French terry');
const workspacePieces={
 denim:[['front','Front left leg','M32 20 L117 20 L108 80 L100 188 L66 188 L60 82 L31 78Z'],['back','Back left leg','M28 20 L121 20 L112 83 L101 188 L61 188 L56 84 L30 80Z'],['left','Front right leg','M32 20 L117 20 L108 80 L100 188 L66 188 L60 82 L31 78Z'],['right','Back right leg','M28 20 L121 20 L112 83 L101 188 L61 188 L56 84 L30 80Z'],['hood','Waistband / yoke','M18 74 Q79 56 142 74 L139 108 Q78 96 21 108Z']],
 rib:[['front','Collar band','M18 86 Q77 41 142 86 L142 112 Q79 76 18 112Z'],['back','Collar facing','M19 79 Q80 40 141 79 L133 121 Q78 89 27 121Z'],['left','Left cuff','M36 56 L122 56 L122 147 L36 147Z'],['right','Right cuff','M36 56 L122 56 L122 147 L36 147Z'],['hood','Rib swatch','M38 35 L122 35 L122 174 L38 174Z']]
};
function workspacePattern(asset){
 const board=$('#pattern-board'), source=board.querySelector(':scope > svg');
 let overlay=board.querySelector('.workspace-pattern-reference');
 if(!overlay){overlay=document.createElement('section');overlay.className='workspace-pattern-reference';overlay.setAttribute('aria-label','Linked 2D construction references');board.insertBefore(overlay,board.querySelector('#lab-preview-layer'));}
 const pieces=workspacePieces[asset?.id];
 $('#property-selected').textContent=pieces?.[0]?.[1] || 'Front body';
 if(!pieces){overlay.hidden=true;source.hidden=false;return;}
 source.hidden=true;overlay.hidden=false;
 overlay.innerHTML='<div class="workspace-pattern-note">'+safe(asset.title.toUpperCase())+' <span>2D REFERENCE / SELECT A PIECE</span></div><div class="workspace-pattern-grid">'+pieces.map(([id,name,path],i)=>'<button type="button" data-linked-panel="'+id+'" aria-pressed="'+(i===0)+'"><svg viewBox="0 0 160 208" role="img" aria-label="'+safe(name)+' flat pattern reference"><path d="'+path+'" class="workspace-cut-path"/><path d="M77 65V151" class="workspace-cut-grain"/><path d="m72 73 5 -11 5 11" class="workspace-cut-grain"/></svg><span>'+safe(name)+'</span></button>').join('')+'</div><p>Procedural panel study only. Actual DXF, seam allowances and validated sizing are unavailable.</p>';
}
function workspacePreview(asset){
  workspaceViewer?.destroy?.();workspaceViewer=null;
  const slot=$('#app-3d-art');slot.replaceChildren();
  workspaceViewer=mountPatternVisualizer(slot,asset,{mode:'3d',material:asset.id==='denim'?'Washed denim':asset.id==='moto'?'Black twill':'French terry'});
  workspacePattern(asset);
  $('#property-fabric').textContent=asset.id==='denim'?'Washed denim':asset.id==='moto'?'Black twill':'French terry';
  $('#property-gsm').textContent=asset.id==='denim'?'390 GSM · sample':asset.id==='moto'?'Unspecified · sample':'460 GSM · sample';
}
function clearWorkspacePreview(){
  workspaceViewer?.destroy?.();workspaceViewer=null;
  workspaceMaterial?.destroy?.();workspaceMaterial=null;
  $('#app-3d-art').innerHTML=art('hoodie');
  workspacePattern(A[0]);
}
function closeDetail(){const modal=$('#detail-modal');if(modal.hidden)return;modal.hidden=true;const node=detailOpener;detailOpener=null;if(node?.isConnected&&!node.closest('[hidden]'))node.focus();}
function filtered(a){return (marketCategory==='All'||marketName(a)===marketCategory)&&(!f.search||[a.title,a.creator,marketName(a)].join(' ').toLowerCase().includes(f.search))&&(!f.discipline.size||f.discipline.has(marketName(a)))&&(!f.license.size||f.license.has(a.price==='View only'?'View only':a.price==='Free'?'Free':'Paid'))&&(!f.format.size||[...f.format].some(x=>a.formats.includes(x)))&&(!f.remix||a.remix);}
function results(){const o=[...A,...EXTRAS].filter(filtered);if(f.sort==='name')o.sort((a,b)=>a.title.localeCompare(b.title));if(f.sort==='free')o.sort((a,b)=>Number(b.price==='Free')-Number(a.price==='Free'));if(f.sort==='new')o.reverse();return o;}
function render(){
 const list=results();
 galleryViewers.forEach(v=>v.destroy?.());galleryViewers=[];
 $('#asset-grid').innerHTML=list.map((a,i)=>'<article class="asset-card asset-'+safe(marketName(a).toLowerCase())+'"><div class="asset-art" data-tone="'+a.tone+'"><span class="asset-card-num">'+String(i+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0')+'</span>'+galleryVisual(a)+'<span class="asset-card-action" aria-hidden="true">↗</span><span class="asset-visual-label">'+safe(marketName(a).toUpperCase())+' / '+(a.image?'PROJECT PHOTO':a.category==='Materials'?'TEXTILE STUDY':'3D REFERENCE')+'</span><button class="asset-art-open" type="button" data-open="'+a.id+'" aria-label="Open '+safe(a.title)+' details"></button></div><div class="asset-foot"><div class="asset-meta">EXO / '+safe(marketName(a).toUpperCase())+' <span>· '+safe(a.creator)+'</span></div><div class="asset-title-row"><button class="asset-title" data-open="'+a.id+'">'+safe(a.title)+'</button><span class="asset-price">'+a.price+'</span></div><div class="asset-description">'+safe(a.desc)+'</div><div class="asset-tags"><span>'+a.formats.join(' / ')+'</span><span>'+(a.remix?'REMIXABLE':'REFERENCE')+'</span></div></div></article>').join('');
 buildGalleryPreviews();
 $('#result-count').textContent=String(list.length).padStart(2,'0')+' WORKS';
 $('#empty-results').hidden=list.length!==0;
 const active=[...f.discipline,...f.license,...f.format,...(f.remix?['Remix permitted']:[])];
 $('#active-filters').innerHTML=active.length?active.map(v=>'<button class="filter-chip" data-clear-one="'+v+'">'+safe(v)+' <span>×</span></button>').join(''):'<span class="quiet">SELECTED WORK / ALL DISCIPLINES</span>';
}
function toast(s){const x=$('#toast');x.textContent=s;x.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>x.classList.remove('show'),3600);}
function clearAll(){for(const x of ['discipline','license','format'])f[x].clear();f.search='';f.remix=false;$('#catalog-search').value='';$$('#facets input').forEach(x=>x.checked=false);render();}
function closeAlternate(){activeSocialCleanup?.();activeSocialCleanup=null;const alt=$('#alt-view');if(alt){alt.hidden=true;alt.className='alt-page';}}
let photoFocus=null;
function closePhotoProject(){
 const el=$('#exo-project-detail');if(!el)return;el.remove();document.body.classList.remove('exo-project-open');photoFocus?.focus?.();photoFocus=null;
}
function openPhotoProject(project){
 if(!project)return;
 closePhotoProject();photoFocus=document.activeElement;
 const dialog=document.createElement('div');dialog.id='exo-project-detail';dialog.className='exo-project-overlay';
 dialog.innerHTML='<div class="exo-project-shade" data-project-close></div><section class="exo-project-panel" role="dialog" aria-modal="true" aria-label="'+safe(project.title)+'"><div class="exo-project-large-photo"><img src="'+safe(project.image)+'" alt="'+safe(project.alt)+'"><span>ACTUAL WORKSPACE IMAGE · '+safe(project.category.toUpperCase())+'</span></div><div class="exo-project-description"><div class="exo-project-top"><span>EXO COMMUNITY / PROJECT SPOTLIGHT</span><button type="button" data-project-close aria-label="Close project">✕</button></div><span class="exo-project-category">'+safe(project.category.toUpperCase())+' / CREATOR STUDY</span><h2>'+safe(project.title)+'</h2><p>'+safe(project.description)+'</p><div class="exo-project-credit"><span>CREATED IN</span><strong>'+safe(project.source)+'</strong><span>CURATED CREATOR</span><strong>'+safe(project.creator)+'</strong></div><div class="exo-project-actions"><button type="button" data-project-profile="'+safe(project.creator)+'">View designer portfolio ↗</button>'+(project.assetId?'<button type="button" data-related-asset="'+safe(project.assetId)+'">View related asset ↗</button>':'')+'</div><small>Project images from the local workspace. Creator profiles and social interactions are prototype-only.</small></div></section>';
 $('#website').append(dialog);document.body.classList.add('exo-project-open');
 dialog.addEventListener('click',e=>{
  if(e.target.classList.contains('exo-project-shade')){closePhotoProject();return;}
  const button=e.target.closest('[data-project-close],[data-project-profile],[data-related-asset]');
  if(!button)return;
  if(button.hasAttribute('data-project-close'))closePhotoProject();
  if(button.dataset.projectProfile){const name=button.dataset.projectProfile;closePhotoProject();nav('profile',name);}
  if(button.dataset.relatedAsset){const id=button.dataset.relatedAsset;closePhotoProject();detail(id);}
 });
 dialog.querySelector('[data-project-close][aria-label]')?.focus();
}
document.addEventListener('keydown',e=>{
 const dialog=$('#exo-project-detail');
 if(!dialog)return;
 if(e.key==='Escape'){e.preventDefault();closePhotoProject();return;}
 if(e.key==='Tab'){
  const controls=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(el=>el.getClientRects().length>0);
  if(!controls.length)return;
  const first=controls[0],last=controls[controls.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
});
let initializingNavigation=true,historyNavigation=false,lastObservedHash=location.hash;
function routeHash(page,creatorName){
 if(historyNavigation)return;
 const slug={discover:'home',marketplace:'marketplace',explore:'explore',forum:'forum',profile:'profile'}[page];
 if(!slug)return;
 const creatorSlug=creatorName?String(creatorName).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):'';
 const marketSlug=page==='marketplace'&&marketCategory!=='All'?(marketCategory==='Fabrics'?'fabrics':'marketplace/'+encodeURIComponent(marketCategory.toLowerCase())):slug;
 const target='#'+marketSlug+(page==='profile'&&creatorSlug?'/'+encodeURIComponent(creatorSlug):'');
 if(location.hash!==target)history[initializingNavigation?'replaceState':'pushState'](null,'',target);
 lastObservedHash=target;
}
function marketplaceCategory(category='All'){
 marketCategory=CATEGORY_NAMES.includes(category)?category:'All';
 $$('[data-market-category]').forEach(el=>{const active=el.dataset.marketCategory===marketCategory;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
 if(marketCategory==='Fabrics'){showFabricStore();$('#catalog-section .explore-shell').hidden=true;}
 else{hideFabricStore();$('#catalog-section .explore-shell').hidden=false;}
 f.discipline.clear();$$('input[name="discipline"]').forEach(i=>i.checked=false);render();
 if(f.page==='marketplace')routeHash('marketplace');
}
function routeSocial(page,creatorName){
 closeAlternate();hideFabricStore();
 const alt=$('#alt-view')||(()=>{const n=document.createElement('section');n.id='alt-view';$('#site-content').insertBefore(n,$('.feature-banner'));return n})();
 alt.hidden=false;alt.className='exo-social-page';
 const props={projects:PROJECTS,onOpenProject:openPhotoProject,onProfile:(name)=>nav('profile',name)};
 if(page==='explore')activeSocialCleanup=mountExplorePage(alt,props);
 else if(page==='forum')activeSocialCleanup=mountForumPage(alt,props);
 else {alt.className='exo-profile-page';activeSocialCleanup=mountDesignerProfiles(alt,{projects:PROJECTS,creatorId:creatorName||'mikristian-lab',onOpenProject:openPhotoProject,onNavigate:nav});}
 window.scrollTo({top:0,behavior:'instant'});
}
function nav(page,creatorName){
 if(page==='patterns'){page='marketplace';creatorName=null;marketCategory='Patterns';}
 if(page==='materials'){page='marketplace';marketCategory='Fabrics';}
 if(page==='studios'){page='marketplace';marketCategory='Scenes';}
 if(page==='creators')page='profile';
 const isHome=page==='discover',isMarket=page==='marketplace';
 if(isHome)marketCategory='All';
 f.page=page;
 document.body.classList.toggle('exo-fabrics-active',isMarket&&marketCategory==='Fabrics');
 document.body.classList.toggle('exo-community-social-active',!isHome&&!isMarket);
 $$('[data-nav]').forEach(el=>el.classList.toggle('selected',el.dataset.nav===page));
 $('#hero').hidden=true;$('.intro-strip').hidden=true;$('.edition-feature').hidden=true;
 $('#project-home').hidden=!isHome;$('#catalog-section').hidden=!(isHome||isMarket);
 if(isHome||isMarket){
   closeAlternate();
   homeMount?.[isHome?'resume':'pause']?.();
   if(isMarket&&marketCategory==='All')marketCategory='All';
   marketplaceCategory(marketCategory);
   $('#catalog-heading').textContent='The marketplace.';
   $('#catalog-subtitle').textContent='One archive for garments, fabric, trims, avatars, scenes and pattern resources.';
   if(isMarket)$('#catalog-section').scrollIntoView({block:'start'});
   else window.scrollTo({top:0,behavior:'instant'});
 }else {homeMount?.pause?.();routeSocial(page,creatorName);}
 routeHash(page,creatorName);
}
function alternate(kicker,title,descr,tiles){hideFabricStore();$('#project-home').hidden=true;$('#hero').hidden=true;$('.intro-strip').hidden=true;$('.edition-feature').hidden=true;$('#catalog-section').hidden=true;let alt=$('#alt-view');if(!alt){alt=document.createElement('section');alt.id='alt-view';alt.className='alt-page';$('#site-content').insertBefore(alt,$('.feature-banner'))}alt.hidden=false;alt.innerHTML='<div class="alt-kicker">'+safe(kicker)+' / RESEARCH UI CONCEPT</div><h1>'+safe(title)+'</h1><p>'+safe(descr)+'</p><div class="alt-grid">'+tiles.map(t=>'<button class="alt-tile" data-action="placeholder"><small>EXO / '+safe(t[2])+'</small><strong>'+safe(t[0])+'</strong><span>'+safe(t[1])+' ↗</span></button>').join('')+'</div><div class="alt-actions"><button id="alt-return">Explore the archive ↗</button></div>';$('#alt-return').addEventListener('click',()=>nav('discover'));}
function view(page){$$('[data-nav]').forEach(el=>el.classList.remove('selected'));if(page==='profile'){nav('profile');return}if(page==='teams'){alternate('TEAM WORKSPACE','Better together.','Collaborate with factories and patternmakers, without losing source control or approved revisions.',[['PRODUCT WORKROOM','Review and comment','TEAMS'],['INTERACTIVE TECH PACK','Measurements and samples','FACTORY'],['RELEASE HISTORY','Approved snapshots','VERSIONED']]);$$('.alt-tile')[1].dataset.action='techpack';}}
function creatorProfile(tab='Work'){
 $('#hero').hidden=true;$('.intro-strip').hidden=true;$('.edition-feature').hidden=true;$('#catalog-section').hidden=true;let alt=$('#alt-view');
 if(!alt){alt=document.createElement('section');alt.id='alt-view';$('#site-content').insertBefore(alt,$('.feature-banner'))}
 alt.hidden=false;alt.className='creator-page';
 const portfolio=A.filter(a=>a.creator==='MIKRISTIAN LAB'||a.creator==='STUDIO FORM'||a.creator==='MATERIAL ARCHIVE');
 const selected=tab==='Work'?portfolio:tab==='Patterns'?A.filter(a=>a.category==='Patterns'):tab==='Materials'?A.filter(a=>a.category==='Materials'):portfolio;
 alt.innerHTML='<div class="creator-cover"><span>EXO CREATOR / SELECTED WORK</span><div class="cover-object">✳</div><span>BUILD WHAT YOU ENVISION</span></div><div class="creator-main"><div class="creator-identity"><div class="creator-symbol">MK</div><div><span class="creator-eyebrow">CREATOR / CONCEPT ACCOUNT</span><h1>MIKRISTIAN LAB<span class="creator-dot">.</span></h1><p>A practice in architectural garments, form, and materially driven design.</p><div class="creator-links">DESIGN STUDIO <span>·</span> 3D GARMENTS <span>·</span> PRIVATE SOURCES PROTECTED</div></div><div class="creator-actions"><button id="creator-follow">Follow studio</button><button id="creator-showroom">Enter showroom ↗</button></div></div><div class="creator-stats"><span>FEATURED WORK <strong>04</strong></span><span>COLLECTIONS <strong>02</strong></span><span>DESIGN STATUS <strong>INDEPENDENT</strong></span><span>EDITABLE SOURCE <strong>PRIVATE</strong></span></div><div class="creator-topline"><div class="creator-tabs">'+['Work','Patterns','Materials','About'].map(name=>'<button data-profile-tab="'+name+'" class="'+(name===tab?'active':'')+'">'+name+'</button>').join('')+'</div><span>EDITORIAL SELECTION / DEMO ITEMS ONLY</span></div><div class="creator-gallery">'+(tab==='About'?'<div class="creator-about"><h2>Form follows the idea.</h2><p>This creator page is a design demonstration. In the production ecosystem, a studio chooses whether a visual garment is public and which pattern or fabric files are licensed for download. A public look never exposes private tech pack calculations.</p></div>':selected.map(a=>'<button class="creator-work" data-open="'+a.id+'"><span class="creator-work-art">'+art(a)+'</span><strong>'+safe(a.title)+'</strong><small>'+a.category+' · '+a.price+' · '+a.creator+'</small></button>').join(''))+'</div></div>';
 $$('[data-profile-tab]').forEach(el=>el.addEventListener('click',()=>creatorProfile(el.dataset.profileTab)));
 $('#creator-follow').addEventListener('click',()=>toast('Follow is a planned feature; no accounts or follow graph exist in this demo.'));
 $('#creator-showroom').addEventListener('click',()=>toast('The immersive wardrobe showroom is planned; the current prototype is only a visual design.'));
 window.scrollTo(0,0);
}
function techpack(){
 const alt=$('#alt-view');if(!alt)return;
 alt.hidden=false;alt.className='techpack-page';
 const header='<div class="tp-crumb"><button id="tp-back">← TEAMS / PRODUCT DEVELOPMENT</button><span>EXO / WEB TECH PACK CONCEPT · READ-ONLY SAMPLE</span></div><div class="tp-top"><div><span class="tp-eyebrow">PRODUCT DEVELOPMENT / MIKRISTIAN LAB</span><h1>Arc Shoulder Hoodie <small>001</small></h1><p>Living spec prototype · Sample collection / Autumn 2026</p></div><div class="tp-options"><label>VIEW AS <select id="tp-role"><option value="Designer">Designer</option><option value="Manufacturer">Manufacturer</option></select></label><label>REVISION <select id="tp-version"><option value="R02">R02 / Approved</option><option value="R01">R01 / Superseded</option></select></label></div></div>';
 const sidebar='<nav class="tp-side" aria-label="Technical pack sections"><div>SPECIFICATION</div><button class="active">Overview <span>↗</span></button><button data-tp-note="Measurements">Measurements</button><button data-tp-note="Materials">Materials / BOM</button><button data-tp-note="Construction">Construction</button><button data-tp-note="Sampling">Sampling & QC</button><button data-tp-note="Revision">Revision history</button><div class="tp-side-divider"></div><button data-tp-note="Download">Approved export</button></nav>';
 const main='<div class="tp-main"><div class="tp-subnav"><button class="active" data-tp-tab="2D">2D TECHNICAL FLAT</button><button data-tp-tab="3D">3D VIEW</button><button data-tp-tab="REF">REFERENCE / MOODBOARD</button><span>SPECIMEN / NOT A PRODUCTION APPROVAL</span></div><div id="tp-art" class="tp-art">'+art('hoodie')+'<div class="tp-art-note">TECHNICAL PREVIEW<br>AUTHORING SOURCE PRIVATE</div></div><div class="tp-measurements"><div class="tp-section-head"><h3>Point of measurement</h3><span id="tp-diff">R01 → R02 · CUFF REVISED</span></div><table><thead><tr><th>POINT</th><th>SIZE M</th><th>TOLERANCE</th><th>STATUS</th></tr></thead><tbody><tr><td>Body length</td><td>71.0 cm</td><td>±0.7 cm</td><td>Within</td></tr><tr><td>1/2 chest</td><td>63.0 cm</td><td>±0.5 cm</td><td>Within</td></tr><tr class="tp-changed"><td>Cuff opening</td><td id="tp-cuff">22.0 cm</td><td>±0.4 cm</td><td id="tp-status">REVISED</td></tr><tr><td>Sleeve length</td><td>64.0 cm</td><td>±0.7 cm</td><td>Within</td></tr></tbody></table></div></div>';
 const comments='<aside class="tp-comments"><div class="tp-section-head"><h3>REVIEW THREADS</h3><span>02</span></div><div class="tp-status-card"><strong id="tp-release-status">APPROVED RELEASE R02</strong><p>This illustration contains fictional measurements and notes. No real factory release or editable Tech Pack exists.</p></div><div class="tp-comment"><div class="tp-person"><b>FH</b><span><strong>Factory review</strong><small>Sample 1 · Cuff / M</small></span></div><p>Cuff opening appears 1.2 cm wider than target. Please confirm the revised specification.</p><span class="tp-comment-meta">POM / CUFF OPENING · PINNED</span></div><div class="tp-comment"><div class="tp-person"><b>MK</b><span><strong>Designer response</strong><small>Spec revision R02</small></span></div><p>Revision prepared and reviewed. R01 remains preserved for comparison.</p><span class="tp-comment-meta">RESOLVED IN CONCEPT · NO ACTUAL APPROVAL</span></div><label class="tp-comment-label" for="tp-comment-box">ADD A REVIEW NOTE</label><textarea id="tp-comment-box" placeholder="Reference a panel, sample, or POM…"></textarea><button id="tp-add-note">Add demo note</button><div id="tp-add-result" role="status"></div></aside>';
 alt.innerHTML=header+'<div class="tp-workspace">'+sidebar+main+comments+'</div>';
 $('#tp-back').addEventListener('click',()=>view('teams'));
 $('#tp-version').addEventListener('change',ev=>{const old=ev.target.value==='R01';$('#tp-cuff').textContent=old?'23.2 cm':'22.0 cm';$('#tp-status').textContent=old?'SUPERSEDED':'REVISED';$('#tp-release-status').textContent=old?'SUPERSEDED RELEASE R01':'APPROVED RELEASE R02';$('#tp-diff').textContent=old?'SUPERSEDED / ARCHIVAL':'R01 → R02 · CUFF REVISED';});
 $('#tp-role').addEventListener('change',ev=>{const factory=ev.target.value==='Manufacturer';$$('.tp-comments .tp-comment-label,.tp-comments textarea,.tp-comments #tp-add-note').forEach(el=>el.hidden=false);toast(factory?'Manufacturer view: access is scoped to the approved release in a real product.':'Designer view: internal details would require authorization in production.');});
 $$('[data-tp-tab]').forEach(el=>el.addEventListener('click',()=>{const mode=el.dataset.tpTab;$$('[data-tp-tab]').forEach(b=>b.classList.toggle('active',b===el));$('#tp-art').innerHTML=mode==='REF'?'<div class="tp-ref">REFERENCE COLLECTION<br><small>Original materials · construction details · wash study</small></div>':art(mode==='3D'?'jacket':'hoodie')+'<div class="tp-art-note">'+(mode==='3D'?'3D PREVIEW':'TECHNICAL PREVIEW')+'<br>AUTHORING SOURCE PRIVATE</div>'; }));
 $$('[data-tp-note]').forEach(el=>el.addEventListener('click',()=>toast(el.dataset.tpNote+' section is specified in the design document but not connected to a database.')));
 $('#tp-add-note').addEventListener('click',()=>{const v=$('#tp-comment-box').value.trim();if(!v){$('#tp-add-result').textContent='Enter a note before submitting.';return;}$('#tp-add-result').textContent='Demo comment captured in this screen only; no production record was changed.';$('#tp-comment-box').value='';});
 secondRound.enhanceTechPack();
 window.scrollTo(0,0);
}
function detail(id){const a=A.find(x=>x.id===id);if(!a){if(id.startsWith('work-'))openPhotoProject(PROJECTS.find(p=>p.id===id.slice(5)));return;}detailOpener=document.activeElement;f.selected=id;f.detailTab='Overview';$('#detail-title').textContent=a.title;$('#detail-kind').textContent='EXO / '+a.category.toUpperCase()+' / '+a.id.toUpperCase();$('#detail-creator').textContent='By '+a.creator+' · '+a.price;$('#detail-art').innerHTML=art(a);$('#detail-art').style.background={sand:'#cfc6b4',chalk:'#d7d7cf',ink:'#646a65',cream:'#cec6b8',denim:'#9da7a4',olive:'#b0b1a1',clay:'#a99989',studio:'#bebdb5'}[a.tone];$('#detail-save').textContent=f.saved.has(id)?'✓ Saved to collection':'＋ Save to collection';$('#detail-primary').textContent=a.price==='View only'?'Inspect in Pattern Lab ↗':a.price==='Free'?'Preview for import ↗':'Review license in Pattern Lab ↗';detailBody();$('#detail-modal').hidden=false;$('#detail-close').focus();}
function detailBody(){const a=A.find(x=>x.id===f.selected);if(!a)return;$$('[data-detail-tab]').forEach(b=>b.classList.toggle('active',b.dataset.detailTab===f.detailTab));if(f.detailTab==='Overview')$('#detail-body').innerHTML='<p>'+safe(a.desc)+'</p><p><strong>Rights:</strong> '+(a.price==='View only'?'Preview only. Original source remains private.':'Demonstration listing with no downloadable files.')+'</p>';if(f.detailTab==='Specifications')$('#detail-body').innerHTML='<dl>'+Object.entries(a.spec).map(([k,v])=>'<dt>'+safe(k)+'</dt><dd>'+safe(v)+'</dd>').join('')+'</dl>';if(f.detailTab==='License')$('#detail-body').innerHTML='<p>'+ (a.price==='View only'?'Not available for download or editing.':a.price==='Free'?'Conceptually free. A real license and files would still be verified.':'Payment rights and entitlement are not implemented.')+'</p><p>This research prototype makes no actual sale, file grant, or file transfer.</p>';}
function labResults(){let a=A.filter(x=>(f.labFilter==='All'||x.category===f.labFilter)&&(!f.labSearch||[x.title,x.creator,x.category].join(' ').toLowerCase().includes(f.labSearch)));if(f.labFree)a.sort((x,y)=>Number(y.price==='Free')-Number(x.price==='Free'));return a;}
function labRender(){const a=labResults();$('#lab-result-count').textContent=a.length+' ASSETS';$('#lab-items').innerHTML=a.map(x=>'<button class="lab-item '+(f.selected===x.id?'active':'')+'" data-lab-id="'+x.id+'"><span class="lab-thumb">'+art(x)+'</span><span class="lab-copy"><strong>'+safe(x.title)+'</strong><small>'+safe(x.creator)+' · '+x.category+'</small><em>'+x.price+' · '+x.formats.join(' / ')+'</em></span><span class="lab-arrow">›</span></button>').join('')||'<p style="padding:16px;font-size:11px">No matching assets. Try another query.</p>';$$('[data-lab-filter]').forEach(x=>x.classList.toggle('on',x.dataset.labFilter===f.labFilter));}
function labInfo(id){
 const a=A.find(x=>x.id===id);if(!a)return;f.selected=id;
 $('#lab-preview-layer').hidden=true;
 workspaceMaterial?.destroy?.();workspaceMaterial=null;
 if(a.category==='Patterns'||a.category==='Garments') workspacePreview(a);
 else if(a.category==='Materials' && !workspaceViewer) workspacePreview(A[0]);
 const compatibility={
  Patterns:['2D authoring / reference','Unit, seam, and DXF checks required','Editable only after verified import'],
  Materials:['Selected fabric / optical maps','PBR visual material; measured physics separate','Never silently change cloth mechanics'],
  Garments:['3D garment / reference view','Visual mesh does not contain editable CAD','Original sewing and grading remain private'],
  Studios:['Virtual photography / studio library','Blender lights and textures need validation','Stage preview, not garment CAD']
 }[a.category];
 $('#lab-info').innerHTML='<strong>'+safe(a.title)+'</strong><p>'+(a.price==='View only'?'Source private; visual inspection only.':a.price==='Free'?'Free demo sample; real format checks required.':'Paid sample; actual entitlement required.')+' '+a.formats.join(' · ')+'. This is a simulated workspace.</p>'+
 (a.category==='Materials'?'<div id="lab-material-study" class="lab-material-study"></div>':'<div class="lab-technical-note">Use the 3D form study to rotate the reference garment, switch to 2D cutting pieces and select linked construction panels.</div>')+
 '<div class="lab-compat"><div><span>DESTINATION</span><b>'+safe(compatibility[0])+'</b></div><div><span>COMPATIBILITY</span><b>'+safe(compatibility[1])+'</b></div><div><span>SAFETY</span><b>'+safe(compatibility[2])+'</b></div></div>'+
 '<div class="lab-action-row"><button id="lab-preview">Preview selection</button><button class="secondary" id="lab-add">'+(f.imported.has(id)?'✓ Added to mock library':'＋ Add to mock library')+'</button></div>';
 if(a.category==='Materials')workspaceMaterial=mountMaterialExperience($('#lab-material-study'),a,{onMaterialChange:material=>{workspaceViewer?.setMaterial?.(viewerMaterialName(material));$('#property-fabric').textContent=material.name;$('#property-gsm').textContent=material.gsm+' GSM · illustrative';},onApply:()=>toast('Material appearance selected for this preview only; real material physics unchanged.')});
 $('#lab-preview').addEventListener('click',()=>{$('#lab-preview-layer').hidden=false;$('#lab-preview-layer').innerHTML='PREVIEW · '+a.category.toUpperCase()+'<span>NO NATIVE EXO FILES CHANGED</span>';toast('Demo overlay only. No live EXO geometry was modified.');});
 $('#lab-add').addEventListener('click',()=>{if(a.price==='View only'){toast('The creator only permits visual viewing, not importing.');return}if(a.price!=='Free'){toast('Checkout is not connected. This paid asset cannot be imported.');return}f.imported.add(id);$('#app-library-count').textContent=f.imported.size;labInfo(id);toast('Added to demo library only; no native EXO import took place.');});
}
function enterApp(){$('#website').hidden=true;$('#app-surface').hidden=false;$('#detail-modal').hidden=true;$('#lab-drawer').classList.remove('closed');workspacePreview(A.find(a=>a.id===f.selected&&['Patterns','Garments'].includes(a.category))||A[0]);labRender();window.scrollTo(0,0);document.title='EXO Studio — Pattern Lab · Concept';}
function leaveApp(){clearWorkspacePreview();$('#app-surface').hidden=true;$('#website').hidden=false;window.scrollTo(0,0);document.title='EXO — Fashion assets, without limits · Concept UI';}
$('#pattern-board').addEventListener('click',event=>{
 const piece=event.target.closest('[data-linked-panel]');if(!piece)return;
 workspaceViewer?.selectPanel?.(piece.dataset.linkedPanel);
 $('#pattern-board').querySelectorAll('[data-linked-panel]').forEach(item=>item.setAttribute('aria-pressed',String(item===piece)));
 $('#property-selected').textContent=piece.querySelector('span')?.textContent || 'Pattern section';
});
$('.brand').addEventListener('click',event=>{event.preventDefault();nav('discover');window.scrollTo({top:0,behavior:'smooth'});});
document.addEventListener('click',ev=>{
 if(ev.target.closest('.exo-social-root,.dp-root'))return;
 const b=ev.target.closest('[data-nav],[data-view],[data-open],[data-lab-id],[data-clear-one],[data-action],[data-market-category]');
 if(!b)return;
 if(b.dataset.marketCategory){nav('marketplace');marketplaceCategory(b.dataset.marketCategory);document.body.classList.toggle('exo-fabrics-active',b.dataset.marketCategory==='Fabrics');return;}
 if(b.dataset.nav){marketCategory='All';nav(b.dataset.nav);return;}
 if(b.dataset.view){view(b.dataset.view);return;}
 if(b.dataset.open){detail(b.dataset.open);return;}
 if(b.dataset.labId){labInfo(b.dataset.labId);labRender();return;}
 if(b.dataset.clearOne){const v=b.dataset.clearOne;if(v==='Remix permitted'){f.remix=false;$('#remix-check').checked=false;}else{for(const kind of ['discipline','license','format'])f[kind].delete(v);$$('#facets input').filter(x=>x.value===v).forEach(x=>x.checked=false);}render();return;}
 if(b.dataset.action){if(b.dataset.action==='studio'){enterApp();return;}if(b.dataset.action==='techpack'){techpack();return;}if(b.dataset.action==='upload'){secondRound.publishWizard();return;}if(b.dataset.action==='asset-full'){secondRound.assetDetail(f.selected);return;}toast('Concept section only. No external actions.');}
});
$$('#facets input').forEach(i=>i.addEventListener('change',()=>{if(i.name&&f[i.name]){i.checked?f[i.name].add(i.value):f[i.name].delete(i.value)}else f.remix=$('#remix-check').checked;render()}));
$('#catalog-search').addEventListener('input',e=>{f.search=e.target.value.trim().toLowerCase();render()});$('#sort-choice').addEventListener('change',e=>{f.sort=e.target.value;render()});
$('#clear-filters').addEventListener('click',clearAll);$('#empty-clear').addEventListener('click',clearAll);$('#grid-toggle').addEventListener('click',()=>$('#asset-grid').classList.toggle('compact'));$('#mobile-filter-toggle').addEventListener('click',()=>$('#facets').classList.toggle('visible'));
$('#top-search-trigger').addEventListener('click',()=>{if($('#fabric-store')&&!$('#fabric-store').hidden){$('#exfs-search').focus();$('#exfs-search').scrollIntoView({block:'center'});return;}marketCategory='All';nav('marketplace');$('#catalog-search').focus();$('#catalog-section').scrollIntoView()});
$('#detail-close').addEventListener('click',closeDetail);$('#detail-modal').addEventListener('click',e=>{if(e.target.id==='detail-modal')closeDetail()});
$$('[data-detail-tab]').forEach(x=>x.addEventListener('click',()=>{f.detailTab=x.dataset.detailTab;detailBody()}));
$('#detail-save').addEventListener('click',()=>{const id=f.selected;f.saved.has(id)?f.saved.delete(id):f.saved.add(id);$('#detail-save').textContent=f.saved.has(id)?'✓ Saved to collection':'＋ Save to collection';toast('Changed the demo saved collection.')});
$('#detail-primary').addEventListener('click',()=>{enterApp();f.labFilter='All';f.labSearch='';$('#lab-search').value='';labRender();labInfo(f.selected)});
$('#launch-lab').addEventListener('click',enterApp);$('#back-to-site').addEventListener('click',leaveApp);$('#visit-community').addEventListener('click',leaveApp);
$('#lab-search').addEventListener('input',e=>{f.labSearch=e.target.value.trim().toLowerCase();labRender()});$('#lab-free').addEventListener('change',e=>{f.labFree=e.target.checked;labRender()});
$$('[data-lab-filter]').forEach(x=>x.addEventListener('click',()=>{f.labFilter=x.dataset.labFilter;labRender()}));
$('#lab-close').addEventListener('click',()=>$('#lab-drawer').classList.add('closed'));$('#close-lab').addEventListener('click',()=>$('#lab-drawer').classList.toggle('closed'));$('#open-lab-from-panel').addEventListener('click',()=>$('#lab-drawer').classList.remove('closed'));$('#app-library').addEventListener('click',()=>toast('The demo library holds '+f.imported.size+' assets; live EXO is unchanged.'));
document.addEventListener('keydown',ev=>{const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);if(ev.key==='Escape'){closeDetail();$('#facets').classList.remove('visible')}if((ev.key==='/'||((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='k'))&&!typing){ev.preventDefault();if(!$('#app-surface').hidden){$('#lab-search').focus();}else if($('#fabric-store')&&!$('#fabric-store').hidden){$('#exfs-search').focus();}else{marketCategory='All';nav('marketplace');$('#catalog-search').focus();}}});
document.addEventListener('keydown',ev=>{if(ev.key!=='Tab'||$('#detail-modal').hidden)return;const visible=[...$('#detail-modal').querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(x=>x.getClientRects().length);if(!visible.length)return;const first=visible[0],last=visible[visible.length-1];if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus()}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus()}});
// Previous prototype hero preview regions remain hidden for legacy reference.
// The new photo-led homepage avoids mounting two invisible animated canvases.
$('#app-3d-art').innerHTML=art('hoodie');render();labRender();
homeMount=mountProjectHomepage($('#project-home'),{projects:PROJECTS,onOpen:openPhotoProject,onExplore:()=>nav('explore'),onProfile:(name)=>nav('profile',name),onMarketplace:category=>{nav('marketplace');marketplaceCategory(category);}});
window.EXO_CONCEPT={assets:A,projects:PROJECTS,state:f,render,labRender,enterApp,leaveApp,detail,art,toast,nav,marketplaceCategory};
const secondRound=createPremiumScreens({
 getAlt:()=>{let node=$('#alt-view');if(!node){node=document.createElement('section');node.id='alt-view';$('#site-content').insertBefore(node,$('.feature-banner'))}return node},
 art,assets:A,escape:safe,mountVisualizer:mountPatternVisualizer,mountMaterials:(container,asset,options={})=>mountMaterialExperience(container,asset,{...options,onMaterialChange:material=>{options.onMaterialChange?.(viewerMaterialName(material))}}),
 showLab:id=>{enterApp();f.labFilter='All';f.labSearch='';$('#lab-search').value='';labRender();labInfo(id)},
 backToCatalog:()=>nav(['discover','marketplace','explore','forum','profile'].includes(f.page)?f.page:'discover'),
 notify:toast,
 closeModal:()=>{$('#detail-modal').hidden=true}
});
window.EXO_CONCEPT.screens=secondRound;
function navigateFromHash(){
 const hash=decodeURIComponent(location.hash.slice(1));
 if(hash==='fabrics'||hash==='materials'){marketCategory='Fabrics';nav('marketplace');}
 else if(hash.startsWith('marketplace/')){marketCategory=CATEGORY_NAMES.find(x=>x.toLowerCase()===hash.slice(12))||'All';nav('marketplace');}
 else if(hash==='marketplace'){marketCategory='All';nav('marketplace');}
 else if(hash==='explore'||hash==='forum')nav(hash);
 else if(hash.startsWith('profile/'))nav('profile',hash.slice(8));
 else if(hash==='profile')nav('profile');
 else if(hash.startsWith('project-')){
  const priorHistory=historyNavigation;historyNavigation=true;
  try{nav('explore');}finally{historyNavigation=priorHistory;}
  const item=PROJECTS.find(p=>p.id===hash.slice(8));if(item)openPhotoProject(item);
 }
 else nav('discover');
}
navigateFromHash();
initializingNavigation=false;
lastObservedHash=location.hash;
function onNavigationHistory(){
 if(location.hash===lastObservedHash)return;
 lastObservedHash=location.hash;historyNavigation=true;
 closePhotoProject();
 try{navigateFromHash();}finally{historyNavigation=false;}
}
window.addEventListener('popstate',onNavigationHistory);
window.addEventListener('hashchange',onNavigationHistory);
