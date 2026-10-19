/* Owner-only S5. Commands/results contain counts only; no page method wrappers.
 * All per-run private state is behind one revocable holder, including pending
 * request arguments. Late promises capture the holder, never private copies. */
(() => {
  if (globalThis.GWS5Command) return;
  const A = globalThis.GWS5Adapter, M = globalThis.GWS5Provenance;
  const now = () => performance.now();
  const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
  let active = null, last = {state:'idle'}, sequence = 0;
  const fail = code => { throw Object.assign(new Error(code), {s5Code:code}); };
  const known = new Set(['boundary_missing', 'budget_exceeded', 'build_changed', 'build_unsupported', 'cancelled', 'card_outside_entries', 'card_title_conflict', 'cleanup_failed', 'document_changed', 'endpoint_unsupported', 'entity_type_unknown', 'entries_limit', 'fetch_displaced', 'fetch_unavailable', 'fetch_wrapped', 'finalize_error', 'finalize_timeout', 'guard_error', 'id_conflict', 'member_stopped', 'page_unsupported', 'platform_unsupported', 'position_duplicate', 'position_gap', 'prefix_conflict', 'profile_changed', 'provenance_changed', 'read_error', 'read_timeout', 'reference_ambiguous', 'reference_bad_edge', 'reference_missing', 'reference_no_label', 'reference_no_profile', 'reference_no_row_id', 'reference_no_total', 'reference_no_version', 'reference_not_on_page', 'reference_other_page', 'reference_other_profile', 'reference_profile_ambiguous', 'reference_stale', 'reference_too_large', 'reference_unreadable', 'repeat_conflict', 'request_failed', 'request_limit', 'request_timeout', 'request_too_large', 'response_connection', 'response_cursor', 'response_end_cursor', 'response_entity', 'response_errors', 'response_has_next', 'response_json', 'response_label', 'response_node', 'response_positions', 'response_row_id', 'response_too_large', 'response_total', 'response_type', 'response_version', 'service_worker_changed', 'service_worker_controlled', 'session_ended', 'start_error', 'unobserved_positions', 'variables_unsupported', 'zero_with_row']);
  const safeCode = (e,fallback) => known.has(e?.s5Code) ? e.s5Code : fallback;
  known.add('auth_required'); known.add('response_status');
  function report(h, code) {
    return {version:1,module:'netflix',mode:'s5_owner_only',verdict:h.reference ? 'partial' : 'unknown',reason:code || 'snapshot_unproven',
      stickyCodes:[...(code ? [code] : []),'snapshot_unproven'], networkBehavior:'unproven', fetchIntegrity:h.integrity || 'unchecked',
      serviceWorkerState:h.workerState || 'unchecked',
      reportedTotal:h.reference?.total ?? null, s5IssuedCalls:h.calls, abandonedCalls:h.abandoned,
      singleResponseFullPasses:h.passes.filter(p => p.outcome === 'single_response_full').length,
      pagedFullPasses:h.passes.filter(p => p.outcome === 'paged_full').length, pageSizeClamped:h.clamped,
      agreement:h.agreement, passes:h.passes.map(p => ({...p})), responses:h.responses.map(p => ({...p})),
      acceptedPages:h.responses.filter(p => p.accepted).length, rejectedPages:h.responses.filter(p => !p.accepted).length,
      cardsSeen:h.cards.size,cardsOutsideEntries:h.cardOutside,cardTitleConflicts:h.cardConflicts,
      budgetPeakBytes:h.peakBytes,
      coverage:h.maps.map((m,i) => ({pass:i+1,positionsCovered:m.size,unobservedPositions:Math.max(0,(h.reference?.total || 0)-m.size)})),
      entriesNeverRendered:h.maps[0].size - [...h.maps[0].keys()].filter(id => h.cards.has(id)).length,
      passesStarted:Number.isInteger(h.pass)?Math.min(h.pass+1,2):0,passesCompleted:h.passes.length,
      failureCounts:code?{[code]:1}:{},cursorAdvances:h.responses.filter(p=>p.accepted).length,
      cursorInvalidTransitions:['response_cursor','response_end_cursor','position_gap','position_duplicate','response_positions','response_has_next'].includes(code)?1:0,
      readWindowSeconds:(now()-h.started)/1000, cleanupResult:'released'};
  }
  function release(h) {
    if (h.released) return true;
    h.released = true;
    let ok=true;
    const clean = fn => {try {fn();}catch {ok=false;}};
    clean(() => {for (const t of h.timers) clearTimeout(t);h.timers.clear();});
    clean(() => h.controller?.abort());
    clean(() => {Promise.resolve(h.reader?.cancel()).catch(() => {});});
    for (const off of h.listeners || []) clean(off);
    clean(() => M.release());
    for (const map of h.maps) map.clear();
    for (const key of Object.keys(h)) {
      const value = h[key];
      if (value instanceof Map || value instanceof Set) value.clear();
      if (Array.isArray(value)) value.length = 0;
      if (!['released','generation'].includes(key)) h[key] = null;
    }
    return ok;
  }
  function finish(h, code) {
    if (h.released || active !== h) return;
    const finalizeStarted=now();
    let result;
    try {
      if (!code) {
        guard(h); h.pass=Math.min(h.pass,1); crossCheck(h);
        for (let i=0;i<h.passes.length;i++) {
          if (h.maps[i].size !== h.reference.total) fail('unobserved_positions');
          const positions=new Set([...h.maps[i].values()].map(e => e.position));
          for(let p=0;p<h.reference.total;p++) if(!positions.has(p)) fail('unobserved_positions');
        }
      }
      if (h.responses.at(-1) && !h.responses.at(-1).accepted) Object.assign(h.responses.at(-1),{milliseconds:now()-h.callStarted,code:code || 'read_error'});
      result = report(h, code);
    }
    catch (e) { result = report(h, safeCode(e,'finalize_error')); }
    const cleaned=release(h); active = null;
    if(!cleaned) {result.reason='cleanup_failed';result.stickyCodes.unshift('cleanup_failed');result.cleanupResult='failed';}
    if(now()-finalizeStarted>5000) {result.reason='finalize_timeout';result.stickyCodes.unshift('finalize_timeout');result.cleanupResult='failed';}
    last = freeze({state:'finalized',report:result});
  }
  function guard(h) {
    if (h.released) fail('session_ended');
    if (now() > h.started + 90000) fail('read_timeout');
    if (h.inCall && now() > h.callDeadline) fail('request_timeout');
    if (performance.now() > 600000 || !M.matchesPage() || !M.rowPresent() || !M.referenceUnchanged()) fail('provenance_changed');
    if (M.profileMarker() !== h.marker) fail('profile_changed');
    if (A.settings().fingerprint !== h.settings.fingerprint) fail('build_changed');
    const d = (h.descriptorOf || Object.getOwnPropertyDescriptor)(window,'fetch');
    if (h.fetch && (!d || d.value !== h.fetch || d.writable !== h.fetchDescriptor.writable || d.enumerable !== h.fetchDescriptor.enumerable || d.configurable !== h.fetchDescriptor.configurable)) fail('fetch_displaced');
    if (navigator.serviceWorker?.controller) fail('service_worker_changed');
    sampleCards(h);
  }
  function sampleCards(h) {
    for (const c of M.readCards()) {
      const prev=h.cardStates.get(c.element);
      if (prev && prev.id === c.sourceId && prev.title === c.title && now()-prev.since >= 100) h.cards.set(c.sourceId,c.title);
      else if (!prev || prev.id !== c.sourceId || prev.title !== c.title) h.cardStates.set(c.element,{id:c.sourceId,title:c.title,since:now()});
    }
    if (h.cardStates.size > 5000 || h.cards.size > 5000) fail('entries_limit');
    budget(h);
  }
  const cost = e => 64+2*(e.title.length+e.id.length);
  function budget(h,extra=0) {
    const cardBytes=[...h.cardStates.values()].reduce((n,e) => n+cost(e),0)+[...h.cards].reduce((n,[id,title]) => n+cost({id,title}),0);
    const bytes=(h.retainedBytes || 0)+cardBytes+(h.bytes || 0)+2*(h.text?.length || 0)+2*(h.request?.body?.length || 0)+extra;
    h.peakBytes=Math.max(h.peakBytes || 0,bytes);
    if(bytes>8388608) fail('budget_exceeded');
  }
  function crossCheck(h) {
    h.cardOutside=0; h.cardConflicts=0;
    for (const [id,title] of h.cards) {
      const e=h.maps[h.pass].get(id);
      if (!e) h.cardOutside++;
      else if (e.title !== title) h.cardConflicts++;
    }
    if (h.cardOutside) fail('card_outside_entries');
    if (h.cardConflicts) fail('card_title_conflict');
  }
  function selectFetch(h) {
    const d=Object.getOwnPropertyDescriptor(window,'fetch');
    if (!d || !Object.hasOwn(d,'value') || typeof d.value !== 'function') fail('fetch_unavailable');
    if (!/\[native code\]/.test(Function.prototype.toString.call(d.value))) fail('fetch_wrapped');
    h.fetch=d.value; h.fetchDescriptor=d; h.apply=Reflect.apply; h.descriptorOf=Object.getOwnPropertyDescriptor; h.integrity='native_like_unproven';
    h.workerState=navigator.serviceWorker?.controller ? 'controlled' : 'uncontrolled';
    if (h.workerState === 'controlled') fail('service_worker_controlled');
    h.listeners=[];
    const onWorker=() => interrupt(h,'service_worker_changed');
    navigator.serviceWorker?.addEventListener('controllerchange',onWorker);
    h.listeners.push(() => navigator.serviceWorker?.removeEventListener('controllerchange',onWorker));
    const onPage=() => interrupt(h,'document_changed');
    window.addEventListener('pagehide',onPage);
    window.addEventListener('pageshow',onPage);
    h.listeners.push(() => { window.removeEventListener('pagehide',onPage); window.removeEventListener('pageshow',onPage); });
    const poll=() => {
      try { guard(h); tracked(h,poll,100); } catch(e) { interrupt(h,safeCode(e,'guard_error')); }
    };
    tracked(h,poll,100);
  }
  function interrupt(h,code) {
    if (h.released) return;
    if (h.interrupt) { if (h.inCall) h.abandoned++; h.interrupt(code); }
    finish(h,code);
  }
  function tracked(h, fn, delay) {
    const t = setTimeout(() => { h.timers?.delete(t); if (!h.released) fn(); }, delay);
    h.timers.add(t); return t;
  }
  function invoke(h) {
    const generation = h.generation;
    return new Promise((resolve, reject) => {
      h.callTimer = tracked(h, () => interrupt(h,'request_timeout'), Math.min(8000,h.started+90000-now()));
      h.interrupt = code => { h.controller.abort(); reject(Object.assign(new Error(),{s5Code:code})); };
      h.calls++;
      try {
        const p = h.apply(h.fetch, window, ['https://www.netflix.com/graphql',{
          method:'POST', mode:'same-origin', credentials:'same-origin', redirect:'error', cache:'no-store',
          headers:h.request.headers, body:h.request.body, signal:h.controller.signal,
        }]);
        Promise.resolve(p).then(response => {
          if (h.released || h.generation !== generation) { response.body?.cancel().catch(() => {}); return; }
          h.response=response; resolve();
        }, () => { if (!h.released) reject(Object.assign(new Error(),{s5Code:'request_failed'})); }).catch(() => {if(!h.released)reject(Object.assign(new Error(),{s5Code:'request_failed'}));});
      } catch { reject(Object.assign(new Error(),{s5Code:'request_failed'})); }
    });
  }
  async function page(h) {
    guard(h);
    h.request = A.request(h.reference,h.after,h.size,h.settings);
    if (h.request.body.length > 65536 || JSON.stringify(h.request.variables).length > 16384) fail('request_too_large');
    if (h.calls >= 60) fail('request_limit');
    h.controller = new AbortController(); h.callStarted = now(); h.callDeadline=Math.min(h.started+90000,h.callStarted+8000); h.inCall=true;
    h.measurement={pass:h.pass+1,requestedSize:h.size,returnedSize:null,bytes:0,milliseconds:0,accepted:false};
    h.responses.push(h.measurement);
    await invoke(h);
    guard(h);
    if (h.response.status !== 200) fail(h.response.status === 401 || h.response.status === 403 ? 'auth_required' : 'response_status');
    if (h.response.url !== 'https://www.netflix.com/graphql' || !/application\/json\b/i.test(h.response.headers.get('content-type') || '')) fail('response_type');
    h.reader = h.response.body.getReader(); h.chunks = []; h.bytes = 0; h.text=''; h.decoder=new TextDecoder('utf-8',{fatal:true});
    for (;;) {
      const part = await h.reader.read(); guard(h);
      if (part.done) break;
      h.bytes += part.value.byteLength;
      h.measurement.bytes=h.bytes;
      if (h.bytes > 2097152) fail('response_too_large');
      h.chunks.push(part.value);
      h.text+=h.decoder.decode(part.value,{stream:true}); budget(h);
    }
    h.text+=h.decoder.decode();
    guard(h);
    try {h.json = JSON.parse(h.text);} catch {fail('response_json');}
    h.measurement.returnedSize=Array.isArray(h.json?.data?.node?.entities?.edges) ? h.json.data.node.entities.edges.length : null;
    {
      const candidate=A.parse(h.json,h.reference,h.afterPosition,h.size);
      guard(h);
      h.page=candidate;
    }
    h.measurement.returnedSize=h.page.entries.length; h.measurement.milliseconds=now()-h.callStarted;
    budget(h,h.page.entries.reduce((n,e) => n+cost(e),0));
    if (h.page.entries.length < Math.min(h.size,h.reference.total-h.afterPosition-1) && h.page.hasNext) h.clamped = true;
    for (const e of h.page.entries) {
      const prefix = h.reference.entries[e.position];
      if (prefix && (prefix.id !== e.id || prefix.title !== e.title || prefix.entityType !== e.entityType)) fail('prefix_conflict');
      if (h.maps[h.pass].has(e.id)) fail('id_conflict');
    }
    for (const e of h.page.entries) h.maps[h.pass].set(e.id,e);
    h.retainedBytes+=h.page.entries.reduce((n,e) => n+cost(e),0);
    h.responses.at(-1).accepted=true;
    h.after = h.page.cursor; h.afterPosition = h.page.last; h.hasNext = h.page.hasNext;
    clearTimeout(h.callTimer); h.timers.delete(h.callTimer); h.callTimer=null; h.inCall=false; h.interrupt=null;
    h.request = h.response = h.reader = h.chunks = h.text = h.json = h.page = h.decoder = h.measurement = null; h.bytes=0;
  }
  const gap = h => new Promise((resolve,reject) => { h.interrupt = code => reject(Object.assign(new Error(),{s5Code:code})); tracked(h,resolve,1000); });
  async function run(h) {
    try {
      for (h.pass=0; h.pass<2; h.pass++) {
        h.after=null; h.afterPosition=-1; h.hasNext=true;
        const firstCall = h.calls;
        while (h.hasNext) { if (h.calls) await gap(h); await page(h); }
        crossCheck(h);
        h.passes.push({outcome:h.calls-firstCall === 1 ? 'single_response_full' : 'paged_full',calls:h.calls-firstCall,positionsCovered:h.maps[h.pass].size,unobservedPositions:h.reference.total-h.maps[h.pass].size});
        if (h.pass === 0 && h.calls-firstCall > 1) break;
      }
      if (h.passes.length === 2) {
        h.agreement = JSON.stringify([...h.maps[0].values()]) === JSON.stringify([...h.maps[1].values()]);
        if (!h.agreement) fail('repeat_conflict');
      }
      finish(h);
    } catch (e) { if (!h.released) finish(h, safeCode(e,'read_error')); }
  }
  globalThis.GWS5Command = command => {
    if (command === 'start' && !active) {
      const h = {generation:++sequence,released:false,started:now(),timers:new Set(),calls:0,abandoned:0,
        passes:[],responses:[],maps:[new Map(),new Map()],cardStates:new Map(),cards:new Map(),cardOutside:0,cardConflicts:0,clamped:false,agreement:null,
        reference:null,settings:null,marker:null,request:null,response:null,reader:null,chunks:null,text:null,json:null,page:null,after:null,retainedBytes:0,peakBytes:0};
      active=h;
      if (A.fixture && typeof globalThis.__s5TestHook === 'function') globalThis.__s5TestHook(h);
      try {
        h.settings=A.settings();
        const r=M.readReference(); if (!r.reference) fail(r.refusal || 'reference_missing');
        h.reference=r.reference; h.marker=M.profileMarker(); h.size=Math.min(h.reference.total,200);
        h.retainedBytes=h.reference.entries.reduce((n,e) => n+cost(e),0);
        if (!h.reference.total) fail('zero_with_row');
        selectFetch(h);
        run(h);
      } catch(e) { finish(h,safeCode(e,'start_error')); }
    } else if (active && ['stop','cancel'].includes(command)) {
      interrupt(active,command === 'stop' ? 'member_stopped' : 'cancelled');
    }
    return active ? {state:'collecting',s5IssuedCalls:active.calls,reportedTotal:active.reference?.total ?? null} : last;
  };
})();
