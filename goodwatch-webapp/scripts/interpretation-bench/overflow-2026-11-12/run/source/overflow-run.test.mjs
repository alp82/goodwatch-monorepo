import assert from 'node:assert/strict'
import {test} from 'node:test'
import {SpendGuard,inference,rateFilter,validateModels} from './overflow-run.mjs'
import {loadProduction} from './production.mjs'
const api=await loadProduction()
test('spending guard reserves concurrent calls, settles actual charges, and retains unknown exposure',()=>{
 const g=new SpendGuard(.12,.04);const first=g.reserve(),second=g.reserve(),third=g.reserve();assert.throws(()=>g.reserve(),/before dispatch/)
 g.settle(first,.001);g.settle(second,null);g.settle(third,.002)
 assert.deepEqual(g.snapshot(),{limitUsd:.12,reservationPerReadingUsd:.04,knownActualUsd:.003,unknownHeldUsd:.04,inFlightReservedUsd:0})
 g.reserve();assert.throws(()=>g.reserve(),/before dispatch/)
})
test('no fallback routes or extra request fees; rate filters do not claim to cap total charges',()=>{
 assert.deepEqual(rateFilter({providers:['fixture'],inputPerMillion:.02}),{allow_fallbacks:false,only:['fixture'],max_price:{prompt:'0.02',completion:'0',request:'0'}})
 assert.throws(()=>validateModels([]),/ten native/)
})
test('failed half of a complete reading retains successful raw evidence and known partial cost, without retry or credential echo',async()=>{
 let calls=0;const m={model:'fixture',responseModel:'fixture-20261112',kind:'openrouter-decisions',providers:['fixture'],inputPerMillion:.02}
 const result=await inference(api,m,'something scary',{openrouter:'secret-fixture',typesafe:'unused'},async(_url,opts)=>{
  calls++;const body=JSON.parse(opts.body);assert.equal(body.messages,undefined);assert.equal(body.provider.allow_fallbacks,false)
  if(Object.keys(body.questions).length===148)return new Response(JSON.stringify({error:{message:'bad secret-fixture'}}),{status:400})
  return new Response(JSON.stringify({model:m.responseModel,answers:{},usage:{input_tokens:10,cost:.00001},provider:'fixture'}))
 })
 assert.equal(calls,2);assert.equal(result.status,'provider-error');assert.equal(result.costUsd,null);assert.equal(result.knownPartialUsd,.00001);assert.equal(result.raw[0].usage.cost,.00001);assert.ok(!JSON.stringify(result).includes('secret-fixture'))
})
