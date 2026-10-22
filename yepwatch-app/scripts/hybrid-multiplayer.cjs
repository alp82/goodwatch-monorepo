/** Ordinary visible-UI proof. Every identity has its own browser cookie jar. No fixture routes. */
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.YEPWATCH_HYBRID_ORIGIN ?? 'http://127.0.0.1:8133';
const out = path.resolve(__dirname, process.env.YEPWATCH_PROOF_DIR ?? '../artifacts/hybrid');
const staged = process.env.YEPWATCH_STATIC_EXPORT ? path.resolve(__dirname, '..', process.env.YEPWATCH_STATIC_EXPORT) : null;
fs.mkdirSync(out, {recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true});
  const pages=[], snapshots=new Map(), frames=[], errors=[], checks=[];
  const commandCount = new Map();
  const result = {stagedStaticExport:staged,apiAndWebsocketFixtures:false,app:origin,api:'http://127.0.0.1:15992',gateway:'ws://127.0.0.1:4324',catalog:'Finite real catalog sample, durable isolated Crate',checks};
  async function makePage(name) {
    const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const page=await context.newPage();
    if (staged) await page.route(`${origin}/**`, async route => {
      // Keep the real loopback document response/address space. Only this fresh test context's
      // static bundles are replaced; cross-origin API/WS use actual transport and normal Origin.
      if (route.request().resourceType() === 'document') return route.continue();
      const pathname=decodeURIComponent(new URL(route.request().url()).pathname);
      let file=path.resolve(staged, '.'+pathname);
      if (!file.startsWith(staged+path.sep)) return route.abort();
      if (!fs.existsSync(file)) {
        const hashed=path.basename(file).match(/^(.*?)-[a-f0-9]+(\.js(?:\.map)?)$/);
        if (hashed && fs.existsSync(path.dirname(file))) {
          const name=fs.readdirSync(path.dirname(file)).find(n=>n.startsWith(hashed[1]+'-') && n.endsWith(hashed[2]));
          if (name) file=path.join(path.dirname(file),name);
        }
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.continue();
      const mime={'.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.json':'application/json','.map':'application/json'};
      await route.fulfill({path:file,contentType:mime[path.extname(file)]??'application/octet-stream'});
    });
    pages.push(page); commandCount.set(page,0);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('websocket',s=>s.on('framereceived',e=>{try{ const f=JSON.parse(String(e.payload)); if (['room.snapshot','room.updated','activity'].includes(f.type)) frames.push(f); }catch{}}));
    page.on('response',async response=>{if(!response.url().includes('/proposal/'))return;try {const data=await response.json();const snapshot=data.snapshot ?? data;if(snapshot.shared && snapshot.own)snapshots.set(page,snapshot);}catch{}});
    page.on('request',r=>{if(r.url().endsWith('/commands'))commandCount.set(page,commandCount.get(page)+1);});
    page.nickname=name; return page;
  }
  async function click(page,name) { await page.getByRole('button',{name,exact:true}).click(); }
  async function join(page,invite) {
    await page.goto(invite); await page.getByLabel('Your nickname').fill(page.nickname); await click(page,'Join room');
    await expect(page.getByRole('button',{name:'Ready to watch',exact:true})).toHaveCount(0);
    await expect.poll(()=>snapshots.get(page)?.shared.participants.find(p=>p.participantId===snapshots.get(page)?.own.participantId)?.ready).toBe(true);
  }
  async function enterWall(page) { await page.getByRole('button',{name:/^Inspect (\d+ matches|proposal)$/}).click(); await page.getByRole('button',{name:'Keep voting',exact:true}).waitFor(); }
  async function select(page,title) {
    if(await page.getByRole('button',{name:'Stop looking',exact:true}).count()) await click(page,'Stop looking');
    await page.getByRole('button',{name:new RegExp('^Inspect '+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+',')}).click();
  }
  async function propose(page,title,replace=false) { await select(page,title); await click(page,`Propose ${title}${replace?' instead':''}`); }
  try {
    const host=await makePage('Host');
    await host.goto(origin); await host.getByLabel('Your nickname').fill('Host'); await click(host,'Create a room');
    await click(host,'Choose our services'); await click(host,'Change country'); await host.getByLabel('Find country').fill('Germany');
    await click(host,'Germany'); await click(host,'Netflix (service 8)'); await click(host,'Use these services');
    await click(host,'Invite friends');
    const invite=await host.getByText(new RegExp('^'+origin.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/r/')).innerText();
    await host.getByRole('button',{name:'Close panel',exact:true}).last().click();
    const one=await makePage('Friend One'), two=await makePage('Friend Two');
    await join(one,invite); await join(two,invite);
    await Promise.all([one,two].map(async p=>{await expect.poll(()=>snapshots.get(p)?.shared.participants.find(m=>m.participantId===snapshots.get(p)?.own.participantId)?.ready).toBe(true);}));
    await click(host,'Start choosing');
    for(const p of [host,one,two]) await p.getByRole('button',{name:'Yep',exact:true}).waitFor();
    checks.push('Fresh visible create/invite/join and independent three-client readiness/start');
    await host.waitForTimeout(500);
    for(let card=0;card<2;card++) {
      for(const p of [host,one,two]) await click(p,'Yep');
      for(const p of [host,one,two]) await p.getByRole('button',{name:`Inspect ${card+1} matches`,exact:true}).waitFor();
    }
    const shared=snapshots.get(host).shared;
    const ids=shared.matches.map(m=>m.candidateId);
    const labels=ids.map(id=>{const c=shared.candidates.find(c=>c.id===id);return c.title+(c.year===null?'':` (${c.year})`);});
    if(ids.length!==2)throw new Error('Expected two confirmed matches');
    if(shared.matches.some(m=>m.averageYepMs===null))throw new Error('Fresh explicit visible observations did not produce complete-roster timing');
    result.measuredRosterAveragesAvailable=true;
    const next=await host.getByTestId('poster').innerText();
    await enterWall(host);
    for(const size of [{width:375,height:667},{width:390,height:844},{width:1440,height:900}]) {
      await host.setViewportSize(size);await host.getByRole('button',{name:/^Quickest:/}).click();
      await host.screenshot({path:path.join(out,`wall-real-${size.width}.png`)});
      const b=await host.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));
      if(b.sw>b.w||b.sh>b.h)throw new Error('Hybrid wall scrolls');
    }
    await host.setViewportSize({width:390,height:844});
    const before=commandCount.get(host);await host.getByRole('button',{name:/^Surprise me:/}).click();
    if(commandCount.get(host)!==before)throw new Error('Dice issued a command');
    await propose(host,labels[0]);
    await enterWall(one);await enterWall(two);
    await one.getByRole('button',{name:new RegExp('^Agree to ')}).click();
    await click(one,'Take back your agreement');
    await propose(two,labels[1],true);
    await expect.poll(()=>snapshots.get(host)?.shared.proposal?.candidateId).toBe(ids[1]);
    await click(host,'Keep voting');await expect.poll(()=>host.getByTestId('poster').innerText()).toBe(next);
    await host.reload();await host.getByRole('button',{name:'Undo last choice',exact:true}).waitFor();
    await expect(host.getByRole('button',{name:'Undo last choice',exact:true})).toBeEnabled();
    checks.push('Measured current-roster Yep timing, inspection-only dice/lenses, explicit proposal/withdraw/replacement, same card and reload Undo');
    const late=await makePage('Late Friend');await join(late,invite);
    await late.getByRole('button',{name:'Yep',exact:true}).waitFor();
    await enterWall(late);
    await late.getByRole('button',{name:new RegExp('^Agree to ')}).click();
    await expect.poll(()=>snapshots.get(late)?.own.votes.find(v=>v.candidateId===ids[1])?.timingSource).toBe('implied');
    if(snapshots.get(late).own.votes.find(v=>v.candidateId===ids[1]).activeExposureMs!==null)throw new Error('Implied agreement invented exposure');
    await click(host,'Undo last choice');
    await expect.poll(()=>snapshots.get(host)?.shared.proposal).toBe(null);
    await click(host,'Yep');
    await enterWall(host);
    await propose(host,labels[1]);
    for(const p of [one,two,late]) {
      await expect.poll(()=>snapshots.get(p)?.shared.proposal?.candidateId).toBe(ids[1]);
      await p.getByRole('button',{name:new RegExp('^Agree to ')}).click();
    }
    for(const p of pages)await p.getByText('Everyone agrees. Enjoy your watch.',{exact:true}).waitFor();
    checks.push('Late join preserves proposal, explicit newcomer Agree implies untimed Yep; Undo invalidates; fresh proposal plus all current Agree produces server-confirmed Done');
    await host.screenshot({path:path.join(out,'done-real-390.png')});
    for(const f of frames) {
      if(f.type==='activity') {
        for(const key of ['votes','value','direction','currentCardId','activeExposureMs','agreed','proposerId','approverId'])if(key in f)throw new Error('Private activity field');
        if(f.inspection && f.view!=='matches')throw new Error('Wrong inspection scope');
        if(f.beat && f.view!=='voting')throw new Error('Answer associated with matches');
      } else {
        for(const p of f.snapshot.participants)for(const key of ['vote','votes','pick','agreed','activeExposureMs','currentCardId'])if(key in p)throw new Error('Private roster field');
        if(f.snapshot.proposal)for(const key of ['participantId','proposerId','agreedBy','approverIds'])if(key in f.snapshot.proposal)throw new Error('Named proposal approval');
      }
    }
    if(errors.length)throw new Error(errors.join('\n'));
    result.passed=true;result.identities=pages.length;result.sharedFrames=frames.filter(f=>f.type!=='activity').length;result.activityFrames=frames.filter(f=>f.type==='activity').length;result.javascriptErrors=errors;
  }catch(e){result.passed=false;result.failure=e.message;result.javascriptErrors=errors; if(checks.length===0 && pages[0]) { result.initialPageState=(await pages[0].locator('body').innerText()).split('\n').filter(line=>!line.includes('/r/')).slice(0,30); } console.error(e.message);process.exitCode=1;}
  finally{result.completedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'connected-browser.json'),JSON.stringify(result,null,2)+'\n');await browser.close();}
  console.log(checks.join('\n'));
})();
