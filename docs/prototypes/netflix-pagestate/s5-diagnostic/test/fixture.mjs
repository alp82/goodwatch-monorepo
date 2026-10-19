// Synthetic Netflix My List page and a fake GraphQL server for the end-to-end
// tests (ticket #730). Every title and ID is invented. The page's carousel
// loads later entries with CarouselPage requests, as Netflix's client does.
const b64 = n => Buffer.from(String(n)).toString('base64')
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
export const ROW_ID = 'ROW-MYLIST-1'
export const PROFILE = 'Synthetic profile'

export function makeList(n, start = 70001) {
  return Array.from({ length: n }, (_, i) => ({ id: start + i, title: `Invented title ${i + 1}`, type: i % 3 ? 'Show' : 'Movie' }))
}

function stateScript(list, { version = '1', label = 'Meine Liste', loaded = 13 } = {}) {
  const data = {
    ROOT_QUERY: {
      __typename: 'Query',
      account: { __typename: 'Account', profiles: [{ __ref: 'Profile:{"guid":"P0"}' }, { __ref: 'Profile:{"guid":"P1"}' }] },
      currentProfile: { __ref: 'Profile:{"guid":"P0"}' },
      'pinotBrowsePage({"categoryId":null})': { __ref: 'PinotDefaultBrowsePage:PS1' },
    },
    'Profile:{"guid":"P0"}': { __typename: 'Profile', guid: 'P0', name: PROFILE },
    'Profile:{"guid":"P1"}': { __typename: 'Profile', guid: 'P1', name: 'Second profile' },
  }
  const sectionKey = 'PinotCarouselSection:{"id":"S1"}'
  const edges = list.slice(0, loaded).map((item, p) => {
    const ek = `${item.type}:{"videoId":${item.id}}`
    data[ek] = { __typename: item.type, videoId: item.id }
    const tk = `PinotStandardBoxshotEntityTreatment:T${item.id}`
    data[tk] = { __typename: 'PinotStandardBoxshotEntityTreatment', id: `T${item.id}`, displayString: item.title, unifiedEntity: { __ref: ek } }
    return { __typename: 'PinotEntityEdge', node: { __ref: tk }, cursor: b64(p) }
  })
  data[sectionKey] = {
    __typename: 'PinotCarouselSection', _id: ROW_ID, id: 'S1', displayString: label, version,
    entities: { __typename: 'PinotEntityConnection', totalCount: list.length, edges, pageInfo: { __typename: 'PageInfo', hasNextPage: list.length > edges.length, endCursor: edges.length ? b64(edges.length - 1) : null } },
  }
  data['PinotDefaultBrowsePage:PS1'] = { __typename: 'PinotDefaultBrowsePage', 'sections({"after":null,"first":50})': { __typename: 'PinotSectionConnection', edges: [{ node: { __ref: sectionKey } }] } }
  const json = JSON.stringify({ data })
  const literal = json.replace(/[\\'"\u0080-￿]/g, c => (c === '\\' ? '\\\\' : c === "'" ? '\\x27' : c === '"' ? '\\x22' : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`))
  return `window.netflix = window.netflix || {}; netflix.reactContext = { models: {} };\nnetflix.reactContext.models.graphql = JSON.parse('${literal}');`
}

// options: list, transport ('fetch' | 'xhr'), prefetch (fetch page 2 at load), visible, twoArrows
export function netflixPage(o) {
  const visible = o.visible ?? 6
  const initial = o.list.slice(0, 13).map(i => ({ id: i.id, title: i.title }))
  const config = { visible, peek: 1, rowId: ROW_ID, version: o.version ?? '1', total: o.list.length, transport: o.transport ?? 'fetch', prefetch: Boolean(o.prefetch), initial, renderDelay: 500 }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic My List</title>
<script>${stateScript(o.list, { version: config.version })}</script>
<style>[data-virtual-slot]{display:inline-block;width:110px;height:60px;margin:2px;background:#333;color:#eee;font-size:10px;vertical-align:top}</style></head><body>
<button data-uia="navigation+profile-menu+trigger"><img data-uia="navigation+profile-menu+Avatar" alt="${esc(PROFILE)}" src="/avatar-a.png"></button>
<main data-uia="my-netflix"><div data-uia="browse-page-sections">
<section class="carousel-row" data-uia="carousel-row-section-0"><div><div><h2>Weiterschauen</h2></div></div><div data-uia="carousel-scroller"><a data-uia="standard-card" aria-label="Other continue" href="/browse?jbv=99001"></a></div></section>
<section class="carousel-row" data-uia="carousel-row-section-1" id="my-list"><div><div><h2>Meine Liste</h2></div></div>
<div data-uia="carousel-scroller"><div dir="ltr"><button data-uia="carousel-hawkins-left-button" type="button" aria-label="Vorherige Titel sehen">&lt;</button></div>
<div class="track"><div>${Array.from({ length: visible + 2 }, (_, k) => `<div data-virtual-slot="${k}"></div>`).join('')}</div></div>
<div dir="ltr"><button data-uia="carousel-hawkins-right-button" type="button" aria-label="Mehr Titel sehen">&gt;</button></div>${o.twoArrows ? '<div dir="ltr"><button data-uia="carousel-hawkins-right-button" type="button">&gt;</button></div>' : ''}</div></section>
</div></main>
<script>
(() => {
  const c = ${JSON.stringify(config)};
  const items = c.initial.slice();
  let offset = 0, advanced = false, animating = false, fetching = false, hasMore = c.total > items.length;
  const state = window.__fixture = { wraps: 0, clicks: 0, requests: 0 };
  const slots = [...document.querySelectorAll('#my-list [data-virtual-slot]')];
  const esc = v => String(v).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  function body(after) {
    return JSON.stringify({ operationName: 'CarouselPage', variables: { rowId: c.rowId, carouselAfterCursor: btoa(String(after)), carouselPageSize: 2 * c.visible, carouselVersion: c.version, eddEnabled: false }, extensions: { persistedQuery: { version: 1, sha256Hash: 'synthetic' } } });
  }
  function received(json) {
    const conn = json && json.data && json.data.node && json.data.node.entities;
    if (!conn) { hasMore = false; return; }
    for (const e of conn.edges) items.push({ id: e.node.unifiedEntity.videoId, title: e.node.displayString });
    hasMore = conn.pageInfo.hasNextPage;
  }
  function loadMore() {
    if (fetching || !hasMore) return;
    fetching = true;
    state.requests++;
    const done = json => { fetching = false; received(json); render(); };
    if (c.transport === 'xhr') {
      const x = new XMLHttpRequest();
      x.open('POST', '/graphql');
      x.setRequestHeader('content-type', 'application/json');
      x.onload = () => { try { done(JSON.parse(x.responseText)); } catch { fetching = false; } };
      x.send(body(items.length - 1));
    } else {
      fetch('/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body(items.length - 1), credentials: 'include' })
        .then(r => r.json()).then(done).catch(() => { fetching = false; });
    }
  }
  function indices() {
    const n = items.length;
    if (n <= c.visible) return items.map((_, i) => i);
    const out = [];
    for (let k = advanced ? -c.peek : 0; k < c.visible + c.peek; k++) {
      const i = offset + k;
      if (i < 0 || i >= n) { if (!hasMore) out.push(((i % n) + n) % n); } else out.push(i);
    }
    return out;
  }
  function render() {
    const idx = indices();
    slots.forEach((slot, k) => {
      const i = idx[k];
      const item = i === undefined ? null : items[i];
      slot.innerHTML = item ? '<a data-uia="standard-card" aria-label="' + esc(item.title) + '" href="/browse?jbv=' + item.id + '">' + esc(item.title) + '</a>' : '';
    });
    if (offset + c.visible + c.peek >= items.length) loadMore();
  }
  document.querySelector('#my-list [data-uia="carousel-hawkins-right-button"]').addEventListener('click', () => {
    state.clicks++;
    if (animating) return;
    animating = true;
    setTimeout(() => {
      animating = false; advanced = true; offset += c.visible;
      if (offset >= items.length && !hasMore) { offset = 0; state.wraps++; }
      else if (offset >= items.length) offset = items.length - c.visible;
      render();
    }, c.renderDelay);
  });
  render();
  if (c.prefetch) loadMore();
})();
</script></body></html>`
}

// A fake GraphQL server. `list` can be changed between requests by `mutate`.
export function graphqlServer(o) {
  const server = { list: o.list.slice(), requests: 0, version: o.version ?? '1' }
  server.handle = body => {
    if (!body || body.operationName !== 'CarouselPage') return { status: 200, body: { data: {} } }
    server.requests++
    if (o.mutate) o.mutate(server)
    const after = body.variables.carouselAfterCursor ? Number(Buffer.from(body.variables.carouselAfterCursor, 'base64').toString()) : -1
    const size = body.variables.carouselPageSize
    const total = server.list.length
    const edges = []
    for (let p = after + 1; p < Math.min(total, after + 1 + size); p++) {
      const it = server.list[p]
      edges.push({ __typename: 'PinotEntityEdge', cursor: b64(p), node: { __typename: 'PinotStandardBoxshotEntityTreatment', id: `T${it.id}`, displayString: it.title, unifiedEntity: { __typename: it.type, videoId: it.id, unifiedEntityId: `U${it.id}` } } })
    }
    const last = after + edges.length
    return {
      status: 200,
      delay: o.delay ?? 300,
      body: { data: { node: { __typename: 'PinotCarouselSection', _id: ROW_ID, id: 'S1', displayString: 'Meine Liste', version: server.version, entities: { __typename: 'PinotEntityConnection', edges, pageInfo: { __typename: 'PageInfo', hasNextPage: last < total - 1, endCursor: b64(last) }, totalCount: total } } } },
    }
  }
  return server
}

export function s5Page(o) {
  return netflixPage(o).replace('</head>', `<script>
    Object.assign(netflix.reactContext.models, {
      serverDefs:{data:{BUILD_IDENTIFIER:'synthetic-s5-build'}},
      geo:{data:{locale:{id:'en-US',dir:'ltr'}}}, browserInfo:{data:{isMobile:false}},
      fastProps:{data:{'shakti.graphql.deployedClientUrl':'/graphql','shakti.graphql.pre-persisted-queries.enable':true,'shakti.graphql.useLowercaseLocale':false}},
      abProperties:{data:{properties:{enableEDD:false}}}
    });</script><script src="/akiraClient.synthetic.js"></script></head>`)
}
