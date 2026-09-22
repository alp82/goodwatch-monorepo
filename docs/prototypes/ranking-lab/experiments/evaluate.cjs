/* THROWAWAY analysis, not a production test suite. Never invent missing judgments. */
const fs=require('node:fs'),path=require('node:path');
const here=__dirname;
const {rank,configs:scalar}=require('./rankers.cjs');
const {prepare,lexicalConfigs}=require('./run-rounds.cjs');
const gain=g=>2**g-1,discount=i=>Math.log2(i+2);
function dcg(grades){return grades.slice(0,10).reduce((sum,g,i)=>sum+gain(g)/discount(i),0);}
function metric(rows,grades,poolKeys){
 const top=rows.slice(0,10), values=top.map(r=>grades.get(r.key)?.grade??null);
 while(values.length<10)values.push(0);
 const unknown=values.filter(g=>g===null).length;
 const pool=poolKeys.map(k=>grades.get(k)?.grade??null),poolUnknown=pool.filter(g=>g===null).length;
 const ideal=dcg(pool.map(g=>g??0).sort((a,b)=>b-a)),idealHigh=dcg(pool.map(g=>g??3).sort((a,b)=>b-a));
 const low=dcg(values.map(g=>g??0)),high=dcg(values.map(g=>g??3));
 return {ndcg:unknown||poolUnknown?null:ideal?low/ideal:0,conditionalNdcg:unknown?null:ideal?low/ideal:0,ndcgAssumption:poolUnknown?"Conditional score sets unresolved pooled grades to zero; use shared-label sensitivity for a winner":null,poolUnknown,ndcgBounds:[idealHigh?low/idealHigh:0,ideal?Math.min(1,high/ideal):1],acceptable:values.filter(g=>g!==null&&g>=2).length,
  acceptableBounds:[values.filter(g=>g!==null&&g>=2).length,values.filter(g=>g===null||g>=2).length],unknown,
  zeroTop5:values.slice(0,5).filter(g=>g===0).length,
  exclusionTop5:top.slice(0,5).filter(r=>grades.get(r.key)?.exclusion==='violated').map(r=>r.key),
  top:top.map((r,i)=>({rank:i+1,key:r.key,grade:values[i]}))};
}
function average(queries){return {queries:queries.length,ndcg:queries.some(q=>q.metric.ndcg===null)?null:queries.reduce((s,q)=>s+q.metric.ndcg,0)/queries.length,
 acceptable:queries.reduce((s,q)=>s+q.metric.acceptable,0)/queries.length,unknown:queries.reduce((s,q)=>s+q.metric.unknown,0),zeroTop5:queries.reduce((s,q)=>s+q.metric.zeroTop5,0)};}
function evaluate(capture,configs,judgments,indices,ranking=rank){
 const judged=new Map();for(const j of judgments){if(!judged.has(j.query))judged.set(j.query,new Map());judged.get(j.query).set(j.key,j);}
 const pools=new Map();for(const i of indices){const c=capture[i];pools.set(c.query,[...new Set([...(judged.get(c.query)?.keys()??[]),...configs.flatMap(cfg=>ranking(c,cfg).slice(0,10).map(r=>r.key))])]);}
 return configs.map(cfg=>{const queries=indices.map(i=>({index:i,query:capture[i].query,metric:metric(ranking(capture[i],cfg),judged.get(capture[i].query)??new Map(),pools.get(capture[i].query))}));return {id:cfg.id,config:cfg,summary:average(queries),queries};});
}
function comparison(candidate,baseline){
 const changes=candidate.queries.map(q=>{const b=baseline.queries.find(x=>x.query===q.query).metric,m=q.metric;const failures=[];
 if(m.unknown||b.unknown||m.poolUnknown||b.poolUnknown)failures.push('incomplete judgments or unresolved ideal ranking');
 if(m.ndcg!==null&&b.ndcg!==null&&m.ndcg-b.ndcg<-.100000001)failures.push('NDCG loss > 0.10');
 if(m.acceptable-b.acceptable < -1)failures.push('acceptable loss > 1');
 if(m.zeroTop5>b.zeroTop5)failures.push('more off-target top 5');
 if(m.exclusionTop5.some(k=>!b.exclusionTop5.includes(k)))failures.push('new exclusion violation');
 return {query:q.query,ndcgDelta:m.ndcg===null||b.ndcg===null?null:m.ndcg-b.ndcg,acceptableDelta:m.acceptable-b.acceptable,failures};});
 return {baseline:baseline.id,ndcgDelta:candidate.summary.ndcg===null||baseline.summary.ndcg===null?null:candidate.summary.ndcg-baseline.summary.ndcg,acceptableDelta:candidate.summary.acceptable-baseline.summary.acceptable,guardrailsPass:changes.every(q=>!q.failures.length),changes};
}
module.exports={evaluate,comparison,metric};
if(require.main===module){
 const phase=process.argv[2]??'development',contract=JSON.parse(fs.readFileSync(path.join(here,'query-intents.json'),'utf8'));
 const indices=contract.queries.filter(q=>phase==='all'?q.partition!=='ambiguity_audit':q.partition===(phase==='confirmation'?'reused_case_confirmation':phase)).map(q=>q.index);
 const names=phase==='development'?['judgments-a.json','judgments-c.json']:['judgments-a.json','judgments-b.json','judgments-c.json'];
 const judgments=names.flatMap(f=>fs.existsSync(path.join(here,f))?JSON.parse(fs.readFileSync(path.join(here,f),'utf8')):[]);
 const {capture}=prepare(),results=evaluate(capture,[...scalar,...lexicalConfigs],judgments,indices);
 fs.writeFileSync(path.join(here,`evaluation-${phase}.json`),JSON.stringify({phase,indices,judgmentProvenance:'Rank-blinded agent proxy, not user judgments',results},null,2));
 console.log(results.map(r=>({id:r.id,...r.summary})).sort((a,b)=>(b.ndcg??-1)-(a.ndcg??-1)));
}
