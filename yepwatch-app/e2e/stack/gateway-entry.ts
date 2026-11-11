/**
 * E2E gateway process: yepwatch-realtime/src/main.ts in proposal mode, with one difference — connection
 * caps sized for parallel suites. Every browser reaches the gateway through Caddy from 127.0.0.1, so the
 * development per-IP cap (32) and the production container caps (128 sockets / 32 rooms) would throttle
 * the harness rather than test the app. Bundled by up.mjs into yepwatch-realtime/dist/e2e-gateway.js.
 */
import { HttpAuthority } from '../../../yepwatch-realtime/src/authority.ts'
import { ValkeyBus } from '../../../yepwatch-realtime/src/bus.ts'
import { createGateway, defaults } from '../../../yepwatch-realtime/src/gateway.ts'
import { ValkeyActivityBus } from '../../../yepwatch-realtime/src/activity.ts'
import { proposalServerActivitySchema } from '../../../yepwatch-realtime/src/proposal-activity.ts'
import { paths, REVISION_CHANNEL, ACTIVITY_CHANNEL } from '../../../goodwatch-webapp/packages/yepwatch-contracts/proposal.ts'

const env = process.env
const host = env.YEPWATCH_REALTIME_HOST ?? '127.0.0.1'
if (!['127.0.0.1', 'localhost'].includes(host)) throw new Error('E2E gateway binds to loopback only')
const secret = env.YEPWATCH_GATEWAY_SECRET
if (!secret) throw new Error('YEPWATCH_GATEWAY_SECRET required')
const busConfig = { url: env.YEPWATCH_VALKEY_URL, nodes: env.YEPWATCH_VALKEY_NODES ? JSON.parse(env.YEPWATCH_VALKEY_NODES) : undefined }
const bus = new ValkeyBus(busConfig, REVISION_CHANNEL)
const gateway = createGateway(new HttpAuthority(env.YEPWATCH_API_ORIGIN!, secret, 3000, 2_000_000, paths), bus, {
  host,
  port: Number(env.YEPWATCH_REALTIME_PORT),
  maxConnections: 4096, maxPerIp: 4096, maxRooms: 1024, maxRoomConnections: 128,
  origins: env.YEPWATCH_ALLOWED_ORIGINS!.split(',').map((s) => new URL(s.trim()).origin),
}, { activityBus: new ValkeyActivityBus(busConfig, ACTIVITY_CHANNEL, proposalServerActivitySchema), proposal: true })
void defaults
await gateway.listen()
console.info(`YepWatch E2E gateway listening on ${host}:${env.YEPWATCH_REALTIME_PORT}`)
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void gateway.close().then(() => process.exit(0)))
