import test from 'node:test'
import assert from 'node:assert/strict'
import { WebSocket } from 'ws'
import { paths, type ServerRealtimeFrame } from '@goodwatch/yepwatch-contracts'
import { createGateway, type GatewayOptions } from '../src/gateway.js'
import { HttpAuthority } from '../src/authority.js'
import { FakeBus, fixture } from './fixture.js'

import { sleep, until, connect, snapshots } from './client.js'

async function setup(t: test.TestContext, options: Partial<GatewayOptions> = {}) {
  const api = await fixture(), bus = new FakeBus()
  const gateway = createGateway(api.authority, bus, { port: 0, auditMs: 100, heartbeatMs: 1000, authTimeoutMs: 80, ...options })
  const addr = await gateway.listen()
  assert(addr && typeof addr !== 'string')
  t.after(async () => { await gateway.close(); await api.close() })
  return { api, bus, gateway, url: `ws://127.0.0.1:${addr.port}${paths.realtime}` }
}


test('First-frame credential, replay, expiry, room binding and native missing Origin', async t => {
  const { api, url } = await setup(t)
  for (const ticket of ['wrong', api.ticket('person-1', Date.now() - 1), api.ticket('person-1', Date.now() + 5000, 'other')]) {
    const c = await connect(url, ticket); await until(() => c.closed !== undefined)
    assert.equal(c.closed, 1008); assert.equal(snapshots(c.frames).length, 0)
  }
  const ticket = api.ticket()
  const accepted = await connect(url, ticket)
  await until(() => snapshots(accepted.frames).length === 1)
  const replay = await connect(url, ticket); await until(() => replay.closed !== undefined)
  assert.equal(replay.closed, 1008)
  const invalidRoom = await connect(url)
  invalidRoom.ws.send(JSON.stringify({ type: 'authenticate', ticket: api.ticket(), roomId: 'other', lastRevision: null }))
  await until(() => invalidRoom.closed !== undefined); assert.equal(invalidRoom.closed, 1008)
})
test('Origin, query and subprotocol rejection; Origin is no credential', async t => {
  const { url } = await setup(t)
  for (const [path, options] of [[url, { origin: 'https://evil.invalid' }], [url + '?ticket=secret', {}], [url, ['secret']]] as const) {
    await assert.rejects(connect(path, undefined, options as any), /403/)
  }
  const c = await connect(url, 'wrong', { origin: 'http://localhost:8081' })
  await until(() => c.closed !== undefined); assert.equal(c.closed, 1008)
})
test('Authentication timeout, extra preauth frame, binary, and bounded frame budget', async t => {
  const { api, url } = await setup(t, { maxFramesPerWindow: 3 })
  const idle = await connect(url); await until(() => idle.closed !== undefined); assert.equal(idle.closed, 1008)
  const extra = await connect(url)
  const auth = JSON.stringify({ type: 'authenticate', ticket: api.ticket(), roomId: 'room-1', lastRevision: null })
  extra.ws.send(auth); extra.ws.send(auth); await until(() => extra.closed !== undefined); assert.equal(snapshots(extra.frames).length, 0)
  const binary = await connect(url); binary.ws.send(Buffer.from('bad')); await until(() => binary.closed !== undefined)
  const flood = await connect(url, api.ticket()); await until(() => snapshots(flood.frames).length > 0)
  for (let n = 0; n < 4; n++) flood.ws.send('{"type":"ping"}')
  await until(() => flood.closed !== undefined); assert.equal(flood.closed, 1008)
})
test('Missing authority, invalid capability and wrong projection fail closed', async t => {
  const { api, url, bus } = await setup(t)
  api.state.unavailable = true
  const down = await connect(url, api.ticket()); await until(() => down.closed !== undefined)
  assert.equal(snapshots(down.frames).length, 0); assert(down.frames.some(f => f.type === 'degraded'))
  api.state.unavailable = false
  api.state.corruptAttachment = { scope: 'private:read' }
  const scope = await connect(url, api.ticket()); await until(() => scope.closed !== undefined)
  assert.equal(snapshots(scope.frames).length, 0)
  api.state.corruptAttachment = undefined
  const c = await connect(url, api.ticket()); await until(() => snapshots(c.frames).length === 1)
  api.state.shared.roomId = 'other'; bus.hint(2)
  await until(() => c.closed !== undefined || c.frames.some(f => f.type === 'degraded'))
  assert.equal(snapshots(c.frames).length, 1)
})
test('Strict nested shared projection rejects private fields, receipts and early shortlist', async t => {
  const { api, url, bus } = await setup(t)
  const c = await connect(url, api.ticket()); await until(() => snapshots(c.frames).length === 1)
  const clean = structuredClone(api.state.shared)
  for (const mutate of [
    (s: any) => { s.own = { votes: [] } },
    (s: any) => { s.receipt = { commandId: 'secret' } },
    (s: any) => { s.participants[0].candidateId = 'secret' },
    (s: any) => { s.participants[0].direction = 'watch' },
    (s: any) => { s.constraints.history = [] },
    (s: any) => { s.shortlist = { version: 1, proposalVersion: 1, candidateIds: [], proposedCandidateId: null, consentCount: 0 } },
  ]) {
    api.state.shared = structuredClone(clean); api.state.shared.revision++
    mutate(api.state.shared); bus.hint(api.state.shared.revision)
    await sleep(115)
    assert.equal(snapshots(c.frames).length, 1)
  }
})
test('Subscription ACK before final snapshot; hint during read is never lost', async t => {
  const { api, url, bus } = await setup(t, { auditMs: 10_000 })
  bus.state(false)
  const c = await connect(url, api.ticket()); await until(() => c.frames.some(f => f.type === 'degraded'))
  assert.equal(api.state.viewCalls, 0)
  let raced = false
  api.state.beforeView = async () => {
    if (raced) return
    raced = true; api.state.shared.revision = 2; bus.hint(2)
  }
  bus.state(true)
  await until(() => snapshots(c.frames).some(f => f.snapshot.revision === 2))
  assert.deepEqual(snapshots(c.frames).map(f => f.snapshot.revision), [2])
  bus.hint(2); bus.hint(1)
  await sleep(30); assert.equal(snapshots(c.frames).length, 1)
})
test('Out-of-order hints, gap, missed notification audit and bus recovery resnapshot', async t => {
  const { api, url, bus } = await setup(t)
  const c = await connect(url, api.ticket()); await until(() => snapshots(c.frames).length === 1)
  api.state.shared.revision = 5; bus.hint(5); bus.hint(3); bus.hint(5)
  await until(() => snapshots(c.frames).some(f => f.snapshot.revision === 5))
  bus.state(false); api.state.shared.revision = 7
  await sleep(130); assert.equal(snapshots(c.frames).at(-1)!.snapshot.revision, 5)
  assert(c.frames.some(f => f.type === 'degraded'))
  bus.state(true)
  await until(() => snapshots(c.frames).at(-1)!.snapshot.revision === 7)
  assert.equal(snapshots(c.frames).at(-1)!.type, 'room.snapshot')
  api.state.shared.revision = 8 // No notification: integrity audit repairs it.
  await until(() => snapshots(c.frames).at(-1)!.snapshot.revision === 8)
})
test('Lease renewal rotation, revocation audit, expiry during bus outage and room expiry', async t => {
  const { api, url, bus } = await setup(t)
  api.state.leaseMs = 180
  const c = await connect(url, api.ticket()); await until(() => snapshots(c.frames).length === 1)
  await sleep(450); assert.equal(c.closed, undefined); assert(api.state.viewCalls >= 4)
  api.state.revoked = true
  await until(() => c.closed !== undefined); assert.equal(c.closed, 1008)
  api.state.revoked = false
  const d = await connect(url, api.ticket()); await until(() => snapshots(d.frames).length === 1)
  bus.state(false); await until(() => d.closed !== undefined); assert.equal(d.closed, 1008)
  bus.state(true); api.state.shared.expiresAt = Date.now() + 100
  const e = await connect(url, api.ticket()); await until(() => e.closed !== undefined); assert.equal(e.closed, 1008)
})
test('Heartbeat terminates a real client withholding pong', async t => {
  const { api, url } = await setup(t, { heartbeatMs: 30 })
  const c = await connect(url, api.ticket(), { autoPong: false })
  await until(() => c.closed !== undefined); assert.equal(c.closed, 1006)
})
test('Backpressure/output bound, payload limit and per-participant connection cap', async t => {
  const { api, url } = await setup(t, { maxBufferedBytes: 100, maxPerParticipant: 1 })
  const large = await connect(url, api.ticket()); await until(() => large.closed !== undefined)
  assert.equal(large.closed, 1013); assert.equal(snapshots(large.frames).length, 0)
  const payload = await connect(url); payload.ws.send('a'.repeat(9000)); await until(() => payload.closed !== undefined)
  assert.equal(payload.closed, 1009)
  const s = await setup(t, { maxPerParticipant: 1 })
  const first = await connect(s.url, s.api.ticket()); await until(() => snapshots(first.frames).length === 1)
  const second = await connect(s.url, s.api.ticket()); await until(() => second.closed !== undefined)
  assert.equal(second.closed, 1008)
})
test('Graceful restart sends restarting/1012 and rejects upgrades', async t => {
  const { api, url, gateway } = await setup(t)
  const c = await connect(url, api.ticket()); await until(() => snapshots(c.frames).length === 1)
  await gateway.close(); await until(() => c.closed !== undefined)
  assert.equal(c.closed, 1012); assert(c.frames.some(f => f.type === 'restarting'))
  await assert.rejects(connect(url), /ECONNREFUSED|503/)
})
test('Actual service credential required by HTTP fixture', async t => {
  const { api } = await setup(t)
  await assert.rejects(new HttpAuthority(api.origin, 'z'.repeat(40)).attach({ ticket: api.ticket(), roomId: 'room-1' }))
})

test('Real stalled WebSocket reader hits send-buffer bound and cannot hold unbounded queues', async t => {
  const { api, url, bus, gateway } = await setup(t, { maxBufferedBytes: 1_100_000, auditMs: 10_000, heartbeatMs: 10_000 })
  api.state.shared.candidates = Array.from({ length: 48 }, (_, i) => ({ id: `movie-${i}`,
    identity: { kind: 'movie', tmdbId: i + 1 }, title: 'Common deck', year: 2026,
    overview: 'x'.repeat(20_000), posterUrl: null, runtimeMinutes: 90, availability: [] }))
  const c = await connect(url, api.ticket())
  await until(() => snapshots(c.frames).length === 1)
  c.ws.pause()
  for (let n = 2; n < 40 && gateway.stats().backpressureClosures === 0; n++) {
    api.state.shared.revision = n; bus.hint(n); await sleep(20)
  }
  await until(() => gateway.stats().backpressureClosures > 0)
  c.ws.resume()
  await until(() => c.closed !== undefined)
  assert([1013, 1006].includes(c.closed!))
  await until(() => gateway.stats().connections === 0)
})

test('Authority outage on established connection pauses delivery and recovery forces an authorized snapshot', async t => {
  const { api, url, bus } = await setup(t)
  const c = await connect(url, api.ticket()); await until(() => snapshots(c.frames).length === 1)
  api.state.unavailable = true; api.state.shared.revision = 2; bus.hint(2)
  await until(() => c.frames.some(f => f.type === 'degraded'))
  await sleep(150); assert.equal(snapshots(c.frames).length, 1)
  api.state.unavailable = false
  await until(() => snapshots(c.frames).at(-1)?.snapshot.revision === 2)
  assert.equal(snapshots(c.frames).at(-1)?.type, 'room.snapshot')
})

test('Unauthenticated control-frame budget and fragmented message bounds', async t => {
  const { url } = await setup(t)
  const control = await connect(url)
  for (let n = 0; n < 3; n++) control.ws.ping('x')
  await until(() => control.closed !== undefined)
  assert.equal(control.closed, 1008)
  const fragments = await connect(url)
  for (let n = 0; n < 40; n++) fragments.ws.send('x', { fin: false })
  await until(() => fragments.closed !== undefined)
  assert.equal(fragments.closed, 1008)
  assert.equal(snapshots(fragments.frames).length, 0)
})

test('Explicit shared episode proposal is allowed; private progress fields inside it are rejected', async t => {
  const { api, url, bus } = await setup(t)
  const proposal = { showId: 10, episode: { tmdbId: 101, season: 1, number: 1 }, version: 1 }
  api.state.shared.episodeProposals = [proposal]
  const c = await connect(url, api.ticket())
  await until(() => snapshots(c.frames).length === 1)
  assert.deepEqual(snapshots(c.frames)[0].snapshot.episodeProposals, [proposal])
  api.state.shared.revision = 2
  api.state.shared.episodeProposals[0].ownNextEpisodeId = 102
  bus.hint(2)
  await until(() => c.frames.some(f => f.type === 'degraded'))
  assert.equal(snapshots(c.frames).length, 1)
})
