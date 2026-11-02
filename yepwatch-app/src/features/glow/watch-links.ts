import type { Candidate, CatalogMetadata, ScreenAvailability, ScreenContext } from '@goodwatch/yepwatch-contracts/proposal';

export function goodwatchTitleUrl(identity: Candidate['identity']) {
  return `https://goodwatch.app/${identity.kind === 'movie' ? 'movie' : 'show'}/${identity.tmdbId}`;
}

/**
 * The room's service links, one per service: a direct provider link wins over a fallback page. Every link reads
 * "Watch on <service>" and keeps the offer's own target.
 */
export function roomWatchLinks(availability: ScreenAvailability[], screens: ScreenContext[], metadata?: CatalogMetadata) {
  const groups = metadata?.providerGroups ?? metadata?.services.map(s => ({ ...s, selectionIds: [s.id] })) ?? [];
  const links = new Map<string, { id: string; name: string; url: string; logoUrl: string | null; action: 'Watch on'; direct: boolean; note: string }>();
  for (const a of availability) {
    const screen = screens.find(s => s.id === a.screenId && s.confirmed);
    if (!screen || a.state !== 'watchable') continue;
    for (const offer of a.offers) {
      const group = groups.find(g => g.selectionIds.includes(offer.serviceId));
      const ids = group?.selectionIds ?? [offer.serviceId];
      if (!ids.some(id => screen.serviceIds.includes(id)) || !offer.url) continue;
      try { if (new URL(offer.url).protocol !== 'https:') continue; } catch { continue; }
      const id = `${group?.id ?? offer.serviceId}`;
      if (links.has(id) && (links.get(id)!.direct || offer.kind !== 'provider')) continue;
      links.set(id, {
        id, name: group?.name ?? offer.name, url: offer.url,
        logoUrl: group?.logoUrl ?? metadata?.services.find(s => s.id === offer.serviceId)?.logoUrl ?? null,
        action: 'Watch on',
        direct: offer.kind === 'provider',
        note: offer.offerType === 'ads' ? 'With ads' : offer.offerType === 'free' ? 'Free' : 'Streaming',
      });
    }
  }
  return [...links.values()];
}
