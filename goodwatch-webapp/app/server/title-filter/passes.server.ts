// The filter's passes over a universe of titles that is already in its plain order. One pass computes each title's
// fail mask: bit g is set when filter group g hides the title. A title with an empty mask passes; a title with exactly
// one bit set is what that group alone hides (its recovery). Then one pass per group over the titles every other group
// lets through counts what each of that group's options would leave.
import {
	FILTER_NAMES,
	type FilterName,
	MIN_SCORES,
} from "~/domain/filter-state"
import { MOOD_KEYS } from "~/domain/moods"
import type { AnimeChoice } from "~/domain/title-type"
import type { CountryServices } from "~/server/availability-index.server"
import {
	FLAG_ANIME,
	type TitleColumns,
	UNKNOWN_DAY,
	UNKNOWN_SCORE,
} from "~/server/title-snapshot/index.server"
import type { TitleKey } from "~/utils/title-key"

const SHOW_BASE = 2e12
const BIT = Object.fromEntries(
	FILTER_NAMES.map((name, i) => [name, 1 << i]),
) as Record<FilterName, number>
// Per-service option counts are reported for the services the most titles would show on, and the chosen ones.
const MAX_SERVICE_OPTIONS = 60

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

/** Everything the passes need, with every group resolved. A group is off when its field says so. */
export interface PassInput {
	columns: TitleColumns
	/** The universe in its plain order: snapshot row (-1 for a title the snapshot doesn't hold) and key per title. */
	rows: Int32Array
	keys: Float64Array
	services: ServicesFilter
	/** Seen and skipped titles; null when Not seen yet is off. */
	notSeen: TitleSet | null
	/** Always the full hidden set, for the Not seen yet option counts. */
	seenOrSkipped: TitleSet
	type: "all" | "movie" | "show"
	/** A title the snapshot doesn't hold counts as not anime. */
	anime: AnimeChoice
	/** Mood bits a title needs one of; 0 when off. */
	moods: number
	/** Genre bits a title needs one of; 0 when off. `genresChosen` says whether the filter is on (a genre not in the table has no bit). */
	genres: number
	genresChosen: boolean
	minScore: number
	released: DayRange | null
	releasedOptions: Record<string, DayRange | null>
	/** One set per chosen title or person; a title passes when any set holds it. Empty when off. */
	similarTo: { option: string; keys: TitleSet }[]
	people: { option: string; keys: TitleSet }[]
	legacy: TitleSet | null
}

export interface PassOutput {
	/** Universe positions (indexes into rows and keys) of the passing titles, in the plain order. */
	passing: Int32Array
	recoveries: { filter: FilterName; titles: number }[]
	optionCounts: Record<FilterName, Record<string, number>>
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

export function runPasses(input: PassInput): PassOutput {
	const { columns, rows, keys, services } = input
	const n = rows.length
	const { genres, moods, scores, releaseDays, flags } = columns
	const masks = new Uint16Array(n)

	// The type filter's rule (passesTitleType) over the columns: the format by the key, anime by the flag.
	const typeWanted = input.type === "all" ? -1 : input.type === "show" ? 1 : 0
	const animeWanted =
		input.anime === "any" ? -1 : input.anime === "only" ? 1 : 0
	const isAnime = (i: number) => {
		const row = rows[i]
		return row >= 0 && (flags[row] & FLAG_ANIME) !== 0
	}
	const moodMask = input.moods
	const genreMask = input.genres >>> 0
	const genresOn = input.genresChosen
	const minScore = input.minScore
	const released = input.released
	const similar = input.similarTo
	const people = input.people
	const legacy = input.legacy
	const notSeen = input.notSeen

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
		if (!keptServices) return true
		const at = services.availabilityRows[i]
		if (at < 0) return false
		const { offsets, entries } = services.index
		for (let e = offsets[at]; e < offsets[at + 1]; e++)
			if (keptServices[entries[e]]) return true
		return false
	}
	const servicesOn =
		services.kind === "index" ? keptServices !== null : services.kept !== null

	// Pass 1: fail masks.
	for (let i = 0; i < n; i++) {
		const row = rows[i]
		const key = keys[i]
		let mask = 0
		if (servicesOn && !onServices(i)) mask |= BIT.services
		if (notSeen && inSet(notSeen, i)) mask |= BIT.notSeenYet
		if (typeWanted >= 0 && (key >= SHOW_BASE ? 1 : 0) !== typeWanted)
			mask |= BIT.type
		if (animeWanted >= 0 && (isAnime(i) ? 1 : 0) !== animeWanted)
			mask |= BIT.anime
		if (moodMask && (row < 0 || (moods[row] & moodMask) === 0))
			mask |= BIT.moods
		if (genresOn && (row < 0 || (genres[row] & genreMask) === 0))
			mask |= BIT.genres
		if (
			minScore > 0 &&
			(row < 0 || scores[row] === UNKNOWN_SCORE || scores[row] < minScore)
		)
			mask |= BIT.minScore
		if (released) {
			const day = row < 0 ? UNKNOWN_DAY : releaseDays[row]
			if (day === UNKNOWN_DAY || day < released.from || day >= released.to)
				mask |= BIT.released
		}
		if (similar.length && !inAny(similar, i)) mask |= BIT.similarTo
		if (people.length && !inAny(people, i)) mask |= BIT.people
		if (legacy && !inSet(legacy, i)) mask |= BIT.legacy
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
		FILTER_NAMES.map((name) => [name, {}]),
	) as Record<FilterName, Record<string, number>>

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
		for (let i = 0; i < n; i++) {
			if (!passesOthers(i, BIT.notSeenYet)) continue
			off++
			if (!inSet(input.seenOrSkipped, i)) on++
		}
		optionCounts.notSeenYet = { on, off }
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
		for (let i = 0; i < n; i++) {
			if (!passesOthers(i, BIT.services)) continue
			const at = availabilityRows[i]
			const from = at < 0 ? 0 : offsets[at]
			const to = at < 0 ? 0 : offsets[at + 1]
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
		const serviceCounts: Record<string, number> = { all: counts.all }
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

	// Moods and genres: OR within the group, one bit per option.
	const bitGroup = (
		bit: number,
		column: Uint16Array | Uint32Array,
		chosenMask: number,
		names: readonly string[],
	) => {
		const counts = new ToggleCounts(names.length)
		const chosenCount = popcount(chosenMask)
		const observe = (bits: number, titles: number) => {
			const hits = (bits & chosenMask) >>> 0
			if (counts.observe(popcount(hits), hits ? lowestBit(hits) : 0, titles))
				for (let m = bits; m; m = (m & (m - 1)) >>> 0)
					counts.add[lowestBit(m)] += titles
		}
		if (names.length <= 16) {
			// Few options: count the titles per combination of options first, then each combination once.
			const combinations = new Uint32Array(1 << names.length)
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
			out[name] = counts.count(b, (chosenMask & (1 << b)) !== 0, chosenCount)
		})
		return out
	}
	optionCounts.moods = bitGroup(BIT.moods, moods, moodMask, MOOD_KEYS)
	optionCounts.genres = bitGroup(
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

	return { passing, recoveries, optionCounts }
}
