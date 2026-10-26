import {
	KINDS,
	MINS,
	NO_FACETS,
	type RankedTrope,
	choiceStats,
	eraOf,
	erasOf,
	rankTropes,
} from "../../ui/profile/tropes/model.ts"
import type { TropeDescriptions } from "./trope-catalog-data.ts"
import type { ProfileTropes } from "./tropes-data.ts"

export const FIRST_TROPES = 30
export interface TropesPreview {
	data: ProfileTropes
	ranked: RankedTrope[]
	usual: number
	total: number
	carrying: number
	eras: number[]
	choices: Record<string, { count: number; picture: string | null }>
}

/** First-view bands and their defining titles only. No title–trope matrix crosses the SSR boundary. */
export function tropesPreview(full: ProfileTropes): TropesPreview {
	const { ranked, usual } = rankTropes(full, full.pool)
	const first = ranked.slice(0, FIRST_TROPES)
	const keys = new Set(first.flatMap((t) => t.top))
	const eras = erasOf(full.pool)
	const stats = (
		skip: Parameters<typeof choiceStats>[3],
		test: Parameters<typeof choiceStats>[4],
	) => choiceStats(full.pool, full.titles, NO_FACETS, skip, test)
	const choices = Object.fromEntries([
		...KINDS.map((k) => [
			k.key,
			stats(
				"kind",
				(t) => k.key === "all" || t.m === (k.key === "movie" ? 0 : 1),
			),
		]),
		...full.genres.map((_, i) => [
			`g${i}`,
			stats("genres", (t) => t.g.includes(i)),
		]),
		...eras.map((e) => [
			`e${e}`,
			stats("eras", (t) => t.y != null && eraOf(t.y) === e),
		]),
		...MINS.map((m) => [
			`min-${m.key}`,
			stats("min", (t) => m.key === "any" || t.s >= Number(m.key)),
		]),
	])
	return {
		data: {
			genres: full.genres,
			years: full.years,
			tropes: first.map((t) => t.id ?? t.name),
			descriptions: {},
			urls: {},
			pool: [],
			titles: Object.fromEntries(
				Object.entries(full.titles).filter(([key]) => keys.has(key)),
			),
			seen: full.seen.filter((k) => keys.has(k)),
		},
		ranked: first,
		usual,
		total: ranked.length,
		carrying: full.pool.filter((t) => t.r.length > 0).length,
		eras,
		choices,
	}
}

/** Enrich only visible bands; a 4,000-trope profile still needs one small catalog read for its first screen. */
export function withPreviewDescriptions(
	preview: TropesPreview,
	entries: TropeDescriptions,
): TropesPreview {
	return {
		...preview,
		ranked: preview.ranked.map((tag) => ({
			...tag,
			name: entries[tag.id ?? tag.name]?.title || tag.name,
			description: entries[tag.id ?? tag.name]?.text || null,
			url: entries[tag.id ?? tag.name]?.url || tag.url,
		})),
	}
}
