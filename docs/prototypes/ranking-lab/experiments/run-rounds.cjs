/* THROWAWAY experiment runner; all configured families are generic, never title/query-specific. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rank,configs:scalarConfigs}=require('./rankers.cjs');
const {enrich}=require('./core-evidence.cjs');
const here=__dirname;
const lexicalConfigs=[
 {id:'core-balanced',name:'Core evidence + weighted coverage',family:'blend',coverageMix:.2,evidenceMood:.08,evidenceConcrete:.15,coreWeight:1,combine:'auto'},
 {id:'core-strength',name:'Core evidence + attribute strength',family:'strength',evidenceMood:.08,evidenceConcrete:.2,coreWeight:1,combine:'auto'},
 {id:'core-first',name:'Core evidence takes priority',family:'strength',evidenceMood:.08,evidenceConcrete:.05,coreWeight:2,combine:'textfirst'},
 {id:'core-tempered',name:'Core evidence with stronger text',family:'strength',evidenceMood:.08,evidenceConcrete:.35,coreWeight:.6,combine:'textfirst'}
];
function catalog(){const raw=path.join(here,'catalog.json');return JSON.parse(fs.existsSync(raw)?fs.readFileSync(raw,'utf8'):require('node:zlib').gunzipSync(fs.readFileSync(raw+'.gz')).toString());}
function prepare(){const capture=JSON.parse(fs.readFileSync(path.join(here,'../capture.json'),'utf8'));const cat=catalog();return {capture:enrich(capture,cat),catalog:cat};}
module.exports={lexicalConfigs,prepare,catalog};
if(require.main===module){
 const {capture,catalog:cat}=prepare();const configs=[...scalarConfigs,...lexicalConfigs];
 const output={catalogSha256:cat.catalogSha256,configs,queries:capture.map(cap=>({query:cap.query,results:configs.map(cfg=>({id:cfg.id,top:rank(cap,cfg).slice(0,20).map(r=>({key:r.key,title:cap.titles[r.key]?.title,score:r.score,core:cap.coreEvidence[r.key]}))}))}))};
 fs.writeFileSync(path.join(here,'round-results.json'),JSON.stringify(output,null,2));
 const initial=JSON.parse(fs.readFileSync(path.join(here,'initial-slate-keys.json'),'utf8'));
 const slate=output.queries.map((c,i)=>({query:c.query,keys:[...new Set([...initial[i].keys,...c.results.flatMap(r=>r.top.slice(0,10).map(t=>t.key))])].sort()}));
 fs.writeFileSync(path.join(here,'slate-keys.json'),JSON.stringify(slate,null,2));
 // Assessors get no ranks, scoring components, fingerprints, evidence weights, or preset names.
 const blinded=slate.map(c=>({query:c.query,candidates:c.keys.map(key=>{const r=cat.records[key];return {key,title:r.title,year:r.release_year,type:r.media_type,synopsis:r.synopsis,genres:r.genres,essence:r.essence_text,credits:r.credits??r.directors??r.creators??null};})}));
 fs.writeFileSync(path.join(here,'blinded-slate.json'),JSON.stringify(blinded));
 console.log(slate.map(c=>({query:c.query,candidates:c.keys.length})));
}
