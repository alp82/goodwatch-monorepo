import test from 'node:test'
import assert from 'node:assert/strict'
import { replayBaseline } from './eval/replay-baseline.ts'
import { groupSimulation, type EvalData } from './eval/group-sim.ts'
test('baseline deduplicates superseded revisions and never emits identifiers', () => {
  const vote = { room_id: 'private-room', generation: 1, participant_id: 'private-person', candidate_id: 'movie_1', choice: 'pass' as const, revision: 1 }
  const event = replayBaseline([vote, { ...vote, choice: 'watch', revision: 2 }], [{ id: vote.room_id, generation: 1, seen_keys: ['movie_1'], people: 1 }])
  assert.deepEqual(event, { rounds: 1, matchRate: 1, cardsToFirstMatch: 1, positions: [{ position: 0, answers: 1, yepRate: 1 }] })
  assert.equal(JSON.stringify(event).includes('private'), false)
  assert.equal(replayBaseline([vote, { ...vote, choice: null, revision: 2 }], [{ id: vote.room_id, generation: 1, seen_keys: ['movie_1'], people: 1 }]).positions.length, 0)
  assert.throws(() => replayBaseline([vote, { ...vote, choice: 'watch' }], []), /Ambiguous/)
})
test('group grid uses a fixed holdout and emits aggregates with coverage', () => {
  const data: EvalData = { titles: Array.from({ length: 80 }, (_, i) => ({ key: 1e12 + i + 1, services: [8], score: 60 + i % 40, votes: 8000, popularity: 80 - i })),
    members: Array.from({ length: 8 }, () => ({ ratings: Array.from({ length: 80 }, (_, i) => ({ key: 1e12 + i + 1, score: i % 3 ? 8 : 3 })) })) }
  const first = groupSimulation(data, () => null, { groups: 8 })
  assert.deepEqual(first, groupSimulation(data, () => null, { groups: 8 }))
  assert.equal(first.results.length, 28)
  assert.equal(first.results[0].groups, 8)
  assert.equal(JSON.stringify(first).includes('1000000000001'), false)
  assert.ok(first.results.every(r => r.coverage >= 0 && r.coverage <= 1))
})
