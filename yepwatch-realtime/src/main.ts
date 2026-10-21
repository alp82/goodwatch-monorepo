import { HttpAuthority } from './authority.js'
import { ValkeyBus } from './bus.js'
import { createGateway, defaults } from './gateway.js'
import { paths as continuousPaths, REVISION_CHANNEL as continuousRevision } from '@goodwatch/yepwatch-contracts/continuous'
import { ValkeyActivityBus } from './activity.js'

const env = process.env
function number(name: string, fallback: number) {
  if (!env[name]) return fallback
  const value = Number(env[name])
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${name}`)
  return value
}
const host = env.YEPWATCH_REALTIME_HOST ?? defaults.host
if (!['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('Development gateway must bind to loopback')
const secret = env.YEPWATCH_GATEWAY_SECRET
if (!secret) throw new Error('YEPWATCH_GATEWAY_SECRET required')
const nodes = env.YEPWATCH_VALKEY_NODES ? JSON.parse(env.YEPWATCH_VALKEY_NODES) : undefined
if (nodes && (!Array.isArray(nodes) || !nodes.length || nodes.some(n => typeof n.host !== 'string' || !Number.isInteger(n.port) || n.port < 1 || n.port > 65535))) throw new Error('Invalid YEPWATCH_VALKEY_NODES')
const continuous = env.YEPWATCH_CONTINUOUS === '1'
const busConfig = { url: env.YEPWATCH_VALKEY_URL, nodes,
  username: env.YEPWATCH_VALKEY_USER, password: env.YEPWATCH_VALKEY_PASSWORD }
const bus = new ValkeyBus(busConfig, continuous ? continuousRevision : undefined)
const gateway = createGateway(new HttpAuthority(env.YEPWATCH_API_ORIGIN ?? 'http://127.0.0.1:3000', secret, 3000, 2_000_000,
  continuous ? continuousPaths : undefined), bus, {
  host, port: number('YEPWATCH_REALTIME_PORT', defaults.port),
  origins: env.YEPWATCH_ALLOWED_ORIGINS?.split(',').map(s => new URL(s.trim()).origin) ?? defaults.origins,
}, continuous ? { activityBus: new ValkeyActivityBus(busConfig) } : undefined)
await gateway.listen()
console.info(`YepWatch gateway listening on loopback port ${env.YEPWATCH_REALTIME_PORT ?? defaults.port}`)
let stopping = false
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (stopping) return
  stopping = true
  void gateway.close().then(() => { process.exitCode = 0 })
})
