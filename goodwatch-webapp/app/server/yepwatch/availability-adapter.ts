import { evaluateAvailability } from '../../utils/availability-evidence.ts'
import { linkedAvailability, providerFamily } from '../mcp/watch-links.ts'
import type { ScreenAvailability, ScreenContext } from '../../../packages/yepwatch-contracts/index.ts'
import type { CatalogDisplay } from './catalog-adapter.ts'
type Scope = { mediaType: 'movie' | 'show'; tmdbId: number; country: string }
export interface EvidenceReads {
  batch(scopes: Scope[]): Promise<Map<string, unknown>>
  fresh(scope: Scope): Promise<unknown>
  names(): Promise<ReadonlyMap<number, string>>
}
/** Country-qualified loading plus existing evidence evaluator/link rules. No independent availability rules. */
export function createAvailabilityAdapter(reads: EvidenceReads, now: () => number = Date.now) {
  return async (titles: CatalogDisplay[], screens: ScreenContext[], fresh: boolean) => {
    const names = await reads.names(); const byCountry = new Map<string, Map<string, unknown>>()
    await Promise.all([...new Set(screens.map(s => s.country!))].map(async country => {
      const scopes = titles.map(t => ({ mediaType: t.mediaType, tmdbId: t.tmdbId, country }))
      const evidence = fresh ? new Map(await Promise.all(scopes.map(async scope => [`${scope.mediaType}-${scope.tmdbId}`, await reads.fresh(scope)] as const))) : await reads.batch(scopes)
      byCountry.set(country, evidence)
    }))
    const result = new Map<number, ScreenAvailability[]>()
    for (const title of titles) result.set(title.key, screens.map(screen => {
      const serviceIds = [...new Set(screen.serviceIds.flatMap(providerFamily))]
      const check = evaluateAvailability(byCountry.get(screen.country!)?.get(`${title.mediaType}-${title.tmdbId}`), { mediaType: title.mediaType, tmdbId: title.tmdbId, country: screen.country!, serviceIds }, now())
      const linked = linkedAvailability(check, { media_type: title.mediaType, tmdb_id: title.tmdbId }, screen.country!, names, [])
      return { screenId: screen.id, state: check.state, scope: 'title', checkedAt: check.offers.length ? Math.min(...check.offers.map(o => o.checked_at)) : null,
        offers: linked.offers.flatMap(o => o.offer_type === 'rent' || o.offer_type === 'buy' ? [] : [{ serviceId: o.service_id, name: o.name ?? `Service ${o.service_id}`, url: o.url, kind: o.link_kind === 'provider' ? 'provider' as const : 'where_to_watch' as const, offerType: o.offer_type }]) }
    }))
    return result
  }
}
