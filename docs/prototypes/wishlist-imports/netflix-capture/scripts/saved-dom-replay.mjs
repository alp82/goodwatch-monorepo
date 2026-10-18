// Private, inert replay only. Never logs or writes archived HTML, titles or IDs.
// Requires an explicitly supplied local archive; do not bundle that file.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const moduleName=process.env.GOODWATCH_PLAYWRIGHT_MODULE
const {chromium}=await import(moduleName?pathToFileURL(resolve(moduleName)).href:'playwright-core')
assert.ok(process.env.GOODWATCH_CAPTURE_SAVED_HTML,'supply private saved HTML path')
const archive=readFileSync(process.env.GOODWATCH_CAPTURE_SAVED_HTML,'utf8')
const current=readFileSync(new URL('../capture.js',import.meta.url),'utf8')
const baseline=process.env.GOODWATCH_CAPTURE_BASELINE_SOURCE?readFileSync(process.env.GOODWATCH_CAPTURE_BASELINE_SOURCE,'utf8'):null
const browser=await chromium.launch({executablePath:process.env.GOODWATCH_CHROMIUM_PATH||chromium.executablePath(),headless:true})
try {
 const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'})
 let blockedRequests=0
 await context.route('**/*',route=>{
  if(route.request().isNavigationRequest()&&route.request().resourceType()==='document'&&route.request().url()==='https://www.netflix.com/browse/my-list'){
   return route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'"},body:archive})
  }
  blockedRequests++
  return route.abort()
 })
 let parserCheck
 const run=async (source, validate=false)=>{
  const page=await context.newPage()
  await page.goto('https://www.netflix.com/browse/my-list',{waitUntil:'domcontentloaded'})
  // DevTools evaluation runs only this collector despite disabled page JavaScript.
  await page.evaluate(source)
  const aggregate=await page.evaluate(()=>{
   const headings=[...document.querySelectorAll('h2')].filter(h=>['My List','Meine Liste'].includes(h.textContent.trim()))
   const row=headings.length===1?headings[0].closest('section.carousel-row'):null
   const expected=row?[...row.querySelectorAll('a[data-uia="standard-card"]')].map(a=>({sourceId:new URL(a.getAttribute('href'),location.href).searchParams.get('jbv'),title:a.getAttribute('aria-label').trim()})):[]
   const result=globalThis.__goodwatchWishlistCaptureCommand({action:'start'})
   const actual=result.envelope?.items||[]
   // Compare private values inside the browser. Only booleans/counts leave it.
   const matches=actual.length===expected.length&&expected.every(e=>actual.some(a=>a.sourceId===e.sourceId&&a.title===e.title&&a.mediaType==='unknown'&&!a.sourceUrl&&!a.tmdbId&&!a.imdbId))
   const otherAnchors=[...document.querySelectorAll('a[data-uia="standard-card"]')].filter(a=>!row?.contains(a))
   const expectedIds=new Set(expected.map(e=>e.sourceId))
   const otherOnlyIds=new Set(otherAnchors.map(a=>new URL(a.getAttribute('href'),location.href).searchParams.get('jbv')).filter(id=>!expectedIds.has(id)))
   return {code:result.code,eligibleLoadedCards:expected.length,otherRowCards:otherAnchors.length,observedCount:result.observedCount,exactLoadedEvidenceMatch:matches,noOtherRowOnlyIds:actual.every(a=>!otherOnlyIds.has(a.sourceId)),profileGuard:result.profileGuard,completeness:result.envelope?.completeness}
  })
  if(validate && process.env.GOODWATCH_CAPTURE_ENVELOPE_VALIDATOR) {
   // Explicit opt-in to a trusted local validator. Private JSON travels only
   // through process memory/stdin, never command arguments or temporary files.
   const envelope=await page.evaluate(()=>globalThis.__goodwatchWishlistCaptureCommand({action:'stop'}).envelope)
   const validation=spawnSync(process.execPath,[resolve(process.env.GOODWATCH_CAPTURE_ENVELOPE_VALIDATOR)],{input:JSON.stringify(envelope),encoding:'utf8',maxBuffer:4096})
   parserCheck=JSON.parse(validation.stdout)
   assert.equal(validation.status,0,`private envelope validator passed: ${JSON.stringify(parserCheck)}`)
  }
  await page.close()
  return aggregate
 }
 const before=baseline?await run(baseline):null
 const after=await run(current,true)
 assert.equal(after.eligibleLoadedCards,5,'expected authorized snapshot loaded-card count')
 assert.equal(after.otherRowCards,11,'expected authorized snapshot excluded-card count')
 assert.equal(after.exactLoadedEvidenceMatch,true,'captured identities and titles exactly match private eligible row')
 assert.equal(after.noOtherRowOnlyIds,true,'excluded unrelated rows')
 assert.equal(after.completeness,'unknown')
 if(before){assert.equal(before.code,'boundary_missing');assert.equal(before.observedCount,0)}
 console.log(JSON.stringify({status:'passed',archivedPageJavaScriptEnabled:false,networkRequestsSent:0,blockedRequests,before,after,parserCheck,liveBrowserCaptureValidated:false},null,2))
 await context.close()
}finally{await browser.close()}
