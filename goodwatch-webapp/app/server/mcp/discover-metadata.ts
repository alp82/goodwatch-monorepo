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
			note: "Production country sets, co-productions included (any listed code). Industries and regions are website reference options; MCP has no production-country argument. Only rest_of_world is directly selectable; rating_country does not filter production origin.",
			industries: INDUSTRIES,
			regions: REGIONS,
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
			default: "saved country",
			note: "ISO alpha-2 code for age-rating ladders and badges, independent of streaming country/services and production origin. Codes absent from snapshot ratings fall back to the saved country.",
		},
	}
}
