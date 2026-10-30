import * as z from "zod4"
import { titleKey } from "../../utils/title-key.ts"
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

const countryCode = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[A-Z]{2}$/)
const titleIds = z
	.array(z.string().regex(/^(movie|show):[1-9]\d{0,9}$/))
	.max(10)
const titleKeys = (values: string[]) => [
	...new Set(
		values.map((value) => {
			const [type, id] = value.split(":")
			return titleKey(type === "movie" ? "movie" : "show", Number(id))
		}),
	),
]

/** Names map onto the site's filter state; the engine and URL codec own their semantics. */
export const discoverFilters = {
	taste_groups: z
		.array(z.string().regex(/^(movie|show)-[1-9]\d{0,9}$/))
		.max(3)
		.optional()
		.describe(
			"Any of up to three stable taste-group keys returned for this member by get_discover_filters. Groups use saved taste, not temporary hints. Unresolved picks do not narrow results, as on Discover.",
		),
	unlimited_episode_runtime: z
		.boolean()
		.optional()
		.describe(
			"Leave shows unrestricted by runtime while keeping movie min_runtime/max_runtime bounds, including shows with unknown episode lengths. Mutually exclusive with min_episode_runtime/max_episode_runtime.",
		),
	similar_to: titleIds
		.optional()
		.describe(
			"Hard filter to titles similar to any supplied canonical movie:ID or show:ID (up to 10). Resolve IDs with search_titles/get_title first. Combines with other filters; does not mark or rate titles.",
		),
	more_like: titleIds
		.optional()
		.describe(
			"Temporary positive taste hints, up to 10 canonical movie:ID/show:ID values. Use order=match or for_you=true to steer ordering; combines with saved taste without saving ratings. less_like wins for overlaps.",
		),
	less_like: titleIds
		.optional()
		.describe(
			"Temporary negative taste hints, up to 10 canonical movie:ID/show:ID values. Use order=match or for_you=true to steer ordering; never changes ratings or Not interested. Wins over more_like for overlaps.",
		),
	people: z
		.array(z.number().int().positive().max(999999999))
		.max(20)
		.optional()
		.describe(
			"TMDB person IDs from search_people/get_person. Keep titles featuring any selected person in cast or crew, combined with other filters.",
		),
	production_countries: z
		.array(countryCode)
		.max(250)
		.optional()
		.describe(
			"Made in any selected ISO alpha-2 production countries; co-productions match each country. Use industry/region args from get_discover_filters. Joins rest_of_world with OR; independent of streaming_country and rating_country.",
		),
	streaming_country: countryCode
		.optional()
		.describe(
			"Request-only country for availability and providers; defaults to your saved viewing country and never changes settings. Does not imply production origin. get_discover_filters accepts this country for provider options.",
		),
	min_budget_musd: z
		.number()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive nominal USD millions; keeps movies with a known amount only. Without facts these filters do not narrow results.",
		),
	max_budget_musd: z
		.number()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive nominal USD millions; keeps movies with a known amount only. Without facts these filters do not narrow results.",
		),
	min_box_office_musd: z
		.number()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive nominal USD millions; keeps movies with a known amount only. Without facts these filters do not narrow results.",
		),
	max_box_office_musd: z
		.number()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive nominal USD millions; keeps movies with a known amount only. Without facts these filters do not narrow results.",
		),
	min_seasons: z
		.number()
		.int()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive seasons; keeps shows with known seasons only. Without facts these filters do not narrow results.",
		),
	max_seasons: z
		.number()
		.int()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive seasons; keeps shows with known seasons only. Without facts these filters do not narrow results.",
		),
	min_hours: z
		.number()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive total hours (episodes × episode length); keeps shows with both facts known only. Without facts these filters do not narrow results.",
		),
	max_hours: z
		.number()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive total hours (episodes × episode length); keeps shows with both facts known only. Without facts these filters do not narrow results.",
		),
	returns: z
		.enum(["hit", "flop"])
		.optional()
		.describe(
			"Hit: box office at least 3x budget. Flop: box office below budget. Keeps movies with both amounts known only. Without facts these filters do not narrow results.",
		),
	show_status: z
		.enum(["running", "ended", "canceled"])
		.optional()
		.describe(
			"Keeps shows with a known production status only. Without facts these filters do not narrow results.",
		),

	min_votes: z
		.number()
		.int()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive rating count minimum; catalog eligibility starts at 1,000 ratings.",
		),
	max_votes: z
		.number()
		.int()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive rating-count ceiling; useful for hidden gems. Browse eligibility still starts at 1,000 ratings.",
		),
	min_popularity_rank: z
		.number()
		.int()
		.min(1)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive catalog Popular rank, 1 first; shared by every viewer and filter, refreshed per snapshot.",
		),
	max_popularity_rank: z
		.number()
		.int()
		.min(1)
		.max(Number.MAX_SAFE_INTEGER)
		.optional()
		.describe(
			"Inclusive catalog Popular rank ceiling; 1 first. Combine with min_popularity_rank for a rank band.",
		),
	source_scores: z
		.partialRecord(z.enum(SOURCE_KEYS), z.number().int().min(0).max(100))
		.optional()
		.describe(
			"Inclusive source minimums, all must pass: imdb, rtCritics, rtAudience, metacritic (critics), metacriticUsers. All values are normalized 0–100 integers: 70 means IMDb/Metacritic users 7.0, RT 70%, Metascore 70. Suggested steps: 60, 70, 80, 90. Missing scores do not pass, even at zero.",
		),
	score_gap: z
		.enum(SCORE_GAPS)
		.optional()
		.describe(
			"Source-score agreement: agree keeps consensus picks, critics favors critic-over-audience scores, audience favors audience-over-critic scores; titles need the compared scores.",
		),
	any_service: z
		.boolean()
		.optional()
		.describe(
			"Require an offer on any service in streaming_country (saved country by default). Mutually exclusive with on_my_services=true or explicit providers; false means no such requirement.",
		),
	type: z
		.enum(["all", "movie", "show"])
		.optional()
		.describe(
			"Movies, shows, or both (default all). Movie-only and show-only fact filters narrow to their applicable type.",
		),
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
	min_year: z
		.number()
		.int()
		.min(1800)
		.max(2100)
		.optional()
		.describe(
			"Inclusive release-year minimum; explicit years override released presets.",
		),
	max_year: z
		.number()
		.int()
		.min(1800)
		.max(2100)
		.optional()
		.describe("Inclusive release-year maximum; omit for an open upper end."),
	min_runtime: z
		.number()
		.int()
		.min(0)
		.max(10000)
		.optional()
		.describe(
			"Inclusive minutes; movie duration or usual episode length for shows unless episode runtime bounds are supplied. Unknown runtimes do not pass.",
		),
	max_runtime: z
		.number()
		.int()
		.min(0)
		.max(10000)
		.optional()
		.describe(
			"Inclusive maximum minutes; movie duration or usual episode length unless independent episode bounds are provided.",
		),
	min_episode_runtime: z
		.number()
		.int()
		.min(0)
		.max(10000)
		.optional()
		.describe(
			"Inclusive episode minutes; when either episode bound is supplied, runtime bounds apply only to movies. Unknown episode lengths do not pass.",
		),
	max_episode_runtime: z
		.number()
		.int()
		.min(0)
		.max(10000)
		.optional()
		.describe(
			"Inclusive maximum episode minutes; independent of movie runtime.",
		),
	rest_of_world: z
		.boolean()
		.optional()
		.describe(
			"Made with at least one production country outside US, IN, KR, JP, GB, FR, CN, HK. Co-productions included.",
		),
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
			"Default false (everywhere). Uses saved services in streaming_country or the saved viewing country. Without saved services this does not narrow, as on the site.",
		),
	providers: z
		.array(z.number().int().positive().max(999999999))
		.max(20)
		.optional()
		.describe(
			"Specific provider IDs from get_discover_filters, in streaming_country or your saved viewing country. Matches any selected provider; mutually exclusive with on_my_services=true.",
		),
	anime: z
		.enum(["any", "only", "none"])
		.optional()
		.describe(
			"Include all animation/live action (any), only anime (only), or exclude anime (none).",
		),
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
	released: z
		.enum(RELEASED)
		.optional()
		.describe(
			"Release presets: any, recent (current year and previous two), 2010s, 2000s, before2000. Explicit min_year/max_year take precedence.",
		),
	rating_country: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z]{2}$/)
		.optional()
		.describe(
			"Country code for the age-rating ladder and title rating badges, independent of streaming services. Defaults to the viewing country (streaming_country or saved country); codes absent from snapshot ratings use that default. The page_url carries ratingCountry.",
		),
	age_limit: z
		.number()
		.int()
		.min(0)
		.max(MAX_AGE)
		.optional()
		.describe(
			"Uses rating_country or the viewing country's age-rating ladder, when available.",
		),
	hide_content: z
		.array(z.enum(CONTENT_KINDS))
		.max(CONTENT_KINDS.length)
		.optional()
		.describe(
			"Explicitly hide selected content kinds, overriding age defaults. A kind in both hide_content and show_content stays hidden.",
		),
	show_content: z
		.array(z.enum(CONTENT_KINDS))
		.max(CONTENT_KINDS.length)
		.optional()
		.describe(
			"Allow selected content kinds despite age defaults; does not lift age_limit itself or override hide_content.",
		),
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
			args.min_budget_musd !== undefined &&
			args.max_budget_musd !== undefined &&
			args.min_budget_musd > args.max_budget_musd
		) &&
		!(
			args.min_box_office_musd !== undefined &&
			args.max_box_office_musd !== undefined &&
			args.min_box_office_musd > args.max_box_office_musd
		) &&
		!(
			args.min_seasons !== undefined &&
			args.max_seasons !== undefined &&
			args.min_seasons > args.max_seasons
		) &&
		!(
			args.min_hours !== undefined &&
			args.max_hours !== undefined &&
			args.min_hours > args.max_hours
		) &&
		!(
			args.min_votes !== undefined &&
			args.max_votes !== undefined &&
			args.min_votes > args.max_votes
		) &&
		!(
			args.min_popularity_rank !== undefined &&
			args.max_popularity_rank !== undefined &&
			args.min_popularity_rank > args.max_popularity_rank
		) &&
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
		!(
			args.min_episode_runtime !== undefined &&
			args.max_episode_runtime !== undefined &&
			args.min_episode_runtime > args.max_episode_runtime
		) &&
		!(
			args.unlimited_episode_runtime &&
			(args.min_episode_runtime !== undefined ||
				args.max_episode_runtime !== undefined)
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
		...(args.taste_groups?.length
			? { tasteGroups: [...new Set(args.taste_groups)] }
			: {}),
		...(args.streaming_country
			? { streamingCountry: args.streaming_country }
			: {}),
		...(args.production_countries?.length
			? { productionCountries: [...new Set(args.production_countries)] }
			: {}),
		...(args.similar_to?.length
			? { similarTo: titleKeys(args.similar_to) }
			: {}),
		...(args.people?.length ? { people: [...new Set(args.people)] } : {}),
		...(args.less_like?.length ? { disliked: titleKeys(args.less_like) } : {}),
		...(args.more_like?.length
			? {
					loved: titleKeys(args.more_like).filter(
						(key) => !titleKeys(args.less_like ?? []).includes(key),
					),
				}
			: {}),
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
		...(args.rating_country
			? { ratingCountry: args.rating_country.trim().toUpperCase() }
			: {}),
		...(args.age_limit === undefined ? {} : { ageLimit: args.age_limit }),
	}
	if (args.rest_of_world) state.restOfWorld = true
	if (
		args.min_episode_runtime !== undefined ||
		args.max_episode_runtime !== undefined
	)
		state.episodeRuntime = {
			...(args.min_episode_runtime === undefined
				? {}
				: { min: args.min_episode_runtime }),
			...(args.max_episode_runtime === undefined
				? {}
				: { max: args.max_episode_runtime }),
		}
	if (args.unlimited_episode_runtime) state.episodeRuntime = null
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
	if (args.returns !== undefined) state.returns = args.returns
	if (args.show_status !== undefined) state.showStatus = args.show_status
	for (const [field, min, max] of [
		["budget", args.min_budget_musd, args.max_budget_musd],
		["boxOffice", args.min_box_office_musd, args.max_box_office_musd],
		["seasons", args.min_seasons, args.max_seasons],
		["hours", args.min_hours, args.max_hours],
		["votes", args.min_votes, args.max_votes],
		["popularityRank", args.min_popularity_rank, args.max_popularity_rank],
	] as const)
		if (min !== undefined || max !== undefined)
			state[field] = {
				...(min === undefined ? {} : { min }),
				...(max === undefined ? {} : { max }),
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
	if (state.loved && !state.loved.length) delete state.loved
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
