const KEY = 'exo.community.social.v1';
const PROFILE_KEY = 'exo-community-designer-profiles-v1';
const creatorSlug = value => String(value||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function followedCreators(){try {const data=JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}');return new Set(Object.entries(data).filter(([,v])=>v && v.following).map(([key])=>key));}catch{return new Set();}}
const forumCategories = ['All', 'Garment construction', 'Fabrics', 'Pattern drafting', 'Production', '3D scenes', 'Avatar fit'];
const starterThreads = [
  {id:'s1',category:'Garment construction',title:'How are you building structure into cropped jackets?',body:'Sharing construction experiments: lightweight interfacing, shaped facings, and strategic seam placement. What has worked for your samples?',author:'EXO Studio',time:'Community prompt',votes:0,replies:[{id:'r1',author:'Pattern Lab',body:'Test the facing and hem balance on a half scale toile first.'}]},
  {id:'s2',category:'Fabrics',title:'Fabric library: what material tests matter most?',body:'Comparing stretch recovery, drape, weight, and surface texture when digitizing samples.',author:'Materials Lab',time:'Community prompt',votes:0,replies:[]},
  {id:'s3',category:'Pattern drafting',title:'Drafting articulated sleeves for a moto silhouette',body:'Where do you place the elbow shaping seam when you want volume without excess bulk?',author:'Pattern Lab',time:'Community prompt',votes:0,replies:[]},
  {id:'s4',category:'Production',title:'Preparing a useful sample review sheet',body:'Which measurements, photos and tolerances should accompany factory feedback?',author:'EXO Studio',time:'Community prompt',votes:0,replies:[]},
  {id:'s5',category:'3D scenes',title:'Lighting black technical fabrics in a studio scene',body:'Looking for references and approaches that preserve texture in dark garment renders.',author:'Scene Lab',time:'Community prompt',votes:0,replies:[]},
  {id:'s6',category:'Avatar fit',title:'Avatar fit checks across size ranges',body:'What are the most useful pressure, ease, and motion checks for early digital fittings?',author:'Fit Lab',time:'Community prompt',votes:0,replies:[]}
];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const initials = value => String(value || 'EXO').split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('');
const uid = () => 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY)||'{}');
    return {likes: data.likes && typeof data.likes==='object'?data.likes:{}, saves:data.saves&&typeof data.saves==='object'?data.saves:{}, comments:data.comments&&typeof data.comments==='object'?data.comments:{}, votes:data.votes&&typeof data.votes==='object'?data.votes:{}, threads:Array.isArray(data.threads)?data.threads:[], replies:data.replies&&typeof data.replies==='object'?data.replies:{}};
  } catch { return {likes:{},saves:{},comments:{},votes:{},threads:[],replies:{}}; }
}
function save(state) { try { localStorage.setItem(KEY,JSON.stringify(state)); } catch { /* private browsing: interactions still work in memory */ } }
const attr = value => escapeHTML(value);
const safeImage = url => {
  if (typeof url !== 'string') return '';
  const s=url.trim();
  return /^(?:https?:\/\/|\.{0,2}\/|[a-zA-Z0-9_-][^:]*\.(?:png|jpe?g|webp|avif|gif)(?:\?.*)?$)/i.test(s) && !/[\u0000-\u001f"'<>]/.test(s) ? s : '';
};
const icon = (name) => ({
 heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
 bookmark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>',
 comment:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.2 0-2.3-.2-3.3-.7L3 21l1.7-5.7A8.5 8.5 0 1 1 21 11.5Z"/></svg>',
 share:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5M5 14v6h14v-6"/></svg>',
 arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 14 0m-6-6 6 6-6 6"/></svg>'
}[name]||'');
const normalize = projects => (Array.isArray(projects)?projects:[]).filter(p=>p&&typeof p==='object').map((p,i)=>({...p,id:String(p.id ?? i),title:String(p.title||'Untitled study'),creator:String(p.creator||'EXO Creator'),description:String(p.description||''),category:String(p.category||'Project'),handle:String(p.handle||creatorSlug(p.creator||'EXO Creator')),image:safeImage(p.image),alt:String(p.alt||p.title||'Project image')}));
function avatar(name) {return '<span class="exo-social-avatar" aria-hidden="true">'+escapeHTML(initials(name))+'</span>';}
function emptyVisual(){return '<div class="exo-social-image-fallback"><span>EXO / COMMUNITY</span><strong>PROJECT STUDY</strong></div>';}
function img(project){return project.image?'<img src="'+attr(project.image)+'" alt="'+attr(project.alt)+'" loading="lazy" decoding="async">':emptyVisual();}
function commonHeader(kicker,title,description){return '<header class="exo-social-heading"><div><p class="exo-social-eyebrow">'+escapeHTML(kicker)+'</p><h1>'+escapeHTML(title)+'</h1><p>'+escapeHTML(description)+'</p></div><span class="exo-social-demo">LOCAL COMMUNITY CONCEPT <span aria-hidden="true">●</span> DEMO CONTENT</span></header>';}
function actionButton(action,id,kind,label,pressed) {return '<button type="button" class="exo-social-icon-button '+(pressed?'is-active':'')+'" data-action="'+action+'" data-id="'+attr(id)+'" aria-label="'+attr(label)+'" aria-pressed="'+(pressed?'true':'false')+'">'+icon(kind)+'</button>';}
function projectTile(p) {return '<button type="button" class="exo-social-mosaic-tile" data-action="open" data-id="'+attr(p.id)+'" aria-label="View '+attr(p.title)+'">'+img(p)+'<span class="exo-social-mosaic-shade"><span>'+escapeHTML(p.category)+'</span><strong>'+escapeHTML(p.title)+'</strong><small>by '+escapeHTML(p.creator)+'</small></span></button>';}
function post(p,state,expanded) {
 const comments=Array.isArray(state.comments[p.id])?state.comments[p.id]:[];
 const handle='@'+p.handle.replace(/^@/,'');
 return '<article class="exo-social-post" data-project-id="'+attr(p.id)+'"><div class="exo-social-post-header"><button type="button" class="exo-social-author" data-action="profile" data-id="'+attr(p.id)+'">'+avatar(p.creator)+'<span><strong>'+escapeHTML(handle)+'</strong><small>'+escapeHTML(p.creator)+' · '+escapeHTML(p.category)+'</small></span></button><button type="button" class="exo-social-view-profile" data-action="profile" data-id="'+attr(p.id)+'">View profile ↗</button></div><button type="button" class="exo-social-post-image" data-action="open" data-id="'+attr(p.id)+'" aria-label="Open '+attr(p.title)+'">'+img(p)+'</button><div class="exo-social-post-body"><div class="exo-social-actions"><div>'+actionButton('like',p.id,'heart','Like '+p.title,!!state.likes[p.id])+actionButton('comments',p.id,'comment','Toggle comments for '+p.title,expanded)+actionButton('share',p.id,'share','Share '+p.title,false)+'</div>'+actionButton('save',p.id,'bookmark','Save '+p.title,!!state.saves[p.id])+'</div><div class="exo-social-caption"><strong>'+escapeHTML(p.title)+'</strong><p><button type="button" class="exo-social-caption-author" data-action="profile" data-id="'+attr(p.id)+'">'+escapeHTML(handle)+'</button> '+escapeHTML(p.description||'An EXO community design study.')+'</p><button type="button" class="exo-social-tag" data-filter="'+attr(p.category)+'">#'+escapeHTML(p.category.toLowerCase().replace(/\s+/g,''))+'</button></div><button type="button" class="exo-social-comment-count" data-action="comments" data-id="'+attr(p.id)+'">'+(comments.length?'View '+comments.length+' local comment'+(comments.length===1?'':'s'):'Add a comment')+'</button>'+(expanded?'<section class="exo-social-comments" aria-label="Comments for '+attr(p.title)+'"><p class="exo-social-local-note">Comments stay in this browser (demo).</p>'+comments.map(c=>'<p class="exo-social-comment"><strong>'+escapeHTML(c.author||'You')+'</strong> '+escapeHTML(c.body)+'</p>').join('')+'<form class="exo-social-comment-form" data-id="'+attr(p.id)+'"><label class="exo-social-sr" for="exo-comment-'+attr(p.id)+'">Write a comment</label><input id="exo-comment-'+attr(p.id)+'" name="comment" maxlength="450" placeholder="Add a comment…" required><button type="submit">Post</button></form></section>':'')+'</div></article>';
}
export function mountExplorePage(container,{projects=[],onOpenProject=()=>{},onProfile=()=>{}}={}) {
 if (!container) return ()=>{};
 const items=normalize(projects);
 const state=load();
 let filter='All',view='for-you',expanded='',notice='';
 const categories=['All',...new Set(items.map(p=>p.category))];
 function filtered(){
   const category=filter==='All'?items:items.filter(p=>p.category===filter);
   if(view!=='following')return category;
   const followed=followedCreators();
   return category.filter(p=>followed.has(creatorSlug(p.creator)) || followed.has(creatorSlug(p.handle)));
 }
 function render(){
   const selected=filtered();
   const tabs=[['for-you','For You'],['following','Following'],['grid','Explore grid']];
   container.innerHTML='<section class="exo-social-root exo-explore">'+commonHeader('EXO / COMMUNITY','For You','A visual journal of work from the creative community.')+
   '<div class="exo-social-explore-toolbar"><nav class="exo-social-tabs" aria-label="Explore view">'+tabs.map(([key,label])=>'<button type="button" data-view="'+key+'" class="'+(view===key?'is-selected':'')+'" aria-pressed="'+(view===key)+'">'+label+'</button>').join('')+'</nav><span>'+selected.length+' PROJECT'+(selected.length===1?'':'S')+'</span></div>'+
   '<div class="exo-social-filters" role="group" aria-label="Filter project category">'+categories.map(c=>'<button type="button" data-filter="'+attr(c)+'" class="'+(c===filter?'is-selected':'')+'" aria-pressed="'+(c===filter)+'">'+escapeHTML(c)+'</button>').join('')+'</div>'+
   (selected.length?(view==='grid'?'<div class="exo-social-mosaic">'+selected.map(projectTile).join('')+'</div>':'<div class="exo-social-feed-layout"><div class="exo-social-feed">'+selected.map(p=>post(p,state,expanded===p.id)).join('')+'</div><aside class="exo-social-feed-aside" aria-label="Community journal"><div class="exo-social-aside-heading"><span>EXO / JOURNAL</span><span>01 — '+String(selected.length).padStart(2,'0')+'</span></div><h2>Ideas in progress.</h2><p>Explore the processes, materials and details shaping each study.</p><div class="exo-social-aside-rule"></div><span class="exo-social-aside-label">FEATURED MAKERS · DEMO</span>'+[...new Map(selected.map(p=>[creatorSlug(p.creator),p])).values()].slice(0,4).map(p=>'<button type="button" class="exo-social-aside-maker" data-action="profile" data-id="'+attr(p.id)+'">'+avatar(p.creator)+'<span><strong>'+escapeHTML(p.creator)+'</strong><small>'+escapeHTML(p.category)+'</small></span>'+icon('arrow')+'</button>').join('')+'<div class="exo-social-aside-rule"></div><p class="exo-social-aside-foot">Every interaction is saved in this browser. This is an EXO concept community, not a live social network.</p></aside></div>'):
   '<div class="exo-social-empty">'+(view==='following'?'No followed creator projects yet. Open a creator profile and select Follow to build your feed.':'No projects in this category yet. Try another filter.')+'</div>')+
   '<p class="exo-social-status" role="status" aria-live="polite">'+escapeHTML(notice)+'</p><p class="exo-social-feed-disclaimer">Prototype feed · likes, saves, follows and comments are stored only in this browser.</p></section>';
 }
 function click(e){
   const button=e.target.closest('button');
   if(!button||!container.contains(button))return;
   if(button.dataset.view){view=button.dataset.view;expanded='';notice='';render();return;}
   if(button.hasAttribute('data-filter')){filter=button.dataset.filter;expanded='';render();return;}
   const action=button.dataset.action,id=button.dataset.id;
   if(!action)return;
   const p=items.find(item=>item.id===id);
   if(action==='open'&&p){onOpenProject(p);return;}
   if(action==='profile'&&p){onProfile(p.creator,p);return;}
   if(action==='like'||action==='save'){const key=action==='like'?'likes':'saves';state[key][id]=!state[key][id];save(state);notice=action==='save'?(state.saves[id]?'Saved to this browser.':'Removed from saved projects.') : '';render();return;}
   if(action==='comments'){expanded=expanded===id?'':id;notice='';render();if(expanded)container.querySelector('.exo-social-comment-form[data-id="'+CSS.escape(id)+'"] input')?.focus();return;}
   if(action==='share'&&p){
     const shareUrl=typeof location!=='undefined'?location.href.split('#')[0]+'#project-'+encodeURIComponent(id):'EXO '+p.title;
     const shareText=p.title+' — '+shareUrl;
     const success=()=>{notice='Project link copied to clipboard.';render();};
     const fallback=()=>{notice='Copy this project link: '+shareUrl;render();};
     if(typeof navigator!=='undefined'&&navigator.share){navigator.share({title:p.title,url:shareUrl}).then(()=>{notice='Project shared.';render();}).catch(error=>{if(error?.name!=='AbortError')fallback();});}
     else if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText){navigator.clipboard.writeText(shareText).then(success).catch(fallback);}
     else fallback();
   }
 }
 function submit(e){const form=e.target.closest('.exo-social-comment-form');if(!form)return;e.preventDefault();const id=form.dataset.id,body=(new FormData(form).get('comment')||'').toString().trim().slice(0,450);if(!body)return;(state.comments[id]??=[]).push({id:uid(),author:'You',body});save(state);expanded=id;render();}
 function syncFollow(){if(view==='following')render();}
 container.addEventListener('click',click);container.addEventListener('submit',submit);window.addEventListener('storage',syncFollow);render();
 return ()=>{container.removeEventListener('click',click);container.removeEventListener('submit',submit);window.removeEventListener('storage',syncFollow);};
}

function threadCard(t,state,open) {
 const replies=[...(Array.isArray(t.replies)?t.replies:[]),...(Array.isArray(state.replies[t.id])?state.replies[t.id]:[])];
 const score=Number(t.votes||0)+(state.votes[t.id]?1:0);
 return '<article class="exo-social-thread"><div class="exo-social-thread-main"><button class="exo-social-vote '+(state.votes[t.id]?'is-active':'')+'" aria-label="Mark thread helpful" aria-pressed="'+!!state.votes[t.id]+'" data-action="vote" data-id="'+attr(t.id)+'"><span>↑</span><strong>'+score+'</strong><small>HELPFUL</small></button><div><div class="exo-social-thread-meta"><span>'+escapeHTML(t.category)+'</span><span>'+escapeHTML(t.time||'Local demo')+'</span></div><button class="exo-social-thread-title" data-action="thread" data-id="'+attr(t.id)+'" aria-expanded="'+open+'">'+escapeHTML(t.title)+'</button><p>'+escapeHTML(t.body)+'</p><div class="exo-social-thread-footer"><button data-action="profile" data-author="'+attr(t.author)+'" class="exo-social-thread-author">'+avatar(t.author)+'<span>'+escapeHTML(t.author)+'</span></button><button data-action="thread" data-id="'+attr(t.id)+'" aria-expanded="'+open+'">'+icon('comment')+' '+replies.length+' replies · '+(open?'Hide':'Discuss')+'</button></div></div></div>'+(open?'<section class="exo-social-thread-replies" aria-label="Replies"><div class="exo-social-replies-label">DISCUSSION · '+replies.length+' REPLIES</div>'+replies.map(r=>'<div class="exo-social-reply">'+avatar(r.author)+'<p><strong>'+escapeHTML(r.author)+'</strong><span>'+escapeHTML(r.body)+'</span></p></div>').join('')+'<form class="exo-social-reply-form" data-id="'+attr(t.id)+'"><label for="exo-reply-'+attr(t.id)+'">Add your perspective</label><textarea id="exo-reply-'+attr(t.id)+'" name="reply" rows="2" maxlength="1000" required placeholder="Share a technique, reference, or question…"></textarea><button type="submit">Reply locally '+icon('arrow')+'</button></form></section>':'')+'</article>';
}
export function mountForumPage(container,{projects=[],onProfile=()=>{}}={}) {
 if(!container)return ()=>{};
 const state=load();
 let filter='All',query='',expanded='',compose=false,notice='';
 const threads=()=>[...state.threads,...starterThreads];
 function visible(){return threads().filter(t=>(filter==='All'||t.category===filter)&&(!query||[t.title,t.body,t.author,t.category].join(' ').toLowerCase().includes(query.toLowerCase())));}
 function render(){
 const list=visible();
 container.innerHTML='<section class="exo-social-root exo-forum">'+commonHeader('OPEN EXCHANGE','Community Forum','Discuss the craft behind the work. Share methods, ask questions, and connect with makers.')+
 '<div class="exo-social-forum-summary"><div><span>DISCUSSION SPACE</span><strong>Ideas become methods here.</strong><p>Garment construction, pattern engineering, material research, digital scenes and the details between.</p></div><button type="button" data-action="compose">+ Start a discussion</button></div>'+
 '<div class="exo-social-forum-tools"><label class="exo-social-search"><span class="exo-social-sr">Search discussions</span><input type="search" name="forum-search" placeholder="Search discussions, techniques, materials…" value="'+attr(query)+'"></label><span>'+list.length+' DISCUSSIONS</span></div>'+
 '<div class="exo-social-forum-layout"><aside class="exo-social-forum-categories"><p>TOPICS</p>'+forumCategories.map(c=>'<button data-category="'+attr(c)+'" aria-pressed="'+(c===filter)+'" class="'+(c===filter?'is-selected':'')+'">'+escapeHTML(c)+'</button>').join('')+'</aside><div class="exo-social-forum-content">'+(compose?'<form class="exo-social-new-thread"><div class="exo-social-form-title"><strong>Start a discussion</strong><button type="button" data-action="compose" aria-label="Close new discussion">×</button></div><label>Category<select name="category">'+forumCategories.slice(1).map(c=>'<option>'+escapeHTML(c)+'</option>').join('')+'</select></label><label>Title<input name="title" maxlength="110" minlength="5" placeholder="What are you working through?" required></label><label>Details<textarea name="body" maxlength="2400" minlength="10" rows="4" placeholder="Describe the problem, process or technique…" required></textarea></label><button type="submit">Publish to local demo '+icon('arrow')+'</button></form>':'')+
 (list.length?list.map(t=>threadCard(t,state,expanded===t.id)).join(''):'<div class="exo-social-empty">No discussions match. Try a different topic or search.</div>')+'</div></div><p class="exo-social-status" role="status" aria-live="polite">'+escapeHTML(notice)+'</p></section>';
 }
 function click(e){
 const button=e.target.closest('button');if(!button||!container.contains(button))return;
 if(button.hasAttribute('data-category')){filter=button.dataset.category;expanded='';render();return;}
 const action=button.dataset.action,id=button.dataset.id;
 if(action==='compose'){compose=!compose;render();if(compose)container.querySelector('.exo-social-new-thread input[name=title]')?.focus();}
 if(action==='thread'){expanded=expanded===id?'':id;render();}
 if(action==='vote'){state.votes[id]=!state.votes[id];save(state);render();}
 if(action==='profile'){const author=button.dataset.author;onProfile(author,{creator:author});}
 }
 function input(e){if(e.target.matches('input[name=forum-search]')){const pos=e.target.selectionStart;query=e.target.value;render();const inp=container.querySelector('input[name=forum-search]');inp?.focus();try{inp?.setSelectionRange(pos,pos);}catch{}}}
 function submit(e){
 const form=e.target;
 if(form.matches('.exo-social-new-thread')){e.preventDefault();const data=new FormData(form);const title=String(data.get('title')||'').trim().slice(0,110),body=String(data.get('body')||'').trim().slice(0,2400),category=String(data.get('category')||'');if(title.length<5||body.length<10||!forumCategories.includes(category)||category==='All')return;const thread={id:uid(),title,body,category,author:'You',time:'Local demo · just now',votes:0,replies:[]};state.threads.unshift(thread);save(state);filter='All';query='';expanded=thread.id;compose=false;notice='Discussion saved locally in this browser.';render();}
 if(form.matches('.exo-social-reply-form')){e.preventDefault();const id=form.dataset.id,body=String(new FormData(form).get('reply')||'').trim().slice(0,1000);if(!body)return;(state.replies[id]??=[]).push({id:uid(),body,author:'You'});save(state);expanded=id;notice='Reply saved locally in this browser.';render();}
 }
 container.addEventListener('click',click);container.addEventListener('input',input);container.addEventListener('submit',submit);render();
 return ()=>{container.removeEventListener('click',click);container.removeEventListener('input',input);container.removeEventListener('submit',submit);};
}
