// PROTOTYPE (Discover lab): the runtime filter as the real Length card writes it. One range in minutes: a movie's
// length, or a show's usual episode length. 240 stands for "4 h and more".
import type { FilterRange, FilterState } from "~/domain/filter-state"
import type { ProtoDiscover } from "../../../kit"

export const LEN_MAX = 240

export const lengthRange = (s: FilterState): [number, number] => [s.runtime?.min ?? 0, s.runtime?.max ?? LEN_MAX]

export const runtimeOf = ([lo, hi]: [number, number]): FilterState["runtime"] =>
	lo <= 0 && hi >= LEN_MAX ? undefined : { ...(lo > 0 ? { min: lo } : {}), ...(hi < LEN_MAX ? { max: hi } : {}) }

/** The range as a runtime filter for counting; {} for any length. */
export const asRange = (r: [number, number]): FilterRange => runtimeOf(r) ?? {}

// One range for both kinds (a, b, c): drops d's separate episode range.
export const setLength = (d: ProtoDiscover, r: [number, number]) => d.filters.set({ runtime: runtimeOf(r), episodeRuntime: undefined })

export const isAnyLength = (r: [number, number]) => r[0] <= 0 && r[1] >= LEN_MAX

export function toggleLength(d: ProtoDiscover, r: [number, number]) {
	const cur = lengthRange(d.filters.state)
	setLength(d, cur[0] === r[0] && cur[1] === r[1] ? [0, LEN_MAX] : r)
}

export const fmtLen = (m: number) =>
	m >= LEN_MAX ? "4 h+" : m <= 0 ? "Any" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`
