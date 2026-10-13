import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createDirectClient} from './transport_cpu0.mjs';

test('real direct request uses close and proves local socket exit before returning',async()=>{
 let connectionHeader,body;const server=http.createServer((request,response)=>{
  connectionHeader=request.headers.connection;let chunks=[];request.on('data',part=>chunks.push(part));
  request.on('end',()=>{body=JSON.parse(Buffer.concat(chunks));response.end(JSON.stringify({time:.012,result:[{points:[{id:7,score:.8}]}]}));});
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const client=createDirectClient({endpoint:`http://127.0.0.1:${server.address().port}/`});
  const result=await client.queryBatch('media_fingerprint_v1',[{query:[1,2]}]);
  assert.equal(connectionHeader,'close');assert.deepEqual(body,{searches:[{query:[1,2]}]});
  assert.equal(result.serverMs,12);assert.equal(result.socketClosed,true);assert.equal(client.openSockets,0);
  assert.deepEqual(result.results,[[{id:7,score:.8}]]);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('malformed response closes socket and emits only fixed error class',async()=>{
 const server=http.createServer((_request,response)=>response.end('private raw response'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const client=createDirectClient({endpoint:`http://127.0.0.1:${server.address().port}/`});
  await assert.rejects(client.queryBatch('media_fingerprint_v1',[{query:[1]}]),error=>error.message==='cpu0_query_response_invalid');
  assert.equal(client.openSockets,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('baseline and candidate use separate sockets with no previous client retained',async()=>{
 let connections=0;const server=http.createServer((request,response)=>{
  request.resume();request.on('end',()=>response.end(JSON.stringify({time:.001,result:[{points:[]}]})));
 });server.on('connection',()=>connections++);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const client=createDirectClient({endpoint:`http://127.0.0.1:${server.address().port}/`});
  for(let phase=0;phase<2;phase++){const result=await client.queryBatch('media_fingerprint_v1',[{query:[1]}]);assert.equal(result.socketClosed,true);assert.equal(client.openSockets,0);}
  assert.equal(connections,2);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('scope refuses other endpoints and collections before any connection',async()=>{
 for(const endpoint of ['http://localhost:16333/','http://127.0.0.1:16333/private','http://127.0.0.1:16333/?key=private'])assert.throws(()=>createDirectClient({endpoint}),/cpu0_endpoint_invalid/);
 const client=createDirectClient();
 await assert.rejects(client.queryBatch('private',[{query:[1]}]),/cpu0_query_scope_invalid/);
 assert.equal(client.openSockets,0);
});

test('real response abort closes the owned socket without exposing raw error',async()=>{
 const server=http.createServer((request,response)=>{request.resume();request.on('end',()=>{response.writeHead(200,{'Content-Length':10000});response.write('{"private":"unfinished"');setImmediate(()=>response.destroy());});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const client=createDirectClient({endpoint:`http://127.0.0.1:${server.address().port}/`});await assert.rejects(client.queryBatch('media_fingerprint_v1',[{query:[1]}]),error=>error.message==='cpu0_query_transport_failure');assert.equal(client.openSockets,0);}finally{await new Promise(resolve=>server.close(resolve));}
});

test('actual unchanged thirty-second timeout closes a stalled-header socket',async()=>{
 const server=http.createServer(request=>request.resume());await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const client=createDirectClient({endpoint:`http://127.0.0.1:${server.address().port}/`});const started=performance.now();await assert.rejects(client.queryBatch('media_fingerprint_v1',[{query:[1]}]),error=>error.message==='cpu0_query_timeout');assert.ok(performance.now()-started>=30000);assert.equal(client.openSockets,0);}finally{await new Promise(resolve=>server.close(resolve));}
});

test('malformed points refuse parity while empty results and UUID numeric scores remain valid',async()=>{
 let points=[];const server=http.createServer((request,response)=>{request.resume();request.on('end',()=>response.end(JSON.stringify({time:.001,result:[{points}]})));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const client=createDirectClient({endpoint:`http://127.0.0.1:${server.address().port}/`});for(const point of [{},{id:1,score:null},{id:null,score:1},{id:1,score:'1'},{id:'raw unsupported',score:1}]){points=[point];await assert.rejects(client.queryBatch('media_fingerprint_v1',[{query:[1]}]),/cpu0_query_response_invalid/);assert.equal(client.openSockets,0);}for(const valid of [[],[{id:'8c79e9dd-04f3-4dd5-b0b4-bc1826b43931',score:-.5}]]){points=valid;assert.deepEqual((await client.queryBatch('media_fingerprint_v1',[{query:[1]}])).results,[valid]);}}finally{await new Promise(resolve=>server.close(resolve));}
});
