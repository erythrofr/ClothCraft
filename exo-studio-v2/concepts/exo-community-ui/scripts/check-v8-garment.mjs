/* EXO V8 / focused media review. Original CGI and source-attributed 501 studies. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {join} from 'node:path';
const base=process.env.EXO_URL||'http://127.0.0.1:5499/';
const root='concepts/exo-community-ui/previews';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
let tests=0;const errors=[];
const check=async(name,fn)=>{await fn();tests++;console.log('PASS',name);};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('.main-links [data-nav="marketplace"]').click();
 await page.locator('[data-market-category="Garments"]').click();
 await check('Original EXO moto concept is a truthful rendered asset',async()=>{
  const c=page.locator('#asset-grid [data-open="moto"]').first();
  assert.equal(await c.count(),1);
  await c.click();
  assert.equal(await page.locator('#exo-project-detail').isVisible(),true);
  assert.equal(await page.locator('.expo-project-thumbs button').count(),3);
  assert.match(await page.locator('.exo-project-description').innerText(),/procedural Blender|not a fitted garment/i);
  await page.locator('#expo-project-active-image').evaluate(img=>img.decode());
  assert.ok(await page.locator('#expo-project-active-image').evaluate(img=>img.naturalWidth>0));
 });
 await page.screenshot({path:join(root,'v8-moto-viewer-desktop.png')});
 await check('Multi-angle selection, next-view and detail zoom',async()=>{
  await page.locator('#exo-project-detail [data-gallery-index="1"]').click();
  assert.match(await page.locator('#expo-project-active-image').getAttribute('src'),/front\.webp$/);
  await page.locator('#exo-project-detail [data-gallery-arrow="1"]').click();
  assert.match(await page.locator('#expo-project-active-image').getAttribute('src'),/detail\.webp$/);
  await page.locator('#exo-project-detail [data-photo-zoom]').click();
  assert.equal(await page.locator('#exo-project-detail [data-photo-zoom]').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('ArrowLeft');
  assert.match(await page.locator('#expo-project-active-image').getAttribute('src'),/front\.webp$/);
  assert.equal(await page.locator('#exo-project-detail [data-photo-zoom]').getAttribute('aria-pressed'),'false');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#exo-project-detail').count(),0);
 });
 await page.locator('.main-links [data-nav="discover"]').click();
 await check('MIKRISTIAN 501 research is genuinely multi-angle and source-attributed',async()=>{
  await page.locator('.exh-curator-tile [data-project="garment-02"]').click();
  assert.equal(await page.locator('#exo-project-detail .expo-project-thumbs button').count(),5);
  const photo=page.locator('#expo-project-active-image');
  await photo.evaluate(img=>img.decode());
  assert.ok(await photo.evaluate(img=>img.naturalWidth>0));
  assert.match(await page.locator('.exo-project-description').innerText(),/development render|research renders/i);
  await page.locator('#exo-project-detail [data-gallery-index="2"]').click();
  assert.match(await photo.getAttribute('src'),/denim-focus-back\.webp/);
 });
 await page.screenshot({path:join(root,'v8-denim-viewer-desktop.png')});
 await page.keyboard.press('Escape');
 await check('Desktop product page is not horizontally overflowing',async()=>{
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 });
 await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',error=>errors.push('mobile: '+error.message));
 await mobile.goto(base,{waitUntil:'domcontentloaded'});
 await mobile.locator('.main-links [data-nav="marketplace"]').click();
 await mobile.locator('[data-market-category="Garments"]').click();
 await check('Mobile multi-view studio modal stays usable',async()=>{
  await mobile.locator('#asset-grid [data-open="moto"]').first().click();
  assert.equal(await mobile.locator('#exo-project-detail').isVisible(),true);
  assert.ok(await mobile.locator('.expo-project-thumbs button').count()>=3);
  assert.ok(await mobile.locator('.expo-project-main').evaluate(el=>el.getBoundingClientRect().height>=300),'Mobile render stage must not collapse under detail text');
  assert.ok(await mobile.locator('.expo-project-thumbs').isVisible(),'All garment-angle controls should be visible below the image');
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await mobile.locator('#exo-project-detail [data-gallery-index="1"]').click();
  await mobile.locator('#expo-project-active-image').evaluate(img=>img.decode());
  await mobile.locator('#exo-project-detail [data-project-close][aria-label]').click();
  assert.equal(await mobile.locator('#exo-project-detail').count(),0);
 });
 await mobile.locator('#asset-grid [data-open="moto"]').first().click();
 await mobile.screenshot({path:join(root,'v8-moto-viewer-mobile.png')});
 await mobile.keyboard.press('Escape');
 await check('No JavaScript errors in garment pages',async()=>assert.deepEqual(errors,[]));
 console.log('EXO V8 GARMENT QA PASSED',tests,'checks');
}finally{await browser.close();}
