import type { TropePool } from "../profile/tropes-model.ts"
import { rankTropes } from "../../ui/profile/tropes/model.ts"
import type { UserData, MediaKey } from "../../types/user-data.ts"

export type Kind = "all" | "movie" | "show"
export interface MemberTrope {
	id: string
	name: string
	rank: number
	z: number
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
	/** Same rounded definingness x100 as the Tropes tab and prototype G. */
	tropes: { id: string; d: number }[]
}
export interface Recommendation
	extends Omit<Candidate, "tropes" | "popularity"> {
	match: number
	matchedTropes: { id: string; name: string; rank: number; d: number }[]
	wishlist: boolean
}

/** Reuse the Tropes tab's z, base rate, identity and tie rules, with the prototype's fixed minimum of ten. */
export function memberTropes(pool: TropePool): MemberTrope[] {
	return rankTropes(pool, pool.pool)
		.ranked.filter((t) => t.count >= 10 && t.z > 0)
		.slice(0, 60)
		.map((t, i) => ({ id: t.id ?? t.name, name: t.name, rank: i + 1, z: t.z }))
}

/** Full eligible list is scored before either mode truncates or normalizes. */
export function rankRecommendations(
	candidates: Candidate[],
	profile: MemberTrope[],
	data: UserData,
	kind: Kind,
	trope?: string,
): Recommendation[] {
	const byId = new Map(profile.map((t) => [t.id, t]))
	if (trope !== undefined && !byId.has(trope))
		throw new RangeError("Trope is not in the member profile")
	const seen = new Set<string>()
	const rows = candidates
		.flatMap((t) => {
			if (
				seen.has(t.id) ||
				(kind !== "all" && t.kind !== kind) ||
				t.id in data.scores ||
				t.id in data.watchState ||
				t.id in data.skipped ||
				t.id in data.notInterested
			)
				return []
			seen.add(t.id)
			const hits = t.tropes
				.flatMap((h) => {
					const p = byId.get(h.id)
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
			matchedTropes: r.hits.slice(0, 8).map(({ z: _, ...hit }) => hit),
			wishlist: r.t.id in data.wishlist,
		}
	})
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
