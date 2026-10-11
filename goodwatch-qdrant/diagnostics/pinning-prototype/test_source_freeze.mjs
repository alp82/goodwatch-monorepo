import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_FILES,sha,verifySources} from './source-freeze.mjs';
test('complete comparison, producer and rule bytes frozen before any capture',()=>{
 const content=Object.fromEntries(SOURCE_FILES.map(name=>[name,Buffer.from(name)]));
 const manifest={schema:'private-comparison-source-freeze.v1',files:Object.fromEntries(SOURCE_FILES.map(name=>[name,sha(content[name])])),producerRuleSha256:sha(content['run-heldout-no-profile.mjs']),productionBundleSha256:'a'.repeat(64)};
 const bytes=Buffer.from(JSON.stringify(manifest));
 assert.equal(verifySources(bytes,sha(bytes),name=>content[name]).producerRuleSha256,manifest.producerRuleSha256);
 for(const changed of ['compare-contract.mjs','transport.mjs','private-pipe.mjs','run-heldout-no-profile.mjs','producer-guard.mjs'])assert.throws(()=>verifySources(bytes,sha(bytes),name=>name===changed?Buffer.from('changed'):content[name]));
 assert.throws(()=>verifySources(bytes,'b'.repeat(64),name=>content[name]));
});
