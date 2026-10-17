// EXO Community designer portfolio concept. All social data is browser-local demo state.
const STORAGE = 'exo-community-designer-profiles-v1';
const SOCIAL_STORAGE = 'exo.community.social.v1';
const SAMPLE = [
  {id:'exo-studio',name:'EXO Studio',role:'Digital garment & design research',brand:'EXO · Studio work',location:'',bio:'Project studies in digital garments, textile surfaces, pattern drafting and architectural environments from the EXO archive.',tags:['Garments','Materials','Development'],color:'#c6c3b8'},
  {id:'mikristian-lab',name:'MIKRISTIAN LAB',handle:'mikristian',role:'Fashion & architectural studies',brand:'MIKRISTIAN · Design research',location:'',bio:'Garment and architectural concepts from the MIKRISTIAN project archive, exploring silhouette, construction and scale.',tags:['Garments','Architecture','Concepts'],color:'#858780'},
  {id:'xtended-studio',name:'XTENDED Studio',handle:'xtended',role:'Digital environments & spatial studies',brand:'XTENDED · Museum project',location:'',bio:'Lighting, studio and gallery environment renders from the XTENDED project archive.',tags:['Scenes','Environments','3D'],color:'#aaa9a4'}
];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const slug = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'designer';
const imageURL = value => {
  if (typeof value !== 'string' || !value.trim()) return '';
  const v = value.trim();
  if (/^(https?:\/\/|\.\.?\/|\/[^/]|[a-z0-9_-]+\/)/i.test(v) && !/[\u0000-\u001f"'<>]/.test(v)) return v;
  return '';
};
const load = () => {
  try { const v = JSON.parse(localStorage.getItem(STORAGE) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  catch { return {}; }
};
const persist = state => { try { localStorage.setItem(STORAGE,JSON.stringify(state)); } catch { /* Offline demo works in memory. */ } };
const socialSaves = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SOCIAL_STORAGE) || '{}')?.saves;
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch { return {}; }
};
const projectCreator = project => String(project?.creator || project?.designer || project?.author || 'EXO CREATOR').trim();
const displayPhoto = (project,klass='') => {
  const src = imageURL(project?.image);
  return src ? `<img class="${klass}" src="${esc(src)}" alt="${esc(project?.alt || project?.title || 'Portfolio work')}" loading="lazy">` : `<span class="dp-photo-placeholder ${klass}" aria-hidden="true"><span>EXO / ${esc(project?.category || 'STUDY')}</span><strong>${esc(project?.title || 'Untitled study')}</strong></span>`;
};
const initials = name => String(name || 'EX').split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase();

/**
 * Mount a self-contained demo designer portfolio into a container.
 * @param {HTMLElement} container
 * @param {{projects?:Array,creatorId?:string,handle?:string,onOpenProject?:(project)=>void,onNavigate?:(page)=>void}} options
 * @returns {()=>void} destroy function (also available as destroy.destroy()).
 */
export function mountDesignerProfiles(container,{projects=[],onOpenProject=()=>{},onNavigate=()=>{},creatorId,handle}={}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('Designer profile container must be an HTML element');
  const works = Array.isArray(projects) ? projects.filter(x => x && typeof x === 'object') : [];
  const known = [...SAMPLE];
  for (const project of works) {
    const name = projectCreator(project);
    if (!known.some(creator => creator.name.toLowerCase() === name.toLowerCase())) known.push({id:slug(name),name,role:'Independent creator',brand:'EXO Community portfolio',location:'',bio:'A collection of creative projects shared in the EXO concept community.',tags:[],color:'#aeb3a9'});
  }
  const lookup = name => known.find(c => c.id === slug(name) || c.handle === slug(name) || c.name.toLowerCase() === String(name).toLowerCase());
  let current = lookup(creatorId || handle) || (creatorId || handle ? known.find(c=>c.id === slug(creatorId || handle)) : null) || known[0];
  let tab = 'works';
  let db = load();
  let editing = false;
  let notice = '';
  const creatorWorks = creator => works.filter(p => slug(projectCreator(p)) === slug(creator.name));
  const getProfile = creator => db[creator.id] && typeof db[creator.id] === 'object' ? db[creator.id] : {};
  const change = (key,value) => { db[current.id] = {...getProfile(current),[key]:value}; persist(db); };
  const number = (n) => new Intl.NumberFormat('en-US').format(n);
  function projectCard(project,index) {
    return `<button type="button" class="dp-project" data-project="${index}" aria-label="View ${esc(project.title || 'untitled project')}"><span class="dp-project-image">${displayPhoto(project)}</span><span class="dp-project-bottom"><span><small>${esc(project.category || 'PROJECT')}</small><strong>${esc(project.title || 'Untitled project')}</strong></span><span class="dp-card-arrow" aria-hidden="true">↗</span></span></button>`;
  }
  function render() {
    const mine = creatorWorks(current);
    const info = getProfile(current);
    const followed = Boolean(info.following);
    // Explore owns its saves; read them on every render so route changes never show stale data.
    const exploreSaves = socialSaves();
    const legacySaves = Array.isArray(db._saved) ? db._saved : [];
    const saved = works.filter(project => Boolean(exploreSaves[String(project.id)]) || legacySaves.includes(String(project.id)));
    const featured = mine;
    const cover = featured[0];
    container.classList.add('dp-root');
    container.innerHTML = `<section class="dp-shell" aria-label="Designer portfolio concept">
      <div class="dp-topline"><span><i aria-hidden="true"></i> EXO / CREATIVE COMMUNITY <em>LOCAL CONCEPT</em></span><button type="button" data-nav="explore">← EXPLORE PROJECTS</button></div>
      <div class="dp-cover ${cover?'has-work':'is-unpublished'}" style="--dp-accent:${esc(current.color)}"><div class="dp-cover-photo">${cover?displayPhoto(cover):'<span class="dp-cover-empty" aria-hidden="true"><span>EXO / CREATOR DIRECTORY</span><strong>Work in progress.</strong><small>Portfolio images appear when this creator has archived projects.</small></span>'}</div><div class="dp-cover-shade"></div><span class="dp-cover-tag">CREATOR PORTFOLIO / ${esc(current.name)}</span><span class="dp-cover-index">${String(known.indexOf(current)+1).padStart(2,'0')} / ${String(known.length).padStart(2,'0')}</span></div>
      <header class="dp-identity"><div class="dp-avatar" style="--dp-accent:${esc(current.color)}">${cover && imageURL(cover.image) ? displayPhoto(cover) : `<span>${esc(initials(current.name))}</span>`}</div><div class="dp-person"><p class="dp-overline">DESIGNER PROFILE <span>· DEMO</span></p><h1>${esc(current.name)}</h1><p class="dp-role">${esc(current.role)} <span>· ${esc(current.brand)}</span></p>${current.location?`<p class="dp-location">⌖ ${esc(current.location)}</p>`:''}</div><div class="dp-actions"><button class="dp-follow ${followed?'is-following':''}" type="button" data-follow aria-pressed="${followed}">${followed?'✓ Following':'+ Follow'}</button><button class="dp-share" type="button" data-share>Share profile ↗</button></div></header>
      <div class="dp-info"><div class="dp-bio"><p>${esc(typeof info.bio==='string' ? info.bio : current.bio)}</p><div class="dp-tags">${current.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><button class="dp-text-link" type="button" data-edit>${editing?'Close bio editor':'Edit bio · local demo'}</button>${editing?`<form class="dp-bio-form" data-bio-form><label for="dp-bio-editor">PROFILE BIO</label><textarea id="dp-bio-editor" name="bio" maxlength="360" rows="4">${esc(typeof info.bio==='string' ? info.bio : current.bio)}</textarea><div class="dp-bio-form-actions"><button type="submit">Save bio</button><button type="button" data-cancel>Cancel</button><button type="button" data-reset-bio>Reset</button></div><small>Saved only in this browser. No public profile is updated.</small></form>`:''}</div><div class="dp-stat-list" aria-label="Local portfolio information"><div><strong>${number(mine.length)}</strong><span>PROJECTS</span></div><div><strong>${number(new Set(mine.map(p=>p.category||'Projects')).size)}</strong><span>CATEGORIES</span></div><div><strong>${number(saved.length)}</strong><span>YOUR SAVED WORKS</span></div></div></div>
      <div class="dp-creator-strip"><span>EXPLORE DESIGNERS</span><div>${known.slice(0,8).map(c=>`<button type="button" data-creator="${esc(c.id)}" aria-current="${c.id===current.id?'true':'false'}">${esc(c.name)}</button>`).join('')}</div></div>
      <nav class="dp-tabs" aria-label="Portfolio sections">${[['works','Portfolio'],['about','About'],['collections','Collections'],['saved','Saved works']].map(([id,label])=>`<button type="button" data-tab="${id}" aria-current="${tab===id?'page':'false'}">${label}${id==='works'?` <sup>${mine.length}</sup>`:''}</button>`).join('')}</nav>
      <div class="dp-tab-content" aria-live="polite">${tab==='works'?`<div class="dp-section-heading"><div><span>01 / SELECTED WORK</span><h2>Portfolio projects<span class="dp-period">.</span></h2></div><p>${mine.length} works in this EXO concept archive</p></div>${mine.length?`<div class="dp-project-grid">${mine.map(project=>projectCard(project,works.indexOf(project))).join('')}</div>`:`<div class="dp-empty"><strong>No portfolio projects yet</strong><p>This designer is part of the concept directory. Browse works from the community while their collection grows.</p><button type="button" data-nav="explore">Explore projects ↗</button></div>`}`:
      tab==='about'?`<div class="dp-about-grid"><div><span class="dp-eyebrow">02 / THE PRACTICE</span><h2>About the studio.</h2><p>${esc(typeof info.bio==='string'?info.bio:current.bio)}</p></div><aside><h3>Practice</h3><p>${esc(current.role)}</p><h3>Studio</h3><p>${esc(current.brand)}</p><h3>Location</h3><p>${esc(current.location || 'Location not listed')}</p><small>Sample profile information for demonstration.</small></aside></div>`:
      tab==='collections'?`<div class="dp-section-heading"><div><span>03 / CURATED INDEX</span><h2>Collections<span class="dp-period">.</span></h2></div></div>${mine.length?`<div class="dp-collection-grid">${[...new Set(mine.map(p=>p.category || 'Projects'))].map(category=>{const items=mine.filter(p=>(p.category||'Projects')===category);return `<div class="dp-collection"><div class="dp-collection-image">${displayPhoto(items[0])}</div><div><span>${String(items.length).padStart(2,'0')} WORKS</span><h3>${esc(category)}</h3></div></div>`}).join('')}</div>`:`<div class="dp-empty"><strong>Collections coming together</strong><p>New collections appear when the designer has projects in the archive.</p></div>`}`:
      `<div class="dp-section-heading"><div><span>04 / BROWSER LIBRARY</span><h2>Saved works<span class="dp-period">.</span></h2></div><p>Saved locally across this concept website</p></div>${saved.length?`<div class="dp-project-grid">${saved.map(p=>projectCard(p,works.indexOf(p))).join('')}</div>`:`<div class="dp-empty"><strong>Your collection starts here</strong><p>Projects you save in the community will appear here when they share this demo library.</p><button type="button" data-nav="explore">Discover works ↗</button></div>`}`}</div>
      <footer class="dp-footer"><span>EXO COMMUNITY / PORTFOLIO STUDIES</span><span>OFFLINE CONCEPT · SAMPLE CREATOR DATA</span></footer><div class="dp-notice" role="status" aria-live="polite">${esc(notice)}</div></section>`;
  }
  const onClick = async e => {
    const target=e.target.closest('button'); if(!target || !container.contains(target)) return;
    if (target.dataset.creator) { current=known.find(x=>x.id===target.dataset.creator)||current;tab='works';editing=false;notice='';window.history.replaceState(null,'','#profile/'+encodeURIComponent(current.id));render();return; }
    if (target.dataset.tab) {tab=target.dataset.tab;editing=false;notice='';render();return;}
    if (target.hasAttribute('data-follow')) {change('following',!Boolean(getProfile(current).following));notice=Boolean(getProfile(current).following)?'Following in this local demo.':'Unfollowed in this local demo.';render();return;}
    if (target.hasAttribute('data-edit')) {editing=!editing;render();if(editing)container.querySelector('#dp-bio-editor')?.focus();return;}
    if (target.hasAttribute('data-cancel')) {editing=false;render();return;}
    if (target.hasAttribute('data-reset-bio')) {change('bio',current.bio);editing=false;notice='Bio reset locally.';render();return;}
    if (target.hasAttribute('data-share')) {
      const share = new URL(window.location.href);share.hash=`profile/${encodeURIComponent(current.id)}`;
      notice=`Demo profile link: ${share.href}`;
      render();
      try {
        if (!navigator.clipboard?.writeText) return;
        const copied=await Promise.race([
          navigator.clipboard.writeText(share.href).then(()=>true).catch(()=>false),
          new Promise(resolve=>setTimeout(()=>resolve(false),900))
        ]);
        if(copied && container.isConnected){notice='Profile link copied · local demo.';render();}
      } catch { /* The visible link remains available to copy manually. */ }
      return;
    }
    if(target.dataset.project!==undefined){const p=works[Number(target.dataset.project)];if(p)onOpenProject(p);return;}
    if(target.dataset.nav)onNavigate(target.dataset.nav);
  };
  const onSubmit=e=>{if(!e.target.matches('[data-bio-form]'))return;e.preventDefault();change('bio',String(new FormData(e.target).get('bio')||'').slice(0,360));editing=false;notice='Bio saved in this browser.';render();};
  const onStorage = e => {
    if (e.key === SOCIAL_STORAGE || e.key === null) render();
    if (e.key === STORAGE || e.key === null) {db=load();render();}
  };
  const onPageShow = () => {db=load();render();};
  container.addEventListener('click',onClick);
  container.addEventListener('submit',onSubmit);
  window.addEventListener('storage',onStorage);
  window.addEventListener('pageshow',onPageShow);
  render();
  const destroy=()=>{container.removeEventListener('click',onClick);container.removeEventListener('submit',onSubmit);window.removeEventListener('storage',onStorage);window.removeEventListener('pageshow',onPageShow);container.replaceChildren();container.classList.remove('dp-root');};
  destroy.destroy=destroy;
  return destroy;
}
