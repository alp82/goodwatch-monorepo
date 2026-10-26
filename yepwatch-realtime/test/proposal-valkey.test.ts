import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:net'
import { Redis } from 'ioredis'
import { paths, REVISION_CHANNEL, ACTIVITY_CHANNEL, type ServerRealtimeFrame } from '@goodwatch/yepwatch-contracts/proposal'
import { createGateway } from '../src/gateway.js'
import { ValkeyBus } from '../src/bus.js'
import { ValkeyActivityBus } from '../src/activity.js'
import { proposalServerActivitySchema } from '../src/proposal-activity.js'
import { fixture, secret } from './fixture.js'
import { connect, until, sleep } from './client.js'
const exec = promisify(execFile)

test('Proposal real disposable Valkey, two gateways, revision repair and compiled contract3 start', {
  skip: !process.env.YEPWATCH_TEST_VALKEY_IMAGE, timeout: 30_000,
}, async t => {
  const name = `yepwatch-proposal-${process.pid}-${Date.now()}`
  await exec('docker', ['run', '-d', '--name', name, '-p', '127.0.0.1::6379', process.env.YEPWATCH_TEST_VALKEY_IMAGE!, 'valkey-server', '--save', '', '--appendonly', 'no'])
  t.after(async () => { await exec('docker', ['rm', '-f', name]) })
  let brokerReady = false
  for (let n = 0; n < 50 && !brokerReady; n++) {
    brokerReady = await exec('docker', ['exec', name, 'valkey-cli', 'ping']).then(r => r.stdout.trim() === 'PONG', () => false)
    if (!brokerReady) await sleep(50)
  }
  assert(brokerReady)
  const { stdout } = await exec('docker', ['port', name, '6379/tcp'])
  const url = `redis://${stdout.trim()}`, publisher = new Redis(url, { lazyConnect: true, retryStrategy: () => null })
  await publisher.connect(); t.after(() => publisher.disconnect())
  const api = await fixture('proposal'); api.state.leaseMs = 60_000
  api.state.shared.phase = 'choosing'
  api.state.shared.candidates = [{ id: 'movie:1', identity: { kind: 'movie', tmdbId: 1 }, title: 'Public fixture match', year: null,
    overview: null, posterUrl: null, runtimeMinutes: null, viewingDuration: null, availability: [] }]
  api.state.shared.matches = [{ candidateId: 'movie:1', averageYepMs: null }]
  t.after(() => api.close())
  const revisions = [new ValkeyBus({ url }, REVISION_CHANNEL), new ValkeyBus({ url }, REVISION_CHANNEL)]
  const activity = [0, 1].map(() => new ValkeyActivityBus({ url }, ACTIVITY_CHANNEL, proposalServerActivitySchema))
  const gateways = revisions.map((bus, n) => createGateway(api.authority, bus, { port: 0, auditMs: 1000 }, { activityBus: activity[n], proposal: true }))
  t.after(async () => { for (const gateway of gateways) await gateway.close() })
  const addresses = await Promise.all(gateways.map(g => g.listen()))
  await until(() => revisions.every(b => b.ready) && activity.every(b => b.ready), 5000)
  const clients = await Promise.all(addresses.map((a, n) => {
    assert(a && typeof a !== 'string'); return connect<ServerRealtimeFrame>(`ws://127.0.0.1:${a.port}${paths.realtime}`).then(client => {
      client.ws.send(JSON.stringify({ type: 'authenticate', ticket: api.ticket(`person-${n + 1}`), roomId: 'room-1', lastRevision: null, cheers: true })); return client
    })
  }))
  await until(() => clients.every(c => c.frames.some(f => f.type === 'activity.session')))
  const [a, b] = clients, session = a.frames.find(f => f.type === 'activity.session')!
  assert.equal(session.type, 'activity.session')
  a.ws.send(JSON.stringify({ type: 'activity', sessionId: session.sessionId, sequence: 0, view: 'matches', inspection: { kind: 'poster', candidateId: 'movie:1' } }))
  await until(() => b.frames.some(f => f.type === 'activity' && f.inspection?.kind === 'poster'))
  await publisher.call('CLIENT', 'KILL', 'TYPE', 'PUBSUB') // Only this test's disposable broker.
  await until(() => clients.every(c => c.frames.some(f => f.type === 'degraded')), 3000)
  api.state.shared.revision = 2
  await until(() => revisions.every(b => b.ready) && activity.every(b => b.ready), 5000)
  await publisher.publish(REVISION_CHANNEL, JSON.stringify({ roomId: 'room-1', revision: 2 }))
  await until(() => clients.every(c => c.frames.some(f => f.type === 'room.snapshot' && f.snapshot.revision === 2)), 5000)
  const before = b.frames.filter(f => f.type === 'activity').length
  await sleep(280); assert.equal(b.frames.filter(f => f.type === 'activity').length, before)
  a.ws.send(JSON.stringify({ type: 'activity', sessionId: session.sessionId, sequence: 1, view: 'matches', inspection: { kind: 'dice' } }))
  await until(() => b.frames.some(f => f.type === 'activity' && f.inspection?.kind === 'dice'))
  // Public decision celebrations cross the same real broker as inspection cues.
  api.state.shared.phase = 'decided'
  api.state.shared.proposalVersion = 1
  api.state.shared.proposal = { candidateId: 'movie:1', version: 1, previousCandidateId: null, agreeCount: 2, requiredCount: 2, averageYepMs: null }
  api.state.shared.decision = { candidateId: 'movie:1', proposalVersion: 1, decidedAt: Date.now(), availability: [] }
  api.state.shared.revision = 3
  await publisher.publish(REVISION_CHANNEL, JSON.stringify({ roomId: 'room-1', revision: 3 }))
  await until(() => clients.every(c => c.frames.some(f => f.type === 'room.updated' && f.snapshot.revision === 3)))
  const cheer = { kind: 'hold', generation: api.state.shared.generation, seed: 1234 }
  a.ws.send(JSON.stringify({ type: 'activity', sessionId: session.sessionId, sequence: 2, view: 'matches', cheer }))
  await until(() => b.frames.some(f => f.type === 'activity' && f.cheer?.kind === 'hold'))
  const held = b.frames.find(f => f.type === 'activity' && f.cheer?.kind === 'hold')!
  assert.equal(held.type, 'activity')
  assert.equal(held.participantId, 'person-1'); assert.deepEqual(held.cheer, cheer)
  a.ws.send(JSON.stringify({ type: 'activity', sessionId: session.sessionId, sequence: 3, view: 'matches', cheer: { ...cheer, kind: 'release' } }))
  await until(() => b.frames.some(f => f.type === 'activity' && f.cheer?.kind === 'release'))
  const reservation = createServer(); await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve))
  const addr = reservation.address(); assert(addr && typeof addr !== 'string')
  await new Promise<void>(resolve => reservation.close(() => resolve()))
  const child = spawn(process.execPath, ['dist/main.js'], { stdio: 'ignore', env: { ...process.env,
    YEPWATCH_CONTINUOUS: '0', YEPWATCH_PROPOSAL: '1', YEPWATCH_REALTIME_HOST: '127.0.0.1', YEPWATCH_REALTIME_PORT: String(addr.port),
    YEPWATCH_API_ORIGIN: api.origin, YEPWATCH_GATEWAY_SECRET: secret, YEPWATCH_VALKEY_URL: url, YEPWATCH_VALKEY_NODES: '',
    YEPWATCH_ALLOWED_ORIGINS: 'http://127.0.0.1:8133' } })
  t.after(() => { if (child.exitCode === null) child.kill('SIGTERM') })
  let ready = false
  for (let n = 0; n < 50 && !ready; n++) {
    ready = await fetch(`http://127.0.0.1:${addr.port}${paths.realtime}/health`).then(r => r.status === 200, () => false)
    if (!ready) await sleep(50)
  }
  assert(ready)
  const compiled = await connect<ServerRealtimeFrame>(`ws://127.0.0.1:${addr.port}${paths.realtime}`, api.ticket())
  await until(() => compiled.frames.some(f => f.type === 'activity.session'))
  child.kill('SIGTERM'); await until(() => compiled.closed === 1012, 5000)
})
