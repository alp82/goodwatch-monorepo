import { BIG_EIGHT, INDUSTRIES, REGIONS } from "~/domain/film-industries"
import type { FilterOptionCounts } from "~/domain/filter-state"
// The filter's passes over a universe of titles that is already in its plain order. One pass computes each title's
// fail mask: bit g is set when filter group g hides the title. A title with an empty mask passes; a title with exactly
// one bit set is what that group alone hides (its recovery). Then one pass per group over the titles every other group
// lets through counts what each of that group's options would leave.
import {
	CONTENT_KINDS,
	type ContentOverrides,
	PLAIN_LADDER,
	type ViewerLadder,
	hiddenContentBits,
	ladderStepFor,
} from "~/domain/age-content"
import {
	ratingCountryFor,
	type FilterState,
	type FilterRange,
	FILTER_NAMES,
	type FilterName,
	type TagGroup,
	MIN_MATCHES,
	MIN_SCORES,
} from "~/domain/filter-state"
import {
	BUDGET_STEPS,
	BOX_OFFICE_STEPS,
	SEASONS_STEPS,
	HOURS_STEPS,
	POPULARITY_OPTIONS,
} from "~/domain/title-scales"
import { GENRE_FOLDS } from "~/domain/genre-fold"
import { MOOD_KEYS } from "~/domain/moods"
import { STYLE_KEYS, THEME_KEYS } from "~/domain/themes-styles"
import type { AnimeChoice } from "~/domain/title-type"
import type { CountryServices } from "~/server/availability-index.server"
import {
	FLAG_ANIME,
	NO_RATING,
	type TitleColumns,
	type TitleRatings,
	UNKNOWN_DAY,
	UNKNOWN_SCORE,
} from "~/server/title-snapshot/index.server"
import type { TitleKey } from "~/utils/title-key"

const SHOW_BASE = 2e12
const ORIGIN_SETS = [...INDUSTRIES, ...REGIONS]
// A fail mask is 32 bits wide (FailMasks), one bit per filter group.
if (FILTER_NAMES.length > 32)
	throw new Error("A title's fail mask holds at most 32 filter groups")
const BIT = Object.fromEntries(
	FILTER_NAMES.map((name, i) => [name, 1 << i]),
) as Record<FilterName, number>
const FailMasks = Uint32Array
// Per-service option counts are reported for the services the most titles would show on, and the chosen ones.
const MAX_SERVICE_OPTIONS = 120

// Unbounded options also count titles whose value is unknown.
function popularityBounds(field: "votes" | "popularityRank") {
	const options: { key: string; range: FilterRange }[] =
		POPULARITY_OPTIONS.filter((option) => option.field === field)
	return {
		keys: options.map((option) => option.key),
		min: options.map(({ range }) =>
			range.min === undefined && range.max === undefined
				? Number.NEGATIVE_INFINITY
				: (range.min ?? 0),
		),
		max: options.map(({ range }) => range.max ?? Number.POSITIVE_INFINITY),
	}
}
const VOTE_BOUNDS = popularityBounds("votes")
const RANK_BOUNDS = popularityBounds("popularityRank")

/**
 * A set of titles with a flag per snapshot row, so the passes test membership by row; titles the snapshot doesn't hold
 * are tested by key.
 */
export interface TitleSet {
	keys: ReadonlySet<TitleKey>
	rows: Uint8Array
}

export function titleSet(
	keys: ReadonlySet<TitleKey>,
	snapshot: { count: number; rowOf(key: TitleKey): number },
): TitleSet {
	const rows = new Uint8Array(snapshot.count)
	for (const key of keys) {
		const row = snapshot.rowOf(key)
		if (row >= 0) rows[row] = 1
	}
	return { keys, rows }
}

/** A day range: from (inclusive) and to (exclusive), in days since 1970-01-01. */
export interface DayRange {
	from: number
	to: number
}

/** On my services, by the availability index or, while the country loads, by a set of keys. */
export type ServicesFilter =
	| {
			kind: "index"
			anyService?: boolean
			index: CountryServices
			/** Availability row per universe title (-1 on no service). */
			availabilityRows: Int32Array
			/** The services the filter keeps, as indexes into index.services; empty when the filter is off. */
			kept: number[]
			/** The viewer's saved services, as indexes, for the "mine" count. */
			mine: number[]
			/** The explicitly chosen services (not "mine"), as indexes: the base of each service option's toggle. */
			chosen: number[]
	  }
	| {
			kind: "column"
			/** The titles on the kept services; null when the filter is off. */
			kept: TitleSet | null
			onMyServices: boolean
	  }

/**
 * The age limit and the content filter, resolved for the viewer's country. A title's age is its rating in the country,
 * else its estimate; a title rated nowhere, or one the snapshot doesn't hold, has none and fails any limit. Content
 * hides a title that has one of the hidden kinds; a title the snapshot doesn't hold has none.
 */
export interface RatingsFilter {
	/** Content bits (CONTENT_KINDS) per snapshot row. */
	content: Uint8Array
	/** The age in the viewer's country per snapshot row, NO_RATING without; null for a country without ratings of its own. */
	ages: Uint8Array | null
	/** The estimated age per snapshot row; NO_RATING when rated nowhere. */
	estimates: Uint8Array
	/** The age a title may have at most; -1 when the limit is off. */
	limit: number
	/** The content bits the state hides; 0 when none. */
	hidden: number
	/**
	 * The age limit's options, for the counts: each step's age with the content bits that step would hide (what the
	 * step sets by itself plus the person's overrides).
	 */
	steps: { age: number; hidden: number }[]
	/** The content bits hidden with the limit off. */
	hiddenWhenOff: number
}

/**
 * The selected rating country's ladder and available countries. Without an override, use the streaming country,
 * then the viewer's country (plain ages when it has no ratings). Null without ratings.
 */
export function ladderFor(
	ratings: Pick<TitleRatings, "ladderOf" | "countries"> | null | undefined,
	country: string,
	state: Pick<FilterState, "ratingCountry" | "streamingCountry"> = {},
): (ViewerLadder & { countries: readonly string[] }) | null {
	if (!ratings) return null
	const code = ratingCountryFor(state, country, ratings.countries)
	const steps = ratings.ladderOf(code)
	return {
		country: code,
		countries: ratings.countries,
		steps: [...(steps ?? PLAIN_LADDER)],
		local: steps !== undefined,
	}
}

/** The age limit and content of a filter state, resolved over the snapshot's ratings for the viewer's ladder. */
export function ratingsFilter(
	ratings: TitleRatings,
	ladder: ViewerLadder,
	state: { ageLimit?: number; content?: ContentOverrides },
): RatingsFilter {
	const { ageLimit, content } = state
	return {
		content: ratings.content,
		ages: ratings.agesOf(ladder.country),
		estimates: ratings.estimates,
		// An age that isn't a step of this ladder limits to the step it stands for. What content hides by default goes
		// by the age as given, the same as in the browser.
		limit:
			ageLimit === undefined ? -1 : ladderStepFor(ladder.steps, ageLimit).age,
		hidden: hiddenContentBits(ageLimit, content),
		steps: ladder.steps.map((step) => ({
			age: step.age,
			hidden: hiddenContentBits(step.age, content),
		})),
		hiddenWhenOff: hiddenContentBits(undefined, content),
	}
}

/** Everything the passes need, with every group resolved. A group is off when its field says so. */
export interface PassInput {
	/** Compute option counts only for requested groups. */
	budgetCounts?: boolean
	showsCounts?: boolean
	popularityCounts?: boolean
	releasedCounts?: boolean
	lengthCounts?: boolean
	originCounts?: boolean
	budget?: FilterState["budget"]
	boxOffice?: FilterState["boxOffice"]
	returns?: FilterState["returns"]
	seasons?: FilterState["seasons"]
	showStatus?: FilterState["showStatus"]
	hours?: FilterState["hours"]
	votes?: FilterRange
	popularityRank?: FilterRange
	/** Catalog rank per snapshot row; zero is unranked. */
	popularityRanks?: Int32Array
	columns: TitleColumns
	/** The universe in its plain order: snapshot row (-1 for a title the snapshot doesn't hold) and key per title. */
	rows: Int32Array
	keys: Float64Array
	services: ServicesFilter
	/** Seen and skipped titles; null when Not seen yet is off. */
	notSeen: TitleSet | null
	/** Member seen titles; absent for guests, for whom Seen before does not narrow. */
	seen?: TitleSet
	seenBefore?: boolean
	wishlist?: TitleSet | null
	onWishlist?: boolean
	outsideUsual?: boolean
	/** False for guests, even if their progress provides taste. */
	outsideUsualAvailable?: boolean
	/** Always the full seen and skipped set, for the Not seen yet option counts. */
	seenOrSkipped: TitleSet
	type: "all" | "movie" | "show"
	/** A title the snapshot doesn't hold counts as not anime. */
	anime: AnimeChoice
	/** Mood bits a title needs one of (all when listed in allOf); 0 when off. */
	moods: number
	/** Theme bits a title needs one of (all when listed in allOf); 0 when off. */
	themes: number
	/** Style bits a title needs one of (all when listed in allOf); 0 when off. */
	styles: number
	/** Genre bits a title needs one of (all when listed in allOf); 0 when off. `genresChosen` says whether the filter is on (a genre not in the table has no bit). */
	genres: number
	allOf?: TagGroup[]
	/** A chosen genre absent from the snapshot cannot match under all of. */
	genresMissing?: boolean
	/** Original names preserve folded picks when an alias is absent from the snapshot. */
	genrePicks?: readonly string[]
	genresChosen: boolean
	minScore: number
	/** The least taste match; 0 when off, and always 0 without `matches`. */
	minMatch: number
	/** Taste match (50 to 99) per universe title, 0 for a title without one; null for a person without taste. */
	matches: Uint8Array | null
	released: DayRange | null
	releasedOptions: Record<string, DayRange | null>
	/** One set per chosen title or person; a title passes when any set holds it. Empty when off. */
	similarTo: { option: string; keys: TitleSet }[]
	people: { option: string; keys: TitleSet }[]
	productionCountries?: { option: string; keys: TitleSet }[]
	restOfWorld?: Uint8Array | null
	yearRange?: FilterRange
	movieRange?: FilterRange
	episodeRange?: FilterRange | null
	years?: TitleSet | null
	runtime?: TitleSet | null
	sourceScores?: TitleSet | null
	scoreGap?: TitleSet | null
	legacy: TitleSet | null
	/** Null when the snapshot has no ratings (or the age filter is off for the viewer): then neither group narrows. */
	ratings: RatingsFilter | null
}

export interface PassOutput {
	/** Universe positions (indexes into rows and keys) of the passing titles, in the plain order. */
	passing: Int32Array
	recoveries: { filter: FilterName; titles: number }[]
	optionCounts: FilterOptionCounts
}

const popcount = (x: number) => {
	let n = 0
	for (let v = x >>> 0; v; v &= v - 1) n++
	return n
}
const lowestBit = (x: number) => 31 - Math.clz32(x & -x)

/**
 * Counts for a group whose options combine with OR: what toggling each option would leave. Fed one title at a time
 * with how many of the chosen options it has (and which, when one).
 */
class ToggleCounts {
	all = 0
	chosen = 0
	/** Per option: titles without any chosen option that have this one. The caller adds to it. */
	readonly add: Uint32Array
	readonly only: Uint32Array
	constructor(size: number) {
		this.add = new Uint32Array(size)
		this.only = new Uint32Array(size)
	}
	/**
	 * True when the title has no chosen option: then the caller adds `titles` to `add` for each option the title has.
	 * `titles` counts several titles with the same options at once.
	 */
	observe(chosenHits: number, onlyChosen: number, titles = 1): boolean {
		this.all += titles
		if (chosenHits === 0) return true
		this.chosen += titles
		if (chosenHits === 1) this.only[onlyChosen] += titles
		return false
	}
	/** What the result would be with the option toggled, given how many options are chosen. */
	count(option: number, isChosen: boolean, chosenCount: number) {
		if (!isChosen) return this.chosen + this.add[option]
		return chosenCount === 1 ? this.all : this.chosen - this.only[option]
	}
}

function within(value: number | undefined, range?: FilterRange): boolean {
	if (!range || (range.min === undefined && range.max === undefined))
		return true
	return (
		value !== undefined &&
		value >= (range.min ?? 0) &&
		value <= (range.max ?? Number.POSITIVE_INFINITY)
	)
}

/** An active bound rejects missing facts; bounds are inclusive, as in the SQL fallback. */
function withinFact(value: number, range?: FilterRange | null): boolean {
	return (
		!range ||
		(range.min === undefined && range.max === undefined) ||
		(value > 0 && value >= (range.min ?? 0) && value <= (range.max ?? Infinity))
	)
}

const STATUS = { running: 1, ended: 2, canceled: 3 } as const
const bounded = (range?: FilterRange) =>
	range?.min !== undefined || range?.max !== undefined
function returnsPass(
	budget: number,
	boxOffice: number,
	choice: PassInput["returns"],
): boolean {
	return (
		!choice ||
		(budget > 0 &&
			boxOffice > 0 &&
			(choice === "hit" ? boxOffice >= 3 * budget : boxOffice < budget))
	)
}
function statusPass(status: number, choice: PassInput["showStatus"]): boolean {
	return !choice || status === STATUS[choice]
}
function incrementBucket(
	counts: Uint32Array,
	stops: readonly number[],
	value: number,
) {
	if (value <= 0) return
	let bucket = stops.length - 1
	while (bucket > 0 && value < stops[bucket]) bucket--
	counts[bucket]++
}
function emptyBuckets(
	specs: [string, readonly number[]][],
	keys: string[] = [],
) {
	return Object.fromEntries([
		...specs.flatMap(([prefix, stops]) =>
			stops.map((_, i) => [`${prefix}:${i}`, 0]),
		),
		...keys.map((key) => [key, 0]),
	]) as Record<string, number>
}

/** Requested facts histograms, sharing one traversal of the universe and its fail masks. */
export function factCounts(
	input: PassInput,
	masks: Uint32Array,
): Partial<FilterOptionCounts> {
	const facts = input.columns.facts
	const years = input.releasedCounts
		? facts
			? ({} as Record<string, number>)
			: null
		: undefined
	const runtime = input.lengthCounts
		? facts
			? ({} as Record<string, number>)
			: null
		: undefined
	const origin = input.originCounts
		? facts
			? ({} as Record<string, number>)
			: null
		: undefined
	const budget = input.budgetCounts
		? facts
			? emptyBuckets(
					[
						["budget", BUDGET_STEPS],
						["boxOffice", BOX_OFFICE_STEPS],
					],
					["returns:hit", "returns:flop", "known:budget", "known:boxOffice"],
				)
			: null
		: undefined
	const shows = input.showsCounts
		? facts
			? emptyBuckets(
					[
						["seasons", SEASONS_STEPS],
						["hours", HOURS_STEPS],
					],
					["status:running", "status:ended", "status:canceled"],
				)
			: null
		: undefined
	const out: Partial<FilterOptionCounts> = {}
	if (budget !== undefined) out.budget = budget
	if (shows !== undefined) out.shows = shows
	if (years !== undefined) out.years = years
	if (runtime !== undefined) out.runtime = runtime
	if (origin !== undefined) out.productionCountries = origin
	if (!facts) return out
	const budgetBuckets = budget ? new Uint32Array(BUDGET_STEPS.length) : null
	const boxOfficeBuckets = budget
		? new Uint32Array(BOX_OFFICE_STEPS.length)
		: null
	const seasonBuckets = shows ? new Uint32Array(SEASONS_STEPS.length) : null
	const hourBuckets = shows ? new Uint32Array(HOURS_STEPS.length) : null
	const statusCounts = shows ? new Uint32Array(4) : null
	const yearCounts = years ? new Uint32Array(65536) : null
	// 49 five-minute buckets (240 includes overflow), then unknown, for each kind.
	const lengthCounts = runtime ? new Uint32Array(100) : null
	const countryCounts = origin ? new Uint32Array(facts.countries.length) : null
	const sets = ORIGIN_SETS
	// Precompute group membership per country, so co-productions need only four reads and a bit union.
	const groups = origin
		? Uint32Array.from(facts.countries, (code) =>
				sets.reduce(
					(bits, set, g) => (set.codes.includes(code) ? bits | (1 << g) : bits),
					0,
				),
			)
		: null
	const outside = origin
		? Uint8Array.from(facts.countries, (code) =>
				BIG_EIGHT.includes(code) ? 0 : 1,
			)
		: null
	const setCounts = origin ? new Uint32Array(sets.length) : null
	let worldCount = 0
	const count = facts.releaseYears.length
	for (let i = 0; i < input.rows.length; i++) {
		const row = input.rows[i]
		const mask = masks[i]
		if (
			row >= 0 &&
			budget &&
			input.keys[i] < SHOW_BASE &&
			(mask & ~BIT.budget) === 0
		) {
			const b = facts.budgets[row] / 1000,
				o = facts.boxOffice[row] / 1000
			const bOk = withinFact(b, input.budget),
				oOk = withinFact(o, input.boxOffice),
				rOk = returnsPass(
					facts.budgets[row],
					facts.boxOffice[row],
					input.returns,
				)
			if (oOk && rOk && b > 0) {
				budget["known:budget"]++
				incrementBucket(budgetBuckets!, BUDGET_STEPS, b)
			}
			if (bOk && rOk && o > 0) {
				budget["known:boxOffice"]++
				incrementBucket(boxOfficeBuckets!, BOX_OFFICE_STEPS, o)
			}
			if (bOk && oOk) {
				if (returnsPass(facts.budgets[row], facts.boxOffice[row], "hit"))
					budget["returns:hit"]++
				if (returnsPass(facts.budgets[row], facts.boxOffice[row], "flop"))
					budget["returns:flop"]++
			}
		}
		if (
			row >= 0 &&
			shows &&
			input.keys[i] >= SHOW_BASE &&
			(mask & ~BIT.shows) === 0
		) {
			const s = facts.seasons[row],
				h = (facts.episodes[row] * facts.lengths[row]) / 60,
				status = facts.showStatuses[row]
			const sOk = withinFact(s, input.seasons),
				hOk = withinFact(h, input.hours),
				statusOk = statusPass(status, input.showStatus)
			if (hOk && statusOk) incrementBucket(seasonBuckets!, SEASONS_STEPS, s)
			if (sOk && statusOk) incrementBucket(hourBuckets!, HOURS_STEPS, h)
			if (sOk && hOk && status > 0 && status <= 3) statusCounts![status]++
		}
		if (yearCounts && (mask & ~(BIT.years | BIT.released)) === 0 && row >= 0) {
			const year = facts.releaseYears[row]
			if (year) yearCounts[year]++
		}
		if (lengthCounts && (mask & ~BIT.runtime) === 0) {
			const length = row < 0 ? 0 : facts.lengths[row]
			const kind = input.keys[i] >= SHOW_BASE ? 50 : 0
			lengthCounts[
				kind + (length ? Math.min(48, Math.floor(length / 5)) : 49)
			]++
		}
		if (
			countryCounts &&
			setCounts &&
			groups &&
			outside &&
			row >= 0 &&
			(mask & ~BIT.productionCountries) === 0
		) {
			let bits = 0
			let world = false
			for (let slot = 0; slot < 4; slot++) {
				const index = facts.countryIndexes[slot * count + row]
				if (index === 255) continue
				countryCounts[index]++
				bits |= groups[index]
				world ||= outside[index] === 1
			}
			for (let remaining = bits; remaining; remaining &= remaining - 1)
				setCounts[lowestBit(remaining)]++
			if (world) worldCount++
		}
	}
	if (budget && budgetBuckets && boxOfficeBuckets) {
		budgetBuckets.forEach((value, i) => {
			budget[`budget:${i}`] = value
		})
		boxOfficeBuckets.forEach((value, i) => {
			budget[`boxOffice:${i}`] = value
		})
	}
	if (shows && seasonBuckets && hourBuckets && statusCounts) {
		seasonBuckets.forEach((value, i) => {
			shows[`seasons:${i}`] = value
		})
		hourBuckets.forEach((value, i) => {
			shows[`hours:${i}`] = value
		})
		for (const name of ["running", "ended", "canceled"] as const)
			shows[`status:${name}`] = statusCounts[STATUS[name]]
	}
	if (years && yearCounts)
		for (let year = 1; year < yearCounts.length; year++)
			if (yearCounts[year]) years[year] = yearCounts[year]
	if (runtime && lengthCounts)
		for (let k = 0; k < 2; k++) {
			const kind = k ? "episode" : "movie"
			for (let bucket = 0; bucket <= 48; bucket++)
				runtime[`${kind}:${bucket * 5}`] = lengthCounts[k * 50 + bucket]
			runtime[`${kind}:unknown`] = lengthCounts[k * 50 + 49]
		}
	if (origin && countryCounts && setCounts) {
		facts.countries.forEach((code, i) => {
			if (countryCounts[i]) origin[code] = countryCounts[i]
		})
		sets.forEach((set, i) => {
			origin[`set:${set.id}`] = setCounts[i]
		})
		origin.world = worldCount
	}
	return out
}

/** Counts each replacement range while retaining its sibling choice and every other group. */
export function popularityCounts(
	input: PassInput,
	masks: Uint32Array,
): Record<string, number> {
	const { rows } = input
	const n = rows.length
	const counts: Record<string, number> = {}
	const voteCounts = new Array<number>(VOTE_BOUNDS.keys.length).fill(0)
	const rankCounts = new Array<number>(RANK_BOUNDS.keys.length).fill(0)
	for (let i = 0; i < n; i++) {
		if ((masks[i] & ~BIT.popularity) !== 0) continue
		const row = rows[i]
		const v = row < 0 ? undefined : input.columns.votes[row]
		const r = row < 0 ? undefined : input.popularityRanks?.[row] || undefined
		const vOk = within(v, input.votes)
		const rOk = within(r, input.popularityRank)
		const voteValue = v ?? Number.NEGATIVE_INFINITY
		const rankValue = r ?? Number.NEGATIVE_INFINITY
		if (rOk)
			for (let j = 0; j < voteCounts.length; j++)
				if (voteValue >= VOTE_BOUNDS.min[j] && voteValue <= VOTE_BOUNDS.max[j])
					voteCounts[j]++
		if (vOk)
			for (let j = 0; j < rankCounts.length; j++)
				if (rankValue >= RANK_BOUNDS.min[j] && rankValue <= RANK_BOUNDS.max[j])
					rankCounts[j]++
	}
	VOTE_BOUNDS.keys.forEach((key, i) => {
		counts[key] = voteCounts[i]
	})
	RANK_BOUNDS.keys.forEach((key, i) => {
		counts[key] = rankCounts[i]
	})
	return counts
}

export function runPasses(input: PassInput): PassOutput {
	const { columns, rows, keys, services } = input
	const n = rows.length
	const { genres, moods, themes, styles, scores, releaseDays, flags } = columns
	const masks = new FailMasks(n)

	// The type filter's rule (passesTitleType) over the columns: the format by the key, anime by the flag.
	const typeWanted = input.type === "all" ? -1 : input.type === "show" ? 1 : 0
	const animeWanted =
		input.anime === "any" ? -1 : input.anime === "only" ? 1 : 0
	const isAnime = (i: number) => {
		const row = rows[i]
		return row >= 0 && (flags[row] & FLAG_ANIME) !== 0
	}
	const moodMask = input.moods
	const themeMask = input.themes
	const styleMask = input.styles
	const genreMask = input.genres >>> 0
	const genresOn = input.genresChosen
	const minScore = input.minScore
	const matches = input.matches
	// Without taste no title has a match, and the filter doesn't narrow.
	const minMatch = matches ? input.minMatch : 0
	const released = input.released
	const similar = input.similarTo
	// Rest of the world is another Made in pick: any country or this set may pass.
	const productionCountries = [
		...(input.productionCountries ?? []),
		...(input.restOfWorld
			? [
					{
						option: "restOfWorld",
						keys: { keys: new Set<TitleKey>(), rows: input.restOfWorld },
					},
				]
			: []),
	]
	const people = input.people
	const legacy = input.legacy
	const notSeen = input.notSeen
	const ratings = input.ratings
	const ageLimit = ratings ? ratings.limit : -1
	const hiddenContent = ratings ? ratings.hidden : 0
	// A title's age: its rating in the viewer's country, else its estimate; NO_RATING (above every limit) without.
	const ageOf = (r: RatingsFilter, row: number) => {
		if (row < 0) return NO_RATING
		const age = r.ages ? r.ages[row] : NO_RATING
		return age === NO_RATING ? r.estimates[row] : age
	}

	const inSet = (set: TitleSet, i: number) => {
		const row = rows[i]
		return row >= 0 ? set.rows[row] === 1 : set.keys.has(keys[i])
	}
	const inAny = (sets: { keys: TitleSet }[], i: number) => {
		for (const set of sets) if (inSet(set.keys, i)) return true
		return false
	}

	let keptServices: Uint8Array | null = null
	if (services.kind === "index" && services.kept.length) {
		keptServices = new Uint8Array(services.index.services.length)
		for (const s of services.kept) keptServices[s] = 1
	}
	const onServices = (i: number) => {
		if (services.kind === "column")
			return services.kept ? inSet(services.kept, i) : true
		if (services.anyService) {
			const at = services.availabilityRows[i]
			return (
				at >= 0 && services.index.offsets[at + 1] > services.index.offsets[at]
			)
		}
		if (!keptServices) return true
		const at = services.availabilityRows[i]
		if (at < 0) return false
		const { offsets, entries } = services.index
		for (let e = offsets[at]; e < offsets[at + 1]; e++)
			if (keptServices[entries[e]]) return true
		return false
	}
	const servicesOn =
		services.kind === "index"
			? services.anyService || keptServices !== null
			: services.kept !== null

	const allOf = new Set(input.allOf)
	const moodsAll = allOf.has("moods")
	const themesAll = allOf.has("themes")
	const stylesAll = allOf.has("styles")
	const genresAll = allOf.has("genres")
	const genresDead = genresAll && !!input.genresMissing
	// A folded pair is one requirement. A combined TV name on its own matches
	// either movie genre; alongside movie picks it belongs to those picked units.
	const genreUnits: number[] = []
	const genreOptionUnits: number[] = []
	let genreChosenUnits = 0
	if (genresAll) {
		const names = columns.genreNames
		const bitOf = (name: string) => {
			const b = names.indexOf(name)
			return b < 0 ? 0 : (1 << b) >>> 0
		}
		const picked = new Set(
			input.genrePicks ?? names.filter((_, b) => genreMask & (1 << b)),
		)
		const covered = new Set<string>()
		for (const fold of GENRE_FOLDS) {
			if (!picked.has(fold.names[0])) continue
			const mask =
				fold.names.reduce((bits, name) => bits | bitOf(name), 0) >>> 0
			const unit = genreUnits.length
			genreUnits.push(mask)
			genreChosenUnits |= 1 << unit
			for (const name of fold.names) {
				covered.add(name)
				const b = names.indexOf(name)
				if (b >= 0 && genreOptionUnits[b] === undefined)
					genreOptionUnits[b] = unit
			}
		}
		for (const name of picked) {
			if (covered.has(name)) continue
			const related = GENRE_FOLDS.filter((fold) => fold.names[1] === name)
			if (!related.length) continue
			const unit = genreUnits.length
			const members = [...new Set(related.flatMap((fold) => fold.names))]
			genreUnits.push(
				members.reduce((bits, member) => bits | bitOf(member), 0) >>> 0,
			)
			genreChosenUnits |= 1 << unit
			for (const member of members) {
				covered.add(member)
				const b = names.indexOf(member)
				if (b >= 0) genreOptionUnits[b] = unit
			}
		}
		for (let b = 0; b < names.length; b++) {
			if (covered.has(names[b])) continue
			const related = GENRE_FOLDS.filter((fold) =>
				fold.names.includes(names[b]),
			)
			const mask = related.length
				? related.reduce(
						(bits, fold) =>
							bits | fold.names.reduce((m, name) => m | bitOf(name), 0),
						0,
					)
				: 1 << b
			let unit = genreUnits.indexOf(mask >>> 0)
			if (unit < 0) {
				unit = genreUnits.length
				genreUnits.push(mask >>> 0)
			}
			genreOptionUnits[b] = unit
			if (genreMask & (1 << b)) genreChosenUnits |= 1 << unit
		}
	}
	genreChosenUnits >>>= 0
	const genreBitsOf = (bits: number) => {
		let units = 0
		for (let u = 0; u < genreUnits.length; u++)
			if (bits & genreUnits[u]) units |= 1 << u
		return units >>> 0
	}
	const hasPicks = (bits: number, chosen: number, requireAll: boolean) =>
		requireAll ? (bits & chosen) >>> 0 === chosen >>> 0 : (bits & chosen) !== 0

	const votesAt = (row: number) => (row < 0 ? undefined : columns.votes[row])
	const rankAt = (row: number) =>
		row < 0 ? undefined : input.popularityRanks?.[row] || undefined
	const hasBudgetFilter = !!(
		bounded(input.budget) ||
		bounded(input.boxOffice) ||
		input.returns
	)
	const hasShowsFilter = !!(
		bounded(input.seasons) ||
		bounded(input.hours) ||
		input.showStatus
	)
	// Pass 1: fail masks.
	for (let i = 0; i < n; i++) {
		const row = rows[i]
		const key = keys[i]
		let mask = 0
		if (
			!within(votesAt(row), input.votes) ||
			!within(rankAt(row), input.popularityRank)
		)
			mask |= BIT.popularity
		if (servicesOn && !onServices(i)) mask |= BIT.services
		if (
			input.seenBefore && input.seen
				? !inSet(input.seen, i)
				: notSeen && inSet(notSeen, i)
		)
			mask |= BIT.notSeenYet
		if (input.onWishlist && input.wishlist && !inSet(input.wishlist, i))
			mask |= BIT.wishlist
		if (typeWanted >= 0 && (key >= SHOW_BASE ? 1 : 0) !== typeWanted)
			mask |= BIT.type
		if (animeWanted >= 0 && (isAnime(i) ? 1 : 0) !== animeWanted)
			mask |= BIT.anime
		if (moodMask && (row < 0 || !hasPicks(moods[row], moodMask, moodsAll)))
			mask |= BIT.moods
		if (themeMask && (row < 0 || !hasPicks(themes[row], themeMask, themesAll)))
			mask |= BIT.themes
		if (styleMask && (row < 0 || !hasPicks(styles[row], styleMask, stylesAll)))
			mask |= BIT.styles
		if (
			genresOn &&
			(row < 0 ||
				genresDead ||
				!hasPicks(
					genresAll ? genreBitsOf(genres[row]) : genres[row],
					genresAll ? genreChosenUnits : genreMask,
					genresAll,
				))
		)
			mask |= BIT.genres
		if (
			minScore > 0 &&
			(row < 0 || scores[row] === UNKNOWN_SCORE || scores[row] < minScore)
		)
			mask |= BIT.minScore
		if (
			matches &&
			(input.outsideUsual && input.outsideUsualAvailable !== false
				? matches[i] < 50 || matches[i] >= 60
				: minMatch > 0 && matches[i] < minMatch)
		)
			mask |= BIT.minMatch
		if (released) {
			const day = row < 0 ? UNKNOWN_DAY : releaseDays[row]
			if (day === UNKNOWN_DAY || day < released.from || day >= released.to)
				mask |= BIT.released
		}
		if (similar.length && !inAny(similar, i)) mask |= BIT.similarTo
		if (productionCountries.length && !inAny(productionCountries, i))
			mask |= BIT.productionCountries
		if (people.length && !inAny(people, i)) mask |= BIT.people
		if (legacy && !inSet(legacy, i)) mask |= BIT.legacy
		if (columns.facts) {
			const facts = columns.facts
			if (
				hasBudgetFilter &&
				(key >= SHOW_BASE ||
					row < 0 ||
					!withinFact(facts.budgets[row] / 1000, input.budget) ||
					!withinFact(facts.boxOffice[row] / 1000, input.boxOffice) ||
					!returnsPass(facts.budgets[row], facts.boxOffice[row], input.returns))
			)
				mask |= BIT.budget
			if (
				hasShowsFilter &&
				(key < SHOW_BASE ||
					row < 0 ||
					!withinFact(facts.seasons[row], input.seasons) ||
					!withinFact(
						(facts.episodes[row] * facts.lengths[row]) / 60,
						input.hours,
					) ||
					!statusPass(facts.showStatuses[row], input.showStatus))
			)
				mask |= BIT.shows
			if (
				input.yearRange &&
				!withinFact(
					row < 0 ? 0 : columns.facts.releaseYears[row],
					input.yearRange,
				)
			)
				mask |= BIT.years
			const lengthRange =
				keys[i] >= SHOW_BASE ? input.episodeRange : input.movieRange
			if (
				lengthRange &&
				!withinFact(row < 0 ? 0 : columns.facts.lengths[row], lengthRange)
			)
				mask |= BIT.runtime
		} else {
			if (input.years && !inSet(input.years, i)) mask |= BIT.years
			if (input.runtime && !inSet(input.runtime, i)) mask |= BIT.runtime
		}
		if (input.sourceScores && !inSet(input.sourceScores, i))
			mask |= BIT.sourceScores
		if (input.scoreGap && !inSet(input.scoreGap, i)) mask |= BIT.scoreGap
		if (ratings) {
			if (ageLimit >= 0 && ageOf(ratings, row) > ageLimit) mask |= BIT.ageLimit
			if (hiddenContent && row >= 0 && ratings.content[row] & hiddenContent)
				mask |= BIT.content
		}
		masks[i] = mask
	}

	// Passing titles and recoveries.
	const recovered = new Uint32Array(FILTER_NAMES.length)
	let total = 0
	for (let i = 0; i < n; i++) {
		const mask = masks[i]
		if (mask === 0) total++
		else if ((mask & (mask - 1)) === 0) recovered[lowestBit(mask)]++
	}
	const passing = new Int32Array(total)
	for (let i = 0, j = 0; i < n; i++) if (masks[i] === 0) passing[j++] = i
	const recoveries = FILTER_NAMES.map((filter, g) => ({
		filter,
		titles: recovered[g],
	}))
		.filter((r) => r.titles > 0)
		.sort((a, b) => b.titles - a.titles)

	// One pass per group over the titles every other group lets through.
	const passesOthers = (i: number, bit: number) => (masks[i] & ~bit) === 0
	const optionCounts = Object.fromEntries(
		FILTER_NAMES.filter(
			(name) =>
				![
					"popularity",
					"budget",
					"shows",
					"years",
					"runtime",
					"productionCountries",
				].includes(name),
		).map((name) => [name, {}]),
	) as FilterOptionCounts

	// Replacing one popularity range keeps the other sub-choice and every other group.
	if (input.popularityCounts)
		optionCounts.popularity = popularityCounts(input, masks)
	if (
		input.budgetCounts ||
		input.showsCounts ||
		input.releasedCounts ||
		input.lengthCounts ||
		input.originCounts
	)
		Object.assign(optionCounts, factCounts(input, masks))
	// Movies or shows.
	{
		let all = 0
		let shows = 0
		for (let i = 0; i < n; i++) {
			if (!passesOthers(i, BIT.type)) continue
			all++
			if (keys[i] >= SHOW_BASE) shows++
		}
		optionCounts.type = { all, movie: all - shows, show: shows }
	}

	// Anime.
	{
		let any = 0
		let only = 0
		for (let i = 0; i < n; i++) {
			if (!passesOthers(i, BIT.anime)) continue
			any++
			if (isAnime(i)) only++
		}
		optionCounts.anime = { any, only, none: any - only }
	}

	// Not seen yet.
	{
		let off = 0
		let on = 0
		let seen = 0
		for (let i = 0; i < n; i++) {
			if (!passesOthers(i, BIT.notSeenYet)) continue
			off++
			if (!inSet(input.seenOrSkipped, i)) on++
			if (!input.seen || inSet(input.seen, i)) seen++
		}
		optionCounts.notSeenYet = { on, off, seen }
	}
	{
		let on = 0
		let off = 0
		for (let i = 0; i < n; i++) {
			if (!passesOthers(i, BIT.wishlist)) continue
			off++
			if (!input.wishlist || inSet(input.wishlist, i)) on++
		}
		optionCounts.wishlist = { on, off }
	}

	// Streaming services: everywhere, the viewer's own, and each service toggled into the explicit choice.
	if (services.kind === "index") {
		const { index, availabilityRows } = services
		const size = index.services.length
		const mine = new Uint8Array(size)
		for (const s of services.mine) mine[s] = 1
		const chosen = new Uint8Array(size)
		for (const s of services.chosen) chosen[s] = 1
		const counts = new ToggleCounts(size)
		const { offsets, entries } = index
		let mineCount = 0
		let anyCount = 0
		for (let i = 0; i < n; i++) {
			if (!passesOthers(i, BIT.services)) continue
			const at = availabilityRows[i]
			const from = at < 0 ? 0 : offsets[at]
			const to = at < 0 ? 0 : offsets[at + 1]
			if (to > from) anyCount++
			let onMine = false
			let hits = 0
			let hit = 0
			for (let e = from; e < to; e++) {
				const s = entries[e]
				if (mine[s]) onMine = true
				if (chosen[s]) {
					hits++
					hit = s
				}
			}
			if (onMine) mineCount++
			if (counts.observe(hits, hit))
				for (let e = from; e < to; e++) counts.add[entries[e]]++
		}
		const serviceCounts: Record<string, number> = {
			all: counts.all,
			any: anyCount,
		}
		if (services.mine.length) serviceCounts.mine = mineCount
		const options = Array.from({ length: size }, (_, s) => ({
			s,
			isChosen: chosen[s] === 1,
			titles: counts.count(s, chosen[s] === 1, services.chosen.length),
		}))
			.filter((o) => o.isChosen || o.titles > 0)
			.sort(
				(a, b) =>
					Number(b.isChosen) - Number(a.isChosen) || b.titles - a.titles,
			)
			.slice(0, Math.max(MAX_SERVICE_OPTIONS, services.chosen.length))
		for (const o of options) serviceCounts[index.services[o.s]] = o.titles
		optionCounts.services = serviceCounts
	} else {
		let all = 0
		let mine = 0
		for (let i = 0; i < n; i++) {
			if (!passesOthers(i, BIT.services)) continue
			all++
			if (services.onMyServices && services.kept && inSet(services.kept, i))
				mine++
		}
		optionCounts.services = services.onMyServices ? { all, mine } : { all }
	}

	// Reuse one combination buffer across tag groups in this call (16 options = 65,536 entries, 256 KiB).
	// Above 16 options, count per title instead to bound allocation and table traversal.
	let combinationBuffer: Uint32Array | undefined
	// Tag groups: any of by default, opt-in all of; one bit per option.
	const bitGroup = (
		group: TagGroup,
		bit: number,
		column: Uint16Array | Uint32Array,
		selectedMask: number,
		names: readonly string[],
	) => {
		const requireAll = allOf.has(group)
		const folded = group === "genres" && requireAll
		const chosenMask = folded ? genreChosenUnits : selectedMask
		const counts = new ToggleCounts(names.length)
		const chosenCount = popcount(chosenMask)
		const intersection = requireAll ? new Uint32Array(names.length) : null
		const observe = (rawBits: number, titles: number) => {
			const bits = folded ? genreBitsOf(rawBits) : rawBits
			if (intersection) {
				if (group === "genres" && genresDead) return
				const missing = (chosenMask & ~bits) >>> 0
				if (missing === 0) {
					for (let m = bits; m; m = (m & (m - 1)) >>> 0)
						intersection[lowestBit(m)] += titles
				} else if (popcount(missing) === 1) {
					intersection[lowestBit(missing)] += titles
				}
				return
			}
			const hits = (bits & chosenMask) >>> 0
			if (counts.observe(popcount(hits), hits ? lowestBit(hits) : 0, titles))
				for (let m = bits; m; m = (m & (m - 1)) >>> 0)
					counts.add[lowestBit(m)] += titles
		}
		if (names.length <= 16) {
			// Few options: count the titles per combination of options first, then each combination once.
			const size = 1 << names.length
			if (!combinationBuffer || combinationBuffer.length < size)
				combinationBuffer = new Uint32Array(size)
			const combinations = combinationBuffer.subarray(0, size)
			combinations.fill(0)
			for (let i = 0; i < n; i++) {
				if ((masks[i] & ~bit) !== 0) continue
				const row = rows[i]
				combinations[row < 0 ? 0 : column[row]]++
			}
			for (let bits = 0; bits < combinations.length; bits++)
				if (combinations[bits]) observe(bits, combinations[bits])
		} else {
			for (let i = 0; i < n; i++) {
				if ((masks[i] & ~bit) !== 0) continue
				const row = rows[i]
				observe(row < 0 ? 0 : column[row] >>> 0, 1)
			}
		}
		const out: Record<string, number> = {}
		names.forEach((name, b) => {
			out[name] = intersection
				? intersection[folded ? genreOptionUnits[b] : b]
				: counts.count(b, (chosenMask & (1 << b)) !== 0, chosenCount)
		})
		return out
	}
	optionCounts.moods = bitGroup("moods", BIT.moods, moods, moodMask, MOOD_KEYS)
	optionCounts.themes = bitGroup(
		"themes",
		BIT.themes,
		themes,
		themeMask,
		THEME_KEYS,
	)
	optionCounts.styles = bitGroup(
		"styles",
		BIT.styles,
		styles,
		styleMask,
		STYLE_KEYS,
	)
	optionCounts.genres = bitGroup(
		"genres",
		BIT.genres,
		genres,
		genreMask,
		columns.genreNames,
	)

	// GoodWatch score and release: one choice each.
	{
		const thresholds = Uint8Array.from(MIN_SCORES)
		const scoreCounts = new Uint32Array(thresholds.length)
		const releasedEntries = Object.entries(input.releasedOptions)
		const releasedCounts = new Uint32Array(releasedEntries.length)
		// "Any" has no range: every title counts, a title with an unknown day too. The others hold days as int32, and
		// UNKNOWN_DAY (the lowest int32) is below every range.
		const ranged = releasedEntries.flatMap(([, r], o) => (r ? [o] : []))
		const clamp = (day: number) =>
			Math.max(UNKNOWN_DAY + 1, Math.min(2147483647, day))
		const froms = Int32Array.from(ranged, (o) =>
			clamp(releasedEntries[o][1]?.from ?? 0),
		)
		const tos = Int32Array.from(ranged, (o) =>
			clamp(releasedEntries[o][1]?.to ?? 0),
		)
		const unranged = releasedEntries.flatMap(([, r], o) => (r ? [] : [o]))
		const rangedCounts = new Uint32Array(ranged.length)
		let releasedAll = 0
		const minScoreBit = BIT.minScore
		const releasedBit = BIT.released
		// Titles per score first (UNKNOWN_SCORE included), then each option sums the scores it keeps.
		const perScore = new Uint32Array(256)
		for (let i = 0; i < n; i++) {
			if ((masks[i] & ~minScoreBit) !== 0) continue
			const row = rows[i]
			perScore[row < 0 ? UNKNOWN_SCORE : scores[row]]++
		}
		for (let score = 0; score < 256; score++) {
			scoreCounts[0] += perScore[score]
			if (score === UNKNOWN_SCORE) continue
			for (let o = 1; o < thresholds.length; o++)
				if (score >= thresholds[o]) scoreCounts[o] += perScore[score]
		}
		// Release
		const rangeCount = ranged.length
		for (let i = 0; i < n; i++) {
			if ((masks[i] & ~releasedBit) !== 0) continue
			releasedAll++
			const row = rows[i]
			const day = row < 0 ? UNKNOWN_DAY : releaseDays[row]
			for (let o = 0; o < rangeCount; o++)
				if (day >= froms[o] && day < tos[o]) rangedCounts[o]++
		}
		ranged.forEach((o, r) => {
			releasedCounts[o] = rangedCounts[r]
		})
		for (const o of unranged) releasedCounts[o] = releasedAll
		optionCounts.minScore = Object.fromEntries(
			MIN_SCORES.map((min, o) => [String(min), scoreCounts[o]]),
		)
		optionCounts.released = Object.fromEntries(
			releasedEntries.map(([name], o) => [name, releasedCounts[o]]),
		)
	}

	// Taste match: one choice. Titles per match first (0 is no match), then each option sums the matches it keeps.
	// Without taste every option leaves the same.
	{
		const perMatch = new Uint32Array(256)
		const minMatchBit = BIT.minMatch
		for (let i = 0; i < n; i++) {
			if ((masks[i] & ~minMatchBit) !== 0) continue
			perMatch[matches ? matches[i] : 0]++
		}
		const matchCounts = new Uint32Array(MIN_MATCHES.length)
		for (let match = 0; match < 256; match++)
			for (let o = 0; o < MIN_MATCHES.length; o++)
				if (!matches || match >= MIN_MATCHES[o])
					matchCounts[o] += perMatch[match]
		let outside = 0
		for (let match = 0; match < 256; match++)
			if (
				!matches ||
				input.outsideUsualAvailable === false ||
				(match >= 50 && match < 60)
			)
				outside += perMatch[match]
		optionCounts.minMatch = Object.fromEntries([
			...MIN_MATCHES.map((min, o) => [String(min), matchCounts[o]]),
			["outside", outside],
		])
	}

	// Similar to and cast and crew: counts only for the chosen options (removing each).
	const setGroup = (
		bit: number,
		sets: { option: string; keys: TitleSet }[],
	) => {
		if (!sets.length) return {}
		const counts = new ToggleCounts(sets.length)
		for (let i = 0; i < n; i++) {
			if (!passesOthers(i, bit)) continue
			let hits = 0
			let hit = 0
			for (let s = 0; s < sets.length; s++) {
				if (inSet(sets[s].keys, i)) {
					hits++
					hit = s
				}
			}
			counts.observe(hits, hit)
		}
		return Object.fromEntries(
			sets.map((set, s) => [set.option, counts.count(s, true, sets.length)]),
		)
	}
	optionCounts.similarTo = setGroup(BIT.similarTo, similar)
	optionCounts.people = setGroup(BIT.people, people)

	// Legacy filters: on or off as one.
	if (legacy) {
		let off = 0
		for (let i = 0; i < n; i++) if (passesOthers(i, BIT.legacy)) off++
		optionCounts.legacy = { on: total, off }
	}

	// Age limit and content. A step changes what content hides, so the age limit's options are counted over the titles
	// every group but these two lets through: per step, the titles at or below it without the content that step hides.
	// Content counts, per kind, the titles that have it among those every other group lets through, the age limit
	// included.
	if (ratings) {
		const both = BIT.ageLimit | BIT.content
		const ageLimitBit = BIT.ageLimit
		const { content } = ratings
		const COMBINATIONS = 1 << CONTENT_KINDS.length
		// Titles per age (UNRATED for none) and combination of kinds first, then each option sums what it keeps.
		const UNRATED = 19
		const perAge = new Uint32Array((UNRATED + 1) * COMBINATIONS)
		const withinLimit = new Uint32Array(COMBINATIONS)
		for (let i = 0; i < n; i++) {
			const mask = masks[i]
			if ((mask & ~both) !== 0) continue
			const row = rows[i]
			const age = ageOf(ratings, row)
			const kinds = row < 0 ? 0 : content[row] & (COMBINATIONS - 1)
			perAge[(age < UNRATED ? age : UNRATED) * COMBINATIONS + kinds]++
			if ((mask & ageLimitBit) === 0) withinLimit[kinds]++
		}
		const left = (maxAge: number, hidden: number) => {
			let titles = 0
			for (let age = 0; age <= maxAge; age++)
				for (let kinds = 0; kinds < COMBINATIONS; kinds++)
					if ((kinds & hidden) === 0)
						titles += perAge[age * COMBINATIONS + kinds]
			return titles
		}
		const ageCounts: Record<string, number> = {
			off: left(UNRATED, ratings.hiddenWhenOff),
		}
		for (const step of ratings.steps)
			ageCounts[String(step.age)] = left(
				Math.min(step.age, UNRATED - 1),
				step.hidden,
			)
		optionCounts.ageLimit = ageCounts
		optionCounts.content = Object.fromEntries(
			CONTENT_KINDS.map((kind, b) => {
				let titles = 0
				for (let kinds = 0; kinds < COMBINATIONS; kinds++)
					if (kinds & (1 << b)) titles += withinLimit[kinds]
				return [kind, titles]
			}),
		)
	}

	return { passing, recoveries, optionCounts }
}
