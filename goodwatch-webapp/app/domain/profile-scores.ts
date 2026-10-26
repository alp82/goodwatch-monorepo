// Complete-library filtering and stable ordering precede paging. Counts never describe just the loaded posters.
import type { ProfileScoresPage, ProfileTitle } from "./profile.ts"

export const SCORES_PAGE_SIZE = 24
export interface ScoresChoice {
	kind: "all" | "movie" | "show"
	sort: "recent" | "gw" | "title"
	both: boolean
}
export const scoresChoiceOf = (params: URLSearchParams): ScoresChoice => ({
	kind:
		params.get("type") === "movie"
			? "movie"
			: params.get("type") === "show"
				? "show"
				: "all",
	sort:
		params.get("sort") === "gw"
			? "gw"
			: params.get("sort") === "title"
				? "title"
				: "recent",
	both: params.get("both") === "1",
})
export function scoresParams(choice: ScoresChoice): URLSearchParams {
	const params = new URLSearchParams()
	if (choice.kind !== "all") params.set("type", choice.kind)
	if (choice.sort !== "recent") params.set("sort", choice.sort)
	if (choice.both) params.set("both", "1")
	return params
}

export function scoresPage(
	all: readonly ProfileTitle[],
	choice: ScoresChoice = scoresChoiceOf(new URLSearchParams()),
	you: Record<string, number> | null = null,
	page: { tier?: number; offset: number } = { offset: 0 },
): ProfileScoresPage {
	// A guest/owner cannot activate comparison by hand-editing the URL.
	const effective = { ...choice, both: choice.both && you !== null }
	const shared = all.filter((t) => you?.[t.key] != null)
	const matching = effective.both ? shared : all
	const movies = matching.filter((t) => t.mediaType === "movie").length
	const selected = matching.filter(
		(t) => effective.kind === "all" || t.mediaType === effective.kind,
	)
	const compare = (a: ProfileTitle, b: ProfileTitle) => {
		const order =
			effective.sort === "title"
				? a.title.localeCompare(b.title)
				: effective.sort === "gw"
					? (b.gw ?? -1) - (a.gw ?? -1)
					: (b.date ?? "").localeCompare(a.date ?? "")
		return order || a.key.localeCompare(b.key)
	}
	return {
		choice: effective,
		counts: {
			all: matching.length,
			movie: movies,
			show: matching.length - movies,
		},
		shared:
			you === null
				? null
				: {
						count: shared.length,
						agree: shared.filter(
							(t) => Math.abs((you[t.key] ?? 0) - (t.score ?? 0)) <= 1,
						).length,
					},
		tiers: Array.from({ length: 10 }, (_, i) => 10 - i).flatMap((score) => {
			const titles = selected.filter((t) => t.score === score).sort(compare)
			if (!titles.length || (page.tier !== undefined && page.tier !== score))
				return []
			const end = page.offset + SCORES_PAGE_SIZE
			return [
				{
					score,
					total: titles.length,
					titles: titles.slice(page.offset, end),
					next: end < titles.length ? end : null,
				},
			]
		}),
	}
}
