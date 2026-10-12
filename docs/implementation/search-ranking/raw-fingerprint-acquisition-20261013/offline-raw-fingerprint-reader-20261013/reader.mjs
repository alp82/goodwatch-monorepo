import http from 'node:http';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {once} from 'node:events';
export const PLAN_SHA256='9442eb86a853abb71dccf456337356d15cc5eacbed9541e8289767f634711234';
const MAX_INPUT=8*1024*1024,MAX_CALL_BYTES=1024*1024,MAX_TOTAL_BYTES=64*1024*1024,MAX_OUTPUT_BYTES=64*1024*1024;
const fail=reason=>{const e=new Error(reason);e.fixedReason=reason;throw e;};
const digest=b=>createHash('sha256').update(b).digest('hex');
function endpoint(env){
 const first=String(env.CRATE_HOSTS??'').split(',')[0].trim();if(!first||/[\s\r\n]/.test(first))fail('crate_endpoint_invalid');
 let url;try{url=new URL(first.includes('://')?first:`http://${first}`);}catch{fail('crate_endpoint_invalid');}
 if(url.protocol!=='http:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!/^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/.test(url.hostname))fail('crate_endpoint_invalid');
 const configured=env.CRATE_PORT===undefined?'4200':String(env.CRATE_PORT);if(!/^\d{1,5}$/.test(configured)||Number(configured)<1||Number(configured)>65535)fail('crate_endpoint_invalid');if(!url.port)url.port=configured;
 if(typeof env.CRATE_USER!=='string'||typeof env.CRATE_PASS!=='string')fail('crate_credentials_missing');
 return {url:new URL('/_sql',url),auth:'Basic '+Buffer.from(env.CRATE_USER+':'+env.CRATE_PASS).toString('base64')};
}
export function validatePlan(raw){
 if(raw.length>MAX_INPUT||digest(raw)!==PLAN_SHA256)fail('plan_hash_changed');let p;try{p=JSON.parse(raw);}catch{fail('plan_json_invalid');}
 if(p.pointCount!==42934||p.batchCount!==87||p.batches.length!==87||p.keyOrder.length!==74||new Set(p.keyOrder).size!==74||p.pointOrder.length!==42934)fail('plan_shape_invalid');
 const ordered=new Map(),seen=new Set();for(const [row,e]of p.pointOrder.entries()){const base=e.mediaType==='movie'?1e12:e.mediaType==='show'?2e12:fail('point_mapping_invalid');if(!Number.isSafeInteger(e.tmdbId)||e.tmdbId<=0||e.tmdbId>=1e12||e.pointId!==base+e.tmdbId||seen.has(e.pointId))fail('point_mapping_invalid');seen.add(e.pointId);ordered.set(e.mediaType+':'+e.tmdbId,{...e,indexRow:row});}
 const batchSeen=new Set();for(const [i,b]of p.batches.entries()){if(b.ordinal!==i+1||!['movie','show'].includes(b.table)||b.stmt!==p.allowedStatements[b.table]||b.args.length!==1||!Array.isArray(b.args[0])||b.args[0].length<1||b.args[0].length>500)fail('batch_shape_invalid');for(const id of b.args[0]){const k=b.table+':'+id;if(!ordered.has(k)||batchSeen.has(k))fail('batch_subset_invalid');batchSeen.add(k);}}
 if(batchSeen.size!==42934)fail('batch_coverage_invalid');return {p,ordered};
}
function request(config,body,timeoutMs){return new Promise((resolve,reject)=>{
 let done=false,bytes=0,chunks=[],timer;const refuse=reason=>{if(done)return;done=true;clearTimeout(timer);req.destroy();const e=new Error(reason);e.fixedReason=reason;reject(e);};
 const req=http.request(config.url,{method:'POST',agent:false,headers:{Authorization:config.auth,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Connection':'close'}},res=>{
  if(res.statusCode!==200){res.resume();refuse('sql_http_refused');return;}
  res.on('data',chunk=>{bytes+=chunk.length;if(bytes>MAX_CALL_BYTES){refuse('response_bytes_bound');return;}chunks.push(chunk);});
  res.on('aborted',()=>refuse('response_incomplete'));res.on('error',()=>refuse('response_incomplete'));res.on('end',()=>{if(done)return;done=true;clearTimeout(timer);resolve({raw:Buffer.concat(chunks),bytes});});
 });req.on('error',()=>refuse('sql_transport_failed'));timer=setTimeout(()=>refuse('sql_deadline'),timeoutMs);req.end(body);
 });}
export async function runPlan(raw,{env=process.env,emit=async()=>{},clock=()=>performance.now()}={}){
 const started=clock(),counts={calls:0,responseBytes:0,outputBytes:0,returnedRows:0,missingRows:0,validRows:0,invalidRows:0},reasons={},currentEligibility={adultTrue:0,adultNull:0,votesBelow2000:0,votesNull:0},batches=[],seen=new Set();let plan=null,terminal;
 const send=async frame=>{const line=JSON.stringify(frame)+'\n';counts.outputBytes+=Buffer.byteLength(line);if(counts.outputBytes>MAX_OUTPUT_BYTES)fail('output_bytes_bound');let timer;try{await Promise.race([emit(line),new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error('output_deadline');e.fixedReason='global_deadline';reject(e);},deadline());})]);}finally{clearTimeout(timer);}deadline();};
 const deadline=()=>{const remaining=300000-(clock()-started);if(!Number.isFinite(remaining)||remaining<=0)fail('global_deadline');return remaining;};
 try{
  const {p,ordered}=validatePlan(raw);plan=p;const config=endpoint(env);await send({kind:'header',schema:'public-catalog-fingerprint-stream.v1',planSha256:PLAN_SHA256,indexBuildId:p.indexBuildId,indexManifestSha256:p.indexManifestSha256,pointCount:42934,keyOrder:p.keyOrder,currentCatalogNotHistoricalSnapshot:true});
  const columns=['tmdb_id',...p.keyOrder.map(k=>`fingerprint_scores['${k}']`),'dna_updated_at','adult','goodwatch_overall_score_voting_count'];
  for(const b of p.batches){
   deadline();if(counts.calls>=120)fail('call_bound');const expected=new Set(b.args[0]),body=JSON.stringify({stmt:b.stmt,args:b.args});counts.calls++;const t=clock();const response=await request(config,body,Math.min(10000,deadline()));deadline();counts.responseBytes+=response.bytes;if(counts.responseBytes>MAX_TOTAL_BYTES)fail('total_response_bytes_bound');let result;try{result=JSON.parse(response.raw);}catch{fail('response_json_invalid');}
   if(!result||typeof result!=='object'||!Array.isArray(result.cols)||JSON.stringify(result.cols)!==JSON.stringify(columns)||!Array.isArray(result.rows)||result.rows.length>expected.size||!Number.isInteger(result.rowcount)||result.rowcount!==result.rows.length||result.error)fail('response_schema_invalid');
   const batchRows=new Set();
   for(const row of result.rows){if(!Array.isArray(row)||row.length!==78||!Number.isSafeInteger(row[0])||!expected.has(row[0])||batchRows.has(row[0]))fail('response_subset_invalid');batchRows.add(row[0]);const key=b.table+':'+row[0],identity=ordered.get(key);if(seen.has(key))fail('response_duplicate');seen.add(key);counts.returnedRows++;if(counts.returnedRows>42934)fail('row_bound');const scores=row.slice(1,75),dnaUpdatedAt=row[75],adult=row[76],votes=row[77];if(!(dnaUpdatedAt===null||(Number.isSafeInteger(dnaUpdatedAt)&&dnaUpdatedAt>=0))||!(adult===null||typeof adult==='boolean')||!(votes===null||(typeof votes==='number'&&Number.isFinite(votes)&&votes>=0)))fail('metadata_invalid');
    let omission=null;if(scores.some(v=>v===null))omission='missing_component';else if(scores.some(v=>typeof v!=='number'||!Number.isFinite(v)||!Number.isInteger(v)))omission='invalid_component';else if(scores.some(v=>v<0||v>10))omission='out_of_range';else if(scores.every(v=>v===0))omission='zero_norm';
    if(omission){counts.invalidRows++;reasons[omission]=(reasons[omission]??0)+1;}else counts.validRows++;
    if(adult===true)currentEligibility.adultTrue++;if(adult===null)currentEligibility.adultNull++;if(votes===null)currentEligibility.votesNull++;else if(votes<2000)currentEligibility.votesBelow2000++;
    await send({kind:'row',indexRow:identity.indexRow,pointId:identity.pointId,mediaType:b.table,tmdbId:row[0],scores:scores.map(v=>typeof v==='number'&&Number.isFinite(v)?v:null),validFingerprint:omission===null,omissionReason:omission,dnaUpdatedAt,adult,votes});
   }
   for(const id of expected)if(!batchRows.has(id)){counts.missingRows++;const e=ordered.get(b.table+':'+id);await send({kind:'missing-row',indexRow:e.indexRow,pointId:e.pointId,mediaType:b.table,tmdbId:id,validFingerprint:false,omissionReason:'catalog_row_missing'});}
   batches.push({ordinal:b.ordinal,table:b.table,requestedIds:expected.size,returnedRows:result.rows.length,responseBytes:response.bytes,responseSha256:digest(response.raw),elapsedMs:clock()-t});
  }
  deadline();if(counts.calls!==87||counts.returnedRows+counts.missingRows!==42934)fail('terminal_accounting_invalid');terminal={kind:'terminal',schema:'public-catalog-fingerprint-terminal.v1',status:'complete-acquisition-with-explicit-omissions',complete:true,planSha256:PLAN_SHA256,...counts,omissionCounts:reasons,currentEligibility,batches,elapsedMs:clock()-started,sqlWrites:0,retries:0,currentCatalogNotHistoricalSnapshot:true,historicalRankParity:false};
 }catch(e){terminal={kind:'terminal',schema:'public-catalog-fingerprint-terminal.v1',status:'failed-or-incomplete',complete:false,reason:e?.fixedReason??'reader_guard_or_runtime_failure',planSha256:PLAN_SHA256,...counts,omissionCounts:reasons,currentEligibility,batches,elapsedMs:clock()-started,sqlWrites:0,retries:0,historicalRankParity:false};}
 // Terminal is separately bounded so even an output-bound refusal retains a small final failure receipt.
 const line=JSON.stringify(terminal)+'\n';if(Buffer.byteLength(line)>128*1024)fail('terminal_bytes_bound');await emit(line);return terminal;
}
export async function main(){let chunks=[],bytes=0;for await(const b of process.stdin){bytes+=b.length;if(bytes>MAX_INPUT){process.exitCode=1;throw Error('input_bytes_bound');}chunks.push(b);}const terminal=await runPlan(Buffer.concat(chunks),{emit:async line=>{if(!process.stdout.write(line))await once(process.stdout,'drain');}});if(!terminal.complete)process.exitCode=1;}
