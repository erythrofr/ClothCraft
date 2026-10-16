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
const results=[], errors=[],screens=[];
const pass=(name,details={})=>{results.push({name,status:'PASS',...details});console.log('PASS '+name);};
const fail=(name,e)=>{const error=String(e?.message||e).split('\n')[0];results.push({name,status:'FAIL',error});console.error('FAIL '+name+': '+error);};
async function check(name,fn){try{await fn();pass(name);}catch(e){fail(name,e);}}
const shot=async(page,name)=>{try{await page.screenshot({path:join(out,'v4-'+name+'.png'),fullPage:true,timeout:12000});screens.push('v4-'+name+'.png');}catch(e){fail('screenshot '+name,e);}};
const noOverflow=async(page,label)=>{const dimensions=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(dimensions.scroll<=dimensions.viewport+3, label+' overflow '+JSON.stringify(dimensions));};
const go=async(page,name)=>{await page.locator('.main-links [data-nav="'+name+'"]').first().click();await page.waitForTimeout(160);};
const firstVisible=page=>page.locator('#alt-view').isVisible();
try{
 await mkdir(out,{recursive:true});
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,permissions:['clipboard-read','clipboard-write'],reducedMotion:'no-preference'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push('page: '+e.message));
 page.on('response',r=>{if(r.status()>=400&&!r.url().includes('favicon'))errors.push('HTTP '+r.status()+' '+r.url());});
 await page.goto(baseURL,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1100);
 await check('Home layout and no desktop overflow',async()=>{assert.ok(await page.locator('#project-home .exh-hero-visual').count());await noOverflow(page,'Home desktop');});
 await check('Homepage carousel photo is loaded',async()=>{await page.locator('#exh-active-photo').evaluate(img=>img.decode());assert.ok(await page.locator('#exh-active-photo').evaluate(img=>img.naturalWidth>0));});
 await check('Carousel next, previous and orbit controls',async()=>{const initial=await page.locator('#exh-active-title').innerText();await page.locator('#exh-next').click();assert.notEqual(await page.locator('#exh-active-title').innerText(),initial);await page.locator('#exh-prev').click();assert.equal(await page.locator('#exh-active-title').innerText(),initial);await page.locator('[data-orbit]').first().click();assert.notEqual(await page.locator('#exh-active-title').innerText(),initial);});
 await check('Carousel pointer swipe',async()=>{const visual=page.locator('.exh-hero-visual'),bbox=await visual.boundingBox();assert.ok(bbox);const before=await page.locator('#exh-counter').innerText();await page.mouse.move(bbox.x+bbox.width*.8,bbox.y+bbox.height*.55);await page.mouse.down();await page.mouse.move(bbox.x+bbox.width*.15,bbox.y+bbox.height*.55,{steps:6});await page.mouse.up();assert.notEqual(await page.locator('#exh-counter').innerText(),before);});
 await check('Carousel auto advance after idle',async()=>{await page.mouse.move(0,0);await page.locator('#exh-next').blur?.().catch(()=>{});await page.evaluate(()=>document.activeElement?.blur());const before=await page.locator('#exh-counter').innerText();await page.waitForTimeout(6100);assert.notEqual(await page.locator('#exh-counter').innerText(),before);});
 await check('Four curator images load',async()=>{assert.equal(await page.locator('.exh-curator-tile').count(),4);const photos=page.locator('.exh-curator-tile img');assert.equal(await photos.count(),4);for(const img of await photos.all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());assert.ok(await img.evaluate(el=>el.naturalWidth>0));}});
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
 await check('Curator cards and marketplace intro visibly painted',async()=>{for(const selector of ['.exh-curators','.exh-shop-intro']){const el=page.locator(selector);await el.scrollIntoViewIfNeeded();await page.waitForTimeout(700);assert.ok(await el.isVisible(),selector+' hidden');const styles=await el.evaluate(node=>({opacity:getComputedStyle(node).opacity,visibility:getComputedStyle(node).visibility,height:node.getBoundingClientRect().height}));assert.ok(Number(styles.opacity)>.9&&styles.visibility==='visible'&&styles.height>90,selector+' blank: '+JSON.stringify(styles));}await shot(page,'curators-marketplace-intro-desktop');});
 await shot(page,'home-desktop');
 await go(page,'marketplace');
 await check('Marketplace seven tabs and 17 cards',async()=>{assert.equal(await page.locator('[data-market-category]').count(),7);assert.equal(await page.locator('.asset-card').count(),17);await noOverflow(page,'Marketplace desktop');});
 await check('Marketplace categories support browser Back and Forward',async()=>{
   await page.locator('[data-market-category="Garments"]').click();
   assert.equal(new URL(page.url()).hash,'#marketplace/garments');
   await page.goBack({waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('[data-market-category="All"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('.asset-card').count(),17);
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
   assert.equal(await page.locator('.asset-card').count(),17);
   await go(page,'marketplace');
 });
 await check('Fabrics 400-record inventory',async()=>{await page.locator('[data-market-category="Fabrics"]').click();await page.waitForFunction(()=>document.querySelector('#exfs-total')?.textContent?.trim()==='400',{timeout:12000});assert.match(await page.locator('#exfs-count').innerText(),/400 of 400/);assert.ok(await page.locator('.exfs-card').count()>=1);await noOverflow(page,'Fabrics desktop');});
 await shot(page,'fabrics-desktop');
 await go(page,'explore');
 await check('Explore mosaic/feed and project images',async()=>{assert.ok(await firstVisible(page));assert.ok(await page.locator('.exo-social-mosaic-tile').count()>=5);assert.ok(await page.locator('.exo-social-post').count()>=5);const img=page.locator('.exo-social-mosaic-tile img').first();await img.evaluate(el=>el.decode());assert.ok(await img.evaluate(el=>el.naturalWidth>0));await noOverflow(page,'Explore desktop');});
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
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push('mobile: '+e.message));await mobile.goto(baseURL,{waitUntil:'domcontentloaded'});await mobile.waitForTimeout(350);
 for(const [nav,screen] of [['discover','home-mobile'],['marketplace','marketplace-mobile'],['explore','explore-mobile'],['forum','forum-mobile'],['profile','profile-mobile']]){
   await check('Mobile '+nav+' no overflow',async()=>{if(nav!=='discover')await go(mobile,nav);await noOverflow(mobile,nav);});
   await shot(mobile,screen);
 }
 await check('Mobile fabrics no overflow',async()=>{await go(mobile,'marketplace');await mobile.locator('[data-market-category="Fabrics"]').click();await mobile.waitForTimeout(250);await noOverflow(mobile,'mobile fabrics');});
 await shot(mobile,'fabrics-mobile');
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
     const animation=await sample.locator('.exh-orbit-control').evaluate(el=>getComputedStyle(el).animationName);
     assert.equal(animation,'none','Reduced motion should stop automatic orbit animation');
   }finally{await reduced.close();}
 });
 await check('Mobile carousel swipe',async()=>{await go(mobile,'discover');const hero=mobile.locator('.exh-hero-visual'),before=await mobile.locator('#exh-counter').innerText();const box=await hero.boundingBox();await mobile.touchscreen.tap(box.x+box.width*.5,box.y+box.height*.5);await hero.dispatchEvent('pointerdown',{pointerType:'touch',clientX:box.x+box.width*.8,clientY:box.y+box.height*.5});await hero.dispatchEvent('pointerup',{pointerType:'touch',clientX:box.x+box.width*.1,clientY:box.y+box.height*.5});assert.notEqual(await mobile.locator('#exh-counter').innerText(),before);});
 await mobile.close();
 await check('No uncaught errors or failing assets',async()=>assert.deepEqual(errors,[]));
 await context.close();
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
const failures=results.filter(r=>r.status==='FAIL');console.log('\nEXO V4 QA '+(failures.length?'FAILED':'PASSED')+': '+(results.length-failures.length)+'/'+results.length+' checks');console.log(JSON.stringify({passed:failures.length===0,failures,errors,screenshots:screens,results},null,2));if(failures.length)process.exitCode=1;
