import {
	type FilterRange,
	MIN_SCORES,
	type Released,
	type SourceKey,
} from "./filter-state"

/** Normalized percentages shared by source-score controls and Find presets. */
export const SCORE_STEPS = [60, 70, 80, 90] as const

/** Display any normalized threshold, including values from older URLs, in the source's notation. */
export function scoreStepLabel(source: SourceKey, score: number): string {
	switch (source) {
		case "imdb":
		case "metacriticUsers":
			return `${(score / 10).toFixed(1)}+`
		case "rtCritics":
		case "rtAudience":
			return `${score}%+`
		case "metacritic":
			return `${score}+`
	}
}

/** Slider stops; the final stop is open ended. Numeric ranges are inclusive. */
export const VOTES_STEPS = [
	1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000,
	2000000,
] as const
export const POPULARITY_RANK_STEPS = [
	1, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 40000,
] as const

export const VOTES_PRESETS = [
	{ key: "hiddenGems", label: "Hidden gems", range: { max: 9999 } },
	{
		key: "knownToFans",
		label: "Known to fans",
		range: { min: 10000, max: 99999 },
	},
	{ key: "wellKnown", label: "Well known", range: { min: 100000 } },
	{ key: "everyone", label: "Everyone's seen it", range: { min: 1000000 } },
] as const
export const POPULARITY_RANK_PRESETS = [
	{ key: "popularNow", label: "Popular now", range: { max: 1000 } },
	{
		key: "underTheRadar",
		label: "Under the radar",
		range: { min: 1001, max: 10000 },
	},
	{ key: "deepCuts", label: "Deep cuts", range: { min: 10001 } },
] as const

/** Counts use these keys under optionCounts.popularity; a stop counts a minimum with no upper bound. */
export const POPULARITY_OPTIONS = [
	...VOTES_PRESETS.map((p) => ({
		key: `votes:${p.key}`,
		field: "votes" as const,
		range: p.range,
	})),
	...POPULARITY_RANK_PRESETS.map((p) => ({
		key: `rank:${p.key}`,
		field: "popularityRank" as const,
		range: p.range,
	})),
	...VOTES_STEPS.map((min) => ({
		key: `votes:${min}`,
		field: "votes" as const,
		range: { min },
	})),
	...POPULARITY_RANK_STEPS.map((min) => ({
		key: `rank:${min}`,
		field: "popularityRank" as const,
		range: { min },
	})),
	{ key: "votes:any", field: "votes" as const, range: {} },
	{ key: "rank:any", field: "popularityRank" as const, range: {} },
]

// ---------------------------------------------------------------------------------------------------------------
// Released

/** The first year the Released tab offers; a range that starts here has no lower end. */
export const YEAR_MIN = 1920

/** The current year, the upper end of every year range. */
export const currentYear = (now = new Date()) => now.getUTCFullYear()

/** A year range with its open ends left out: a lower end at YEAR_MIN or earlier, an upper end at `now` or later. */
export function yearRange(min: number, max: number, now: number): FilterRange {
	return {
		...(min > YEAR_MIN ? { min } : {}),
		...(max < now ? { max } : {}),
	}
}

/** The years of a decade, up to the current year: the 2020s are 2020 to now. */
export const decadeYears = (start: number, now: number): FilterRange =>
	yearRange(start, Math.min(start + 9, now), now)

/** "The 1990s". */
export const decadeLabel = (start: number) => `The ${start}s`

/** The decades the timeline shows, oldest first: the 1920s to the current decade. */
export const decadeStarts = (now: number): number[] =>
	Array.from(
		{ length: Math.floor(now / 10) - YEAR_MIN / 10 + 1 },
		(_, i) => YEAR_MIN + i * 10,
	)

/**
 * The years of a Released preset. "recent" is the current year and the two before it, as the title filter reads it,
 * so it is the Last 3 years tile.
 */
export function releasedYears(released: Released, now: number): FilterRange {
	switch (released) {
		case "recent":
			return yearRange(now - 2, now, now)
		case "2010s":
			return yearRange(2010, 2019, now)
		case "2000s":
			return yearRange(2000, 2009, now)
		case "before2000":
			return yearRange(YEAR_MIN, 1999, now)
		case "any":
			return {}
	}
}

/**
 * The filter state a year range writes: a Released preset when the range is one, else `years`. Old links keep their
 * preset, and a tile that equals a preset writes the preset.
 */
export function yearsChoice(
	range: FilterRange,
	now: number,
): { released: Released; years: FilterRange | undefined } {
	const open = yearRange(range.min ?? YEAR_MIN, range.max ?? now, now)
	for (const released of ["recent", "2010s", "2000s", "before2000"] as const)
		if (sameRange(releasedYears(released, now), open))
			return { released, years: undefined }
	return {
		released: "any",
		years: open.min === undefined && open.max === undefined ? undefined : open,
	}
}

export interface YearPreset {
	key: string
	label: string
	years: FilterRange
}

/**
 * The New tiles: This year, then Last 2, 3 and 5 years. "Last N years" is the current year and the N - 1 before it,
 * so Last 3 years is the "recent" preset.
 */
export const newYearPresets = (now: number): YearPreset[] =>
	[1, 2, 3, 5].map((n) => ({
		key: `last-${n}`,
		label: n === 1 ? "This year" : `Last ${n} years`,
		years: yearRange(now - n + 1, now, now),
	}))

/** The After chips. */
export const afterYearPresets = (now: number): YearPreset[] =>
	[2000, 1950].map((year) => ({
		key: `after-${year}`,
		label: `After ${year}`,
		years: yearRange(year, now, now),
	}))

// ---------------------------------------------------------------------------------------------------------------
// Length

/** The longest length the sliders show; it stands for "4 h or more". */
export const LENGTH_MAX = 240
/** The sliders' step in minutes. */
export const LENGTH_STEP = 5

/** "90 min", "2 h", "2 h 30". */
export function formatMinutes(minutes: number): string {
	if (minutes < 120 && minutes % 60 !== 0) return `${minutes} min`
	const hours = Math.floor(minutes / 60)
	return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60}`
}

export interface RangePreset {
	key: string
	label: string
	/** A quiet second line. */
	note: string
	range: FilterRange
}

/** The Movies block's tiles. */
export const MOVIE_LENGTH_PRESETS: readonly RangePreset[] = [
	{
		key: "under-90",
		label: "Under 90 min",
		note: "Quick watch",
		range: { max: 90 },
	},
	{
		key: "under-120",
		label: "Under 2 h",
		note: "A regular evening",
		range: { max: 120 },
	},
	{
		key: "over-120",
		label: "Over 2 h",
		note: "Settle in",
		range: { min: 120 },
	},
	{
		key: "over-180",
		label: "3 h or more",
		note: "Epics",
		range: { min: 180 },
	},
]

/** The Episodes block's tiles. */
export const EPISODE_LENGTH_PRESETS: readonly RangePreset[] = [
	{
		key: "under-25",
		label: "Under 25 min",
		note: "Sitcom length",
		range: { max: 25 },
	},
	{
		key: "under-35",
		label: "Under 35 min",
		note: "Short episodes",
		range: { max: 35 },
	},
	{
		key: "about-45",
		label: "About 45 min",
		note: "35 to 55 min",
		range: { min: 35, max: 55 },
	},
	{
		key: "over-60",
		label: "An hour or more",
		note: "Long episodes",
		range: { min: 60 },
	},
]

/** A length range with its open ends left out: no lower end at 0, no upper end at LENGTH_MAX. */
export const lengthRange = (min: number, max: number): FilterRange => ({
	...(min > 0 ? { min } : {}),
	...(max < LENGTH_MAX ? { max } : {}),
})

// ---------------------------------------------------------------------------------------------------------------
// Scores

/** The GoodWatch score's steps, without Any. */
export const GOODWATCH_SCORE_STEPS: readonly number[] = MIN_SCORES.filter(
	(step) => step > 0,
)

/**
 * Every source's steps, on the 0 to 100 the filter stores: IMDb 7.0+ is 70, like Tomatometer 70%+ and Metascore 70+.
 * Old URLs with other values (`imdb:65`) keep working and show as their own chip.
 */
export const SOURCE_SCORE_STEPS: readonly number[] = SCORE_STEPS

/** A score source supported by the title filter. */
export type ScoreSource = SourceKey

export interface ScoreSourceInfo {
	key: ScoreSource
	name: string
	/** How the source writes its scores: out of 10 (8.0), as a percentage (80%), or out of 100 (80). */
	notation: "ten" | "percent" | "hundred"
	/** Further words Find finds the source by. */
	words: string
}

/** The sources in the Scores tab's order. */
export const SCORE_SOURCES: readonly ScoreSourceInfo[] = [
	{ key: "imdb", name: "IMDb", notation: "ten", words: "imdb audience" },
	{
		key: "rtCritics",
		name: "Tomatometer",
		notation: "percent",
		words: "rotten tomatoes critics",
	},
	{
		key: "rtAudience",
		name: "Popcornmeter",
		notation: "percent",
		words: "rotten tomatoes audience",
	},
	{
		key: "metacritic",
		name: "Metascore",
		notation: "hundred",
		words: "metacritic critics",
	},
	{
		key: "metacriticUsers",
		name: "Metacritic user score",
		notation: "ten",
		words: "metacritic users audience",
	},
]

/** A step in its source's notation, with the plus: "8.0+", "80%+", "80+". */
export function formatSourceStep(
	notation: ScoreSourceInfo["notation"],
	step: number,
): string {
	if (notation === "ten") return `${(step / 10).toFixed(1)}+`
	if (notation === "percent") return `${step}%+`
	return `${step}+`
}

// ---------------------------------------------------------------------------------------------------------------
// Popularity, budget and shows

/** A stepped slider's scale: its stops (the last is an open end, "N+") and how a stop reads. */
export interface StopScale {
	stops: readonly number[]
	format: (value: number) => string
}

const short = (n: number) =>
	n >= 1e9
		? `${n / 1e9}B`
		: n >= 1e6
			? `${n / 1e6}M`
			: n >= 1e3
				? `${n / 1e3}K`
				: String(n)

/** "$5M", "$1B", from USD millions. */
export const formatMoney = (millions: number) =>
	millions <= 0 ? "$0" : `$${short(millions * 1e6)}`

/** How many ratings: the first stop is Discover's eligibility floor of 1K ratings, shown as Any. */
export const VOTES_SCALE: StopScale = {
	stops: VOTES_STEPS,
	format: short,
}

/** The place in the catalog's Popular order, 1 first. */
export const RANK_SCALE: StopScale = {
	stops: POPULARITY_RANK_STEPS,
	format: (rank) => `#${short(rank)}`,
}

/** Budget in USD millions. */
export const BUDGET_SCALE: StopScale = {
	stops: [0, 1, 5, 10, 25, 50, 100, 200, 300],
	format: formatMoney,
}

/** Box office in USD millions. */
export const BOX_OFFICE_SCALE: StopScale = {
	stops: [0, 1, 10, 50, 100, 250, 500, 1000, 2000],
	format: formatMoney,
}

export const SEASONS_SCALE: StopScale = {
	stops: [1, 2, 3, 4, 5, 6, 7, 8, 10, 15],
	format: String,
}

/** Hours to watch every episode. */
export const HOURS_SCALE: StopScale = {
	stops: [0, 5, 10, 20, 30, 50, 100, 200],
	format: (hours) => `${hours} h`,
}

/** Popular rank tiles use the catalog's shared inclusive ranges. */
export const RANK_PRESETS = POPULARITY_RANK_PRESETS

export const BUDGET_PRESETS: readonly RangePreset[] = [
	{ key: "indie", label: "Indie", note: "Under $5M", range: { max: 5 } },
	{
		key: "mid",
		label: "Mid budget",
		note: "$5M to $50M",
		range: { min: 5, max: 50 },
	},
	{
		key: "big",
		label: "Big",
		note: "$50M to $100M",
		range: { min: 50, max: 100 },
	},
	{
		key: "blockbuster",
		label: "Blockbuster",
		note: "$100M+",
		range: { min: 100 },
	},
]

export const BOX_OFFICE_PRESETS: readonly RangePreset[] = [100, 500, 1000].map(
	(min) => ({
		key: `over-${min}`,
		label: `${formatMoney(min)}+`,
		note: "Box office",
		range: { min },
	}),
)

export const SEASONS_PRESETS: readonly RangePreset[] = [
	{
		key: "one",
		label: "One season",
		note: "Done in one",
		range: { min: 1, max: 1 },
	},
	{
		key: "2-3",
		label: "2 to 3",
		note: "A short run",
		range: { min: 2, max: 3 },
	},
	{
		key: "4-7",
		label: "4 to 7",
		note: "A long run",
		range: { min: 4, max: 7 },
	},
	{ key: "8-plus", label: "8+", note: "Years on air", range: { min: 8 } },
]

export const HOURS_PRESETS: readonly RangePreset[] = [
	{
		key: "weekend",
		label: "A weekend",
		note: "Under 10 h",
		range: { max: 10 },
	},
	{
		key: "few-weeks",
		label: "A few weeks",
		note: "10 to 30 h",
		range: { min: 10, max: 30 },
	},
	{
		key: "long-haul",
		label: "A long haul",
		note: "30 to 100 h",
		range: { min: 30, max: 100 },
	},
	{
		key: "binge",
		label: "A real binge",
		note: "100 h+",
		range: { min: 100 },
	},
]

/** Hit and Flop, as the Budget tab names them. */
export const RETURNS_LABELS = {
	hit: { label: "Hit", note: "Made 3 times its budget" },
	flop: { label: "Flop", note: "Made less than it cost" },
} as const

/** Show status chips. */
export const SHOW_STATUS_LABELS = {
	running: "Still running",
	ended: "Ended",
	canceled: "Canceled",
} as const

// ---------------------------------------------------------------------------------------------------------------
// Ranges

/** Whether two ranges are the same, open ends included. */
export const sameRange = (
	a: FilterRange | undefined,
	b: FilterRange | undefined,
) =>
	(a?.min ?? null) === (b?.min ?? null) && (a?.max ?? null) === (b?.max ?? null)

/** A range as the URL writes it, "1990-1999", "100-", "-5"; also the key part Find and the tabs share. */
export const rangeKey = (range: FilterRange) =>
	`${range.min ?? ""}-${range.max ?? ""}`
