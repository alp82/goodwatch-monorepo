// Local-only installed-boundary fixture. Never a capture entrypoint.
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import {Worker} from 'node:worker_threads';
const received=[];
const server=http.createServer((req,res)=>{let body='';req.on('data',x=>body+=x);req.on('end',()=>{received.push(body);res.end('{"rows":[[1]]}')});});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
process.env.CRATE_HOSTS='127.0.0.1';process.env.CRATE_PORT=String(server.address().port);
try{
 const url=new URL(`http://127.0.0.1:${process.env.CRATE_PORT}/_sql`);
 const response=await new Promise((resolve,reject)=>{const req=http.request(url,{method:'POST'},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve(body));});req.on('error',reject);req.write('{"stmt":');req.end('"SELECT 1"}');});
 assert.equal(response,'{"rows":[[1]]}');assert.equal(received.length,1);
 for(const stmt of ['INSERT INTO x VALUES(1)','DELETE FROM x','SELECT 1; DELETE FROM x']){
  const req=http.request(url,{method:'POST'});req.on('error',()=>{});
  req.write(JSON.stringify({stmt}).slice(0,5));
  assert.throws(()=>req.end(JSON.stringify({stmt}).slice(5)),/producer_sql_write_forbidden/);
 }
 await assert.rejects(fetch('https://example.com'),/producer_fetch_forbidden/);
 assert.throws(()=>https.request('https://example.com'),/producer_network_forbidden/);
 const worker=new Worker(new URL('./test_boundary_worker.mjs',import.meta.url));
 const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject)});
 assert.equal(result.blocked,true,JSON.stringify(result));await worker.terminate();await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(received.length,1);assert.equal(received[0],'{"stmt":"SELECT 1"}');
 process.stdout.write(JSON.stringify({passed:true,approvedSelectBodies:received.length,writeBodiesSent:0,workerBlocked:true,fetchBlocked:true,httpsBlocked:true})+'\n');
}finally{await new Promise(resolve=>server.close(resolve));}
