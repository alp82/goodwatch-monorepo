import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_PROJECT_URL || '', process.env.SUPABASE_API_KEY || '')

export type TargetFunction<Params, Return> = (args: Params) => Promise<Return>

export interface CachedParams<Params, Return> {
  target: TargetFunction<Params, Return>
  params: Params
  name: string
  ttlMinutes: number
}

export const cached = async <Params extends Partial<Record<keyof Params, unknown>>, Return>({
  target,
  params,
  name,
  ttlMinutes,
}: CachedParams<Params, Return>): Promise<Return> => {
  const tableName = `cached-${name}`

  // check cache for existing entries within TTL
  const cacheResponse = await supabase
    .from(tableName)
    .select()
    .match(params)
  // TODO not sure why i need to cast to something else than the date object here
  const lastCached = new Date(cacheResponse?.data?.[0]?.lastUpdated) as unknown as number
  if (cacheResponse.data?.length && (Date.now() - lastCached) < 1000 * 60 * ttlMinutes) {
    return cacheResponse.data[0].results as unknown as Return
  }

  // fetch data if no cache hit
  const results = await target(params)

  // update cache
  const lastUpdated = (new Date()).toISOString()
  const { data, error } = await supabase
    .from(tableName)
    .upsert({ ...params, lastUpdated, results })
    .select()
  if (error) {
    console.error({ data, error })
  }

  return results
}
