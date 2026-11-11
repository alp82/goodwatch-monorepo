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
  const BLOCKING = /Trying again|Try again in \d|Not connected|Reconnecting…|Connecting…|Couldn[’']t|Refresh to keep choosing|Something went wrong|YepWatch is starting|Opening the room|awaiting confirmation|Retry in \d/;
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

  const visible = (el) => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
    return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
  };
  const describe = (el) => {
    if (!el || el.nodeType !== 1) return String(el?.nodeName ?? '');
    const t = el.closest('[data-testid]');
    const label = el.getAttribute('aria-label') || el.closest('[aria-label]')?.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 40);
    return `${t ? `[${t.getAttribute('data-testid')}] ` : ''}${el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`;
  };
  function signature() {
    const on = [];
    for (const id of MARKERS) {
      const els = document.querySelectorAll(`[data-testid="${id}"]`);
      for (const el of els) if (visible(el)) { on.push(id); break; }
    }
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
  let pendingInput = null;
  let lastWordsCheck = 0;
  const mo = new MutationObserver(() => {
    dirty = true;
    if (pendingInput && !pendingInput.mutated) pendingInput.mutated = true;
  });
  const startObserving = () => mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) startObserving(); else document.addEventListener('DOMContentLoaded', startObserving);

  function check(spec) {
    if (spec.visible && !spec.visible.every((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].some(visible))) return false;
    if (spec.hidden && spec.hidden.some((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].some(visible))) return false;
    if (spec.textChanged) {
      const el = [...document.querySelectorAll(`[data-testid="${spec.textChanged.id}"]`)].find(visible);
      const text = el ? (el.getAttribute('aria-label') || el.textContent || '') : null;
      if (text === null || text === spec.textChanged.from) return false;
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
    }
    f.last = t;
    if (pendingInput && pendingInput.mutated && !pendingInput.feedbackAt) {
      pendingInput.feedbackAt = t;
      pendingInput = null;
    }
    if (dirty && document.body) {
      dirty = false;
      const sig = signature();
      const last = rec.states[rec.states.length - 1];
      if (!last || last.sig !== sig) rec.states.push({ t, sig });
      const note = [...document.querySelectorAll('[data-testid="room-note"]')].find(visible);
      const noteText = note ? note.innerText.trim().replace(/\s+/g, ' ') : '';
      const lastNote = rec.notes[rec.notes.length - 1];
      if ((lastNote?.text ?? '') !== noteText) rec.notes.push({ t, text: noteText });
      for (const [key, w] of Object.entries(rec.waiters)) {
        if (check(w.spec)) { rec.results[key] = { at: t, armedAt: w.armedAt }; delete rec.waiters[key]; }
      }
      if (t - lastWordsCheck > 100) {
        lastWordsCheck = t;
        const m = BLOCKING.exec(document.body.innerText || '');
        const text = m ? (document.body.innerText.split('\n').find((l) => BLOCKING.test(l)) || m[0]).trim().slice(0, 120) : '';
        const lastWord = rec.words[rec.words.length - 1];
        if ((lastWord?.text ?? '') !== text) rec.words.push({ t, text });
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  for (const type of ['pointerdown', 'keydown']) {
    window.addEventListener(type, (e) => {
      if (type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      const entry = { t: performance.timeOrigin + e.timeStamp, type, target: describe(e.target), mutated: false, feedbackAt: null };
      rec.inputs.push(entry);
      if (rec.inputs.length > 500) rec.inputs.shift();
      pendingInput = entry;
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
        rec.loafs.push({ t: performance.timeOrigin + e.startTime, duration: Math.round(e.duration), blocking: Math.round(e.blockingDuration || 0), scripts: (e.scripts || []).slice(0, 3).map((s) => `${s.invokerType}:${s.invoker} ${Math.round(s.duration)}ms ${(s.sourceURL || '').split('/').pop()}:${s.sourceFunctionName || ''}`) });
        if (rec.loafs.length > 300) rec.loafs.shift();
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch { /* unsupported */ }
})();
