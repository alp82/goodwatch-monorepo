// Private in-memory diagnostic: stdout is only fixed case tags and numeric/hash summaries.
import {verifyFrozenSources} from './source-freeze.mjs';
import {hasLookup} from './producer-guard.mjs';
import http from 'node:http';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
console.info=()=>{};console.warn=()=>{};console.error=()=>{};
process.env.TYPESAFE_API_KEY='';
globalThis.fetch=async()=>{throw new Error('Diagnostic forbids model/provider network requests')};
verifyFrozenSources(process.env.SOURCE_MANIFEST_SHA256,{producer:true});
const modules=await import('./production.mjs');
const key=Buffer.from(process.env.SEARCH_STORAGE_KEY,'hex');
const normalize=text=>text.normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase().normalize('NFC');
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;return JSON.stringify(v)}
function unseal(text){const b=Buffer.from(text,'base64'),d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8'))}
async function sql(stmt,args=[]){return new Promise((resolve,reject)=>{const req=http.request({host:process.env.CRATE_HOSTS.split(',')[0],port:process.env.CRATE_PORT||4200,path:'/_sql',method:'POST',headers:{authorization:'Basic '+Buffer.from(process.env.CRATE_USER+':'+process.env.CRATE_PASS).toString('base64'),'content-type':'application/json'}},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>{try{const j=JSON.parse(body);if(j.error)throw Error();resolve(j.rows)}catch{reject(Error('SQL diagnostic failed'))}})});req.setTimeout(15000,()=>req.destroy());req.on('error',()=>reject(Error('SQL diagnostic transport failed')));req.end(JSON.stringify({stmt,args}))})}
function setsHash(results){return crypto.createHash('sha256').update(JSON.stringify(results.map(rows=>rows.map(row=>String(row.id)).sort()))).digest('hex')}
function idsHash(results){return crypto.createHash('sha256').update(JSON.stringify(results.map(rows=>rows.map(row=>row.id)))).digest('hex')}
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
const allowedVectors=new Set(['fingerprint_v1','fingerprint_v1_raw','text_en_v1','text_multi_v1','terms_bm25f_v1']);
function signal(q){return{using:allowedVectors.has(q.using)?q.using:'other',limit:typeof q.limit==='number'?q.limit:null,exact:q.params?.exact===true,queryKind:Array.isArray(q.query)?'dense':q.query?.indices?'sparse':typeof q.query==='string'?'profile':'other',filterMust:Array.isArray(q.filter?.must)?q.filter.must.length:0,filterMustNot:Array.isArray(q.filter?.must_not)?q.filter.must_not.length:0,filterShould:Array.isArray(q.filter?.should)?q.filter.should.length:0}}
async function reading(q){const text=normalize(q);for(const mode of [modules.nonEnglish(q)?'native-vector-only':'english','english','native-vector-only']){const language={mode,version:modules.LANGUAGE_VERSION},contract=`d4+/jev-1.13.0/accepted-d4-corrected-v1/${mode}/${modules.LANGUAGE_VERSION}`;const requests=[modules.attributeRequest(text),modules.fingerprintRequest(text)].map(r=>({state:r.state,questions:r.questions,model:'jev-1.13.0'}));const cacheKey=crypto.createHmac('sha256',key).update(canonical({contract,language,requests,text})).digest('hex');const rows=await sql("SELECT ciphertext FROM doc.search_interpretations WHERE cache_key = ? AND status = 'ready'",[cacheKey]);if(rows[0]?.[0])return{fields:modules.readingFields(text,unseal(rows[0][0]),mode==='native-vector-only'),text,mode};}throw Error('No existing ready interpretation')}
async function writePrivate(packet){
 if(packet.kind==='private-batch'&&hasLookup(packet.queries))packet={kind:'private-excluded',tag:packet.tag,reason:'profile lookup excluded'};
 await new Promise(resolve=>process.stdout.write(JSON.stringify(packet)+'\n',resolve));
}
const privateStream=true;const heldoutStream=true;
if(process.env.DIAGNOSTIC_PRIVATE_PIPE!=='1'||!/^\d{8}T\d{6}Z$/.test(process.env.DIAGNOSTIC_INDEX_BUILD||''))process.exit(2);
const cases=[
 {tag:'coverage-history-080628',at:'2026-10-11T08:06:28.849Z',policies:[false,true],parity:'transfer coverage; reconstructed policy; historical chip filters unavailable'},
 {tag:'coverage-history-083054',at:'2026-10-11T08:30:54.250Z',policies:[false,true],parity:'transfer coverage; reconstructed policy; historical chip filters unavailable'},
 {tag:'heldout-person',from:'2026-10-11T19:20:43.973Z',to:'2026-10-11T19:20:44.558Z',policies:[true],parity:'owner known body, no chip filters'},
 {tag:'heldout-description',from:'2026-10-11T19:20:53.263Z',to:'2026-10-11T19:20:54.011Z',policies:[true],parity:'owner known body, no chip filters'},
 {tag:'heldout-unseen-native',selectNative:true,policies:[true],parity:'selected cached multilingual reading after frozen rule; chip filters not retained'},
 {tag:'control-native-title',q:'Babam ve Oğlum',policies:[true],parity:'coverage control; not held out'},
 {tag:'control-low-vote-title',q:'Gods of the Deep',policies:[true],parity:'coverage control; not held out'},
];
try{
 const index=await modules.getSearchIndex();if(index.buildId!==process.env.DIAGNOSTIC_INDEX_BUILD)throw Error('index build changed');
 const excluded=new Set(['Inception','Babam ve Oğlum','Gods of the Deep'].map(normalize));
 if(heldoutStream){const ranges=[['2026-10-11T08:06:28.829Z','2026-10-11T08:06:28.869Z'],['2026-10-11T08:30:54.230Z','2026-10-11T08:30:54.270Z'],['2026-10-11T10:18:54.707Z','2026-10-11T10:18:54.747Z'],['2026-10-11T19:18:05Z','2026-10-11T19:19:07Z'],['2026-10-11T19:20:15Z','2026-10-11T19:21:04Z']];for(const [from,to] of ranges){for(const row of await sql('SELECT ciphertext FROM doc.search_history WHERE created_at >= ? AND created_at < ?',[Date.parse(from),Date.parse(to)])){try{excluded.add(normalize(unseal(row[0]).text))}catch{}}}}
 if(privateStream&&!heldoutStream) cases.splice(0,3);
 if(!privateStream) emit({kind:'start',at:new Date().toISOString(),indexBuildId:index.buildId,caseCount:cases.length,repeats:3,interpretationCalls:0,historyWrites:0,modelDownloads:0,transport:'production queryBatch independent process/pool'});
 for(const item of cases){
  let q=item.q;
  if(item.selectNative){const rows=await sql("SELECT ciphertext FROM doc.search_history WHERE created_at >= ? AND ranker_version = 'ready-hybrid-v2' ORDER BY created_at DESC LIMIT 500",[Date.parse('2026-09-27T00:00:00Z')]);let selected;for(const row of rows){let candidate;try{candidate=unseal(row[0]).text}catch{continue}if(typeof candidate!=='string'||excluded.has(normalize(candidate))||!modules.nonEnglish(candidate))continue;try{const r=await reading(candidate);if(r.mode!=='native-vector-only')continue;globalThis.replayCaptured=undefined;try{await modules.rankSearch(r.fields,{query:candidate,text:candidate,nonEnglish:true,titleLookup:[]},{includeAdult:false,lesserKnown:true})}catch{}const captured=globalThis.replayCaptured;if(!captured||!captured.queries.some(x=>x.using==='text_multi_v1'&&x.limit===2000&&(x.filter?.must?.length||0)>0))continue;selected={kind:'private-batch',tag:item.tag,lesserKnown:true,policyParity:item.parity,indexBuildId:index.buildId,collection:captured.collection,queries:captured.queries};break;}catch{}}if(selected)await writePrivate(selected);else await new Promise(resolve=>process.stdout.write(JSON.stringify({kind:'private-excluded',tag:item.tag,reason:'no existing cached unseen multilingual must-filter limit2000 case in bounded history'})+'\n',resolve));continue;} 
  if(!q){const rows=await sql('SELECT ciphertext FROM doc.search_history WHERE created_at >= ? AND created_at < ?',[item.from?Date.parse(item.from):Date.parse(item.at)-20,item.to?Date.parse(item.to):Date.parse(item.at)+20]);const authenticated=[];for(const row of rows){try{authenticated.push(unseal(row[0]).text)}catch{}}if(authenticated.length!==1)throw Error('History case did not resolve uniquely');q=authenticated[0];}
  const r=await reading(q);
  for(const lesserKnown of item.policies||(item.q?[true]:[false,true])){
   globalThis.replayCaptured=undefined;
   try{await modules.rankSearch(r.fields,{query:q,text:q,nonEnglish:r.mode!=='english',titleLookup:[]},{includeAdult:false,lesserKnown})}catch{}
   const captured=globalThis.replayCaptured;if(!captured){await writePrivate({kind:'private-excluded',tag:item.tag,reason:'profile or seed-prefetch unavailable under no-Qdrant producer boundary'});continue;}
   if(privateStream){await writePrivate({kind:'private-batch',tag:item.tag,lesserKnown,policyParity:item.parity||'known body',indexBuildId:index.buildId,collection:captured.collection,queries:captured.queries});continue;}

  }
 }
 if(!privateStream) emit({kind:'complete',at:new Date().toISOString()});
}catch{if(!privateStream) emit({kind:'failed',reason:'diagnostic reconstruction or read failed; no private error emitted'});process.exitCode=1}
finally{await modules.stopQueryEncoder().catch(()=>{});process.exit(process.exitCode||0)}
