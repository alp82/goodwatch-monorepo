import test from 'node:test'
import assert from 'node:assert/strict'
import { rankingRoom, cards } from './proposal-ranking-test-support.ts'
import { proposalSnapshot } from './proposal-machine.ts'
import { proposalForClient } from '../../../../yepwatch-realtime/src/proposal-projection.ts'
import { parseFrame } from '../../../../yepwatch-app/src/core/continuous/wire.ts'
import { ProposalService } from './proposal-service.server.ts'
import { ProposalMemoryRepository, proposalFixtureCatalog } from './proposal-test-support.ts'
import { createProposalHandler } from './proposal-http.server.ts'
import { paths } from '../../../packages/yepwatch-contracts/proposal.ts'
test('actual installed wire parser reads legacy frames; new reasons are delivered only on declared support', () => {
  const room = rankingRoom(); room.candidates = cards(1)
  room.candidates[0].reason = { code: 'well_liked', text: 'Well liked on GoodWatch' }
  const shared = proposalSnapshot(room, room.hostId).shared
  const frame = (snapshot: typeof shared) => JSON.stringify({ type: 'room.updated', snapshot })
  assert.equal(parseFrame(frame(shared)), null, 'the old strict bundle rejects new fields')
  const legacy = proposalForClient(shared)
  assert.equal('reason' in legacy.candidates[0], false)
  assert.ok(parseFrame(frame(legacy)), 'default gateway delivery keeps the installed bundle working')
  assert.equal(proposalForClient(shared, true), shared)
})
test('HTTP read responses omit reasons by default and include them only with candidateReasons=1', async () => {
  const repo = new ProposalMemoryRepository(), service = new ProposalService(repo, proposalFixtureCatalog, 'compat-test-secret-at-least-thirty-two')
  const admission = await service.create({ contractVersion: 3, commandId: 'new', admissionSecret: 'a'.repeat(43), nickname: 'Host' })
  const id = admission.credential.roomId, row = repo.rows.get(id)!
  row.room.phase = 'choosing'; row.room.candidates = cards(1); row.room.candidates[0].reason = { code: 'well_liked', text: 'Well liked on GoodWatch' }
  const handler = createProposalHandler(service, { serviceSecret: 's'.repeat(32), allowedOrigins: ['https://yepwatch.example'] })
  const read = async (query = '') => {
    const response = await handler(new Request(`https://yepwatch.example${paths.rooms}/${id}${query}`, { headers: { origin: 'https://yepwatch.example',
      authorization: `Bearer ${admission.credential.token}`, 'x-yepwatch-participant': admission.credential.participantId } }))
    assert.equal(response.status, 200)
    return response.json()
  }
  assert.equal('reason' in (await read()).shared.candidates[0], false)
  assert.equal((await read('?candidateReasons=1')).shared.candidates[0].reason.code, 'well_liked')
})
