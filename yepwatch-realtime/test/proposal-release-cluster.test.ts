import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ValkeyBus } from '../src/bus.js'
const busModule = new URL('../../goodwatch-webapp/app/server/yepwatch/proposal-release-bus.ts', import.meta.url)
const { createReleaseBus } = await import(busModule.href)
import { REVISION_CHANNEL, ACTIVITY_CHANNEL } from '@goodwatch/yepwatch-contracts/proposal'
const exec = promisify(execFile)
const image = process.env.YEPWATCH_TEST_VALKEY_IMAGE
async function until(fn: () => boolean) { for (let n = 0; n < 100; n++) { if (fn()) return; await new Promise(r => setTimeout(r, 50)) } throw new Error('Cluster readiness deadline') }
test('release API and gateway share a real three-node cluster through the named messaging ACL', { skip: !image, timeout: 30000 }, async t => {
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

  const password = 'disposable-messaging-test-only-password'
  for (const port of ports) await exec('docker', ['exec', name, 'valkey-cli', '-p', String(port), 'ACL', 'SETUSER', 'yepwatch_messaging', 'on', `>${password}`, 'resetkeys', 'resetchannels', `&${REVISION_CHANNEL}`, `&${ACTIVITY_CHANNEL}`, '+ping', '+info', '+cluster|slots', '+cluster|info', '+publish', '+subscribe', '+unsubscribe', '+quit', '+client|setinfo', '+client|setname'])
  t.diagnostic("cluster created and messaging ACL configured")
  const config = { nodes, username: 'yepwatch_messaging', password }
  const bus = new ValkeyBus(config, REVISION_CHANNEL)
  t.after(() => bus.close())
  void bus.start()
  await until(() => bus.ready)
  const publisher = createReleaseBus({ redisNodes: nodes, redisUsername: config.username, redisPassword: password, revisionUrl: undefined })
  publisher.on('error', () => {})
  t.after(() => publisher.disconnect())
  void publisher.connect().catch(() => {})
  await until(() => publisher.status === 'ready')
  const received: unknown[] = []
  bus.on('hint', hint => received.push(hint))
  assert.equal(await publisher.ping(), 'PONG')
  await publisher.publish(REVISION_CHANNEL, JSON.stringify({ roomId: 'cluster-room', revision: 7 }))
  await until(() => received.length === 1)
  assert.deepEqual(received[0], { roomId: 'cluster-room', revision: 7 })
  await publisher.publish(ACTIVITY_CHANNEL, JSON.stringify({ test: 'neutral activity channel delivery permission' }))
})
