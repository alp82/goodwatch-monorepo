import { HttpAuthority } from './authority.js'
import { ValkeyBus } from './bus.js'
import { createGateway, defaults } from './gateway.js'
import { paths as continuousPaths, REVISION_CHANNEL as continuousRevision } from '@goodwatch/yepwatch-contracts/continuous'
import { ValkeyActivityBus } from './activity.js'
import { paths as proposalPaths, REVISION_CHANNEL as proposalRevision, ACTIVITY_CHANNEL as proposalActivity } from '@goodwatch/yepwatch-contracts/proposal'
import { proposalServerActivitySchema } from './proposal-activity.js'
import { runtimeConfig } from './runtime-config.js'

const env = process.env
function number(name: string, fallback: number) {
  if (!env[name]) return fallback
  const value = Number(env[name])
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${name}`)
  return value
}
const runtime = runtimeConfig(env)
const host = runtime.host
const secret = env.YEPWATCH_GATEWAY_SECRET
if (!secret) throw new Error('YEPWATCH_GATEWAY_SECRET required')
const nodes = env.YEPWATCH_VALKEY_NODES ? JSON.parse(env.YEPWATCH_VALKEY_NODES) : undefined
if (nodes && (!Array.isArray(nodes) || !nodes.length || nodes.some(n => typeof n.host !== 'string' || !Number.isInteger(n.port) || n.port < 1 || n.port > 65535))) throw new Error('Invalid YEPWATCH_VALKEY_NODES')
const continuous = env.YEPWATCH_CONTINUOUS === '1'
const proposal = env.YEPWATCH_PROPOSAL === '1'
if (continuous && proposal) throw new Error('Choose one explicit realtime contract')
const active = continuous || proposal
const routes = proposal ? proposalPaths : continuous ? continuousPaths : undefined
const busConfig = { url: env.YEPWATCH_VALKEY_URL, nodes,
  username: env.YEPWATCH_VALKEY_USER, password: env.YEPWATCH_VALKEY_PASSWORD }
const bus = new ValkeyBus(busConfig, proposal ? proposalRevision : continuous ? continuousRevision : undefined)
const gateway = createGateway(new HttpAuthority(env.YEPWATCH_API_ORIGIN ?? 'http://127.0.0.1:3000', secret, 3000, 2_000_000,
  routes), bus, {
  host, port: number('YEPWATCH_REALTIME_PORT', defaults.port),
  // One private proxy pools client addresses. Keep global/participant bounds;
  // never trust an arbitrary forwarded header as a client address.
  ...(runtime.container ? { maxConnections: 128, maxPerIp: 128, maxRooms: 32 } : {}),
  origins: env.YEPWATCH_ALLOWED_ORIGINS?.split(',').map(s => new URL(s.trim()).origin) ?? defaults.origins,
}, active ? { activityBus: new ValkeyActivityBus(busConfig, proposal ? proposalActivity : undefined,
  proposal ? proposalServerActivitySchema : undefined), proposal } : undefined)
await gateway.listen()
console.info(`YepWatch gateway listening on ${host}:${env.YEPWATCH_REALTIME_PORT ?? defaults.port}`)
let stopping = false
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (stopping) return
  stopping = true
  void gateway.close().then(() => { process.exitCode = 0 })
})
