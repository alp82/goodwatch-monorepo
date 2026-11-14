import { providerCatalog, type ProviderCatalogRow } from './provider-catalog.ts'
import { createAvailabilityAdapter } from './availability-adapter.ts'
import type { ViewerContext } from '../viewer.server'
import { createDeckAdapter, type CatalogReads } from './catalog-adapter.ts'
import type { CatalogPort } from './types.ts'
import { RoomError } from './errors.ts'
import { requireCatalogSnapshot } from './catalog-startup.ts'
import { rankedKeysCache, rankInSlices } from './ranked-keys-cache.ts'
import { readEvery } from './read-cache.ts'
// The service and country lists change with the daily catalog ingest, not between one command and the next.
const CATALOG_LISTS_TTL_MS = 10 * 60_000
const serviceNameRows = readEvery(CATALOG_LISTS_TTL_MS, async () => {
  const { searchQuery } = await import('../combined-search/catalog.server')
  return searchQuery<{ tmdb_id: number; name: string; logo_path: string | null }>('SELECT DISTINCT tmdb_id,name,logo_path FROM streaming_service ORDER BY name,tmdb_id')
})
const providerRows = readEvery(CATALOG_LISTS_TTL_MS, async () => {
  const { searchQuery } = await import('../combined-search/catalog.server')
  return searchQuery<ProviderCatalogRow>('SELECT DISTINCT tmdb_id,name,logo_path,order_by_country,order_default FROM streaming_service')
})
const countryList = readEvery(CATALOG_LISTS_TTL_MS, async () => (await import('../countries.server')).getCountries({}))
/**
 * Reads the country and service lists before the first room needs them. Cold, they were most of a new room's setup
 * (265-387 ms on the first create after a deploy, against ~7 ms warm); afterwards they refresh in the background.
 */
export async function warmCatalogLists() {
  await Promise.all([countryList(), providerRows(), serviceNameRows()])
}
/** Read-only adapters. Existing methods retain catalog/filter/evidence/link semantics. */
async function serviceCatalog() {
  const rows = await serviceNameRows()
  // Full source choices, without the web UI’s ignored-provider list or country-dependent shortlist.
  return [...new Map(rows.map(s => [s.tmdb_id, { id: s.tmdb_id, name: s.name, logoUrl: s.logo_path ? `https://image.tmdb.org/t/p/w92${s.logo_path}` : null }])).values()]
}
async function episodes(showId: number) {
  const [{ getEpisodeList }, { getEpisodePresentation }] = await Promise.all([import('../tracking.server'), import('../episode-presentation.server')])
  const [canonical, presentation] = await Promise.all([getEpisodeList(showId), getEpisodePresentation(showId)])
  const labels = new Map(presentation?.episodes.map(e => [e.id, e]))
  // Existing SQL timestamps can arrive as Dates; a JSON cache hit can contain their ISO representation.
  return canonical.filter(e => e.season_number > 0 && e.air_date != null && new Date(e.air_date).getTime() <= Date.now()).map(e => {
    const label = labels.get(e.tmdb_id)
    return { tmdbId: e.tmdb_id, season: e.season_number, number: e.episode_number, name: e.name, airDate: e.air_date == null ? null : new Date(e.air_date).toISOString(),
      ...(label ? { displaySeason: label.displaySeason, displayNumber: label.displayNumber, presentationVersion: presentation!.version } : {}) }
  })
}
const baseRanking = rankedKeysCache()
type RankingCombo = { country: string; type: 'all' | 'movie' | 'show'; moods: string[] }
// The combinations rooms asked for most recently, warmed again for each new snapshot version (oldest first out).
const recentCombos = new Map<string, RankingCombo>()
/**
 * A room's base ranking: the whole title snapshot filtered and sorted by popularity, kept per snapshot version,
 * country, kinds and moods. Built slice by slice (rankInSlices), so building it never holds the event loop for more
 * than one slice: on the production host the single pass took 2.3-2.7 s, during which the API answered nothing else.
 */
async function baseKeys(combo: RankingCombo): Promise<readonly number[]> {
  const [{ filterTitles }, { defaultFilterState }, { getTitleSnapshot, presentableAt }, { isMoodKey }, { compareRows }] = await Promise.all([import('../title-filter/index.server'), import('../../domain/filter-state'), import('../title-snapshot/index.server'), import('../../domain/moods'), import('../title-filter/order.server')])
  const snapshot = await requireCatalogSnapshot(getTitleSnapshot)
  const moods = combo.moods.filter(isMoodKey).sort()
  const id = JSON.stringify([combo.country, combo.type, moods])
  recentCombos.delete(id)
  recentCombos.set(id, { country: combo.country, type: combo.type, moods })
  while (recentCombos.size > 12) recentCombos.delete(recentCombos.keys().next().value!)
  return baseRanking(JSON.stringify([snapshot.version, combo.country, combo.type, moods]), async () => {
    const state = defaultFilterState({ onMyServices: false, notSeenYet: false })
    state.type = combo.type
    state.moods = moods
    const viewer: ViewerContext = { viewer: { kind: 'guest', progress: { interactions: [], country: combo.country } }, country: combo.country, services: [], seen: new Set(), ratings: new Map(), wishlist: new Map(), skipped: new Set(), notInterested: new Set(), hidden: new Set(), forYou: false }
    const keep = (key: number) => { const row = snapshot.rowOf(key); return row >= 0 && presentableAt(snapshot.columns, row) && !snapshot.factsAt(row).adult }
    const popular = compareRows(snapshot.columns, 'popular')
    // Full snapshot universe avoids inheriting Discover’s separate minimum-vote catalog gate.
    return rankInSlices(snapshot.columns.pointIds, async slice =>
      // Every slice filters the snapshot the ranking started with, whatever loads meanwhile.
      (await filterTitles({ universe: slice, state, sort: 'popular', forYou: null, taste: null, viewer, keep, snapshot })).keys,
      (a, b) => popular(snapshot.rowOf(a), snapshot.rowOf(b)))
  })
}
/**
 * Builds the base rankings of the recently used combinations (and `seed`) for the loaded snapshot version, one after
 * the other, so the first room of each after a snapshot load doesn't wait for its ranking. Already built ones are hits.
 */
export async function warmRankings(seed: RankingCombo[] = []) {
  for (const combo of [...seed, ...[...recentCombos.values()].reverse()]) {
    try { await baseKeys(combo) } catch { return } // No snapshot yet: the next check warms.
  }
}
export const goodwatchReads: CatalogReads = {
  async rankedKeys(room) {
    const { isMoodKey } = await import('../../domain/moods')
    if (!room.constraints.moods.every(isMoodKey)) throw new RoomError('invalid_request', 'Unknown GoodWatch mood', 400)
    const type = !room.constraints.kinds.includes('movie') ? 'show' : room.constraints.kinds.length === 1 ? 'movie' : 'all'
    const country = room.screens.find(s => room.participants.some(p => p.screenId === s.id))?.country
    if (!country) throw new RoomError('needs_context', 'Confirm viewing screens')
    const keys = await baseKeys({ country, type, moods: room.constraints.moods })
    const offset = keys.length ? (room.roundVersion * 20) % keys.length : 0
    // The cached ranking itself when nothing rotates (rooms never do): no reader writes to it, and copying 200k+ keys
    // on every page holds the event loop for nothing.
    return offset ? [...keys.slice(offset), ...keys.slice(0, offset)] : keys as number[]
  },
  async displays(keys) {
    const { getDisplayFields } = await import('../title-cards.server')
    const rows = await getDisplayFields(keys)
    return new Map([...rows].map(([key, t]) => [key, { key, tmdbId: t.tmdb_id, mediaType: t.media_type, title: t.title, year: t.release_year, overview: t.tagline, posterUrl: t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : null, runtimeMinutes: t.runtime, backdropUrl: t.backdrop_path ? `https://image.tmdb.org/t/p/w1280${t.backdrop_path}` : null, goodwatchScore: t.goodwatch_overall_score_normalized_percent }]))
  },
  episodes,
  async availability(titles, screens, fresh) {
    const { getAvailabilityEvidence, getAvailabilityEvidenceBatch } = await import('../availability.server')
    return createAvailabilityAdapter({ links: async scopes => {
      // Direct links are an extra: any failure here leaves the TMDB fallback, never an empty page.
      try {
        const { readStreamLinks } = await import("./catalog-stream-links.ts")
        const { searchQuery } = await import("../combined-search/catalog.server")
        return await readStreamLinks(scopes, searchQuery)
      } catch { return [] }
    }, batch: getAvailabilityEvidenceBatch, fresh: scope => getAvailabilityEvidence(scope, { bypassCache: true }), names: async () => new Map((await serviceCatalog()).map(s => [s.id, s.name])) })(titles, screens, fresh)
  },
}
const deck = createDeckAdapter(goodwatchReads)
export const goodwatchCatalog: CatalogPort = {
  async metadata(country) {
    const { MOODS } = await import('../../domain/moods')
    const [countries, rows] = await Promise.all([countryList(), country ? providerRows() : Promise.resolve([])])
    return { countries, ...providerCatalog(rows, country), moods: MOODS.map(m => ({ id: m.key, label: m.name })) }
  },
  async searchShows(query) {
    const { searchQuery } = await import('../combined-search/catalog.server')
    const rows = await searchQuery<{ tmdb_id: number; title: string; release_year: number | null }>('SELECT tmdb_id,title,release_year FROM show WHERE MATCH((title,original_title), ?) AND (adult=false OR adult IS NULL) ORDER BY _score DESC,popularity DESC,tmdb_id LIMIT 20', [query])
    return { shows: rows.map(r => ({ tmdbId: r.tmdb_id, title: r.title, year: r.release_year })) }
  },
  episodes,
  candidates: room => deck.candidates(room),
  recheck: (room, candidate) => deck.recheck(room, candidate),
}
