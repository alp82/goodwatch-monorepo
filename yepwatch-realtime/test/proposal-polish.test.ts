import test from 'node:test'
import assert from 'node:assert/strict'
import { proposalProjection } from '../src/proposal-projection.js'
import { proposalSnapshot } from './fixture.js'

function enriched() {
  const s = proposalSnapshot()
  s.candidates = [{ id: 'movie-1', identity: { kind: 'movie', tmdbId: 1 }, title: 'Title', year: 2020, overview: null, posterUrl: null, runtimeMinutes: 90, viewingDuration: { minutes: 90, scope: 'movie' }, availability: [], tagline: 'Tagline', certification: 'FSK 16', scores: { imdb: 78, rtCritics: 90, rtAudience: null, metacritic: 70 }, highlights: [{ key: 'crime', label: 'Crime' }], people: { directors: ['Director'], cast: ['Actor'] } }]
  return s
}
test('strict proposal projection retains optional title highlights and accepts missing or null facts', () => {
  const s = enriched()
  assert.deepEqual(proposalProjection(s, s.roomId).candidates, s.candidates)
  const empty = proposalSnapshot()
  assert.doesNotThrow(() => proposalProjection(empty, empty.roomId))
  Object.assign(s.candidates[0], { tagline: null, certification: null, scores: null, highlights: null, people: null })
  assert.doesNotThrow(() => proposalProjection(s, s.roomId))
})
test('strict projection rejects private nested fields, noninteger scores and oversized facts', () => {
  for (const patch of [
    { scores: { imdb: 7.8 } }, { scores: { imdb: 101 } }, { scores: { imdb: 78, secret: true } },
    { people: { directors: ['A', 'B', 'C'], cast: [] } },
    { people: { directors: [], cast: ['A', 'B', 'C', 'D'] } },
    { highlights: Array.from({ length: 4 }, () => ({ key: 'crime', label: 'Crime' })) },
    { highlights: [{ key: 'crime', label: 'Crime', participantId: 'private' }] },
  ]) {
    const s = enriched(); Object.assign(s.candidates[0], patch)
    assert.throws(() => proposalProjection(s, s.roomId))
  }
})
