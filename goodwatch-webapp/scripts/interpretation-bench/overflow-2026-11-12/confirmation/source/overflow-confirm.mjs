// Confirm qualifying cheap overflow candidates. Never changes production routing.
import{readFileSync,writeFileSync,mkdirSync,appendFileSync,openSync,fsyncSync,closeSync,readdirSync}from'node:fs'
import{resolve,join}from'node:path'
import{loadProduction,hash}from'./production.mjs'
import{inference,SpendGuard}from'./overflow-run.mjs'
import{assess}from'./contract.mjs'
import{summarize}from'./bench.mjs'
const durable=(p,x)=>{appendFileSync(p,JSON.stringify(x)+'\n',{mode:0o600});const fd=openSync(p,'r');fsyncSync(fd);closeSync(fd)}
export async function confirm({artifact,out,keys}){
 const api=await loadProduction(),suite=JSON.parse(readFileSync(new URL('./cases.json',import.meta.url))),config=JSON.parse(readFileSync(join(artifact,'config.json')))
 const prior=[];for(const phase of ['run','adapted','remainder'])for(const line of readFileSync(join(artifact,phase,'trials.jsonl'),'utf8').trim().split('\n'))prior.push({...JSON.parse(line),run:phase})
 const allConfigs=['config.json','adapted-config.json','remainder-config.json'].map(p=>JSON.parse(readFileSync(join(artifact,p))))
 const exposure=prior.filter(r=>r.model!=='jev').reduce((s,r)=>s+(r.costUsd??allConfigs[['run','adapted','remainder'].indexOf(r.run)].reservationPerReadingUsd),0)
 const budget=Number((1-exposure).toFixed(9));if(budget<.10)throw Error('Insufficient combined cash budget for confirmation')
 const models=[config.models.find(m=>m.id==='perplexity-pplx-decider-flash-v1.2'),allConfigs[1].models.find(m=>m.id==='liquid-d1.1')]
 const guard=new SpendGuard(budget,.01),rows=[];mkdirSync(out,{mode:0o700});mkdirSync(join(out,'source'))
 const sourceHashes={};for(const p of readdirSync(new URL('./',import.meta.url)).filter(p=>p.endsWith('.mjs'))){const text=readFileSync(new URL(p,import.meta.url));sourceHashes[p]=hash(text);writeFileSync(join(out,'source',p),text)}
 writeFileSync(join(out,'manifest.json'),JSON.stringify({startedAt:new Date().toISOString(),models,priorCashExposureUsd:exposure,budget:guard.snapshot(),sourceHashes,productionSourceHashes:api.sourceHashes,suiteHash:hash(JSON.stringify(suite)),note:'Two additional c1 repetitions join the existing 42-case screen; three c4 repetitions are separate. $0.01 per-reading reservations are engineering estimates informed by complete 42-case observed costs, not provider-enforced caps. No automatic retries/fallbacks.'},null,2))
 const run=async(m,c,repeat,concurrency,warmup=false)=>{
  const id=[m.id,'finalist',concurrency,repeat,c.id,warmup?'warm':'measured'].join('/');const reservation=guard.reserve();durable(join(out,'ledger.jsonl'),{id,event:'reserve',...guard.snapshot()});const start=performance.now();const r=await inference(api,m,api.normalize(c.query),keys)
  const row={id,model:m.id,caseId:c.id,query:c.query,slice:c.slice,language:c.language,repeat,concurrency,warmup,phase:'finalist',ms:performance.now()-start,...r,...(r.fields?{assessment:assess(r.fields,c.expect,r.raw)}:{})};durable(join(out,'trials.jsonl'),row);rows.push(row);guard.settle(reservation,row.costUsd);durable(join(out,'ledger.jsonl'),{id,event:'settle',actualUsd:row.costUsd,...guard.snapshot()});if(row.costUsd===null)throw Error('Uncertain charge in confirmation');return row
 }
 for(const m of models){
  for(let repeat=1;repeat<3;repeat++)for(const c of [...suite.cases.slice(repeat),...suite.cases.slice(0,repeat)])await run(m,c,repeat,1)
  await run(m,suite.cases[0],0,4,true)
  const jobs=Array.from({length:3},(_,repeat)=>suite.cases.map(c=>({c,repeat}))).flat();let cursor=0,stop=false
  const result=await Promise.allSettled(Array.from({length:4},async()=>{while(!stop&&cursor<jobs.length){const j=jobs[cursor++];try{await run(m,j.c,j.repeat,4)}catch(e){stop=true;throw e}}}));const failure=result.find(x=>x.status==='rejected');if(failure)throw failure.reason
  console.log('confirmed '+m.id)
 }
 const summaries=[];for(const m of models)for(const concurrency of[1,4]){const initial=prior.filter(r=>r.model===m.id&&r.phase==='screen'&&r.status==='ok');const measured=[...(concurrency===1?initial:[]),...rows.filter(r=>r.model===m.id&&r.concurrency===concurrency)];summaries.push({concurrency,...summarize(measured,m,config.gates,1000,0)})}
 const report={status:'repeated interpreter development benchmark; provisional assertion quality, not human relevance acceptance',summaries,budget:guard.snapshot(),completedAt:new Date().toISOString()};writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.budget));return report
}
