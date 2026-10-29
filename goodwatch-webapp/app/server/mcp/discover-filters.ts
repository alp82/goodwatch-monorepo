import * as z from "zod4"
import { CONTENT_KINDS, MAX_AGE } from "../../domain/age-content.ts"
import {
	TAG_GROUPS,
	SCORE_GAPS,
	SOURCE_KEYS,
	type FilterState,
	MIN_MATCHES,
	RELEASED,
	type SortKey,
	defaultFilterState,
	filterQuery,
} from "../../domain/filter-state.ts"
import { MOODS, MOOD_KEYS } from "../../domain/moods.ts"
import { STYLE_KEYS, THEME_KEYS } from "../../domain/themes-styles.ts"

/** Ranked cursors inherit their query; every other blank query is catalog discovery. */
export function isDiscoverySearch(args: {
	query?: string
	cursor?: string
}): boolean {
	return !args.query?.trim() && !args.cursor?.startsWith("ranked:")
}

/** Names map onto the site's filter state; the engine and URL codec own their semantics. */
export const discoverFilters = {
	source_scores: z
		.partialRecord(z.enum(SOURCE_KEYS), z.number().int().min(0).max(100))
		.optional()
		.describe(
			"Inclusive source minimums, all must pass: imdb, rtCritics, rtAudience, metacritic (critics), metacriticUsers. All values are normalized 0–100 integers: 70 means IMDb/Metacritic users 7.0, RT 70%, Metascore 70. Suggested steps: 60, 70, 80, 90. Missing scores do not pass, even at zero.",
		),
	score_gap: z.enum(SCORE_GAPS).optional(),
	any_service: z.boolean().optional(),
	type: z.enum(["all", "movie", "show"]).optional(),
	genres: z
		.union([
			z.array(z.string().trim().min(1).max(80)).max(20),
			z
				.string()
				.trim()
				.min(1)
				.max(80)
				.transform((genre) => [genre]),
		])
		.optional()
		.describe(
			"Exact genre names from get_discover_filters; a single name or an array, matching any selected genre unless genres is in match_all.",
		),
	min_year: z.number().int().min(1800).max(2100).optional(),
	max_year: z.number().int().min(1800).max(2100).optional(),
	min_runtime: z
		.number()
		.int()
		.min(0)
		.max(10000)
		.optional()
		.describe(
			"Inclusive minutes; movie duration or usual episode length for shows. Unknown runtimes do not pass.",
		),
	max_runtime: z.number().int().min(0).max(10000).optional(),
	minimum_score: z
		.number()
		.int()
		.min(0)
		.max(100)
		.optional()
		.describe("GoodWatch score, 0–100; inclusive minimum."),
	on_my_services: z
		.boolean()
		.optional()
		.describe(
			"Default false (everywhere). Uses saved country and services. Without saved services this does not narrow, as on the site.",
		),
	providers: z
		.array(z.number().int().positive().max(999999999))
		.max(20)
		.optional()
		.describe(
			"Specific provider IDs from get_discover_filters, in your saved country. Matches any selected provider; mutually exclusive with on_my_services=true.",
		),
	anime: z.enum(["any", "only", "none"]).optional(),
	match_all: z
		.array(z.enum(TAG_GROUPS))
		.max(TAG_GROUPS.length)
		.optional()
		.describe(
			"Require all picks in these tag groups (moods, themes, styles, genres). Other groups match any pick. Ignored for fewer than two distinct picks.",
		),
	moods: z
		.array(z.enum(MOOD_KEYS))
		.max(3)
		.optional()
		.describe(
			`Mood keys (names: ${MOODS.map((mood) => `${mood.key} = ${mood.name}`).join("; ")}). Match any selected moods; include moods in match_all to require every pick.`,
		),
	themes: z
		.array(z.enum(THEME_KEYS))
		.max(3)
		.optional()
		.describe(
			"Match any selected themes; include themes in match_all to require every pick.",
		),
	styles: z
		.array(z.enum(STYLE_KEYS))
		.max(3)
		.optional()
		.describe(
			"Match any selected styles; include styles in match_all to require every pick.",
		),
	seen_only: z
		.boolean()
		.optional()
		.describe("Seen before; mutually exclusive with exclude_seen=true."),
	wishlist_only: z
		.boolean()
		.optional()
		.describe(
			"Only titles on your Wishlist; combines with seen_only or exclude_seen.",
		),
	outside_usual: z
		.boolean()
		.optional()
		.describe(
			"Outside your usual: taste match 50–59. Supersedes minimum_match; does not narrow without taste.",
		),
	minimum_match: z
		.union(MIN_MATCHES.map((n) => z.literal(n)))
		.optional()
		.describe(
			"GoodWatch taste match threshold; does not narrow when taste is unavailable, as on the site.",
		),
	released: z.enum(RELEASED).optional(),
	age_limit: z
		.number()
		.int()
		.min(0)
		.max(MAX_AGE)
		.optional()
		.describe("Uses the saved country's age-rating ladder, when available."),
	hide_content: z
		.array(z.enum(CONTENT_KINDS))
		.max(CONTENT_KINDS.length)
		.optional(),
	show_content: z
		.array(z.enum(CONTENT_KINDS))
		.max(CONTENT_KINDS.length)
		.optional(),
	order: z
		.enum(["for_you", "popularity", "newest", "score", "match"])
		.optional()
		.describe(
			"Default For you (popular with the site's taste adjustment). Other orders disable that adjustment unless for_you=true is explicitly supplied. Match uses the site's Best match order.",
		),
}
export interface DiscoverFilterArgs
	extends z.infer<z.ZodObject<typeof discoverFilters>> {
	for_you?: boolean
	exclude_seen?: boolean
}
export const filterArgNames = Object.keys(
	discoverFilters,
) as (keyof typeof discoverFilters)[]
export const hasDiscoverFilters = (args: DiscoverFilterArgs) =>
	filterArgNames.some((key) => args[key] !== undefined)
export function validDiscoverRanges(args: DiscoverFilterArgs) {
	return (
		!(
			args.min_year !== undefined &&
			args.max_year !== undefined &&
			args.min_year > args.max_year
		) &&
		!(
			args.min_runtime !== undefined &&
			args.max_runtime !== undefined &&
			args.min_runtime > args.max_runtime
		) &&
		!(args.seen_only && args.exclude_seen) &&
		!(args.on_my_services && args.providers?.length) &&
		!(args.any_service && (args.on_my_services || args.providers?.length))
	)
}
export function discoverView(args: DiscoverFilterArgs, searching: boolean) {
	const state: FilterState = {
		...defaultFilterState({ onMyServices: false, notSeenYet: false }),
		type: args.type ?? "all",
		anime: args.anime ?? "any",
		onMyServices: args.any_service ? false : (args.on_my_services ?? false),
		...(args.any_service ? { anyService: true } : {}),
		...(args.source_scores ? { sourceScores: args.source_scores } : {}),
		...(args.score_gap ? { scoreGap: args.score_gap } : {}),
		...(args.providers?.length ? { services: args.providers } : {}),
		notSeenYet: args.seen_only ? false : (args.exclude_seen ?? false),
		...(args.seen_only ? { seenBefore: true } : {}),
		...(args.wishlist_only ? { onWishlist: true } : {}),
		...(args.outside_usual ? { outsideUsual: true } : {}),
		genres: args.genres ?? [],
		moods: args.moods ?? [],
		themes: args.themes ?? [],
		styles: args.styles ?? [],
		minScore: args.minimum_score ?? 0,
		minMatch: args.outside_usual ? 0 : (args.minimum_match ?? 0),
		released: args.released ?? "any",
		...(args.age_limit === undefined ? {} : { ageLimit: args.age_limit }),
	}
	const allOf = TAG_GROUPS.filter(
		(group) =>
			args.match_all?.includes(group) && new Set(state[group]).size >= 2,
	)
	if (allOf.length) state.allOf = allOf
	if (args.min_year !== undefined || args.max_year !== undefined) {
		state.years = {
			...(args.min_year === undefined ? {} : { min: args.min_year }),
			...(args.max_year === undefined ? {} : { max: args.max_year }),
		}
		state.released = "any"
	}
	if (args.min_runtime !== undefined || args.max_runtime !== undefined)
		state.runtime = {
			...(args.min_runtime === undefined ? {} : { min: args.min_runtime }),
			...(args.max_runtime === undefined ? {} : { max: args.max_runtime }),
		}
	if (args.hide_content?.length || args.show_content?.length) {
		state.content = {}
		for (const kind of args.show_content ?? []) state.content[kind] = "show"
		for (const kind of args.hide_content ?? []) state.content[kind] = "hide"
	}
	const sort: SortKey = (
		{
			for_you: searching ? "relevance" : "popular",
			popularity: "popular",
			newest: "newest",
			score: "top",
			match: "match",
		} as const
	)[args.order ?? "for_you"]
	const forYou =
		args.for_you ??
		(!args.order || args.order === "for_you" || args.order === "match")
	return { state, sort, forYou }
}
/** Explicit defaults override the member's website defaults when following a tool link. */
export function discoverParams(args: DiscoverFilterArgs, searching: boolean) {
	const view = discoverView(args, searching)
	const params = new URLSearchParams(
		filterQuery(view.state, view.sort, {
			onMyServices: false,
			notSeenYet: false,
		}),
	)
	params.set("foryou", view.forYou ? "1" : "0")
	return params
}
/** Stable cache/cursor identity, independent of JSON object key order. */
export const discoverViewKey = (args: DiscoverFilterArgs) =>
	discoverParams(args, true).toString()
/** Only view arguments enter cached metadata; never persist query text, paging or library selectors here. */
export function filterArgs(args: DiscoverFilterArgs): DiscoverFilterArgs {
	return Object.fromEntries(
		[...filterArgNames, "for_you", "exclude_seen"]
			.filter((key) => args[key as keyof DiscoverFilterArgs] !== undefined)
			.map((key) => [key, args[key as keyof DiscoverFilterArgs]]),
	) as DiscoverFilterArgs
}
