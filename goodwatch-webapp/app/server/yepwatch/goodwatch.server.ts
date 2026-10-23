import { groupProviderChoices } from "../../utils/streaming-links.ts"
import { createAvailabilityAdapter } from './availability-adapter.ts'
import type { ViewerContext } from '../viewer.server'
import { createDeckAdapter, type CatalogReads } from './catalog-adapter.ts'
import type { CatalogPort } from './types.ts'
import { RoomError } from './errors.ts'
import { requireCatalogSnapshot } from './catalog-startup.ts'
/** Read-only adapters. Existing methods retain catalog/filter/evidence/link semantics. */
async function serviceCatalog() {
  const { searchQuery } = await import('../combined-search/catalog.server')
  const rows = await searchQuery<{ tmdb_id: number; name: string; logo_path: string | null }>('SELECT DISTINCT tmdb_id,name,logo_path FROM streaming_service ORDER BY name,tmdb_id')
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
export const goodwatchReads: CatalogReads = {
  async rankedKeys(room) {
    const [{ filterTitles }, { defaultFilterState }, { getTitleSnapshot, presentableAt }, { isMoodKey }] = await Promise.all([import('../title-filter/index.server'), import('../../domain/filter-state'), import('../title-snapshot/index.server'), import('../../domain/moods')])
    const snapshot = await requireCatalogSnapshot(getTitleSnapshot)
    if (!room.constraints.moods.every(isMoodKey)) throw new RoomError('invalid_request', 'Unknown GoodWatch mood', 400)
    const state = defaultFilterState({ onMyServices: false, notSeenYet: false })
    state.type = !room.constraints.kinds.includes('movie') ? 'show' : room.constraints.kinds.length === 1 ? 'movie' : 'all'
    state.moods = room.constraints.moods.filter(isMoodKey)
    const country = room.screens.find(s => room.participants.some(p => p.screenId === s.id))?.country
    if (!country) throw new RoomError('needs_context', 'Confirm viewing screens')
    const viewer: ViewerContext = { viewer: { kind: 'guest', progress: { interactions: [], country } }, country, services: [], seen: new Set(), ratings: new Map(), wishlist: new Map(), skipped: new Set(), notInterested: new Set(), hidden: new Set(), forYou: false }
    // Full snapshot universe avoids inheriting Discover’s separate minimum-vote catalog gate.
    const result = await filterTitles({ universe: snapshot.columns.pointIds, state, sort: 'popular', forYou: null, taste: null, viewer,
      keep: key => { const row = snapshot.rowOf(key); return row >= 0 && presentableAt(snapshot.columns, row) && !snapshot.factsAt(row).adult } })
    const offset = result.keys.length ? (room.roundVersion * 20) % result.keys.length : 0
    return [...result.keys.slice(offset), ...result.keys.slice(0, offset)]
  },
  async displays(keys) {
    const { getDisplayFields } = await import('../title-cards.server')
    const rows = await getDisplayFields(keys)
    return new Map([...rows].map(([key, t]) => [key, { key, tmdbId: t.tmdb_id, mediaType: t.media_type, title: t.title, year: t.release_year, overview: t.tagline, posterUrl: t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : null, runtimeMinutes: t.runtime, backdropUrl: t.backdrop_path ? `https://image.tmdb.org/t/p/w1280${t.backdrop_path}` : null, goodwatchScore: t.goodwatch_overall_score_normalized_percent }]))
  },
  episodes,
  async availability(titles, screens, fresh) {
    const { getAvailabilityEvidence, getAvailabilityEvidenceBatch } = await import('../availability.server')
    return createAvailabilityAdapter({ batch: getAvailabilityEvidenceBatch, fresh: scope => getAvailabilityEvidence(scope, { bypassCache: true }), names: async () => new Map((await serviceCatalog()).map(s => [s.id, s.name])) })(titles, screens, fresh)
  },
}
const deck = createDeckAdapter(goodwatchReads)
export const goodwatchCatalog: CatalogPort = {
  async metadata() {
    const [{ getCountries }, { MOODS }] = await Promise.all([import('../countries.server'), import('../../domain/moods')])
    const [countries, services] = await Promise.all([getCountries({}), serviceCatalog()])
    return { countries, services, providerGroups: groupProviderChoices(services), moods: MOODS.map(m => ({ id: m.key, label: m.name })) }
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
