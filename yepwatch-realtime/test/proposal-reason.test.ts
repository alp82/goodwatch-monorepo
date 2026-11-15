import test from 'node:test'
import assert from 'node:assert/strict'
import { proposalSharedSchema } from '../src/proposal-projection.ts'
const schema = proposalSharedSchema.shape.candidates.element
const card = { id: 'movie_1', identity: { kind: 'movie', tmdbId: 1 }, title: 'Fixture', year: 2020, overview: null, posterUrl: null,
  runtimeMinutes: 90, viewingDuration: { minutes: 90, scope: 'movie' }, availability: [] }
test('strict candidate projection accepts optional reasons and rejects unknown codes, extra fields and oversized text', () => {
  for (const reason of [undefined, null, { code: 'well_liked', text: 'Well liked on GoodWatch' }]) assert.equal(schema.safeParse({ ...card, ...(reason === undefined ? {} : { reason }) }).success, true)
  for (const reason of [{ code: 'unknown', text: 'Unknown' }, { code: 'well_liked', text: '' }, { code: 'well_liked', text: 'a'.repeat(81) }, { code: 'well_liked', text: 'Hi', person: 'private' }]) assert.equal(schema.safeParse({ ...card, reason }).success, false)
})
