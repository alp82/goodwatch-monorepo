// Offline evidence audit; no credentials or network.
import assert from 'node:assert/strict'
import{readFileSync,writeFileSync,existsSync}from'node:fs'
import{records}from'./records.mjs'
import{hash,loadProduction}from'./production.mjs'
import{validateJev}from'./contract.mjs'
const base=new URL('./overflow-2026-11-12/',import.meta.url),api=await loadProduction()
const json=p=>JSON.parse(readFileSync(new URL(p,base)))
const report=json('comparison.json'),suite=JSON.parse(readFileSync(new URL('./cases.json',import.meta.url))),config=json('config.json')
assert.equal(report.models.length,11);assert.ok(report.models.every(m=>m.status==='complete'&&m.uniqueCases===42))
const all=[];let sourceFiles=0
for(const phase of report.runs){
 const manifest=json(phase+'/manifest.json'),sources=manifest.benchmarkSourceHashes??manifest.sourceHashes
 for(const[name,digest]of Object.entries(sources)){assert.equal(hash(readFileSync(new URL(phase+'/source/'+name,base))),digest,phase+'/'+name);sourceFiles++}
 assert.deepEqual(manifest.productionSourceHashes??manifest.sourceHashes,api.sourceHashes)
 const models=manifest.config?.models??manifest.models
 const rows=records(new URL(phase+'/trials.jsonl',base))
 for(const r of rows){assert.ok(suite.cases.some(c=>c.id===r.caseId&&c.query===r.query));const m=models.find(m=>m.id===r.model);assert.ok(m)
  if(r.status==='ok'){const text=api.normalize(r.query);validateJev([api.attributeRequest(text),api.fingerprintRequest(text)],r.raw,m.responseModel??m.model,{maxInputTokens:m.kind==='jev'?65536:Infinity});assert.ok(Number.isFinite(r.costUsd)&&r.costUsd>=0)}
  all.push({...r,run:phase})
 }
 const events=records(new URL(phase+'/ledger.jsonl',base));const reserved=new Set(events.filter(e=>e.event==='reserve'||e.reserveUsd!==undefined).map(e=>e.id));assert.equal(reserved.size,rows.length)
}
assert.equal(all.length,report.totalReadings);assert.equal(all.reduce((n,r)=>n+r.httpStatuses.length,0),report.totalHttpCalls)
const paid=all.filter(r=>r.model!=='jev').reduce((s,r)=>s+(r.costUsd??r.knownPartialUsd??0),0);assert.ok(Math.abs(paid-report.openrouterKnownCashUsd)<1e-12);assert.ok(paid<1)
for(const name of ['blind-review','blind-review-second','blind-review-third']){const input=json(name+'-input.json'),review=json(name+'.json');assert.deepEqual((review.cases??review).map(r=>r.id),input.cases.map(r=>r.id))}
const result={at:new Date().toISOString(),models:11,challengers:10,fullCasesEach:42,totalAttempts:all.length,validAttempts:all.filter(r=>r.status==='ok').length,failedAttempts:all.filter(r=>r.status!=='ok').length,httpCalls:report.totalHttpCalls,executedSourceFilesMatched:sourceFiles,productionContractUnchanged:true,probabilityValidationPassed:true,paidCreditConsumptionUsd:paid,withinLocalCashGuard:true,blindReviewsChecked:3}
if(process.argv.includes('--write'))writeFileSync(new URL('verification.json',base),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))
