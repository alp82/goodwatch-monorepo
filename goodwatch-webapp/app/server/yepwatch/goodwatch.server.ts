import { providerCatalog, type ProviderCatalogRow } from './provider-catalog.ts'
import { createAvailabilityAdapter, keptOfferReads } from './availability-adapter.ts'
import { createDeckAdapter, type CatalogReads } from './catalog-adapter.ts'
import type { CatalogPort } from './types.ts'
import { RoomError } from './errors.ts'
import { requireCatalogSnapshot } from './catalog-startup.ts'
import { basePool, roomPool } from './proposal-pool.ts'
import { KeyedReads, readEvery } from './read-cache.ts'
import { timed } from './server-timing.ts'
import type { EpisodeListRow } from '../tracking.server'
type EpisodePresentation = NonNullable<Awaited<ReturnType<typeof import('../episode-presentation.server').getEpisodePresentation>>>
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
/**
 * Deck reads kept in this process (KeyedReads), each for at most:
 * - a title's offer evidence and direct links in a country: 10 minutes. Deck builds only; the agreement's final check
 *   reads offers fresh (`availability(…, fresh: true)` never uses or fills these). A title without evidence is kept
 *   as such; a failed read is never kept.
 * - a show's episode list and its season labels: 6 hours (the episode catalog changes daily). An empty list isn't kept.
 *   Corrections, and which episodes have aired, are applied on every read, not when the list was read.
 */
const OFFERS_TTL_MS = 10 * 60_000
const EPISODES_TTL_MS = 6 * 3600_000
const offers = keptOfferReads({
  async batch(scopes) {
    const { getAvailabilityEvidenceBatch } = await import('../availability.server')
    return timed('evidence', getAvailabilityEvidenceBatch(scopes, { throwOnError: true }))
  },
  async links(scopes) {
    const { readStreamLinks } = await import('./catalog-stream-links.ts')
    const { searchQuery } = await import('../combined-search/catalog.server')
    return timed('links', readStreamLinks(scopes, searchQuery))
  },
}, OFFERS_TTL_MS, 20_000)
/** What a deck reads of an episode (and corrections may change): the rest isn't kept. */
type KeptEpisode = Pick<EpisodeListRow, 'tmdb_id' | 'season_number' | 'episode_number' | 'name' | 'air_date'>
// Lists straight from the episode table (no other cache in between, so 6 hours is their whole age); an empty list
// isn't kept. Season labels only when there are some: getEpisodePresentation answers null both for a show without
// and after a failed read, so null is read again (for most shows that's an in-memory check). Labels may come through
// GoodWatch's shared caches (where a runtime has them; the release API doesn't): nested, at most 40 minutes old
// (10 fresh + 10 stale, twice), so they are kept 5 hours.
const listsKept = new KeyedReads<KeptEpisode[]>(EPISODES_TTL_MS, 1_000, (rows) => rows.length > 0)
const labelsKept = new KeyedReads<EpisodePresentation | null>(EPISODES_TTL_MS - 60 * 60_000, 1_000, (p) => p !== null)
const EPISODES_BATCH_ROWS = 20_000
/**
 * Several shows' lists in one query, with the rows and order of GoodWatch's one-show read. When the query's limit
 * may have cut the list short, the last show it reached and every show after it are left out (read again later).
 */
async function readLists(showIds: number[]): Promise<Map<number, KeptEpisode[]>> {
  const { query } = await import('~/utils/crate')
  const ids = [...showIds].sort((x, y) => x - y)
  const rows = await query<KeptEpisode & { show_id: number }>(`SELECT show_id, tmdb_id, season_number, episode_number, name, air_date FROM episode WHERE show_id IN (${ids.map(() => '?').join(',')}) AND removed_at IS NULL ORDER BY show_id, season_number, episode_number LIMIT ${EPISODES_BATCH_ROWS}`, ids)
  return episodeLists(ids, rows, EPISODES_BATCH_ROWS)
}
/** `rows` (ordered by show) per show of `ids`; at `limit` rows, the last show reached and all after it are left out. */
export function episodeLists(ids: number[], rows: (KeptEpisode & { show_id: number })[], limit: number) {
  const cut = rows.length >= limit ? Number(rows.at(-1)!.show_id) : Infinity
  const lists = new Map<number, KeptEpisode[]>(ids.filter(id => id < cut).map(id => [id, []]))
  for (const { tmdb_id, season_number, episode_number, name, air_date, show_id } of rows) lists.get(Number(show_id))?.push({ tmdb_id, season_number, episode_number, name, air_date })
  return lists
}
async function readLabels(showIds: number[]): Promise<Map<number, EpisodePresentation | null>> {
  const { getEpisodePresentation } = await import('../episode-presentation.server')
  return new Map(await Promise.all(showIds.map(async id => [id, await getEpisodePresentation(id)] as const)))
}
const byKey = <V>(read: (ids: number[]) => Promise<Map<number, V>>) => async (missing: string[]) =>
  new Map([...(await read(missing.map(Number)))].map(([id, value]) => [String(id), value]))
/** Corrections are applied on every read (they go live within seconds); which episodes have aired, too. */
async function episodeChoices(showId: number, source: KeptEpisode[], presentation: EpisodePresentation | null) {
  const { applyCorrections } = await import('../feedback/apply-corrections.server')
  const canonical = await applyCorrections({ kind: 'show', id: showId }, source)
  const labels = new Map(presentation?.episodes.map(e => [e.id, e]))
  // Existing SQL timestamps can arrive as Dates; a JSON cache hit can contain their ISO representation.
  return canonical.filter(e => e.season_number > 0 && e.air_date != null && new Date(e.air_date).getTime() <= Date.now()).map(e => {
    const label = labels.get(e.tmdb_id)
    return { tmdbId: e.tmdb_id, season: e.season_number, number: e.episode_number, name: e.name, airDate: e.air_date == null ? null : new Date(e.air_date).toISOString(),
      ...(label ? { displaySeason: label.displaySeason, displayNumber: label.displayNumber, presentationVersion: presentation!.version } : {}) }
  })
}
/** Several shows' episodes, those not kept read in one query; a show it can't answer is left out. */
async function episodesMany(showIds: number[]) {
  const keys = showIds.map(String)
  const [lists, labels] = await Promise.all([
    listsKept.many(keys, byKey(ids => timed('episodes', readLists(ids)))),
    labelsKept.many(keys, byKey(readLabels)),
  ])
  return new Map(await Promise.all([...lists].filter(([id]) => labels.has(id)).map(async ([id, list]) => [Number(id), await episodeChoices(Number(id), list, labels.get(id)!)] as const)))
}
async function episodes(showId: number) {
  const found = (await episodesMany([showId])).get(showId)
  if (found) return found
  // A list longer than the batch limit: GoodWatch's own one-show read, not kept.
  const [{ getSourceEpisodeList }, labels] = await Promise.all([import('../tracking.server'), readLabels([showId])])
  return episodeChoices(showId, await getSourceEpisodeList(showId), labels.get(showId) ?? null)
}
type RankingCombo = { country: string; type: 'all' | 'movie' | 'show'; moods: string[] }
const recentCombos = new Map<string, RankingCombo>()
async function baseKeys(combo: RankingCombo, step = 0): Promise<readonly number[]> {
  const [{ getTitleSnapshot }, { maskOfMoods }] = await Promise.all([import('../title-snapshot/index.server'), import('../../domain/moods')])
  const snapshot = await requireCatalogSnapshot(getTitleSnapshot)
  const id = JSON.stringify(combo)
  recentCombos.set(id, combo)
  while (recentCombos.size > 12) recentCombos.delete(recentCombos.keys().next().value!)
  return basePool(snapshot, combo.type === 'all' ? ['movie', 'show'] : [combo.type], maskOfMoods(combo.moods as Parameters<typeof maskOfMoods>[0]), step)
}
/** Warm all floor steps slice by slice; country indexes load in the background. */
export async function warmRankings(seed: RankingCombo[] = []) {
  const { countryServices } = await import('~/server/availability-index.server')
  for (const combo of [...seed, ...recentCombos.values()]) {
    countryServices(combo.country)
    for (let step = 0; step <= 2; step++) try { await baseKeys(combo, step) } catch { return }
  }
}
export const goodwatchReads: CatalogReads = {
  async rankedKeys(room) {
    const [{ isMoodKey }, { countryServices }] = await Promise.all([import('../../domain/moods'), import('~/server/availability-index.server')])
    if (!room.constraints.moods.every(isMoodKey)) throw new RoomError('invalid_request', 'Unknown GoodWatch mood', 400)
    const type = !room.constraints.kinds.includes('movie') ? 'show' : room.constraints.kinds.length === 1 ? 'movie' : 'all'
    const country = room.screens.find(s => room.participants.some(p => p.screenId === s.id))?.country
    if (!country) throw new RoomError('needs_context', 'Confirm viewing screens')
    const index = countryServices(country)
    const wanted = new Set(room.screens.flatMap(s => s.serviceIds).map(id => index?.indexOfService(id)))
    const watchable = index ? (key: number) => {
      const row = index.rowOf(key)
      if (row < 0) return false
      for (let i = index.offsets[row]; i < index.offsets[row + 1]; i++) if (wanted.has(index.entries[i])) return true
      return false
    } : null
    const result = await timed('pool', roomPool(step => baseKeys({ country, type, moods: room.constraints.moods }, step), watchable))
    return result.keys as number[]
  },
  async displays(keys) {
    const { getDisplayFields } = await import('../title-cards.server')
    const rows = await getDisplayFields(keys)
    return new Map([...rows].map(([key, t]) => [key, { key, tmdbId: t.tmdb_id, mediaType: t.media_type, title: t.title, year: t.release_year, overview: t.tagline, posterUrl: t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : null, runtimeMinutes: t.runtime, backdropUrl: t.backdrop_path ? `https://image.tmdb.org/t/p/w1280${t.backdrop_path}` : null, goodwatchScore: t.goodwatch_overall_score_normalized_percent }]))
  },
  episodes,
  episodesMany,
  async availability(titles, screens, fresh) {
    const { getAvailabilityEvidence } = await import('../availability.server')
    return createAvailabilityAdapter({
      // Direct links are an extra: any failure here leaves the TMDB fallback, never an empty page.
      links: async scopes => { try { return await offers.links(scopes) } catch { return [] } },
      batch: offers.batch,
      // The final check before an agreement: read now, past every cache.
      fresh: scope => timed('evidence', getAvailabilityEvidence(scope, { bypassCache: true })),
      names: async () => new Map((await serviceCatalog()).map(s => [s.id, s.name])),
    })(titles, screens, fresh)
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
