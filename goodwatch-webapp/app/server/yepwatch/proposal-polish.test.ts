import test from 'node:test'
import assert from 'node:assert/strict'
import { enrichContinuousCandidates } from './continuous-presentation.server.ts'
import { createAvailabilityAdapter } from './availability-adapter.ts'
import { readStreamLinks, type CatalogQuery } from './catalog-stream-links.ts'
import { ProposalMemoryRepository, proposalFixtureCatalog } from './proposal-test-support.ts'
import { ProposalService } from './proposal-service.server.ts'
import { proposalSnapshot } from './proposal-machine.ts'
import type { Candidate } from '../../../packages/yepwatch-contracts/continuous.ts'

const card = (id: number, show = false): Candidate => ({ id: `card-${id}`, identity: show ? { kind: 'show_start', tmdbId: id, episode: { tmdbId: 99, season: 1, number: 1 } } : { kind: 'movie', tmdbId: id }, title: 'Title', year: 2020, overview: null, posterUrl: null, runtimeMinutes: 90, availability: [] })
const title = { tmdb_id: 1, tagline: 'A tagline', synopsis: 'A synopsis', genres: ['Drama'], age_certifications: ['US_PG-13', 'DE_16'], fingerprint_highlight_keys: ['romance', 'crime', 'mystery', 'wonder'], imdb_user_score_original: 7.8, rotten_tomatoes_tomato_score_original: 92, rotten_tomatoes_audience_score_original: 85, metacritic_meta_score_original: 71 }
function fixture() {
  const calls: { sql: string; args: unknown[] }[] = []
  const read: CatalogQuery = async <T extends object>(sql: string, args: unknown[] = []) => {
    calls.push({ sql, args })
    const rows = sql.includes('FROM doc.movie') || sql.includes('FROM doc.show') ? [title] :
      sql.includes('person_worked_on') ? [2, 1, 3, 99].map(person_tmdb_id => ({ media_tmdb_id: 1, person_tmdb_id })) :
      sql.includes('person_appeared_in') ? [99, 4, 4, 3, 2, 1].map(person_tmdb_id => ({ media_tmdb_id: 1, person_tmdb_id })) :
      sql.includes('media_video') ? [{ media_tmdb_id: 1, site_key: 'invalid' }, { media_tmdb_id: 1, site_key: 'abcdefghijk' }] :
      sql.includes('FROM doc.person ') ? [1, 2, 3, 4].map(tmdb_id => ({ tmdb_id, name: `Person ${tmdb_id}` })) : []
    return rows as T[]
  }
  return { read, calls }
}
test('page enrichment batches each catalog part, normalizes scores, caps ordered highlights and people', async () => {
  const { read, calls } = fixture()
  const rows = await enrichContinuousCandidates(Array.from({ length: 40 }, (_, i) => card(i + 1)), 'DE', read)
  assert.equal(calls.length, 5)
  assert.equal(calls[0].args.length, 40)
  assert.equal(rows[0].tagline, 'A tagline')
  assert.equal(rows[0].overview, 'A synopsis')
  assert.equal(rows[0].certification, 'FSK 16')
  assert.deepEqual(rows[0].scores, { imdb: 78, rtCritics: 92, rtAudience: 85, metacritic: 71 })
  assert.deepEqual(rows[0].highlights, [{ key: 'romance', label: 'Romance' }, { key: 'crime', label: 'Crime' }, { key: 'mystery', label: 'Mystery' }])
  assert.deepEqual(rows[0].people, { directors: ['Person 2', 'Person 1'], cast: ['Person 4', 'Person 3', 'Person 2'] })
  assert.equal(rows[0].trailerUrl, 'https://www.youtube.com/watch?v=abcdefghijk')
})
test('shows select creators; certification never falls back to a different country', async () => {
  const { read, calls } = fixture()
  const [row] = await enrichContinuousCandidates([card(1, true)], 'JP', read)
  assert.equal(row.certification, null)
  assert.ok(calls.some(c => c.args.includes('Creator')))
  assert.ok(!calls.some(c => c.args.includes('Director')))
})
test('unknown metadata stays absent and catalog failures preserve the candidate and verified offers', async () => {
  const c = card(1)
  const [unchanged] = await enrichContinuousCandidates([c], 'DE', async () => { throw Error('unavailable') })
  assert.deepEqual(unchanged, c)
  const read: CatalogQuery = async <T extends object>(sql: string) => (sql.includes('FROM doc.movie') ? [{ ...title, age_certifications: null, fingerprint_highlight_keys: ['unknown', 'crime', 'crime'], imdb_user_score_original: 0, rotten_tomatoes_tomato_score_original: -1, rotten_tomatoes_audience_score_original: 101, metacritic_meta_score_original: null }] : []) as T[]
  const [row] = await enrichContinuousCandidates([c], 'DE', read)
  assert.deepEqual(row.scores, { imdb: null, rtCritics: null, rtAudience: null, metacritic: null })
  assert.deepEqual(row.highlights, [{ key: 'crime', label: 'Crime' }])
  assert.equal(row.certification, null)
})
test('stream link read batches title/type/country scopes and applies MCP freshness bounds', async () => {
  let calls = 0
  const read: CatalogQuery = async (sql, args) => {
    calls++
    assert.match(sql, /doc.streaming_availability/)
    assert.match(sql, /updated_at > \? AND updated_at <= \?/)
    assert.deepEqual(args?.slice(0, 6), ['movie', 1, 'DE', 'show', 1, 'JP'])
    assert.equal(args?.at(-1), 123456789)
    return []
  }
  await readStreamLinks([{ mediaType: 'movie', tmdbId: 1, country: 'DE' }, { mediaType: 'show', tmdbId: 1, country: 'JP' }], read, 123456789)
  await readStreamLinks([], read)
  assert.equal(calls, 1)
})
test('an evidence offer without an inline URL uses its country-qualified stream row as a provider link', async () => {
  const now = Date.now()
  const evidence = { version: 1, media_tmdb_id: 1, media_type: 'movie', country_code: 'DE', unknown_contributions: false, checks: ['tmdb_web', 'tmdb_api'].map(source => ({ source, snapshot_id: source, checked_at: now, last_attempt_at: now, state: 'usable', reason: null, mapping_complete: true, offer_types: ['flatrate', 'free', 'ads'], offers: [{ service_id: 8, offer_type: 'flatrate', snapshot_id: source, stream_url: null }] })) }
  let batches = 0
  const adapter = createAvailabilityAdapter({ names: async () => new Map([[8, 'Netflix']]), batch: async () => new Map([['movie-1', evidence]]), fresh: async () => evidence, links: async scopes => {
    batches++; assert.equal(scopes.length, 2)
    return [{ media_type: 'movie', media_tmdb_id: 1, country_code: 'DE', service_id: 8, offer_type: 'flatrate', stream_url: 'https://netflix.com/watch/1' }]
  } }, () => now)
  const screens = [{ id: 'tv', label: 'TV', country: 'DE', serviceIds: [8], confirmed: true }]
  const displays = [1, 2].map(tmdbId => ({ key: tmdbId, tmdbId, mediaType: 'movie' as const, title: 'Title', year: null, overview: null, posterUrl: null, runtimeMinutes: null }))
  for (const fresh of [false, true]) {
    const rows = await adapter(displays, screens, fresh)
    assert.equal(rows.get(1)![0].offers[0].kind, 'provider')
    assert.equal(rows.get(1)![0].offers[0].url, 'https://netflix.com/watch/1')
  }
  assert.equal(batches, 2)
  const fallback = createAvailabilityAdapter({ names: async () => new Map([[8, 'Netflix']]), batch: async () => new Map([['movie-1', evidence]]), fresh: async () => evidence, links: async () => [{ media_type: 'movie', media_tmdb_id: 1, country_code: 'JP', service_id: 8, offer_type: 'flatrate', stream_url: 'https://netflix.com/watch/wrong-country' }] }, () => now)
  assert.equal((await fallback(displays, screens, false)).get(1)![0].offers[0].kind, 'where_to_watch')
})
test('proposalSnapshot preserves optional highlights while projecting nested fields explicitly', async () => {
  const service = new ProposalService(new ProposalMemoryRepository(), proposalFixtureCatalog, 'polish-tests-secret-at-least-thirty-two')
  const admission = await service.create({ contractVersion: 3, commandId: 'polish', admissionSecret: '12345678901234567890123456789012', nickname: 'Host' })
  const room = (await service.repository.read(admission.credential.roomId))!.room
  const { read } = fixture()
  const [c] = await enrichContinuousCandidates([card(1)], 'DE', read)
  room.candidates = [{ ...c, viewingDuration: { minutes: 90, scope: 'movie' } }]
  const snapshot = proposalSnapshot(room, room.participants[0].id)
  assert.deepEqual(snapshot.shared.candidates[0].scores, c.scores)
  assert.deepEqual(snapshot.shared.candidates[0].highlights, c.highlights)
  assert.deepEqual(snapshot.shared.candidates[0].people, c.people)
  assert.equal(snapshot.shared.candidates[0].certification, 'FSK 16')
})
