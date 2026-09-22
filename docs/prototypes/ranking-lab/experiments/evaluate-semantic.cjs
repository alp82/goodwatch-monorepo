const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const here=__dirname;
const archived=require('./archived-presets.cjs');
const {configs,rank}=require('./rankers.cjs'),{prepare,lexicalConfigs}=require('./run-rounds.cjs'),{config,rerank}=require('./semantic-rank.cjs'),{evaluate,comparison}=require('./evaluate.cjs');
const read=f=>JSON.parse(fs.readFileSync(path.join(here,f),'utf8'));
function loadJudgments(phase='development',audit=false){
 const names=phase==='development'?['judgments-a.json','judgments-c.json']:['judgments-a.json','judgments-b.json','judgments-c.json'];
 const result=names.flatMap(read),map=new Map(result.map(j=>[`${j.query}|${j.key}`,j]));
 if(audit)for(const j of [...read('judgments-audit.json'),...(fs.existsSync(path.join(here,'judgments-audit-final.json'))?read('judgments-audit-final.json'):[])])if(map.has(`${j.query}|${j.key}`))map.set(`${j.query}|${j.key}`,j);
 for(const e of read('uncertain-evidence-audit.json').records){
  const key=`like groundhog day|${e.key}`,prior=map.get(key);
  if(prior)map.set(key,{...prior,grade:e.proposedGrade,confidence:e.confidence,reason:e.reasoning,source:e.sources.map(s=>s.url).join(' '),supplement:'uncertain-evidence-audit.json'});
 }
 return [...map.values()];
}
function run(phase='development',supportFile='semantic-support.json'){
 const {capture}=prepare(),support=read(supportFile),all=[...configs,...lexicalConfigs,...archived.configs,config];
 const ranking=(cap,cfg)=>cfg.family==='semantic'?rerank(cap,support,cfg):cfg.family==='archived'?archived.rank(cap,cfg):rank(cap,cfg);
 const indices=read('query-intents.json').queries.filter(q=>phase==='all'?q.partition!=='ambiguity_audit':q.partition===(phase==='confirmation'?'reused_case_confirmation':phase)).map(q=>q.index);
 const judgments=loadJudgments(phase),results=evaluate(capture,all,judgments,indices,ranking);
 const audited=evaluate(capture,all,loadJudgments(phase,true),indices,ranking);
 const winner=results.find(r=>r.id===config.id),auditWinner=audited.find(r=>r.id===config.id);
 // Exact per-query sensitivity for the one unresolved interpreted-query label (Free Guy).
 // Unlike loose independent bounds, each assignment is shared by every candidate and IDCG.
 function scenarios(labels){return [0,1,2,3].map(grade=>{
  const assigned=labels.map(j=>j.query==='like groundhog day'&&j.key==='movie:550988'?{...j,grade}:j);
  const scores=evaluate(capture,all,assigned,indices,ranking),w=scores.find(r=>r.id===config.id);
  return {freeGuyGrade:grade,results:scores,comparisons:scores.filter(r=>r.id!==config.id).map(b=>comparison(w,b))};
 });}
 const sensitivity=scenarios(judgments),auditSensitivity=scenarios(loadJudgments(phase,true));
 const output={phase,indices,supportFile,judgmentProvenance:'Independent rank-blinded agent judgments, not user ratings',semanticConfig:config,results,audited,
  comparisons:results.filter(r=>r.id!==config.id).map(b=>comparison(winner,b)),auditSensitivity,auditComparisons:audited.filter(r=>r.id!==config.id).map(b=>comparison(auditWinner,b)),sensitivity};
 fs.writeFileSync(path.join(here,`semantic-evaluation-${phase}.json`),JSON.stringify(output,null,2));
 console.log(results.map(r=>({id:r.id,...r.summary})));console.log('Semantic comparisons',output.comparisons.map(c=>({id:c.baseline,ndcgDelta:c.ndcgDelta,acceptableDelta:c.acceptableDelta,failures:c.changes.filter(q=>q.failures.length)})));
 return output;
}
module.exports={run,loadJudgments};if(require.main===module)run(process.argv[2]??'development',process.argv[3]??'semantic-support.json');
