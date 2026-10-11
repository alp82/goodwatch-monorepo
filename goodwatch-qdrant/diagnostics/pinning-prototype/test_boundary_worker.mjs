import {parentPort} from 'node:worker_threads';
import http from 'node:http';
try{http.request(new URL('http://127.0.0.1:'+process.env.CRATE_PORT+'/_sql'),{method:'POST'});parentPort.postMessage({blocked:false});}
catch(error){parentPort.postMessage({blocked:error.message==='producer_worker_network_forbidden'});}
