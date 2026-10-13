import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {Writable} from 'node:stream';
import {readFileSync} from 'node:fs';
import {acquire,batchRows,classifyVector,collectionProjection,endpoint,LIMITS,PLAN_SHA,readPlan,requestJson,writeFrame} from './reader.mjs';
const vector='terms_bm25f_v1';
const stats=limits=>({limits:{...LIMITS,...limits},deadline:performance.now()+5000,responseBytes:0,outputBytes:0,entries:0});
const metadata={status:'ok',result:{status:'green',points_count:244262,config:{params:{sparse_vectors:{[vector]:{}},shard_number:6,replication_factor:1}}}};
async function fixture(handler,fn){const s=http.createServer(handler);await new Promise(r=>s.listen(0,'127.0.0.1',r));const u=new URL(`http://127.0.0.1:${s.address().port}`);try{await fn(u);}finally{s.closeAllConnections();await new Promise(r=>s.close(r));}}
const json=(res,obj)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(obj));};
const reason=r=>e=>e.reason===r;
function sink(){const frames=[];return{frames,output:new Writable({write(b,_enc,cb){frames.push(JSON.parse(b));cb();}})};}
test('exact immutable42934 ID plan; tamper, bounds and configured endpoint refuse',()=>{
 const b=readFileSync('./PLAN-v2.json'),p=readPlan(b);assert.equal(p.ids.length,42934);assert.equal(Math.ceil(p.ids.length/500),86);assert.throws(()=>readPlan(Buffer.concat([b,Buffer.from(' ')])),reason('plan_hash'));assert.throws(()=>readPlan(Buffer.alloc(8*1024*1024+1)),reason('plan_bound'));
 assert.equal(endpoint('http://localhost:6334').port,'6333');for(const u of ['','ftp://localhost','http://a:secret@localhost','http://localhost/x','http://localhost?q=1'])assert.throws(()=>endpoint(u),reason('endpoint_refused'));
});
test('short Rust f32 decimals preserved and explicitly reconstructed; empty valid',()=>{
 const v=classifyVector({indices:[1,2],values:[0.33333334,0.99999994]});assert.equal(v.valid,true);assert.equal(v.observedValues[0],0.33333334);assert.equal(classifyVector({indices:[1],values:[0]}).valid,true);assert.equal(v.float32Values[0],Math.fround(0.33333334));assert.notEqual(v.observedValues[0],v.float32Values[0]);assert.deepEqual(classifyVector({indices:[],values:[]}),{presence:'present',valid:true,empty:true,reason:null,indices:[],observedValues:[],float32Values:[]});
});
test('malformed numeric/boolean/underflow/nonfinite/negative and sparse IDs invalid, never zero-valid',()=>{
 for(const x of [true,-1,Infinity,NaN,1.1,1e-50,3.5e38])assert.equal(classifyVector({indices:[1],values:[x]}).valid,false);
 for(const indices of [[1,1],[2,1],[-1],[4294967296],[true],[1.2]])assert.equal(classifyVector({indices,values:indices.map(()=>0.5)}).valid,false);
 assert.equal(classifyVector({indices:[1],values:[]}).valid,false);assert.equal(classifyVector({indices:[1],values:[0.5],extra:1}).valid,false);
 assert.throws(()=>classifyVector({indices:[1,2],values:[0.1,0.2]},{entriesPerPoint:1}),reason('vector_entry_bound'));
});
test('batch exact alignment, missing/null/omitted classifications and unexpected/duplicate points',()=>{
 const rows=batchRows({status:'ok',result:[{id:4,vector:{[vector]:{indices:[],values:[]}}},{id:2,vector:null},{id:3}]},[1,2,3,4],10,stats());assert.deepEqual(rows.map(x=>[x.row,x.id,x.presence,x.valid]),[[10,1,'point-missing',false],[11,2,'null',false],[12,3,'omitted',false],[13,4,'present',true]]);
 for(const result of [[{id:1},{id:1}],[{id:5}],[{id:true}]])assert.throws(()=>batchRows({status:'ok',result},[1,2],0,stats()),reason('point_identity'));
 assert.throws(()=>batchRows({status:'ok',result:[{id:1,payload:{private:'never printed'}}]},[1],0,stats()),reason('unexpected_payload'));
 assert.throws(()=>batchRows({status:'ok',result:[{id:1,vector:{secret:[1]}}]},[1],0,stats()),reason('unexpected_vector'));
 assert.throws(()=>batchRows({status:'ok',result:[{id:1,vector:{[vector]:{indices:[1],values:[0.5]}}}]},[1],0,stats({totalEntries:0})),reason('total_entry_bound'));
});
test('collection schema and IDF modifier refuse; only explicit public projection emitted',()=>{
 const p=collectionProjection({...metadata,result:{...metadata.result,secret:'not retained'}});assert.equal(JSON.stringify(p).includes('secret'),false);
 assert.throws(()=>collectionProjection({...metadata,result:{...metadata.result,config:{params:{sparse_vectors:{}}}}}),reason('collection_vector_missing'));
 assert.throws(()=>collectionProjection({...metadata,result:{...metadata.result,config:{params:{sparse_vectors:{[vector]:{modifier:'idf'}}}}}}),reason('collection_modifier'));
});
test('real loopback all86 serial fixed requests and bounded output, authentic plan terminal/EOF',async()=>{
 const p=readPlan(readFileSync('./PLAN-v2.json'));let gets=0,posts=0,active=0,maxActive=0,rows=0,terminal;
 const output=new Writable({write(b,_e,cb){const f=JSON.parse(b);if(f.kind==='point')rows++;if(f.kind==='terminal')terminal=f;cb();}});
 await fixture((req,res)=>{active++;maxActive=Math.max(maxActive,active);res.on('finish',()=>active--);assert.equal(req.headers['api-key'],'fixture-key');
  if(req.method==='GET'){assert.equal(req.url,'/collections/media_fingerprint_v1');gets++;json(res,metadata);return;}
  assert.equal(req.method,'POST');assert.equal(req.url,'/collections/media_fingerprint_v1/points?timeout=8');let data='';req.on('data',b=>data+=b);req.on('end',()=>{const q=JSON.parse(data);assert.deepEqual(Object.keys(q).sort(),['ids','with_payload','with_vector']);assert.equal(q.with_payload,false);assert.deepEqual(q.with_vector,[vector]);assert.ok(q.ids.length<=500);assert.deepEqual(q.ids,p.ids.slice(posts*500,posts*500+500));posts++;json(res,{status:'ok',result:q.ids.map(id=>({id,vector:{[vector]:{indices:[7],values:[0.33333334]}}}))});});
 },async origin=>{const result=await acquire(p,{origin,apiKey:'fixture-key',output});assert.equal(result.rows,42934);});
 assert.equal(gets,2);assert.equal(posts,86);assert.equal(maxActive,1);assert.equal(rows,42934);assert.equal(terminal.complete,true);assert.equal(terminal.requests,88);assert.equal(terminal.historicalSnapshotEqualityProven,false);
});
test('redirect/error/truncated EOF/invalid JSON never follows or completes',async()=>{
 for(const mode of ['redirect','status','truncated','json'])await fixture((req,res)=>{
  if(mode==='redirect'){res.writeHead(302,{location:'http://unreachable.invalid'});res.end();}
  if(mode==='status'){res.writeHead(500);res.end('private body');}
  if(mode==='truncated'){res.writeHead(200,{'Content-Length':100});res.end('{}');}
  if(mode==='json')res.end('{oops');
 },async origin=>{const expected={redirect:'redirect_refused',status:'http_status',truncated:'response_incomplete',json:'response_json'}[mode];await assert.rejects(requestJson(origin,'/','GET',undefined,stats({requestMs:100})),reason(expected));});
});
test('response and aggregate response byte caps reject full HTTP bodies',async()=>{
 for(const [limits,r]of[[{responseBytes:2},'response_bound'],[{totalResponseBytes:2},'total_response_bound']])await fixture((_req,res)=>res.end('{"value":123}'),async origin=>assert.rejects(requestJson(origin,'/','GET',undefined,stats(limits)),reason(r)));
});
test('dripping body receives no fresh inactivity lease; global remaining clamps request',async()=>{
 for(const global of [false,true])await fixture((_req,res)=>{res.writeHead(200);res.write('{');const t=setInterval(()=>res.write(' '),5);res.on('close',()=>clearInterval(t));},async origin=>{const s=stats({requestMs:100});s.deadline=performance.now()+(global?30:5000);const start=performance.now();await assert.rejects(requestJson(origin,'/','GET',undefined,s),reason(global?'global_deadline':'request_deadline'));assert.ok(performance.now()-start<500);});
});
test('output cap separate from responses; real backpressure drains before next frame',async()=>{
 const s=stats({outputBytes:2});await assert.rejects(writeFrame(new Writable({write(_b,_e,cb){cb();}}),{value:1},s),reason('output_bound'));
 let flushed=false;const delayed=new Writable({highWaterMark:1,write(_b,_e,cb){setTimeout(()=>{flushed=true;cb();},30);}});const state=stats();await writeFrame(delayed,{value:1},state);assert.equal(flushed,true);
 const stuck=new Writable({highWaterMark:1,write(){}}),short=stats();short.deadline=performance.now()+30;await assert.rejects(writeFrame(stuck,{value:1},short),reason('global_deadline'));stuck.destroy();
});
test('partial acquisition has no terminal when collection changes or bounds expire',async()=>{
 for(const mode of ['change','output']){let gets=0;const {frames,output}=sink();await fixture((req,res)=>{if(req.method==='GET'){gets++;json(res,mode==='change'&&gets===2?{...metadata,result:{...metadata.result,points_count:244263}}:metadata);}else json(res,{status:'ok',result:[]});},async origin=>{await assert.rejects(acquire({ids:[1000000000001]},{origin,output,limits:{...LIMITS,...(mode==='output'?{outputBytes:20}:{})}}),reason(mode==='output'?'output_bound':'collection_observation_changed'));});assert.equal(frames.some(x=>x.kind==='terminal'),false);}
});

test('true-return async Writable failure is sanitized before completion, not unhandled',async()=>{
 let accepted;
 const output=new Writable({highWaterMark:65536,write(_b,_e,cb){setTimeout(()=>cb(new Error('private sink error body')),10);}});
 const original=output.write.bind(output);output.write=(...args)=>{accepted=original(...args);return accepted;};
 await assert.rejects(writeFrame(output,{value:1},stats()),reason('output_failed'));
 await new Promise(r=>setTimeout(r,20));assert.equal(accepted,true);assert.equal(output.destroyed,true);
});
