/** Two independent browser participants controlled through their ordinary visible UI. IPC never prints invitations. */
const { chromium } = require('@playwright/test');
const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const out=path.join(__dirname,'../artifacts/hybrid');
(async()=>{
  const browser=await chromium.launch({headless:true}), pages=[], snapshots=new Map(), frames=[], errors=[];
  async function click(page,name){await page.getByRole('button',{name,exact:true}).click();}
  async function snapshotWait(fn){const end=Date.now()+20000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Shared state not confirmed');}
  for await(const line of readline.createInterface({input:process.stdin})) {
    try{
      const command=JSON.parse(line);
      if(command.type==='join') {
        for(let i=0;i<2;i++) {
          const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();pages.push(page);
          page.on('pageerror',e=>errors.push(e.message));
          page.on('websocket',socket=>socket.on('framereceived',e=>{try{const f=JSON.parse(String(e.payload));if(['room.snapshot','room.updated','activity'].includes(f.type))frames.push(f);}catch{}}));
          page.on('response',async response=>{if(!response.url().includes('/proposal/'))return;try{const d=await response.json(),s=d.snapshot??d;if(s.shared&&s.own)snapshots.set(page,s);}catch{}});
          await page.goto(command.invite);await page.getByLabel('Your nickname').fill(`Browser Friend ${i+1}`);await click(page,'Join room');await page.getByText('Waiting for the host to start.',{exact:true}).waitFor();
        }
        for(const page of pages){await page.getByText('Waiting for the host to start.',{exact:true}).waitFor();await snapshotWait(()=>snapshots.get(page)?.shared.participants.find(p=>p.participantId===snapshots.get(page)?.own.participantId)?.ready);}
        console.log(JSON.stringify({type:'ready'}));
      }else if(command.type==='voteTwo') {
        for(let card=0;card<2;card++)for(const page of pages){await page.getByRole('button',{name:'Yep',exact:true}).waitFor();await click(page,'Yep');}
        console.log(JSON.stringify({type:'voted'}));
      }else if(command.type==='inspectAndAgreeOne') {
        for(const page of pages)await click(page,'Inspect 2 matches');
        await pages[0].getByRole('button',{name:/^Agree to /}).click();
        console.log(JSON.stringify({type:'agreed'}));
      }else if(command.type==='replaceTwo') {
        const p=pages[1];await snapshotWait(()=>snapshots.get(p)?.shared.proposal);
        const room=snapshots.get(p), other=room.shared.matches.find(m=>m.candidateId!==room.shared.proposal.candidateId),c=room.shared.candidates.find(c=>c.id===other.candidateId);
        const label=c.title+(c.year===null?'':` (${c.year})`);
        await p.getByRole('button',{name:new RegExp('^Inspect '+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+',')}).click();
        await click(p,`Propose ${label} instead`);
        console.log(JSON.stringify({type:'replaced'}));
      }else if(command.type==='agreeFinal') {
        await pages[0].getByRole('button',{name:/^Agree to /}).click();
        for(const page of pages)await page.getByText('Everyone agrees. Enjoy your watch.',{exact:true}).waitFor();
        await pages[0].screenshot({path:path.join(out,'native-mixed-browser-done.png')});
        console.log(JSON.stringify({type:'done',sharedFrames:frames.filter(f=>f.type!=='activity').length,activityFrames:frames.filter(f=>f.type==='activity').length,errors}));
      }else if(command.type==='close')break;
    }catch(e){console.log(JSON.stringify({type:'error',message:e.message.split('\n')[0]}));}
  }
  await browser.close();
})();
