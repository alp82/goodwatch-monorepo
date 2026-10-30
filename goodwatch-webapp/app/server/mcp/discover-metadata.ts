import { CONTENT_KINDS } from "../../domain/age-content.ts"
import { THEMES, STYLES } from "../../domain/themes-styles.ts"
import { BIG_EIGHT, INDUSTRIES, REGIONS } from "../../domain/film-industries.ts"
import {
	type FilterRange,
	MIN_MATCHES,
	TAG_GROUPS,
} from "../../domain/filter-state.ts"
import { MOODS } from "../../domain/moods.ts"
import * as scales from "../../domain/title-scales.ts"

/** Public guidance only: every preset supplies existing MCP arguments, never a new argument. */
export function discoverMetadata(
	factsAvailable: boolean,
	now = scales.currentYear(),
) {
	const rangeArgs = (range: FilterRange, min: string, max: string) => ({
		...(range.min === undefined ? {} : { [min]: range.min }),
		...(range.max === undefined ? {} : { [max]: range.max }),
	})
	const range = (
		scale: scales.StopScale,
		presets: readonly { key: string; label: string; range: FilterRange }[],
		min: string,
		max: string,
		unit: string,
	) => ({
		unit,
		min_argument: min,
		max_argument: max,
		steps: scale.stops,
		presets: presets.map(({ key, label, range }) => ({
			key,
			label,
			args: rangeArgs(range, min, max),
		})),
	})
	return {
		filter_groups: [
			{
				name: "Format",
				arguments: ["type", "anime"],
				useful_for:
					"Movies versus shows, anime-only nights, or excluding anime.",
			},
			{
				name: "Search steering",
				arguments: ["similar_to", "more_like", "less_like", "people"],
				useful_for:
					"Hard similarity neighborhoods, temporary taste hints, or titles with selected cast/crew. Resolve title IDs with search_titles/get_title and person IDs with search_people/get_person.",
			},
			{
				name: "Mood and subject",
				arguments: ["moods", "themes", "styles", "genres", "match_all"],
				useful_for:
					"Combine how it feels, what it is about and how it is told. Groups combine with AND; picks within a group use OR unless named in match_all.",
			},
			{
				name: "Where to watch",
				arguments: [
					"streaming_country",
					"on_my_services",
					"providers",
					"any_service",
				],
				useful_for:
					"Your subscriptions, specific providers, any available service, or a trip abroad. These do not change saved settings; saved, explicit, and any-service selections are mutually exclusive.",
			},
			{
				name: "Scores",
				arguments: ["minimum_score", "source_scores", "score_gap"],
				useful_for:
					"A quality floor, source-specific scores, consensus, or critic/audience disagreements. Source thresholds are normalized 0–100.",
			},
			{
				name: "Made in",
				arguments: ["production_countries", "rest_of_world"],
				useful_for:
					"Explore a film industry, region or less represented countries, independently of viewing and rating country.",
			},
			{
				name: "Release",
				arguments: ["released", "min_year", "max_year"],
				useful_for:
					"Recent releases, a decade, or a custom era. Explicit year bounds override a preset.",
			},
			{
				name: "Length",
				arguments: [
					"min_runtime",
					"max_runtime",
					"min_episode_runtime",
					"max_episode_runtime",
					"unlimited_episode_runtime",
				],
				useful_for:
					"Fit a movie into an evening and choose episode length independently; unknown lengths fail bounds unless episodes are explicitly unlimited.",
			},
			{
				name: "Age and content",
				arguments: [
					"rating_country",
					"age_limit",
					"hide_content",
					"show_content",
				],
				useful_for:
					"A country-specific age ceiling and explicit content choices. Showing a content kind never lifts the age ceiling.",
			},
			{
				name: "Popularity",
				arguments: [
					"min_votes",
					"max_votes",
					"min_popularity_rank",
					"max_popularity_rank",
				],
				useful_for:
					"Well-known titles, hidden gems, popular now, or deep cuts. Rating count measures familiarity; rank measures current catalog popularity, with 1 first.",
			},
			{
				name: "Movie finances",
				arguments: [
					"min_budget_musd",
					"max_budget_musd",
					"min_box_office_musd",
					"max_box_office_musd",
					"returns",
				],
				useful_for:
					"Small-budget movies, blockbusters, hits or flops. Money is nominal USD millions, and these filters require known movie facts.",
			},
			{
				name: "Shows",
				arguments: [
					"min_seasons",
					"max_seasons",
					"min_hours",
					"max_hours",
					"show_status",
				],
				useful_for:
					"A short completed show versus a long-running series, using known season, production-status and time-to-finish facts.",
			},
			{
				name: "Your taste and lists",
				arguments: [
					"taste_groups",
					"minimum_match",
					"outside_usual",
					"seen_only",
					"wishlist_only",
					"order",
					"for_you",
					"exclude_seen",
				],
				useful_for:
					"A taste group, familiar territory or a small stretch; unseen titles, Wishlist or rewatches. Taste groups are member-specific options in taste_groups. Filters and hints do not mark titles or save ratings.",
			},
		],
		examples: [
			{
				use_case: "An unseen funny movie under 90 minutes on my services",
				args: {
					type: "movie",
					moods: ["funny"],
					on_my_services: true,
					exclude_seen: true,
					max_runtime: 90,
					minimum_score: 70,
				},
			},
			{
				use_case: "Similar to The Matrix, with a futuristic theme",
				args: { similar_to: ["movie:603"], themes: ["future"], for_you: true },
			},
			{
				use_case:
					"Lean toward Severance and away from The Avengers for this request",
				args: {
					more_like: ["show:95396"],
					less_like: ["movie:24428"],
					order: "match",
				},
			},
			{
				use_case: "Titles featuring Leonardo DiCaprio in cast or crew",
				args: { people: [6193], order: "score" },
			},
			{
				use_case: "Japanese or Korean mysteries from the 1990s",
				args: {
					production_countries: ["JP", "KR"],
					genres: ["Mystery"],
					min_year: 1990,
					max_year: 1999,
				},
			},
			{
				use_case: "Any streaming offer while visiting France",
				args: {
					streaming_country: "FR",
					any_service: true,
					exclude_seen: true,
				},
			},
			{
				use_case: "Hidden gems outside today's popular top ten thousand",
				args: {
					min_votes: 1000,
					max_votes: 9999,
					min_popularity_rank: 10001,
					order: "score",
				},
			},
			{
				use_case: "A short completed show",
				args: {
					type: "show",
					show_status: "ended",
					max_seasons: 2,
					max_hours: 8,
					max_episode_runtime: 35,
				},
			},
			{
				use_case:
					"Movies under two hours while leaving shows unrestricted by episode length",
				args: { max_runtime: 120, unlimited_episode_runtime: true },
			},
			{
				use_case:
					"An age-12 ceiling using German ratings, with explicit content choices",
				args: {
					rating_country: "DE",
					age_limit: 12,
					hide_content: ["sex", "violence"],
					show_content: ["language"],
				},
			},
			{
				use_case: "Critic favorites with a source-score floor",
				args: {
					source_scores: { imdb: 70, rtCritics: 80 },
					score_gap: "critics",
				},
			},
			{
				use_case: "A modest-budget box-office hit",
				args: {
					type: "movie",
					max_budget_musd: 20,
					min_box_office_musd: 50,
					returns: "hit",
				},
			},
			{
				use_case: "A rewatch from my Wishlist just outside my usual taste",
				args: {
					wishlist_only: true,
					seen_only: true,
					outside_usual: true,
					order: "match",
				},
			},
			{
				use_case: "Both funny and tense, with a slow-burn style",
				args: {
					moods: ["funny", "tense"],
					match_all: ["moods"],
					styles: ["slow"],
				},
			},
		],
		themes: THEMES.map(({ id, name }) => ({ key: id, name })),
		styles: STYLES.map(({ id, name }) => ({ key: id, name })),
		content: {
			kinds: CONTENT_KINDS,
			note: "hide_content wins for overlaps; otherwise explicit overrides win over age defaults.",
		},
		facts_available: factsAvailable,
		facts_note:
			"Without facts, budget, box office, returns, seasons, show_status and hours do not narrow results. With facts, unknown values fail active bounds; money/returns apply to movies, seasons/status/hours to shows.",
		range_note:
			"All bounds are inclusive; omitted bounds are open. Steps and presets are suggestions, not argument restrictions. Preset args replace previous arguments in that group. The final slider stop represents an open upper end.",
		scores: {
			minimum_score: { steps: scales.GOODWATCH_SCORE_STEPS, unit: "0–100" },
			source_scores: {
				unit: "normalized 0–100 integers",
				note: "All selected sources must pass; missing scores fail even at zero.",
				sources: scales.SCORE_SOURCES.map(({ key, name, notation }) => ({
					key,
					name,
					notation,
					steps: scales.SOURCE_SCORE_STEPS.map((value) => ({
						value,
						label: scales.formatSourceStep(notation, value),
					})),
				})),
			},
		},
		votes: {
			...range(
				scales.VOTES_SCALE,
				scales.VOTES_PRESETS,
				"min_votes",
				"max_votes",
				"rating count",
			),
			eligibility_min: 1000,
		},
		popularity_rank: {
			...range(
				scales.RANK_SCALE,
				scales.RANK_PRESETS,
				"min_popularity_rank",
				"max_popularity_rank",
				"catalog Popular rank; 1 first",
			),
			note: "Shared across viewers and filters; refreshed with the snapshot. Unranked titles fail active bounds.",
		},
		budget: range(
			scales.BUDGET_SCALE,
			scales.BUDGET_PRESETS,
			"min_budget_musd",
			"max_budget_musd",
			"nominal USD millions",
		),
		box_office: range(
			scales.BOX_OFFICE_SCALE,
			scales.BOX_OFFICE_PRESETS,
			"min_box_office_musd",
			"max_box_office_musd",
			"nominal USD millions",
		),
		returns: scales.RETURNS_LABELS,
		seasons: range(
			scales.SEASONS_SCALE,
			scales.SEASONS_PRESETS,
			"min_seasons",
			"max_seasons",
			"seasons",
		),
		time_to_finish: range(
			scales.HOURS_SCALE,
			scales.HOURS_PRESETS,
			"min_hours",
			"max_hours",
			"total hours: episodes × episode minutes / 60",
		),
		show_status: scales.SHOW_STATUS_LABELS,
		released: {
			current_year: now,
			note: "Last N years starts at current_year minus N, including that year and the current year; Last 2 years is released=recent. Current-year upper ends are open, as on Discover.",
			presets: [
				{ key: "any", label: "Any time", args: { released: "any" } },
				...scales.newYearPresets(now).map(({ key, label, years }) => ({
					key,
					label,
					args:
						key === "last-2"
							? { released: "recent" }
							: rangeArgs(years, "min_year", "max_year"),
				})),
				...scales.decadeStarts(now).map((start) => ({
					key: `${start}s`,
					label: scales.decadeLabel(start),
					args: rangeArgs(
						scales.decadeYears(start, now),
						"min_year",
						"max_year",
					),
				})),
				...scales.afterYearPresets(now).map(({ key, label, years }) => ({
					key,
					label,
					args: rangeArgs(years, "min_year", "max_year"),
				})),
				{
					key: "before2000",
					label: "Before 2000",
					args: { released: "before2000" },
				},
			],
		},
		length: {
			unit: "minutes",
			step: scales.LENGTH_STEP,
			slider_max: scales.LENGTH_MAX,
			note: "Runtime alone covers movies and usual show episode length. Supplying either episode bound makes runtime movie-only; episode bounds are independent. Unknown lengths fail active bounds.",
			movies: range(
				{ stops: [], format: String },
				scales.MOVIE_LENGTH_PRESETS,
				"min_runtime",
				"max_runtime",
				"minutes",
			),
			episodes: range(
				{ stops: [], format: String },
				scales.EPISODE_LENGTH_PRESETS,
				"min_episode_runtime",
				"max_episode_runtime",
				"minutes",
			),
		},
		origin: {
			note: "Production country sets, co-productions included (any listed code). Pass production_countries directly, or use args from an industry or region. rest_of_world joins country picks with OR. streaming_country and rating_country do not select production origin.",
			industries: INDUSTRIES.map((option) => ({
				...option,
				args: { production_countries: option.codes },
			})),
			regions: REGIONS.map((option) => ({
				...option,
				args: { production_countries: option.codes },
			})),
			rest_of_world: {
				name: "Rest of the world",
				excluded_codes: BIG_EIGHT,
				args: { rest_of_world: true },
				note: "At least one production country outside excluded_codes.",
			},
		},
		moods: MOODS.map(({ key, name, aliases }) => ({ key, name, aliases })),
		moods_note:
			"Pass stable keys, up to three. Aliases are previous names recognized in descriptive search, not extra argument values.",
		match: {
			minimum_match: MIN_MATCHES,
			outside_usual: {
				label: "Outside your usual",
				args: { outside_usual: true },
				min: 50,
				max: 59,
			},
			note: "Requires member taste; otherwise does not narrow. outside_usual supersedes minimum_match; 0 means no minimum.",
		},
		list_filters: {
			seen_only:
				"Seen before; requires a member; mutually exclusive with exclude_seen=true.",
			wishlist_only:
				"On your Wishlist; requires a member; combines with either seen choice.",
		},
		match_all: {
			groups: TAG_GROUPS,
			note: "Require every pick within each named group; other groups match any pick. Ignored with fewer than two distinct picks.",
		},
		rating_country: {
			default: "streaming_country or saved country",
			note: "ISO alpha-2 code for age-rating ladders and badges, independent of streaming country/services and production origin. Codes absent from snapshot ratings fall back to the viewing country (saved country by default).",
		},
	}
}
