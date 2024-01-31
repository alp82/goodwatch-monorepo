import crypto from 'crypto'
import Redis from 'ioredis'

const redisConfig = {
  host: process.env.REDIS_HOST || '',
  port: parseInt(process.env.REDIS_PORT || ''),
  password: process.env.REDIS_PASS || '',
}

// Create a new Redis client instance
const redis = new Redis(redisConfig)

interface JsonData {
  [key: string]: any
}

function serializeJson(obj: JsonData): string {
  const sortedKeys = Object.keys(obj).sort()
  const sortedObj: JsonData = {}
  for (const key of sortedKeys) {
    sortedObj[key] = obj[key]
  }
  return JSON.stringify(sortedObj)
}

function generateCacheKey(data: JsonData): string {
  const serializedData = serializeJson(data)
  return crypto.createHash('sha256').update(serializedData).digest('hex')
}

async function cacheSet<CacheData extends JsonData>(namespace: string, key: string, data: CacheData, ttl: number): Promise<void> {
  const namespaceKey = `${namespace}:${key}`
  const timestamp = Date.now()
  const jsonData = JSON.stringify({
    data,
    timestamp,
  })
  await redis.setex(namespaceKey, ttl || 1, jsonData)
}

async function cacheGet<CacheData extends JsonData>(namespace: string, key: string): Promise<CacheData | null> {
  const namespaceKey = `${namespace}:${key}`
  const result = await redis.get(namespaceKey)
  return result ? JSON.parse(result) : null
}

export type TargetFunction<Params, Return> = (args: Params) => Promise<Return>

export interface CachedParams<Params, Return> {
  target: TargetFunction<Params, Return>
  params: Params
  name: string
  ttlMinutes: number
}

export const cached = async <Params extends Partial<Record<keyof Params, unknown>>, Return extends JsonData>({
  target,
  params,
  name,
  ttlMinutes,
}: CachedParams<Params, Return>): Promise<Return> => {
  const cacheName = `cached-${name}`
  const cacheKey = generateCacheKey(params)

  // check cache for existing entries within TTL
  const cachedResult = await cacheGet<Return>(cacheName, cacheKey)
  if (cachedResult) {
    const { timestamp, data } = cachedResult
    if ((Date.now() - timestamp) < 1000 * 60 * ttlMinutes) {
      return data as Return
    }
  }

  // fetch data if no cache hit
  const results = await target(params)

  // update cache
  try {
    await cacheSet<Return>(cacheName, cacheKey, results, ttlMinutes * 60)
  } catch (error) {
    console.error({ error })
  }

  return results
}