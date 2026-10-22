import { REVISION_CHANNEL } from '../../../packages/yepwatch-contracts/index.ts'
import { RoomError } from './errors.ts'
import { createYepWatchHandler } from './http.server.ts'
import { goodwatchCatalog } from './goodwatch.server.ts'
import { crateSql, CrateRoomRepository } from './repository.server.ts'
import { YepWatchService } from './service.server.ts'
let handler: ReturnType<typeof createYepWatchHandler> | undefined
let repairTimer: ReturnType<typeof setInterval> | undefined
export function stopYepWatchRepair() { if (repairTimer) clearInterval(repairTimer); repairTimer = undefined }
export function yepWatchHandler(request: Request): Promise<Response> {
  if (!handler) {
    const { YEPWATCH_CRATEDB_ORIGIN: origin, YEPWATCH_CRATEDB_USERNAME: username, YEPWATCH_CRATEDB_PASSWORD: password, YEPWATCH_SECRET: secret, YEPWATCH_GATEWAY_SECRET: gatewaySecret, YEPWATCH_ALLOWED_ORIGINS: origins } = process.env
    if (!origin || !username || password === undefined || !secret || !gatewaySecret || !origins) return Promise.resolve(Response.json({ error: { code: 'busy', message: 'YepWatch runtime not configured', retryable: false } }, { status: 503, headers: { 'cache-control': 'no-store' } }))
    const repository = new CrateRoomRepository(crateSql(origin, username, password), secret)
    const service = new YepWatchService(repository, goodwatchCatalog, secret, async event => {
      const { getRedisCluster } = await import('../../utils/cache')
      const redis = getRedisCluster()
      if (!redis) throw new RoomError('busy', 'Revision bus unavailable', 503)
      await redis.publish(REVISION_CHANNEL, JSON.stringify(event))
    })
    handler = createYepWatchHandler(service, { serviceSecret: gatewaySecret, allowedOrigins: origins.split(',').map(s => s.trim()) })
    let repairing = false
    repairTimer = setInterval(() => { if (repairing) return; repairing = true; void service.repairNotifications().catch(() => {}).finally(() => { repairing = false }) }, 2000)
    repairTimer.unref()
  }
  return handler(request)
}
