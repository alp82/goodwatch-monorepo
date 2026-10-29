// What the Popularity, Shows and Budget sub-tabs write and count. Pure, no React.
//
// Each range choice has a stepped slider over its scale's stops (title-scales.ts). A slider span [lo, hi] holds the
// values from stop lo up to stop hi; hi at the last stop is open ended. A span that is a preset writes the preset's own
// range, so its tile lights; any other span writes its stops, with the upper one just left out.
//
// Counts: popularity's keys count a minimum (`votes:<stop>`, titles with at least that many ratings) or a preset
// (`votes:<preset key>`); budget's and shows' keys count a bucket between neighboring stops (`budget:<i>`), the last
// bucket open ended. Without counts every count is null.
import type { FilterRange, FilterState } from "~/domain/filter-state"
import {
	BOX_OFFICE_PRESETS,
	BOX_OFFICE_SCALE,
	BUDGET_PRESETS,
	BUDGET_SCALE,
	HOURS_PRESETS,
	HOURS_SCALE,
	POPULARITY_RANK_PRESETS,
	RANK_SCALE,
	type RangePreset,
	SEASONS_PRESETS,
	SEASONS_SCALE,
	VOTES_PRESETS,
	VOTES_SCALE,
	formatMoney,
	sameRange,
} from "~/domain/title-scales"

export type SteppedField =
	| "votes"
	| "popularityRank"
	| "budget"
	| "boxOffice"
	| "seasons"
	| "hours"

/** A slider span as indexes into the scale's stops; the last stop is open ended. */
export type StopSpan = [number, number]

export interface SteppedPreset {
	key: string
	label: string
	note: string
	range: FilterRange
}

interface SteppedScale {
	field: SteppedField
	/** The optionCounts group and the key prefix. */
	group: "popularity" | "budget" | "shows"
	prefix: string
	stops: readonly number[]
	/** The smallest step between values: an upper stop writes `stop - unit`. */
	unit: number
	presets: readonly SteppedPreset[]
	/** A stop's label at the slider's ends. */
	stopLabel: (i: number) => string
	/** The upper handle's label, when it differs (Seasons: the last season the span keeps). */
	hiLabel?: (i: number) => string
	/** The span as one label ("Under 10K", "#1K to #10K"). */
	spanLabel: (span: StopSpan) => string
}

const short = (n: number) =>
	n >= 1e6 ? `${n / 1e6}M` : n >= 1e3 ? `${n / 1e3}K` : String(n)

/** Labels for a scale whose first stop reads Any and whose last reads "N+". */
function openLabels(
	stops: readonly number[],
	format: (n: number) => string,
	unit = "",
) {
	const last = stops.length - 1
	return {
		stopLabel: (i: number) =>
			i <= 0
				? "Any"
				: i >= last
					? `${format(stops[i])}${unit}+`
					: `${format(stops[i])}${unit}`,
		spanLabel: ([lo, hi]: StopSpan) => {
			if (hi >= last) return `${format(stops[lo])}${unit}+`
			if (lo <= 0) return `Under ${format(stops[hi])}${unit}`
			return `${format(stops[lo])} to ${format(stops[hi])}${unit}`
		},
	}
}

const presetsOf = (list: readonly RangePreset[]): SteppedPreset[] =>
	list.map(({ key, label, note, range }) => ({ key, label, note, range }))

const VOTES_NOTES: Record<string, string> = {
	hiddenGems: "Under 10K ratings",
	knownToFans: "10K to 100K",
	wellKnown: "100K+ ratings",
	everyone: "1M+ ratings",
}
const RANK_NOTES: Record<string, string> = {
	popularNow: "Top 1,000",
	underTheRadar: "#1K to #10K",
	deepCuts: "Past #10K",
}

const rankStops = RANK_SCALE.stops
const seasonStops = SEASONS_SCALE.stops

export const STEPPED: Record<SteppedField, SteppedScale> = {
	votes: {
		field: "votes",
		group: "popularity",
		prefix: "votes",
		stops: VOTES_SCALE.stops,
		unit: 1,
		presets: VOTES_PRESETS.map((p) => ({ ...p, note: VOTES_NOTES[p.key] })),
		...openLabels(VOTES_SCALE.stops, short),
	},
	popularityRank: {
		field: "popularityRank",
		group: "popularity",
		prefix: "rank",
		stops: rankStops,
		unit: 1,
		presets: POPULARITY_RANK_PRESETS.map((p) => ({
			...p,
			note: RANK_NOTES[p.key],
		})),
		stopLabel: (i) =>
			i >= rankStops.length - 1
				? `${RANK_SCALE.format(rankStops[i])}+`
				: RANK_SCALE.format(rankStops[i]),
		spanLabel: ([lo, hi]) => {
			if (hi >= rankStops.length - 1)
				return `Past ${RANK_SCALE.format(rankStops[lo])}`
			if (lo <= 0) return `Top ${short(rankStops[hi])}`
			return `${RANK_SCALE.format(rankStops[lo])} to ${RANK_SCALE.format(rankStops[hi])}`
		},
	},
	budget: {
		field: "budget",
		group: "budget",
		prefix: "budget",
		stops: BUDGET_SCALE.stops,
		unit: 0.001,
		presets: presetsOf(BUDGET_PRESETS),
		...openLabels(BUDGET_SCALE.stops, formatMoney),
	},
	boxOffice: {
		field: "boxOffice",
		group: "budget",
		prefix: "boxOffice",
		stops: BOX_OFFICE_SCALE.stops,
		unit: 0.001,
		presets: presetsOf(BOX_OFFICE_PRESETS),
		...openLabels(BOX_OFFICE_SCALE.stops, formatMoney),
	},
	seasons: {
		field: "seasons",
		group: "shows",
		prefix: "seasons",
		stops: seasonStops,
		unit: 1,
		presets: presetsOf(SEASONS_PRESETS),
		// The upper handle reads the last season it keeps: 1 to 2 keeps one season.
		stopLabel: (i) =>
			i >= seasonStops.length - 1
				? `${seasonStops[i]}+`
				: String(seasonStops[i]),
		hiLabel: (i) =>
			i >= seasonStops.length - 1
				? `${seasonStops[i]}+`
				: String(seasonStops[i] - 1),
		spanLabel: ([lo, hi]) => {
			const from = seasonStops[lo]
			if (hi >= seasonStops.length - 1) return `${from}+ seasons`
			const to = seasonStops[hi] - 1
			if (to === from) return from === 1 ? "1 season" : `${from} seasons`
			return `${from} to ${to} seasons`
		},
	},
	hours: {
		field: "hours",
		group: "shows",
		prefix: "hours",
		stops: HOURS_SCALE.stops,
		unit: 1 / 60,
		presets: presetsOf(HOURS_PRESETS),
		...openLabels(HOURS_SCALE.stops, String, " h"),
	},
}

const last = (field: SteppedField) => STEPPED[field].stops.length - 1

const isSet = (range: FilterRange | undefined): range is FilterRange =>
	Boolean(range && (range.min !== undefined || range.max !== undefined))

/** The index of the stop nearest to a value. */
function nearestStop(stops: readonly number[], value: number): number {
	let best = 0
	for (let i = 1; i < stops.length; i++)
		if (Math.abs(stops[i] - value) < Math.abs(stops[best] - value)) best = i
	return best
}

/** The slider span a range reads as: its ends at the nearest stops. Any is the whole scale. */
export function rangeSpan(
	field: SteppedField,
	range: FilterRange | undefined,
): StopSpan {
	const { stops, unit } = STEPPED[field]
	const n = last(field)
	if (!isSet(range)) return [0, n]
	const lo = range.min === undefined ? 0 : nearestStop(stops, range.min)
	const hi = range.max === undefined ? n : nearestStop(stops, range.max + unit)
	return hi > lo ? [lo, hi] : [lo, Math.min(n, lo + 1)]
}

/** The range a slider span writes: a preset's own range when the span is one, undefined for the whole scale. */
export function spanRange(
	field: SteppedField,
	[lo, hi]: StopSpan,
): FilterRange | undefined {
	const { stops, unit, presets } = STEPPED[field]
	const n = last(field)
	if (lo <= 0 && hi >= n) return undefined
	const preset = presets.find((p) => {
		const [a, b] = rangeSpan(field, p.range)
		return a === lo && b === hi
	})
	if (preset) return preset.range
	return {
		...(lo > 0 ? { min: stops[lo] } : {}),
		...(hi < n ? { max: stops[hi] - unit } : {}),
	}
}

/** The field's range; undefined for any. */
export const fieldRange = (
	state: FilterState,
	field: SteppedField,
): FilterRange | undefined => {
	const range = state[field]
	return isSet(range) ? range : undefined
}

/** A preset tile: on, or off again when it is already the field's range. */
export function togglePreset(
	state: FilterState,
	field: SteppedField,
	range: FilterRange,
): FilterState {
	return {
		...state,
		[field]: sameRange(fieldRange(state, field), range) ? undefined : range,
	}
}

/** Whether a range is a preset of the field (so the tile lights). */
export const isPreset = (
	field: SteppedField,
	range: FilterRange | undefined,
	preset: SteppedPreset,
) => sameRange(range, preset.range)

type Counts = Record<string, number> | null | undefined

/** Titles in a slider span. */
export function spanCount(
	field: SteppedField,
	counts: Counts,
	[lo, hi]: StopSpan,
): number | null {
	if (!counts) return null
	const { stops, prefix, group } = STEPPED[field]
	const n = last(field)
	if (group === "popularity") {
		// Minimum counts: the span is "at least stop lo" minus "at least stop hi".
		const atLeast = (i: number) => counts[`${prefix}:${stops[i]}`] ?? 0
		const from =
			lo <= 0 && hi >= n ? (counts[`${prefix}:any`] ?? 0) : atLeast(lo)
		return hi >= n ? from : Math.max(0, from - atLeast(hi))
	}
	let sum = 0
	for (let i = lo; i < (hi >= n ? n + 1 : hi); i++)
		sum += counts[`${prefix}:${i}`] ?? 0
	return sum
}

/** Titles a preset tile would show. */
export function presetCount(
	field: SteppedField,
	counts: Counts,
	preset: SteppedPreset,
): number | null {
	if (!counts) return null
	const { group, prefix } = STEPPED[field]
	if (group === "popularity") return counts[`${prefix}:${preset.key}`] ?? null
	return spanCount(field, counts, rangeSpan(field, preset.range))
}

/** Titles with the fact known (every bucket). */
export const knownCount = (field: SteppedField, counts: Counts) =>
	spanCount(field, counts, [0, last(field)])

/**
 * Budget's heading: "N of M movies here have a budget". M is the list's movies, known only while the budget block has
 * no choice (with one, the list holds only movies with the fact). Null without counts.
 */
export function factNote(
	fact: "budget" | "boxOffice",
	budget: Counts,
	movies: number | null,
	blockSet: boolean,
): string | null {
	const known = budget?.[`known:${fact}`]
	if (known === undefined || known === null) return null
	const what = fact === "budget" ? "a budget" : "a box office"
	const verb = known === 1 ? "has" : "have"
	const n = known.toLocaleString("en-US")
	if (blockSet || movies === null)
		return `${n} ${known === 1 ? "movie" : "movies"} here ${verb} ${what}`
	return `${n} of ${movies.toLocaleString("en-US")} movies here ${verb} ${what}`
}

/**
 * How strong a preset reads (its glow and glyph): 1 to 4 of 4, from smallest to biggest. Popularity's presets run from
 * the most popular down, so Popular now is the strongest.
 */
export const presetStrength = (field: SteppedField, i: number) => {
	const n = STEPPED[field].presets.length
	return field === "popularityRank" ? (n - i) / n : (i + 1) / n
}
