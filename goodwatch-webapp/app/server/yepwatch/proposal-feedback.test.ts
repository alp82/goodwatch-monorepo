import test from 'node:test'
import assert from 'node:assert/strict'
import { rankingRoom, rankingSnapshot, cards } from './proposal-ranking-test-support.ts'
import { feedbackClass, feedbackAdjustment, roundFeedback, reorderTail, feedbackDigest } from './proposal-feedback.ts'
import { recordOutcome, roundOutcome } from './proposal-outcome.ts'
import { refillInputs } from './proposal-prepared-decks.ts'
test('feedback thresholds, single-voter half weight and cosine cutoff', () => {
  assert.deepEqual(feedbackClass(1, 0), { yep: .5, nope: 0 })
  assert.deepEqual(feedbackClass(1, 1), { yep: 0, nope: 1 })
  assert.deepEqual(feedbackClass(2, 2), { yep: 1, nope: 1 })
  assert.deepEqual(feedbackClass(2, 3), { yep: 0, nope: 1 })
  const room = rankingRoom(); room.candidates = cards(2); room.seenKeys = ['movie_1', 'movie_2']
  room.participants[0].votes['movie:1'] = { value: 'watch', revision: 1 }
  const snapshot = rankingSnapshot([{ key: 1e12 + 1, fp: [10, 0] }, { key: 1e12 + 2, fp: [0, 10] }])
  const feedback = roundFeedback(room, snapshot)
  assert.equal(feedbackAdjustment(snapshot, 1e12 + 1, feedback), .06)
  assert.equal(feedbackAdjustment(snapshot, 1e12 + 2, feedback), 0)
  assert.equal(feedbackAdjustment({ cosine: () => .8 }, 1, feedback), 0)
})
test('learning protects answered cards and the first two unanswered cards of every present voter', () => {
  const room = rankingRoom(); room.candidates = cards(8); room.seenKeys = cards(8).map(c => `movie_${c.identity.tmdbId}`)
  room.startedAt = 10
  const first = room.participants[0]
  first.votes = { 'movie:1': { value: 'pass', revision: 1 }, 'movie:2': { value: 'watch', revision: 1 } }
  const other = structuredClone(first); other.id = 'slower'; other.votes = {}
  room.participants.push(other)
  recordOutcome(room, undefined, 11)
  reorderTail(room, key => key)
  assert.deepEqual(room.candidates.slice(0, 4).map(c => c.id), ['movie:1', 'movie:2', 'movie:3', 'movie:4'])
  assert.deepEqual(room.candidates.slice(4).map(c => c.id), ['movie:8', 'movie:7', 'movie:6', 'movie:5'])
  assert.equal(room.outcome?.filter(t => t.moved).length, 4)
  assert.equal(roundOutcome(room).cardsDealt, 8)
  const shuffled = [...room.candidates].sort(() => 0)
  assert.equal(new Set(shuffled.map(c => c.id)).size, 8)
})
test('refill digest changes on group thresholds and retains feedback for retired cards', () => {
  const room = rankingRoom(); room.candidates = cards(3); room.seenKeys = ['movie_1', 'movie_2', 'movie_3']; room.startedAt = 10
  room.participants.push(...['b', 'c', 'd'].map(id => ({ ...structuredClone(room.participants[0]), id })))
  for (const p of room.participants.slice(0, 2)) p.votes['movie:1'] = { value: 'watch', revision: 1 }
  recordOutcome(room, undefined, 11)
  const before = refillInputs(room), digest = feedbackDigest(room)
  room.participants[2].votes['movie:1'] = { value: 'watch', revision: 1 }
  assert.deepEqual(feedbackDigest(room), digest)
  assert.equal(refillInputs(room), before)
  room.participants[3].votes['movie:1'] = { value: 'pass', revision: 1 }
  recordOutcome(room, undefined, 12)
  room.candidates.shift(); for (const p of room.participants) delete p.votes['movie:1']
  assert.deepEqual(feedbackDigest(room), digest)
})
test('long rounds bound feedback to the latest 120 answered positions', () => {
  const room = rankingRoom(), snapshot = rankingSnapshot(Array.from({ length: 2000 }, (_, i) => ({ key: 1e12 + i + 1 })))
  room.seenKeys = Array.from({ length: 2000 }, (_, i) => `movie_${i + 1}`)
  room.outcome = room.seenKeys.map((_, position) => ({ position, reason: null, taste: 0, idea: 0, quality: 0, score: 0, yep: 0, nope: 2, unanswered: 0, matched: false, moved: false }))
  assert.equal(roundFeedback(room, snapshot).nopes.length, 120)
  assert.equal(feedbackDigest(room).length, 120)
})
