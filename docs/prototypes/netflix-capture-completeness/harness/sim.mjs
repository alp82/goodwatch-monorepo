// Synthetic Netflix My List page for ticket #706. Every title and ID is invented.
// The structure follows the saved de-DE page: section.carousel-row rows with an
// h2 label, a carousel scroller with virtual slots, standard-card anchors that
// carry a /browse?jbv=<id> link, hawkins next/previous buttons, and an inline
// page-state script with each row's totalCount and its first loaded edges.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const { Window } = require('happy-dom')

// ---- Virtual clock ------------------------------------------------------
export function createClock() {
  let now = Date.UTC(2026, 9, 19, 12, 0, 0)
  let seq = 0
  const timers = new Map()
  const errors = []
  const add = (fn, ms, every) => {
    const id = ++seq
    timers.set(id, { id, fn, at: now + Math.max(0, Number(ms) || 0), every })
    return id
  }
  const flush = async () => {
    for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve))
  }
  async function advanceTo(target) {
    for (;;) {
      let next = null
      for (const timer of timers.values()) {
        if (timer.at <= target && (!next || timer.at < next.at || (timer.at === next.at && timer.id < next.id))) next = timer
      }
      if (!next) break
      now = next.at
      if (next.every) next.at += next.every
      else timers.delete(next.id)
      try {
        next.fn()
      } catch (error) {
        errors.push(error)
      }
      await flush()
    }
    now = target
    await flush()
  }
  return {
    now: () => now,
    setTimeout: (fn, ms) => add(fn, ms),
    clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => add(fn, ms, Math.max(1, Number(ms) || 1)),
    clearInterval: id => timers.delete(id),
    advance: ms => advanceTo(now + ms),
    errors,
  }
}

// ---- Page state -----------------------------------------------------------
const uuid = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`
// profile: { profiles: [names], current: name }. The current profile and the
// browse page that owns the sections are recorded as on the saved page.
export function pageStateScript(rows, loadedCount, profile = { profiles: ['Synthetic profile', 'Second profile'], current: 'Synthetic profile' }) {
  const profileKey = i => `Profile:{"guid":"P${i}"}`
  const data = {
    ROOT_QUERY: {
      __typename: 'Query',
      account: { __typename: 'Account', profiles: profile.profiles.map((_, i) => ({ __ref: profileKey(i) })) },
      ...(profile.current !== null ? { currentProfile: { __ref: profileKey(profile.profiles.indexOf(profile.current)) } } : {}),
      'pinotBrowsePage({"categoryId":null})': { __ref: 'PinotDefaultBrowsePage:PS_synthetic' },
    },
  }
  profile.profiles.forEach((name, i) => { data[profileKey(i)] = { __typename: 'Profile', guid: `P${i}`, name } })
  const sectionRefs = []
  let n = 0
  for (const row of rows) {
    if (!row.inPageState) continue
    const sectionKey = `PinotCarouselSection:{"id":"${uuid(++n)}"}`
    const edges = row.stateItems.slice(0, loadedCount).map((item, position) => {
      const entityKey = `${item.type === 'movie' ? 'Movie' : 'Show'}:{"videoId":${item.id}}`
      data[entityKey] = { __typename: item.type === 'movie' ? 'Movie' : 'Show', videoId: Number(item.id), title: item.title }
      const treatmentKey = `PinotStandardBoxshotEntityTreatment:standardBoxshot_Video:${item.id}_${uuid(++n)}`
      data[treatmentKey] = { __typename: 'PinotStandardBoxshotEntityTreatment', unifiedEntity: { __ref: entityKey } }
      return { __typename: 'PinotEntityEdge', node: { __ref: treatmentKey }, cursor: Buffer.from(String(position)).toString('base64') }
    })
    sectionRefs.push(sectionKey)
    data[sectionKey] = {
      __typename: 'PinotCarouselSection',
      displayString: row.label,
      entities: {
        __typename: 'PinotEntityConnection',
        totalCount: row.stateTotal,
        edges,
        pageInfo: { __typename: 'PageInfo', hasNextPage: row.stateTotal > edges.length, endCursor: edges.at(-1)?.cursor ?? null },
      },
    }
  }
  data['PinotDefaultBrowsePage:PS_synthetic'] = {
    __typename: 'PinotDefaultBrowsePage',
    'sections({"after":null,"first":50})': { __typename: 'PinotSectionConnection', edges: sectionRefs.map(ref => ({ node: { __ref: ref } })) },
  }
  // Encode like the saved page: a single-quoted literal with \x22 quotes.
  const json = JSON.stringify({ data })
  const literal = json.replace(/[\\'"\u0080-￿]/g, c =>
    c === '\\' ? '\\\\' : c === "'" ? '\\x27' : c === '"' ? '\\x22' : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
  return `netflix.reactContext.models.graphql = JSON.parse('${literal}');`
}

const esc = value => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const cardHtml = item => `<a data-uia="standard-card" aria-label="${esc(item.title)}" href="/browse?jbv=${item.id}"><img alt=""></a>`

// ---- Page -----------------------------------------------------------------
// options: see DEFAULTS. Items are {id, title, type}.
const DEFAULTS = {
  label: 'Meine Liste',
  items: [],
  otherRows: [],
  layout: 'carousel',
  visible: 6,
  peek: 1,
  loaded: 13,
  fetchSize: 13,
  fetchDelay: 800,
  renderDelay: 700,
  recycle: 'replace',
  staggerMs: 120,
  unavailable: [],
  pageState: true,
  stateTotal: null,
  contaminants: [],
  emptyRow: 'none',
  avatar: '/avatar-a.png',
  avatarAlt: 'Synthetic profile',
  stateProfile: undefined,
  // Path the document was first loaded at (SPA arrival when it differs).
  loadedPath: '/browse/my-list',
}

export function createPage(clock, options = {}) {
  const o = { ...DEFAULTS, ...options }
  const window = new Window({
    url: 'https://www.netflix.com/browse/my-list',
    settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
  })
  const doc = window.document
  const unavailable = new Set(o.unavailable)
  const myList = {
    label: o.label,
    stateItems: [...o.items],
    stateTotal: o.stateTotal ?? o.items.length,
    inPageState: o.pageState,
  }
  const rows = [
    ...o.otherRows.filter(row => row.position === 'before').map(row => ({ ...row, stateItems: row.items, stateTotal: row.items.length, inPageState: o.pageState })),
    ...(o.items.length || o.emptyRow === 'section' ? [myList] : []),
    ...o.otherRows.filter(row => row.position !== 'before').map(row => ({ ...row, stateItems: row.items, stateTotal: row.items.length, inPageState: o.pageState })),
  ]
  if (!o.items.length && o.emptyRow === 'state-only') rows.push({ ...myList, stateTotal: 0, rendered: false })

  doc.write(`<!doctype html><html><head></head><body>
<button data-uia="navigation+profile-menu+trigger"><img data-uia="navigation+profile-menu+Avatar" alt="${o.avatarAlt}" src="${o.avatar}"></button>
<main data-uia="my-netflix"><div data-uia="browse-page-sections"></div></main></body></html>`)
  if (o.pageState) {
    const script = doc.createElement('script')
    script.textContent = `window.netflix = window.netflix || {};\n${pageStateScript(rows, o.loaded, o.stateProfile)}`
    doc.head.append(script)
  }
  const host = doc.querySelector('[data-uia="browse-page-sections"]')
  const carousels = []
  let sectionIndex = 0
  for (const row of rows) {
    if (row.rendered === false) continue
    if (row === myList && !o.items.length) continue
    const isMyList = row === myList
    if (o.layout === 'grid' && isMyList) {
      const grid = doc.createElement('div')
      grid.className = 'mainView'
      grid.innerHTML = `<div class="gallery">${o.items.filter(i => !unavailable.has(i.id)).map(item =>
        `<div class="ptrack-content" data-ui-tracking-context="${esc(JSON.stringify({ video_id: Number(item.id) }))}"><a href="/title/${item.id}"><span class="fallback-text">${esc(item.title)}</span></a></div>`).join('')}</div>`
      host.append(grid)
      continue
    }
    const rendered = isMyList ? [...o.items.filter(item => !unavailable.has(item.id))] : [...row.items]
    if (isMyList) for (const c of o.contaminants) rendered.splice(Math.min(c.index, rendered.length), 0, c.item)
    carousels.push(createCarousel(doc, clock, host, row.label, rendered, sectionIndex++, isMyList ? o : { ...o, recycle: 'replace' }, isMyList))
  }

  const mine = carousels.find(c => c.isMyList) || null
  return {
    window,
    document: doc,
    loadedUrl: `https://www.netflix.com${o.loadedPath}`,
    myList: mine,
    groundTruth: o.items.map(item => item.id),
    otherIds: new Set(o.otherRows.flatMap(row => row.items.map(item => item.id))),
    switchProfile() {
      const img = doc.querySelector('img[data-uia="navigation+profile-menu+Avatar"]')
      img.setAttribute('src', '/avatar-b.png')
      img.setAttribute('alt', 'Second profile')
    },
    navigateAway() {
      window.history.pushState({}, '', '/browse')
    },
    replaceMyListSection() {
      mine.replaceSection()
    },
    addItem(item, index) {
      mine.insert(item, index)
    },
    removeItem(id) {
      mine.remove(id)
    },
    close() {
      window.happyDOM.abort()
      window.close()
    },
  }
}

function createCarousel(doc, clock, host, label, rendered, index, o, isMyList) {
  const slotsCount = o.visible + 2 * o.peek
  let section = doc.createElement('section')
  let slots = []
  let offset = 0
  let advanced = false
  let animating = false
  let loadedCount = Math.min(o.loaded, rendered.length)
  let fetching = false
  let clicks = 0
  let wraps = 0

  function build() {
    section.className = 'carousel-row'
    section.setAttribute('data-uia', `carousel-row-section-${index}`)
    section.innerHTML = `<div><div><h2>${esc(label)}</h2></div></div>
<div data-uia="carousel-scroller"><div dir="ltr"><button data-uia="carousel-hawkins-left-button" type="button" aria-label="Vorherige Titel sehen"></button></div>
<div class="track"><div>${Array.from({ length: slotsCount }, (_, k) => `<div data-virtual-slot="${k}"></div>`).join('')}</div></div>
<div dir="ltr"><button data-uia="carousel-hawkins-right-button" type="button" aria-label="Mehr Titel sehen"></button></div></div>`
    slots = [...section.querySelectorAll('[data-virtual-slot]')]
    section.querySelector('[data-uia="carousel-hawkins-right-button"]').addEventListener('click', onNext)
  }
  function windowIndices() {
    const n = rendered.length
    if (n <= o.visible) return rendered.map((_, i) => i)
    const out = []
    for (let k = advanced ? -o.peek : 0; k < o.visible + o.peek; k++) out.push(((offset + k) % n + n) % n)
    return out
  }
  function setSlot(slot, item) {
    const anchor = slot.querySelector('a[data-uia="standard-card"]')
    if (!item) {
      slot.innerHTML = '<div class="skeleton"></div>'
      return
    }
    if (o.recycle === 'replace' || !anchor) {
      slot.innerHTML = cardHtml(item)
      return
    }
    if (anchor.getAttribute('href') === `/browse?jbv=${item.id}` && anchor.getAttribute('aria-label') === item.title) return
    if (o.recycle === 'atomic') {
      anchor.setAttribute('href', `/browse?jbv=${item.id}`)
      anchor.setAttribute('aria-label', item.title)
    } else if (o.recycle === 'href-first') {
      anchor.setAttribute('href', `/browse?jbv=${item.id}`)
      clock.setTimeout(() => anchor.setAttribute('aria-label', item.title), o.staggerMs)
    } else {
      anchor.setAttribute('aria-label', item.title)
      clock.setTimeout(() => anchor.setAttribute('href', `/browse?jbv=${item.id}`), o.staggerMs)
    }
  }
  function render() {
    const indices = windowIndices()
    slots.forEach((slot, k) => {
      const i = indices[k]
      if (i === undefined) slot.innerHTML = ''
      else setSlot(slot, i < loadedCount ? rendered[i] : null)
    })
    const needed = Math.max(...indices, 0) + 1
    if (needed > loadedCount && loadedCount < rendered.length && !fetching) {
      fetching = true
      clock.setTimeout(() => {
        fetching = false
        loadedCount = Math.min(rendered.length, loadedCount + o.fetchSize)
        render()
      }, o.fetchDelay)
    }
  }
  function onNext() {
    clicks++
    if (animating) return
    animating = true
    clock.setTimeout(() => {
      animating = false
      advanced = true
      offset += o.visible
      if (offset >= rendered.length) {
        offset = 0
        wraps++
      }
      render()
    }, o.renderDelay)
  }
  build()
  host.append(section)
  render()
  return {
    isMyList,
    get offset() { return offset },
    get wraps() { return wraps },
    get clicks() { return clicks },
    get visibleIds() { return windowIndices().filter(i => i < loadedCount).map(i => rendered[i]?.id) },
    nextButton: () => section.querySelector('[data-uia="carousel-hawkins-right-button"]'),
    replaceSection() {
      const old = section
      section = doc.createElement('section')
      build()
      old.replaceWith(section)
      render()
    },
    insert(item, at) {
      rendered.splice(at, 0, item)
      if (at < loadedCount) loadedCount++
      render()
    },
    remove(id) {
      const at = rendered.findIndex(item => item.id === id)
      if (at < 0) return
      rendered.splice(at, 1)
      if (at < loadedCount) loadedCount--
      render()
    },
  }
}

// ---- Collector in an isolated context --------------------------------------
// Mirrors the extension's isolated world: the collector sees the DOM, not page
// JavaScript objects.
export function loadCollector(page, clock, collectorPath) {
  const source = readFileSync(collectorPath, 'utf8')
  const w = page.window
  const context = vm.createContext({
    document: w.document,
    location: w.location,
    MutationObserver: w.MutationObserver,
    URL,
    atob,
    JSON,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [clock.now()])) }
      static now() { return clock.now() }
    },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    // The document's own navigation entry: where it was first loaded.
    performance: { getEntriesByType: type => (type === 'navigation' ? [{ name: page.loadedUrl ?? 'https://www.netflix.com/browse/my-list' }] : []) },
  })
  vm.runInContext(source, context)
  return command => context.__goodwatchWishlistCaptureCommand(command)
}
