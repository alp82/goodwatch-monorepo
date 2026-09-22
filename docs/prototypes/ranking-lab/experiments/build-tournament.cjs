/* Builds one shareable HTML artifact from frozen inputs; no network or model calls. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const here=__dirname,read=f=>JSON.parse(fs.readFileSync(path.join(here,f),'utf8'));
const {rank,configs}=require('./rankers.cjs'),{prepare,lexicalConfigs}=require('./run-rounds.cjs'),{config,rerank}=require('./semantic-rank.cjs'),{loadJudgments}=require('./evaluate-semantic.cjs');
const archived=require('./archived-presets.cjs');
const {capture,catalog}=prepare(),supportFile=process.argv[2]??'semantic-support-v2.json',support=read(supportFile);
const all=[...configs,...lexicalConfigs,...archived.configs,config],rubric=read('query-intents.json'),parsed=read('parsed-intents.json'),evaluation=read('semantic-evaluation-all.json');
const judgments=loadJudgments('all'),byQuery=new Map();for(const j of judgments){if(!byQuery.has(j.query))byQuery.set(j.query,{});byQuery.get(j.query)[j.key]=j;}
const declaration=read('winner-declaration.json'),verification=read('winner-verification.json');
for(const [file,digest] of Object.entries(verification.finalEvidenceHashes)){if(crypto.createHash('sha256').update(fs.readFileSync(path.join(here,file))).digest('hex')!==digest)throw new Error('Evidence changed; rerun evaluation and winner verification before building.');}
const artifact={revision:'ranking-experiments-v2',preferred:'semantic-core',captureHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(here,'../capture.json'))).digest('hex'),catalogHash:catalog.catalogSha256,
 configs:all.map(c=>({id:c.id,name:c.name,config:c,formula:c.family==='semantic'?'Interpret request → verify core subject/relationship → score 4 × core + modifier fit + 0.25 × attribute strength. Explicit exclusions −8; original reference −4. Other requests use the core-strength base.':null})),
 verdict:declaration,
 limits:'Rankings and semantic inference are captured offline. The semantic shortlist pools earlier experimental results; live shortlist quality, inference cost and latency are unmeasured. Catalog essence and agent judgments can share model bias. Legacy main is approximate; the accepted 30-query human baseline has not been rerun. Unknown evidence is not a negative judgment. No production ranking or deployment is changed.',
 queries:capture.map((cap,index)=>{
  const r=rubric.queries[index],p=parsed.find(q=>q.query===cap.query),keys=new Set();
  const rankings=all.map(cfg=>{const rows=(cfg.family==='semantic'?rerank(cap,support,cfg):cfg.family==='archived'?archived.rank(cap,cfg):rank(cap,cfg)).slice(0,30);rows.forEach(r=>keys.add(r.key));const metrics=evaluation.results.find(e=>e.id===cfg.id)?.queries.find(q=>q.query===cap.query)?.metric??null;
   if(metrics){const values=evaluation.sensitivity.map(s=>s.results.find(e=>e.id===cfg.id)?.queries.find(q=>q.query===cap.query)?.metric.ndcg).filter(v=>v!==null&&v!==undefined);if(values.length)metrics.ndcgRange=[Math.min(...values),Math.max(...values)];}
   return {id:cfg.id,metrics,rows:rows.map(r=>({key:r.key,score:r.score,primaryScore:r.primaryScore,ev:r.ev,coreScore:r.coreScore,features:r.features,semantic:r.semantic??null}))};});
  const titles={};for(const key of keys){const t=catalog.records[key];titles[key]={title:t?.title??cap.titles[key]?.title??key,year:t?.release_year??cap.titles[key]?.year,synopsis:t?.synopsis,essence:t?.essence_text};}
  const gradeMap=byQuery.get(cap.query)??{};const grades={};for(const key of keys)if(gradeMap[key])grades[key]=gradeMap[key];
  const interpretation=r.partition==='ambiguity_audit'?`${r.assumed_intent}. This request remains an ambiguity audit; the semantic experiment does not change its route.`:`Assumed meaning: ${p.core.map(c=>c.requirement).join(' ')} ${p.modifiers.join(' ')} ${p.exclusions.map(e=>'Exclude: '+e).join(' ')} ${p.assumption}`;
  return {query:cap.query,partition:r.partition,interpretation,rankings,titles,grades};
 })};
const json=JSON.stringify(artifact).replace(/<\//g,'<\\/');
fs.writeFileSync(path.join(here,'../tournament.html'),fs.readFileSync(path.join(here,'../tournament-template.html'),'utf8').replace('/*ARTIFACT*/',json));
console.log('Built tournament.html',Math.round(fs.statSync(path.join(here,'../tournament.html')).size/1024),'KB');
