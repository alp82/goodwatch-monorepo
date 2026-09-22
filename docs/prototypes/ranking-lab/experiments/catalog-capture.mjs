// Throwaway read-only catalog enrichment. No model calls, runtime imports, or writes to services.
// node catalog-capture.mjs /absolute/original/goodwatch-webapp [. schema]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash, createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const app=process.argv[2];
if(!app) throw new Error('Pass original webapp path');
const require=createRequire(path.join(app,'package.json'));
const env=require('dotenv').parse(readFileSync(path.join(app,'.env')));
const host=env.CRATE_HOSTS?.split(',')[0];
if(!host) throw new Error('Catalog configuration unavailable');
async function query(stmt,args=[]) {
  if(!/^SELECT\s/i.test(stmt)) throw new Error('SELECT only');
  const response=await fetch(`http://${host}:${env.CRATE_PORT||'4200'}/_sql`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Basic ${Buffer.from(`${env.CRATE_USER||''}:${env.CRATE_PASS||''}`).toString('base64')}`},body:JSON.stringify({stmt,args}),signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error(`Catalog SELECT failed (HTTP ${response.status})`);
  const data=await response.json();
  return data.rows.map(row=>Object.fromEntries(data.cols.map((col,i)=>[col,row[i]])));
}
try {
  if(process.argv.includes('--cache-status')) {
    if(!/^[a-fA-F0-9]{64}$/.test(env.SEARCH_STORAGE_KEY||'')) {console.log('Cache availability unknown: local storage key absent');process.exit(0);}
    const root=path.resolve(here,'../../../..');
    const web=path.join(root,'goodwatch-webapp');
    const build=await require('esbuild').build({stdin:{contents:`export {attributeRequest,fingerprintRequest} from ${JSON.stringify(path.join(web,'app/server/combined-search/d4.server.ts'))};export {nonEnglish} from ${JSON.stringify(path.join(web,'app/server/combined-search/language.server.ts'))};`,resolveDir:web},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',alias:{'~':path.join(web,'app')},nodePaths:[path.join(app,'node_modules')],logLevel:'silent'});
    const Module=require('node:module');const mod=new Module(path.join(app,'catalog-probe.cjs'));mod.filename=path.join(app,'catalog-probe.cjs');mod.paths=Module._nodeModulePaths(app);mod._compile(build.outputFiles[0].text,mod.filename);
    const {attributeRequest,fingerprintRequest,nonEnglish}=mod.exports;
    const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`:JSON.stringify(value);
    const fixtures=JSON.parse(readFileSync(path.join(here,'../../search-evaluation/fixtures.json')));
    const statuses=[];
    for(const f of fixtures) {
      const language={mode:nonEnglish(f.query)?'native-vector-only':'english',version:'five-language-conservative-markers-v1'};
      const versions=[language,...(language.mode==='english'?[{mode:'english',version:'exact-native-title-v1'}]:[])];
      let ready=false;
      for(const lang of versions) {
        const contract=`d4+/jev-1.13.0/accepted-d4-corrected-v1/${lang.mode}/${lang.version}`;
        const requests=[attributeRequest(f.query),fingerprintRequest(f.query)].map(r=>({state:r.state,questions:r.questions,model:'jev-1.13.0'}));
        const key=createHmac('sha256',Buffer.from(env.SEARCH_STORAGE_KEY,'hex')).update(canonical({contract,language:lang,requests,text:f.query.trim().normalize('NFC')})).digest('hex');
        const rows=await query('SELECT status FROM doc.search_interpretations WHERE cache_key = ?',[key]);
        ready ||= rows.some(r=>r.status==='ready');
      }
      statuses.push({id:f.id,kind:f.kind,ready});
    }
    console.log(JSON.stringify({checkedAt:new Date().toISOString(),scope:'direct SELECT status by exact current request HMAC; no runtime lookup or model calls',statuses}));process.exit(0);
  }
  if(process.argv.includes('--credits')) {
    const artifact=JSON.parse(readFileSync(path.join(here,'catalog.json')));
    for(const table of ['movie','show']) {
      const ids=Object.keys(artifact.records).filter(k=>k.startsWith(`${table}:`)).map(k=>Number(k.split(':')[1]));
      for(let i=0;i<ids.length;i+=1000) {
        const batch=ids.slice(i,i+1000), readAt=new Date().toISOString();
        const rows=await query(`SELECT pw.media_tmdb_id,pw.person_tmdb_id,pw.job,p.name FROM person_worked_on pw JOIN person p ON p.tmdb_id = pw.person_tmdb_id WHERE pw.media_type = ? AND pw.media_tmdb_id IN (${batch.map(()=>'?').join(',')}) AND pw.job IN ('Director','Creator') LIMIT 50000`,[table,...batch]);
        for(const id of batch) artifact.records[`${table}:${id}`].creators=[];
        for(const row of rows) artifact.records[`${table}:${row.media_tmdb_id}`].creators.push({person_tmdb_id:row.person_tmdb_id,name:row.name,job:row.job,source:{tables:['person_worked_on','person'],readAt}});
        console.log(`Credits: ${table} ${Math.min(i+1000,ids.length)} / ${ids.length}`);
      }
    }
    artifact.creditsFinishedAt=new Date().toISOString();
    artifact.catalogSha256=createHash('sha256').update(JSON.stringify(artifact.records)).digest('hex');
    writeFileSync(path.join(here,'catalog.json'),JSON.stringify(artifact));
    writeFileSync(path.join(here,'catalog.json.gz'),gzipSync(JSON.stringify(artifact),{level:9}));
    console.log(JSON.stringify({catalogSha256:artifact.catalogSha256,creditsFinishedAt:artifact.creditsFinishedAt}));process.exit(0);
  }
  const schema=await query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema = 'doc' AND table_name IN ('movie','show')");
  if(process.argv.includes('--schema')) {console.log(JSON.stringify(schema.filter(r=>!/\[/.test(r.column_name))));process.exit(0);}
  const bytes=readFileSync(path.join(here,'../capture.json'));
  const capture=JSON.parse(bytes);
  const keys=[...new Set(capture.flatMap(c=>[...c.vectorPool,...c.textPool].map(r=>r.key)))].sort();
  const startedAt=new Date().toISOString(), records={},queries=[];
  for(const table of ['movie','show']) {
    const columns=new Set(schema.filter(r=>r.table_name===table).map(r=>r.column_name));
    const fields=['tmdb_id','title','release_year','synopsis','essence_text','essence_tags','keywords','genres','adult','imdb_id','goodwatch_overall_score_voting_count','fingerprint_scores','directors','director','created_by','creators'].filter(f=>columns.has(f));
    const ids=keys.filter(k=>k.startsWith(`${table}:`)).map(k=>Number(k.split(':')[1]));
    for(let i=0;i<ids.length;i+=500) {
      const batch=ids.slice(i,i+500), stmt=`SELECT ${fields.join(',')} FROM ${table} WHERE tmdb_id IN (${batch.map(()=>'?').join(',')})`;
      const readAt=new Date().toISOString();
      const rows=await query(stmt,batch);
      queries.push({table,fields,requested:batch.length,returned:rows.length,readAt});
      for(const row of rows) {const key=`${table}:${row.tmdb_id}`;records[key]={...row,key,media_type:table,source:{kind:'GoodWatch Crate catalog snapshot',table,id:row.tmdb_id,readAt,fields}};}
      console.log(`Captured ${Object.keys(records).length} / ${keys.length} titles`);
    }
  }
  const serialized=JSON.stringify(records),catalogSha256=createHash('sha256').update(serialized).digest('hex');
  const artifact={schemaVersion:1,startedAt,finishedAt:new Date().toISOString(),captureSha256:createHash('sha256').update(bytes).digest('hex'),catalogSha256,digestScope:'SHA256 of JSON.stringify(records) in stored insertion order',source:'Read-only SELECT from existing GoodWatch Crate catalog; no paid inference',queries,requestedIds:keys.length,missingIds:keys.filter(k=>!records[k]),records};
  writeFileSync(path.join(here,'catalog.json'),JSON.stringify(artifact));
    writeFileSync(path.join(here,'catalog.json.gz'),gzipSync(JSON.stringify(artifact),{level:9}));
  console.log(JSON.stringify({rows:Object.keys(records).length,missing:artifact.missingIds.length,catalogSha256,finishedAt:artifact.finishedAt}));
} catch(error) {console.error(error?.message?.startsWith('Catalog')?error.message:'Catalog capture failed; no credentials or response bodies logged');process.exitCode=1;}
