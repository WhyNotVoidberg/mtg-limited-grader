// Run with Playwright available via NODE_PATH. Uses only isolated browser contexts.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const files=['index.html','app.js','styles.css','sw.js','manifest.webmanifest'];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json'};
const card=(id,name)=>({object:'card',id,oracle_id:id,name,set:'dsk',set_name:'Test set',type_line:'Creature',oracle_text:'Flying',colors:['W'],rarity:'common',mana_cost:'{W}',image_uris:{normal:'https://cards.scryfall.io/test.png'}});
const data={sets:{dsk:{name:'Test set',cards:[card('one','First card'),card('two','Second card')],ratings:{one:{grade:'A',confidence:'High',notes:'Original',power:'4',consistency:'3',primaryRole:'Creature',synergyReliance:'Independent',secondary:['Evasion'],synergy:[],autoVersion:1}},mechanics:{Rooms:{Power:'4'}}}},futureField:{retain:true}};
let serveBaseline=false;
const baseline={};
if(process.env.MTG_TEST_GIT)for(const name of files)baseline[name]=execFileSync(process.env.MTG_TEST_GIT,['show',`origin/main:${name}`]);
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!files.includes(name)){res.writeHead(404).end();return}res.setHeader('Content-Type',types[path.extname(name)]);res.setHeader('Cache-Control','no-store');res.end(serveBaseline?baseline[name]:fs.readFileSync(name))});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const context=await browser.newContext({viewport,serviceWorkers:'block'});
      await context.route('https://cards.scryfall.io/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680"><rect width="488" height="680" fill="#424242"/><text x="80" y="180" fill="white" font-size="36">Test card image</text></svg>'}));
      await context.route('https://api.scryfall.com/**',r=>{
        const q=new URL(r.request().url()).searchParams.get('q');
        if(q.includes('set:fra')&&q.includes('is:booster'))return r.fulfill({status:404,json:{details:'No cards found'}});
        return r.fulfill({json:{data:[{...card('new','Imported card'),set:q.includes('set:fra')?'fra':'dsk'}],has_more:false}});
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      await page.goto(url);await page.evaluate(data=>localStorage.setItem('mtgLimitedGraderV1',JSON.stringify(data)),data);await page.reload();
      await page.getByRole('button',{name:/Test set/}).click();
      await page.getByRole('button',{name:'Data',exact:true}).click();
      fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:`test-results/data-${viewport.width}.png`,fullPage:true});
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mtgLimitedGraderV1')).sets.dsk.ratings.one.grade),'A');
      await page.getByRole('button',{name:'Grade',exact:true}).click();
      await page.locator('#grade').selectOption('B-');await page.locator('#confidence').selectOption('Medium');await page.locator('#primaryRole').selectOption('Removal');await page.locator('#notes').fill('Browser test note');
      await page.locator('#power button').nth(4).click();await page.locator('#consistency button').nth(1).click();await page.locator('#synergyReliance button').nth(2).click();
      const chip=page.locator('#secondaryTags button').filter({hasText:/^Burn$/});await chip.scrollIntoViewIfNeeded();
      const scroll=await page.evaluate(()=>scrollY);await chip.click();assert.ok(Math.abs((await page.evaluate(()=>scrollY))-scroll)<10,'Tag click must preserve scroll');
      await page.getByRole('button',{name:'Save & next'}).click();await page.getByRole('button',{name:'← Previous'}).click();
      assert.equal(await page.locator('#grade').inputValue(),'B-');assert.equal(await page.locator('#notes').inputValue(),'Browser test note');assert.equal(await page.locator('#confidence').inputValue(),'Medium');
      await page.getByRole('button',{name:'Gallery',exact:true}).click();assert.equal(await page.locator('.grade-pill').first().textContent(),'B-');
      await page.locator('#statusFilter').selectOption('graded');assert.equal(await page.locator('.gallery-card').count(),1);
      await page.getByRole('button',{name:'Data',exact:true}).click();
      const next=JSON.parse(JSON.stringify(data));next.sets.dsk.ratings.one.grade='F';next.sets.fra={...next.sets.dsk,name:'Imported FRA'};
      await page.locator('#importJson').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(next))});
      await page.waitForSelector('#setsView:not(.hidden)');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mtgLimitedGraderV1')).sets.dsk.ratings.one.grade),'B-');
      await page.getByRole('button',{name:/Test set/}).click();await page.getByRole('button',{name:'Data',exact:true}).click();
      await page.locator('#importPolicy').selectOption('backup');await page.locator('#importJson').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(next))});
      await page.waitForSelector('#setsView:not(.hidden)');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mtgLimitedGraderV1')).sets.dsk.ratings.one.grade),'F');
      await page.getByRole('button',{name:/Test set/}).click();await page.getByRole('button',{name:'Data',exact:true}).click();
      const downloadPromise=page.waitForEvent('download');await page.locator('#exportJson').click();const download=await downloadPromise;
      const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.ok(exported.sets.fra);assert.equal(exported.futureField.retain,true);
      await page.getByRole('button',{name:'Sets',exact:true}).click();await page.locator('#setCodeInput').fill('FRA');await page.locator('#addSetBtn').click();await page.waitForSelector('#setView:not(.hidden)');
      assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('mtgLimitedGraderV1')).sets.fra.ratings.one),'Refresh preserves ratings');
      await page.getByRole('button',{name:'Sets',exact:true}).click();await page.getByRole('button',{name:/Test set/}).click();await page.getByRole('button',{name:'Grade',exact:true}).click();
      await page.evaluate(()=>window.scrollTo(0,400));await page.waitForTimeout(250);
      if(viewport.width<700)assert.ok(await page.locator('.card-pane').evaluate(e=>e.classList.contains('compact')));
      await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(250);
      assert.equal(await page.locator('.card-pane').evaluate(e=>e.classList.contains('compact')),false);
      fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:`test-results/grader-${viewport.width}.png`,fullPage:true});
      assert.deepEqual(errors,[]);console.log(`PASS ${viewport.width}px: navigation, all fields, tags, imports, JSON export, DSK/FRA fetch and scroll`);
      await context.close();
    }
    if(process.env.MTG_TEST_BACKUP){
      const real=JSON.parse(fs.readFileSync(process.env.MTG_TEST_BACKUP,'utf8'));
      const context=await browser.newContext({serviceWorkers:'block'});
      await context.addInitScript(real=>localStorage.setItem('mtgLimitedGraderV1',JSON.stringify(real)),real);
      await context.route('https://cards.scryfall.io/**',r=>r.abort());
      const page=await context.newPage(),messages=[];page.on('dialog',d=>{messages.push(d.message());d.accept()});
      await page.goto(url);
      for(let i=0;i<2;i++){
        await page.evaluate(()=>{openSet('fra');showTab('data')});
        await page.locator('#importJson').setInputFiles({name:'private-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(real))});
        await page.waitForSelector('#setsView:not(.hidden)');
        assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mtgLimitedGraderV1'))),real);
      }
      const recovery=await page.evaluate(async()=>JSON.parse(await recoveryStore('readonly')));assert.deepEqual(recovery,real);
      assert.equal(messages.filter(x=>x.startsWith('Import failed')).length,0);
      console.log('PASS real private backup imported twice within browser quota; IndexedDB recovery matches all source data');
      await context.close();
    }
    if(process.env.MTG_TEST_GIT){
      serveBaseline=true;
      const context=await browser.newContext();
      await context.addInitScript(data=>{if(!localStorage.getItem('mtgLimitedGraderV1'))localStorage.setItem('mtgLimitedGraderV1',JSON.stringify(data))},data);
      await context.route('https://api.scryfall.com/**',r=>r.fulfill({json:{data:[card('one','First card')],has_more:false}}));
      await context.route('https://cards.scryfall.io/**',r=>r.abort());
      const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(url);console.log('SW check: loaded baseline');
      await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
      await page.waitForFunction(()=>sessionStorage.getItem('swReloaded14')==='1');
      console.log('SW check: baseline controls page');
      await page.reload();
      serveBaseline=false;
      // The old version's one-reload-per-session guard may already be consumed.
      await page.reload();
      await page.waitForFunction(()=>document.getElementById('appVersion').textContent==='v1.5');
      await page.waitForFunction(()=>sessionStorage.getItem('swReloaded15')==='1');
      await page.waitForFunction(async()=>(await caches.keys()).includes('limited-grader-v1-5'));
      await page.waitForFunction(async()=>!(await caches.keys()).includes('limited-grader-v1-4'));
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mtgLimitedGraderV1')).sets.dsk.ratings.one.grade),'A');
      await context.setOffline(true);await page.reload();assert.equal(await page.locator('#appVersion').textContent(),'v1.5');
      console.log('PASS real browser service-worker upgrade v1.4 -> v1.5, old cache cleanup, saved grade preservation, offline shell');
      await context.close();
    }
  }finally{await browser.close();server.close()}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1});

