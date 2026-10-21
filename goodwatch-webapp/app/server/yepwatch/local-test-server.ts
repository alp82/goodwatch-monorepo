/** Explicit local runner. Synthetic fixtures OR real catalog reads; room writes stay in injected local storage. */
import { REVISION_CHANNEL } from '../../../packages/yepwatch-contracts/index.ts'
import { createYepWatchHandler } from './http.server.ts'
import { listenYepWatch } from './node-http.server.ts'
import { crateSql, CrateRoomRepository, installRoomTable } from './repository.server.ts'
import { YepWatchService } from './service.server.ts'
import { fixtureCatalog, MemoryRoomRepository } from './test-support.ts'
const realCatalog = process.env.YEPWATCH_LOCAL_CATALOG === 'goodwatch'
if (!realCatalog && process.env.YEPWATCH_LOCAL_FIXTURES !== '1') throw new Error('Select YEPWATCH_LOCAL_FIXTURES=1 or YEPWATCH_LOCAL_CATALOG=goodwatch explicitly')
if (realCatalog && process.env.YEPWATCH_LOCAL_FIXTURES === '1') throw new Error('Select exactly one catalog mode')
if (process.env.YEPWATCH_LOAD_LOCAL_ENV === '1') process.loadEnvFile('.env')
const serviceSecret = process.env.YEPWATCH_GATEWAY_SECRET
const secret = process.env.YEPWATCH_SECRET
if (!serviceSecret || !secret) throw new Error('Set independent YEPWATCH_GATEWAY_SECRET and YEPWATCH_SECRET, each >=32 characters')
let repository
if (process.env.YEPWATCH_CRATEDB_ORIGIN) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.YEPWATCH_CRATEDB_ORIGIN).hostname)) throw new Error('Local runner room writes restricted to loopback Crate')
  const sql = crateSql(process.env.YEPWATCH_CRATEDB_ORIGIN, 'crate', '')
  if (process.env.YEPWATCH_INSTALL_DISPOSABLE_TABLE === '1') await installRoomTable(sql, 0)
  repository = new CrateRoomRepository(sql, secret)
} else repository = new MemoryRoomRepository()
const redisUrl = process.env.YEPWATCH_REVISION_REDIS_URL
const redis = redisUrl ? new (await import('ioredis')).default(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true }) : null
redis?.on('error', () => {})
const catalog = realCatalog ? (await import('./goodwatch.server.ts')).goodwatchCatalog : fixtureCatalog
const service = new YepWatchService(repository, catalog, secret, async event => { if (!redis) throw new Error('Bus intentionally absent'); await redis.publish(REVISION_CHANNEL, JSON.stringify(event)) })
const server = await listenYepWatch(createYepWatchHandler(service, { serviceSecret, allowedOrigins: (process.env.YEPWATCH_ALLOWED_ORIGINS ?? 'http://localhost:8081').split(','), secureCookies: false }), Number(process.env.YEPWATCH_LOCAL_PORT ?? '15989'))
const timer = setInterval(() => { void service.repairNotifications().catch(() => {}) }, 1000); timer.unref()
console.log(`YepWatch LOCAL API (${realCatalog ? 'REAL CATALOG READS' : 'SYNTHETIC FIXTURES'}) at http://127.0.0.1:${(server.address() as { port: number }).port}; ${repository.constructor.name}; channel=${REVISION_CHANNEL}`)
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { clearInterval(timer); redis?.disconnect(); server.close() })
