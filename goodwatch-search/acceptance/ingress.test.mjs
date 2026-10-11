import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { parseIngressLine } from './ingress-events.mjs';
import { Journal } from './collect.mjs';
import { verifyIngress } from './ingress-verify.mjs';
const start='2026-10-11T12:00:00.000Z', end='2026-10-18T12:00:00.000Z';
const cid='a'.repeat(64), rotated='b'.repeat(64);
const source={host:'abio',containerId:cid};
const raw={StartUTC:'2026-10-11T12:01:00.000Z',RouterName:'gw-search-https@file',RequestMethod:'POST',DownstreamStatus:200};
const record=(changes={}, dockerAt=raw.StartUTC, from=source)=>parseIngressLine(`${dockerAt} ${JSON.stringify({...raw,...changes})}`,from).record;
const options={start,end,host:'abio',now:Date.parse(end)};
const beats=[];
for(let at=Date.parse(start);at<=Date.parse(end);at+=30000)beats.push({type:'collector.heartbeat',host:'abio',at:new Date(at).toISOString(),sources:[{host:'abio',containerId:cid,running:true}]});
const good=[...beats,record()];
test('exact router/method whitelist discards all private fields and logger metadata',()=>{
 const r=record({RequestPath:'/secret',RequestHost:'secret-host',RequestAddr:'secret-address',RequestBody:'secret-body',QueryParameters:{private:'secret-query'},Cookie:'secret-cookie',Authorization:'secret-auth',msg:'secret-message',time:'secret-time',level:'secret-level'});
 assert.deepEqual(r.data,{at:raw.StartUTC,route:'search',method:'POST',status:200});
 assert.equal(JSON.stringify(r).includes('secret'),false);
 for(const changes of [{RouterName:'unknown@file'},{RequestMethod:'GET'}])assert.deepEqual(parseIngressLine(`${raw.StartUTC} ${JSON.stringify({...raw,...changes})}`,source),{ignored:true});
 assert.deepEqual(parseIngressLine(`${raw.StartUTC} unrelated private output`,source),{ignored:true});
 assert.deepEqual(parseIngressLine(`${raw.StartUTC} ${JSON.stringify({...raw,DownstreamStatus:'502'})}`,source),{malformed:true});
 const vector=record({RouterName:'gw-search-from-abio@file'},raw.StartUTC,{host:'vector1',containerId:cid});
 assert.equal(vector.source.host,'vector1');
});
test('durable replay deduplicates and refuses a partial journal',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ingress-journal-'));
 try {let journal=new Journal(dir);assert.equal(journal.append(record()),true);journal.close();journal=new Journal(dir);assert.equal(journal.append(record()),false);assert.equal(journal.append(record({DownstreamStatus:502},raw.StartUTC,{...source,containerId:rotated})),true);journal.close();appendFileSync(join(dir,'events.ndjson'),'{');assert.throws(()=>new Journal(dir),/incomplete/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('closed seven-day ingress can pass only its scoped response checks',()=>{
 const report=verifyIngress([...good,record()],options);
 assert.equal(report.ingress_response_checks_pass,true);assert.equal(report.routed_post_responses,1);assert.equal(report.seven_day_acceptance_pass,false);
});
test('proxy-generated 502, missing status, malformed journal and no traffic block acceptance',()=>{
 assert.equal(verifyIngress([...beats,record({DownstreamStatus:502})],options).checks.no_proxy_or_origin_5xx,false);
 assert.equal(verifyIngress([...beats,record({DownstreamStatus:0})],options).checks.all_responses_have_http_status,false);
 assert.equal(verifyIngress([...good,{type:'ingress',data:{}}],options).checks.valid_journal_records,false);
 assert.equal(verifyIngress(beats,options).checks.has_routed_post_responses,false);
 const badHost=record({},raw.StartUTC,{host:'vector1',containerId:cid});
 assert.equal(badHost,undefined);
});
test('4xx is reported for review while lifecycle evidence handles application failures',()=>{
 const report=verifyIngress([...beats,record({DownstreamStatus:400})],options);
 assert.equal(report.four_xx,1);assert.equal(report.ingress_response_checks_pass,true);
});
test('gaps, restarts, wrong host, missing fences and unavailable proxies fail coverage',()=>{
 assert.equal(verifyIngress(good.filter(r=>r.type!=='collector.heartbeat'||r.at< '2026-10-12T00:00:00Z'||r.at>'2026-10-13T00:00:00Z'),options).checks.no_heartbeat_gaps,false);
 assert.equal(verifyIngress(good.filter(r=>r.at!==start),options).checks.heartbeat_fences_complete,false);
 for(const added of [{type:'collector.started',at:raw.StartUTC,host:'abio'},{type:'collector.problem',at:raw.StartUTC,host:'abio'}])assert.equal(verifyIngress([...good,added],options).ingress_response_checks_pass,false);
 assert.equal(verifyIngress([...good,{type:'collector.heartbeat',at:raw.StartUTC,host:'abio',sources:[{host:'abio',containerId:cid,running:false}]}],options).checks.proxy_running_through_window,false);
 assert.equal(verifyIngress(good,{...options,host:'vector1'}).checks.valid_journal_records,false);
 assert.equal(verifyIngress(good,{...options,now:Date.parse(start)}).checks.window_and_observed_drain_closed,false);
});
test('late finishes require coverage fences through observed drain',()=>{
 const late=record({StartUTC:'2026-10-18T11:59:59.000Z'},'2026-10-18T12:00:05.000Z');
 assert.equal(verifyIngress([...beats,late],{...options,now:Date.parse(end)+10000}).checks.heartbeat_fences_complete,false);
 const fence={...beats.at(-1),at:'2026-10-18T12:00:06.000Z'};
 assert.equal(verifyIngress([...beats,late,fence],{...options,now:Date.parse(end)+10000}).ingress_response_checks_pass,true);
});
test('real child-stream collection survives proxy rotation and deduplicates replay',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ingress-collector-')),evidence=join(dir,'evidence'),state=join(dir,'state'),docker=join(dir,'docker');
 writeFileSync(state,'first');
 writeFileSync(docker,`#!/usr/bin/env node
import {readFileSync} from 'node:fs';
const args=process.argv.slice(2),last=args.at(-1);
if(args[0]==='inspect')console.log(JSON.stringify({containerId:readFileSync(process.env.FAKE_STATE,'utf8')==='first'?'${cid}':'${rotated}',startedAt:'${start}',running:true}));
else{const raw=${JSON.stringify(raw)};if(last==='${rotated}')raw.DownstreamStatus=502;console.log(raw.StartUTC+' '+JSON.stringify({...raw,RequestPath:'private-path',msg:'private-logger-message',Cookie:'private-cookie'}));console.error('unrelated private stderr');setInterval(()=>{},1000);}
`);chmodSync(docker,0o700);
 const launch=()=>spawn(process.execPath,['--input-type=module','-e',`import {collectIngress} from ${JSON.stringify(new URL('./ingress-collect.mjs',import.meta.url).href)};await collectIngress(${JSON.stringify(evidence)},${JSON.stringify(start)},'abio',{pollMs:25});`],{env:{...process.env,PATH:`${dir}:${process.env.PATH}`,FAKE_STATE:state},stdio:'ignore'});
 const journal=()=>{try{return readFileSync(join(evidence,'events.ndjson'),'utf8').split('\n').filter(Boolean).map(JSON.parse);}catch{return[];}};
 const wait=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('Fake ingress collector did not reach expected state');};
 const stop=child=>new Promise(resolve=>{child.once('close',resolve);child.kill('SIGTERM');});
 let child=launch();
 try{await wait(()=>journal().some(r=>r.type==='ingress'));writeFileSync(state,'second');await wait(()=>journal().some(r=>r.type==='ingress'&&r.source.containerId===rotated&&r.data.status===502));await stop(child);const count=journal().filter(r=>r.type==='ingress').length;child=launch();await wait(()=>journal().filter(r=>r.type==='collector.started').length===2);await new Promise(resolve=>setTimeout(resolve,200));await stop(child);assert.equal(journal().filter(r=>r.type==='ingress').length,count);assert.equal(readFileSync(join(evidence,'events.ndjson'),'utf8').includes('private'),false);assert.ok(journal().some(r=>r.type==='collector.heartbeat'));}finally{child.kill('SIGKILL');rmSync(dir,{recursive:true,force:true});}
});
