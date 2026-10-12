// Clone-only direct HTTP transport. Every batch owns and closes one socket.
import http from 'node:http';
import {performance} from 'node:perf_hooks';

export function createDirectClient({endpoint='http://127.0.0.1:16333/'}={}){
 const base=new URL(endpoint);
 if(base.protocol!=='http:'||base.hostname!=='127.0.0.1'||base.pathname!=='/'||base.username||base.password||base.search||base.hash)throw Error('cpu0_endpoint_invalid');
 const sockets=new Set();
 return {
  get openSockets(){return sockets.size;},
  async queryBatch(collection,queries,{timeoutMs=30000}={}){
   if(collection!=='media_fingerprint_v1'||!Array.isArray(queries)||!queries.length||queries.length>12||timeoutMs!==30000)throw Error('cpu0_query_scope_invalid');
   const body=JSON.stringify({searches:queries});let socket,closed=Promise.resolve(),timer;const start=performance.now();
   try{
    const received=await new Promise((resolve,reject)=>{
     const request=http.request({hostname:base.hostname,port:base.port,path:`/collections/${collection}/points/query/batch`,method:'POST',agent:false,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Connection':'close'}},response=>{
      const chunks=[];let bytes=0;
      response.on('data',part=>{bytes+=part.length;if(bytes>32*1024**2)request.destroy(Error('cpu0_query_response_invalid'));else chunks.push(part);});
      response.on('end',()=>resolve({status:response.statusCode,body:Buffer.concat(chunks)}));
      response.on('error',()=>reject(Error('cpu0_query_transport_failure')));
     });
     request.on('socket',value=>{socket=value;sockets.add(value);closed=new Promise(resolveClose=>value.once('close',()=>{sockets.delete(value);resolveClose();}));});
     request.on('error',error=>reject(Error(['cpu0_query_timeout','cpu0_query_response_invalid'].includes(error.message)?error.message:'cpu0_query_transport_failure')));
     timer=setTimeout(()=>request.destroy(Error('cpu0_query_timeout')),timeoutMs);
     request.end(body);
    });
    let parsed;try{parsed=JSON.parse(received.body);}catch{throw Error('cpu0_query_response_invalid');}
    if(received.status!==200||typeof parsed.time!=='number'||!Number.isFinite(parsed.time)||parsed.time<0||!Array.isArray(parsed.result)||parsed.result.length!==queries.length||parsed.result.some(row=>!Array.isArray(row.points)||row.points.some(point=>!point||!((Number.isSafeInteger(point.id)&&point.id>=0)||(typeof point.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(point.id)))||typeof point.score!=='number'||!Number.isFinite(point.score))))throw Error('cpu0_query_response_invalid');
    // Include teardown in wall time; no query acknowledgement precedes it.
    if(socket&&!socket.destroyed)socket.destroy();await closed;
    return {results:parsed.result.map(row=>row.points),serverMs:parsed.time*1000,wallMs:performance.now()-start,socketClosed:true};
   }finally{
    clearTimeout(timer);if(socket&&!socket.destroyed)socket.destroy();await closed;
   }
  }
 };
}
