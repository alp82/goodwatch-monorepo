// Self-running synthetic My List page for real-browser runs (ticket #706).
// Same structure as sim.mjs, but the carousel runs on the page's own timers.
// Every title and ID is invented.
import { pageStateScript } from './sim.mjs'

const esc = value => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function liveFixture({ n = 77, unavailable = [], visible = 6, peek = 1, renderDelay = 700, fetchDelay = 800, label = 'Meine Liste' } = {}) {
  const items = Array.from({ length: n }, (_, i) => ({ id: String(1001 + i), title: `Invented title ${i + 1}`, type: i % 3 ? 'show' : 'movie' }))
  const others = [
    { label: 'Weiterschauen', items: [{ id: '9001', title: 'Other continue', type: 'show' }, items[3]] },
    { label: 'Nochmal ansehen', items: [{ id: '9201', title: 'Other rewatch', type: 'movie' }] },
  ]
  const rows = [
    { ...others[0], stateItems: others[0].items, stateTotal: others[0].items.length, inPageState: true },
    { label, stateItems: items, stateTotal: items.length, inPageState: true },
    { ...others[1], stateItems: others[1].items, stateTotal: others[1].items.length, inPageState: true },
  ]
  const rendered = items.filter(item => !unavailable.includes(item.id))
  const config = { rendered, visible, peek, renderDelay, fetchDelay, loaded: 13, fetchSize: 13 }
  const otherRow = (row, i) => `<section class="carousel-row" data-uia="carousel-row-section-${i}"><div><div><h2>${esc(row.label)}</h2></div></div><div data-uia="carousel-scroller">${row.items.map(item => `<a data-uia="standard-card" aria-label="${esc(item.title)}" href="/browse?jbv=${item.id}"><img alt=""></a>`).join('')}</div></section>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic My List</title>
<script>window.netflix = window.netflix || {}; netflix.reactContext = { models: {} };
${pageStateScript(rows, 13)}</script>
<style>body{font:14px system-ui;background:#141414;color:#eee}section{margin:16px 0}[data-virtual-slot]{display:inline-block;width:120px;height:68px;margin:2px;background:#333;vertical-align:top}[data-virtual-slot] a{display:block;height:100%;color:#eee;font-size:11px;padding:4px;box-sizing:border-box}button{min-width:40px;min-height:40px}</style></head><body>
<button data-uia="navigation+profile-menu+trigger"><img data-uia="navigation+profile-menu+Avatar" alt="Synthetic profile" src="/avatar-a.png"></button>
<main data-uia="my-netflix"><div data-uia="browse-page-sections">
${otherRow(others[0], 0)}
<section class="carousel-row" data-uia="carousel-row-section-1" id="my-list"><div><div><h2>${esc(label)}</h2></div></div>
<div data-uia="carousel-scroller"><div dir="ltr"><button data-uia="carousel-hawkins-left-button" type="button" aria-label="Vorherige Titel sehen">&lt;</button></div>
<div class="track"><div>${Array.from({ length: visible + 2 * peek }, (_, k) => `<div data-virtual-slot="${k}"></div>`).join('')}</div></div>
<div dir="ltr"><button data-uia="carousel-hawkins-right-button" type="button" aria-label="Mehr Titel sehen">&gt;</button></div></div></section>
${otherRow(others[1], 2)}
</div></main>
<script>
(() => {
  const c = ${JSON.stringify(config)};
  const n = c.rendered.length;
  let offset = 0, advanced = false, animating = false, loaded = Math.min(c.loaded, n), fetching = false;
  const state = window.__fixture = { wraps: 0, clicks: 0, untrustedClicks: 0 };
  const slots = [...document.querySelectorAll('#my-list [data-virtual-slot]')];
  const esc = v => String(v).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  function indices() {
    if (n <= c.visible) return c.rendered.map((_, i) => i);
    const out = [];
    for (let k = advanced ? -c.peek : 0; k < c.visible + c.peek; k++) out.push(((offset + k) % n + n) % n);
    return out;
  }
  function render() {
    const idx = indices();
    slots.forEach((slot, k) => {
      const i = idx[k];
      if (i === undefined) { slot.innerHTML = ''; return; }
      const item = i < loaded ? c.rendered[i] : null;
      slot.innerHTML = item ? '<a data-uia="standard-card" aria-label="' + esc(item.title) + '" href="/browse?jbv=' + item.id + '">' + esc(item.title) + '</a>' : '<div class="skeleton"></div>';
    });
    if (Math.max(...idx, 0) + 1 > loaded && loaded < n && !fetching) {
      fetching = true;
      setTimeout(() => { fetching = false; loaded = Math.min(n, loaded + c.fetchSize); render(); }, c.fetchDelay);
    }
  }
  document.querySelector('#my-list [data-uia="carousel-hawkins-right-button"]').addEventListener('click', event => {
    state.clicks++;
    if (!event.isTrusted) state.untrustedClicks++;
    if (animating) return;
    animating = true;
    setTimeout(() => {
      animating = false; advanced = true; offset += c.visible;
      if (offset >= n) { offset = 0; state.wraps++; }
      render();
    }, c.renderDelay);
  });
  render();
})();
</script></body></html>`
}
