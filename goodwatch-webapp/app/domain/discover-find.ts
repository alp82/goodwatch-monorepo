// Find, the Discover panel's one field: how typed text reads as a setting ("1999" as Released in 1999, "pg-13" as an
// age limit, "$100m" as a budget) and how well a name fits the text. Pure, no React: the panel turns each reading
// into a result that toggles with the same setter its tab uses, so the tab, badges and footer agree.
//
// A reading says what it would set, as plain data, and a label in words. Readings for settings that FilterState
// doesn't have yet (budget, box office, seasons, time to finish) remain descriptors until those fields exist.
import type { LadderStep } from "~/domain/age-content"
import type { FilterRange, SourceKey } from "~/domain/filter-state"
import {
	BOX_OFFICE_SCALE,
	BUDGET_SCALE,
	GOODWATCH_SCORE_STEPS,
	HOURS_SCALE,
	LENGTH_MAX,
	SCORE_SOURCES,
	SCORE_STEPS,
	SEASONS_SCALE,
	YEAR_MIN,
	currentYear,
	decadeLabel,
	decadeYears,
	formatMinutes,
	formatMoney,
	formatSourceStep,
	lengthRange,
	rangeKey,
	yearRange,
} from "~/domain/title-scales"

/** Names need this many letters before Find matches them; a value ("8", "r") counts from one. */
export const FIND_MIN_NAME = 2
/** At most this many value readings show, the likeliest first. */
export const FIND_VALUE_CAP = 4

/** The sub-tab a reading belongs to; the same ids as the Discover bar's sub-tabs. */
export type FindSubTab =
	| "released"
	| "length"
	| "scores"
	| "shows"
	| "budget"
	| "age"

/** What a reading sets. Ranges are inclusive with open ends left out, in their URL parameter's unit. */
export type FindSetting =
	| { kind: "years"; years: FilterRange }
	/** The movie and episode duration fields in FilterState. */
	| { kind: "runtime"; runtime: FilterRange }
	| { kind: "episodeRuntime"; episodeRuntime: FilterRange }
	/** Time to finish a show, in hours (`hours`). */
	| { kind: "hours"; hours: FilterRange }
	/** USD millions (`budget`, `boxOffice`). */
	| { kind: "budget" | "boxOffice"; millions: FilterRange }
	| { kind: "seasons"; seasons: FilterRange }
	/** The age of a step of the list's rating ladder (`ageLimit`). */
	| { kind: "ageLimit"; age: number }
	| { kind: "minScore"; score: number }
	| { kind: "sourceScore"; source: SourceKey; score: number }

export interface FindReading {
	/** Shared with the name match of the same setting, so only the better one shows. */
	key: string
	subTab: FindSubTab
	/** In words: "Released in 1999", "Up to PG-13 · TV-14", "Budget $100M+". */
	label: string
	/** How likely the text means this, 0 to 100. */
	score: number
	setting: FindSetting
}

export interface FindContext {
	/** The current year. */
	now?: number
	/** The list's rating ladder, lowest first; null without one (no age readings then). */
	ladder: readonly LadderStep[] | null
	/** Whether a sub-tab shows; readings of a hidden one (Budget with shows only) are dropped before the cap. */
	shown?: (subTab: FindSubTab) => boolean
}

/** The key a setting shares between its reading, its name match and its tab tile. */
export function settingKey(setting: FindSetting): string {
	switch (setting.kind) {
		case "years":
			return `years:${rangeKey(setting.years)}`
		case "runtime":
			return `runtime:${rangeKey(setting.runtime)}`
		case "episodeRuntime":
			return `episodeRuntime:${rangeKey(setting.episodeRuntime)}`
		case "hours":
			return `hours:${rangeKey(setting.hours)}`
		case "budget":
		case "boxOffice":
			return `${setting.kind}:${rangeKey(setting.millions)}`
		case "seasons":
			return `seasons:${rangeKey(setting.seasons)}`
		case "ageLimit":
			return `age:${setting.age}`
		case "minScore":
			return `score:${setting.score}`
		case "sourceScore":
			return `source:${setting.source}:${setting.score}`
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Names

/** Text as Find compares it: lower case, no accents or apostrophes, single spaces. */
export const normalizeFind = (text: string) =>
	text
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[’‘'`´]/g, "")
		.replace(/\s+/g, " ")
		.trim()

const wordsOf = (text: string) => text.split(/[^a-z0-9$%+]+/).filter(Boolean)

/**
 * How well a name fits the text, 0 when it doesn't: the whole name (100), the name's start (85), a word's start (70),
 * every typed word starting a word ("hidden gems", 65), inside the name with 3 letters or more (50), then the extra
 * words ("box office", "watchlist", old mood names, 35). Below FIND_MIN_NAME letters nothing matches by name.
 */
export function nameScore(text: string, name: string, extra = ""): number {
	const q = normalizeFind(text)
	if (q.length < FIND_MIN_NAME) return 0
	const label = normalizeFind(name)
	if (label === q) return 100
	if (label.startsWith(q)) return 85
	const words = wordsOf(label)
	if (words.some((word) => word.startsWith(q))) return 70
	const typed = wordsOf(q)
	const everyWord = (list: string[]) =>
		typed.length > 1 &&
		typed.every((part) => list.some((word) => word.startsWith(part)))
	if (everyWord(words)) return 65
	if (q.length >= 3 && label.includes(q)) return 50
	const extraWords = wordsOf(normalizeFind(extra))
	if (extraWords.some((word) => word.startsWith(q)) || everyWord(extraWords))
		return 35
	return 0
}

/** One result per key, the higher score kept, in the order the keys first appear. */
export function keepBest<T extends { key: string; score: number }>(
	items: readonly T[],
): T[] {
	const best = new Map<string, T>()
	for (const item of items) {
		const kept = best.get(item.key)
		if (!kept || item.score > kept.score) best.set(item.key, item)
	}
	return [...best.values()]
}

// ---------------------------------------------------------------------------------------------------------------
// Values

/** Common rating names and the US ages they stand for. */
const RATING_AGES: Record<string, number> = {
	g: 0,
	pg: 8,
	pg13: 14,
	r: 17,
	nc17: 18,
	tvy: 0,
	tvy7: 7,
	tvg: 0,
	tvpg: 8,
	tv14: 14,
	tvma: 17,
	u: 0,
	"12a": 12,
	"15": 15,
}
/** Rating systems written as a prefix and an age: "fsk 16", "usk 12", "ab 12", "pegi 16". */
const AGE_PREFIX =
	/^(?:fsk|usk|ab|age|ages|pegi|bbfc|kijkwijzer|rated|for)\s*(\d{1,2})\s*\+?$/

const LESS =
	"under|less than|below|shorter than|cheaper than|max|at most|up to|<"
const MORE = "over|more than|above|longer than|at least|min|>"
const ABOUT = "about|around|~"
const CMP = `(${LESS}|${MORE}|${ABOUT})?\\s*`
type Compare = "under" | "over" | "about" | null

const compareOf = (word: string | undefined): Compare => {
	if (!word) return null
	if (new RegExp(`^(?:${LESS})$`).test(word)) return "under"
	if (new RegExp(`^(?:${MORE})$`).test(word)) return "over"
	if (new RegExp(`^(?:${ABOUT})$`).test(word)) return "about"
	return null
}

/** A reading before the ladder and the scales resolve it. */
type Want =
	| { kind: "years"; min: number; max: number; label: string; score: number }
	| { kind: "age"; age: number; score: number }
	/** A rating's name ("pg13", "tvma", "a"), compared with the ladder's own labels first. */
	| { kind: "rating"; code: string; score: number }
	| { kind: "seasons"; n: number; mode: "min" | "max" | "one"; score: number }
	| { kind: "length"; reading: FindReading }
	| { kind: "hours"; hours: number; mode: "min" | "max"; score: number }
	| {
			kind: "money"
			what: "budget" | "boxOffice"
			millions: number
			mode: "min" | "max"
			score: number
	  }
	/** A minimum score on 0 to 100, and how it was typed: 80, 80%, 8.0. */
	| {
			kind: "score"
			value: number
			typed: "plain" | "percent" | "ten"
			score: number
	  }

function yearWants(q: string, now: number): Want[] {
	const okYear = (year: number) => year >= YEAR_MIN && year <= now
	const years = (
		min: number,
		max: number,
		label: string,
		score: number,
	): Extract<Want, { kind: "years" }> => ({
		kind: "years",
		min,
		max,
		label,
		score,
	})
	// A span: "1990-1999", "1990 to 1999", "1990-99", "between 1990 and 1999".
	let m = q.match(
		/^(?:from |between )?(\d{4})\s*(?:-|–|to|until|till|through|thru|and)\s*(\d{2}|\d{4})s?$/,
	)
	if (m) {
		const from = Number(m[1])
		let to = Number(m[2])
		if (m[2].length === 2) {
			to = Math.floor(from / 100) * 100 + to
			if (to < from) to += 100
		}
		const lo = Math.min(from, to)
		const hi = Math.min(Math.max(from, to), now)
		if (!okYear(lo)) return []
		const decade = lo % 10 === 0 && hi === Math.min(lo + 9, now)
		return [
			years(lo, hi, decade ? decadeLabel(lo) : `Released ${lo} to ${hi}`, 99),
		]
	}
	// A decade: "1990s", "90s", "the 90s", "early 90s". Two digits: 00s to 20s are this century, 30s to 90s the last.
	m = q.match(/^(?:the )?(early |mid |late )?(\d{2})?(\d)0s$/)
	if (m) {
		const digit = Number(m[3])
		const start = m[2]
			? Number(m[2]) * 100 + digit * 10
			: digit <= 2
				? 2000 + digit * 10
				: 1900 + digit * 10
		if (!okYear(start)) return []
		const end = Math.min(start + 9, now)
		const part = m[1]?.trim()
		if (part === "early")
			return [years(start, Math.min(start + 3, now), `Early ${start}s`, 99)]
		if (part === "mid")
			return [
				years(
					Math.min(start + 3, now),
					Math.min(start + 6, now),
					`Mid ${start}s`,
					99,
				),
			]
		if (part === "late")
			return [years(Math.min(start + 6, now), end, `Late ${start}s`, 99)]
		return [years(start, end, decadeLabel(start), 99)]
	}
	// One year, with or without a word before it.
	m = q.match(
		/^(from|since|after|post|before|pre|until|till|up to|to|in|released|released in|year|made in)?\s*(\d{4})$/,
	)
	if (!m) return []
	const year = Number(m[2])
	if (!okYear(year)) return []
	const word = m[1]
	const decade = Math.floor(year / 10) * 10
	const one = years(year, year, `Released in ${year}`, 98)
	const from = years(year, now, `From ${year}`, 97)
	const upTo = years(YEAR_MIN, year, `Up to ${year}`, 96)
	const inDecade = years(
		decade,
		Math.min(decade + 9, now),
		decadeLabel(decade),
		95,
	)
	if (word === "from" || word === "since")
		return year < now ? [{ ...from, score: 99 }] : [one]
	if (word === "after" || word === "post")
		return year < now ? [years(year + 1, now, `After ${year}`, 99)] : []
	if (word === "before" || word === "pre")
		return year > YEAR_MIN
			? [years(YEAR_MIN, year - 1, `Before ${year}`, 99)]
			: []
	if (word === "until" || word === "till" || word === "up to" || word === "to")
		return [{ ...upTo, score: 99 }]
	if (word) return [{ ...one, score: 99 }, inDecade]
	return [one, ...(year < now ? [from] : []), upTo, inDecade]
}

/** Movie and episode lengths for a number of minutes: movies from 60 min, episodes up to 60. */
function lengthWants(minutes: number, compare: Compare): Want[] {
	if (minutes < 10 || minutes > LENGTH_MAX) return []
	const kinds: ("movie" | "episode")[] =
		minutes <= 50
			? ["episode"]
			: minutes < 60
				? ["episode", "movie"]
				: minutes === 60
					? ["movie", "episode"]
					: ["movie"]
	const out: Want[] = []
	let score = 97
	for (const of of kinds) {
		const word = of === "movie" ? "Movies" : "Episodes"
		const reading = (range: FilterRange, label: string, at: number): Want => {
			const setting: FindSetting =
				of === "movie"
					? { kind: "runtime", runtime: range }
					: { kind: "episodeRuntime", episodeRuntime: range }
			return {
				kind: "length",
				reading: {
					key: settingKey(setting),
					subTab: "length",
					label,
					score: at,
					setting,
				},
			}
		}
		const time = formatMinutes(minutes)
		const under = reading(
			lengthRange(0, minutes),
			`${word} under ${time}`,
			score,
		)
		const over = reading(
			lengthRange(minutes, LENGTH_MAX),
			`${word} ${time} or more`,
			score - 0.5,
		)
		const about = reading(
			lengthRange(
				Math.max(0, minutes - 10),
				Math.min(minutes + 10, LENGTH_MAX),
			),
			`${word} about ${time}`,
			score,
		)
		if (compare === "under") out.push(under)
		else if (compare === "over") out.push(over)
		else if (compare === "about") out.push(about)
		else out.push(under, ...(minutes < LENGTH_MAX ? [over] : []))
		score -= 2
	}
	return out
}

function hoursWants(hours: number, compare: Compare): Want[] {
	const under: Want = { kind: "hours", hours, mode: "max", score: 97 }
	const over: Want = { kind: "hours", hours, mode: "min", score: 96.5 }
	return compare === "under"
		? [under]
		: compare === "over"
			? [over]
			: [under, over]
}

function durationWants(q: string): Want[] {
	// "90 min", "2h", "2 h 30", "2h30m", "under 90 min", "100h", "over 2 hours".
	const m = q.match(
		new RegExp(
			`^${CMP}(\\d+(?:[.,]\\d+)?)\\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)(?:\\s*(\\d{1,2})\\s*(?:m|min|mins)?)?\\s*(\\+)?$`,
		),
	)
	if (m) {
		const compare = m[5] ? "over" : compareOf(m[1])
		const n = Number(m[2].replace(",", "."))
		const inHours = m[3].startsWith("h")
		const minutes = Math.round(inHours ? n * 60 + Number(m[4] ?? 0) : n)
		// Past four hours, hours are a show's time to finish; minutes ("300m") are left to the money reading.
		if (minutes > LENGTH_MAX)
			return inHours
				? hoursWants(minutes / 60, compare === "about" ? null : compare)
				: []
		return lengthWants(minutes, compare)
	}
	// A comparison with a bare number: "under 90", "over 120". Years went to yearWants.
	const bare = q.match(new RegExp(`^(${LESS}|${MORE}|${ABOUT})\\s*(\\d{2,3})$`))
	if (bare) {
		const compare = compareOf(bare[1])
		const n = Number(bare[2])
		const out = n >= 20 ? lengthWants(n, compare) : []
		// "over 80", "at least 75": also a minimum score.
		if (compare === "over" && n >= 50 && n <= 100)
			out.unshift({ kind: "score", value: n, typed: "plain", score: 98 })
		return out
	}
	return []
}

const MULTIPLIER: Record<string, number> = {
	k: 1e3,
	thousand: 1e3,
	m: 1e6,
	mn: 1e6,
	mil: 1e6,
	million: 1e6,
	millions: 1e6,
	b: 1e9,
	bn: 1e9,
	billion: 1e9,
	billions: 1e9,
}
const MONEY_WORDS =
	"budget|box office|boxoffice|revenue|gross|grossing|grossed|made"

function moneyWants(q: string): Want[] {
	// A money word may lead or trail: "budget 100m", "$1b box office", "100 million budget", "under $5m".
	let what: "budget" | "boxOffice" | null = null
	let text = q
	const lead = text.match(new RegExp(`^(${MONEY_WORDS})\\s+(.*)$`))
	if (lead) {
		what = lead[1] === "budget" ? "budget" : "boxOffice"
		text = lead[2]
	}
	const m = text.match(
		new RegExp(
			`^${CMP}(\\$|usd\\s*)?(\\d+(?:[.,]\\d+)?)\\s*(k|thousand|m|mn|mil|million|millions|b|bn|billion|billions)?\\s*(\\+)?\\s*(${MONEY_WORDS})?$`,
		),
	)
	if (!m) return []
	const [, word, dollar, number, unit, plus, trailing] = m
	if (trailing) what = trailing === "budget" ? "budget" : "boxOffice"
	// "100m" alone is minutes (durationWants); past four hours of minutes it is millions.
	const money =
		Boolean(dollar) ||
		Boolean(what) ||
		(unit !== undefined && unit !== "m") ||
		(unit === "m" && Number(number) > LENGTH_MAX)
	if (!money) return []
	const dollars =
		Number(number.replace(",", ".")) * (unit ? MULTIPLIER[unit] : 1)
	if (dollars < 1e5) return []
	const mode = (plus ? "over" : compareOf(word)) === "under" ? "max" : "min"
	const kinds: ("budget" | "boxOffice")[] = what
		? [what]
		: dollars > 3e8
			? ["boxOffice", "budget"]
			: ["budget", "boxOffice"]
	return kinds.map((kind, i) => ({
		kind: "money",
		what: kind,
		millions: dollars / 1e6,
		mode,
		score: 97 - i,
	}))
}

function numberWants(q: string): Want[] {
	// "8.0", "7.5+": a ten-point score (IMDb, the Metacritic user score).
	const tenth = q.match(/^(\d)[.,](\d)\s*\+?$/)
	if (tenth)
		return [
			{
				kind: "score",
				value: Number(tenth[1]) * 10 + Number(tenth[2]),
				typed: "ten",
				score: 97,
			},
		]
	// "8 seasons", "3+ seasons", "over 5 seasons", "up to 3 seasons", "one season".
	const seasons = q.match(
		new RegExp(
			`^(${LESS}|${MORE})?\\s*(\\d{1,2}|one)\\s*(\\+)?\\s*(?:seasons?|series)$`,
		),
	)
	if (seasons) {
		const n = seasons[2] === "one" ? 1 : Number(seasons[2])
		const compare = seasons[3] ? "over" : compareOf(seasons[1])
		const mode =
			n === 1 && compare !== "over"
				? "one"
				: compare === "under"
					? "max"
					: "min"
		return [{ kind: "seasons", n, mode, score: 99 }]
	}
	const m = q.match(/^(\d{1,3})\s*(\+|%)?$/)
	if (!m) return []
	const n = Number(m[1])
	const sign = m[2]
	if (sign === "%")
		return n >= 50 && n <= 100
			? [{ kind: "score", value: n, typed: "percent", score: 98 }]
			: []
	const out: Want[] = []
	// A small number: an age first ("12" is FSK 12 or the PG-13 step), then seasons where it is a step.
	if (n <= 21) {
		out.push({ kind: "age", age: n, score: sign ? 98 : 96 })
		if (n === 1) out.push({ kind: "seasons", n, mode: "one", score: 88 })
		else if (n >= 2) out.push({ kind: "seasons", n, mode: "min", score: 88 })
	}
	if (n >= 50 && n <= 100)
		out.push({ kind: "score", value: n, typed: "plain", score: 95 })
	// Round lengths: 45, 60, 90, 105, 120, 150, 180, and multiples of 10 from 100 to 240.
	if (
		!sign &&
		((n % 15 === 0 && n >= 45) || (n % 10 === 0 && n >= 100)) &&
		n <= LENGTH_MAX
	)
		for (const want of lengthWants(n, "under"))
			if (want.kind === "length")
				out.push({
					kind: "length",
					reading: { ...want.reading, score: want.reading.score - 15 },
				})
	return out
}

function ageWants(q: string): Want[] {
	const prefixed = q.match(AGE_PREFIX)
	if (prefixed) return [{ kind: "age", age: Number(prefixed[1]), score: 99 }]
	const code = q.replace(/[^a-z0-9]/g, "")
	if (!code || /^\d+$/.test(code) || code.length > 5) return []
	return [{ kind: "rating", code, score: 99 }]
}

/** The text's readings before resolving; the first kind of value that reads wins. */
function wantsOf(q: string, now: number): Want[] {
	const value =
		/\d/.test(q) ||
		/^[a-z]{1,4}(?:[-\s][a-z0-9]{1,3})?$/.test(q) ||
		/^one seasons?$/.test(q)
	if (!value) return []
	for (const read of [
		(t: string) => yearWants(t, now),
		durationWants,
		moneyWants,
		numberWants,
		ageWants,
	]) {
		const wants = read(q)
		if (wants.length) return wants
	}
	return []
}

/** The index of the last stop at or below `value`, -1 when none. */
const lastAtMost = (stops: readonly number[], value: number) =>
	stops.reduce((found, stop, i) => (stop <= value ? i : found), -1)

/** A minimum snapped down to a stop, or a maximum snapped up to one; null on the scale's start or off the scale. */
function snapped(
	stops: readonly number[],
	value: number,
	mode: "min" | "max",
): FilterRange | null {
	if (mode === "min") {
		const i = lastAtMost(stops, value)
		return i > 0 ? { min: stops[i] } : null
	}
	const j = stops.findIndex((stop) => stop >= value)
	return j > 0 ? { max: stops[j] } : null
}

/** The ladder step nearest an age, ties to the lower one. */
function nearestStep(ladder: readonly LadderStep[], age: number) {
	return ladder.reduce((best, step) =>
		Math.abs(step.age - age) < Math.abs(best.age - age) ? step : best,
	)
}

const plainCode = (label: string) =>
	label.toLowerCase().replace(/[^a-z0-9]/g, "")

function resolve(
	want: Want,
	ladder: readonly LadderStep[] | null,
	now: number,
): FindReading[] {
	const reading = (
		subTab: FindSubTab,
		label: string,
		score: number,
		setting: FindSetting,
	): FindReading => ({
		key: settingKey(setting),
		subTab,
		label,
		score,
		setting,
	})
	const ageReading = (step: LadderStep, score: number) =>
		reading(
			"age",
			`Up to ${step.label}${step.show ? ` · ${step.show}` : ""}`,
			score,
			{ kind: "ageLimit", age: step.age },
		)
	switch (want.kind) {
		case "years":
			return [
				reading("released", want.label, want.score, {
					kind: "years",
					years: yearRange(want.min, want.max, now),
				}),
			]
		case "length":
			return [want.reading]
		case "age": {
			if (!ladder?.length) return []
			const step = nearestStep(ladder, want.age)
			return Math.abs(step.age - want.age) <= 3
				? [ageReading(step, want.score)]
				: []
		}
		case "rating": {
			if (!ladder?.length) return []
			// The ladder's own names first ("PG-13", "TV-MA", "FSK 16", "12A"), else the US age the name stands for.
			const own = ladder.find(
				(step) =>
					plainCode(step.label) === want.code ||
					(step.show !== undefined && plainCode(step.show) === want.code),
			)
			if (own) return [ageReading(own, want.score)]
			const age = RATING_AGES[want.code]
			return want.code.length >= 2 && age !== undefined
				? [ageReading(nearestStep(ladder, age), want.score - 2)]
				: []
		}
		case "seasons": {
			const { stops } = SEASONS_SCALE
			if (want.mode === "one")
				return [
					reading("shows", "One season", want.score, {
						kind: "seasons",
						seasons: { min: 1, max: 1 },
					}),
				]
			if (!stops.includes(want.n)) return []
			if (want.mode === "min")
				return want.n > stops[0]
					? [
							reading("shows", `${want.n}+ seasons`, want.score, {
								kind: "seasons",
								seasons: { min: want.n },
							}),
						]
					: []
			return [
				reading("shows", `Up to ${want.n} seasons`, want.score, {
					kind: "seasons",
					seasons: { max: want.n },
				}),
			]
		}
		case "hours": {
			const range = snapped(HOURS_SCALE.stops, want.hours, want.mode)
			if (!range) return []
			const label =
				range.max !== undefined
					? `Under ${range.max} h to finish`
					: `${range.min} h or more to finish`
			return [
				reading("shows", label, want.score, { kind: "hours", hours: range }),
			]
		}
		case "money": {
			const scale = want.what === "budget" ? BUDGET_SCALE : BOX_OFFICE_SCALE
			const range = snapped(scale.stops, want.millions, want.mode)
			if (!range) return []
			const word = want.what === "budget" ? "Budget" : "Box office"
			const label =
				range.max !== undefined
					? `${word} under ${formatMoney(range.max)}`
					: `${word} ${formatMoney(range.min ?? 0)}+`
			return [
				reading("budget", label, want.score, {
					kind: want.what,
					millions: range,
				}),
			]
		}
		case "score": {
			// Exact steps only, no snapping: 95 is no step anywhere. "%" names the percentage sources, "7.5" the
			// ten-point ones.
			const out: FindReading[] = []
			let score = want.score
			if (
				want.typed === "plain" &&
				GOODWATCH_SCORE_STEPS.includes(want.value)
			) {
				out.push(
					reading("scores", `GoodWatch ${want.value}+`, score, {
						kind: "minScore",
						score: want.value,
					}),
				)
				score -= 1
			}
			if (!(SCORE_STEPS as readonly number[]).includes(want.value)) return out
			for (const source of SCORE_SOURCES) {
				if (want.typed === "percent" && source.notation !== "percent") continue
				if (want.typed === "ten" && source.notation !== "ten") continue
				out.push(
					reading(
						"scores",
						`${source.name} ${formatSourceStep(source.notation, want.value)}`,
						score,
						{ kind: "sourceScore", source: source.key, score: want.value },
					),
				)
				score -= 0.5
			}
			return out
		}
	}
}

/**
 * Every setting the text names as a value, likeliest first: at most FIND_VALUE_CAP, one per setting, none of a hidden
 * sub-tab. Empty when the text isn't a value.
 */
export function findValues(text: string, context: FindContext): FindReading[] {
	const now = context.now ?? currentYear()
	const readings = wantsOf(normalizeFind(text), now)
		.flatMap((want) => resolve(want, context.ladder, now))
		.filter((reading) => context.shown?.(reading.subTab) ?? true)
	return keepBest(readings)
		.map((reading, i) => ({ reading, i }))
		.sort((a, b) => b.reading.score - a.reading.score || a.i - b.i)
		.slice(0, FIND_VALUE_CAP)
		.map(({ reading }) => reading)
}
