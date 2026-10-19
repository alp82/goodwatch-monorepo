// A real worker and loopback HTTP server demonstrate that page fetch counts
// cannot bound downstream worker traffic. S5 itself refuses controlled pages.
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {test} from 'node:test'
import {chromium,executablePath} from './browser.mjs'

test('a real Chromium service worker can make two server requests from one page call',async()=>{
  let upstream=0
  const server=createServer((req,res)=>{
    if(req.url==='/sw.js') {
      res.setHeader('content-type','text/javascript')
      res.end(`self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
      self.addEventListener('fetch',e=>{if(new URL(e.request.url).pathname==='/graphql')e.respondWith(fetch('/upstream').then(()=>fetch('/upstream')))});`)
    } else if(req.url==='/upstream') {upstream++;res.setHeader('content-type','application/json');res.end('{"countsOnly":true}')}
    else {res.setHeader('content-type','text/html');res.end('<!doctype html><title>Synthetic worker fixture</title>')}
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  const browser=await chromium.launch({executablePath,headless:true,args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']})
  try {
    const page=await browser.newPage()
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    await page.evaluate(async()=>{
      await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready
      if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}))
      await fetch('/graphql',{method:'POST',body:'invented query'})
    })
    assert.equal(upstream,2)
  }finally{await browser.close();await new Promise(r=>server.close(r))}
})
