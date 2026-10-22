import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDeckAdapter, type CatalogDisplay, type CatalogReads } from './catalog-adapter.ts'
import { createAvailabilityAdapter } from './availability-adapter.ts'
import { continuationProposal } from './progress.ts'
import { YepWatchService } from './service.server.ts'
import { fixtureCatalog, fixtureEpisodes, MemoryRoomRepository } from './test-support.ts'
import type { Room } from './types.ts'
const movie: CatalogDisplay = { key: 1_000_000_000_001, tmdbId: 1, mediaType: 'movie', title: 'Movie', year: 2020, overview: null, posterUrl: null, runtimeMinutes: 80 }
const start: CatalogDisplay = { ...movie, key: 2_000_000_000_011, tmdbId: 11, mediaType: 'show', title: 'Start', runtimeMinutes: 30 }
const continuation: CatalogDisplay = { ...start, key: 2_000_000_000_010, tmdbId: 10, title: 'Continue' }
async function room(): Promise<Room> {
  const repo = new MemoryRoomRepository(); const s = new YepWatchService(repo, fixtureCatalog, 'catalog-adapter-test-only-32-characters')
  const a = await s.create({ commandId: 'create', admissionSecret: 'x'.repeat(43), nickname: 'Couch' })
  const b = await s.join(a.credential.roomId, { commandId: 'join', admissionSecret: 'y'.repeat(43), nickname: 'Remote', inviteCode: a.invite.code })
  const r = (await repo.read(a.credential.roomId))!.room
  r.screens = [{ id: 'couch', label: 'Couch', country: 'DE', serviceIds: [8], confirmed: true }, { id: 'remote', label: 'Remote', country: 'JP', serviceIds: [9], confirmed: true }]
  r.participants[0].screenId = 'couch'; r.participants[1].screenId = 'remote'
  assert.equal(b.credential.roomId, r.id); return r
}
function reads(): CatalogReads {
  return {
    async rankedKeys() { return [movie.key, start.key] },
    async displays(keys) { return new Map([movie, start, continuation].filter(t => keys.includes(t.key)).map(t => [t.key, t])) },
    async episodes() { return fixtureEpisodes },
    async availability(titles, screens) { return new Map(titles.map(t => [t.key, screens.map(s => ({ screenId: s.id, state: 'watchable', scope: 'title', checkedAt: Date.now(), offers: [{ serviceId: s.serviceIds[0], name: s.id, url: null, kind: 'where_to_watch', offerType: 'flatrate' }] }))])) },
  }
}
test('Real deck logic supports all three kinds across every occupied screen and keeps episode evidence title-scoped', async () => {
  const r = await room(); r.constraints.kinds = ['movie', 'show_start', 'show_continue']
  r.episodeProposals = [{ showId: 10, episode: { tmdbId: 102, season: 1, number: 2 }, version: 1 }]
  for (const p of r.participants) p.progress = [{ showId: 10, input: { state: 'continue', nextEpisodeId: 102 }, approvedEpisodeId: 102 }]
  const port = reads(); let fresh = false; const base = port.availability; port.availability = async (...args) => { fresh = args[2]; return base(...args) }
  const adapter = createDeckAdapter(port); const candidates = await adapter.candidates(r)
  assert.deepEqual(candidates.map(c => c.identity.kind).sort(), ['movie', 'show_continue', 'show_start'])
  assert.ok(candidates.every(c => c.availability.length === 2 && c.availability.every(a => a.scope === 'title')))
  assert.ok(candidates.every(c => c.availability[0].offers[0].serviceId !== c.availability[1].offers[0].serviceId))
  await adapter.recheck(r, candidates[0]); assert.equal(fresh, true)
})
test('Explicit public episode proposal reconciles private progress only through individual approval', async () => {
  const r = await room(); r.constraints.kinds = ['show_continue']
  r.participants[0].progress = [{ showId: 10, input: { state: 'continue', nextEpisodeId: 101 }, approvedEpisodeId: 101 }]
  r.participants[1].progress = [{ showId: 10, input: { state: 'continue', nextEpisodeId: 102 }, approvedEpisodeId: 102 }]
  assert.equal(continuationProposal(r, 10, fixtureEpisodes).proposed, null)
  r.episodeProposals = [{ showId: 10, episode: { tmdbId: 101, season: 1, number: 1 }, version: 1 }]
  const plan = continuationProposal(r, 10, fixtureEpisodes)
  assert.equal(plan.proposed?.tmdbId, 101); assert.equal(plan.conflicts.get(r.participants[1].id)?.[0].reason, 'different_next_episode')
  assert.equal(plan.conflicts.get(r.participants[1].id)?.[0].ownNextEpisodeId, 102)
  await assert.rejects(createDeckAdapter(reads()).candidates(r), { code: 'needs_progress' })
  r.participants[1].progress[0].approvedEpisodeId = 101
  const deck = await createDeckAdapter(reads()).candidates(r); assert.equal(deck[0].identity.kind === 'show_continue' && deck[0].identity.episode.tmdbId, 101)
  r.participants[1].progress[0].input = { state: 'unknown' }
  await assert.rejects(createDeckAdapter(reads()).candidates(r), { code: 'needs_progress' })
})
test('Missing/stale coverage and bounded search are unavailable; verified empty intersections remain distinct', async () => {
  const r = await room(); r.constraints.kinds = ['movie']
  const p = reads(); p.availability = async (titles, screens) => new Map(titles.map(t => [t.key, screens.map(s => ({ screenId: s.id, state: s.id === 'remote' ? 'unknown' : 'watchable', scope: 'title', checkedAt: null, offers: [] }))]))
  await assert.rejects(createDeckAdapter(p).candidates(r), { code: 'catalog_unavailable' })
  const q = reads(); q.availability = async (titles, screens) => new Map(titles.map(t => [t.key, screens.map(s => ({ screenId: s.id, state: 'no_match', scope: 'title', checkedAt: Date.now(), offers: [] }))]))
  await assert.rejects(createDeckAdapter(q).candidates(r), { code: 'no_intersection' })
  await assert.rejects(createDeckAdapter(q, { scanLimit: 1 }).candidates(r), { code: 'catalog_unavailable' })
})
test('Final recheck rejects lost remote coverage, unknown evidence and changed episode catalog', async () => {
  const r = await room(); r.constraints.kinds = ['show_start']; const p = reads(); const adapter = createDeckAdapter(p); const candidate = (await adapter.candidates(r))[0]
  p.episodes = async () => []; await assert.rejects(adapter.recheck(r, candidate), { code: 'needs_progress' })
  p.episodes = async () => fixtureEpisodes
  p.availability = async (_titles, screens) => new Map([[start.key, screens.map(s => ({ screenId: s.id, state: s.id === 'remote' ? 'no_match' : 'watchable', scope: 'title', checkedAt: Date.now(), offers: [] }))]])
  await assert.rejects(adapter.recheck(r, candidate), { code: 'no_intersection' })
})
test('Country-separated existing evidence evaluator never merges same-title country keys or manufactures episode entitlement', async () => {
  const now = Date.now(); const r = await room(); const countries: string[] = []; let freshCalls = 0
  const evidence = (country: string) => ({ version: 1, media_tmdb_id: 1, media_type: 'movie', country_code: country, unknown_contributions: false,
    checks: ['tmdb_web', 'tmdb_api'].map(source => ({ source, snapshot_id: source, checked_at: now, last_attempt_at: now, state: 'usable', reason: null, mapping_complete: true, offer_types: ['flatrate', 'free', 'ads'], offers: [{ service_id: country === 'DE' ? 8 : 119, offer_type: 'flatrate', snapshot_id: source, stream_url: null }] })) })
  const availability = createAvailabilityAdapter({ async names() { return new Map([[8, 'Netflix'], [9, 'Prime']]) }, async batch(scopes) { assert.equal(new Set(scopes.map(s => s.country)).size, 1); countries.push(scopes[0].country); return new Map([['movie-1', evidence(scopes[0].country)]]) }, async fresh(scope) { freshCalls++; return evidence(scope.country) } }, () => now)
  const rows = (await availability([movie], r.screens, false)).get(movie.key)!
  assert.deepEqual(countries.sort(), ['DE', 'JP']); assert.ok(rows.every(a => a.state === 'watchable' && a.scope === 'title'))
  assert.equal(rows[0].offers[0].serviceId, 8); assert.equal(rows[1].offers[0].serviceId, 119)
  await availability([movie], r.screens, true); assert.equal(freshCalls, 2)
  const stale = createAvailabilityAdapter({ async names() { return new Map() }, async batch() { return new Map([['movie-1', evidence('DE')]]) }, async fresh() { return null } }, () => now + 31 * 86400_000)
  assert.equal((await stale([movie], [r.screens[0]], false)).get(movie.key)![0].state, 'unknown')
})

test('Deck errors identify unknown coverage, known exclusion, episode gaps and budget limits separately', async () => {
  const r = await room(); r.constraints.kinds = ['movie']
  const unknown = reads(); unknown.rankedKeys = async () => [movie.key]
  unknown.availability = async (titles, screens) => new Map(titles.map(t => [t.key, screens.map(s => ({ screenId: s.id, state: 'unknown', scope: 'title', checkedAt: null, offers: [] }))]))
  await assert.rejects(createDeckAdapter(unknown).candidates(r), error => {
    const e = error as { code: string; details: { reason: string; scanComplete: boolean; uncertainTitles: number; screens: { unknown: number; serviceIds: number[] }[] } }
    assert.equal(e.code, 'catalog_unavailable'); assert.equal(e.details.reason, 'availability_unknown'); assert.equal(e.details.scanComplete, true); assert.equal(e.details.uncertainTitles, 1)
    assert.equal(e.details.screens[0].unknown, 1); assert.deepEqual(e.details.screens[0].serviceIds, [8]); return true
  })
  const blocked = reads(); blocked.rankedKeys = async () => [movie.key]
  blocked.availability = async (titles, screens) => new Map(titles.map(t => [t.key, screens.map(s => ({ screenId: s.id, state: s.id === 'couch' ? 'no_match' : 'unknown', scope: 'title', checkedAt: null, offers: [] }))]))
  await assert.rejects(createDeckAdapter(blocked).candidates(r), { code: 'no_intersection', details: { type: 'deck', reason: 'verified_no_intersection', reasons: ['verified_no_intersection'], actions: ['review_screen_services', 'review_constraints'], scannedTitles: 1, poolSize: 1, scanComplete: true, uncertainTitles: 0, noMatchTitles: 1, missingMetadataTitles: 0, missingEpisodeTitles: 0, screens: [ { screenId: 'couch', country: 'DE', serviceIds: [8], watchable: 0, noMatch: 1, unknown: 0 }, { screenId: 'remote', country: 'JP', serviceIds: [9], watchable: 0, noMatch: 0, unknown: 1 } ] } })
  const episodes = reads(); const showRoom = structuredClone(r); showRoom.constraints.kinds = ['show_start']; episodes.rankedKeys = async () => [start.key]; episodes.episodes = async () => []
  await assert.rejects(createDeckAdapter(episodes).candidates(showRoom), error => { assert.equal((error as { details: { reason: string } }).details.reason, 'episode_catalog_unavailable'); return true })
  await assert.rejects(createDeckAdapter(unknown, { scanLimit: 0 }).candidates(r), error => { assert.equal((error as { details: { reason: string } }).details.reason, 'scan_limit'); return true })
  await assert.rejects(createDeckAdapter(unknown, { deadlineMs: 0 }).candidates(r), error => { assert.equal((error as { details: { reason: string } }).details.reason, 'deadline'); return true })
})

test('Excluded media kinds cannot turn known empty movie intersection into an unknown-coverage failure', async () => {
  const r = await room(); r.constraints.kinds = ['movie']; const p = reads()
  p.availability = async (titles, screens) => new Map(titles.map(t => [t.key, screens.map(s => ({ screenId: s.id, state: t.mediaType === 'movie' ? 'no_match' : 'unknown', scope: 'title', checkedAt: null, offers: [] }))]))
  await assert.rejects(createDeckAdapter(p).candidates(r), { code: 'no_intersection' })
})

test('Guest show-start selection ignores legacy manual continuation inputs and proposals when continuation is disabled', async () => {
  const r = await room(); r.constraints.kinds = ['show_start']
  r.episodeProposals = [{ showId: 10, episode: { tmdbId: 102, season: 1, number: 2 }, version: 1 }]
  r.participants[0].progress = [{ showId: 10, input: { state: 'continue', nextEpisodeId: 102 }, approvedEpisodeId: 102 }]
  const p = reads(); p.rankedKeys = async () => [continuation.key]
  const deck = await createDeckAdapter(p).candidates(r)
  assert.equal(deck[0].identity.kind, 'show_start'); assert.equal(deck[0].identity.tmdbId, 10)
})
