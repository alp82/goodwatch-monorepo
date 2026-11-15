import test from 'node:test'
import assert from 'node:assert/strict'
import { proposalSharedSchema, proposalForClient } from '../src/proposal-projection.js'
import type { SharedRoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal'
const schema = proposalSharedSchema.shape.candidates.element
const card = { id: 'movie_1', identity: { kind: 'movie', tmdbId: 1 }, title: 'Fixture', year: 2020, overview: null, posterUrl: null,
  runtimeMinutes: 90, viewingDuration: { minutes: 90, scope: 'movie' }, availability: [] }
test('strict candidate projection accepts optional reasons and rejects unknown codes, extra fields and oversized text', () => {
  for (const reason of [undefined, null, { code: 'well_liked', text: 'Well liked on GoodWatch' }]) assert.equal(schema.safeParse({ ...card, ...(reason === undefined ? {} : { reason }) }).success, true)
  for (const reason of [{ code: 'unknown', text: 'Unknown' }, { code: 'well_liked', text: '' }, { code: 'well_liked', text: 'a'.repeat(81) }, { code: 'well_liked', text: 'Hi', person: 'private' }]) assert.equal(schema.safeParse({ ...card, reason }).success, false)
})
test('a phone that did not declare candidateReasons gets cards without a reason; one that did gets the snapshot as it is', () => {
  const snapshot = { candidates: [{ ...card, reason: { code: 'well_liked', text: 'Well liked on GoodWatch' } }, card] } as unknown as SharedRoomSnapshot
  const legacy = proposalForClient(snapshot)
  assert.equal(legacy.candidates.some(c => 'reason' in c), false)
  assert.equal(legacy.candidates[0].title, 'Fixture')
  assert.equal(proposalForClient(snapshot, true), snapshot)
})
