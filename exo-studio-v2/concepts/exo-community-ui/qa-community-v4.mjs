// EXO Community v4 integration smoke / visual regression baseline. Isolated read-only browser run.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const dir=resolve(fileURLToPath(new URL('.',import.meta.url)));
const out=join(dir,'previews');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.avif':'image/avif','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try {const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(dir,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(dir+sep))throw Error('Invalid path');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);} catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const baseURL='http://127.0.0.1:'+server.address().port+'/';
let browser;
const results=[], errors=[],screens=[],visualWarnings=[];
const pass=(name,details={})=>{results.push({name,status:'PASS',...details});console.log('PASS '+name);};
const fail=(name,e)=>{const error=String(e?.message||e).split('\n')[0];results.push({name,status:'FAIL',error});console.error('FAIL '+name+': '+error);};
async function check(name,fn){try{await fn();pass(name);}catch(e){fail(name,e);}}
// Browser captures are supplemental QA artifacts. Headless Chrome can time out
// on extremely tall pages with an active composited 3D carousel; a flaky image
// capture must not masquerade as a failed feature assertion. Record honestly.
const shot=async(page,name)=>{
 if(process.env.EXO_QA_SKIP_VISUAL==='1')return;
 try{
  await page.screenshot({path:join(out,'v4-'+name+'.png'),fullPage:false,timeout:13000,animations:'disabled'});
  screens.push('v4-'+name+'.png');
 }catch(e){visualWarnings.push(name+': '+String(e.message).split('\n')[0]);console.warn('VISUAL CAPTURE WARNING: '+name);}
};
const noOverflow=async(page,label)=>{const dimensions=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(dimensions.scroll<=dimensions.viewport+3, label+' overflow '+JSON.stringify(dimensions));};
const go=async(page,name)=>{await page.locator('.main-links [data-nav="'+name+'"]').first().click();await page.waitForTimeout(160);};
const firstVisible=page=>page.locator('#alt-view').isVisible();
try{
 await mkdir(out,{recursive:true});
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,permissions:['clipboard-read','clipboard-write'],reducedMotion:'no-preference'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push('page: '+e.message));
 page.on('response',r=>{if(r.status()>=400&&!r.url().includes('favicon'))errors.push('HTTP '+r.status()+' '+r.url());});
 await page.goto(baseURL,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1100);
 await check('Sixth-edition pure-black design tokens and readable navigation',async()=>{
   const styles=await page.evaluate(()=>{
     const header=document.querySelector('.topbar'),hero=document.querySelector('.exh-infinite-landing'),name=document.querySelector('.brand');
     return {body:getComputedStyle(document.body).backgroundColor,
       hero:getComputedStyle(hero).backgroundColor,heroImage:getComputedStyle(hero).backgroundImage,
       navigation:header.getBoundingClientRect().height,brand:name.textContent.trim()};
   });
   assert.equal(styles.body,'rgb(5, 5, 5)');
   assert.equal(styles.hero,'rgb(5, 5, 5)');
   assert.equal(styles.heroImage,'none','The hero must not use a decorative gradient background');
   assert.ok(styles.navigation>=70);
   assert.ok(styles.brand.startsWith('EXO'));
 });
 await check('Small-screen nav stays usable at 320px without document overflow',async()=>{
   const narrow=await browser.newPage({viewport:{width:320,height:720}});
   try{await narrow.goto(baseURL,{waitUntil:'domcontentloaded'});await noOverflow(narrow,'320px');assert.equal(await narrow.locator('.main-links [data-nav]').count(),6);assert.ok(await narrow.locator('.main-links').evaluate(el=>el.scrollWidth>=el.clientWidth));}
   finally{await narrow.close();}
 });
 await check('Home layout and no desktop overflow',async()=>{assert.ok(await page.locator('#project-home .exh-hero-visual').count());await noOverflow(page,'Home desktop');});
 await check('Homepage carousel photo is loaded',async()=>{await page.locator('#exh-active-photo').evaluate(img=>img.decode());assert.ok(await page.locator('#exh-active-photo').evaluate(img=>img.naturalWidth>0));});
 await check('Hero is made of many large square photos, not a backdrop with thumbnails',async()=>{
   const cards=page.locator('.exh-carousel-card');
   assert.equal(await cards.count(),12,'All twelve real projects must be present on the looping wheel');
   const sizes=await cards.evaluateAll(nodes=>nodes.filter(el=>Number(getComputedStyle(el).opacity)>.65).map(el=>({width:el.offsetWidth,height:el.offsetHeight})));
   assert.ok(sizes.length>=3,'Three or more large, visible photographic cards needed');
   assert.ok(sizes.every(box=>box.width>280&&Math.abs(box.width-box.height)<3),'Project cards should be genuinely large squares');
 });
 await check('Exhibition X hero uses larger square images on a black canvas',async()=>{
   const geometry=await page.locator('.exh-carousel-card').first().evaluate(el=>{
     // The carousel deliberately applies perspective and rotateY on individual
     // squares; the projected screen rectangle is NOT a test of aspect ratio.
     const stage=document.querySelector('.exh-infinite-visual');
     return {width:el.offsetWidth,height:el.offsetHeight,stageHeight:stage.getBoundingClientRect().height,background:getComputedStyle(stage).backgroundColor};
   });
   assert.ok(geometry.width>=620,'Main imagery must be genuinely large: '+JSON.stringify(geometry));
   assert.ok(Math.abs(geometry.width-geometry.height)<3,'Gallery image should remain square');
   assert.equal(geometry.background,'rgb(5, 5, 5)');
 });
 await check('Editorial full archive opens twelve attributed project photographs',async()=>{
   await page.locator('#exh-view-archive').click();
   const dialog=page.locator('#exh-archive-view');
   assert.ok(await dialog.isVisible());
   assert.equal(await dialog.locator('[role="dialog"][aria-modal="true"]').count(),1);
   assert.equal(await dialog.locator('.exh-archive-work').count(),12);
   assert.ok(await page.evaluate(()=>document.body.classList.contains('exh-archive-open')));
   await page.keyboard.press('Escape');
   assert.ok(await dialog.isHidden());
   assert.equal(await page.evaluate(()=>document.body.classList.contains('exh-archive-open')),false);
   assert.equal(await page.locator('#exh-view-archive').evaluate(el=>el===document.activeElement),true,'Focus returns to gallery archive trigger');
 });
 await check('Archive project cards open corresponding source-attributed detail',async()=>{
   await page.locator('#exh-view-archive').click();
   await page.locator('[data-archive-index="2"]').click();
   assert.equal(await page.locator('#exo-project-detail [role="dialog"]').count(),1);
   assert.match(await page.locator('.exo-project-description h2').innerText(),/501 \/ Digital Denim Study/);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#exo-project-detail').count(),0);
 });
 await check('Carousel next, previous and orbit controls',async()=>{
   const initial=await page.locator('#exh-active-title').innerText();
   await page.locator('#exh-next').click();
   assert.notEqual(await page.locator('#exh-active-title').innerText(),initial,'Next arrow should immediately select the next large photo');
   await page.locator('#exh-prev').click();
   assert.equal(await page.locator('#exh-active-title').innerText(),initial,'Previous arrow should go back to the first large photo');
   await page.locator('[data-orbit]').first().click();
   assert.notEqual(await page.locator('#exh-active-title').innerText(),initial,'Clicking an outer large square should select that photo');
 });
 await check('Circular photo sequence wraps seamlessly across the archive boundary',async()=>{
   await page.locator('[data-slide="11"]').click();
   assert.match(await page.locator('#exh-counter').innerText(),/^12\s*\/\s*12$/);
   await page.locator('#exh-next').click();
   assert.match(await page.locator('#exh-counter').innerText(),/^01\s*\/\s*12$/);
   await page.locator('#exh-prev').click();
   assert.match(await page.locator('#exh-counter').innerText(),/^12\s*\/\s*12$/);
   await page.locator('[data-slide="0"]').click();
 });
 await check('Carousel pointer swipe',async()=>{
  const visual=page.locator('.exh-hero-visual');
  await visual.scrollIntoViewIfNeeded();
  const bbox=await visual.boundingBox();assert.ok(bbox);
  // After clicking the navigation controls the page may have scrolled. Gesture
  // coordinates must be inside the actual visible stage, not above the viewport.
  const y=Math.min(850,Math.max(85,bbox.y+bbox.height*.55));
  const before=await page.locator('#exh-counter').innerText();
  await page.mouse.move(bbox.x+bbox.width*.8,y);
  await page.mouse.down();
  await page.mouse.move(bbox.x+bbox.width*.15,y,{steps:6});
  await page.mouse.up();
  assert.notEqual(await page.locator('#exh-counter').innerText(),before);
 });
 await check('Carousel continuously rotates automatically after idle',async()=>{
   await page.mouse.move(0,0);
   await page.evaluate(()=>document.activeElement?.blur());
   const before=await page.locator('.exh-carousel-card').first().evaluate(el=>el.style.transform);
   await page.waitForTimeout(6100);
   const after=await page.locator('.exh-carousel-card').first().evaluate(el=>el.style.transform);
   assert.notEqual(after,before,'A continuous infinite wheel must visibly move through its large square photos, not only change text');
 });
 await check('Six strong curator images load',async()=>{assert.equal(await page.locator('.exh-curator-tile').count(),6);const photos=page.locator('.exh-curator-tile img');assert.equal(await photos.count(),6);for(const img of await photos.all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());assert.ok(await img.evaluate(el=>el.naturalWidth>0));}});
 await check('Denim editorial case study has five working photo angles and a functional detail link',async()=>{
   assert.ok(await page.locator('#exh-editorial-story').isVisible());
   assert.equal(await page.locator('[data-story-angle]').count(),5);
   const before=await page.locator('#exh-story-image').getAttribute('src');
   await page.locator('[data-story-angle="2"]').click();
   assert.notEqual(await page.locator('#exh-story-image').getAttribute('src'),before);
   assert.equal(await page.locator('[data-story-angle="2"]').getAttribute('aria-pressed'),'true');
   await page.locator('#exh-story-image').evaluate(el=>el.decode());
   assert.ok(await page.locator('#exh-story-image').evaluate(el=>el.naturalWidth>0));
   await page.locator('#exh-editorial-story').scrollIntoViewIfNeeded();
   await page.locator('#exh-editorial-story').screenshot({path:join(out,'v10-editorial-denim-story-desktop.png'),timeout:12000,animations:'disabled'});
   await page.locator('[data-story-open]').click();
   assert.equal(await page.locator('#exo-project-detail [role="dialog"]').count(),1);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#exo-project-detail').count(),0);
 });
 await check('Photo carousel pause and resume provide explicit motion controls',async()=>{
   const control=page.locator('#exh-motion-control');
   await control.click();assert.equal(await control.getAttribute('aria-pressed'),'true');
   assert.match(await control.getAttribute('aria-label'),/Resume/);
   const staticBefore=await page.locator('.exh-carousel-card').first().evaluate(el=>el.style.transform);
   await page.waitForTimeout(220);
   const staticAfter=await page.locator('.exh-carousel-card').first().evaluate(el=>el.style.transform);
   assert.equal(staticAfter,staticBefore,'Pause should actually stop the photo-wheel animation, not just change the label');
   await control.click();assert.equal(await control.getAttribute('aria-pressed'),'false');
 });
 await check('Project detail focus and Escape dismissal',async()=>{
   await page.locator('#exh-open-project').click();
   assert.equal(await page.locator('#exo-project-detail [role="dialog"]').count(),1);
   const controls=page.locator('#exo-project-detail button');
   await controls.last().focus();
   await page.keyboard.press('Tab');
   assert.ok(await page.locator('#exo-project-detail').evaluate(el=>el.contains(document.activeElement)),'Focus must stay within project dialog');
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#exo-project-detail').count(),0);
   assert.equal(await page.evaluate(()=>document.body.classList.contains('exo-project-open')),false,'Project dialog scroll state must reset');
 });
 await check('Project backdrop closes the dialog',async()=>{
   await page.locator('#exh-open-project').click();
   assert.equal(await page.locator('#exo-project-detail [role="dialog"]').count(),1);
   await page.locator('.exo-project-shade').click({position:{x:8,y:8}});
   assert.equal(await page.locator('#exo-project-detail').count(),0);
 });
 await check('Curator photo wall and marketplace visibly painted',async()=>{for(const selector of ['.exh-curators','#catalog-section']){const el=page.locator(selector);await el.scrollIntoViewIfNeeded();await page.waitForTimeout(700);assert.ok(await el.isVisible(),selector+' hidden');const styles=await el.evaluate(node=>({opacity:getComputedStyle(node).opacity,visibility:getComputedStyle(node).visibility,height:node.getBoundingClientRect().height}));assert.ok(Number(styles.opacity)>.9&&styles.visibility==='visible'&&styles.height>90,selector+' blank: '+JSON.stringify(styles));}await shot(page,'curators-marketplace-intro-desktop');});
 await check('Homepage uses an edited marketplace preview and compact social/AR invitations',async()=>{
   assert.equal(await page.locator('#asset-grid .asset-card').count(),9);
   assert.ok(await page.locator('#home-market-cta').isVisible());
   assert.ok(await page.locator('#garment-exhibition').isHidden());
   assert.ok(await page.locator('#ar-studio').isHidden());
   assert.ok(await page.locator('#home-action-reel').isVisible());
   await page.locator('#home-market-cta [data-nav="marketplace"]').click();
   assert.equal(new URL(page.url()).hash,'#marketplace');
   assert.ok(await page.locator('#asset-grid .asset-card').count()>=17);
   await go(page,'discover');
 });
 await shot(page,'home-desktop');
 await page.locator('.exh-infinite-landing').screenshot({path:join(out,'v4-hero-square-gallery-desktop.png')});
 await go(page,'marketplace');
 await check('Marketplace seven tabs and source-derived fabric entries',async()=>{assert.equal(await page.locator('[data-market-category]').count(),7);assert.ok(await page.locator('.asset-card').count()>=17);await noOverflow(page,'Marketplace desktop');});
 await check('Garment atelier showcases real research views and original concept CGI',async()=>{
   const section=page.locator('#garment-exhibition');
   assert.ok(await section.isVisible());
   assert.equal(await section.locator('.exge-work').count(),2);
   const images=section.locator('.exge-work .exge-photo img');
   for(const img of await images.all()){await img.evaluate(el=>el.decode());assert.ok(await img.evaluate(el=>el.naturalWidth>0));}
   await section.locator('[data-exge-open="1"]').click();
   assert.ok(await section.locator('.exge-modal').isVisible());
   assert.equal(await section.locator('[data-exge-view]').count(),6);
   assert.match(await section.locator('.exge-explanation').innerText(),/not photographs/i);
   const src=await section.locator('.exge-main-image').getAttribute('src');
   await page.keyboard.press('ArrowRight');
   assert.notEqual(await section.locator('.exge-main-image').getAttribute('src'),src);
   await page.keyboard.press('Escape');
   assert.ok(await section.locator('.exge-modal').isHidden());
   assert.equal(await section.locator('[data-exge-open="1"]').evaluate(el=>el===document.activeElement),true);
 });
 await check('Garment case studies follow marketplace category filters',async()=>{
   await page.locator('[data-market-category="Fabrics"]').click();
   assert.equal(await page.locator('#garment-exhibition').isHidden(),true);
   await page.locator('[data-market-category="Garments"]').click();
   assert.equal(await page.locator('#garment-exhibition').isVisible(),true);
   await page.locator('[data-market-category="All"]').click();
 });
 await check('All marketplace contains searchable source-derived fabrics and working pagination',async()=>{
   await page.waitForFunction(()=>document.querySelector('#result-count')?.textContent?.includes('417'),null,{timeout:12000});
   assert.ok(await page.locator('.market-fabric-photo').count()>0,'Actual EXO fabric records must appear alongside garments in All');
   const count=await page.locator('.asset-card').count();
   await page.locator('#catalog-load-more').click();
   assert.ok((await page.locator('.asset-card').count())>count,'Load more exposes the next fabric entries');
   await page.locator('#catalog-search').fill('Heavy French Terry');
   assert.ok(await page.locator('[data-open="fabric:fleece"]').count()>0,'Search across all asset types must find EXO fabric presets');
   await page.locator('[data-open="fabric:fleece"]').first().click();
   await page.locator('.exfs-detail').waitFor({timeout:6000});
   assert.ok((await page.locator('.exfs-detail').innerText()).includes('French Terry'),'Fabric card should open its own record, not a generic placeholder');
   await page.locator('.exfs-detail-header [data-close]').click();
   await page.locator('[data-market-category="All"]').click();
   await page.locator('#catalog-search').fill('');
 });
 await check('Marketplace categories support browser Back and Forward',async()=>{
   await page.locator('[data-market-category="Garments"]').click();
   assert.equal(new URL(page.url()).hash,'#marketplace/garments');
   await page.goBack({waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('[data-market-category="All"]').getAttribute('aria-pressed'),'true');
   assert.ok(await page.locator('.asset-card').count()>=17);
   await page.goForward({waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('[data-market-category="Garments"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-market-category="All"]').click();
 });
 await shot(page,'marketplace-desktop');
 await check('Marketplace category filters and photograph assets',async()=>{
   for(const name of ['Garments','Fabrics','Trims','Avatars','Scenes','Patterns']){
     await page.locator('[data-market-category="'+name+'"]').click();
     assert.equal(await page.locator('[data-market-category="'+name+'"]').getAttribute('aria-pressed'),'true',name+' selected category');
     if(name==='Fabrics')assert.ok(await page.locator('.exfs-card').count()>0,'Fabric browser mounted');
     else assert.ok(await page.locator('.asset-card').count()>=1,name+' has visible resources');
   }
   await page.locator('[data-market-category="All"]').click();
   const images=page.locator('#asset-grid .asset-photograph img');
   assert.ok(await images.count()>=7);
   for(const img of await images.all()){await img.evaluate(el=>el.decode());assert.ok(await img.evaluate(el=>el.naturalWidth>0),'Marketplace project photo must load');}
 });
 await check('Home clears marketplace category state',async()=>{
   await page.locator('[data-market-category="Fabrics"]').click();
   await go(page,'discover');
   assert.equal(await page.locator('[data-market-category="All"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#fabric-store').isHidden(),true);
   assert.equal(await page.locator('.asset-card').count(),9);
   await go(page,'marketplace');
 });
 await check('Fabrics 400-record inventory',async()=>{await page.locator('[data-market-category="Fabrics"]').click();await page.waitForFunction(()=>document.querySelector('#exfs-total')?.textContent?.trim()==='400',{timeout:12000});assert.match(await page.locator('#exfs-count').innerText(),/400 of 400/);assert.ok(await page.locator('.exfs-card').count()>=1);await noOverflow(page,'Fabrics desktop');});
 await check('Fabric category counts are computed from the actual 400 records',async()=>{
  assert.equal((await page.locator('[data-category-count="All"]').innerText()).trim(),'400');
  const counts=await page.locator('[data-category-count]').allInnerTexts();
  assert.ok(counts.slice(1).some(x=>Number(x)>0),'Category tabs must not incorrectly display zero for every group');
 });
 await shot(page,'fabrics-desktop');
 await go(page,'explore');
 await check('Explore mosaic/feed and project images',async()=>{assert.ok(await firstVisible(page));assert.ok(await page.locator('.exo-social-tabs [data-view="for-you"]').count()===1);assert.ok(await page.locator('.exo-social-tabs [data-view="grid"]').count()===1);assert.ok(await page.locator('.exo-social-post').count()>=5);const img=page.locator('.exo-social-post img').first();await img.evaluate(el=>el.decode());assert.ok(await img.evaluate(el=>el.naturalWidth>0));await noOverflow(page,'Explore desktop');});
 await check('For You, Following and Explore grid display modes work',async()=>{
   await page.locator('.exo-social-tabs [data-view="grid"]').click();
   assert.ok(await page.locator('.exo-social-mosaic-tile').count()>=8,'Explore grid should show several projects');
   await page.locator('.exo-social-tabs [data-view="following"]').click();
   assert.equal(await page.locator('.exo-social-tabs [data-view="following"]').getAttribute('aria-pressed'),'true');
   await page.locator('.exo-social-tabs [data-view="for-you"]').click();
   assert.equal(await page.locator('.exo-social-tabs [data-view="for-you"]').getAttribute('aria-pressed'),'true');
   assert.ok(await page.locator('.exo-social-post-image img').count()>=5,'For You has a photo-first vertical feed');
 });
 await check('Explore likes saves comments and persistence',async()=>{const like=page.locator('.exo-social-post [data-action=like]').first();const id=await like.getAttribute('data-id');await like.click();assert.equal(await page.locator('.exo-social-post [data-action=like][data-id="'+id+'"]').getAttribute('aria-pressed'),'true');await page.locator('.exo-social-post [data-action=save][data-id="'+id+'"]').click();assert.equal(await page.locator('.exo-social-post [data-action=save][data-id="'+id+'"]').getAttribute('aria-pressed'),'true');await page.locator('.exo-social-post [data-action=comments][data-id="'+id+'"]').first().click();await page.locator('.exo-social-comment-form[data-id="'+id+'"] input').fill('QA local demo comment');await page.locator('.exo-social-comment-form[data-id="'+id+'"] button').click();assert.ok((await page.locator('.exo-social-comments').first().innerText()).includes('QA local demo comment'));assert.ok((await page.evaluate(key=>JSON.parse(localStorage.getItem('exo.community.social.v1')).comments[key],id)).length>0);});
 await check('Explore saved project appears in Profile Saved works',async()=>{const saved=page.locator('.exo-social-post [data-action="save"][aria-pressed="true"]').first();assert.ok(await saved.count(),'Explore project should be saved');const id=await saved.getAttribute('data-id');const title=await page.locator('.exo-social-post').filter({has:page.locator('[data-action="save"][data-id="'+id+'"]')}).locator('.exo-social-caption strong').innerText();await go(page,'profile');await page.locator('[data-tab="saved"]').click();const card=page.locator('.dp-tab-content .dp-project').filter({hasText:title});assert.equal(await card.count(),1,'Saved Works must show the same Explore project: '+title);assert.ok(await card.isVisible());await go(page,'explore');});
 await shot(page,'explore-desktop');
 await go(page,'forum');
 await check('Forum topics and seeded threads',async()=>{assert.equal(await page.locator('.exo-social-thread').count(),6);assert.equal(await page.locator('.exo-social-forum-categories button').count(),7);await noOverflow(page,'Forum desktop');});
 await check('Forum search, local thread and reply',async()=>{await page.locator('input[name=forum-search]').fill('articulated sleeves');assert.equal(await page.locator('.exo-social-thread').count(),1);await page.locator('input[name=forum-search]').fill('');await page.locator('[data-action=compose]').click();await page.locator('.exo-social-new-thread input[name=title]').fill('QA sleeve finishing techniques');await page.locator('.exo-social-new-thread textarea[name=body]').fill('Local smoke test for an original sample finishing discussion.');await page.locator('.exo-social-new-thread button[type=submit]').click();assert.ok((await page.locator('.exo-social-thread').first().innerText()).includes('QA sleeve finishing'));await page.locator('.exo-social-reply-form textarea').fill('Local test response from the studio.');await page.locator('.exo-social-reply-form button').click();assert.ok((await page.locator('.exo-social-thread-replies').first().innerText()).includes('Local test response'));});
 await shot(page,'forum-desktop');
 await go(page,'profile');
 await check('Designer follow, bio, share, tabs',async()=>{assert.ok(await page.locator('.dp-shell').count());await page.locator('[data-follow]').click();assert.equal(await page.locator('[data-follow]').getAttribute('aria-pressed'),'true');await page.locator('[data-edit]').click();await page.locator('#dp-bio-editor').fill('QA updated studio biography');await page.locator('[data-bio-form] button[type=submit]').click();assert.ok((await page.locator('.dp-bio').innerText()).includes('QA updated studio biography'));await page.locator('[data-share]').click();await page.waitForFunction(()=>/Profile link|copied/i.test(document.querySelector('.dp-notice')?.textContent||''),null,{timeout:3000});for(const tab of ['about','collections','saved','works']){await page.locator('[data-tab="'+tab+'"]').click();assert.equal(await page.locator('[data-tab="'+tab+'"]').getAttribute('aria-current'),'page');}await noOverflow(page,'Profile desktop');});
 await shot(page,'profile-desktop');
 await go(page,'marketplace');await page.locator('[data-market-category="Garments"]').click();
 await check('Garment model viewer opens and returns to marketplace',async()=>{
   const launch=page.locator('.asset-card [data-open]').first();
   assert.ok(await launch.count());await launch.click();
   assert.ok(await page.locator('#detail-modal').isVisible());
   await page.locator('#detail-full').click();
   assert.ok(await page.locator('.p2-product').isVisible());
   assert.ok(await page.locator('.exo-pv-stage canvas').count()>=1);
   await shot(page,'model-viewer-desktop');
   await page.locator('#p2-asset-back').click();
   assert.equal(await page.locator('[data-market-category="Garments"]').getAttribute('aria-pressed'),'true');
   assert.ok(await page.locator('#catalog-section').isVisible(),'Returning from asset details should restore marketplace selection');
 });
 await go(page,'ar');
 await check('AR Studio camera overlay and table projection controls',async()=>{
   assert.ok(await page.locator('#ar-studio').isVisible());
   assert.equal(await page.locator('.exo-ar-overlay').count(),1);
   await page.locator('#ar-studio [data-mode="table"]').click();
   assert.equal(await page.locator('#ar-studio [data-mode="table"]').getAttribute('aria-selected'),'true');
   assert.ok(await page.locator('#ar-studio .exo-ar-table-controls').isVisible());
   await page.locator('#ar-studio [data-control="calibration"]').fill('42');
   assert.ok((await page.locator('#ar-studio .exo-ar-measure').innerText()).includes('42 CM'));
   await page.locator('#ar-studio [data-control="scale"]').fill('165');
   assert.ok((await page.locator('#ar-studio [data-out="scale"]').innerText()).includes('165'));
   await page.locator('#ar-studio [data-action="reset"]').click();
   assert.ok((await page.locator('#ar-studio [data-out="scale"]').innerText()).includes('100'));
   await page.locator('#ar-studio [data-mode="garment"]').click();
   assert.ok(await page.locator('#ar-studio .exo-ar-asset').isVisible());
   await noOverflow(page,'AR Studio desktop');
 });
 await check('Camera-denied state preserves manual AR preview',async()=>{
   await page.evaluate(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>Promise.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}))});});
   await page.locator('#ar-studio [data-action="camera"]').click();
   await page.waitForFunction(()=>document.querySelector('#ar-studio .exo-ar-status')?.textContent?.includes('Camera permission denied'),null,{timeout:4000});
   assert.ok(await page.locator('#ar-studio .exo-ar-asset').isVisible());
   assert.equal(await page.locator('#ar-studio .exo-ar-video').isHidden(),true);
   assert.equal(await page.locator('#ar-studio [data-action="stop"]').isDisabled(),true);
 });
 await shot(page,'ar-studio-desktop');
 await check('Live camera permission starts a real browser video track and stops it when leaving AR',async()=>{
   const cameraContext=await browser.newContext({viewport:{width:1000,height:760},permissions:['camera']});
   try{
     const cameraPage=await cameraContext.newPage();
     await cameraPage.goto(baseURL+'#ar',{waitUntil:'domcontentloaded'});
     await cameraPage.locator('#ar-studio [data-action="camera"]').click();
     await cameraPage.waitForFunction(()=>{const v=document.querySelector('#ar-studio video');return v?.srcObject instanceof MediaStream && v.srcObject.getVideoTracks().some(t=>t.readyState==='live');},null,{timeout:12000});
     await cameraPage.locator('[data-nav="forum"]').click();
     await cameraPage.waitForFunction(()=>{const v=document.querySelector('#ar-studio video');return !v?.srcObject;},null,{timeout:5000});
   }finally{await cameraContext.close();}
 });
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push('mobile: '+e.message));await mobile.goto(baseURL,{waitUntil:'domcontentloaded'});await mobile.waitForTimeout(350);
 for(const [nav,screen] of [['discover','home-mobile'],['marketplace','marketplace-mobile'],['explore','explore-mobile'],['forum','forum-mobile'],['profile','profile-mobile']]){
   await check('Mobile '+nav+' no overflow',async()=>{if(nav!=='discover')await go(mobile,nav);await noOverflow(mobile,nav);});
   await shot(mobile,screen);
 }
 await go(mobile,'discover');
 await check('Mobile editorial denim study keeps all five views operable without page overflow',async()=>{
   const study=mobile.locator('#exh-editorial-story');
   assert.ok(await study.isVisible());
   assert.equal(await study.locator('[data-story-angle]').count(),5);
   const before=await mobile.locator('#exh-story-image').getAttribute('src');
   await study.locator('[data-story-angle="3"]').click();
   assert.notEqual(await mobile.locator('#exh-story-image').getAttribute('src'),before);
   await noOverflow(mobile,'mobile denim process study');
 });
 await mobile.locator('.exh-infinite-landing').screenshot({path:join(out,'v4-hero-square-gallery-mobile.png')});
 await check('Mobile full archive remains usable with touch and Escape',async()=>{
   await mobile.locator('#exh-view-archive').click();
   assert.ok(await mobile.locator('#exh-archive-view').isVisible());
   assert.equal(await mobile.locator('.exh-archive-work').count(),12);
   await noOverflow(mobile,'mobile editorial archive');
   await mobile.locator('.exh-archive-close').click();
   assert.ok(await mobile.locator('#exh-archive-view').isHidden());
 });
 await check('Mobile fabrics no overflow',async()=>{await go(mobile,'marketplace');await mobile.locator('[data-market-category="Fabrics"]').click();await mobile.waitForTimeout(250);await noOverflow(mobile,'mobile fabrics');});
 await shot(mobile,'fabrics-mobile');
 await check('Mobile garment exhibit fits phone width and all controls remain accessible',async()=>{
   await mobile.locator('[data-market-category="Garments"]').click();
   await noOverflow(mobile,'mobile garment exhibition');
   await mobile.locator('[data-exge-open="0"]').click();
   assert.ok(await mobile.locator('.exge-modal').isVisible());
   assert.equal(await mobile.locator('[data-exge-view]').count(),3);
   await noOverflow(mobile,'mobile garment detail dialog');
   await mobile.locator('.exge-close').click();
   await mobile.locator('[data-market-category="All"]').click();
 });
 await check('Mobile AR Studio layout fits phone screen',async()=>{await go(mobile,'ar');await noOverflow(mobile,'mobile AR Studio');await mobile.locator('#ar-studio [data-mode="table"]').click();assert.ok(await mobile.locator('#ar-studio .exo-ar-table-controls').isVisible());});
 await shot(mobile,'ar-studio-mobile');
 await check('Shared profile and project deep links reopen',async()=>{
   const deep=await browser.newPage({viewport:{width:1000,height:760}});
   try{
     await deep.goto(baseURL+'#profile/exo-studio',{waitUntil:'domcontentloaded'});
     assert.equal(await deep.locator('.dp-shell').count(),1);
     await deep.goto(baseURL+'#project-atelier-01',{waitUntil:'domcontentloaded'});
     assert.equal(await deep.locator('#exo-project-detail').count(),1,'Project hash must retain shared URL and open detail');
     assert.equal(new URL(deep.url()).hash,'#project-atelier-01');
   }finally{await deep.close();}
 });
 await check('Reduced motion disables gallery animation',async()=>{
   const reduced=await browser.newContext({viewport:{width:1000,height:760},reducedMotion:'reduce'});
   try{
     const sample=await reduced.newPage();
     await sample.goto(baseURL,{waitUntil:'domcontentloaded'});await sample.waitForTimeout(260);
     assert.equal(await sample.locator('.exo-home-revamp').evaluate(el=>el.classList.contains('exh-carousel-paused')),true);
     const card=sample.locator('.exh-carousel-card').first();
     const before=await card.evaluate(el=>getComputedStyle(el).transform);
     await sample.waitForTimeout(450);
     const after=await card.evaluate(el=>getComputedStyle(el).transform);
     assert.equal(after,before,'Reduced motion should keep the large photo wheel stationary without autoplay');
   }finally{await reduced.close();}
 });
 await check('Mobile carousel swipe',async()=>{await go(mobile,'discover');const hero=mobile.locator('.exh-hero-visual'),before=await mobile.locator('#exh-counter').innerText();const box=await hero.boundingBox();await mobile.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.5);await hero.dispatchEvent('pointerdown',{pointerType:'touch',clientX:box.x+box.width*.8,clientY:box.y+box.height*.5});await hero.dispatchEvent('pointerup',{pointerType:'touch',clientX:box.x+box.width*.1,clientY:box.y+box.height*.5});assert.notEqual(await mobile.locator('#exh-counter').innerText(),before);});
 await mobile.close();
 await check('No uncaught errors or failing assets',async()=>assert.deepEqual(errors,[]));
 await context.close();
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
const failures=results.filter(r=>r.status==='FAIL');console.log('\nEXO V4 QA '+(failures.length?'FAILED':'PASSED')+': '+(results.length-failures.length)+'/'+results.length+' checks');console.log(JSON.stringify({passed:failures.length===0,failures,errors,screenshots:screens,visualWarnings,results},null,2));if(failures.length)process.exitCode=1;
