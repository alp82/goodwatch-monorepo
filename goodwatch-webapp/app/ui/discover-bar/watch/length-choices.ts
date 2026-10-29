// What the Length sub-tab writes to the filter state and the counts it shows. Pure, no React.
//
// Movies use `runtime`, episodes `episodeRuntime`. Without `episodeRuntime` the one `runtime` holds for both kinds (old
// links and MCP), so setting one kind writes the other's range out as it was: a movie range never limits episodes.
import type { FilterRange, FilterState } from "~/domain/filter-state"
import { LENGTH_MAX, LENGTH_STEP, lengthRange } from "~/domain/title-scales"

export type LengthKind = "movie" | "episode"
export type LengthSpan = [number, number]

type LengthState = Pick<FilterState, "runtime" | "episodeRuntime">

const isSet = (range: FilterRange | null | undefined): range is FilterRange =>
	Boolean(range && (range.min !== undefined || range.max !== undefined))

/** The range a kind holds; undefined for any length. */
export function kindRange(
	state: LengthState,
	kind: LengthKind,
): FilterRange | undefined {
	const range =
		kind === "movie" || state.episodeRuntime === undefined
			? state.runtime
			: state.episodeRuntime
	return isSet(range) ? range : undefined
}

/** A range as a slider span, 0 to LENGTH_MAX. */
export const lengthSpan = (range: FilterRange | undefined): LengthSpan => [
	range?.min ?? 0,
	range?.max ?? LENGTH_MAX,
]

/** A slider span as a range; undefined for any length. */
export function spanRange([min, max]: LengthSpan): FilterRange | undefined {
	const range = lengthRange(min, max)
	return isSet(range) ? range : undefined
}

const same = (a: FilterRange | undefined, b: FilterRange | undefined) =>
	(a?.min ?? null) === (b?.min ?? null) && (a?.max ?? null) === (b?.max ?? null)

/** One kind's range; the other kind keeps its own. Equal ranges write `runtime` alone. */
export function lengthPatch(
	state: LengthState,
	kind: LengthKind,
	range: FilterRange | undefined,
): LengthState {
	const next = isSet(range) ? range : undefined
	const movie = kind === "movie" ? next : kindRange(state, "movie")
	const episode = kind === "episode" ? next : kindRange(state, "episode")
	return {
		runtime: movie,
		episodeRuntime: same(movie, episode) ? undefined : (episode ?? null),
	}
}

/** A tile: on, or off again (any length) when it is already the kind's range. */
export const toggleLengthPatch = (
	state: LengthState,
	kind: LengthKind,
	range: FilterRange,
): LengthState =>
	lengthPatch(
		state,
		kind,
		same(kindRange(state, kind), range) ? undefined : range,
	)

/**
 * Titles of a kind with a length in the range, summed from `optionCounts.runtime` (`<kind>:<5 min bucket>`, 240 holds
 * every longer one, and `<kind>:unknown`). A bucket counts when its start is in the range, so a bound like 90 counts
 * 90 to 94 with it. Unknown lengths count only for any length. Null without counts.
 */
export function lengthCount(
	runtime: Record<string, number> | null | undefined,
	kind: LengthKind,
	range: FilterRange | undefined,
): number | null {
	if (!runtime) return null
	const min = range?.min ?? 0
	const max = range?.max ?? Number.POSITIVE_INFINITY
	let sum = isSet(range) ? 0 : (runtime[`${kind}:unknown`] ?? 0)
	for (let start = 0; start <= LENGTH_MAX; start += LENGTH_STEP)
		if (start + LENGTH_STEP - 1 >= min && start <= max)
			sum += runtime[`${kind}:${start}`] ?? 0
	return sum
}

/** "90 min", "2 h 30"; the slider's ends read "Any" and "4 h+". */
export function formatLength(minutes: number): string {
	if (minutes >= LENGTH_MAX) return "4 h+"
	if (minutes <= 0) return "Any"
	if (minutes < 60) return `${minutes} min`
	const hours = Math.floor(minutes / 60)
	return minutes % 60 ? `${hours} h ${minutes % 60}` : `${hours} h`
}
