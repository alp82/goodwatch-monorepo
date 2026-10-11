// Read-only diagnostic boundary, also preloaded by encoder workers.
import http from 'node:http';
import https from 'node:https';
import {isMainThread} from 'node:worker_threads';
export function hasLookup(value){
 if(!value||typeof value!=='object')return false;
 return Object.entries(value).some(([key,item])=>key==='lookup_from'||hasLookup(item));
}
export function readOnlyStatement(body){
 const value=JSON.parse(body);
 if(typeof value.stmt!=='string'||!/^SELECT\s/i.test(value.stmt.trim())||value.stmt.includes(';')||value.stmts)throw Error('producer_sql_write_forbidden');
 return value;
}
export function permittedRequest(url,options,env,isWorker=false){
 if(isWorker)throw Error('producer_worker_network_forbidden');
 const uri=url instanceof URL?url:new URL(typeof url==='string'?url:`http://${url.hostname||url.host}:${url.port||80}${url.path||'/'}`);
 const method=String(options?.method||url.method||'GET').toUpperCase();
 const hosts=String(env.CRATE_HOSTS||'').split(',');
 if(uri.protocol!=='http:'||!hosts.includes(uri.hostname)||uri.port!==String(env.CRATE_PORT||4200)||uri.username||uri.password||uri.search||uri.hash)throw Error('producer_network_forbidden');
 if(method==='POST'&&uri.pathname==='/_sql')return 'sql';
 if(method==='GET'&&/^\/_blobs\/search_index_files\/[a-f0-9]{40}$/.test(uri.pathname))return 'blob';
 throw Error('producer_network_forbidden');
}
export function installBoundary(env=process.env){
 const request=http.request.bind(http);
 http.request=function(url,options,callback){
  const kind=permittedRequest(url,typeof options==='function'?undefined:options,env,!isMainThread);
  const req=request(url,options,callback);const originalEnd=req.end.bind(req);let body=[];let size=0;
  req.write=function(chunk,encoding,callback){
   if(typeof encoding==='function')callback=encoding;
   const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==='string'?encoding:undefined);
   size+=bytes.length;if(size>64*1024){req.destroy();throw Error('producer_sql_body_bound');}
   body.push(bytes);if(callback)queueMicrotask(callback);return true;
  };
  req.end=function(chunk,encoding,callback){
   if(typeof chunk==='function'){callback=chunk;chunk=undefined;}
   if(typeof encoding==='function'){callback=encoding;encoding=undefined;}
   if(chunk!==undefined&&chunk!==null)req.write(chunk,encoding);
   const bytes=Buffer.concat(body);body=[];
   try{if(kind==='sql')readOnlyStatement(bytes.toString());else if(bytes.length)throw Error('producer_blob_body_forbidden');}
   catch{req.destroy();throw Error('producer_sql_write_forbidden');}
   return originalEnd(bytes,callback);
  };
  return req;
 };
 http.get=function(url,options,callback){const req=http.request(url,options,callback);req.end();return req;};
 https.request=https.get=()=>{throw Error('producer_network_forbidden')};
 globalThis.fetch=async()=>{throw Error('producer_fetch_forbidden')};
 env.TYPESAFE_API_KEY='';env.HF_HUB_OFFLINE='1';env.TRANSFORMERS_OFFLINE='1';
}
if(process.env.DIAGNOSTIC_PRIVATE_PIPE==='1')installBoundary();
