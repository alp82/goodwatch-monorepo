import { evaluateAvailability } from '../../utils/availability-evidence.ts'
import { linkedAvailability, providerFamily } from '../mcp/watch-links.ts'
import type { ScreenAvailability, ScreenContext } from '../../../packages/yepwatch-contracts/index.ts'
import type { CatalogDisplay } from './catalog-adapter.ts'
import { KeyedReads } from './read-cache.ts'
type Scope = { mediaType: 'movie' | 'show'; tmdbId: number; country: string }
export interface StreamLink { media_type: string; media_tmdb_id: number; country_code: string; service_id: number; offer_type: string; stream_url: string | null }
export interface EvidenceReads {
  links?(scopes: Scope[]): Promise<StreamLink[]>
  batch(scopes: Scope[]): Promise<Map<string, unknown>>
  fresh(scope: Scope): Promise<unknown>
  names(): Promise<ReadonlyMap<number, string>>
}
/** Country-qualified loading plus existing evidence evaluator/link rules. No independent availability rules. */
export function createAvailabilityAdapter(reads: EvidenceReads, now: () => number = Date.now) {
  return async (titles: CatalogDisplay[], screens: ScreenContext[], fresh: boolean) => {
    const countries = [...new Set(screens.map(s => s.country!))]
    const scopes = titles.flatMap(t => countries.map(country => ({ mediaType: t.mediaType, tmdbId: t.tmdbId, country })))
    const byCountry = new Map<string, Map<string, unknown>>()
    // Names, direct links and evidence are independent reads: one round of Crate latency, not two.
    const [names, links] = await Promise.all([reads.names(), reads.links?.(scopes) ?? [], ...countries.map(async country => {
      const scopes = titles.map(t => ({ mediaType: t.mediaType, tmdbId: t.tmdbId, country }))
      const evidence = fresh ? new Map(await Promise.all(scopes.map(async scope => [`${scope.mediaType}-${scope.tmdbId}`, await reads.fresh(scope)] as const))) : await reads.batch(scopes)
      byCountry.set(country, evidence)
    })])
    const result = new Map<number, ScreenAvailability[]>()
    for (const title of titles) result.set(title.key, screens.map(screen => {
      const serviceIds = [...new Set(screen.serviceIds.flatMap(providerFamily))]
      const check = evaluateAvailability(byCountry.get(screen.country!)?.get(`${title.mediaType}-${title.tmdbId}`), { mediaType: title.mediaType, tmdbId: title.tmdbId, country: screen.country!, serviceIds }, now())
      const linked = linkedAvailability(check, { media_type: title.mediaType, tmdb_id: title.tmdbId }, screen.country!, names, links.filter(l => l.media_type === title.mediaType && l.media_tmdb_id === title.tmdbId && l.country_code === screen.country))
      return { screenId: screen.id, state: check.state, scope: 'title', checkedAt: check.offers.length ? Math.min(...check.offers.map(o => o.checked_at)) : null,
        offers: linked.offers.flatMap(o => o.offer_type === 'rent' || o.offer_type === 'buy' ? [] : [{ serviceId: o.service_id, name: o.name ?? `Service ${o.service_id}`, url: o.url, kind: o.link_kind === 'provider' ? 'provider' as const : 'where_to_watch' as const, offerType: o.offer_type }]) }
    }))
    return result
  }
}

const scopeKey = (s: Scope) => `${s.mediaType}-${s.tmdbId}-${s.country}`
/**
 * Evidence and direct-link reads for deck builds, kept per title and country (KeyedReads) for at most `ttlMs`: the
 * `batch` and `links` of an adapter whose `fresh` (the agreement's final check) stays unkept. A title without evidence
 * is kept as such. `reads.batch` must throw when it fails: a failure is never kept, and its titles are answered
 * without evidence (unknown), as an unkept read answered them.
 */
export function keptOfferReads(reads: { batch(scopes: Scope[]): Promise<Map<string, unknown>>; links(scopes: Scope[]): Promise<StreamLink[]> }, ttlMs: number, maxEntries = 40_000, now: () => number = Date.now) {
  const evidence = new KeyedReads<unknown>(ttlMs, maxEntries, () => true, now)
  const links = new KeyedReads<StreamLink[]>(ttlMs, maxEntries, () => true, now)
  return {
    /** Keyed `<type>-<id>` as the adapter reads it (scopes of one country, as the adapter asks). */
    async batch(scopes: Scope[]): Promise<Map<string, unknown>> {
      const byKey = new Map(scopes.map(s => [scopeKey(s), s]))
      const kept = await evidence.many([...byKey.keys()], async missing => {
        const wanted = missing.map(key => byKey.get(key)!)
        try {
          const rows = await reads.batch(wanted)
          // Every title read is answered, with null for one without evidence.
          return new Map(wanted.map(s => [scopeKey(s), rows.get(`${s.mediaType}-${s.tmdbId}`) ?? null]))
        } catch (error) {
          console.warn('Availability evidence unavailable', error instanceof Error ? error.message : 'query failure')
          return new Map()
        }
      })
      const found = new Map<string, unknown>()
      for (const s of scopes) {
        const value = kept.get(scopeKey(s))
        if (value != null) found.set(`${s.mediaType}-${s.tmdbId}`, value)
      }
      return found
    },
    /** Throws when the read fails (nothing kept). */
    async links(scopes: Scope[]): Promise<StreamLink[]> {
      const byKey = new Map(scopes.map(s => [scopeKey(s), s]))
      const kept = await links.many([...byKey.keys()], async missing => {
        const rows = await reads.links(missing.map(key => byKey.get(key)!))
        const answer = new Map<string, StreamLink[]>(missing.map(key => [key, []]))
        for (const row of rows) answer.get(`${row.media_type}-${row.media_tmdb_id}-${row.country_code}`)?.push(row)
        return answer
      })
      return [...kept.values()].flat()
    },
  }
}
