// Paid native-only overflow screen. Production imports are guarded by production.mjs.
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,openSync,fsyncSync,closeSync,readdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {parseArgs} from 'node:util'
import {loadProduction,hash,root} from './production.mjs'
import {validateJev,assess} from './contract.mjs'
import {summarize,validateSuite} from './bench.mjs'

export class SpendGuard {
  constructor(limit,reservation){if(!Number.isFinite(limit)||limit<=0||!Number.isFinite(reservation)||reservation<=0||reservation>limit)throw Error('Invalid local budget');this.limit=limit;this.reservation=reservation;this.known=0;this.held=0;this.pending=0}
  reserve(){if(this.known+this.held+this.pending+this.reservation>this.limit+1e-12)throw Error('Local spending guard exhausted before dispatch');this.pending+=this.reservation;return this.reservation}
  settle(reservation,cost){if(this.pending+1e-12<reservation)throw Error('Unreserved settlement');this.pending=Math.max(0,this.pending-reservation);if(cost===null){this.held+=reservation;return}if(!Number.isFinite(cost)||cost<0)throw Error('Invalid reported cost');this.known+=cost;if(cost>reservation+1e-12)throw Error('Charge exceeded conservative reservation; stopping');}
  snapshot(){return {limitUsd:this.limit,reservationPerReadingUsd:this.reservation,knownActualUsd:this.known,unknownHeldUsd:this.held,inFlightReservedUsd:this.pending}}
}
const durable=(file,value)=>{appendFileSync(file,JSON.stringify(value)+'\n',{mode:0o600});const fd=openSync(file,'r');fsyncSync(fd);closeSync(fd)}
export const rateFilter=m=>({allow_fallbacks:false,only:m.providers,max_price:{prompt:String(m.inputPerMillion),completion:'0',request:'0'}})
export function validateModels(models){
 if(models.length!==11||models.filter(m=>m.kind==='jev').length!==1||models.filter(m=>m.kind==='openrouter-decisions').length!==10)throw Error('Exactly ten native challengers plus one direct JEV control required')
 if(new Set(models.map(m=>m.id)).size!==models.length)throw Error('Duplicate model')
 for(const m of models)if(m.kind!=='jev'&&(!m.responseModel||m.providers?.length!==1||!(m.inputPerMillion>0)||m.outputPerMillion!==0||!(m.contextTokens>0)))throw Error('Missing native identity/provider/price admission')
}
export async function inference(api,m,text,keys,fetcher=fetch){
 const requests=[api.attributeRequest(text),api.fingerprintRequest(text)]
 const outcomes=await Promise.all(requests.map(async request=>{
  const body={...request,model:m.model,...(m.kind==='openrouter-decisions'?{provider:rateFilter(m),session_id:'goodwatch-overflow-20261112'}:{})}
  const key=m.kind==='jev'?keys.typesafe:keys.openrouter
  try{
   const response=await fetcher(m.kind==='jev'?'https://api.typesafe.ai/v1/systemone':'https://openrouter.ai/api/alpha/decisions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)})
   const raw=await response.json().catch(()=>null)
   if(!response.ok||raw?.error){const detail=String(raw?.error?.message??raw?.message??'provider error').replaceAll(key,'[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,240);return {httpStatus:response.status,error:detail,raw:null}}
   return {httpStatus:response.status,raw}
  }catch(error){return {httpStatus:null,error:error.name,raw:null}}
 }))
 const raw=outcomes.map(r=>r.raw)
 const reported=raw.map(r=>m.kind==='jev'?Number.isSafeInteger(r?.usage?.input_tokens)&&r.usage.input_tokens>=0&&r.usage.input_tokens<=65536?r.usage.input_tokens*m.inputPerMillion/1e6:null:typeof r?.usage?.cost==='number'&&Number.isFinite(r.usage.cost)&&r.usage.cost>=0?r.usage.cost:null)
 const result={raw,httpStatuses:outcomes.map(r=>r.httpStatus),errors:outcomes.map(r=>r.error??null),costUsd:reported.every(x=>x!==null)?reported.reduce((a,b)=>a+b,0):null,knownPartialUsd:reported.reduce((a,b)=>a+(b??0),0),usage:raw.map(r=>r?.usage??null),provider:m.kind==='jev'?'typesafe':raw.map(r=>r?.provider??'unknown').join(',')}
 if(outcomes.some(r=>!r.raw))return {...result,status:'provider-error'}
 try{validateJev(requests,raw,m.responseModel??m.model,{maxInputTokens:m.kind==='jev'?65536:Infinity});const fields=api.readingFields(text,raw,false);return {...result,status:'ok',fields}}
 catch(error){return {...result,status:'invalid-output',validationError:String(error.message).slice(0,240)}}
}
export async function main(argv=process.argv.slice(2)){
 const {values:a}=parseArgs({args:argv,options:{config:{type:'string',default:new URL('./overflow-2026-11-12/config.json',import.meta.url).pathname},out:{type:'string'},execute:{type:'boolean',default:false},finalists:{type:'string',default:'3'}}})
 const config=JSON.parse(readFileSync(a.config));validateModels(config.models)
 const api=await loadProduction();if(config.models[0].model!==api.model)throw Error('JEV control differs from production')
 const suite=validateSuite(JSON.parse(readFileSync(new URL('./cases.json',import.meta.url))),api)
 const plan={cases:suite.cases.length,models:config.models.map(m=>m.id),budget:new SpendGuard(config.budgetUsd,config.reservationPerReadingUsd).snapshot(),screen:'one warmup plus 42 cases at c1 per admitted model',confirmation:'three total repetitions c1 and c4 for control and up to three strongest challengers',quality:suite.reviewStatus,freeTypeSafeUsdPerCycle:5,renewalDay:17,weights:{quality:.5,speed:.5},deadlineMs:1500}
 if(!a.execute){console.log(JSON.stringify(plan,null,2));return plan}
 if(!a.out)throw Error('New output directory required')
 const keys={typesafe:process.env.TYPESAFE_API_KEY,openrouter:process.env.OPENROUTER_API_KEY};if(!keys.typesafe||!keys.openrouter)throw Error('Missing explicitly supplied credentials')
 const metadataResponse=await fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+keys.openrouter},signal:AbortSignal.timeout(10000)})
 const keyMetadata=(await metadataResponse.json()).data;if(!metadataResponse.ok||!(keyMetadata.limit_remaining>=config.budgetUsd))throw Error('Existing key has insufficient remaining budget; no limits changed')
 const out=resolve(a.out);mkdirSync(out,{mode:0o700})
 const sources=Object.fromEntries(readdirSync(new URL('./',import.meta.url)).filter(p=>p.endsWith('.mjs')).map(p=>[p,hash(readFileSync(new URL(p,import.meta.url)))]))
 writeFileSync(join(out,'manifest.json'),JSON.stringify({...plan,startedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceHashes:api.sourceHashes,benchmarkSourceHashes:sources,configHash:hash(readFileSync(a.config)),suiteHash:hash(JSON.stringify(suite)),config,keyLimit:{limit:keyMetadata.limit,remainingBefore:keyMetadata.limit_remaining,reset:keyMetadata.limit_reset},budgetNote:'$1 is a local stop/reservation policy, not a provider-enforced per-run maximum. Reservations are conservative engineering estimates, not verified provider billing bounds. The shared key limit is unchanged.'},null,2))
 writeFileSync(join(out,'cases.json'),JSON.stringify(suite,null,2))
 const guard=new SpendGuard(config.budgetUsd,config.reservationPerReadingUsd),rows=[],admission=[],ledger=join(out,'ledger.jsonl')
 const run=async(m,c,phase,repeat,concurrency,warmup=false)=>{
  const id=[m.id,phase,repeat,c.id,warmup?'warm':'measured'].join('/');const reservation=guard.reserve();durable(ledger,{id,at:new Date().toISOString(),event:'reserve',reservationUsd:reservation,...guard.snapshot()})
  const start=performance.now();const result=await inference(api,m,api.normalize(c.query),keys)
  const row={id,model:m.id,caseId:c.id,query:c.query,slice:c.slice,language:c.language,phase,repeat,concurrency,warmup,ms:performance.now()-start,...result,...(result.fields?{assessment:assess(result.fields,c.expect,result.raw)}:{})}
  durable(join(out,'trials.jsonl'),row);rows.push(row)
  // A partly billed response still remains covered by the retained full reservation.
  guard.settle(reservation,row.costUsd);durable(ledger,{id,event:'settle',actualUsd:row.costUsd,knownPartialUsd:row.knownPartialUsd,...guard.snapshot()})
  if(row.costUsd===null) return row
  return row
 }
 const checkpoint=()=>writeFileSync(join(out,'checkpoint.json'),JSON.stringify({budget:guard.snapshot(),admission,completed:rows.length},null,2))
 // Admit all ten before broader spending. The full production reading is the admission; no question is omitted.
 for(const m of config.models){const r=await run(m,suite.cases[0],'admission',0,1,true);admission.push({model:m.id,status:r.status,costUsd:r.costUsd,errors:r.errors,validationError:r.validationError});checkpoint();console.log('admission '+m.id+': '+r.status+' $'+r.costUsd)}
 const admitted=config.models.filter(m=>admission.find(x=>x.model===m.id)?.status==='ok')
 for(const m of admitted){for(const c of suite.cases){const r=await run(m,c,'screen',0,1);checkpoint();if(r.costUsd===null)throw Error('Uncertain charge in measured cohort; stopping before another dispatch')}
  const s=summarize(rows.filter(r=>r.model===m.id&&r.phase==='screen'),m,config.gates,1000,0);console.log('screen '+m.id+': '+JSON.stringify({quality:s.quality,p95:s.p95Ms,costPer1000:s.costPer1000Fresh,errors:s.errorRate}))}
 const screen=admitted.map(m=>({m,summary:summarize(rows.filter(r=>r.model===m.id&&r.phase==='screen'),m,config.gates,1000,0)}))
 const candidates=screen.filter(x=>x.m.kind!=='jev'&&x.summary.errorRate<=.05&&x.summary.quality>=.70).sort((a,b)=>b.summary.equalWeightScore-a.summary.equalWeightScore).slice(0,Number(a.finalists))
 const confirmed=[...screen.filter(x=>x.m.kind==='jev').map(x=>x.m),...candidates.map(x=>x.m)]
 for(const m of confirmed){
  for(let repeat=1;repeat<3;repeat++)for(const c of [...suite.cases.slice(repeat),...suite.cases.slice(0,repeat)]){const r=await run(m,c,'confirmation',repeat,1);if(r.costUsd===null)throw Error('Uncertain confirmation charge');checkpoint()}
  await run(m,suite.cases[0],'confirmation-warm',0,4,true)
  const jobs=Array.from({length:3},(_,repeat)=>suite.cases.map(c=>({c,repeat}))).flat();let cursor=0,stopped=false
  const workers=await Promise.allSettled(Array.from({length:4},async()=>{while(!stopped&&cursor<jobs.length){const job=jobs[cursor++];try{const r=await run(m,job.c,'concurrency',job.repeat,4);checkpoint();if(r.costUsd===null)throw Error('Uncertain concurrency charge')}catch(error){stopped=true;throw error}}}))
  const failed=workers.find(r=>r.status==='rejected');if(failed)throw failed.reason
  console.log('confirmed '+m.id);checkpoint()
 }
 const summaries=[]
 for(const m of admitted){for(const concurrency of [1,4]){const cohort=rows.filter(r=>r.model===m.id&&!r.warmup&&r.concurrency===concurrency);if(cohort.length)summaries.push({concurrency,...summarize(cohort,m,config.gates,1000,0)})}}
 const report={status:'development benchmark; provisional assertions, no blind relevance acceptance or production switch',completedAt:new Date().toISOString(),admission,summaries,budget:guard.snapshot(),measuredFreshInterpretations:rows.filter(r=>!r.warmup).length,freeTypeSafeUsdPerCycle:5,renewalDay:17,overflowOnly:true,benchmarkCash:'OpenRouter calls consume paid credit; direct JEV control consumes existing free allowance',finalists:confirmed.map(m=>m.id)}
 for(const s of report.summaries){const control=report.summaries.find(x=>x.model==='jev'&&x.concurrency===s.concurrency);s.overflowCostRatioToJevList=control?.costPer1000Fresh>0?s.costPer1000Fresh/control.costPer1000Fresh:null;s.overflowCashPer1000=s.model==='jev'?null:s.costPer1000Fresh;s.sameDecoderScreeningPass=s.screeningPass}
 writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({budget:guard.snapshot(),finalists:report.finalists,completed:rows.length}));return report
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1})
