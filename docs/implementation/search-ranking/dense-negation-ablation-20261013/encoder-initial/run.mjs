import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {Worker} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
const ROOT=path.dirname(new URL(import.meta.url).pathname);
const DEPS='/home/alper/projects/goodwatch-monorepo/goodwatch-webapp/node_modules';
const require=createRequire(DEPS+'/typescript/package.json');
const ts=require('typescript');
const hash=b=>createHash('sha256').update(b).digest('hex');
const out=(n,o)=>fs.writeFileSync(path.join(ROOT,n),JSON.stringify(o,null,2)+'\n',{flag:'wx',mode:0o600});
const sourceManifest=JSON.parse(fs.readFileSync(path.join(ROOT,'source-manifest.json')));
for(const e of sourceManifest.files){const b=fs.readFileSync(path.join(ROOT,'source',path.basename(e.path)));if(hash(b)!==e.sha256)throw Error('source_hash_changed');}
function compile(name,modify=s=>s){const raw=fs.readFileSync(path.join(ROOT,'source',name),'utf8');const result=ts.transpileModule(modify(raw),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;fs.writeFileSync(path.join(ROOT,'source',name.replace('.ts','.mjs')),result);return result;}
compile('text-rules.server.ts');
compile('query-parsing.server.ts',s=>s.replace('import negationWords from "./negation-words.json"',`const negationWords = ${fs.readFileSync(path.join(ROOT,'source','negation-words.json'),'utf8')}`).replaceAll('./text-rules.server.ts','./text-rules.server.mjs'));
compile('query-models.server.ts');
const {QUERY_MODELS}=await import('./source/query-models.server.mjs');
const {splitNegation,looksForeign}=await import('./source/query-parsing.server.mjs');
// Only QUERY_MODELS is used. Download-capable exported functions are never invoked.
const models={},pins=[];
for(const [name,spec]of Object.entries(QUERY_MODELS)){
 const base=path.join('/tmp/goodwatch-search-models',spec.repo,spec.revision),files={};
 for(const [kind,pin]of Object.entries(spec.files)){
  const file=path.join(base,pin.path),fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{const a=fs.fstatSync(fd,{bigint:true});if(!a.isFile()||a.size!==BigInt(pin.bytes))throw Error('model_size_changed');const h=createHash('sha256'),buf=Buffer.alloc(1024*1024);let n;while((n=fs.readSync(fd,buf,0,buf.length,null))>0)h.update(buf.subarray(0,n));const actual=h.digest('hex'),b=fs.fstatSync(fd,{bigint:true});for(const k of ['dev','ino','size','mtimeNs','ctimeNs'])if(a[k]!==b[k])throw Error('model_identity_changed');if(actual!==pin.sha256)throw Error('model_hash_changed');pins.push({model:name,kind,path:file,sha256:actual,bytes:pin.bytes,dev:String(a.dev),inode:String(a.ino),mtimeNs:String(a.mtimeNs),ctimeNs:String(a.ctimeNs)});files[kind]=file;}finally{fs.closeSync(fd);}
 }
 models[name]={spec,modelPath:files.model,tokenizerPath:files.tokenizer,tokenizerConfigPath:files.tokenizerConfig};
}
out('model-preflight.json',{sourceCommit:sourceManifest.sourceCommit,files:pins,totalBytes:pins.reduce((s,e)=>s+e.bytes,0),network:false,downloads:false});
// The original worker has only these two external dependencies. Resolve against existing local installation.
fs.symlinkSync(DEPS,path.join(ROOT,'source','node_modules'));
const dependencyVersions={};for(const n of ['onnxruntime-node','@huggingface/tokenizers','typescript']){const p=path.join(DEPS,n,'package.json');dependencyVersions[n]={version:JSON.parse(fs.readFileSync(p)).version,packageJsonSha256:hash(fs.readFileSync(p))};}
out('invocation.json',{nodeVersion:process.version,threads:2,serial:true,maxCorpusBatches:168,sourceManifestSha256:hash(fs.readFileSync(path.join(ROOT,'source-manifest.json'))),workerSha256:hash(fs.readFileSync(path.join(ROOT,'source','query-encoder.worker.js'))),dependencyVersions,preparedSearchParity:false,missing:['index-dependent spelling','title/entity reference resolution','entity intent residual'],network:false,modelCalls:'local pinned embedding encoder only'});
const start=performance.now(),worker=new Worker(new URL('./source/query-encoder.worker.js',import.meta.url),{workerData:{models,threads:2}});
let waiting=null;let fatal=null;
worker.on('message',m=>{if(m.type==='fatal'||m.type==='error'){fatal=Error('worker_'+m.type);if(waiting){waiting.reject(fatal);waiting=null;}return;}if(waiting){waiting.resolve(m);waiting=null;}});
worker.on('error',()=>{fatal=Error('worker_runtime_failure');if(waiting){waiting.reject(fatal);waiting=null;}});
function next(){if(fatal)return Promise.reject(fatal);return new Promise((resolve,reject)=>{waiting={resolve,reject};});}
try{
 const ready=await next();if(ready.type!=='ready')throw Error('worker_ready_missing');out('startup.json',{...ready,observedWallMs:performance.now()-start,builtInWarmupBatches:6,builtInWarmupTexts:12,productionTiming:false});
 const cache={},rows=[];let id=0;
 for(const e of sourceManifest.captures){
  const bytes=fs.readFileSync(path.join(ROOT,'captures',path.basename(e.path)));if(hash(bytes)!==e.sha256)throw Error('capture_hash_changed');const cap=JSON.parse(bytes);
  const text=cap.language?.text??cap.query,nonEnglish=Boolean(cap.language?.detectedNonEnglish)||looksForeign(text),model=nonEnglish?'multilingual':'english',parts=splitNegation(text);
  const texts=[...new Set([text,parts.positive,...parts.negated].filter(Boolean))];const request={english:[],multilingual:[]};request[model]=texts;
  const t=performance.now(),promise=next();worker.postMessage({id:++id,texts:request});const result=await promise;if(result.type!=='result'||result.id!==id)throw Error('worker_result_mismatch');
  const dim=models[model].spec.dim,v=result.vectors[model];if(!(v instanceof Float32Array)||v.length!==texts.length*dim)throw Error('vector_shape_changed');
  for(let i=0;i<texts.length;i++){const arr=Array.from(v.subarray(i*dim,(i+1)*dim));if(arr.some(x=>!Number.isFinite(x)))throw Error('vector_nonfinite');const norm=Math.sqrt(arr.reduce((a,x)=>a+x*x,0));if(Math.abs(norm-1)>1e-4)throw Error('vector_not_normalized');cache[model]??={};cache[model][texts[i]]=arr;}
  rows.push({id:cap.id,captureSha256:e.sha256,model,rawText:text,positive:parts.positive,negated:parts.negated,texts,queuedMs:result.queuedMs,encodeMs:result.encodeMs,observedWallMs:performance.now()-t,preparedSearchParity:false});
 }
 out('query-vectors.json',cache);out('encoding-results.json',{queries:rows.length,corpusBatches:id,rows,network:false,preparedSearchParity:false,productionTiming:false});
 console.log(JSON.stringify({queries:rows.length,batches:id,vectors:Object.fromEntries(Object.entries(cache).map(([k,v])=>[k,Object.keys(v).length])),encodingWallMs:rows.reduce((s,r)=>s+r.observedWallMs,0)}));
}finally{await worker.terminate();}
