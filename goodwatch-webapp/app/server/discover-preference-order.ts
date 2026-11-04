// Discover's search with read preferences (domain/search-preferences.ts): the order of its results. Validated as "V7"
// in issue #726 (docs/implementation/search-preferences.md); the ranking of each pool stays the search's own.
//
// - Relevance: the wider pool (the search without the read preferences as filters), filtered by every filter in use,
//   in the search's order nudged by how well a title fits the preferences (a quarter of the weight of its position),
//   then the original matches the wider pool doesn't hold.
// - Top rated: the original matches first (titles that also carry every read preference), by rating; then the rest
//   of the wider pool, by rating. Both sorts list the same titles.
// - Past SEARCH_RESULTS titles the composition can't be sent on, so the search works as before: the read
//   preferences filter like any filter.
// Pure, so the rules are tested without a snapshot (discover-preference-order.test.ts); preferenceList in
// discover-preference-order.server.ts runs them for the results.
import { SEARCH_RESULTS } from "~/domain/discover-search"
import type { FilterState } from "~/domain/filter-state"
import { foldGenres } from "~/domain/genre-fold"
import type { Preference } from "~/domain/search-preferences"
import { STYLES, THEMES } from "~/domain/themes-styles"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import type { TitleKey } from "~/utils/title-key"

const POSITION_SCALE = Math.log(5001)
const PREFERENCE_WEIGHT = 0.25

/** How well a title fits the read preferences, 0 to 1 (the mean of each preference's fit). */
export function preferenceStrength(
	snapshot: Pick<TitleSnapshot, "facts" | "fingerprint">,
	key: TitleKey,
	preferences: readonly Preference[],
): number {
	if (!preferences.length) return 1
	const facts = snapshot.facts(key)
	const genres: string[] = facts?.genres ?? []
	const print = snapshot.fingerprint(key)
	const dim = (name: string) => {
		const at = (VALID_FINGERPRINT_KEYS as readonly string[]).indexOf(name)
		const value = at >= 0 ? print?.[at] : undefined
		return value === undefined || value === 255 ? null : value
	}
	let sum = 0
	for (const p of preferences) {
		let value = 0
		if (p.group === "moods") value = facts?.moods.includes(p.value as never) ? 1 : 0
		else if (p.group === "genres") {
			// Shows file War and Fantasy under combined genres: the fingerprint says how much of it a show has.
			if (facts?.mediaType === "show" && p.value === "War" && genres.includes("War & Politics"))
				value = (dim("warfare") ?? 0) / 10
			else if (facts?.mediaType === "show" && p.value === "Fantasy" && genres.includes("Sci-Fi & Fantasy"))
				value = (dim("fantasy") ?? 0) / 10
			else value = foldGenres(genres).includes(p.value) ? 1 : 0
		} else if (p.group === "themes" && p.value === "history") value = (dim("historical") ?? 0) / 10
		else {
			const rule = (p.group === "themes" ? THEMES : STYLES).find((r) => r.id === p.value)
			value = rule ? Math.max(0, Math.min(1, rule.level((name) => dim(name) ?? 0, genres) / 10)) : 0
		}
		sum += value
	}
	return sum / preferences.length
}

export interface ComposedOrders {
	relevance: TitleKey[]
	top: TitleKey[]
	/** The original matches among them: the titles that also carry every read preference. */
	original: TitleKey[]
}

/**
 * The two orders from the wider pool's titles that pass every filter (`wider`, in the search's order) and the
 * original matches (`admitted`, by rating). Pure: the caller supplies the fit and the rating order.
 */
export function composeOrders({
	wider,
	admitted,
	strength,
	byRating,
}: {
	wider: readonly TitleKey[]
	admitted: readonly TitleKey[]
	strength: (key: TitleKey) => number
	byRating: (a: TitleKey, b: TitleKey) => number
}): ComposedOrders {
	const position = new Map(wider.map((key, i) => [key, i + 1]))
	const cost = (key: TitleKey) =>
		Math.log1p(position.get(key) as number) / POSITION_SCALE + PREFERENCE_WEIGHT * (1 - strength(key))
	const costs = new Map(wider.map((key) => [key, cost(key)]))
	const ordered = [...wider].sort(
		(a, b) =>
			(costs.get(a) as number) - (costs.get(b) as number) ||
			(position.get(a) as number) - (position.get(b) as number),
	)
	const inWider = new Set(ordered)
	const inAdmitted = new Set(admitted)
	return {
		relevance: [...ordered, ...admitted.filter((key) => !inWider.has(key))],
		top: [...admitted, ...ordered.filter((key) => !inAdmitted.has(key)).sort(byRating)],
		original: [...admitted],
	}
}

/**
 * One title under two keys, `[wider key, original key]`: the wider pool takes the original key where that key also
 * passes every rule (it's among `admitted`), so the title is listed once. Where it doesn't pass, the wider key stays:
 * a title that passes under one key is never hidden by its other one. `replaced` holds the wider keys folded away.
 */
export function foldIdentities(
	wider: readonly TitleKey[],
	admitted: readonly TitleKey[],
	pairs: readonly (readonly [TitleKey, TitleKey])[],
): { wider: TitleKey[]; replaced: Set<TitleKey> } {
	const replaced = new Set<TitleKey>()
	if (!pairs.length) return { wider: [...wider], replaced }
	const eligible = new Set(admitted)
	const to = new Map(pairs.filter(([, o]) => eligible.has(o)))
	const seen = new Set<TitleKey>()
	const out: TitleKey[] = []
	for (const key of wider) {
		const next = to.get(key) ?? key
		if (next !== key) replaced.add(key)
		if (seen.has(next)) continue
		seen.add(next)
		out.push(next)
	}
	return { wider: out, replaced }
}

/** Whether the composed list can be served (else the read preferences filter, as before). */
export const fitsComposition = (orders: ComposedOrders) => orders.relevance.length <= SEARCH_RESULTS

/** The filter state with the read preferences as filters: what "the original matches" pass. */
export function withPreferences(state: FilterState, preferences: readonly Preference[]): FilterState {
	const out: Record<string, unknown> = { ...state }
	for (const p of preferences) {
		const current = (out[p.group] as string[] | undefined) ?? []
		if (!current.includes(p.value)) out[p.group] = [...current, p.value]
	}
	// The groups hold the values the interpreter wrote (preferencesFromParam checks their shape; filters ignore others).
	return out as unknown as FilterState
}
