import test from 'node:test';
import assert from 'node:assert/strict';
import {hasLookup,readOnlyStatement,permittedRequest} from './producer-guard.mjs';
test('profile lookup anywhere in nested query/prefetch tree is rejected',()=>{
 assert.equal(hasLookup([{prefetch:[{query:{lookup_from:{collection:'private'}}}]}]),true);
 assert.equal(hasLookup([{query:[1,2],filter:{must:[]}}]),false);
});
test('only read SELECT statements with a single bounded SQL body qualify',()=>{
 assert.equal(readOnlyStatement(JSON.stringify({stmt:'SELECT ciphertext FROM doc.search_history WHERE created_at > ?',args:[1]})).args[0],1);
 for(const stmt of ['UPDATE x SET a=1','INSERT INTO x VALUES(1)','SELECT 1; DELETE FROM x','COPY x TO directory'])assert.throws(()=>readOnlyStatement(JSON.stringify({stmt})));
 assert.throws(()=>readOnlyStatement(JSON.stringify({stmts:['SELECT 1']})));
});
test('Qdrant/provider/model and worker network blocked before HTTP request',()=>{
 const env={CRATE_HOSTS:'10.0.0.1',CRATE_PORT:'4200'};
 assert.equal(permittedRequest(new URL('http://10.0.0.1:4200/_sql'),{method:'POST'},env),'sql');
 assert.equal(permittedRequest(new URL('http://10.0.0.1:4200/_blobs/search_index_files/'+'a'.repeat(40)),{method:'GET'},env),'blob');
 for(const url of ['http://10.0.0.1:6333/collections/x/points/query/batch','https://example.com/model','http://10.0.0.1:4200/_sql?private=1'])assert.throws(()=>permittedRequest(new URL(url),{method:'POST'},env));
 assert.throws(()=>permittedRequest(new URL('http://10.0.0.1:4200/_sql'),{method:'POST'},env,true));
});

test('installed buffering boundary sends SELECT only and preload reaches actual worker',async()=>{
 const {spawnSync}=await import('node:child_process');
 const guard=new URL('./producer-guard.mjs',import.meta.url),fixture=new URL('./test_boundary_child.mjs',import.meta.url);
 const result=spawnSync(process.execPath,['--import',guard.href,fixture.pathname],{env:{...process.env,DIAGNOSTIC_PRIVATE_PIPE:'1'},encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);
 assert.deepEqual(JSON.parse(result.stdout),{passed:true,approvedSelectBodies:1,writeBodiesSent:0,workerBlocked:true,fetchBlocked:true,httpsBlocked:true});
});
