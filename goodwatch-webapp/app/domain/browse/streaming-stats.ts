// What tells a country's streaming services apart, from grouped availability counts: how many titles each carries, how
// many arrived and left in the last 30 days, and whether it costs a subscription or is free (with ads or without).
// A brand's tiers are one service ("Netflix", "Netflix Standard with Ads") and a duplicate id counts as its base
// service. Tiers carry nearly the same catalog, so a group's number is its largest member's, not their sum. Pure.
import { baseService } from "~/domain/newly-available"
import { brandOfService } from "~/domain/new-on-services"

/** Offer types that come with a plan (not rent or buy), as everywhere on the site. */
export const PLAN_TYPES = ["flatrate", "free", "ads"] as const
/** A service with fewer titles of the kind than this is a channel, not a place to browse. */
export const MIN_SERVICE_TITLES = 40

export type StreamKind = "movie" | "show" | "all"
export type StreamModel = "plan" | "ads" | "free"

/** One grouped row: titles of a media type on a service (with the offer type for the catalog read). */
export type ServiceCountRow = {
	streaming_service_id: number
	media_type: string
	streaming_type?: string
	n: number
}

/** A service group's key: `brand:<slug>` for a brand with a page, else `id:<base service id>`. */
export const serviceGroupOf = (id: number) => {
	const brand = brandOfService(id)
	return brand ? `brand:${brand.slug}` : `id:${baseService(id)}`
}

export const kindHas = (kind: StreamKind, mediaType: string) =>
	kind === "all" ||
	(kind === "show" ? mediaType === "tv" || mediaType === "show" : mediaType === "movie")

/** Per group: the largest member's count of the kind (movies and shows add up within a member for "all"). */
export function countPerGroup(
	rows: readonly ServiceCountRow[],
	kind: StreamKind,
): Map<string, number> {
	const byId = new Map<number, number>()
	for (const r of rows)
		if (kindHas(kind, r.media_type))
			byId.set(r.streaming_service_id, (byId.get(r.streaming_service_id) ?? 0) + Number(r.n))
	const out = new Map<string, number>()
	for (const [id, n] of byId) {
		const g = serviceGroupOf(id)
		out.set(g, Math.max(out.get(g) ?? 0, n))
	}
	return out
}

/** Per group: its service ids and what it costs (the offer type that carries most of its titles). */
export function groupsOf(
	catalog: readonly ServiceCountRow[],
	kind: StreamKind,
): Map<string, { ids: number[]; model: StreamModel }> {
	const types = new Map<string, Map<string, number>>()
	const ids = new Map<string, Set<number>>()
	for (const r of catalog) {
		if (!kindHas(kind, r.media_type)) continue
		const g = serviceGroupOf(r.streaming_service_id)
		const t = types.get(g) ?? new Map<string, number>()
		t.set(
			r.streaming_type ?? "flatrate",
			(t.get(r.streaming_type ?? "flatrate") ?? 0) + Number(r.n),
		)
		types.set(g, t)
		ids.set(g, (ids.get(g) ?? new Set()).add(r.streaming_service_id))
	}
	const out = new Map<string, { ids: number[]; model: StreamModel }>()
	for (const [g, t] of types) {
		const plan = t.get("flatrate") ?? 0
		const ads = t.get("ads") ?? 0
		const free = t.get("free") ?? 0
		const model: StreamModel = plan >= ads && plan >= free ? "plan" : ads >= free ? "ads" : "free"
		out.set(g, { ids: [...(ids.get(g) ?? [])].sort((a, b) => a - b), model })
	}
	return out
}

/** The numbers a service shows (and sorts by). */
export interface ServiceNumbers {
	titles: number
	arrived: number
	left: number
	/** How many of the country's most popular titles it carries (the default sort; never shown as a number). */
	popular: number
	/** Well-known titles scoring 80 or more. */
	great: number
}

/**
 * A tier or channel that carries a bigger service's name ("Amazon Prime Video with Ads", "HBO Max Amazon Channel")
 * folds into it: the same catalog under another label is not another place to browse. Shorter names go first, so the
 * plain brand is always the host. Returns the hosts, each with the larger of its own and its folded numbers.
 */
export function foldTiers<T extends { name: string } & ServiceNumbers>(
	services: readonly T[],
): T[] {
	const hosts: T[] = []
	for (const s of [...services].sort((x, y) => x.name.length - y.name.length)) {
		const host = hosts.find((h) => s.name.toLowerCase().startsWith(`${h.name.toLowerCase()} `))
		if (!host) {
			hosts.push({ ...s })
			continue
		}
		host.arrived = Math.max(host.arrived, s.arrived)
		host.left = Math.max(host.left, s.left)
		host.popular = Math.max(host.popular, s.popular)
		host.great = Math.max(host.great, s.great)
		host.titles = Math.max(host.titles, s.titles)
	}
	return hosts
}

export type ServiceSort = "popular" | "titles" | "great" | "new" | "name"

/** Orders services for a sort; ties fall back to popularity, then library size, then name. */
export function sortServices<T extends { name: string } & ServiceNumbers>(
	services: readonly T[],
	sort: ServiceSort,
): T[] {
	const key = (s: T) =>
		sort === "titles"
			? s.titles
			: sort === "great"
				? s.great
				: sort === "new"
					? s.arrived
					: sort === "popular"
						? s.popular
						: 0
	return [...services].sort(
		(x, y) =>
			(sort === "name" ? x.name.localeCompare(y.name) : key(y) - key(x)) ||
			y.popular - x.popular ||
			y.titles - x.titles ||
			x.name.localeCompare(y.name),
	)
}
