import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { paths, type GuestAdmission, type GuestCredential, type RoomSnapshot, type RoomCommand, type ServerRealtimeFrame } from '@goodwatch/yepwatch-contracts/proposal'
import { ProposalSimulator } from '../simulator-proposal/engine.js'
import { proposalProjection } from '../src/proposal-projection.js'
import { connect, until, sleep } from './client.js'

test('Proposal controller starts empty and controls only fresh admitted peers with bounded setup', async t => {
  const sim = new ProposalSimulator({ apiOrigin: 'http://127.0.0.1:15992', wsOrigin: 'ws://127.0.0.1:4324', appOrigin: 'http://127.0.0.1:8133' })
  t.after(() => sim.close())
  assert.equal(sim.state().room, false); assert.equal(sim.state().inviteCode, '')
  await assert.rejects(sim.startChoosing(), /fresh room/)
  await assert.rejects(sim.action('actual-phone-or-existing-actor', 'agree'), /fresh demo/)
  await assert.rejects(sim.fresh({ count: 4, scenario: 'agreement', paceMs: 700 }), /one to three/)
  assert.throws(() => new ProposalSimulator({ apiOrigin: 'https://yepwatch.com', wsOrigin: 'ws://127.0.0.1:4324', appOrigin: 'http://127.0.0.1:8133' }))
})

test('Actual proposal API/simulator: independent phone identity, exact retries, replacement/withdrawal, latejoin/undo and fresh-check Done', {
  skip: process.env.YEPWATCH_TEST_PROPOSAL_LIVE !== '1', timeout: 60_000,
}, async t => {
  const api = process.env.YEPWATCH_PROPOSAL_API_ORIGIN ?? 'http://127.0.0.1:15992'
  const ws = process.env.YEPWATCH_PROPOSAL_WS_ORIGIN ?? 'ws://127.0.0.1:4324'
  assert.equal(new URL(api).hostname, '127.0.0.1'); assert.equal(new URL(ws).hostname, '127.0.0.1')
  const sim = new ProposalSimulator({ apiOrigin: api, wsOrigin: ws, appOrigin: 'http://127.0.0.1:8133', serviceId: 8, catalog: 'real-sample' })
  t.after(() => sim.close())
  const fresh = await sim.fresh({ count: 2, scenario: 'agreement', paceMs: 1500 })
  await assert.rejects(sim.startChoosing(), /actual phone/)
  const roomId = sim.state().shared!.roomId, nonce = () => randomBytes(32).toString('base64url')
  async function request<T>(path: string, body?: unknown, credential?: GuestCredential) {
    const r = await fetch(new URL(path, api), { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(12_000),
      headers: { 'Content-Type': 'application/json', 'X-YepWatch-Client': 'native', ...(credential ? { Authorization: `Bearer ${credential.token}`, 'X-YepWatch-Participant': credential.participantId } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) })
    const data = await r.json(); assert.equal(r.status, 200, `Ordinary API result: ${data.error?.code ?? 'unknown'}`); return data as T
  }
  // This is an actual independent native credential client, not physical phone evidence.
  const human = await request<GuestAdmission>(paths.join(roomId), { contractVersion: 3, commandId: nonce(), admissionSecret: nonce(), nickname: 'Disposable phone-protocol observer', inviteCode: fresh.inviteCode })
  const read = () => request<RoomSnapshot>(paths.snapshot(roomId), undefined, human.credential)
  async function command(input: (s: RoomSnapshot) => RoomCommand) {
    const s = await read(); return request<{ snapshot: RoomSnapshot }>(paths.commands(roomId), { commandId: nonce(), sequence: s.own.nextSequence, command: input(s) }, human.credential)
  }
  // The app automatically inherits the single confirmed screen and readies its
  // own context. Protocol readiness remains explicit; there is no guest UI gate.
  const joined = await read()
  assert.equal(joined.shared.participants.find(p => p.participantId === human.credential.participantId)?.ready, false)
  assert.equal(joined.own.agreement.agreed, false)
  await command(s => ({ type: 'assign_screen', expectedContextVersion: s.shared.contextVersion, screenId: 'demo' }))
  await command(s => ({ type: 'ready', expectedContextVersion: s.shared.contextVersion, ready: true }))
  const prepared = await read()
  assert.equal(prepared.shared.participants.find(p => p.participantId === human.credential.participantId)?.ready, true)
  assert.equal(prepared.own.agreement.agreed, false)
  const ticket = await request<{ ticket: string }>(paths.realtimeTicket(roomId), {}, human.credential)
  const observer = await connect<ServerRealtimeFrame>(`${ws}${paths.realtime}`, ticket.ticket, {}, roomId)
  t.after(() => observer.ws.close())
  await sim.startChoosing()
  await until(() => sim.state().actors.every(a => a.privateCaughtUp && a.privateCard), 5000)
  const peers = sim.state().actors
  assert.notEqual(peers[0].privateCard!.id, peers[1].privateCard!.id)
  const candidates = (await read()).shared.candidates; assert(candidates.length >= 2, 'Replacement proof needs two actual catalog candidates')
  assert(candidates.every(c => !c.title.startsWith('Fixture ')))
  const original = globalThis.fetch, envelopes: string[] = []; let lose = true
  globalThis.fetch = async (input, init) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    if (body?.command?.type === 'vote') {
      envelopes.push(init!.body as string); const r = await original(input, init)
      if (lose) { lose = false; await r.text(); throw new Error('Injected lost acknowledgement') }; return r
    }
    return original(input, init)
  }
  try { await assert.rejects(sim.action(peers[0].id, 'watch', { candidateId: candidates[0].id }), /outcome_unknown/); await sim.action(peers[0].id, 'retry') }
  finally { globalThis.fetch = original }
  assert.equal(envelopes.length, 2); assert.equal(envelopes[0], envelopes[1])
  for (const c of candidates) {
    await command(s => ({ type: 'vote', generation: s.shared.generation, candidateId: c.id, expectedVoteRevision: s.own.votes.find(v => v.candidateId === c.id)?.revision ?? 0, value: 'watch' }))
    for (const peer of peers) await sim.action(peer.id, 'watch', { candidateId: c.id })
  }
  assert((await read()).shared.matches.every(m => m.averageYepMs === null))
  await sim.action(peers[0].id, 'propose', { candidateId: candidates[0].id })
  await sim.action(peers[1].id, 'agree'); assert.equal((await read()).shared.proposal?.agreeCount, 2)
  await sim.action(peers[1].id, 'withdraw'); assert.equal((await read()).shared.proposal?.agreeCount, 1)
  assert(sim.state().actors[1].paused)
  const version = (await read()).shared.proposalVersion
  await sim.action(peers[0].id, 'propose', { candidateId: candidates[1].id })
  assert((await read()).shared.proposalVersion > version); assert.equal((await read()).shared.proposal?.previousCandidateId, candidates[0].id)
  assert.equal((await read()).shared.proposal?.agreeCount, 1)
  await sim.addGuest()
  const late = sim.state().actors.at(-1)!, pending = (await read()).shared
  assert.equal(pending.proposal?.candidateId, candidates[1].id); assert.equal(pending.proposal?.requiredCount, 4); assert.equal(pending.matches.length, 0)
  await assert.rejects(sim.action(peers[0].id, 'inspect', { inspection: { kind: 'poster', candidateId: candidates[1].id } }), /current shared match/)
  await sim.action(peers[0].id, 'retry')
  await sim.action(late.id, 'agree') // Implies Yep without inventing exposure timing.
  assert((await read()).shared.matches.every(m => m.averageYepMs === null))
  await sim.action(late.id, 'undo', { candidateId: candidates[1].id }); assert.equal((await read()).shared.proposal, null)
  await sim.action(late.id, 'watch', { candidateId: candidates[1].id })
  await sim.action(peers[0].id, 'propose', { candidateId: candidates[1].id })
  for (const inspection of [{ kind: 'poster' as const, candidateId: candidates[1].id }, { kind: 'lens' as const }, { kind: 'dice' as const }]) {
    await sim.action(peers[0].id, 'inspect', { inspection }); await sleep(280)
  }
  await sim.action(late.id, 'disconnect'); assert.equal((await read()).shared.participants.length, 4)
  await sim.action(peers[1].id, 'agree')
  await command(s => ({ type: 'agree', generation: s.shared.generation, expectedRosterVersion: s.shared.rosterVersion, expectedProposalVersion: s.shared.proposalVersion,
    candidateId: s.shared.proposal!.candidateId, expectedOwnAgreementRevision: s.own.agreement.revision, agreed: true }))
  assert.equal((await read()).shared.phase, 'choosing')
  await sim.action(late.id, 'reconnect'); await sim.action(late.id, 'agree')
  assert.equal((await read()).shared.phase, 'decided')
  await until(() => observer.frames.some(f => f.type === 'room.updated' && f.snapshot.phase === 'decided'), 5000)
  for (const f of observer.frames) if (f.type === 'room.snapshot' || f.type === 'room.updated') proposalProjection(f.snapshot, roomId)
  assert(observer.frames.some(f => f.type === 'activity' && f.inspection?.kind === 'poster'))
  assert.equal(sim.state().privacyFailures, 0)
})
