import test from 'node:test';import assert from 'node:assert/strict';
import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
import {main as oldMain} from './private_pipe_postcold_453_v3.mjs';
import {main} from './private_pipe_postcold_453_v3_retry1.mjs';
const expected='106f23a1d4acf5be28ae99a4270de0b4617f833e0f5ea79687afc6de69392293';
test('default main rejects old imported directory before spawn and corrected v3 freeze reaches only mocked transport',()=>{
 const originalSpawn=childProcess.spawn,argv=process.argv,env={...process.env},calls=[],children=[];
 childProcess.spawn=(...args)=>{calls.push(args);const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new PassThrough();c.kill=()=>true;children.push(c);return c};syncBuiltinESMExports();
 try{
  process.argv=['node','fixture','--execute-reviewed','--raise-own-nofile'];process.env.SOURCE_MANIFEST_SHA256=expected;
  Object.assign(process.env,{helperCodeSha256:'b61022a43ce6d3b3357290a718d4cebb4d3a6cd8c4547e839c501a3c0c4c8a55',helperPolicySha256:'ddb7f2735ab539cbe1138dfbf23397e41fb4db87c320720a970d068686281ec2',controllerCodeSha256:'8a3c8ed473f22baf65eeb644fdad5cd99ebb7d3bd373233bd6c43a93a3f7136a',controllerPolicySha256:'267f015bbe0900b358098562aba2b1f92b69826bae9eb9d2b18a1045f27c51d7'});
  assert.throws(()=>oldMain(),/source_manifest_changed/);assert.equal(calls.length,0);
  main();assert.equal(calls.length,2);assert.equal(calls[0][0],'/usr/bin/ssh');assert.match(calls[0][1][1],/pin-control-20261012-406-v1/);assert.match(calls[1][1][1],/pin-control-20261012-406-v3/);assert.match(calls[1][1][1],/raise-own-nofile/);
  calls.length=0;process.env.SOURCE_MANIFEST_SHA256='38bf2859b231e5b7bed2617090714caa5d1f8ad789fc95b83eb95ed5516154c6';assert.throws(()=>main(),/source_manifest_changed/);assert.equal(calls.length,0);
 }finally{
  for(const c of children){c.stdout.unpipe();c.stdout.destroy();c.stderr.destroy();c.stdin.destroy()}
  childProcess.spawn=originalSpawn;syncBuiltinESMExports();process.argv=argv;for(const k of Object.keys(process.env))delete process.env[k];Object.assign(process.env,env);
 }
});
