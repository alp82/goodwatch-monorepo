import http from 'node:http';
import https from 'node:https';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const PLAN_SHA='a7264d2519d7a68275c4600fc57c48eda93896c389cf6432efb6c087cefc3600';
const COLLECTION='media_fingerprint_v1', VECTOR='terms_bm25f_v1';
export const LIMITS=Object.freeze({requestMs:10000,globalMs:600000,responseBytes:16777216,totalResponseBytes:1073741824,outputBytes:2147483648,entriesPerPoint:32768,totalEntries:134217728});
const sha=b=>createHash('sha256').update(b).digest('hex');
const refuse=reason=>{const e=new Error(reason);e.reason=reason;throw e;};
export function readPlan(bytes){
 if(bytes.length>8*1024*1024)refuse('plan_bound');
 if(sha(bytes)!==PLAN_SHA)refuse('plan_hash');
 let p;try{p=JSON.parse(bytes);}catch{refuse('plan_json');}
 if(p.schema!=='offline-bm25-readonly-plan.v2'||p.collection!==COLLECTION||p.vector!==VECTOR||p.ids.length!==42934||new Set(p.ids).size!==42934||p.ids.some(x=>!Number.isSafeInteger(x)||x<=0)||p.batchSize!==500||p.pointRequests!==86||p.totalRequestsMax!==88)refuse('plan_shape');
 return p;
}
export function endpoint(raw){
 let u;try{u=new URL(raw);}catch{refuse('endpoint_refused');}
 if(!['http:','https:'].includes(u.protocol)||!u.hostname||u.username||u.password||u.search||u.hash||!['','/'].includes(u.pathname))refuse('endpoint_refused');
 if(u.port==='6334')u.port='6333';
 return u;
}
function remaining(state){const ms=state.deadline-performance.now();if(ms<=0)refuse('global_deadline');return ms;}
export function requestJson(origin,path,method,body,state,apiKey=''){
 const globalRemaining=remaining(state),globalLimited=globalRemaining<=state.limits.requestMs;
 const budget=Math.min(state.limits.requestMs,globalRemaining);
 return new Promise((resolve,reject)=>{
  const fail=r=>{const e=new Error(r);e.reason=r;return e;};
  let done=false,timer,req,res;const chunks=[];let bytes=0;
  const finish=(err,value)=>{if(done)return;done=true;clearTimeout(timer);if(err){res?.destroy();req?.destroy();reject(err);}else resolve(value);};
  const transport=origin.protocol==='https:'?https:http;
  req=transport.request({protocol:origin.protocol,hostname:origin.hostname,port:origin.port,path,method,agent:false,headers:{'Content-Type':'application/json',...(apiKey?{'api-key':apiKey}:{}),...(body?{'Content-Length':Buffer.byteLength(body)}:{})}},r=>{
   res=r;
   if(r.statusCode!==200){finish(fail(r.statusCode>=300&&r.statusCode<400?'redirect_refused':'http_status'));return;}
   r.on('data',chunk=>{bytes+=chunk.length;state.responseBytes+=chunk.length;
    if(bytes>state.limits.responseBytes){finish(fail('response_bound'));return;}
    if(state.responseBytes>state.limits.totalResponseBytes){finish(fail('total_response_bound'));return;}
    chunks.push(chunk);
   });
   r.on('aborted',()=>finish(fail('response_incomplete')));
   r.on('error',()=>finish(fail('response_incomplete')));
   r.on('end',()=>{if(done)return;try{remaining(state);}catch(e){finish(e);return;}
    let value;try{value=JSON.parse(Buffer.concat(chunks,bytes).toString('utf8'));}catch{finish(fail('response_json'));return;}
    finish(null,value);
   });
  });
  req.on('error',()=>finish(fail('request_failed')));
  timer=setTimeout(()=>finish(fail(globalLimited?'global_deadline':'request_deadline')),budget);
  req.end(body);
 });
}
export function collectionProjection(raw){
 if(!raw||raw.status!=='ok'||!raw.result||typeof raw.result!=='object')refuse('collection_shape');
 const r=raw.result,s=r.config?.params?.sparse_vectors?.[VECTOR];
 if(!s||typeof s!=='object'||Array.isArray(s))refuse('collection_vector_missing');
 if(s.modifier!==undefined&&s.modifier!==null&&s.modifier!=='none')refuse('collection_modifier');
 const count=r.points_count;if(!Number.isSafeInteger(count)||count<0||typeof r.status!=='string')refuse('collection_shape');
 // Digest only an explicitly public projection, never arbitrary collection configuration.
 const projection={collection:COLLECTION,vector:VECTOR,modifier:s.modifier??null,pointsCount:count,status:r.status,shards:r.config?.params?.shard_number??null,replication:r.config?.params?.replication_factor??null};
 for(const k of ['shards','replication'])if(projection[k]!==null&&(!Number.isSafeInteger(projection[k])||projection[k]<1))refuse('collection_shape');
 return {...projection,configurationProjectionSha256:sha(JSON.stringify(projection))};
}
export function classifyVector(vector,limits=LIMITS){
 if(vector===undefined)return{presence:'omitted',valid:false,reason:'vector_omitted'};
 if(vector===null)return{presence:'null',valid:false,reason:'vector_null'};
 const bad=reason=>({presence:'present',valid:false,reason});
 if(typeof vector!=='object'||Array.isArray(vector)||Object.keys(vector).sort().join(',')!=='indices,values'||!Array.isArray(vector.indices)||!Array.isArray(vector.values)||vector.indices.length!==vector.values.length)return bad('vector_shape');
 if(vector.indices.length>limits.entriesPerPoint)refuse('vector_entry_bound');
 let previous=-1;for(const x of vector.indices){if(!Number.isInteger(x)||x<0||x>4294967295||x<=previous)return bad('vector_indices');previous=x;}
 const values=[];
 for(const x of vector.values){
  if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>1)return bad('vector_values');
  const f=Math.fround(x);if(!Number.isFinite(f)||(x>0&&f===0))return bad('vector_float32_range');values.push(f);
 }
 // Rust may serialize f32 using its shortest round-tripping decimal. Preserve that parsed decimal as observed,
 // and reconstruct binary32 explicitly; x===Math.fround(x) would incorrectly reject 0.33333334.
 return {presence:'present',valid:true,empty:vector.indices.length===0,reason:null,indices:vector.indices,observedValues:vector.values,float32Values:values};
}
export function batchRows(raw,ids,offset,state){
 if(!raw||raw.status!=='ok'||!Array.isArray(raw.result))refuse('points_shape');
 const expected=new Set(ids),seen=new Set(),found=new Map();
 for(const p of raw.result){
  if(!p||typeof p!=='object'||!Number.isSafeInteger(p.id)||!expected.has(p.id)||seen.has(p.id))refuse('point_identity');seen.add(p.id);
  if(p.payload!==undefined&&p.payload!==null)refuse('unexpected_payload');
  if(p.vector!==undefined&&p.vector!==null&&(typeof p.vector!=='object'||Array.isArray(p.vector)||Object.keys(p.vector).some(k=>k!==VECTOR)))refuse('unexpected_vector');
  const v=classifyVector(p.vector===null?null:p.vector?.[VECTOR],state.limits);
  if(v.valid){state.entries+=v.indices.length;if(state.entries>state.limits.totalEntries)refuse('total_entry_bound');}
  found.set(p.id,v);
 }
 return ids.map((id,i)=>({kind:'point',row:offset+i,id,...(found.get(id)??{presence:'point-missing',valid:false,reason:'point_missing'})}));
}
export async function writeFrame(output,frame,state){
 remaining(state);const bytes=Buffer.from(JSON.stringify(frame)+'\n');
 if(state.outputBytes+bytes.length>state.limits.outputBytes)refuse('output_bound');
 state.outputBytes+=bytes.length;
 await new Promise((resolve,reject)=>{
  let done=false,timer,returned=false,callbackDone=false,drainDone=false;
  const finish=e=>{if(done)return;done=true;clearTimeout(timer);output.removeListener('drain',drain);
   // A Writable callback error is followed by its error event. Keep this one-shot sanitized listener on refusal
   // so late sink failure cannot escape after the callback rejects. This is terminal; no next acquisition write.
   if(!e)output.removeListener('error',error);e?reject(e):resolve();};
  const error=()=>finish(Object.assign(new Error('output_failed'),{reason:'output_failed'}));
  const check=()=>{if(returned&&callbackDone&&drainDone)finish();};
  const drain=()=>{drainDone=true;check();};output.once('error',error);
  timer=setTimeout(()=>finish(Object.assign(new Error('global_deadline'),{reason:'global_deadline'})),remaining(state));
  try{drainDone=output.write(bytes,e=>{if(e){error();return;}callbackDone=true;check();});returned=true;
   if(!drainDone)output.once('drain',drain);check();}catch{error();}
 });
 remaining(state);
}
export async function acquire(plan,{origin,apiKey='',output,limits=LIMITS,readerSha256='local-fixture',absoluteDeadline}={}){
 const started=performance.now();const state={limits,deadline:absoluteDeadline??started+limits.globalMs,responseBytes:0,outputBytes:0,entries:0};
 let requests=0,rows=0,valid=0,missing=0,invalid=0,empty=0;
 await writeFrame(output,{kind:'header',schema:'offline-bm25-readonly.v1',planSha256:PLAN_SHA,readerSha256,collection:COLLECTION,vector:VECTOR,expectedRows:plan.ids.length,float32Reconstruction:'Math.fround(observedDecimal)',historicalSnapshotEqualityProven:false},state);
 const before=collectionProjection(await requestJson(origin,`/collections/${COLLECTION}`,'GET',undefined,state,apiKey));requests++;
 await writeFrame(output,{kind:'collection-before',observedAt:new Date().toISOString(),...before},state);
 for(let offset=0;offset<plan.ids.length;offset+=500){
  const ids=plan.ids.slice(offset,offset+500);
  const raw=await requestJson(origin,`/collections/${COLLECTION}/points?timeout=8`,'POST',JSON.stringify({ids,with_payload:false,with_vector:[VECTOR]}),state,apiKey);requests++;
  for(const row of batchRows(raw,ids,offset,state)){
   if(row.valid){valid++;if(row.empty)empty++;}else if(['point-missing','omitted','null'].includes(row.presence))missing++;else invalid++;
   await writeFrame(output,row,state);rows++;
  }
 }
 const after=collectionProjection(await requestJson(origin,`/collections/${COLLECTION}`,'GET',undefined,state,apiKey));requests++;
 await writeFrame(output,{kind:'collection-after',observedAt:new Date().toISOString(),...after},state);
 if(before.configurationProjectionSha256!==after.configurationProjectionSha256)refuse('collection_observation_changed');
 await writeFrame(output,{kind:'terminal',schema:'offline-bm25-readonly.v1',complete:true,requests,pointRequests:Math.ceil(plan.ids.length/500),rows,valid,missing,invalid,empty,entries:state.entries,responseBytes:state.responseBytes,outputBytesBeforeTerminal:state.outputBytes,elapsedMs:performance.now()-started,productionWrites:0,searchRequests:0,modelCalls:0,historicalSnapshotEqualityProven:false},state);
 return {requests,rows,valid,missing,invalid,empty};
}
export async function runCli(readerSha256,absoluteDeadline=performance.now()+LIMITS.globalMs){
 const chunks=[];let n=0;const inputTimer=setTimeout(()=>process.stdin.destroy(Object.assign(new Error('global_deadline'),{reason:'global_deadline'})),Math.max(0,absoluteDeadline-performance.now()));
 try{for await(const b of process.stdin){n+=b.length;if(n>8*1024*1024)refuse('plan_bound');chunks.push(b);}}finally{clearTimeout(inputTimer);}
 const plan=readPlan(Buffer.concat(chunks));const origin=endpoint(process.env.QDRANT_URL??'');
 await acquire(plan,{origin,apiKey:process.env.QDRANT_API_KEY??'',output:process.stdout,readerSha256,absoluteDeadline});
}
if(import.meta.url.startsWith('file:')&&process.argv[1]===fileURLToPath(import.meta.url))runCli(sha(readFileSync(fileURLToPath(import.meta.url)))).catch(e=>{
 // A partial stream has no successful terminal/CLI fence. Never append raw HTTP bodies, environment or errors.
 process.stderr.write(JSON.stringify({kind:'refusal',reason:typeof e.reason==='string'?e.reason:'reader_failure',complete:false})+'\n');process.exitCode=1;
});
