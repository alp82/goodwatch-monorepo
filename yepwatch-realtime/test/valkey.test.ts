import test from 'node:test'
import { createServer } from 'node:net'
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { Redis } from 'ioredis'
import { REVISION_CHANNEL, paths } from '@goodwatch/yepwatch-contracts'
import { ValkeyBus } from '../src/bus.js'
import { createGateway } from '../src/gateway.js'
import { fixture, secret } from './fixture.js'
import { until, connect, sleep, snapshots } from './client.js'

const exec = promisify(execFile)
const image = process.env.YEPWATCH_TEST_VALKEY_IMAGE
// Opt in explicitly: creates/stops/removes only this test's uniquely named container.
test('Disposable real Valkey: two gateways, dropped bus, reconnect and conservative multidevice presence', { skip: !image, timeout: 30_000 }, async t => {
  const name = `yepwatch-realtime-test-${process.pid}-${Date.now()}`
  const reservation = createServer()
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve))
  const reserved = reservation.address(); assert(reserved && typeof reserved !== 'string')
  await new Promise<void>(resolve => reservation.close(() => resolve()))
  await exec('docker', ['run', '-d', '--name', name, '-p', `127.0.0.1:${reserved.port}:6379`, image!, 'valkey-server', '--save', '', '--appendonly', 'no'])
  t.after(async () => { await exec('docker', ['rm', '-f', name]) })
  const { stdout } = await exec('docker', ['port', name, '6379/tcp'])
  const url = `redis://${stdout.trim()}`
  const publisher = new Redis(url, { maxRetriesPerRequest: 0, enableOfflineQueue: false, retryStrategy: n => Math.min(n * 50, 200) })
  publisher.on('error', () => {})
  t.after(() => publisher.disconnect())
  await until(() => publisher.status === 'ready', 4000)
  const api = await fixture(); api.state.leaseMs = 60_000; t.after(() => api.close())
  const busA = new ValkeyBus({ url }), busB = new ValkeyBus({ url })
  const a = createGateway(api.authority, busA, { port: 0, auditMs: 10_000 })
  const b = createGateway(api.authority, busB, { port: 0, auditMs: 10_000 })
  t.after(async () => { await a.close(); await b.close() })
  const addrA = await a.listen(), addrB = await b.listen()
  assert(addrA && typeof addrA !== 'string' && addrB && typeof addrB !== 'string')
  await until(() => busA.ready && busB.ready)
  const first = await connect(`ws://127.0.0.1:${addrA.port}${paths.realtime}`, api.ticket())
  const otherDevice = await connect(`ws://127.0.0.1:${addrB.port}${paths.realtime}`, api.ticket())
  const otherPerson = await connect(`ws://127.0.0.1:${addrB.port}${paths.realtime}`, api.ticket('person-2'))
  const revision = (c: typeof first) => snapshots(c.frames).at(-1)?.snapshot.revision
  await until(() => revision(first) === 1 && revision(otherDevice) === 1 && revision(otherPerson) === 1)
  api.state.shared.revision = 4
  await publisher.publish(REVISION_CHANNEL, JSON.stringify({ roomId: 'room-1', revision: 4 }))
  await publisher.publish(REVISION_CHANNEL, JSON.stringify({ roomId: 'room-1', revision: 2 }))
  await publisher.publish(REVISION_CHANNEL, JSON.stringify({ roomId: 'room-1', revision: 4, votes: ['private'] }))
  await until(() => revision(first) === 4 && revision(otherPerson) === 4)
  first.ws.close(); await until(() => first.closed !== undefined)
  assert.equal(otherDevice.closed, undefined)
  // Stop only the disposable container. Commit while Pub/Sub is unavailable.
  await exec('docker', ['stop', '-t', '1', name])
  await until(() => !busB.ready)
  await until(() => otherPerson.frames.some(f => f.type === 'degraded'))
  api.state.shared.revision = 6
  await sleep(40); assert.equal(revision(otherPerson), 4)
  await exec('docker', ['start', name])
  await until(() => busB.ready, 6000)
  await until(() => revision(otherDevice) === 6 && revision(otherPerson) === 6, 3000)
  const processReservation = createServer()
  await new Promise<void>(resolve => processReservation.listen(0, '127.0.0.1', resolve))
  const processAddress = processReservation.address(); assert(processAddress && typeof processAddress !== 'string')
  await new Promise<void>(resolve => processReservation.close(() => resolve()))
  const child = spawn(process.execPath, ['dist/main.js'], { cwd: new URL('..', import.meta.url),
    env: { PATH: process.env.PATH, YEPWATCH_GATEWAY_SECRET: secret, YEPWATCH_API_ORIGIN: api.origin,
      YEPWATCH_VALKEY_URL: url, YEPWATCH_REALTIME_PORT: String(processAddress.port) }, stdio: ['ignore', 'pipe', 'pipe'] })
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL') })
  let output = ''; child.stdout.on('data', chunk => { output += chunk }); child.stderr.on('data', chunk => { output += chunk })
  await until(() => output.includes('gateway listening on 127.0.0.1:'), 3000)
  let processReady = false
  for (let n = 0; n < 50 && !processReady; n++) {
    processReady = (await fetch(`http://127.0.0.1:${processAddress.port}${paths.realtime}/health`)).status === 200
    if (!processReady) await sleep(20)
  }
  assert(processReady)
  const compiledClient = await connect(`ws://127.0.0.1:${processAddress.port}${paths.realtime}`, api.ticket())
  await until(() => snapshots(compiledClient.frames).at(-1)?.snapshot.revision === 6)
  await a.close(); await b.close()
  // Only the compiled gateway remains subscribed, so the pending fetch is its own.
  // Shutdown must abort that fetch, rather than wait its timeout.
  let release: (() => void) | undefined
  api.state.beforeView = () => { api.state.beforeView = undefined; return new Promise<void>(resolve => { release = resolve }) }
  const before = api.state.viewCalls
  api.state.shared.revision = 7
  await publisher.publish(REVISION_CHANNEL, JSON.stringify({ roomId: 'room-1', revision: 7 }))
  await until(() => api.state.viewCalls > before)
  const stoppedAt = Date.now()
  child.kill('SIGTERM'); await until(() => compiledClient.closed !== undefined)
  assert.equal(compiledClient.closed, 1012)
  await until(() => child.exitCode !== null)
  assert.equal(child.exitCode, 0)
  assert(Date.now() - stoppedAt < 1500)
  release?.(); api.state.beforeView = undefined
  assert(!output.includes(secret))
  for (const c of [otherDevice, otherPerson]) {
    const shared = snapshots(c.frames).at(-1)!.snapshot
    assert(shared.participants.every(p => p.presence === 'unknown'))
    assert.equal(shared.participants.length, 2)
  }
})

test('Real three-master Valkey cluster: global Pub/Sub and subscriber-only disconnect repair', { skip: !image, timeout: 30_000 }, async t => {
  const name = `yepwatch-realtime-cluster-test-${process.pid}-${Date.now()}`
  // Reserve both client and cluster-bus ports on loopback before using host networking.
  const reservations: ReturnType<typeof createServer>[] = []
  let ports: number[] = []
  for (let attempt = 0; attempt < 20; attempt++) {
    const first = 20_000 + Math.floor(Math.random() * 8000)
    ports = [first, first + 1, first + 2]
    try {
      for (const port of [...ports, ...ports.map(p => p + 10_000)]) {
        const socket = createServer(); reservations.push(socket)
        await new Promise<void>((resolve, reject) => { socket.once('error', reject); socket.listen(port, '127.0.0.1', resolve) })
      }
      break
    } catch {
      for (const socket of reservations.splice(0)) await new Promise<void>(resolve => socket.close(() => resolve()))
      ports = []
    }
  }
  assert.equal(ports.length, 3)
  for (const socket of reservations) await new Promise<void>(resolve => socket.close(() => resolve()))
  const script = `for p in ${ports.join(' ')}; do valkey-server --port "$p" --bind 127.0.0.1 --cluster-enabled yes --cluster-config-file "/tmp/nodes-$p.conf" --cluster-node-timeout 1000 --save '' --appendonly no --daemonize yes; done; exec sleep infinity`
  await exec('docker', ['run', '-d', '--network', 'host', '--name', name, image!, 'sh', '-c', script])
  t.after(async () => { await exec('docker', ['rm', '-f', name]) })
  const nodes = ports.map(port => ({ host: '127.0.0.1', port }))
  await exec('docker', ['exec', name, 'valkey-cli', '--cluster', 'create', ...ports.map(p => `127.0.0.1:${p}`), '--cluster-replicas', '0', '--cluster-yes'])
  const bus = new ValkeyBus({ nodes })
  const api = await fixture(); api.state.leaseMs = 60_000; t.after(() => api.close())
  const gateway = createGateway(api.authority, bus, { port: 0, auditMs: 10_000 })
  const addr = await gateway.listen(); assert(addr && typeof addr !== 'string')
  t.after(() => gateway.close())
  await until(() => bus.ready, 5000)
  const c = await connect(`ws://127.0.0.1:${addr.port}${paths.realtime}`, api.ticket())
  await until(() => snapshots(c.frames).length === 1)
  const publishers = ports.map(port => new Redis({ host: '127.0.0.1', port }))
  for (const publisher of publishers) publisher.on('error', () => {})
  t.after(() => { for (const publisher of publishers) publisher.disconnect() })
  for (let n = 0; n < publishers.length; n++) {
    api.state.shared.revision = n + 2
    await publishers[n].publish(REVISION_CHANNEL, JSON.stringify({ roomId: 'room-1', revision: n + 2 }))
    await until(() => snapshots(c.frames).at(-1)?.snapshot.revision === n + 2)
  }
  api.state.shared.revision = 9
  for (const publisher of publishers) await publisher.client('KILL', 'TYPE', 'PUBSUB')
  await until(() => c.frames.some(f => f.type === 'degraded'))
  await until(() => snapshots(c.frames).at(-1)?.snapshot.revision === 9, 5000)
  assert.equal(snapshots(c.frames).at(-1)?.type, 'room.snapshot')
})
