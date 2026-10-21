import type { Candidate, EpisodeChoice, ScreenAvailability, ScreenContext } from '../../../packages/yepwatch-contracts/index.ts'
import { RoomError, requireRoom } from './errors.ts'
import { continuationProposal } from './progress.ts'
import { LIMITS, type Room } from './types.ts'
export interface CatalogDisplay { key: number; tmdbId: number; mediaType: 'movie' | 'show'; title: string; year: number | null; overview: string | null; posterUrl: string | null; runtimeMinutes: number | null }
/** Reads adapt existing GoodWatch methods. New room selection logic lives here; no account/catalog writes. */
export interface CatalogReads {
  rankedKeys(room: Room): Promise<number[]>
  displays(keys: number[]): Promise<Map<number, CatalogDisplay>>
  episodes(showId: number): Promise<EpisodeChoice[]>
  availability(titles: CatalogDisplay[], screens: ScreenContext[], fresh: boolean): Promise<Map<number, ScreenAvailability[]>>
}
export function occupiedScreens(room: Room) {
  const ids = new Set((room.round ? room.round.memberIds.map(id => room.participants.find(p => p.id === id)!) : room.participants).map(p => p.screenId))
  const screens = room.screens.filter(s => ids.has(s.id))
  requireRoom(screens.length && !ids.has(null) && screens.length === ids.size && screens.every(s => s.confirmed && s.country && s.serviceIds.length), 'needs_context', 'Every occupied screen needs confirmed country/services')
  return screens
}
function episodeIdentity(e: EpisodeChoice) { return { tmdbId: e.tmdbId, season: e.season, number: e.number, ...(e.displaySeason === undefined ? {} : { displaySeason: e.displaySeason }), ...(e.displayNumber === undefined ? {} : { displayNumber: e.displayNumber }), ...(e.presentationVersion === undefined ? {} : { presentationVersion: e.presentationVersion }) } }
export function createDeckAdapter(reads: CatalogReads, options: { scanLimit?: number; deadlineMs?: number; now?: () => number } = {}) {
  const clock = options.now ?? Date.now
  return {
    async candidates(room: Room): Promise<Candidate[]> {
      const screens = occupiedScreens(room); const now = clock(); const deadline = now + (options.deadlineMs ?? 12_000)
      const participants = room.participants
      const selectedShows = new Set(room.episodeProposals.map(p => p.showId))
      const progressPlans = new Map<number, ReturnType<typeof continuationProposal>>()
      if (room.constraints.kinds.includes('show_continue')) {
        for (const showId of selectedShows) {
          const episodes = await reads.episodes(showId); const plan = continuationProposal(room, showId, episodes); progressPlans.set(showId, plan)
          if (!plan.agreed) throw new RoomError('needs_progress', 'Open each selected show’s progress to resolve missing history or explicitly approve the proposed episode')
        }
        if (room.constraints.kinds.length === 1 && !selectedShows.size) throw new RoomError('needs_progress', 'Select a show by name and enter private progress first')
      }
      const continuationOnly = room.constraints.kinds.length === 1 && room.constraints.kinds[0] === 'show_continue'
      const allKeys = continuationOnly && !room.constraints.moods.length ? [] : [...new Set(await reads.rankedKeys(room))]
      // Selected continuation shows are looked up by canonical key even without analysis in the recommendation snapshot.
      const continueKeys = [...selectedShows].map(id => 2_000_000_000_000 + id).filter(key => !room.constraints.moods.length || allKeys.includes(key))
      const ordered = [...new Set([...continueKeys, ...allKeys])]
      const scanLimit = options.scanLimit ?? 1200
      const results: Candidate[] = []; let unknownEvidence = false; let episodeCatalogMissing = false; let scanned = 0
      let exhausted = true
      // Bounded work is explicit: hitting a scan/deadline budget is NOT a verified empty catalog intersection.
      for (let offset = 0; offset < ordered.length; offset += 40) {
        if (scanned >= scanLimit || clock() >= deadline) { exhausted = false; break }
        const keys = ordered.slice(offset, offset + Math.min(40, scanLimit - scanned)); scanned += keys.length
        const displays = await reads.displays(keys)
        const availability = await reads.availability([...displays.values()], screens, false)
        for (const key of keys) {
          const title = displays.get(key); if (!title) continue
          if (room.constraints.maxMinutes != null && (title.runtimeMinutes == null || title.runtimeMinutes > room.constraints.maxMinutes)) continue
          const offers = availability.get(key) ?? []
          if (offers.length !== screens.length || offers.some(a => a.state === 'unknown')) { unknownEvidence = true; continue }
          if (offers.some(a => a.state !== 'watchable')) continue
          let identity: Candidate['identity']
          if (title.mediaType === 'movie') {
            if (!room.constraints.kinds.includes('movie')) continue
            identity = { kind: 'movie', tmdbId: title.tmdbId }
          } else {
            const plan = progressPlans.get(title.tmdbId)
            const hasContinuing = selectedShows.has(title.tmdbId)
            if (plan?.agreed && hasContinuing && room.constraints.kinds.includes('show_continue')) identity = { kind: 'show_continue', tmdbId: title.tmdbId, episode: episodeIdentity(plan.proposed!) }
            else {
              if (!room.constraints.kinds.includes('show_start') || hasContinuing) continue
              const episodes = await reads.episodes(title.tmdbId)
              const first = [...episodes].sort((a, b) => a.season - b.season || a.number - b.number)[0]
              if (!first) { episodeCatalogMissing = true; continue }
              identity = { kind: 'show_start', tmdbId: title.tmdbId, episode: episodeIdentity(first) }
            }
          }
          const id = identity.kind === 'movie' ? `movie_${identity.tmdbId}` : `${identity.kind}_${identity.tmdbId}_${identity.episode.tmdbId}`
          results.push({ id, identity, title: title.title, year: title.year, overview: title.overview, posterUrl: title.posterUrl, runtimeMinutes: title.runtimeMinutes, availability: offers })
          if (results.length >= LIMITS.deck) return results
        }
      }
      if (results.length) return results
      if (scanned < ordered.length) exhausted = false
      if (unknownEvidence || episodeCatalogMissing || !exhausted) throw new RoomError('catalog_unavailable', 'No verified deck yet: coverage, episode data or bounded scan is incomplete', 503, true)
      throw new RoomError('no_intersection', 'No eligible titles in the checked catalog pool; adjust screen services, progress or constraints')
    },
    async recheck(room: Room, candidate: Candidate) {
      const screens = occupiedScreens(room)
      const key = (candidate.identity.kind === 'movie' ? 1_000_000_000_000 : 2_000_000_000_000) + candidate.identity.tmdbId
      const display = (await reads.displays([key])).get(key)
      requireRoom(display, 'catalog_unavailable', 'Chosen catalog title unavailable', 503)
      if (candidate.identity.kind !== 'movie') {
        const identity = candidate.identity
        const episodes = await reads.episodes(identity.tmdbId)
        requireRoom(episodes.some(e => e.tmdbId === identity.episode.tmdbId && e.season === identity.episode.season && e.number === identity.episode.number), 'needs_progress', 'Episode catalog changed; start a new round')
        if (identity.kind === 'show_continue') {
          const plan = continuationProposal(room, identity.tmdbId, episodes)
          requireRoom(plan.agreed && plan.proposed?.tmdbId === identity.episode.tmdbId, 'needs_progress', 'Episode consent changed; start a new round')
        }
      }
      const rows = (await reads.availability([display], screens, true)).get(key)
      requireRoom(rows && rows.length === screens.length, 'catalog_unavailable', 'Current screen evidence unavailable', 503)
      // A known no-match differs from unknown. Title scope remains title scope for every show episode.
      if (rows.some(a => a.state === 'unknown')) throw new RoomError('catalog_unavailable', 'Current availability evidence is unknown; check the service before choosing', 503, true)
      if (rows.some(a => a.state !== 'watchable')) throw new RoomError('no_intersection', 'The proposal is no longer eligible at every screen')
      return rows
    },
  }
}
