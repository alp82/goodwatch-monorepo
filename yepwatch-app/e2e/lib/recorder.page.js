// Injected into every page before the app loads (addInitScript). Records, page-side and frame by frame:
//  - the visible screen state (screen/sheet/state markers keyed on test ids) and every change of it,
//  - room-note words and blocking words on screen,
//  - input events and the first frame that changed after each (tap feedback),
//  - layout shifts, long animation frames, rAF frame gaps,
//  - armed waiters: "first frame where <condition> holds", for timing moments.
// All times are epoch ms with sub-ms precision (performance.timeOrigin + performance.now()), so samples from
// different pages on one machine compare directly.
(() => {
  if (window.__yw) return;
  const now = () => performance.timeOrigin + performance.now();
  const SCREENS = ['landing', 'home-rooms', 'mood-page', 'room-setup', 'waiting', 'voting', 'matches', 'proposal', 'tonight',
    'join-screen', 'room-status', 'delete-account-page'];
  const SHEETS = ['rooms-sheet', 'room-sheet', 'services-sheet', 'streaming-sheet', 'kinds-sheet', 'people-sheet', 'profile-panel',
    'history-panel', 'details-panel', 'trailer-panel', 'leave-confirm'];
  const STATES = ['room-opening', 'finding-more', 'poster', 'match-moment', 'yepwatch-boot', 'invite-head-pending', 'invite-head',
    'profile-lapsed', 'start-reconnect', 'room-note'];
  const MARKERS = [...SCREENS, ...SHEETS, ...STATES];
  // Blocking and connection words (lib/rules.mjs BLOCKING_WORDS, CONNECTION_WORDS). Every visible line that has
  // one is recorded, joined by " ¦ ", so the gates can tell one connection line from two.
  const BLOCKING = /Trying again|Try again in \d|Not connected|Reconnecting|Connecting…|You[’']re offline|is saved|Couldn[’']t|Refresh to keep choosing|Something went wrong|YepWatch is starting|Opening the room|awaiting confirmation|Retry in \d/;
  const rec = {
    startedAt: now(),
    states: [], // {t, sig}
    notes: [], // {t, text}
    words: [], // {t, text} blocking words visible anywhere
    inputs: [], // {t, type, target, feedbackAt}
    shifts: [],
    loafs: [],
    frames: { count: 0, over20: [], max: 0, last: 0 },
    waiters: {},
    results: {},
    hidden: [],
  };
  window.__yw = rec;
  // Diagnosis only (E2E_DIAG=1, lib/harness.ts): every frame gap over 17 ms, when each room answer (POST under
  // /proposal/) and WebSocket message arrived, and when React committed. Never on in a gated run.
  const diag = window.__ywDiag === true ? { gaps: [], posts: [], ws: [], commits: [] } : null;
  rec.diag = diag;
  const cap = (list, n) => { if (list.length > n) list.shift(); };
  if (diag) {
    // Ties a Chrome trace's clock to the recorder's epoch-ms clock.
    performance.mark(`yw:epoch:${(performance.timeOrigin + performance.now()).toFixed(1)}`);
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if ((e.initiatorType !== 'fetch' && e.initiatorType !== 'xmlhttprequest') || !/\/proposal\//.test(e.name)) continue;
          diag.posts.push({ start: performance.timeOrigin + e.startTime, t: performance.timeOrigin + e.responseEnd, path: new URL(e.name).pathname.split('/').slice(-2).join('/') });
          cap(diag.posts, 600);
        }
      }).observe({ type: 'resource', buffered: true });
    } catch { /* unsupported */ }
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', (e) => {
          const head = typeof e.data === 'string' ? e.data.slice(0, 200) : '';
          diag.ws.push({ t: now(), n: typeof e.data === 'string' ? e.data.length : 0, type: (/"type":"([^"]+)"/.exec(head) || [])[1] || '' });
          // One full room update, the largest seen, for replaying its handling offline.
          if (typeof e.data === 'string' && e.data.length > (diag.sample?.length ?? 0) && head.includes('room.updated')) diag.sample = e.data;
          cap(diag.ws, 2000);
        });
      }
    };
    // A minimal React DevTools hook: the time of every commit.
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true, renderers: new Map(), isDisabled: false, checkDCE() {},
      inject(r) { this.renderers.set(this.renderers.size + 1, r); return this.renderers.size; },
      onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
      onCommitFiberRoot(_id, root) {
        diag.commits.push(now());
        cap(diag.commits, 4000);
        // E2E_DIAG=renders: which components rendered in this commit (needs an unminified build for names).
        if (window.__ywDiagRenders !== true) return;
        const names = {};
        const nameOf = (f) => { const t = f.type; if (!t || typeof t === 'string') return null; return t.displayName || t.name || t.render?.displayName || t.render?.name || t.type?.displayName || t.type?.name || null; };
        const stack = [root.current];
        let n = 0;
        while (stack.length && n < 20000) {
          const f = stack.pop(); n++;
          if (f.flags & 1) { const nm = nameOf(f); if (nm) names[nm] = (names[nm] ?? 0) + 1; }
          if (f.sibling) stack.push(f.sibling);
          if (f.child) stack.push(f.child);
        }
        (diag.renders ??= []).push({ t: now(), names });
        cap(diag.renders, 1500);
      },
    };
  }

  const visible = (el) => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
    return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
  };
  // The one "visible" predicate (in the viewport, not transparent or hidden through any ancestor), also for
  // native/lib/mixed.mjs's browser friend.
  rec.visible = visible;
  const describe = (el) => {
    if (!el || el.nodeType !== 1) return String(el?.nodeName ?? '');
    const t = el.closest('[data-testid]');
    const label = el.getAttribute('aria-label') || el.closest('[aria-label]')?.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 40);
    return `${t ? `[${t.getAttribute('data-testid')}] ` : ''}${el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`;
  };
  // Every element carrying a marker test id, kept from the mutation records (added subtrees, changed test ids)
  // instead of one document-wide query per marker on every changed frame, which was about a third of the
  // recorder's time. Only elements in the document tree count, as for document.querySelectorAll; disconnected ones
  // are dropped when read. Until the observer watches the current root element (before it exists, or after the root
  // is replaced) the document is queried as before.
  const MARKER_SET = new Set(MARKERS);
  const ORDER = new Map(MARKERS.map((id, i) => [id, i]));
  const markers = new Set();
  let observed = null; // the root element the observer watches and the registry was filled from
  const scan = (node) => {
    if (node.nodeType !== 1) return;
    if (MARKER_SET.has(node.getAttribute('data-testid'))) markers.add(node);
    if (node.firstElementChild) for (const el of node.querySelectorAll('[data-testid]')) if (MARKER_SET.has(el.getAttribute('data-testid'))) markers.add(el);
  };
  const inDocument = (el) => el.isConnected && el.getRootNode() === document;
  const byDocumentOrder = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  /** The elements with marker test id `id` in the document, in document order. */
  const markersOf = (id) => {
    if (observed !== document.documentElement) return [...document.querySelectorAll(`[data-testid="${id}"]`)];
    onMutations(mo.takeRecords());
    return [...markers].filter((el) => inDocument(el) && el.getAttribute('data-testid') === id).sort(byDocumentOrder);
  };
  let lastLook = null;
  function signature() {
    const found = new Set();
    if (observed !== document.documentElement) {
      startObserving();
      for (const id of MARKERS) if ([...document.querySelectorAll(`[data-testid="${id}"]`)].some(visible)) found.add(id);
    } else {
      onMutations(mo.takeRecords());
      for (const el of markers) {
        const id = el.getAttribute('data-testid');
        if (!inDocument(el) || !MARKER_SET.has(id)) { markers.delete(el); continue; }
        if (!found.has(id) && visible(el)) found.add(id);
      }
    }
    const on = [...found].sort((a, b) => ORDER.get(a) - ORDER.get(b));
    if (diag) lastLook = found.has('poster') ? markersOf('poster').find((el) => el.hasAttribute('data-look') && visible(el))?.getAttribute('data-look') ?? null : null;
    // Voting with nothing on the stage: no card, no "Finding more…", and no poster image painted anywhere in it.
    if (on.includes('voting') && !on.includes('poster') && !on.includes('finding-more') && !SHEETS.some((s) => on.includes(s)) && !on.includes('matches') && !on.includes('proposal') && !on.includes('tonight')) {
      const stage = [...document.querySelectorAll('[data-testid="voting"]')].find(visible);
      const painted = stage && [...stage.querySelectorAll('img, div')].some((el) => (el.tagName === 'IMG' ? /posters?\//.test(el.src) : /posters?\//.test(el.style.backgroundImage || '')) && visible(el));
      if (!painted) on.push('voting-empty');
    }
    return on.join(' ');
  }
  rec.signature = signature;

  let dirty = true;
  // Inputs waiting for their first changed frame. A quick double or triple tap lands several inputs
  // before the next frame: each one gets the first frame that shows a change made after it.
  let pendingInputs = [];
  let wordsDue = false;
  let lastWordsCheck = 0;
  function onMutations(records) {
    if (!records.length) return;
    for (const r of records) {
      if (r.type === 'childList') for (const n of r.addedNodes) scan(n);
      else if (r.type === 'attributes' && r.attributeName === 'data-testid') scan(r.target);
    }
    dirty = true;
    for (const input of pendingInputs) input.mutated = true;
  }
  const mo = new MutationObserver(onMutations);
  function startObserving() {
    const root = document.documentElement;
    if (!root || observed === root) return;
    mo.disconnect();
    markers.clear();
    scan(root);
    mo.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    observed = root;
    dirty = true;
  }
  if (document.documentElement) startObserving(); else document.addEventListener('DOMContentLoaded', startObserving);

  function check(spec) {
    if (spec.visible && !spec.visible.every((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].some(visible))) return false;
    if (spec.any && !spec.any.some((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].some(visible))) return false;
    if (spec.hidden && spec.hidden.some((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].some(visible))) return false;
    if (spec.textChanged) {
      const el = [...document.querySelectorAll(`[data-testid="${spec.textChanged.id}"]`)].find(visible);
      const text = el ? (el.getAttribute('aria-label') || el.textContent || '') : null;
      if (text === null || text === spec.textChanged.from) return false;
    }
    if (spec.cardChanged) {
      // The voting card's title, from its accessible label "<title>. Swipe or use the choice buttons."
      const sel = '[aria-label$="Swipe or use the choice buttons."]';
      const card = [...document.querySelectorAll('[data-testid="poster"]')].find(visible);
      const el = card && (card.closest(sel) || card.querySelector(sel));
      const title = el ? el.getAttribute('aria-label').replace(/\. Swipe or use the choice buttons\.$/, '') : null;
      if (title === null || title === spec.cardChanged.from) return false;
    }
    if (spec.label) {
      const el = [...document.querySelectorAll('[aria-label]')].find((e) => (spec.label.exact ? e.getAttribute('aria-label') === spec.label.text : new RegExp(spec.label.text).test(e.getAttribute('aria-label'))) && visible(e));
      if (!el) return false;
    }
    if (spec.text) {
      const re = new RegExp(spec.text);
      if (!re.test(document.body?.innerText ?? '')) return false;
    }
    return true;
  }
  rec.arm = (key, spec) => {
    rec.waiters[key] = { spec, armedAt: now() };
    delete rec.results[key];
    dirty = true;
  };

  function frame(ts) {
    const t = performance.timeOrigin + ts;
    const f = rec.frames;
    if (f.last && document.visibilityState === 'visible') {
      const gap = t - f.last;
      f.count++;
      if (gap > f.max) f.max = gap;
      if (gap > 20) { f.over20.push([Math.round(t), Math.round(gap)]); if (f.over20.length > 400) f.over20.shift(); }
      if (diag && gap > 17) {
        diag.gaps.push([Math.round(t), Math.round(gap)]);
        cap(diag.gaps, 3000);
        // Found again in a Chrome trace (E2E_PERF_TRACE): the frame that ended at `t` after `gap` ms.
        performance.mark(`yw:slow:${Math.round(t)}:${Math.round(gap)}`);
      }
    }
    f.last = t;
    if (pendingInputs.some((input) => input.mutated)) {
      for (const input of pendingInputs) if (input.mutated && !input.feedbackAt) input.feedbackAt = t;
      pendingInputs = pendingInputs.filter((input) => !input.feedbackAt);
    }
    if (dirty && document.body) {
      dirty = false;
      wordsDue = true;
      const sig = signature();
      const last = rec.states[rec.states.length - 1];
      if (!last || last.sig !== sig) rec.states.push({ t, sig });
      const note = markersOf('room-note').find(visible);
      const noteText = note ? note.innerText.trim().replace(/\s+/g, ' ') : '';
      const lastNote = rec.notes[rec.notes.length - 1];
      if ((lastNote?.text ?? '') !== noteText) rec.notes.push({ t, text: noteText });
      for (const [key, w] of Object.entries(rec.waiters)) {
        if (check(w.spec)) { rec.results[key] = { at: t, armedAt: w.armedAt }; delete rec.waiters[key]; }
      }
    }
    // At most every 100 ms, but a change that came in during those 100 ms is still looked at once they are over: a
    // line that went away right after a check was otherwise recorded as visible until some later change.
    if (wordsDue && document.body && t - lastWordsCheck > 100) {
      wordsDue = false;
      lastWordsCheck = t;
      const all = document.body.innerText || '';
      const text = BLOCKING.test(all) ? all.split('\n').map((l) => l.trim()).filter((l) => l && BLOCKING.test(l)).map((l) => l.slice(0, 120)).join(' ¦ ') : '';
      const lastWord = rec.words[rec.words.length - 1];
      if ((lastWord?.text ?? '') !== text) rec.words.push({ t, text });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  for (const type of ['pointerdown', 'keydown']) {
    window.addEventListener(type, (e) => {
      if (type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      const entry = { t: performance.timeOrigin + e.timeStamp, type, target: describe(e.target), mutated: false, feedbackAt: null };
      // Diagnosis: the look of the voting card the input was aimed at (Poster's data-look).
      if (diag) entry.look = lastLook;
      rec.inputs.push(entry);
      if (rec.inputs.length > 500) rec.inputs.shift();
      pendingInputs.push(entry);
      if (pendingInputs.length > 20) pendingInputs.shift();
    }, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => rec.hidden.push({ t: now(), state: document.visibilityState }));

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        rec.shifts.push({ t: performance.timeOrigin + e.startTime, value: e.value, sources: (e.sources || []).map((s) => ({ node: describe(s.node), from: s.previousRect && [s.previousRect.x, s.previousRect.y, s.previousRect.width, s.previousRect.height].map(Math.round), to: s.currentRect && [s.currentRect.x, s.currentRect.y, s.currentRect.width, s.currentRect.height].map(Math.round) })) });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* unsupported */ }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        rec.loafs.push({ t: performance.timeOrigin + e.startTime, duration: Math.round(e.duration), blocking: Math.round(e.blockingDuration || 0), scripts: [...(e.scripts || [])].sort((a, b) => b.duration - a.duration).slice(0, 3).map((s) => `${s.invokerType}:${s.invoker} ${Math.round(s.duration)}ms ${(s.sourceURL || '').split('/').pop()}:${s.sourceFunctionName || ''}`) });
        if (rec.loafs.length > 300) rec.loafs.shift();
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch { /* unsupported */ }
})();
