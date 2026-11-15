import test from 'node:test'
import assert from 'node:assert/strict'
import { rankingRoom } from './proposal-ranking-test-support.ts'
import { recordOutcome, roundOutcome, deckBuildDiagnostics } from './proposal-outcome.ts'
import { retire, proposalSnapshot } from './proposal-machine.ts'
import { cards } from './proposal-ranking-test-support.ts'
import { expiredRoundOutcomes } from './proposal-expired-outcomes.ts'
import { ProposalMemoryRepository } from './proposal-test-support.ts'
import type { Sql } from './repository.server.ts'
test('count-only outcomes survive retirement, first match timestamp is stable and snapshots omit private state', () => {
  const room = rankingRoom(); room.candidates = cards(3); room.seenKeys = ['movie_1', 'movie_2', 'movie_3']; room.startedAt = 100
  const p = room.participants[0]
  p.votes = { 'movie:1': { value: 'pass', revision: 1 }, 'movie:2': { value: 'watch', revision: 1 } }
  p.lastVotedId = 'movie:2'
  recordOutcome(room, undefined, 200)
  assert.equal(room.firstMatchAt, 200)
  retire(room)
  assert.equal(p.votes['movie:1'], undefined)
  assert.equal(room.outcome?.find(c => c.position === 0)?.nope, 1)
  recordOutcome(room, undefined, 300)
  assert.equal(room.firstMatchAt, 200)
  Object.assign(room.outcome![0], { privateValue: 'secret-profile' })
  const event = roundOutcome(room)
  assert.equal(event.firstMatchMs, 100)
  const json = JSON.stringify(event)
  for (const privateValue of ['secret-profile', 'person-private-id', 'room-private-key', 'Secret name', 'movie_1', 'movie:2', 'Private title', 'vector', 'score']) assert.equal(json.includes(privateValue), false)
  assert.deepEqual(Object.keys(event).sort(), ['event', 'rankerVersion', 'end', 'people', 'tasteSources', 'kinds', 'ideasOn', 'cardsDealt', 'cards', 'matches', 'firstMatchPosition', 'firstMatchMs', 'decisionMs', 'decided'].sort())
  const projected = proposalSnapshot(room, p.id)
  assert.equal('outcome' in projected.shared, false); assert.equal('startedAt' in projected.shared, false)
})
test('deck log diagnostics use an exact aggregate allowlist', () => {
  const diagnostics = { rankerVersion: 'picks-1', poolSize: 100, poolStep: 0, medianScore: 80, medianVotes: 10000, tasteShare: .5,
    reasons: { well_liked: 10, secret: 'private-title' }, profile: 'private-profile' }
  const log = JSON.stringify(deckBuildDiagnostics(diagnostics))
  assert.equal(log.includes('private'), false)
  assert.equal(log.includes('secret'), false)
})
test('logical expiry emits once after CAS and does not wait for physical room deletion', async () => {
  const room = rankingRoom(); room.candidates = cards(1); room.seenKeys = ['movie_1']; room.startedAt = 100; room.expiresAt = 1000
  recordOutcome(room, undefined, 500)
  const repo = new ProposalMemoryRepository(); await repo.insert(room)
  const sql: Sql = async () => ({ rows: [[room.id]], rowcount: 1 })
  const lines: string[] = [], info = console.info; console.info = line => lines.push(line)
  let ended = 0
  try {
    await expiredRoundOutcomes(sql, repo, 1001, async () => { ended++ })
    await expiredRoundOutcomes(sql, repo, 1002, async () => { ended++ })
  } finally { console.info = info }
  assert.equal(lines.length, 1); assert.equal(ended, 1)
  assert.equal(JSON.parse(lines[0]).end, 'expiry')
  assert.equal((await repo.read(room.id))?.room.outcomeEmittedAt, 1001)
  assert.equal(lines[0].includes(room.id), false)
})
