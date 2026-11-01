import type { CatalogMetadata } from '@goodwatch/yepwatch-contracts/proposal';

/** One streaming tile: a provider group and every catalog id it selects. */
export interface ServiceChoice { id: number; name: string; logoUrl: string | null; ids: number[]; minor: boolean }

/**
 * Tiles in the catalog's order: the server names each group after its subscription, puts the big
 * subscriptions first and marks add-on channels, stores and ad tiers as minor (last).
 */
export function rankServices(meta: CatalogMetadata | undefined): ServiceChoice[] {
  return (meta?.providerGroups ?? []).map((g) => ({ id: g.id, name: g.name, logoUrl: g.logoUrl, ids: g.selectionIds, minor: g.minor }));
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
