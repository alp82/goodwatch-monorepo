// PROTOTYPE (Discover lab): the runtime filter as the real Length card writes it. One range in minutes: a movie's
// length, or a show's usual episode length. 240 stands for "4 h and more".
import type { FilterState } from "~/domain/filter-state"

export const LEN_MAX = 240

interface LengthPick {
	label: string
	sub: string
	range: [number, number]
}

/** Length d's big picks, per kind. */
export const MOVIE_PICKS: LengthPick[] = [
	{ label: "Under 90 min", sub: "Quick watch", range: [0, 90] },
	{ label: "Under 2 h", sub: "A regular evening", range: [0, 120] },
	{ label: "Over 2 h", sub: "Settle in", range: [120, LEN_MAX] },
	{ label: "3 h or more", sub: "Epics", range: [180, LEN_MAX] },
]

export const EPISODE_PICKS: LengthPick[] = [
	{ label: "Under 25 min", sub: "Sitcom length", range: [0, 25] },
	{ label: "Under 35 min", sub: "Short episodes", range: [0, 35] },
	{ label: "About 45 min", sub: "35 to 55 min", range: [35, 55] },
	{ label: "An hour or more", sub: "Long episodes", range: [60, LEN_MAX] },
]

export const runtimeOf = ([lo, hi]: [number, number]): FilterState["runtime"] =>
	lo <= 0 && hi >= LEN_MAX ? undefined : { ...(lo > 0 ? { min: lo } : {}), ...(hi < LEN_MAX ? { max: hi } : {}) }

export const isAnyLength = (r: [number, number]) => r[0] <= 0 && r[1] >= LEN_MAX

export const fmtLen = (m: number) =>
	m >= LEN_MAX ? "4 h+" : m <= 0 ? "Any" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`
