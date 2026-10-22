import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { paths, type ServerRealtimeFrame, type ServerActivity } from '@goodwatch/yepwatch-contracts/continuous'
import { createGateway, type GatewayOptions } from '../src/gateway.js'
import type { ActivityBus } from '../src/activity.js'
import { continuousProjection } from '../src/continuous-projection.js'
import { fixture, FakeBus, continuousSnapshot } from './fixture.js'
import { connect, until, sleep } from './client.js'

class ActivityHub {
  buses: FakeActivityBus[] = []
  bus() { const bus = new FakeActivityBus(this); this.buses.push(bus); return bus }
  emit(input: unknown) { for (const bus of this.buses) if (bus.ready) bus.emit('activity', input) }
}
class FakeActivityBus extends EventEmitter implements ActivityBus {
  ready = true
  constructor(private hub: ActivityHub) { super() }
  async start() {}
  async publish(frame: ServerActivity) { if (!this.ready) return false; this.hub.emit(frame); return true }
  state(ready: boolean) { this.ready = ready; this.emit('state', ready) }
  close() {}
}
const socket = (url: string, ticket?: string) => connect<ServerRealtimeFrame>(url, ticket)
const activities = (frames: ServerRealtimeFrame[]) => frames.filter((f): f is ServerActivity => f.type === 'activity')
const session = (frames: ServerRealtimeFrame[]) => frames.find(f => f.type === 'activity.session')?.sessionId
const snapshots = (frames: ServerRealtimeFrame[]) => frames.filter(f => f.type === 'room.snapshot' || f.type === 'room.updated')
async function setup(t: test.TestContext, overrides: Partial<GatewayOptions> = {}) {
  const api = await fixture(true); api.state.leaseMs = 60_000
  const hub = new ActivityHub(), activityA = hub.bus(), activityB = hub.bus(), busA = new FakeBus(), busB = new FakeBus()
  const a = createGateway(api.authority, busA, { port: 0, auditMs: 10_000, heartbeatMs: 1000, ...overrides }, { activityBus: activityA })
  const b = createGateway(api.authority, busB, { port: 0, auditMs: 10_000, heartbeatMs: 1000, ...overrides }, { activityBus: activityB })
  const addrA = await a.listen(), addrB = await b.listen()
  assert(addrA && typeof addrA !== 'string' && addrB && typeof addrB !== 'string')
  t.after(async () => { await a.close(); await b.close(); await api.close() })
  return { api, hub, activityA, activityB, busA, busB, a, b,
    urlA: `ws://127.0.0.1:${addrA.port}${paths.realtime}`, urlB: `ws://127.0.0.1:${addrB.port}${paths.realtime}` }
}
function emit(client: Awaited<ReturnType<typeof socket>>, sequence: number, extra = {}) {
  client.ws.send(JSON.stringify({ type: 'activity', sessionId: session(client.frames), sequence, view: 'voting', ...extra }))
}

test('Continuous runtime projection permits matches/counts but rejects nested private, activity and pick ownership data', () => {
  const clean = continuousSnapshot()
  clean.phase = 'choosing'
  clean.candidates = [{ id: 'movie:1', identity: { kind: 'movie', tmdbId: 1 }, title: 'Public title', year: 2020,
    overview: null, posterUrl: null, runtimeMinutes: 90, availability: [], goodwatchScore: 8.1, genres: ['Drama'], trailerUrl: null }]
  clean.matches = [{ candidateId: 'movie:1', pickCount: 1 }]
  assert.equal(continuousProjection(clean, clean.roomId).matches[0].pickCount, 1)
  const mutations = [
    (s: any) => { s.own = { pick: 'movie:1' } }, (s: any) => { s.pick = 'movie:1' },
    (s: any) => { s.participants[0].nextCandidateId = 'movie:1' }, (s: any) => { s.participants[0].completedCount = 1 },
    (s: any) => { s.candidates[0].votes = ['watch'] }, (s: any) => { s.candidates[0].identity.direction = 'pass' },
    (s: any) => { s.matches[0].participantId = 'person-1' }, (s: any) => { s.matches[0].pickCount = 3 },
    (s: any) => { s.agreement.error = { code: 'busy', details: { type: 'catalog', reason: 'catalog_loading', actions: ['retry'], currentCard: 'secret' } } },
    (s: any) => { s.stream.cursor = 10 }, (s: any) => { s.contractVersion = 1 },
    (s: any) => { s.decision = { candidateId: 'movie:1', agreementVersion: 1, decidedAt: Date.now(), availability: [] } },
  ]
  for (const mutate of mutations) { const bad = structuredClone(clean); mutate(bad); assert.throws(() => continuousProjection(bad, clean.roomId)) }
})

test('Continuous first-frame tickets, replay, expiry/room binding, snapshot-before-session and reconnect fencing', async t => {
  const { api, urlA } = await setup(t, { authTimeoutMs: 70 })
  for (const ticket of ['wrong', api.ticket('person-1', Date.now() - 1), api.ticket('person-1', Date.now() + 5000, 'other')]) {
    const client = await socket(urlA, ticket); await until(() => client.closed !== undefined)
    assert.equal(snapshots(client.frames).length, 0); assert(!session(client.frames))
  }
  const idle = await socket(urlA); await until(() => idle.closed === 1008)
  let release: (() => void) | undefined
  api.state.beforeView = () => new Promise<void>(resolve => { release = resolve })
  const ticket = api.ticket(), client = await socket(urlA, ticket)
  await until(() => !!release); assert(!session(client.frames)); assert.equal(snapshots(client.frames).length, 0)
  api.state.beforeView = undefined; release!()
  await until(() => !!session(client.frames))
  assert.equal(client.frames[0].type, 'room.snapshot'); assert.equal(client.frames[1].type, 'activity.session')
  const replay = await socket(urlA, ticket); await until(() => replay.closed === 1008)
  const old = session(client.frames); client.ws.close(); await until(() => client.closed !== undefined)
  const fresh = await socket(urlA, api.ticket()); await until(() => !!session(fresh.frames)); assert.notEqual(session(fresh.frames), old)
  emit(fresh, 0, { sessionId: old }); await until(() => fresh.closed === 1008)
})

test('Actual cross-gateway clients: strict neutral activity, coalescing, stale fencing and multidevice disconnect', async t => {
  const { api, hub, urlA, urlB } = await setup(t)
  const first = await socket(urlA, api.ticket()), receiver = await socket(urlB, api.ticket('person-2')), otherDevice = await socket(urlB, api.ticket())
  await until(() => !!session(first.frames) && !!session(receiver.frames) && !!session(otherDevice.frames))
  for (let n = 0; n < 8; n++) emit(first, n, { gesture: 'handle', beat: 'answer' })
  await until(() => activities(receiver.frames).some(f => f.sequence === 7))
  assert.equal(activities(first.frames).length, 0); assert.equal(activities(otherDevice.frames).length, 0)
  const frame = activities(receiver.frames).at(-1)!
  assert.equal(frame.participantId, 'person-1'); assert.equal(frame.roomId, 'room-1'); assert.equal(frame.sessionId, session(first.frames))
  assert(frame.expiresAt > frame.serverTime && frame.expiresAt <= frame.serverTime + 6000)
  assert.deepEqual(Object.keys(frame).sort(), ['type', 'roomId', 'participantId', 'sessionId', 'sequence', 'serverTime', 'expiresAt', 'view', 'gesture', 'beat'].sort())
  const before = activities(receiver.frames).length
  emit(first, 2, { view: 'trailer' }); await sleep(270); assert.equal(activities(receiver.frames).length, before)
  for (const payload of [{ ...frame, sequence: 20, title: 'secret' }, { ...frame, sequence: 21, x: 0.4 },
    { ...frame, sequence: 22, roomId: 'another-room' }, { ...frame, sequence: 23, participantId: 'stranger' },
    { ...frame, sequence: 24, expiresAt: Date.now() - 1 }, { ...frame, sequence: 25, serverTime: Date.now() + 5000 }]) hub.emit(payload)
  await sleep(30); assert.equal(activities(receiver.frames).length, before)
  emit(otherDevice, 0, { view: 'trailer' }); await until(() => activities(receiver.frames).some(f => f.sessionId === session(otherDevice.frames)))
  first.ws.close(); await until(() => activities(receiver.frames).some(f => f.sessionId === session(first.frames) && f.view === 'away'))
  assert.equal(otherDevice.closed, undefined)
  emit(otherDevice, 1, { view: 'matches' }); await until(() => activities(receiver.frames).some(f => f.sessionId === session(otherDevice.frames) && f.sequence === 1))
  const invalid = await socket(urlA, api.ticket()); await until(() => !!session(invalid.frames))
  emit(invalid, 0, { pointerX: 0.1, direction: 'left' }); await until(() => invalid.closed === 1008)
  assert(!JSON.stringify(receiver.frames).includes('pointerX'))
})

test('Activity rate caps, authority revocation and bus uncertainty suppress queued delivery; recovery resnapshots', async t => {
  const { api, activityA, busA, urlA, urlB } = await setup(t, { auditMs: 60 })
  const sender = await socket(urlA, api.ticket()), receiver = await socket(urlB, api.ticket('person-2'))
  await until(() => !!session(sender.frames) && !!session(receiver.frames))
  for (let sequence = 0; sequence < 30; sequence++) emit(sender, sequence, { gesture: 'reach' })
  await until(() => activities(receiver.frames).length > 0)
  assert(activities(receiver.frames).every(f => f.sequence <= 7)); assert(activities(receiver.frames).length <= 8)
  activityA.state(false); await until(() => sender.frames.some(f => f.type === 'degraded'))
  const count = activities(receiver.frames).length
  emit(sender, 31); await sleep(300); assert.equal(activities(receiver.frames).length, count)
  activityA.state(true); await until(() => snapshots(sender.frames).length >= 2)
  emit(sender, 32, { view: 'trailer' }); await until(() => activities(receiver.frames).some(f => f.sequence === 32))
  emit(sender, 33); api.state.revoked = true; api.state.shared.revision++; busA.hint(api.state.shared.revision)
  await until(() => sender.closed === 1008); await sleep(280)
  assert(!activities(receiver.frames).some(f => f.sequence === 33))
})

test('Continuous backpressure before session; expired authority degrades/closes; restart drains1012', async t => {
  const tight = await setup(t, { maxBufferedBytes: 100 })
  const pressured = await socket(tight.urlA, tight.api.ticket()); await until(() => pressured.closed === 1013); assert(!session(pressured.frames))
  const { api, a, urlA } = await setup(t, { auditMs: 30 })
  api.state.leaseMs = 180
  const expired = await socket(urlA, api.ticket()); await until(() => !!session(expired.frames)); api.state.unavailable = true
  await until(() => expired.frames.some(f => f.type === 'degraded')); await until(() => expired.closed === 1008)
  api.state.unavailable = false; api.state.leaseMs = 60_000
  const live = await socket(urlA, api.ticket()); await until(() => !!session(live.frames))
  await a.close(); await until(() => live.closed === 1012)
})
