// Run in the benchmark's pinned Lighthouse/Chromium image. Anonymous production reads only.
import puppeteer from '/usr/local/lib/node_modules/lighthouse/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import {readFile,writeFile} from 'node:fs/promises';
const mode = process.env.MODE || 'desktop';
const out = process.env.OUT || '/out';
const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking']});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
try {
 const page = await browser.newPage();
 if(mode==='mobile') await page.emulate({viewport:{width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true},userAgent:'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36'});
 else await page.setViewport({width:1365,height:900,deviceScaleFactor:1});
 const cdp=await page.createCDPSession();
 const styles=[];
 if(process.env.TRACE_STYLE==='1'){
  await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  cdp.on('CSS.styleSheetAdded',e=>styles.push(e.header));
 }
 await cdp.send('Network.enable');
 await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 const cpu=Number(process.env.CPU || (mode==='mobile'?4:1));
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
 // The name is local shorthand, not Chrome's standard Fast 4G preset.
 if(['limited','fast4g'].includes(process.env.NETWORK))await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});
 await page.setBypassServiceWorker(true);
 const blocked=[], requests=[], errors=[],interventions=[];
 await page.setRequestInterception(true);
 page.on('request', async r=>{
  const u=new URL(r.url());
  if(process.env.PATCH_BROWSE==='1'&&u.pathname.endsWith('/_index-DcaxIOT2.js')){
   interventions.push('cached-browse');
   await r.respond({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:await readFile('/sources/patched-index.js','utf8')});return;
  }
  if(process.env.PATCH_BOOT_CSS==='1'&&u.pathname.endsWith('/start-page-DtNBY6rg.css')){
   interventions.push('boot-selectors');
   await r.respond({status:200,contentType:'text/css',headers:{'access-control-allow-origin':'*'},body:await readFile('/sources/patched-start-page.css','utf8')});return;
  }
  const pool=r.method()==='POST' && u.origin==='https://goodwatch.app' && u.pathname==='/api/living-room/picks' && u.searchParams.get('view')==='pool';
  if((r.method()!=='GET'&&!pool)|| /\/api\/(auth|update-|poster-impressions|og-image-warm|e$)/.test(u.pathname)) {
   blocked.push({method:r.method(),url:u.origin+u.pathname}); void r.abort();
  } else {requests.push({method:r.method(),url:r.url(),type:r.resourceType()});void r.continue();}
 });
 page.on('pageerror',e=>errors.push(String(e.message).slice(0,250)));
 await page.evaluateOnNewDocument(()=>{
  const label=e=>e ? `${e.tagName.toLowerCase()}${e.id?'#'+e.id:''}${e.className&&typeof e.className==='string'?'.'+e.className.split(' ').slice(0,3).join('.'):''}`:'';
  window.__perf={lcp:[],events:[],longTasks:[],loafs:[]};
  new PerformanceObserver(l=>window.__perf.lcp.push(...l.getEntries().map(e=>({time:e.startTime,render:e.renderTime,load:e.loadTime,size:e.size,url:e.url,element:label(e.element),text:e.element?.textContent?.slice(0,100)})))).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l=>window.__perf.events.push(...l.getEntries().filter(e=>e.interactionId).map(e=>({name:e.name,start:e.startTime,duration:e.duration,inputDelay:e.processingStart-e.startTime,processing:e.processingEnd-e.processingStart,presentation:e.startTime+e.duration-e.processingEnd,id:e.interactionId,target:label(e.target)})))).observe({type:'event',buffered:true,durationThreshold:16});
  new PerformanceObserver(l=>window.__perf.longTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  if(PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'))new PerformanceObserver(l=>window.__perf.loafs.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration,blocking:e.blockingDuration,render:e.renderStart,layout:e.styleAndLayoutStart,scripts:e.scripts.map(s=>({source:s.sourceURL,function:s.sourceFunctionName,invoker:s.invoker,duration:s.duration,forcedLayout:s.forcedStyleAndLayoutDuration,char:s.sourceCharPosition}))})))).observe({type:'long-animation-frame',buffered:true});
 });
 if(process.env.TRACE==='1') await page.tracing.start({path:out+'/'+mode+'-trace.json',categories:['devtools.timeline','v8.execute','blink.user_timing','loading','disabled-by-default-v8.cpu_profiler',...(process.env.TRACE_STYLE==='1'?['disabled-by-default-blink.debug','disabled-by-default-devtools.timeline.invalidationTracking']:[])]});
 const response=await page.goto('https://goodwatch.app/',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(Number(process.env.SETTLE_MS || 6000));
 await page.screenshot({path:out+'/'+mode+'.png',fullPage:false});
 if(process.env.PREWARM==='1'){
  await page.evaluate(()=>window.dispatchEvent(new Event('pointerdown')));
  await sleep(2000);
 }
 if(process.env.HIDE_ART==='1')await page.addStyleTag({content:'.start-camera { visibility: hidden !important; }'});
 const dom=await page.evaluate(()=>({title:document.title,text:document.body.innerText.slice(0,5000),controls:[...document.querySelectorAll('button,input,textarea,[role=button]')].filter(e=>e.getBoundingClientRect().width).map(e=>({tag:e.tagName,text:(e.innerText||'').slice(0,80),aria:e.getAttribute('aria-label'),placeholder:e.getAttribute('placeholder'),id:e.id})).slice(0,90)}));
 const actions=[];
 if(process.env.ACTIONS==='1') {
  const mark=async(name,fn)=>{const start=await page.evaluate(()=>performance.now());await fn();await sleep(1200);actions.push({name,start,end:await page.evaluate(()=>performance.now())});};
  // Adapt selectors only after the initial DOM report establishes the visible controls.
  const selector=process.env.SELECTOR;
  const click=async(sel)=>{
   const h=await page.waitForSelector(sel);await h.scrollIntoView();const box=await h.boundingBox();
   if(mode==='mobile'){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else await h.click();
  };
  if(selector)await mark('tap '+selector,async()=>{await click(selector)});
  if(process.env.TYPE_SELECTOR)await mark('type',async()=>{await click(process.env.TYPE_SELECTOR);await page.type(process.env.TYPE_SELECTOR,'funny sci-fi',{delay:100})});
 }
 await sleep(1000);
 if(process.env.TRACE==='1')await page.tracing.stop();
 if(process.env.TRACE_STYLE==='1'){
  for(const h of styles)try{h.css=(await cdp.send('CSS.getStyleSheetText',{styleSheetId:h.styleSheetId})).text}catch{}
  await writeFile(out+'/styles.json',JSON.stringify(styles));
 }
 const perf=await page.evaluate(()=>({...window.__perf,navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),resources:performance.getEntriesByType('resource').map(e=>({name:e.name,type:e.initiatorType,start:e.startTime,duration:e.duration,transfer:e.transferSize,body:e.encodedBodySize,responseStart:e.responseStart,responseEnd:e.responseEnd})),scripts:[...document.scripts].filter(s=>s.src).map(s=>s.src)}));
 if(process.env.PATCH_BROWSE==='1'&&!interventions.includes('cached-browse'))throw Error('Browse probe did not apply: remap the deployed bundle before comparing');
 if(process.env.PATCH_BOOT_CSS==='1'&&!interventions.includes('boot-selectors'))throw Error('Boot probe did not apply: recapture the deployed stylesheet before comparing');
 const result={mode,cpu,network:process.env.NETWORK||'native',status:response.status(),browser:await browser.version(),recordedAt:new Date().toISOString(),dom,actions,perf,requests,blocked,errors,interventions};
 await writeFile(out+'/'+mode+'.json',JSON.stringify(result,null,2));
 const lcp=perf.lcp.at(-1)?.time;
 console.log(JSON.stringify({mode,cpu,network:result.network,status:result.status,lcp,lcpElement:perf.lcp.at(-1),longTasks:perf.longTasks.length,maxInteraction:Math.max(0,...perf.events.map(e=>e.duration)),actions,errors},null,2));
 if(process.env.ASSERT==='1'&&((lcp||0)>2500||perf.events.some(e=>e.duration>200)))process.exitCode=1;
} finally {await browser.close()}
