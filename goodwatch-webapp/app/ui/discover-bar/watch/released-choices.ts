// What the Released sub-tab writes to the filter state and the counts it shows. Pure, no React.
//
// A year span is [from, to] with YEAR_MIN standing for no lower end and the current year for no upper end. Every write
// goes through yearsChoice, so a span that equals a Released preset writes the preset.
import type { FilterRange, FilterState } from "~/domain/filter-state"
import {
	YEAR_MIN,
	decadeStarts,
	releasedYears,
	yearRange,
	yearsChoice,
} from "~/domain/title-scales"

export type YearSpan = [number, number]

type YearsPatch = Pick<FilterState, "released" | "years">

/** A range as a span, its open ends at YEAR_MIN and `now`. */
export const spanOf = (range: FilterRange, now: number): YearSpan => [
	Math.max(YEAR_MIN, range.min ?? YEAR_MIN),
	Math.min(now, range.max ?? now),
]

/** The span the state picks: `years`, else its Released preset. */
export const yearSpan = (
	state: Pick<FilterState, "released" | "years">,
	now: number,
): YearSpan => spanOf(state.years ?? releasedYears(state.released, now), now)

export const sameSpan = (a: YearSpan, b: YearSpan) =>
	a[0] === b[0] && a[1] === b[1]

/** Whether a span is every year. */
export const anyYear = (span: YearSpan, now: number) =>
	span[0] <= YEAR_MIN && span[1] >= now

/** The state of a span. */
export function yearsPatch([from, to]: YearSpan, now: number): YearsPatch {
	return yearsChoice(
		yearRange(Math.min(from, to), Math.max(from, to), now),
		now,
	)
}

export const anyYearPatch = (): YearsPatch => ({
	released: "any",
	years: undefined,
})

/** A preset tile: on, or off again (every year) when it is already the span. */
export function togglePresetPatch(
	state: Pick<FilterState, "released" | "years">,
	range: FilterRange,
	now: number,
): YearsPatch {
	const span = spanOf(range, now)
	return sameSpan(yearSpan(state, now), span)
		? anyYearPatch()
		: yearsPatch(span, now)
}

/** The last year of a decade, the current year for the current decade. */
export const decadeEnd = (start: number, now: number) =>
	Math.min(start + 9, now)

/** The decades a span covers exactly, as [first, last] decade starts; null when it isn't whole decades or is every year. */
export function decadeSpan(
	span: YearSpan,
	now: number,
): [number, number] | null {
	const [from, to] = span
	if (anyYear(span, now)) return null
	if (from % 10 !== 0) return null
	if (to !== now && to % 10 !== 9) return null
	return [from, to === now ? Math.floor(now / 10) * 10 : to - 9]
}

/**
 * A tap on a decade: picks it alone, widens the span from a neighbor, narrows it from an end, or clears it when it is
 * the lone pick.
 */
export function tapDecadePatch(
	state: Pick<FilterState, "released" | "years">,
	start: number,
	now: number,
): YearsPatch {
	const decade: YearSpan = [start, decadeEnd(start, now)]
	const span = decadeSpan(yearSpan(state, now), now)
	if (!span) return yearsPatch(decade, now)
	const [first, last] = span
	if (first === last && first === start) return anyYearPatch()
	if (start === first - 10)
		return yearsPatch([start, decadeEnd(last, now)], now)
	if (start === last + 10) return yearsPatch([first, decade[1]], now)
	if (start === first && last > first)
		return yearsPatch([first + 10, decadeEnd(last, now)], now)
	if (start === last && last > first)
		return yearsPatch([first, decadeEnd(last - 10, now)], now)
	return yearsPatch(decade, now)
}

/** A drag across decades: one decade is a tap, more pick their whole span. */
export function dragDecadesPatch(
	state: Pick<FilterState, "released" | "years">,
	a: number,
	b: number,
	now: number,
): YearsPatch {
	if (a === b) return tapDecadePatch(state, a, now)
	const first = Math.min(a, b)
	const last = Math.max(a, b)
	return yearsPatch([first, decadeEnd(last, now)], now)
}

/** Whether a decade overlaps the span. */
export const decadeInSpan = (start: number, span: YearSpan, now: number) =>
	start <= span[1] && decadeEnd(start, now) >= span[0]

/**
 * Titles released in a range, summed from `optionCounts.years` (per year). An open lower end takes in every year
 * before YEAR_MIN too. Null without counts.
 */
export function yearsCount(
	years: Record<string, number> | null | undefined,
	range: FilterRange,
): number | null {
	if (!years) return null
	const min = range.min ?? Number.NEGATIVE_INFINITY
	const max = range.max ?? Number.POSITIVE_INFINITY
	let sum = 0
	for (const [year, n] of Object.entries(years)) {
		const y = Number(year)
		if (y >= min && y <= max) sum += n
	}
	return sum
}

/** Each decade's count, oldest first, the 1920s with every year before them. */
export const decadeCounts = (
	years: Record<string, number> | null | undefined,
	now: number,
): { start: number; count: number | null }[] =>
	decadeStarts(now).map((start) => ({
		start,
		count: yearsCount(years, yearRange(start, decadeEnd(start, now), now)),
	}))

/** The id of a New or After preset in the panel's `part=released` answer. */
export const PANEL_PRESET_IDS: Record<string, string> = {
	"last-1": "thisYear",
	"last-2": "recent",
	"last-3": "last3Years",
	"last-5": "last5Years",
	"after-2000": "after2000",
	"after-1950": "after1950",
}

/** A decade's id in the panel's `part=released` answer. */
export const panelDecadeId = (start: number) => `decade:${start}`

/** Keep ranked search candidates, sorting and other filters; pictures span all years and pages. */
export function releasedPanelQuery(query: string): string {
	const params = new URLSearchParams(query)
	for (const name of ["years", "released", "minYear", "maxYear", "page"])
		params.delete(name)
	params.set("part", "released")
	return params.toString()
}
