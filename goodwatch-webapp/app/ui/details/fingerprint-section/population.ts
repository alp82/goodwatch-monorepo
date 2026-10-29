// The fingerprint section's questions about the population (the most popular titles of the type): the title's rarest
// pairs of effects, and the titles that share a selection of effects. Both load once the reader comes near the
// section, so the section renders without them first and keeps its room.
import { keepPreviousData, useQuery } from "@tanstack/react-query"

export interface PairsAnswer {
	/** Population size. */
	of: number
	/** Effect ids; rarest first. */
	pairs: { a: string; b: string; both: number }[]
}

export interface SharedTitle {
	tmdbId: number
	title: string
	year: number | null
	poster: string
	goodwatch: number | null
	/** The title's strongest ingredient sub-scores of the selected effects (6+), for the quick view's chips. */
	keys: string[]
}

export interface MixAnswer {
	/** Population titles where every effect counts, before the franchise and poster filters. */
	total: number
	titles: SharedTitle[]
}

async function getJson<T>(url: string): Promise<T> {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`${url}: ${response.status}`)
	return response.json()
}

/** `enabled`: false to wait. */
export function useRarePairs(
	type: "movie" | "show",
	tmdbId: number,
	enabled = true,
) {
	return useQuery({
		queryKey: ["fingerprint-pairs", type, tmdbId],
		queryFn: () =>
			getJson<PairsAnswer>(`/api/fingerprint/pairs?type=${type}&id=${tmdbId}`),
		enabled,
	})
}

/**
 * The titles that share the selection, tagged with the selection they belong to. While a new selection loads, the
 * previous answer stays, so the posters crossfade from the old set to the new one instead of emptying.
 */
export function useSharedTitles(
	type: "movie" | "show",
	effects: readonly string[],
	exclude: number,
) {
	const key = effects.join(",")
	return useQuery({
		queryKey: ["fingerprint-mix", type, key, exclude],
		queryFn: async () => ({
			key,
			...(await getJson<MixAnswer>(
				`/api/fingerprint/mix?type=${type}&effects=${key}&exclude=${exclude}`,
			)),
		}),
		enabled: effects.length > 0,
		placeholderData: keepPreviousData,
	})
}
