import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
export function digest(bytes){return createHash('sha256').update(bytes).digest('hex')}
export function frameObservation(frame,elapsed,record){
 if(!frame || typeof frame!=='object' || Array.isArray(frame))throw Error('frame_schema');
 if(frame.kind==='reading'){record.readingFrames++;return}
 if(frame.kind==='error'){record.errorFrames++;record.failed=true;return}
 if(frame.kind!=='provisional'&&frame.kind!=='batch')throw Error('frame_kind');
 const b=frame.batch;
 if(!b || !Array.isArray(b.rows) || !Array.isArray(b.people??[]) || !Array.isArray(b.errors??[]))throw Error('batch_schema');
 if((b.errors??[]).some(x=>typeof x!=='string')||b.rows.some(r=>!r||typeof r.key!=='string'||!/^(movie|show):[1-9][0-9]*$/.test(r.key)||!Number.isSafeInteger(Number(r.key.split(':')[1])))||(b.people??[]).some(p=>!p||!Number.isSafeInteger(p.id)||p.id<=0))throw Error('batch_identity');
 for(const key of ['chargedNano','elapsedMs'])if(key in b&&(typeof b[key]!=='number'||!Number.isFinite(b[key])||b[key]<0))throw Error('batch_numeric');
 for(const key of ['pendingRanking','pendingTitleLookup'])if(key in b&&typeof b[key]!=='boolean')throw Error('batch_pending');
 const useful=frame.kind==='batch'||b.rows.length+(b.people?.length??0)>0;
 if(useful&&record.firstUsableMs===null)record.firstUsableMs=elapsed;
 const obs={kind:frame.kind,elapsedMs:elapsed,rows:b.rows.length,people:b.people?.length??0,warnings:b.errors??[],warningCount:(b.errors??[]).length,rowIdentities:b.rows.map(r=>typeof r.key==='string'&&/^(movie|show):[0-9]+$/.test(r.key)?r.key:null),peopleIds:(b.people??[]).map(p=>Number.isSafeInteger(p.id)?p.id:null),chargedNano:b.chargedNano??null,chargedNanoObserved:'chargedNano' in b,serverElapsedMs:b.elapsedMs??null,serverElapsedObserved:'elapsedMs' in b,pendingRanking:b.pendingRanking??null,pendingTitleLookup:b.pendingTitleLookup??null};
 record.frames.push(obs);
 if(frame.kind==='batch'){if(record.completionMs!==null)throw Error('duplicate_completion');record.completionMs=elapsed;record.finalRows=b.rows.length;record.finalPeople=b.people?.length??0}
}
export async function probe(c,fetcher=fetch){
 const record={tag:c.tag,firstUsableMs:null,completionMs:null,lifetimeMs:null,status:null,readingFrames:0,errorFrames:0,failed:false,frames:[],finalRows:null,finalPeople:null,historyWriteObserved:false};
 const start=performance.now();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
 let reader;
 try{
  const response=await fetcher('https://goodwatch.app/api/combined-search',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Origin:'https://goodwatch.app'},body:JSON.stringify(c.body),signal:controller.signal});record.status=response.status;
  if(response.status!==200 || !response.body)throw Error('http_refusal');
  reader=response.body.getReader();let pending='';let bytes=0;const decoder=new TextDecoder('utf-8',{fatal:true});
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8*1024*1024)throw Error('response_bound');pending+=decoder.decode(value,{stream:true});if(pending.length>2*1024*1024)throw Error('line_bound');let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);frameObservation(JSON.parse(line),performance.now()-start,record)}}
  pending+=decoder.decode();if(pending.length)throw Error('incomplete_eof');if(record.completionMs===null)record.failed=true;
 }catch(e){record.failed=true;record.refusal=controller.signal.aborted?'client_deadline':(['frame_schema','batch_schema','batch_identity','batch_numeric','batch_pending','frame_kind','duplicate_completion','response_bound','line_bound','http_refusal','incomplete_eof'].includes(e.message)?e.message:'transport_or_parse_refusal')}
 finally{clearTimeout(timer);controller.abort();if(reader)await reader.cancel().catch(()=>{});record.lifetimeMs=performance.now()-start}
 return record;
}
async function main(){
 const planPath=new URL('./plan.json',import.meta.url);const bytes=readFileSync(planPath);const plan=JSON.parse(bytes);const planSha=digest(bytes);
 if(process.argv[2]!=='--execute-reviewed'){console.log(JSON.stringify({preparedOnly:true,planSha256:planSha,requests:6,executionAuthorized:false}));return}
 const approval=JSON.parse(readFileSync(process.argv[3]));
 if(approval.schema!=='owner-approved-fresh-six-production-probes.v1'||approval.planSha256!==planSha||approval.requests!==6||approval.rolloutVerified!==true||approval.ownerApprovalRecorded!==true||typeof approval.deployedCommit!=='string'||!/^[a-f0-9]{40}$/.test(approval.deployedCommit))throw Error('approval_refused');
 const output=process.argv[4];if(!output)throw Error('output_required');mkdirSync(output,{mode:0o700});
 const save=(name,obj)=>writeFileSync(`${output}/${name}`,JSON.stringify(obj,null,2)+'\n',{flag:'wx',mode:0o600});
 save('intent.json',{planSha256:planSha,approvalSha256:digest(readFileSync(process.argv[3])),sourceSha256:digest(readFileSync(fileURLToPath(import.meta.url))),requests:6,retries:0,consumed:true});
 const results=[];
 for(const c of plan.cases){const r=await probe(c);results.push(r);save(`${c.tag}.json`,r);if(r.failed)break}
 if(results.length!==6||results.some(r=>r.failed))process.exitCode=1;
 save('completion.json',{requestsStarted:results.length,requestsMaximum:6,retries:0,allSixCompleted:results.length===6&&results.every(r=>!r.failed&&r.completionMs!==null),productionAcceptance:false,historyCensusRequired:true});
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(()=>{console.error('probe_preparation_or_execution_refused');process.exitCode=1});
