import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { Redis } from 'ioredis'
import { paths, REVISION_CHANNEL, ACTIVITY_CHANNEL, type ServerRealtimeFrame } from '@goodwatch/yepwatch-contracts/continuous'
import { createGateway } from '../src/gateway.js'
import { ValkeyBus } from '../src/bus.js'
import { ValkeyActivityBus } from '../src/activity.js'
import { fixture, secret } from './fixture.js'
import { until, connect, sleep } from './client.js'
const exec = promisify(execFile)

test('Continuous real three-master Valkey, two gateways, ephemeral privacy and compiled service repair', {
  skip: !process.env.YEPWATCH_TEST_VALKEY_IMAGE, timeout: 35_000,
}, async t => {
  const reservations: ReturnType<typeof createServer>[] = []
  let ports: number[] = []
  for (let attempt = 0; attempt < 20; attempt++) {
    const first = 30_000 + Math.floor(Math.random() * 7000)
    try {
      for (const port of [first, first + 1, first + 2, first + 10_000, first + 10_001, first + 10_002]) {
        const server = createServer(); reservations.push(server)
        await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
      }
      ports = [first, first + 1, first + 2]; break
    } catch { for (const server of reservations.splice(0)) await new Promise<void>(resolve => server.close(() => resolve())) }
  }
  assert.equal(ports.length, 3)
  for (const server of reservations) await new Promise<void>(resolve => server.close(() => resolve()))
  const name = `yepwatch-continuous-cluster-${process.pid}-${Date.now()}`
  const script = `for p in ${ports.join(' ')}; do valkey-server --port "$p" --bind 127.0.0.1 --cluster-enabled yes --cluster-config-file "/tmp/nodes-$p.conf" --cluster-node-timeout 1000 --save '' --appendonly no --daemonize yes; done; exec sleep infinity`
  await exec('docker', ['run', '-d', '--network', 'host', '--name', name, process.env.YEPWATCH_TEST_VALKEY_IMAGE!, 'sh', '-c', script])
  t.after(async () => { await exec('docker', ['rm', '-f', name]) })
  await exec('docker', ['exec', name, 'valkey-cli', '--cluster', 'create', ...ports.map(p => `127.0.0.1:${p}`), '--cluster-replicas', '0', '--cluster-yes'])
  const nodes = ports.map(port => ({ host: '127.0.0.1', port }))
  const api = await fixture(true); api.state.leaseMs = 60_000; t.after(() => api.close())
  const revisions = [new ValkeyBus({ nodes }, REVISION_CHANNEL), new ValkeyBus({ nodes }, REVISION_CHANNEL)]
  const activity = [new ValkeyActivityBus({ nodes }), new ValkeyActivityBus({ nodes })]
  const gateways = revisions.map((bus, index) => createGateway(api.authority, bus, { port: 0, auditMs: 5000 }, { activityBus: activity[index] }))
  t.after(async () => { for (const gateway of gateways) await gateway.close() })
  const addresses = await Promise.all(gateways.map(g => g.listen()))
  const urls = addresses.map(a => { assert(a && typeof a !== 'string'); return `ws://127.0.0.1:${a.port}${paths.realtime}` })
  await until(() => revisions.every(b => b.ready) && activity.every(b => b.ready), 6000)
  const a = await connect<ServerRealtimeFrame>(urls[0], api.ticket()), b = await connect<ServerRealtimeFrame>(urls[1], api.ticket('person-2'))
  const ack = () => a.frames.find(f => f.type === 'activity.session')
  await until(() => !!ack() && b.frames.some(f => f.type === 'activity.session'))
  const publishers = ports.map(port => new Redis({ host: '127.0.0.1', port, enableOfflineQueue: false, maxRetriesPerRequest: 0 }))
  for (const publisher of publishers) publisher.on('error', () => {})
  t.after(() => { for (const publisher of publishers) publisher.disconnect() })
  await until(() => publishers.every(p => p.status === 'ready'))
  a.ws.send(JSON.stringify({ type: 'activity', sessionId: ack()!.sessionId, sequence: 0, view: 'trailer', gesture: 'reach' }))
  await until(() => b.frames.some(f => f.type === 'activity' && f.view === 'trailer'))
  assert(!a.frames.some(f => f.type === 'activity'))
  const before = b.frames.filter(f => f.type === 'activity').length
  await publishers[2].publish(ACTIVITY_CHANNEL, JSON.stringify({ type: 'activity', roomId: 'room-1', participantId: 'person-1',
    sessionId: ack()!.sessionId, sequence: 1, view: 'voting', serverTime: Date.now(), expiresAt: Date.now() + 6000, direction: 'watch', currentCard: 'private' }))
  await sleep(40); assert.equal(b.frames.filter(f => f.type === 'activity').length, before)
  api.state.shared.revision = 5
  await publishers[1].publish(REVISION_CHANNEL, JSON.stringify({ roomId: 'room-1', revision: 5 }))
  await until(() => b.frames.some(f => (f.type === 'room.snapshot' || f.type === 'room.updated') && f.snapshot.revision === 5))
  for (const publisher of publishers) await publisher.client('KILL', 'TYPE', 'PUBSUB')
  await until(() => a.frames.some(f => f.type === 'degraded') && b.frames.some(f => f.type === 'degraded'))
  api.state.shared.revision = 7
  await until(() => a.frames.some(f => f.type === 'room.snapshot' && f.snapshot.revision === 7), 6000)
  await until(() => revisions.every(r => r.ready) && activity.every(a => a.ready), 6000)
  a.ws.send(JSON.stringify({ type: 'activity', sessionId: ack()!.sessionId, sequence: 2, view: 'matches' }))
  await until(() => b.frames.some(f => f.type === 'activity' && f.sequence === 2))
  const reservation = createServer(); await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve))
  const address = reservation.address(); assert(address && typeof address !== 'string'); await new Promise<void>(resolve => reservation.close(() => resolve()))
  const child = spawn(process.execPath, ['dist/main.js'], { cwd: new URL('..', import.meta.url),
    env: { PATH: process.env.PATH, YEPWATCH_GATEWAY_SECRET: secret, YEPWATCH_API_ORIGIN: api.origin,
      YEPWATCH_VALKEY_NODES: JSON.stringify(nodes), YEPWATCH_REALTIME_PORT: String(address.port), YEPWATCH_CONTINUOUS: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
  t.after(() => { if (child.exitCode === null) child.kill('SIGTERM') })
  let started = false; child.stdout.on('data', raw => { if (raw.toString().includes('gateway listening on 127.0.0.1:')) started = true }); child.stderr.resume()
  await until(() => started, 3000)
  let healthy = false
  for (let i = 0; i < 50 && !healthy; i++) {
    healthy = (await fetch(`http://127.0.0.1:${address.port}${paths.realtime}/health`)).status === 200
    if (!healthy) await sleep(20)
  }
  assert(healthy)
  const compiled = await connect<ServerRealtimeFrame>(`ws://127.0.0.1:${address.port}${paths.realtime}`, api.ticket('person-2'))
  await until(() => compiled.frames.some(f => f.type === 'activity.session'))
  child.kill('SIGTERM')
  await until(() => compiled.closed === 1012, 1500)
  // Cluster socket teardown has ioredis's separate bounded disconnect timeout;
  // verify client drain independently rather than imposing the 1.8s helper default.
  await until(() => child.exitCode !== null, 5000)
  assert.equal(child.exitCode, 0)
})
