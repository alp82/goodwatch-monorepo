import type { CatalogMetadata } from '@goodwatch/yepwatch-contracts/proposal';

/** One streaming tile: a provider group and every catalog id it selects. */
export interface ServiceChoice { id: number; name: string; logoUrl: string | null; ids: number[]; minor: boolean }

/** Add-on channels, stores (rentals), free and ad tiers: real, but never the tile people look for first. */
const ADDON = /amazon channel|apple tv channel|roku premium channel|plex channel/i;
const STORE = /\bstore\b|google play|microsoft|rakuten tv|videobuster|fandango at home|justwatch tv|^amazon video$|vudu|chili/i;
const LESSER = /with ads|\bfree\b|kids/i;
const extra = (n: string) => ADDON.test(n) || STORE.test(n) || LESSER.test(n);
/** The big subscriptions first, in this order, wherever they exist; then the catalog's own order. */
const MAJOR = [/^netflix$/i, /^prime video$/i, /^disney\+$/i, /^hbo max$|^max$/i, /^apple tv\+?$/i, /^paramount\+/i, /^hulu$/i, /^peacock/i, /^(sky go|wow|now)$/i, /^crunchyroll$/i];
const clean = (n: string) => n.trim().replace(/^Amazon Prime Video$/i, 'Prime Video').replace(/ Plus\b/g, '+');

type Group = NonNullable<CatalogMetadata['providerGroups']>[number] & { minor?: boolean };

/**
 * Tiles in the order people look for them: the big subscriptions, then the catalog's order, then
 * minor tiles (add-on channels, stores, ad tiers). The catalog marks minor groups; older catalogs
 * without the flag fall back to the same name rules.
 */
export function rankServices(meta: CatalogMetadata | undefined): ServiceChoice[] {
  if (!meta) return [];
  const groups: Group[] = meta.providerGroups ?? meta.services.map((s) => ({ ...s, selectionIds: [s.id] }));
  const byId = new Map(meta.services.map((x) => [x.id, x]));
  const seen = new Set<number>(); // Only the first tier of a big service ranks as major (Paramount+ twice in the US).
  return groups.map((g, i) => {
    const members = g.selectionIds.map((id) => byId.get(id)).filter((x): x is CatalogMetadata['services'][number] => Boolean(x));
    // Name the tile after the subscription itself, not its store or Amazon channel.
    const main = members.filter((x) => !extra(x.name)).sort((a, b) => a.name.length - b.name.length)[0];
    const minor = g.minor ?? !main;
    const name = clean(main?.name ?? g.name);
    let major = MAJOR.findIndex((r) => r.test(name));
    if (!minor && major >= 0) { if (seen.has(major)) major = -1; else seen.add(major); }
    return { id: g.id, name, logoUrl: main?.logoUrl ?? g.logoUrl, ids: g.selectionIds, minor, score: minor ? 1000 + i : major >= 0 ? major : 100 + i };
  }).sort((a, b) => a.score - b.score).map(({ score: _score, ...s }) => s);
}

export const pickedIn = (s: ServiceChoice, ids: readonly number[]) => s.ids.some((id) => ids.includes(id));
/** The tiles a set of catalog ids selects, in tile order. */
export const servicesIn = (all: readonly ServiceChoice[], ids: readonly number[]) => all.filter((s) => pickedIn(s, ids));
/** "Netflix, Prime Video +2". */
export const namesLine = (list: readonly ServiceChoice[]) => (list.length <= 2 ? list.map((s) => s.name).join(', ') : `${list[0].name}, ${list[1].name} +${list.length - 2}`);
/** Toggling a tile adds or removes all of its catalog ids. */
export const toggleService = (ids: readonly number[], s: ServiceChoice) => (pickedIn(s, ids) ? ids.filter((id) => !s.ids.includes(id)) : [...new Set([...ids, ...s.ids])]);
/** The grid before More: the 8 biggest, plus anything already picked. */
export const firstTiles = (all: readonly ServiceChoice[], selected: readonly number[]) => all.filter((s, i) => (i < 8 && !s.minor) || pickedIn(s, selected));
