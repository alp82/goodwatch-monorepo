import type { Candidate } from '../../../packages/yepwatch-contracts/index.ts'
import { IndeterminateWrite } from './errors.ts'
import type { CatalogPort, Room, RoomRepository, StoredRoom } from './types.ts'
export class MemoryRoomRepository implements RoomRepository {
  rows = new Map<string, StoredRoom>(); ambiguousNext = false; failPublishAck = false
  async read(id: string) { return structuredClone(this.rows.get(id) ?? null) }
  async insert(room: Room) { if (this.rows.has(room.id)) return false; this.rows.set(room.id, { room: structuredClone(room), seq: 0, term: 1, pendingRevision: room.revision }); return true }
  async compareAndSwap(old: StoredRoom, room: Room, notify: boolean) {
    const current = this.rows.get(room.id); if (!current || current.seq !== old.seq || current.term !== old.term) return false
    this.rows.set(room.id, { room: structuredClone(room), seq: old.seq + 1, term: old.term, pendingRevision: notify ? Math.max(old.pendingRevision, room.revision) : old.pendingRevision })
    if (this.ambiguousNext) { this.ambiguousNext = false; throw new IndeterminateWrite('Injected lost acknowledgement') }; return true
  }
  async pending(limit: number) { return [...this.rows.values()].filter(s => s.pendingRevision).slice(0, limit).map(s => s.room.id) }
  async acknowledge(id: string, revision: number) { const stored = this.rows.get(id); if (stored && stored.pendingRevision <= revision) stored.pendingRevision = 0 }
}
export const fixtureEpisodes = [{ tmdbId: 101, season: 1, number: 1, name: 'First', airDate: '2020-01-01T00:00:00.000Z' }, { tmdbId: 102, season: 1, number: 2, name: 'Next', airDate: '2020-01-02T00:00:00.000Z' }]
export const fixtureCatalog: CatalogPort = {
  async metadata() { return { countries: [{ code: 'DE', name: 'Germany' }, { code: 'JP', name: 'Japan' }], services: [{ id: 1, name: 'Fixture service', logoUrl: null }], moods: [] } },
  async searchShows() { return { shows: [{ tmdbId: 10, title: 'Fixture show', year: 2020 }] } },
  async episodes() { return fixtureEpisodes },
  async candidates(room) {
    const occupied = room.screens.filter(s => room.participants.some(p => p.screenId === s.id))
    const availability: Candidate['availability'] = occupied.map(s => ({ screenId: s.id, state: 'watchable', scope: 'title', checkedAt: Date.now(), offers: [{ serviceId: s.serviceIds[0], name: 'Fixture', url: null, kind: 'where_to_watch', offerType: 'flatrate' }] }))
    return room.constraints.kinds.map((kind, i) => { const episode = fixtureEpisodes[kind === 'show_continue' ? 1 : 0]; return { id: `candidate_${i}`, identity: kind === 'movie' ? { kind, tmdbId: i + 1 } : { kind, tmdbId: kind === 'show_continue' ? 10 : 11, episode: { tmdbId: episode.tmdbId, season: episode.season, number: episode.number } }, title: `Fixture ${kind}`, year: 2020, overview: null, posterUrl: null, runtimeMinutes: 30, availability } })
  },
  async recheck(_room, candidate) { return candidate.availability },
}
