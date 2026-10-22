import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { paths, type ServerRealtimeFrame, type ServerActivity } from '@goodwatch/yepwatch-contracts/proposal'
import { createGateway } from '../src/gateway.js'
import type { ActivityBus, ActivityFrame } from '../src/activity.js'
import { proposalProjection } from '../src/proposal-projection.js'
import { proposalClientActivitySchema } from '../src/proposal-activity.js'
import { fixture, FakeBus, proposalSnapshot } from './fixture.js'
import { connect, until, sleep } from './client.js'

function choosing() {
  const s = proposalSnapshot(); s.phase = 'choosing'
  s.candidates = [1, 2].map(n => ({ id: `movie:${n}`, identity: { kind: 'movie' as const, tmdbId: n }, title: `Shared match ${n}`,
    year: 2020, overview: null, posterUrl: null, runtimeMinutes: 90, viewingDuration: { minutes: 90, scope: 'movie' as const }, availability: [] }))
  s.matches = s.candidates.map(c => ({ candidateId: c.id, averageYepMs: null }))
  s.proposalVersion = 1; s.proposal = { candidateId: 'movie:1', version: 1, previousCandidateId: null, agreeCount: 1, requiredCount: 2, averageYepMs: null }
  return s
}
class ActivityHub {
  buses: MemoryActivity[] = []
  bus() { const b = new MemoryActivity(this); this.buses.push(b); return b }
  emit(frame: ActivityFrame) { for (const b of this.buses) if (b.ready) b.emit('activity', frame) }
}
class MemoryActivity extends EventEmitter implements ActivityBus {
  ready = true
  constructor(private hub: ActivityHub) { super() }
  async start() {}
  async publish(frame: ActivityFrame) { this.hub.emit(frame); return true }
  state(ready: boolean) { this.ready = ready; this.emit('state', ready) }
  close() {}
}
async function setup(t: test.TestContext) {
  const api = await fixture('proposal'); api.state.shared = choosing(); api.state.leaseMs = 60_000
  const hub = new ActivityHub(), buses = [new FakeBus(), new FakeBus()], activities = [hub.bus(), hub.bus()]
  const gateways = buses.map((b, n) => createGateway(api.authority, b, { port: 0, auditMs: 1000 }, { activityBus: activities[n], proposal: true }))
  const addresses = await Promise.all(gateways.map(g => g.listen()))
  t.after(async () => { await Promise.all(gateways.map(g => g.close())); await api.close() })
  const clients = await Promise.all(addresses.map((a, n) => {
    assert(a && typeof a !== 'string'); return connect<ServerRealtimeFrame>(`ws://127.0.0.1:${a.port}${paths.realtime}`, api.ticket(`person-${n + 1}`))
  }))
  await until(() => clients.every(c => c.frames.some(f => f.type === 'activity.session')))
  return { api, hub, buses, activities, clients }
}
const events = (frames: ServerRealtimeFrame[]) => frames.filter((f): f is ServerActivity => f.type === 'activity')
const session = (frames: ServerRealtimeFrame[]) => frames.find(f => f.type === 'activity.session')!.sessionId
const send = (client: Awaited<ReturnType<typeof connect<ServerRealtimeFrame>>>, sequence: number, extra = {}) =>
  client.ws.send(JSON.stringify({ type: 'activity', sessionId: session(client.frames), sequence, view: 'matches', ...extra }))

test('Proposal projection is strict, anonymous and accepts pending latejoin with honest missing timing', () => {
  const s = choosing(); assert.equal(proposalProjection(s, s.roomId).proposal?.agreeCount, 1)
  const late = structuredClone(s); late.matches = []; late.participants.push({ participantId: 'late', nickname: 'Late', ready: false, screenId: null }); late.proposal!.requiredCount++
  assert.equal(proposalProjection(late, late.roomId).proposal?.candidateId, 'movie:1')
  const changes = [
    (x: any) => { x.proposal.proposerParticipantId = 'person-1' }, (x: any) => { x.proposal.agreedBy = ['person-1'] },
    (x: any) => { x.matches[0].individualTimes = [100, 200] }, (x: any) => { x.participants[0].agreed = true },
    (x: any) => { x.candidates[0].currentVoter = 'person-1' }, (x: any) => { x.own = { agreement: true } },
    (x: any) => { x.matches[0].averageYepMs = -1 }, (x: any) => { x.proposal.agreeCount = 3 },
    (x: any) => { x.proposal.requiredCount = 1 }, (x: any) => { x.proposal.version = 4 },
    (x: any) => { x.candidates[0].viewingDuration.scope = 'episode' }, (x: any) => { x.matches[0].pickCount = 1 },
    (x: any) => { x.candidates[0].identity.activeExposureMs = 100 },
  ]
  for (const change of changes) { const bad = structuredClone(s); change(bad); assert.throws(() => proposalProjection(bad, s.roomId)) }
})

test('Inspection exact shapes exclude private targets and agreement-person events', () => {
  const base = { type: 'activity', sessionId: 'session', sequence: 1, view: 'matches' }
  for (const inspection of [{ kind: 'poster', candidateId: 'movie:1' }, { kind: 'lens' }, { kind: 'dice' }]) assert(proposalClientActivitySchema.safeParse({ ...base, inspection }).success)
  for (const extra of [{ inspection: { kind: 'dice', candidateId: 'movie:1' } }, { inspection: { kind: 'poster', candidateId: 'movie:1' }, view: 'voting' },
    { inspection: { kind: 'lens', x: .5 } }, { inspection: { kind: 'poster', candidateId: 'movie:1' }, beat: 'answer' },
    { agreed: true }, { activeExposureMs: 50 }, { proposalVersion: 2 }, { value: 'watch' }])
    assert(!proposalClientActivitySchema.safeParse({ ...base, ...extra }).success)
})

test('Actual two-gateway proposal clients: scoped poster/lens/dice, action-only TTL, coalescing and durable aggregates', async t => {
  const { api, hub, buses, clients: [a, b] } = await setup(t)
  send(a, 0, { inspection: { kind: 'poster', candidateId: 'private-unmatched-card' } }); await sleep(280)
  assert.equal(events(b.frames).length, 0)
  send(a, 1, { inspection: { kind: 'poster', candidateId: 'movie:1' } })
  await until(() => events(b.frames).some(f => f.inspection?.kind === 'poster'))
  send(a, 2, { inspection: { kind: 'lens' } }); await until(() => events(b.frames).some(f => f.inspection?.kind === 'lens'))
  send(a, 3, { inspection: { kind: 'dice' } }); await until(() => events(b.frames).some(f => f.inspection?.kind === 'dice'))
  const old = events(b.frames).at(-1)!, before = events(b.frames).length
  hub.emit({ ...old, sequence: 30, serverTime: Date.now() - 1700, expiresAt: Date.now() + 3500 })
  await until(() => events(b.frames).length > before); assert.equal(events(b.frames).at(-1)!.inspection, undefined)
  // A view heartbeat is real presence, and must not recreate an inspection cue.
  send(a, 31); await until(() => events(b.frames).some(f => f.sequence === 31)); assert.equal(events(b.frames).at(-1)!.inspection, undefined)
  // Queued inspection becomes ineligible when a confirmed late join removes its match.
  send(a, 32, { inspection: { kind: 'poster', candidateId: 'movie:1' } })
  api.state.shared.matches = []; api.state.shared.revision++
  api.state.shared.participants.push({ participantId: 'late', nickname: 'Late', screenId: null, ready: false }); api.state.shared.proposal.requiredCount = 3
  buses.forEach(bus => bus.hint(api.state.shared.revision))
  await until(() => b.frames.some(f => f.type === 'room.updated' && f.snapshot.revision === 2))
  await sleep(300); assert(!events(b.frames).some(f => f.sequence === 32))
  hub.emit({ ...old, sequence: 33, serverTime: Date.now(), expiresAt: Date.now() + 5000 }); await sleep(30)
  assert(!events(b.frames).some(f => f.sequence === 33))
  const shared = b.frames.findLast(f => f.type === 'room.updated'); assert(shared?.type === 'room.updated')
  assert.equal(shared.snapshot.proposal?.requiredCount, 3); assert.equal(shared.snapshot.proposal?.agreeCount, 1)
})

test('Proposal delivery outage clears queued inspection and repairs only through an authorized shared snapshot', async t => {
  const { api, activities, buses, clients: [a, b] } = await setup(t)
  activities[0].state(false); await until(() => a.frames.some(f => f.type === 'degraded'))
  send(a, 0, { inspection: { kind: 'dice' } }); await sleep(280); assert.equal(events(b.frames).length, 0)
  api.state.shared.revision++; activities[0].state(true); buses[0].hint(api.state.shared.revision); buses[1].hint(api.state.shared.revision)
  await until(() => a.frames.some(f => f.type === 'room.snapshot' && f.snapshot.revision === 2))
  send(a, 1, { inspection: { kind: 'lens' } }); await until(() => events(b.frames).some(f => f.inspection?.kind === 'lens'))
  assert(!events(b.frames).some(f => f.inspection?.kind === 'dice'))
})
