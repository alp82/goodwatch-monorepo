import test from 'node:test'
import assert from 'node:assert/strict'
import { proposalProjection, proposalForClient } from '../src/proposal-projection.js'
import { proposalSnapshot } from './fixture.js'

function snapshot() {
  const s = proposalSnapshot(); s.phase = 'choosing'
  s.candidates = [1, 2].map(n => ({ id: `movie_${n}`, identity: { kind: 'movie' as const, tmdbId: n }, title: 'Match', year: 2020,
    overview: null, posterUrl: null, runtimeMinutes: 90, viewingDuration: { minutes: 90, scope: 'movie' as const }, availability: [] }))
  s.matches = s.candidates.map(c => ({ candidateId: c.id, averageYepMs: null }))
  s.ins = s.matches.map(m => ({ candidateId: m.candidateId, count: 2 })); s.inVersion = 4
  s.tiebreak = { version: 4, candidateIds: s.candidates.map(c => c.id), favorites: [{ candidateId: 'movie_1', count: 1 }, { candidateId: 'movie_2', count: 0 }], seed: '0123456789abcdef', outcome: null }
  return s
}
test('matches in projection accepts anonymous counts, pending picks, zero counts and outcome', () => {
  const s = snapshot(); assert.deepEqual(proposalProjection(s, s.roomId), s)
  s.tiebreak!.favorites[1].count = 1
  s.tiebreak!.outcome = { candidateId: 'movie_1', spun: true, among: ['movie_1', 'movie_2'] }
  assert.deepEqual(proposalProjection(s, s.roomId), s)
  s.tiebreak = null; s.ins![1].count = 0
  assert.deepEqual(proposalProjection(s, s.roomId).ins, s.ins)
})
test('strict projection rejects invalid counts, ties, favorites, outcomes and private fields', () => {
  const changes = [
    (x: any) => { x.ins[0].candidateId = 'missing' },
    (x: any) => { x.ins[0].count = 3 }, (x: any) => { x.ins[0].count = -1 }, (x: any) => { x.ins[0].count = 0.5 },
    (x: any) => { x.ins[0].people = ['private'] }, (x: any) => { x.ins[1].candidateId = x.ins[0].candidateId },
    (x: any) => { x.ins.reverse() }, (x: any) => { x.ins.pop() },
    (x: any) => { x.inVersion = -1 }, (x: any) => { delete x.inVersion },
    (x: any) => { x.tiebreak.candidateIds = ['movie_1'] },
    (x: any) => { x.tiebreak.candidateIds = ['movie_1', 'movie_1'] },
    (x: any) => { x.ins[0].count = 1 }, (x: any) => { x.tiebreak.candidateIds[1] = 'missing' },
    (x: any) => { x.tiebreak.favorites[0].count = 3 },
    (x: any) => { x.tiebreak.favorites[1].count = 2 },
    (x: any) => { x.tiebreak.favorites[0].candidateId = 'missing' },
    (x: any) => { x.tiebreak.favorites[1].candidateId = 'movie_1' },
    (x: any) => { x.tiebreak.favorites[0].participantId = 'private' },
    (x: any) => { x.tiebreak.seed = 'short' }, (x: any) => { x.tiebreak.seed = 'x'.repeat(65) },
    (x: any) => { x.tiebreak.outcome = { candidateId: 'movie_1', spun: true, among: ['movie_2'] } },
    (x: any) => { x.tiebreak.outcome = { candidateId: 'movie_1', spun: true, among: ['movie_1', 'missing'] } },
    (x: any) => { x.tiebreak.outcome = { candidateId: 'movie_1', spun: true, among: [] } },
    (x: any) => { x.tiebreak.outcome = { candidateId: 'movie_1', spun: true, among: ['movie_1'], person: 'private' } },
  ]
  for (const change of changes) { const bad = snapshot(); change(bad); assert.throws(() => proposalProjection(bad, bad.roomId)) }
})
test('setup has empty ins and no tiebreak; legacy snapshots without capability fields still project', () => {
  const s = snapshot(); s.phase = 'setup'; s.matches = []
  assert.throws(() => proposalProjection(s, s.roomId))
  s.ins = []; assert.throws(() => proposalProjection(s, s.roomId))
  s.tiebreak = null; assert.doesNotThrow(() => proposalProjection(s, s.roomId))
  const { ins, inVersion, tiebreak, ...legacy } = s
  assert.doesNotThrow(() => proposalProjection(legacy, s.roomId))
})
test('matchesIn and candidateReasons are independent capabilities; default delivery omits new shared fields', () => {
  const s = snapshot(); s.candidates[0].reason = { code: 'well_liked', text: 'Well liked' }
  for (const reasons of [false, true]) for (const matchesIn of [false, true]) {
    const sent = proposalForClient(s, reasons, matchesIn)
    for (const key of ['ins', 'inVersion', 'tiebreak']) assert.equal(key in sent, matchesIn)
    assert.equal('reason' in sent.candidates[0], reasons)
  }
  assert.equal(proposalForClient(s, true, true), s)
  assert.ok(s.ins); assert.ok(s.candidates[0].reason)
})

test('a completed decision may name the tiebreak winner while the legacy aggregate keeps match order', () => {
  const s = snapshot(); s.tiebreak!.favorites = [{ candidateId: 'movie_2', count: 2 }]
  s.tiebreak!.outcome = { candidateId: 'movie_2', spun: false, among: ['movie_2'] }
  s.proposalVersion = 2; s.proposal = { candidateId: 'movie_1', version: 2, previousCandidateId: null, agreeCount: 2, requiredCount: 2, averageYepMs: null }
  s.phase = 'decided'; s.decision = { candidateId: 'movie_2', proposalVersion: 2, decidedAt: 1, availability: [] }
  assert.doesNotThrow(() => proposalProjection(s, s.roomId))
  s.tiebreak!.outcome = null
  assert.throws(() => proposalProjection(s, s.roomId))
  s.tiebreak = null; s.ins!.forEach(c => { c.count = 0 })
  assert.doesNotThrow(() => proposalProjection(s, s.roomId), 'a historical winner survives a roster change')
  s.decision!.candidateId = 'missing'
  assert.throws(() => proposalProjection(s, s.roomId))
})
