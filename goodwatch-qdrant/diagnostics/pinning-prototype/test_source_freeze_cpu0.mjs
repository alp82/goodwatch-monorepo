import test from 'node:test';import assert from 'node:assert/strict';
import crypto from 'node:crypto';import fs from 'node:fs';
import {verifyCpu0Freeze,CPU0_SOURCE_FILES,CPU0_CORE_SHA256,verifyExternalPacket,FULL_NAMES} from './compare-contract-cpu0.mjs';
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function fixture(){
 const files=Object.fromEntries(CPU0_SOURCE_FILES.map(name=>[name,Buffer.from('# public schema fixture '+name)]));
 for(const name of ['pin_cpu0.py','runtime_cpu0.py','daemon_cpu0.py','cpu0_guards.py'])files[name]=fs.readFileSync(new URL(name,import.meta.url));
 files['prepared-helper-policy-cpu0.json']=fs.readFileSync(new URL('prepared-helper-policy-cpu0.json',import.meta.url));
 files['prepared-control-policy-cpu0.json']=Buffer.from(JSON.stringify({schema:'clone-pin-control.cpu0-owned.v1',helperCodeSha256:CPU0_CORE_SHA256,helperPolicySha256:digest(files['prepared-helper-policy-cpu0.json']),lifecycle:{moduleSha256:digest(files['lifecycle_cpu0.py']),entrypointSha256:'f773b9c6df212eb34cfcffaa932b27a713e9d477492d2b5b40eb8f8cc5f2475e',stopSeconds:20},cpuIsolation:{periodMicros:100000,weight:100,cpusetCpus:'',cpusetMems:''}}));
 const manifest={schema:'search.clone-cpu0-owned-source-freeze.v1',variant:'cpu0-owned-lifecycle.v1',preparedOnly:true,oldFilesChanged:false,benchmarkPacketReady:false,helperCodeSha256:CPU0_CORE_SHA256,files:Object.fromEntries(Object.entries(files).map(([name,raw])=>[name,digest(raw)]))};
 const encode=()=>Buffer.from(JSON.stringify(manifest));return{files,manifest,encode};
}
test('closed fourteen-file source derives CPU0 code and policy bindings without reading models',()=>{
 const f=fixture(),raw=f.encode(),reads=[];const proof=verifyCpu0Freeze(raw,digest(raw),name=>{reads.push(name);return f.files[name];});
 assert.equal(proof.expected.helperCodeSha256,CPU0_CORE_SHA256);assert.deepEqual(reads,CPU0_SOURCE_FILES);
 assert.equal(proof.expected.controllerCodeSha256,digest(f.files['controller_cpu0.py']));
});
test('CPU2 consistent caller hashes and previous twelve-file schema cannot pass CPU0 closure',()=>{
 for(const mutate of [f=>f.manifest.schema='search.clone-cpu0-source-freeze.v1',f=>delete f.manifest.files['lifecycle_cpu0.py'],f=>f.manifest.helperCodeSha256='b'.repeat(64),f=>f.manifest.variant='cpu2',f=>{f.files['prepared-helper-policy-cpu0.json']=Buffer.from(JSON.stringify({schema:'mapped-data-pin-config.cpu0.v1',source:{mode:'clone',container:'gw-qdrant-cold-406-20261011',cpuNanos:2000000000,memoryBytes:6*1024**3,swapBytes:6*1024**3},policy:{maxLockedBytes:2*1024**3,includePayload:false}}));f.manifest.files['prepared-helper-policy-cpu0.json']=digest(f.files['prepared-helper-policy-cpu0.json']);}]){
  const f=fixture();mutate(f);const raw=f.encode();assert.throws(()=>verifyCpu0Freeze(raw,digest(raw),name=>f.files[name]));
 }
 const f=fixture(),raw=f.encode();assert.throws(()=>verifyCpu0Freeze(raw,'a'.repeat(64),()=>{throw Error('must not read after manifest mismatch');}));
});

test('external closure rejects canonical adapter, missing pure dependency and changed policy alias',()=>{
 function full(){const f=fixture();const reclaim=fs.readFileSync(new URL('../clone-preparation/prepare_clone_reclaim.py',import.meta.url));const control=JSON.parse(f.files['prepared-control-policy-cpu0.json']);control.cachePreparation={helperSha256:digest(reclaim)};f.files['prepared-control-policy-cpu0.json']=Buffer.from(JSON.stringify(control));f.manifest.files['prepared-control-policy-cpu0.json']=digest(f.files['prepared-control-policy-cpu0.json']);
 const files=Object.fromEntries(FULL_NAMES.map(name=>[name,f.files[name]||Buffer.from('public external fixture '+name)]));files['cpu0-source-freeze.json']=f.encode();files['helper-config.json']=files['prepared-helper-policy-cpu0.json'];files['controller-config.json']=files['prepared-control-policy-cpu0.json'];files['prepare_clone_reclaim.py']=reclaim;
 const manifest={schema:'cpu0-full-public-packet.v6',variant:'cpu0-owned-lifecycle.v1',sourceFreezeSha256:digest(files['cpu0-source-freeze.json']),files:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,digest(bytes)]))};return{files,manifest};}
 const f=full(),raw=Buffer.from(JSON.stringify(f.manifest));assert.equal(verifyExternalPacket(raw,digest(raw),name=>f.files[name]).externalManifest.schema,'cpu0-full-public-packet.v6');
 for(const mutate of [f=>f.manifest.files['compare.mjs']='a'.repeat(64),f=>delete f.manifest.files['parity.mjs'],f=>{f.files['controller-config.json']=Buffer.from('{}');f.manifest.files['controller-config.json']=digest(f.files['controller-config.json']);},f=>f.manifest.variant='cpu2',f=>f.manifest.unknown='raw']){const f=full();mutate(f);const raw=Buffer.from(JSON.stringify(f.manifest));assert.throws(()=>verifyExternalPacket(raw,digest(raw),name=>f.files[name]));}
});
