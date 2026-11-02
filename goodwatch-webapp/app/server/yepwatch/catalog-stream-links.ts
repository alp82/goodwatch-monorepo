/** A link is only shown for a service the availability check already confirmed, so an older URL is fine. */
const LINK_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000
import type { StreamLink } from './availability-adapter.ts'
export type CatalogQuery = <T extends object>(sql: string, args?: unknown[]) => Promise<T[]>
/** One country/type-qualified query for the whole card batch; timestamps follow the MCP link reader. */
export async function readStreamLinks(scopes: { mediaType: 'movie' | 'show'; tmdbId: number; country: string }[], query: CatalogQuery, now = Date.now()) {
  if (!scopes.length) return []
  return query<StreamLink>(`SELECT media_type, media_tmdb_id, country_code, streaming_service_id AS service_id, streaming_type AS offer_type, stream_url FROM doc.streaming_availability WHERE (${scopes.map(() => '(media_type = ? AND media_tmdb_id = ? AND country_code = ?)').join(' OR ')}) AND updated_at > ? AND updated_at <= ? ORDER BY updated_at DESC LIMIT 10000`, [...scopes.flatMap(s => [s.mediaType, s.tmdbId, s.country]), now - LINK_MAX_AGE_MS, now])
}
