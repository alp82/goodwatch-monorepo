// Prepared launcher. Producer exit0 is an explicit control fence, after private stdout EOF.
import {verifyFrozenSources} from './source-freeze.mjs';
import {spawn} from 'node:child_process';
const emit=x=>process.stdout.write(JSON.stringify(x)+'\n');
const image='sha256:3d698950ee07437a64d9bbc8eaafe2d4638a7f90dde0e57aee133d51b6653a7f';
export const producerArgs=['run','--pull=never','--rm','--log-driver','none','--name','goodwatch-search-private-pin-stream-100','--read-only','--cpus','2','--memory','3g','--memory-swap','3g','--pids-limit','256','--network','coolify','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--env-file','/var/lib/goodwatch-search-tail-406/private-producer.env','-e','WEBAPP_ROLE=search','-e','TYPESAFE_API_KEY=','-e','DIAGNOSTIC_IMAGE_SOURCE=5f15698995eb4368baf5ea094b704a3752191e40','-e','DIAGNOSTIC_BUNDLE_SOURCE=2eb889b4d7ab998f012cda8aadbc2afc8d9dd8ff','-e','DIAGNOSTIC_PRIVATE_PIPE=1','-e','NODE_OPTIONS=--import=/app/build/server/replay/producer-guard.mjs','-v','/root/goodwatch-qdrant-cold-406-20261011/pin-control-20261012-406-v1:/app/build/server/replay:ro','--entrypoint','node',image,'/app/build/server/replay/run-heldout-no-profile.mjs','--private-stream','--heldout-stream'];
const quote=x=>"'"+x.replaceAll("'","'\\''")+"'";
export function connectProducer(capture,compare,onFailure){
 // Do not let source EOF end the comparison stream before SSH/process status is known.
 capture.stdout.pipe(compare.stdin,{end:false});
 capture.stderr.on('data',()=>{});compare.stderr.on('data',()=>{});
 capture.on('error',()=>onFailure('producer_transport'));compare.on('error',()=>onFailure('consumer_transport'));compare.stdin.on('error',()=>onFailure('private_pipe'));
 capture.on('close',code=>{
  if(code!==0){onFailure('producer_exit');return;}
  compare.stdin.end(JSON.stringify({kind:'private-producer-complete',exitCode:0})+'\n');
 });
 compare.on('close',code=>{if(code!==0)onFailure('consumer_exit')});
}
export function main(){
 if(process.argv[2]!=='--execute-reviewed'){emit({kind:'prepared-only',producerHost:'abio',producerLogDriver:'none',payloadPersistence:false,applicationSearchCalls:0,historyWrites:0});return;}
 verifyFrozenSources();
 const sourceHash=process.env.SOURCE_MANIFEST_SHA256;
 const expected=Object.fromEntries(['helperCodeSha256','helperPolicySha256','controllerCodeSha256','controllerPolicySha256'].map(k=>[k,process.env[k]]));
 if(Object.values(expected).some(x=>!/^[a-f0-9]{64}$/.test(x||'')))throw Error();
 // Image, existing models, cached-only capture source, env and resource placement need root preflight.
 const sourceCommand=['/usr/bin/docker',...producerArgs.slice(0,producerArgs.indexOf('--entrypoint')),'-e','SOURCE_MANIFEST_SHA256='+sourceHash,...producerArgs.slice(producerArgs.indexOf('--entrypoint'))].map(quote).join(' ');
 const command=['env','QDRANT_URL=http://127.0.0.1:16333/','SOURCE_MANIFEST_SHA256='+sourceHash,...Object.entries(expected).map(([k,v])=>k+'='+v),'/root/goodwatch-qdrant-cold-406-20261011/pin-control-20261012-406-v1/node','/root/goodwatch-qdrant-cold-406-20261011/pin-control-20261012-406-v1/compare.mjs','--execute-reviewed'].map(quote).join(' ');
 const capture=spawn('/usr/bin/ssh',['root@10.0.0.21',sourceCommand],{stdio:['ignore','pipe','pipe']});
 const compare=spawn('/usr/bin/ssh',['root@10.0.0.32',command],{stdio:['pipe','pipe','pipe']});
 let failed=false;
 connectProducer(capture,compare,stage=>{if(failed)return;failed=true;capture.kill('SIGTERM');compare.kill('SIGTERM');emit({kind:'failed',stage,privateErrorOmitted:true});process.exitCode=1});
 compare.stdout.pipe(process.stdout);
}
if(import.meta.url===new URL(process.argv[1],'file:').href){try{main()}catch{emit({kind:'failed',stage:'freeze_missing',privateErrorOmitted:true});process.exitCode=1}}
