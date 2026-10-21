import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GUEST_CANDIDATE_KINDS, paths, type RoomCommand } from '../../../packages/yepwatch-contracts/index.ts'
import { YepWatchService } from './service.server.ts'
import { MemoryRoomRepository, fixtureCatalog } from './test-support.ts'
import { createYepWatchHandler } from './http.server.ts'
async function guestRoom() {
  const repository = new MemoryRoomRepository(); let reads = 0
  const service = new YepWatchService(repository, { ...fixtureCatalog, async episodes(id) { reads++; return fixtureCatalog.episodes(id) }, async candidates(room) { reads++; return fixtureCatalog.candidates(room) } }, 'guest-scope-test-server-secret-longer-than32')
  const admission = await service.create({ commandId: 'create', admissionSecret: 'a'.repeat(43), nickname: 'Host' })
  const id = admission.credential.roomId; const actor = { participantId: admission.credential.participantId, token: admission.credential.token }
  const send = async (command: RoomCommand) => { const own = (await service.read(id, actor)).own; return service.command(id, actor, { commandId: `command_${own.nextSequence}`, sequence: own.nextSequence, command }) }
  const setup = () => send({ type: 'setup', expectedContextVersion: 1, screens: [{ id: 'tv', label: 'Our screen', country: 'DE', serviceIds: [8], confirmed: true }], screenId: 'tv', constraints: { kinds: [...GUEST_CANDIDATE_KINDS], maxMinutes: null, moods: [] } })
  return { service, repository, admission, id, actor, send, setup, reads: () => reads }
}
test('Guests default to movies and new shows; host Start can explicitly express only own readiness', async () => {
  const h = await guestRoom(); assert.deepEqual(h.admission.snapshot.shared.constraints.kinds, GUEST_CANDIDATE_KINDS)
  await h.setup()
  const before = await h.service.read(h.id, h.actor); assert.equal(before.shared.participants[0].ready, false)
  const result = await h.send({ type: 'start_round', expectedContextVersion: 2, expectedRosterVersion: 1, hostReady: true })
  assert.equal(result.snapshot.shared.phase, 'voting'); assert.equal(result.snapshot.shared.participants[0].ready, true); assert.equal(h.reads(), 1)
})
test('Guest continuation/manual input/proposals/reads are blocked before catalog work and leave state unchanged', async () => {
  const h = await guestRoom(); await h.setup(); const before = await h.service.read(h.id, h.actor)
  await assert.rejects(h.send({ type: 'show_progress', showId: 10, input: { state: 'continue', nextEpisodeId: 102 }, approvedEpisodeId: 102 }), { code: 'invalid_request', details: { type: 'access', reason: 'manual_progress_not_supported', actions: ['use_guest_modes'] } })
  await assert.rejects(h.send({ type: 'propose_episode', expectedContextVersion: 2, showId: 10, episodeId: 102 }), { code: 'member_required' })
  await assert.rejects(h.service.showProgress(h.id, h.actor, 10), { code: 'member_required' })
  await assert.rejects(h.send({ type: 'setup', expectedContextVersion: 2, screens: before.shared.screens, screenId: 'tv', constraints: { ...before.shared.constraints, kinds: ['show_continue'] } }), { code: 'member_required' })
  assert.equal(h.reads(), 0); assert.deepEqual(await h.service.read(h.id, h.actor), before)
})
test('Legacy all-mode guest rooms require explicit scope correction, never a silent rewrite or scan', async () => {
  const h = await guestRoom(); await h.setup()
  const old = (await h.repository.read(h.id))!; old.room.constraints.kinds.push('show_continue'); old.room.participants[0].ready = true
  await h.repository.compareAndSwap(old, old.room, false)
  const before = await h.service.read(h.id, h.actor)
  await assert.rejects(h.send({ type: 'start_round', expectedContextVersion: 2, expectedRosterVersion: 1 }), { code: 'member_required' })
  assert.deepEqual(await h.service.read(h.id, h.actor), before); assert.equal(h.reads(), 0)
  const handler = createYepWatchHandler(h.service, { serviceSecret: 'gateway-service-secret-longer-than32', allowedOrigins: ['https://yepwatch.test'] })
  const response = await handler(new Request(`https://yepwatch.test${paths.commands(h.id)}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${h.actor.token}`, 'x-yepwatch-participant': h.actor.participantId }, body: JSON.stringify({ commandId: 'legacy', sequence: before.own.nextSequence, command: { type: 'start_round', expectedContextVersion: 2, expectedRosterVersion: 1 } }) }))
  assert.equal(response.status, 403); assert.equal((await response.json()).error.details.reason, 'member_auth_unavailable')
})
test('hostReady cannot ready another guest and cannot bypass confirmed host screen', async () => {
  const h = await guestRoom(); await h.setup()
  await h.service.join(h.id, { commandId: 'join', admissionSecret: 'b'.repeat(43), nickname: 'Other', inviteCode: h.admission.invite.code, screenId: 'tv' })
  const before = await h.service.read(h.id, h.actor)
  await assert.rejects(h.send({ type: 'start_round', expectedContextVersion: 2, expectedRosterVersion: before.shared.rosterVersion, hostReady: true }), { code: 'needs_context' })
  assert.deepEqual(await h.service.read(h.id, h.actor), before); assert.equal(h.reads(), 0)
  const solo = await guestRoom(); await solo.setup(); const stored = (await solo.repository.read(solo.id))!; stored.room.screens[0].confirmed = false; await solo.repository.compareAndSwap(stored, stored.room, false)
  await assert.rejects(solo.send({ type: 'start_round', expectedContextVersion: 2, expectedRosterVersion: 1, hostReady: true }), { code: 'needs_context' }); assert.equal(solo.reads(), 0)
})

test('Legacy guest continuation rounds cannot vote or finalize from manually entered history; explicit restart remains available', async () => {
  const h = await guestRoom(); await h.setup()
  const stored = (await h.repository.read(h.id))!; const room = stored.room
  room.constraints.kinds = ['show_continue']; room.participants[0].progress = [{ showId: 10, input: { state: 'continue', nextEpisodeId: 102 }, approvedEpisodeId: 102 }]
  room.episodeProposals = [{ showId: 10, episode: { tmdbId: 102, season: 1, number: 2 }, version: 1 }]
  room.candidates = await fixtureCatalog.candidates(room); room.round = { version: 1, rosterVersion: room.rosterVersion, contextVersion: room.contextVersion, memberIds: [h.actor.participantId] }; room.roundVersion = 1
  room.phase = 'shortlist'; room.shortlist = room.candidates.map(c => c.id); room.shortlistVersion = 1; room.proposedId = room.shortlist[0]; room.proposalVersion = 1; room.participants[0].consent = { proposalVersion: 1, accepted: true }
  await h.repository.compareAndSwap(stored, room, false)
  let rechecks = 0
  h.service.catalog.recheck = async () => { rechecks++; return room.candidates[0].availability }
  const before = await h.service.read(h.id, h.actor)
  await assert.rejects(h.send({ type: 'decide', proposalVersion: 1 }), { code: 'member_required' })
  await assert.rejects(h.send({ type: 'vote', roundVersion: 1, candidateId: room.candidates[0].id, expectedVoteRevision: 0, value: 'watch' }), { code: 'member_required' })
  assert.equal(rechecks, 0); assert.deepEqual(await h.service.read(h.id, h.actor), before)
  const restarted = await h.send({ type: 'new_round', expectedRevision: before.shared.revision }); assert.equal(restarted.snapshot.shared.phase, 'setup')
  const reset = restarted.snapshot.shared
  const corrected = await h.send({ type: 'setup', expectedContextVersion: reset.contextVersion, screens: reset.screens, screenId: 'tv', constraints: { ...reset.constraints, kinds: [...GUEST_CANDIDATE_KINDS] } })
  const started = await h.send({ type: 'start_round', expectedContextVersion: corrected.snapshot.shared.contextVersion, expectedRosterVersion: corrected.snapshot.shared.rosterVersion, hostReady: true })
  assert.ok(started.snapshot.shared.candidates.every(c => c.identity.kind !== 'show_continue'))
})
