import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { chromium, executablePath } from './browser.mjs'
import { makeList, s5Page, graphqlServer } from './fixture.mjs'

const root = fileURLToPath(new URL('../extension/', import.meta.url))
import {adapter} from './config.mjs'
let browser
let external = 0
before(async () => {
  browser = await chromium.launch({ executablePath, headless: true, args: ['--host-resolver-rules=MAP * ~NOTFOUND'] })
})
after(async () => { await browser?.close(); assert.equal(external, 0) })

async function setup(o = {}) {
  const list = o.list || makeList(o.total ?? 77)
  const server = graphqlServer({ list, delay: 0 })
  const calls = []
  const html = s5Page({list})
  const context = await browser.newContext({ serviceWorkers: 'block' })
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin !== 'https://www.netflix.com') { external++; return route.abort() }
    if (url.pathname === '/graphql') {
      const body = JSON.parse(req.postData())
      calls.push({ body, headers: await req.allHeaders(), at: Date.now() })
      const response = server.handle(body)
      if (o.reply) await o.reply(response, body, calls.length)
      if (o.delay) await new Promise(r => setTimeout(r, o.delay))
      return route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.body) }).catch(() => {})
    }
    if (url.pathname.endsWith('.js')) return route.fulfill({ body: '', contentType: 'text/javascript' })
    if (url.pathname.endsWith('.png')) return route.fulfill({ body: '', contentType: 'image/png' })
    return route.fulfill({ body: html, contentType: 'text/html' })
  })
  const page = await context.newPage()
  await page.goto('https://www.netflix.com/browse/my-list')
  await page.evaluate(config => {
    globalThis.GWS5AdapterConfig = config
    globalThis.__s5Holders = []
    globalThis.__s5TestHook = holder => {
      globalThis.__s5Holders.push(holder)
      globalThis.__s5Maps = holder.maps.slice()
      globalThis.__s5CardMaps = [holder.cardStates,holder.cards]
    }
  }, adapter)
  for (const file of ['provenance.js', 'adapter.js', 'runtime.js']) {
    // Test-only injection, like executeScript: no script element containing the state marker.
    await page.evaluate(source => (0, eval)(source), readFileSync(root + file, 'utf8'))
  }
  if (o.before) await o.before(page)
  return { page, context, calls, list, server }
}
async function run(o = {}) {
  const w = await setup(o)
  await w.page.evaluate(() => GWS5Command('start'))
  await w.page.waitForFunction(() => GWS5Command('status').state === 'finalized', { timeout: 15000 })
  const result = await w.page.evaluate(() => GWS5Command('status'))
  return { ...w, result }
}
function noPrivate(report, list) {
  const text = JSON.stringify(report)
  assert.ok(!text.includes('ROW-MYLIST') && !text.includes('Synthetic profile'))
  for (const item of list) { assert.ok(!text.includes(item.title)); assert.ok(!text.includes(String(item.id))) }
}

test('77 entries: whole-row call then one confirming call, counts only, snapshot unproven', async () => {
  const w = await run()
  try {
    assert.equal(w.calls.length, 2, JSON.stringify(w.result))
    assert.ok(w.calls[1].at - w.calls[0].at >= 1000)
    assert.deepEqual(w.calls.map(c => c.body.variables.carouselPageSize), [77, 77])
    assert.deepEqual(w.calls.map(c => c.body.variables.carouselAfterCursor), [null, null])
    assert.equal(w.result.report.singleResponseFullPasses, 2)
    assert.equal(w.result.report.agreement, true)
    assert.equal(w.result.report.reason, 'snapshot_unproven')
    assert.equal(w.result.report.s5IssuedCalls, 2)
    assert.equal(w.result.report.networkBehavior, 'unproven')
    noPrivate(w.result, w.list)
  } finally { await w.context.close() }
})

test('successful finalize clears actual retained maps and provenance values, leaving only a frozen counts report', async () => {
  const w = await setup({delay:200})
  try {
    await w.page.evaluate(() => GWS5Command('start'))
    await w.page.waitForFunction(() => __s5Maps[0].size === 77)
    assert.equal(await w.page.evaluate(() => GWS5Provenance.retainedValues().reference.entries.length), 13)
    await w.page.waitForFunction(() => GWS5Command('status').state === 'finalized')
    const retained = await w.page.evaluate(() => ({
      maps:__s5Maps.map(m => [...m.values()]),
      module:GWS5Provenance.retainedValues(), holder:__s5Holders[0],
      cardMaps:__s5CardMaps.map(m=>[...m.values()]),frozen:Object.isFrozen(GWS5Command('status').report.responses),
    }))
    assert.deepEqual(retained.maps, [[],[]])
    assert.deepEqual(retained.cardMaps,[[],[]])
    assert.deepEqual(retained.module, {reference:null,boundary:null})
    for (const [key,value] of Object.entries(retained.holder)) if (!['released','generation'].includes(key)) assert.equal(value,null,key)
    assert.equal(retained.frozen,true)
  } finally { await w.context.close() }
})

test('an identifiable retrying fetch wrapper is refused before any S5-issued call', async () => {
  const w = await run({before:page => page.evaluate(() => {
    const native = window.fetch
    window.fetch = function(...args) { return native(...args).catch(() => native(...args)) }
  })})
  try {
    assert.equal(w.calls.length,0)
    assert.equal(w.result.report.s5IssuedCalls,0)
    assert.equal(w.result.report.reason,'fetch_wrapped')
  } finally { await w.context.close() }
})

test('P4: duplicate positions have their own code and the entire page is excluded', async () => {
  const w=await run({reply:r => { r.body.data.node.entities.edges[1].cursor='MA==' }})
  try {
    assert.equal(w.calls.length,1)
    assert.equal(w.result.report.reason,'position_duplicate')
    assert.equal(w.result.report.acceptedPages,0)
  } finally { await w.context.close() }
})

test('a stable foreign card downgrades the full reply and prevents confirmation', async () => {
  const w=await run({delay:300,before:page => page.evaluate(() => {
    const a=document.createElement('a');a.dataset.uia='standard-card';a.href='/browse?jbv=888888';a.setAttribute('aria-label','Invented foreign card');
    document.querySelector('#my-list .track > div').append(a)
  })})
  try {
    assert.equal(w.result.report.reason,'card_outside_entries')
    assert.equal(w.calls.length,1)
    assert.equal(w.result.report.cardsOutsideEntries,1)
  } finally { await w.context.close() }
})

test('an abort-ignoring body reader cannot extend the eight-second acceptance deadline', async () => {
  const w=await setup({before:page => page.evaluate(() => {
    const native=window.fetch, clock=performance.now.bind(performance)
    window.__clockShift=0
    performance.now=() => clock()+window.__clockShift
    window.fetch=new Proxy(native,{apply(target,self,args) {
      return Reflect.apply(target,self,args).then(response => new Proxy(response,{get(t,k) {
        if (k === 'body') return {getReader:() => ({read:() => new Promise(resolve => { window.__lateBody=resolve }),cancel:async () => {}})}
        return Reflect.get(t,k,t)
      }}))
    }})
  })})
  try {
    await w.page.evaluate(() => GWS5Command('start'))
    await w.page.waitForFunction(() => typeof __lateBody === 'function')
    await w.page.evaluate(() => { __clockShift=9000 })
    await w.page.waitForFunction(() => GWS5Command('status').state === 'finalized',null,{timeout:2000})
    const r=await w.page.evaluate(() => GWS5Command('status'))
    assert.equal(r.report.reason,'request_timeout')
    assert.equal(w.calls.length,1)
    await w.page.evaluate(() => __lateBody({done:true}))
    await w.page.waitForTimeout(200)
    assert.deepEqual(await w.page.evaluate(() => GWS5Command('status')),r)
    assert.equal(await w.page.evaluate(() => __s5Holders[0].request),null)
  } finally { await w.context.close() }
})

test('valid clamping is one bounded paged pass, separately classified, with actual size/byte/cursor counts', async () => {
  const w=await run({reply:r => {
    const c=r.body.data.node.entities
    if (c.edges.length > 26) { c.edges=c.edges.slice(0,26);c.pageInfo.endCursor=c.edges.at(-1).cursor;c.pageInfo.hasNextPage=true }
  }})
  try {
    assert.equal(w.calls.length,3)
    const r=w.result.report
    assert.deepEqual(r.responses.map(p => p.returnedSize),[26,26,25])
    assert.equal(r.pagedFullPasses,1);assert.equal(r.singleResponseFullPasses,0)
    assert.equal(r.agreement,null);assert.equal(r.pageSizeClamped,true)
    assert.equal(r.passes[0].positionsCovered,77)
    assert.ok(r.responses.every(p => p.bytes>0 && p.milliseconds>=0 && p.requestedSize===77))
    assert.equal(r.cursorAdvances,3)
  } finally { await w.context.close() }
})

for (const [code,mutate] of [
  ['position_gap',n => n.entities.edges.splice(20,1)],
  ['id_conflict',n => {n.entities.edges[20].node.unifiedEntity.videoId=n.entities.edges[19].node.unifiedEntity.videoId}],
  ['response_total',n => {n.entities.totalCount++}],
  ['response_version',n => {n.version='2'}],
  ['response_row_id',n => {n._id='ANOTHER-INVENTED-ROW'}],
  ['entity_type_unknown',n => {n.entities.edges[20].node.unifiedEntity.__typename='Game'}],
  ['response_entity',n => {n.entities.edges[20].node.displayString='Invalid\nTitle'}],
  ['response_cursor',n => {delete n.entities.edges[20].cursor}],
  ['response_end_cursor',n => {n.entities.pageInfo.endCursor='MA=='}],
  ['response_has_next',n => {n.entities.pageInfo.hasNextPage=true}],
]) test(`P4 ${code}: reject all edges and never retry`,async () => {
  const w=await run({reply:r => mutate(r.body.data.node)})
  try {
    assert.equal(w.calls.length,1)
    assert.equal(w.result.report.reason,code)
    assert.equal(w.result.report.acceptedPages,0)
    assert.equal(await w.page.evaluate(() => __s5Maps[0].size),0)
    noPrivate(w.result,w.list)
  } finally {await w.context.close()}
})

test('same-count tail change between whole-row reads is a repeat conflict',async () => {
  const w=await run({reply:(r,b,call) => {if(call===2)r.body.data.node.entities.edges[20].node.displayString='Invented changed tail'}})
  try {assert.equal(w.calls.length,2);assert.equal(w.result.report.reason,'repeat_conflict');assert.equal(w.result.report.agreement,false)}
  finally {await w.context.close()}
})

test('native-looking retries are reported honestly as S5-issued calls, not measured network requests',async () => {
  const w=await run({before:page => page.evaluate(() => {
    window.fetch=new Proxy(window.fetch,{apply(target,self,args) {
      return Reflect.apply(target,self,args).then(() => Reflect.apply(target,self,args))
    }})
  })})
  try {assert.equal(w.calls.length,4);assert.equal(w.result.report.s5IssuedCalls,2);assert.equal(w.result.report.networkBehavior,'unproven')}
  finally {await w.context.close()}
})

async function accelerated(w) {
  // Only the external clock boundary is accelerated. Browser fetch, parser,
  // guards and fake GraphQL responses remain the production implementation.
  await w.page.evaluate(() => {window.__navReader=performance.getEntriesByType.bind(performance)})
  await w.page.clock.install()
  await w.page.evaluate(() => {performance.getEntriesByType=window.__navReader})
  await w.page.evaluate(() => GWS5Command('start'))
  for(let i=0;i<85;i++) {
    await new Promise(r => setTimeout(r,35))
    if((await w.page.evaluate(() => GWS5Command('status').state))==='finalized') return w.page.evaluate(() => GWS5Command('status'))
    await w.page.clock.fastForward(1000)
  }
  throw new Error('fixture exceeded diagnostic deadline')
}

test('the memory budget aborts a large paged read and releases all accumulated titles',async () => {
  const list=makeList(5000).map(i => ({...i,title:i.title+'x'.repeat(950)}))
  const w=await setup({list})
  try {
    const r=await accelerated(w)
    assert.equal(r.report.reason,'budget_exceeded')
    assert.ok(w.calls.length<25)
    assert.equal(await w.page.evaluate(() => __s5Maps[0].size),0)
  } finally {await w.context.close()}
})

test('Stop during an abort-ignoring call releases actual headers, variables, profile and bridge-free state before late settlement',async () => {
  const w=await setup({before:page => page.evaluate(() => {
    window.fetch=new Proxy(window.fetch,{apply() {return new Promise(resolve => {window.__resolveLate=resolve})}})
  })})
  try {
    await w.page.evaluate(() => GWS5Command('start'))
    assert.equal(await w.page.evaluate(() => __s5Holders[0].request.variables.rowId),'ROW-MYLIST-1')
    assert.ok(await w.page.evaluate(() => __s5Holders[0].marker.includes('Synthetic profile')))
    const r=await w.page.evaluate(() => GWS5Command('stop'))
    assert.equal(r.report.abandonedCalls,1)
    const retained=await w.page.evaluate(() => ({holder:__s5Holders[0],module:GWS5Provenance.retainedValues(),maps:__s5Maps.map(m=>[...m.values()])}))
    for(const [k,v] of Object.entries(retained.holder))if(!['released','generation'].includes(k))assert.equal(v,null,k)
    assert.deepEqual(retained.module,{reference:null,boundary:null})
    assert.deepEqual(retained.maps,[[],[]])
    await w.page.evaluate(() => __resolveLate(new Response('Invented late private body')))
    await w.page.waitForTimeout(100)
    assert.deepEqual(await w.page.evaluate(() => GWS5Command('status')),r)
    assert.equal(w.calls.length,0)
  } finally {await w.context.close()}
})

test('cleanup failure cannot produce successful finalize and still releases collector values',async () => {
  const w=await setup({before:page => page.evaluate(() => {
    const original=GWS5Provenance.release
    GWS5Provenance.release=() => {original();throw new Error('Invented private cleanup error')}
  })})
  try {
    await w.page.evaluate(() => GWS5Command('start'))
    await w.page.waitForFunction(() => GWS5Command('status').state==='finalized',null,{timeout:5000})
    const r=await w.page.evaluate(() => GWS5Command('status'))
    assert.equal(r.report.reason,'cleanup_failed');assert.equal(r.report.cleanupResult,'failed')
    assert.equal(await w.page.evaluate(() => __s5Holders[0].request),null)
    assert.ok(!JSON.stringify(r).includes('private cleanup error'))
  } finally {await w.context.close()}
})

test('exactly 60 S5-issued calls is a hard ceiling when the server clamps to one entry',async () => {
  const w=await setup({reply:r=>{
    const c=r.body.data.node.entities;c.edges=c.edges.slice(0,1)
    c.pageInfo.endCursor=c.edges[0].cursor;c.pageInfo.hasNextPage=true
  }})
  try {
    const r=await accelerated(w)
    assert.equal(r.report.reason,'request_limit');assert.equal(r.report.s5IssuedCalls,60);assert.equal(w.calls.length,60)
    assert.equal(r.report.coverage[0].positionsCovered,60)
  }finally{await w.context.close()}
})

for (const [name,change,code] of [
  ['profile',()=>document.querySelector('img[data-uia="navigation+profile-menu+Avatar"]').setAttribute('src','/invented-other.png'),'profile_changed'],
  ['fetch replacement',()=>{window.fetch=new Proxy(window.fetch,{})},'fetch_displaced'],
  ['inline reference',()=>{document.querySelector('script').textContent+='\n '},'provenance_changed'],
  ['build',()=>{netflix.reactContext.models.serverDefs.data.BUILD_IDENTIFIER='another-invented-build'},'build_unsupported'],
]) test(`${name} invalidation during the gap stops without a confirming call`,async()=>{
  const w=await setup()
  try {
    await w.page.evaluate(()=>GWS5Command('start'))
    await w.page.waitForFunction(()=>__s5Maps[0].size===77)
    await w.page.evaluate(change)
    await w.page.waitForFunction(()=>GWS5Command('status').state==='finalized')
    const r=await w.page.evaluate(()=>GWS5Command('status'))
    assert.equal(r.report.reason,code);assert.equal(w.calls.length,1)
    assert.equal(await w.page.evaluate(()=>__s5Maps[0].size),0)
  }finally{await w.context.close()}
})

for(const [name,change,code] of [
  ['accessor fetch',()=>{const f=fetch;window.__fetchReads=0;Object.defineProperty(window,'fetch',{get(){__fetchReads++;return f}})},'fetch_unavailable'],
  ['controlled worker',()=>Object.defineProperty(navigator.serviceWorker,'controller',{value:{}}),'service_worker_controlled'],
  ['unsupported build',()=>{netflix.reactContext.models.serverDefs.data.BUILD_IDENTIFIER='unsupported'},'build_unsupported'],
  ['cross-origin config',()=>{netflix.reactContext.models.fastProps.data['shakti.graphql.deployedClientUrl']='https://example.invalid/graphql'},'endpoint_unsupported'],
  ['mobile',()=>{netflix.reactContext.models.browserInfo.data.isMobile=true},'platform_unsupported'],
]) test(`${name}: refuse before a call`,async()=>{
  const w=await run({before:p=>p.evaluate(change)})
  try{assert.equal(w.result.report.reason,code);assert.equal(w.calls.length,0);assert.equal(await w.page.evaluate(()=>window.__fetchReads||0),0)}finally{await w.context.close()}
})

for(const [code,reply] of [
  ['response_status',r=>{r.status=429}],
  ['auth_required',r=>{r.status=403}],
  ['response_errors',r=>{r.body={errors:[{message:'Invented private error text'}]}}],
  ['response_too_large',r=>{r.body.padding='x'.repeat(2100000)}],
]) test(`${code}: one call, fixed code, no header negotiation`,async()=>{
  const w=await run({reply})
  try{assert.equal(w.result.report.reason,code);assert.equal(w.calls.length,1);assert.ok(!JSON.stringify(w.result).includes('private error text'))}finally{await w.context.close()}
})

test('exact request options and headers use browser-managed cookies without reading cookies, tokens or storage',async()=>{
  const w=await setup({before:async page=>{
    await page.context().addCookies([{name:'inventedSession',value:'inventedCookie',domain:'www.netflix.com',path:'/',secure:true}])
    await page.evaluate(()=>{
      window.__options=[]
      window.fetch=new Proxy(fetch,{apply(t,self,args){__options.push({method:args[1].method,mode:args[1].mode,credentials:args[1].credentials,redirect:args[1].redirect,cache:args[1].cache,signal:args[1].signal instanceof AbortSignal});return Reflect.apply(t,self,args)}})
      Object.defineProperty(netflix.reactContext.models,'userInfo',{get(){throw Error('token model read')}})
      Object.defineProperty(document,'cookie',{get(){throw Error('cookie read')}})
      for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{get(){throw Error('storage read')}})
    })
  }})
  try {
    await w.page.evaluate(()=>GWS5Command('start'));await w.page.waitForFunction(()=>GWS5Command('status').state==='finalized')
    assert.equal(w.calls.length,2)
    assert.deepEqual(Object.keys(w.calls[0].body).sort(),['extensions','operationName','variables'])
    assert.equal(Object.keys(w.calls[0].body.variables).length,23)
    assert.deepEqual(w.calls[0].body.extensions,{persistedQuery:{id:adapter.documentId,version:102}})
    assert.match(w.calls[0].headers.cookie,/inventedSession=inventedCookie/)
    assert.equal(w.calls[0].headers['x-netflix.context.hawkins-version'],'5.31.2')
    assert.deepEqual(await w.page.evaluate(()=>__options[0]),{method:'POST',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',signal:true})
  } finally {await w.context.close()}
})

test('interruption inside validation cannot repopulate the released holder',async()=>{
  const w=await run({before:p=>p.evaluate(()=>{
    const parse=GWS5Adapter.parse
    GWS5Adapter.parse=(...args)=>{const result=parse(...args);GWS5Command('stop');return result}
  })})
  try {
    assert.equal(w.result.report.reason,'member_stopped')
    assert.equal(await w.page.evaluate(()=>__s5Holders[0].page),null)
    assert.equal(w.calls.length,1)
  }finally{await w.context.close()}
})

test('independent read deadline and finalize deadline both release state and report fixed codes',async()=>{
  const w=await setup({before:p=>p.evaluate(()=>{
    const clock=performance.now.bind(performance);window.__shift=0;performance.now=()=>clock()+__shift
    window.fetch=new Proxy(fetch,{apply(){return new Promise(()=>{})}})
  })})
  try {
    await w.page.evaluate(()=>GWS5Command('start'))
    await w.page.evaluate(()=>{__shift=91000})
    await w.page.waitForFunction(()=>GWS5Command('status').state==='finalized')
    assert.equal((await w.page.evaluate(()=>GWS5Command('status'))).report.reason,'read_timeout')
    assert.equal(await w.page.evaluate(()=>__s5Holders[0].request),null)
  }finally{await w.context.close()}
  const v=await run({before:p=>p.evaluate(()=>{
    const clock=performance.now.bind(performance),release=GWS5Provenance.release
    window.__shift=0;performance.now=()=>clock()+__shift
    GWS5Provenance.release=()=>{release();__shift+=6000}
  })})
  try{assert.equal(v.result.report.reason,'finalize_timeout');assert.equal(await v.page.evaluate(()=>__s5Holders[0].request),null)}finally{await v.context.close()}
})

test('controller change during a pending call stops and releases without another call',async()=>{
  const w=await setup({delay:500})
  try{
    await w.page.evaluate(()=>GWS5Command('start'))
    await w.page.evaluate(()=>navigator.serviceWorker.dispatchEvent(new Event('controllerchange')))
    await w.page.waitForFunction(()=>GWS5Command('status').state==='finalized')
    const r=await w.page.evaluate(()=>GWS5Command('status'))
    assert.equal(r.report.reason,'service_worker_changed');assert.equal(r.report.s5IssuedCalls,1)
    assert.equal(await w.page.evaluate(()=>__s5Holders[0].request),null)
  }finally{await w.context.close()}
})

test('Cancel during the gap clears actual card maps; a new explicit Start has a separate budget',async()=>{
  const w=await setup()
  try{
    await w.page.evaluate(()=>GWS5Command('start'));await w.page.waitForFunction(()=>__s5Maps[0].size===77)
    const r=await w.page.evaluate(()=>GWS5Command('cancel'))
    assert.equal(r.report.reason,'cancelled');assert.equal(r.report.s5IssuedCalls,1)
    await w.page.evaluate(()=>GWS5Command('start'))
    await w.page.waitForFunction(()=>GWS5Command('status').state==='finalized')
    assert.equal((await w.page.evaluate(()=>GWS5Command('status'))).report.s5IssuedCalls,2)
    assert.equal(w.calls.length,3)
    for(const h of await w.page.evaluate(()=>__s5Holders))for(const [k,v]of Object.entries(h))if(!['released','generation'].includes(k))assert.equal(v,null,k)
  }finally{await w.context.close()}
})

test('a reported zero with a visible row is rejected without a call',async()=>{
  const w=await run({total:0})
  try{assert.equal(w.result.report.reason,'zero_with_row');assert.equal(w.calls.length,0)}finally{await w.context.close()}
})
