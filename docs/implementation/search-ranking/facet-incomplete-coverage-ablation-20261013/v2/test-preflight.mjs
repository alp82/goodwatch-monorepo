import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyConsumedInputs} from './preflight.mjs';
test('missing consumed drift input refuses before scoring/output even when another bound input exists', () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'study-preflight-'));
 try {
  fs.writeFileSync(path.join(dir,'prior.json'),'{}');
  const hash=createHash('sha256').update('{}').digest('hex');
  let computed=false;
  const run=()=>{verifyConsumedInputs(['prior.json','catalog-drift.json'],{'prior.json':{bytes:2,sha256:hash},'catalog-drift.json':{bytes:2,sha256:hash}},dir);computed=true;fs.writeFileSync(path.join(dir,'rankings.json'),'{}',{flag:'wx'});};
  assert.throws(run,/consumed_input_missing/);assert.equal(computed,false);assert.equal(fs.existsSync(path.join(dir,'rankings.json')),false);
 } finally {fs.rmSync(dir,{recursive:true});}
});
test('unbound file refuses; exact byte-bound file passes and modified bytes refuse',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'study-preflight-'));
 try {
  fs.writeFileSync(path.join(dir,'capture.json'),'{}');const binding={'capture.json':{bytes:2,sha256:createHash('sha256').update('{}').digest('hex')}};
  assert.throws(()=>verifyConsumedInputs(['capture.json'],{},dir),/consumed_input_unbound/);
  assert.equal(verifyConsumedInputs(['capture.json'],binding,dir),1);
  fs.writeFileSync(path.join(dir,'capture.json'),'[]');assert.throws(()=>verifyConsumedInputs(['capture.json'],binding,dir),/consumed_input_changed/);
 } finally {fs.rmSync(dir,{recursive:true});}
});
test('actual runner drift location is present in authenticated consumed registry; old ROOT location is refused',()=>{
 const root=path.dirname(new URL(import.meta.url).pathname);
 const source=fs.readFileSync(path.join(root,'run.mjs'),'utf8');
 const match=source.match(/catalogDrift:read\(BASE\+'([^']+)'\)/);
 assert.ok(match,'runner drift must use the immutable evidence input');
 const base='/home/alper/projects/search-100-evidence';
 const required=JSON.parse(fs.readFileSync(path.join(root,'consumed-inputs.json'))).requiredPaths;
 const bindings=JSON.parse(fs.readFileSync(path.join(root,'input-bindings.json'))).files;
 const consumed=base+match[1];assert.ok(required.includes(consumed));
 assert.equal(verifyConsumedInputs([consumed],bindings,base),1);
 assert.throws(()=>verifyConsumedInputs([path.join(root,'catalog-drift.json')],bindings,base),/consumed_input_unbound/);
 // The evaluator's non-generated inputs are authenticated by the same registry.
 assert.ok(required.some(p=>p.endsWith('/harness/metrics.py')));
 assert.ok(required.some(p=>p.endsWith('/holdout5/lists/combo-safe-v3.json')));
 assert.ok(required.some(p=>p.endsWith('/holdout4/lists/r6.json')));
});
