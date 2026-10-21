import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import type { CommandEnvelope, RoomCommand } from '../../../packages/yepwatch-contracts/index.ts'
import { paths } from '../../../packages/yepwatch-contracts/index.ts'
import { createYepWatchHandler } from './http.server.ts'
import { YepWatchService } from './service.server.ts'
import { fixtureCatalog, MemoryRoomRepository } from './test-support.ts'
const secret = 'test-only-server-secret-32-characters-long'
const gateway = 'test-only-gateway-secret-32-characters-long'
const admission = (nickname = 'A') => ({ commandId: randomBytes(12).toString('hex'), admissionSecret: randomBytes(32).toString('base64url'), nickname })
async function harness() {
  const repo = new MemoryRoomRepository(); let now = Date.now(); const events: unknown[] = []
  const service = new YepWatchService(repo, fixtureCatalog, secret, async event => { events.push(event) }, () => now)
  const a = await service.create(admission()); const id = a.credential.roomId
  const actor = (c: typeof a.credential) => ({ participantId: c.participantId, token: c.token })
  const send = async (c: typeof a.credential, command: RoomCommand) => { const own = (await service.read(id, actor(c))).own; return service.command(id, actor(c), { commandId: randomBytes(12).toString('hex'), sequence: own.nextSequence, command }) }
  const b = await service.join(id, { ...admission('B'), inviteCode: a.invite.code })
  async function setup(kinds: ('movie' | 'show_start' | 'show_continue')[] = ['movie']) {
    await send(a.credential, { type: 'setup', expectedContextVersion: 1, screens: [{ id: 'couch', label: 'Couch', country: 'DE', serviceIds: [1], confirmed: true }, { id: 'remote', label: 'Remote', country: 'JP', serviceIds: [1], confirmed: true }], constraints: { kinds, maxMinutes: null, moods: [] }, screenId: 'couch' })
    await send(b.credential, { type: 'assign_screen', expectedContextVersion: 2, screenId: 'remote' })
  }
  async function start() { for (const c of [a.credential, b.credential]) { const s = await service.read(id, actor(c)); await send(c, { type: 'ready', expectedContextVersion: s.shared.contextVersion, ready: true }) }; const s = await service.read(id, actor(a.credential)); return send(a.credential, { type: 'start_round', expectedContextVersion: s.shared.contextVersion, expectedRosterVersion: s.shared.rosterVersion }) }
  return { repo, service, a, b, id, actor, send, setup, start, events, advance: (ms: number) => { now += ms } }
}
test('Round completes before shortlist; private votes, immutable roster and atomic consent fencing', async () => {
  const h = await harness(); await h.setup(['movie', 'show_start']); await h.start()
  const vote = async (c: typeof h.a.credential, candidateId: string) => h.send(c, { type: 'vote', roundVersion: 1, candidateId, expectedVoteRevision: 0, value: 'watch' })
  await Promise.all([vote(h.a.credential, 'candidate_0'), vote(h.b.credential, 'candidate_0')])
  let s = await h.service.read(h.id, h.actor(h.a.credential)); assert.equal(s.shared.phase, 'voting'); assert.equal(s.shared.shortlist, null)
  assert.equal(s.own.votes.length, 1); assert.ok(!JSON.stringify(s.shared).includes('tokenHash')); assert.ok(!JSON.stringify(s.shared.participants).includes('candidate_0'))
  const late = await h.service.join(h.id, { ...admission('Late'), inviteCode: h.a.invite.code })
  assert.equal(late.snapshot.shared.participants.find(p => p.nickname === 'Late')?.participation, 'waiting')
  await assert.rejects(h.send(late.credential, { type: 'vote', roundVersion: 1, candidateId: 'candidate_0', expectedVoteRevision: 0, value: 'watch' }), { code: 'forbidden' })
  for (const c of [h.a.credential, h.b.credential]) { await vote(c, 'candidate_1'); await h.send(c, { type: 'complete_round', roundVersion: 1 }) }
  s = await h.service.read(h.id, h.actor(h.a.credential)); assert.equal(s.shared.phase, 'shortlist'); assert.deepEqual(s.shared.shortlist?.candidateIds, ['candidate_0', 'candidate_1'])
  await h.send(h.a.credential, { type: 'propose', shortlistVersion: 1, candidateId: 'candidate_0' })
  for (const c of [h.a.credential, h.b.credential]) await h.send(c, { type: 'consent', proposalVersion: 1, accepted: true })
  await h.send(h.a.credential, { type: 'propose', shortlistVersion: 1, candidateId: 'candidate_1' })
  await assert.rejects(h.send(h.a.credential, { type: 'decide', proposalVersion: 1 }), { code: 'conflict' })
  for (const c of [h.a.credential, h.b.credential]) await h.send(c, { type: 'consent', proposalVersion: 2, accepted: true })
  const final = await h.send(h.a.credential, { type: 'decide', proposalVersion: 2 }); assert.equal(final.snapshot.shared.decision?.candidateId, 'candidate_1')
  assert.ok(h.events.every(e => Object.keys(e as object).sort().join() === 'revision,roomId'))
})
test('Ambiguous committed write retries same receipt; changed payload and stale vote revision fail', async () => {
  const h = await harness(); await h.setup(); await h.start()
  const command: CommandEnvelope = { commandId: 'lost_ack', sequence: (await h.service.read(h.id, h.actor(h.a.credential))).own.nextSequence, command: { type: 'vote', roundVersion: 1, candidateId: 'candidate_0', expectedVoteRevision: 0, value: 'watch' } }
  h.repo.ambiguousNext = true
  const one = await h.service.command(h.id, h.actor(h.a.credential), command); const two = await h.service.command(h.id, h.actor(h.a.credential), command)
  assert.equal(one.receipt.appliedRevision, two.receipt.appliedRevision); assert.equal(two.receipt.replayed, true)
  await assert.rejects(h.service.command(h.id, h.actor(h.a.credential), { ...command, command: { ...command.command as Extract<RoomCommand, { type: 'vote' }>, value: 'pass' } }), { code: 'conflict' })
  await assert.rejects(h.send(h.a.credential, { type: 'vote', roundVersion: 1, candidateId: 'candidate_0', expectedVoteRevision: 0, value: null }), { code: 'conflict' })
})
test('Continuation requires known canonical progress and individual explicit episode agreement', async () => {
  const h = await harness(); await h.setup(['show_continue'])
  await assert.rejects(h.start(), { code: 'needs_progress' })
  await assert.rejects(h.send(h.a.credential, { type: 'show_progress', showId: 10, input: { state: 'continue', nextEpisodeId: 999 }, approvedEpisodeId: 999 }), { code: 'invalid_request' })
  await h.send(h.a.credential, { type: 'propose_episode', expectedContextVersion: (await h.service.read(h.id, h.actor(h.a.credential))).shared.contextVersion, showId: 10, episodeId: 102 })
  for (const c of [h.a.credential, h.b.credential]) await h.send(c, { type: 'show_progress', showId: 10, input: { state: 'continue', nextEpisodeId: c === h.a.credential ? 101 : 102 }, approvedEpisodeId: 102 })
  const result = await h.start(); assert.equal(result.snapshot.shared.candidates[0].identity.kind, 'show_continue')
  assert.ok(!JSON.stringify(result.snapshot.shared).includes('nextEpisodeId')); assert.equal(result.snapshot.own.progress[0].input.state, 'continue')
})
test('Tickets consume exactly once, lease expiry/epoch checked and expired room never leaks state', async () => {
  const h = await harness(); const ticket = await h.service.ticket(h.id, h.actor(h.a.credential))
  const consumed = await Promise.allSettled([h.service.attach(h.id, ticket.ticket), h.service.attach(h.id, ticket.ticket)])
  assert.equal(consumed.filter(r => r.status === 'fulfilled').length, 1)
  const attachment = (consumed.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<YepWatchService['attach']>>>).value
  const view = await h.service.view(h.id, attachment.lease); assert.equal(view.snapshot.roomId, h.id); assert.ok(!('own' in view.snapshot))
  const stored = (await h.repo.read(h.id))!; stored.room.participants[0].epoch++; await h.repo.compareAndSwap(stored, stored.room, false)
  await assert.rejects(h.service.view(h.id, view.lease), { code: 'forbidden' })
  const fresh = await h.service.ticket(h.id, h.actor(h.b.credential)); h.advance(31_000); await assert.rejects(h.service.attach(h.id, fresh.ticket), { code: 'unauthorized' })
  h.advance(7 * 60 * 60 * 1000); await assert.rejects(h.service.read(h.id, h.actor(h.b.credential)), { code: 'expired' })
})
test('HTTP separates browser cookies/native credentials, validates origins, and gates private hooks', async () => {
  const h = await harness(); const handler = createYepWatchHandler(h.service, { serviceSecret: gateway, allowedOrigins: ['https://yepwatch.test'] })
  const post = (path: string, value: unknown, headers = {}) => handler(new Request(`https://yepwatch.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value) }))
  const browser = await post(paths.rooms, admission('Browser'), { origin: 'https://yepwatch.test' }); assert.equal(browser.status, 200)
  const admitted = await browser.json(); assert.equal(admitted.credential.token, ''); assert.match(browser.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax/)
  const cookie = browser.headers.get('set-cookie')!.split(';')[0]
  const forbidden = await post(paths.realtimeTicket(admitted.credential.roomId), {}, { cookie, origin: 'https://evil.test' }); assert.equal(forbidden.status, 403)
  const ticket = await post(paths.realtimeTicket(admitted.credential.roomId), {}, { cookie, origin: 'https://yepwatch.test' }); assert.equal(ticket.status, 200)
  const value = await ticket.json()
  assert.equal((await post(paths.realtimeAttach, { roomId: admitted.credential.roomId, ticket: value.ticket })).status, 401)
  const attached = await post(paths.realtimeAttach, { roomId: admitted.credential.roomId, ticket: value.ticket }, { authorization: `Bearer ${gateway}` }); assert.equal(attached.status, 200)
  const projection = await post(paths.realtimeView, { roomId: admitted.credential.roomId, lease: (await attached.json()).lease }, { authorization: `Bearer ${gateway}` }); assert.equal(projection.status, 200); assert.ok(!('own' in (await projection.json()).snapshot))
})
test('Post-commit publish failure leaves durable marker; repair publishes revision-only', async () => {
  const repo = new MemoryRoomRepository(); let fail = true; const events: object[] = []
  const service = new YepWatchService(repo, fixtureCatalog, secret, async event => { if (fail) throw new Error('bus unavailable'); events.push(event) })
  const created = await service.create(admission()); assert.ok((await repo.read(created.credential.roomId))!.pendingRevision)
  fail = false; await service.repairNotifications(); assert.equal(events.length, 1); assert.equal((await repo.read(created.credential.roomId))!.pendingRevision, 0)
})

test('Browser invite re-admission resumes existing host instead of replacing cookie identity', async () => {
  const h = await harness(); const handler = createYepWatchHandler(h.service, { serviceSecret: gateway, allowedOrigins: ['https://yepwatch.test'] })
  const post = (path: string, value: unknown, cookie?: string) => handler(new Request(`https://yepwatch.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://yepwatch.test', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(value) }))
  const created = await post(paths.rooms, admission('Host')); const original = await created.json(); const cookie = created.headers.get('set-cookie')!.split(';')[0]
  const joined = await post(paths.join(original.credential.roomId), { ...admission('Accidental other identity'), inviteCode: original.invite.code }, cookie)
  assert.equal(joined.status, 200); const recovered = await joined.json()
  assert.equal(recovered.recovered, true); assert.equal(recovered.credential.participantId, original.credential.participantId)
  assert.equal(recovered.snapshot.own.canHost, true); assert.equal(recovered.snapshot.shared.participants.length, 1)
  assert.equal(joined.headers.get('set-cookie')!.split(';')[0], cookie)
})
test('Private progress cannot be probed through arbitrary show queries or missing/unknown inputs; explicit proposals are intentionally shared', async () => {
  const h = await harness(); await h.setup(['show_continue'])
  await h.send(h.a.credential, { type: 'show_progress', showId: 10, input: { state: 'continue', nextEpisodeId: 102 }, approvedEpisodeId: 102 })
  const before = await h.service.showProgress(h.id, h.actor(h.b.credential), 10)
  assert.equal(before.conflicts[0].proposedEpisode, null); assert.equal(before.conflicts[0].ownNextEpisodeId, null)
  const arbitrary = await h.service.showProgress(h.id, h.actor(h.b.credential), 999)
  assert.equal(arbitrary.conflicts[0].proposedEpisode, null)
  await h.send(h.b.credential, { type: 'show_progress', showId: 10, input: { state: 'unknown' }, approvedEpisodeId: null })
  assert.equal((await h.service.showProgress(h.id, h.actor(h.b.credential), 10)).conflicts[0].proposedEpisode, null)
  const s = await h.service.read(h.id, h.actor(h.a.credential))
  await h.send(h.a.credential, { type: 'propose_episode', expectedContextVersion: s.shared.contextVersion, showId: 10, episodeId: 101 })
  const after = await h.service.showProgress(h.id, h.actor(h.b.credential), 10)
  assert.equal(after.conflicts[0].reason, 'missing_progress'); assert.equal(after.conflicts[0].proposedEpisode?.tmdbId, 101)
  assert.deepEqual((await h.service.read(h.id, h.actor(h.b.credential))).shared.episodeProposals[0].episode, after.conflicts[0].proposedEpisode)
  assert.equal((await h.service.showProgress(h.id, h.actor(h.b.credential), 999)).conflicts[0].proposedEpisode, null)
})
