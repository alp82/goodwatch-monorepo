import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const driver=readFileSync('./eval-driver.mjs','utf8'),plan=readFileSync('./PLAN-v2.json'),sha=b=>createHash('sha256').update(b).digest('hex');
async function invoke(code,input,url){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',code],{env:{QDRANT_URL:url,QDRANT_API_KEY:'local-public-fixture-key'},stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const timeout=setTimeout(()=>child.kill('SIGKILL'),10000);child.on('error',reject);child.on('close',(exitCode,signal)=>{clearTimeout(timeout);resolve({exitCode,signal,stdout,stderr});});child.stdin.on('error',()=>{});child.stdin.end(input);});}
test('actual DataURL eval driver authenticates bytes before import and rejects input before requests',async()=>{
 const x=await invoke(driver,Buffer.from('{}'),'http://127.0.0.1:1');assert.equal(x.exitCode,1);assert.equal(x.stdout,'');assert.equal(JSON.parse(x.stderr).reason,'plan_hash');
 const y=await invoke(driver.replace(/const expectedReaderSha256="[a-f0-9]{64}"/,'const expectedReaderSha256="'+'0'.repeat(64)+'"'),plan,'http://127.0.0.1:1');assert.equal(y.exitCode,1);assert.equal(y.stdout,'');assert.equal(JSON.parse(y.stderr).reason,'driver_source_hash');
});
test('real eval driver loopback complete42934 rows88 requests CLI0 EOF and reader SHA, no source file on target',async()=>{
 let requests=0;const s=http.createServer((req,res)=>{requests++;assert.equal(req.headers['api-key'],'local-public-fixture-key');res.setHeader('Content-Type','application/json');if(req.method==='GET'){res.end(JSON.stringify({status:'ok',result:{status:'green',points_count:244262,config:{params:{sparse_vectors:{terms_bm25f_v1:{}}}}}}));return;}let body='';req.on('data',b=>body+=b);req.on('end',()=>{const q=JSON.parse(body);res.end(JSON.stringify({status:'ok',result:q.ids.map(id=>({id,vector:{terms_bm25f_v1:{indices:[],values:[]}}}))}));});});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));try{const out=await invoke(driver,plan,`http://127.0.0.1:${s.address().port}`);assert.equal(out.exitCode,0,out.stderr);assert.equal(out.signal,null);assert.equal(out.stderr,'');assert.ok(out.stdout.endsWith('\n'));const rows=out.stdout.trim().split('\n').map(x=>JSON.parse(x));assert.equal(rows[0].readerSha256,sha(readFileSync('./reader.mjs')));assert.equal(rows.filter(x=>x.kind==='point').length,42934);assert.equal(rows.at(-1).complete,true);assert.equal(rows.at(-1).requests,88);assert.equal(requests,88);}finally{s.closeAllConnections();await new Promise(r=>s.close(r));}
});
