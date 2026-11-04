/** Local preview only. Imports no application entrypoint, route, scheduler, or search-history writer. */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TypeSafeClient } from '@typesafe-ai/sdk'
import Redis, { type Cluster } from 'ioredis'

export const config = {
  policy: 'v7-cross-retrieval-identity-fold',
  // The study's frozen ranker build and identity tables: historical evidence only. The preview ranks with the
  // search index the app currently has loaded (rankSearch always does) and reports that build as `index`.
  frozenIndex: '20261103T051503Z',
  frozenIdentity: { titleTable: 'fa555e263fae3a798a57925eb945b7cb314cbd33', alternateCuts: 'd0c554f11ee69a5804ec04706d7824736c4a71af' },
  testedSnapshot: '20261104T003315Z',
  dataMode: 'live-current',
  interpretedAt: '2026-11-03',
  rankedLimit: 5000,
  cacheDir: process.env.GOODWATCH_SEARCH_PREVIEW_CACHE_DIR || resolve(homedir(), '.cache/goodwatch-search-preferences-preview'),
  readOnlyProductionAccess: true,
} as const
const artifacts = fileURLToPath(new URL('../../../docs/verification/search-preferences-2026-11-04/', import.meta.url))
const oldArtifacts = '/tmp/goodwatch-broad-filter-eval'
const normalize = (value: string) => value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase().normalize('NFC')
const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24)
const clock = () => new Date(config.interpretedAt)

type Proposal = { parameter: string; value: string; status: string; [key: string]: unknown }
export type Order = { keys: number[]; total: number }
export type PolicyOrders = {
  policy: string; params: string; error: string | null; total: number
  relevance: Order; bestRated: Order
}
export type SearchResult = {
  query: string; semanticQuery: string; existing: string
  branch: 'title-guard' | 'negative-baseline' | 'positive' | 'budget-baseline'
  source: Awaited<ReturnType<typeof initialize>>
  baseline: PolicyOrders; v7: PolicyOrders; policies: [PolicyOrders, PolicyOrders]
  prefs: Proposal[]; retainedHard: Proposal[]; recognized: number[]; negativeClauses: string[]
  params: { baseline: string; v7: string }; timing: Record<string, unknown>
  identityRepairs: { identity: string; alias: number; preferred: number }[]
  transportAction: string; catalogue: boolean
  proposals: Proposal[]; readingChips: unknown[]
  hardHides: { phrase: string; params: [string, string][]; hides: number; universe: 'search' | 'catalog' }[]
}
export type Card = {
  key: number; title: string; year: number | null; type: 'movie' | 'show'
  poster: string | null; posterPath: string | null; score: number | null
  genres: string[]; synopsis: string; url: string
}
type Rank = { keys: number[]; error?: string; build?: string; pool?: number; route?: string; ms?: number }
type Source = { index: string; frozenIndex: string; indexIsFrozen: boolean; identityTables: { titleTable: string; alternateCuts: string; matchFrozen: boolean }; snapshot: string; testedSnapshot: string; dataMode: string; policy: string; cacheDir: string; interpretedAt: string }
type Runtime = { app: Record<string, any>; index: any; snapshot: any; redis: Cluster; client: TypeSafeClient; source: Source; identity: (key: number) => string }
type Generation = { index: any; identity: (key: number) => string; source: Pick<Source, 'index' | 'frozenIndex' | 'indexIsFrozen' | 'identityTables'> }
const generations = new Map<string, Generation>()
let initialization: Promise<Runtime> | undefined
let live: Runtime | undefined
let lastComparisonSnapshot: any
let closing: Promise<void> | undefined
let snapshotNodes: {host: string; port: number}[] | undefined
let snapshotConnection: Cluster | undefined
let snapshotReaderConfigured = false
const pendingReadings = new Map<string, Promise<any>>()
const pendingRanks = new Map<string, Promise<Rank & { cacheHit: boolean; elapsedMs: number }>>()
const cardCache = new Map<number, Card>()

function json(path: string): any { return JSON.parse(readFileSync(path, 'utf8')) }
function save(path: string, value: unknown) { writeFileSync(path, JSON.stringify(value)) }
function hard(proposal: Proposal) {
  return proposal.parameter === 'themes' && proposal.value === 'true' || proposal.parameter === 'styles' && ['animated', 'documentary'].includes(proposal.value)
}
class SnapshotChangedError extends Error {}
/** One comparison's search index and title snapshot belong together; a refresh of either mid-comparison retries it. */
function assertPinned(runtime: Runtime) {
  const loaded = runtime.app.loadedSearchIndexBuild()
  if (loaded !== runtime.index.buildId) {
    throw new SnapshotChangedError(`Preview search index refreshed during comparison (${runtime.index.buildId} → ${loaded ?? 'unavailable'}). Retry the search.`)
  }
  const snapshot = runtime.app.getTitleSnapshot()
  if (snapshot?.version !== runtime.snapshot.version) {
    throw new SnapshotChangedError(`Preview catalog refreshed during comparison (${runtime.snapshot.version} → ${snapshot?.version ?? 'unavailable'}). Retry the search.`)
  }
}

/** Identity folding (IMDb ids and alternate cuts) from one search index build, the same build the ranker uses. */
function generationOf(index: any): Generation {
  const cached = generations.get(index.buildId)
  if (cached && cached.index === index) return cached
  const parent = new Map<number, number>(), known = new Set<number>(), firstImdb = new Map<string, number>()
  const find = (key: number): number => { const p = parent.get(key); if (p === undefined) { parent.set(key, key); return key } if (p === key) return key; const root = find(p); parent.set(key, root); return root }
  const unite = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parent.set(Math.max(a, b), Math.min(a, b)) }
  for (let i = 0; i < index.titleTable.size; i++) {
    const key = index.titleTable.pointIds[i], imdb = index.titleTable.imdbIds[i]?.trim() || null
    if (imdb) { known.add(key); if (firstImdb.has(imdb)) unite(key, firstImdb.get(imdb)!); else { firstImdb.set(imdb, key); find(key) } }
  }
  for (const [a, neighbours] of index.alternateCuts) for (const b of neighbours) { known.add(a); known.add(b); unite(a, b) }
  const titleTable = index.manifest.files.title_table.sha1, alternateCuts = index.manifest.files.alternate_cuts.sha1
  const generation: Generation = { index, identity: key => known.has(key) ? `known:${find(key)}` : `unknown-key:${key}`,
    source: { index: index.buildId, frozenIndex: config.frozenIndex, indexIsFrozen: index.buildId === config.frozenIndex,
      identityTables: { titleTable, alternateCuts, matchFrozen: titleTable === config.frozenIdentity.titleTable && alternateCuts === config.frozenIdentity.alternateCuts } } }
  // Keep only the current build and the one before it.
  for (const build of [...generations.keys()]) if (build !== index.buildId && generations.size >= 2) generations.delete(build)
  generations.set(index.buildId, generation)
  return generation
}

async function loadRuntime(): Promise<Runtime> {
  // Preserve coordinates only for the explicit GET-only snapshot reader. Normal app caches stay disabled.
  const nodes = snapshotNodes ??= ['REDIS_HOST', 'REDIS_HOST2', 'REDIS_HOST3'].map(key => ({ host: process.env[key]!, port: Number(process.env.REDIS_PORT) }))
  process.env.REDIS_HOST = ''
  const modules = await Promise.all([
    import('~/domain/discover-query'), import('~/domain/filter-state'), import('~/domain/discover-search'),
    import('~/server/combined-search/reading-retrieval.server'), import('~/server/search-runtime/runtime.server'),
    import('~/server/combined-search/language.server'), import('~/server/search-ranking/search-index.server'),
    import('~/server/search-ranking/rank-search.server'), import('~/server/search-ranking/query-encoder.server'),
    import('~/server/title-snapshot/index.server'), import('~/domain/cited-year'), import('~/server/utils/fingerprint'),
    import('~/domain/themes-styles'), import('~/server/title-filter/index.server'), import('~/domain/genre-fold'),
    import('~/utils/crate'), import('~/server/search-ranking/concept-query.server'),
    import('~/server/search-ranking/references.server'), import('~/server/title-filter/order.server'),
    import('~/server/search-ranking/query-parsing.server'),
  ])
  const app = Object.assign({}, ...modules)
  const redis = new Redis.Cluster(nodes, {
    redisOptions: { password: process.env.REDIS_PASS, connectTimeout: 10000, commandTimeout: 30000, maxRetriesPerRequest: 1 },
    slotsRefreshTimeout: 10000, clusterRetryStrategy: () => null,
  })
  snapshotConnection = redis
  try {
    if (!snapshotReaderConfigured) {
      app.configureTitleSnapshotReader({
        get: (key: string) => snapshotConnection ? snapshotConnection.get(key) : Promise.reject(new Error('Preview snapshot reader is closed.')),
        getBuffer: (key: string) => snapshotConnection ? snapshotConnection.getBuffer(key) : Promise.reject(new Error('Preview snapshot reader is closed.')),
      })
      snapshotReaderConfigured = true
    }
    app.getTitleSnapshot()
    const index = await app.getSearchIndex()
    let snapshot = app.getTitleSnapshot()
    for (let i = 0; !snapshot && i < 180; i++) { await new Promise(resolve => setTimeout(resolve, 500)); snapshot = app.getTitleSnapshot() }
    if (!snapshot) throw new Error(`Preview source unavailable: index ${index.buildId} / snapshot unavailable.`)
    for (const name of ['readings', 'ranks']) mkdirSync(resolve(config.cacheDir, name), { recursive: true })
    const generation = generationOf(index)
    const runtime: Runtime = { app, index, snapshot, redis,
      client: new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY!, defaultModel: app.JEV_MODEL, timeout: 20000, retry: { maxRetries: 1 }, logLevel: 'off' }),
      identity: generation.identity,
      source: { ...generation.source, snapshot: snapshot.version, testedSnapshot: config.testedSnapshot, dataMode: config.dataMode, policy: config.policy, cacheDir: config.cacheDir, interpretedAt: config.interpretedAt },
    }
    live = runtime
    return runtime
  } catch (error) {
    app.stopTitleSnapshot()
    app.stopSearchIndex()
    redis.disconnect()
    if (snapshotConnection === redis) snapshotConnection = undefined
    throw error
  }
}
export async function initialize() {
  if (closing) await closing
  initialization ??= loadRuntime().catch(error => { initialization = undefined; throw error })
  const ready = await initialization
  const current = ready.app.getTitleSnapshot(), index = ready.app.loadedSearchIndex() ?? ready.index
  return { ...ready.source, ...generationOf(index).source, snapshot: current?.version ?? ready.snapshot.version }
}
async function runtime() {
  await initialize()
  if (!live) throw new Error('Preview engine closed during the request. Retry after initialization.')
  const snapshot = live.app.getTitleSnapshot()
  if (!snapshot) throw new Error('Preview catalog snapshot is unavailable.')
  // The build the ranker will use now (getSearchIndex returns the loaded one), with its own identity tables.
  const generation = generationOf(await live.app.getSearchIndex())
  const captured = { ...live, index: generation.index, identity: generation.identity, snapshot, source: { ...live.source, ...generation.source, snapshot: snapshot.version } }
  assertPinned(captured)
  return captured
}

async function capture(rt: Runtime, text: string) {
  const name = hash(text), local = resolve(config.cacheDir, 'readings', `${name}.json`)
  if (pendingReadings.has(name)) return pendingReadings.get(name)!
  const work = (async () => {
    for (const file of [local, resolve(artifacts, 'readings', `${name}.json`), resolve(oldArtifacts, 'readings', `${name}.json`)]) {
      if (existsSync(file)) return { ...json(file), cacheHit: true }
    }
    // One ordinary query reading, shared by original and V7; never a title-analysis/model-writing job.
    const raw = await Promise.all([
      rt.client.systemOne({ ...rt.app.attributeRequest(text), model: rt.app.JEV_MODEL }),
      rt.client.systemOne({ ...rt.app.fingerprintRequest(text), model: rt.app.JEV_MODEL }),
    ])
    const result = { text, raw, titleLookup: null, source: 'preview-live', capturedAt: new Date().toISOString() }
    save(local, result)
    return { ...result, cacheHit: false }
  })()
  pendingReadings.set(name, work)
  try { return await work } finally { pendingReadings.delete(name) }
}
async function titleLookup(rt: Runtime, text: string, reading: any) {
  if (Array.isArray(reading.titleLookup)) return reading.titleLookup.filter((row: any) => row.eligible !== false)
  const name = `${hash(text)}-lookup.json`, local = resolve(config.cacheDir, 'readings', name)
  for (const file of [local, resolve(artifacts, 'readings', name), resolve(oldArtifacts, 'readings', name)]) if (existsSync(file)) return json(file)
  const words = rt.app.citedYear(text)?.title ?? text, rows: any[] = []
  for (let page = 1; page <= 5; page++) {
    const params = new URLSearchParams({ api_key: process.env.TMDB_API_KEY || '', query: words, language: 'en-US', include_adult: 'false', page: String(page) })
    const response = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`Read-only title lookup failed: HTTP ${response.status}`)
    const body = await response.json() as any
    for (const row of body.results ?? []) {
      if (!['movie', 'tv'].includes(row.media_type) || row.adult === true) continue
      const key = (row.media_type === 'tv' ? 2e12 : 1e12) + row.id, facts = rt.snapshot.facts(key)
      if (!(row.poster_path || facts?.hasPoster) || facts?.adult) continue
      rows.push({ id: row.id, title: row.title || row.name || 'Untitled', original: row.original_title || row.original_name, type: row.media_type, year: String(row.release_date || row.first_air_date || '').slice(0, 4), poster: row.poster_path ?? null, popularity: row.popularity ?? 0, eligible: true })
    }
    if (page >= (body.total_pages ?? 1)) break
  }
  save(local, rows); return rows
}
async function retrieve(rt: Runtime, text: string, semanticQuery: string, params: URLSearchParams, reading: any, lookup: any[], foreign: boolean) {
  const state = rt.app.filterStateFromParams(params, { onMyServices: false, notSeenYet: false })
  const eligibility = rt.app.searchEligibility(state, { country: state.streamingCountry ?? 'DE', services: [] }, clock())
  const build: string = rt.index.buildId
  const signature = JSON.stringify(eligibility), name = hash(JSON.stringify([text, signature])), pendingKey = `${build}:${name}`
  if (pendingRanks.has(pendingKey)) return pendingRanks.get(pendingKey)!
  const work = (async () => {
    const start = performance.now(), local = resolve(config.cacheDir, 'ranks', `${pendingKey.replace(':', '-')}.json`)
    const candidates = [local, ...['v6-confirmation2/ranks', 'v6-executor-preflight/ranks', 'v3/ranks', 'ranks'].map(folder => resolve(artifacts, folder, `${name}.json`)), resolve(oldArtifacts, 'ranks', `${name}.json`)]
    for (const file of candidates) if (existsSync(file)) {
      const value = json(file) as Rank
      // Ranks are per index build: a rank from another build (such as the frozen study build) is never reused.
      if (value.build !== build) continue
      return { ...value, cacheHit: true, elapsedMs: performance.now() - start }
    }
    let rank: Rank
    try {
      const result = await rt.app.rankSearch(reading, { query: semanticQuery, text, nonEnglish: foreign, titleLookup: lookup, resultLimit: 5000, trace: false }, { includeAdult: false, lesserKnown: false, filters: eligibility })
      if (result.buildId !== build) throw new SnapshotChangedError(`Preview search index refreshed during ranking (${build} → ${result.buildId}). Retry the search.`)
      rank = { keys: result.results.map((row: any) => row.id), pool: result.poolSize, route: result.route, build: result.buildId, ms: result.timings.total }
    } catch (error) {
      const message = String(error)
      if (!/limit.*(?:0 invalid|must be 1|value 0)/i.test(message)) throw error
      rank = { keys: [], pool: 0, error: message, build }
    }
    save(local, rank)
    return { ...rank, cacheHit: false, elapsedMs: performance.now() - start }
  })()
  pendingRanks.set(pendingKey, work)
  try { return await work } finally { pendingRanks.delete(pendingKey) }
}
const viewer = { viewer: { kind: 'guest' }, country: 'DE', services: [], seen: new Set(), ratings: new Map(), wishlist: new Map(), skipped: new Set(), notInterested: new Set(), hidden: new Set(), forYou: false }
async function filtered(rt: Runtime, universe: number[] | 'catalog', params: URLSearchParams, sort: 'relevance' | 'top') {
  assertPinned(rt)
  const state = rt.app.filterStateFromParams(params, { onMyServices: false, notSeenYet: false })
  const result = await rt.app.filterTitles({ universe, state, sort, taste: null, forYou: null, viewer, includeNotInterested: true })
  assertPinned(rt)
  return result.keys as number[]
}
function namedTitles(rt: Runtime, query: string) {
  const text = normalize(query), cited = rt.app.citedYear(text), names = [text, ...(cited ? [normalize(cited.title)] : [])], table = rt.index.titleTable
  if (rt.app.detect(rt.index, text)) return []
  const threshold = rt.app.conceptTitles(rt.index, text) ? rt.app.CONCEPT_TITLE_VOTES : 1000, matches: number[] = []
  for (let i = 0; i < table.size; i++) if (table.votes[i] >= threshold && names.some(name => name === normalize(table.titles[i]) || name === normalize(table.originalTitles[i] || '')) && (!cited || names[0] === normalize(table.titles[i]) || table.years[i] === cited.year)) {
    const facts = rt.snapshot.facts(table.pointIds[i]); if (facts?.hasPoster && !facts.adult && facts.score !== null) matches.push(table.pointIds[i])
  }
  return matches
}
function fp(rt: Runtime, key: number, dimension: string) {
  const value = rt.snapshot.fingerprint(key)?.[rt.app.VALID_FINGERPRINT_KEYS.indexOf(dimension)]
  return value === undefined || value === 255 ? null : value
}
function strength(rt: Runtime, key: number, prefs: Proposal[]) {
  if (!prefs.length) return 1
  const facts = rt.snapshot.facts(key), genres: string[] = facts?.genres ?? []
  return prefs.reduce((sum, pref) => {
    let value = 0
    if (pref.parameter === 'moods') value = facts?.moods.includes(pref.value) ? 1 : 0
    else if (pref.parameter === 'genres') {
      if (facts?.mediaType === 'show' && pref.value === 'War' && genres.includes('War & Politics')) value = (fp(rt, key, 'warfare') ?? 0) / 10
      else if (facts?.mediaType === 'show' && pref.value === 'Fantasy' && genres.includes('Sci-Fi & Fantasy')) value = (fp(rt, key, 'fantasy') ?? 0) / 10
      else value = rt.app.foldGenres(genres).includes(pref.value) ? 1 : 0
    } else if (pref.parameter === 'themes' && pref.value === 'history') value = (fp(rt, key, 'historical') ?? 0) / 10
    else {
      const rule = (pref.parameter === 'themes' ? rt.app.THEMES : rt.app.STYLES).find((rule: any) => rule.id === pref.value)
      value = rule ? Math.max(0, Math.min(1, rule.level((name: string) => fp(rt, key, name) ?? 0, genres) / 10)) : 0
    }
    return sum + value
  }, 0) / prefs.length
}
function hardMembership(rt: Runtime, key: number, pref: Proposal) {
  const row = rt.snapshot.rowOf(key); if (row < 0) return false
  const names = pref.parameter === 'themes' ? rt.app.THEME_KEYS : rt.app.STYLE_KEYS, mask = pref.parameter === 'themes' ? rt.snapshot.columns.themes[row] : rt.snapshot.columns.styles[row]
  return (mask & (1 << names.indexOf(pref.value))) !== 0
}
function qualityComparator(rt: Runtime) {
  const compare = rt.app.compareRows(rt.snapshot.columns, 'top')
  return (a: number, b: number) => {
    const ar = rt.snapshot.rowOf(a), br = rt.snapshot.rowOf(b)
    if (ar >= 0 && br >= 0) return compare(ar, br)
    const score = (key: number) => rt.snapshot.facts(key)?.score ?? -1
    return score(b) - score(a) || (br >= 0 ? rt.snapshot.columns.votes[br] : 0) - (ar >= 0 ? rt.snapshot.columns.votes[ar] : 0) || a - b
  }
}
function foldIdentities(rt: Runtime, E: number[], B: number[], relevance: number[], bestRated: number[]) {
  const groups = (keys: number[]) => { const out = new Map<string, number[]>(); for (const key of keys) { const id = rt.identity(key), list = out.get(id) ?? []; if (!list.includes(key)) list.push(key); out.set(id, list) } return out }
  const eg = groups(E), bg = groups(B), repairs: SearchResult['identityRepairs'] = []
  for (const [identity, e] of eg) { const b = bg.get(identity); if (!identity.startsWith('unknown-') && e.length === 1 && b?.length === 1 && e[0] !== b[0]) repairs.push({ identity, alias: e[0], preferred: b[0] }) }
  const replace = new Map(repairs.map(repair => [repair.alias, repair.preferred])), preferred = new Set(repairs.map(repair => repair.preferred)), removed = new Set(repairs.map(repair => repair.alias))
  return { repairs, relevance: relevance.flatMap(key => replace.has(key) ? [replace.get(key)!] : preferred.has(key) ? [] : [key]), bestRated: bestRated.filter(key => !removed.has(key)) }
}
function policy(policy: string, params: URLSearchParams, rel: number[], top: number[], error: string | null): PolicyOrders {
  return { policy, params: params.toString(), error, total: rel.length, relevance: { keys: rel, total: rel.length }, bestRated: { keys: top, total: top.length } }
}

export async function search(input: { query: string; existing?: string; debug?: boolean }): Promise<SearchResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const rt = await runtime()
      const result = await searchOnce(rt, input)
      lastComparisonSnapshot = rt.snapshot
      return result
    } catch (error) {
      if (!(error instanceof SnapshotChangedError) || attempt === 2) throw error
    }
  }
  throw new Error('Preview comparison could not capture a stable catalog snapshot.')
}
async function searchOnce(rt: Runtime, input: { query: string; existing?: string; debug?: boolean }): Promise<SearchResult> {
  const start = performance.now(), query = input.query.trim(), existing = input.existing ?? ''
  if (!query || query.length > 2000) throw new Error('Enter a search between 1 and 2,000 characters.')
  const view = rt.app.interpret(query, existing, clock()), text = normalize(view.semanticQuery), manual = new URLSearchParams(existing), baseParams = new URLSearchParams(view.filters)
  const recognized = namedTitles(rt, query), negativeClauses: string[] = rt.app.splitNegation(query).negated
  let branch: SearchResult['branch'] = recognized.length ? 'title-guard' : negativeClauses.length ? 'negative-baseline' : 'positive'
  const readingStart = performance.now(), cap = text.length >= 2 ? await capture(rt, text) : null, foreign = cap ? rt.app.nonEnglish(text) : false
  const reading = cap ? rt.app.readingFields(text, cap.raw, foreign) : null, lookup = cap ? await titleLookup(rt, text, cap) : []
  const readingMs = performance.now() - readingStart, baselineStart = performance.now()
  const baseRank = reading ? await retrieve(rt, text, view.semanticQuery, baseParams, reading, lookup, foreign) : null
  const baselineRel = await filtered(rt, baseRank?.keys ?? 'catalog', baseParams, 'relevance'), baselineTop = await filtered(rt, baseRank?.keys ?? 'catalog', baseParams, 'top')
  const baseline = policy('baseline', baseParams, baselineRel, baselineTop, baseRank?.error ?? null), baselineMs = performance.now() - baselineStart
  let candidate = baseline, params = baseParams, prefs: Proposal[] = [], retainedHard: Proposal[] = [], repairs: SearchResult['identityRepairs'] = [], broadRank: any = null, transportAction = 'not-required'
  const candidateStart = performance.now()
  if (branch === 'negative-baseline') candidate = { ...baseline, policy: config.policy }
  else if (branch === 'title-guard') {
    params = new URLSearchParams(existing); if (!params.has('services')) params.set('services', 'all'); if (!params.has('unseen')) params.set('unseen', '0')
    const universe = [...new Set([...recognized, ...(baseRank?.keys ?? baselineRel)])], r = await filtered(rt, universe, params, 'relevance'), q = await filtered(rt, universe, params, 'top')
    const head = (keys: number[]) => [...keys.filter(key => recognized.includes(key)), ...keys.filter(key => !recognized.includes(key))]
    candidate = policy(config.policy, params, head(r), head(q), null)
  } else {
    params = new URLSearchParams(baseParams)
    const groups = ['genres', 'themes', 'moods', 'styles'], inferred: Proposal[] = view.proposals.filter((p: Proposal) => p.status === 'applied' && groups.includes(p.parameter) && !(manual.get(p.parameter) || '').split(',').includes(p.value))
    retainedHard = inferred.filter(hard); prefs = inferred.filter(pref => !hard(pref))
    for (const group of groups) { const remove = new Set(prefs.filter(pref => pref.parameter === group).map(pref => pref.value)), kept = (params.get(group) || '').split(',').filter(value => value && !remove.has(value)); if (kept.length) params.set(group, kept.join(',')); else if (manual.has(group) && manual.get(group) === '') params.set(group, ''); else params.delete(group) }
    for (const [key, value] of baseParams) if (!groups.includes(key) && params.get(key) !== value) throw new Error(`Preview changed structural constraint ${key}`)
    broadRank = reading ? await retrieve(rt, text, view.semanticQuery, params, reading, lookup, foreign) : null
    const broadRel = await filtered(rt, broadRank?.keys ?? 'catalog', params, 'relevance')
    const Ebase = broadRel.filter(key => retainedHard.every(pref => hardMembership(rt, key, pref))), position = new Map(Ebase.map((key, i) => [key, i + 1]))
    const E = [...Ebase].sort((a, b) => Math.log1p(position.get(a)!)/Math.log(5001) + .25*(1-strength(rt, a, prefs)) - (Math.log1p(position.get(b)!)/Math.log(5001) + .25*(1-strength(rt, b, prefs))) || position.get(a)!-position.get(b)!)
    const admittedFilter = new Set(await filtered(rt, baselineTop, params, 'relevance')), admittedB = baselineTop.filter(key => admittedFilter.has(key) && retainedHard.every(pref => hardMembership(rt, key, pref)))
    const eSet = new Set(E), bSet = new Set(baselineTop), admitted = new Set(admittedB)
    if (baselineTop.some(key => eSet.has(key) && !admitted.has(key))) throw new Error('Frozen V6 baseline intersection lost mandatory eligibility.')
    let rel = [...E, ...admittedB.filter(key => !eSet.has(key))], top = [...admittedB, ...E.filter(key => !bSet.has(key)).sort(qualityComparator(rt))]
    transportAction = reading && rel.length > config.rankedLimit ? 'exact-baseline' : 'union'
    if (transportAction === 'exact-baseline') { branch = 'budget-baseline'; params = baseParams; candidate = { ...baseline, policy: config.policy } }
    else {
      if (reading) { const folded = foldIdentities(rt, E, admittedB, rel, top); rel = folded.relevance; top = folded.bestRated; repairs = folded.repairs }
      const set = new Set(rel)
      if (set.size !== rel.length || new Set(top).size !== top.length || top.length !== rel.length || top.some(key => !set.has(key))) throw new Error('Preview sort eligibility mismatch.')
      candidate = policy(config.policy, params, rel, top, broadRank?.error ?? null)
    }
  }
  // Display only: what each hard filter read from the words keeps out. Universe: the same words and reading retrieved
  // without that one filter (same build and snapshot); hides = titles in that pool every other filter keeps, minus
  // those that remain with it. Catalogue answers count on the catalog. The ranking and results above are unchanged.
  const hardHides: { phrase: string; params: [string, string][]; hides: number; universe: 'search' | 'catalog'; poolKeys?: number[]; without?: string }[] = []
  if (branch !== 'title-guard' && transportAction !== 'exact-baseline') {
    const used = new URLSearchParams(candidate.params), groupsList = ['genres', 'themes', 'moods', 'styles']
    const byPhrase = new Map<string, [string, string][]>()
    for (const p of view.proposals as Proposal[]) {
      if (p.status !== 'applied' || manual.get(p.parameter) === p.value) continue
      const inUse = groupsList.includes(p.parameter) ? (used.get(p.parameter) || '').split(',').includes(p.value) : used.get(p.parameter) === p.value
      if (!inUse) continue
      const at = byPhrase.get(p.phrase as string) ?? []; at.push([p.parameter, p.value]); byPhrase.set(p.phrase as string, at)
    }
    for (const [phrase, pairs] of byPhrase) {
      const without = new URLSearchParams(used)
      for (const [key, value] of pairs) {
        if (groupsList.includes(key)) { const kept = (without.get(key) || '').split(',').filter(v => v && v !== value); if (kept.length) without.set(key, kept.join(',')); else without.delete(key) }
        else without.delete(key)
      }
      const pool = reading ? (await retrieve(rt, text, view.semanticQuery, without, reading, lookup, foreign)).keys : 'catalog'
      const wide = (await filtered(rt, pool, without, 'relevance')).length, narrow = (await filtered(rt, pool, used, 'relevance')).length
      hardHides.push({ phrase, params: pairs, hides: Math.max(0, wide - narrow), universe: reading ? 'search' : 'catalog', ...(input.debug && pool !== 'catalog' ? { poolKeys: pool, without: without.toString() } : {}) })
    }
  }
  assertPinned(rt)
  return { query, semanticQuery: view.semanticQuery, existing, branch, source: rt.source, baseline, v7: candidate, hardHides, policies: [baseline, candidate], prefs, retainedHard, recognized, negativeClauses, params: { baseline: baseline.params, v7: candidate.params }, identityRepairs: repairs, transportAction, catalogue: !reading,
    // Display only: every applied interpretation (with its phrase), and the reading as Discover's search shows it.
    proposals: view.proposals.filter((p: Proposal) => p.status === 'applied' || p.status === 'existing wins'), readingChips: cap ? rt.app.summarizeReading(text, cap.raw, foreign) : [],
    timing: { totalMs: performance.now() - start, readingMs, baselineMs, candidateMs: performance.now() - candidateStart, readingCacheHit: cap?.cacheHit ?? null, baselineRetrieval: baseRank ? { cacheHit: baseRank.cacheHit, actualMs: baseRank.elapsedMs } : null, broadRetrieval: broadRank ? { cacheHit: broadRank.cacheHit, actualMs: broadRank.elapsedMs } : null } }
}

export async function cards(keys: number[]): Promise<Card[]> {
  const current = await runtime(), rt = { ...current, snapshot: lastComparisonSnapshot ?? current.snapshot }, unique = [...new Set(keys)]
  if (unique.some(key => !Number.isSafeInteger(key) || key <= 1e12 || key >= 3e12)) throw new Error('Invalid title key.')
  for (const type of ['movie', 'show'] as const) {
    const missing = unique.filter(key => !cardCache.has(key) && (key >= 2e12 ? 'show' : 'movie') === type)
    for (let i = 0; i < missing.length; i += 100) {
      const batch = missing.slice(i, i + 100)
      const rows = await rt.app.query(`SELECT tmdb_id,title,release_year,poster_path,genres,synopsis FROM ${type} WHERE tmdb_id=ANY(?)`, [batch.map(key => key % 1e12)])
      for (const row of rows) {
        const key = (type === 'show' ? 2e12 : 1e12) + Number(row.tmdb_id), facts = rt.snapshot.facts(key), posterPath = row.poster_path || null
        cardCache.set(key, { key, title: row.title || 'Untitled', year: row.release_year ?? null, type, posterPath, poster: posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : null, score: facts?.score ?? null, genres: row.genres ?? facts?.genres ?? [], synopsis: row.synopsis ?? '', url: `https://goodwatch.app/${type}/${row.tmdb_id}` })
      }
    }
  }
  return keys.map((key): Card => cardCache.has(key) ? { ...cardCache.get(key)!, score: rt.snapshot.facts(key)?.score ?? null } : { key, title: 'Title metadata unavailable', year: null, type: key >= 2e12 ? 'show' : 'movie', poster: null, posterPath: null, score: rt.snapshot.facts(key)?.score ?? null, genres: rt.snapshot.facts(key)?.genres ?? [], synopsis: '', url: `https://goodwatch.app/${key >= 2e12 ? 'show' : 'movie'}/${key % 1e12}` })
}
export async function close() {
  if (closing) return closing
  const pending = initialization
  initialization = undefined
  closing = (async () => {
    const current = live ?? await pending?.catch(() => undefined)
    if (current) {
      current.app.stopTitleSnapshot()
      current.redis.disconnect()
      current.app.stopSearchIndex()
      await current.app.stopQueryEncoder()
      if (snapshotConnection === current.redis) snapshotConnection = undefined
    }
    live = undefined
    lastComparisonSnapshot = undefined
  })().finally(() => { closing = undefined })
  return closing
}
