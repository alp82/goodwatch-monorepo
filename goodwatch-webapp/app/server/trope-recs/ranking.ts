import type { TropePool } from "../profile/tropes-model.ts"
import { rankTropes } from "../../ui/profile/tropes/model.ts"
import type { UserData, MediaKey } from "../../types/user-data.ts"

export type Kind = "all" | "movie" | "show"
export interface MemberTrope {
	id: string
	name: string
	rank: number
	z: number
	/** The member's titles carrying it, and how many of them they scored 8+ (the single-trope header). */
	count: number
	loved: number
	/** The title aggregate names merged into this identity, for matching a title page's trope names. */
	labels: string[]
}
export interface Candidate {
	id: MediaKey
	kind: "movie" | "show"
	name: string
	year: number | null
	poster: string
	gwScore: number
	popularity: number
	href: string
	/** Rounded definingness x100, using distinct aggregate names as in prototype G. */
	tropes: { i: number; d: number }[]
}
export interface CandidateIndex {
	titles: Candidate[]
	tropes: string[]
	names: string[]
	references: string[][]
}
export interface Recommendation
	extends Omit<Candidate, "tropes" | "popularity"> {
	match: number
	matchedTropes: { id: string; name: string; rank: number; d: number }[]
	/** Every profile trope the title carries; matchedTropes lists at most eight of them. */
	matchedCount: number
	wishlist: boolean
}

/** Reuse the Tropes tab's z, base rate, identity and tie rules, with the prototype's fixed minimum of ten. */
export function memberTropes(pool: TropePool): MemberTrope[] {
	return rankTropes(pool, pool.pool)
		.ranked.filter((t) => t.count >= 10 && t.z > 0)
		.slice(0, 60)
		.map((t, i) => ({
			// Legacy name-indexed snapshots have no URI; preserve their name identity until rebuilt.
			id: t.id ?? t.name,
			name: t.name,
			rank: i + 1,
			z: t.z,
			count: t.count,
			loved: t.loved,
			labels: t.labels ?? [t.name],
		}))
}

/** Full eligible list is scored before either mode truncates or normalizes. */
export function rankRecommendations(
	index: CandidateIndex,
	profile: MemberTrope[],
	data: UserData,
	kind: Kind,
	trope?: string,
	excluded: ReadonlySet<string> = memberExclusions(data),
): Recommendation[] {
	const byId = new Map(profile.map((t) => [t.id, t]))
	if (trope !== undefined && !byId.has(trope))
		throw new RangeError("Trope is not in the member profile")
	const seen = new Set<string>()
	const rows = index.titles
		.flatMap((t) => {
			if (
				seen.has(t.id) ||
				(kind !== "all" && t.kind !== kind) ||
				excluded.has(t.id)
			)
				return []
			seen.add(t.id)
			const hits = t.tropes
				.flatMap((h) => {
					const p = byId.get(index.tropes[h.i])
					return p ? [{ ...p, d: h.d }] : []
				})
				.sort((a, b) => a.rank - b.rank)
			if (!hits.length) return []
			const raw =
				((hits.reduce(
					(sum, h) => sum + h.z * (0.5 + Math.min(h.d, 60) / 60),
					0,
				) /
					Math.sqrt(hits.length)) *
					t.gwScore) /
				100
			return raw > 0 ? [{ t, hits, raw, match: 0 }] : []
		})
		.sort(
			(a, b) =>
				b.raw - a.raw ||
				b.t.gwScore - a.t.gwScore ||
				a.t.id.localeCompare(b.t.id),
		)
	const best = rows[0]?.raw || 1
	for (const r of rows) r.match = Math.round((r.raw / best) * 100)
	const selected =
		trope === undefined
			? rows
			: rows
					.flatMap((r) => {
						const hit = r.hits.find((h) => h.id === trope)
						return hit
							? [
									{
										...r,
										raw:
											(0.6 * Math.min(hit.d, 60)) / 60 + (0.4 * r.match) / 100,
									},
								]
							: []
					})
					.sort((a, b) => b.raw - a.raw) // Stable ties retain For you order, as in prototype G.
	const top = selected[0]?.raw || 1
	return selected.slice(0, trope === undefined ? 120 : 60).map((r) => {
		const { tropes: _, popularity: __, ...title } = r.t
		return {
			...title,
			match: trope === undefined ? r.match : Math.round((r.raw / top) * 100),
			matchedTropes: shownHits(r.hits, trope).map((h) => ({
				id: h.id,
				name: h.name,
				rank: h.rank,
				d: h.d,
			})),
			matchedCount: r.hits.length,
			wishlist: r.t.id in data.wishlist,
		}
	})
}

/** The first eight hits in rank order; a selected trope ranked lower takes the eighth place. */
function shownHits<T extends { id: string }>(hits: T[], trope?: string): T[] {
	const shown = hits.slice(0, 8)
	if (trope === undefined || shown.some((h) => h.id === trope)) return shown
	const hit = hits.find((h) => h.id === trope)
	return hit ? [...shown.slice(0, 7), hit] : shown
}

export function recParams(
	params: URLSearchParams,
): { kind: Kind; trope?: string } | null {
	const kind = params.get("kind") ?? "all"
	const trope = params.get("trope") ?? undefined
	if (
		!["all", "movie", "show"].includes(kind) ||
		(trope !== undefined && (!trope.trim() || trope.length > 4096))
	)
		return null
	return { kind: kind as Kind, trope }
}

export function memberExclusions(data: UserData, log: readonly string[] = []) {
	return new Set([
		...Object.keys(data.scores),
		...Object.keys(data.watchState),
		...Object.keys(data.skipped),
		...Object.keys(data.notInterested),
		...log,
	])
}
