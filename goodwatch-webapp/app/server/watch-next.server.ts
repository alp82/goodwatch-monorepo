// Watch next: the top of the Wishlist under the person's chosen sort and moods, then the rest of the Wishlist in a
// stepped grid. Everything runs in memory over the viewer's Wishlist: facts and moods from the title snapshot, services
// from the availability index, and match from the person's taste. Only the titles the page shows first (the hero, its
// Then column, and the first two tiers) are read from Crate as cards; later tiers load as they scroll into view.
import { MOOD_KEYS, type MoodKey, maskOfMoods } from "~/domain/moods"
import {
	type Picks,
	WORD_BY_ID,
	type WordMasks,
	groupNumber,
	kindsMet,
	pickIds,
	trimPicks,
} from "~/domain/taste-picker"
import type { StyleKey, ThemeKey } from "~/domain/themes-styles"
import {
	type BestMatchPrompt,
	TIER_CAPS,
	type WatchNextSort,
	type WatchNextTierKey,
	type WatchNextTierSize,
} from "~/domain/watch-next"
import { type Misfit, minutesOver, misfitOf } from "~/domain/my-movies"
import { isOnServices } from "~/server/availability-index.server"
import { recordListExposure } from "~/server/list-exposure.server"
import { movieRuntimes } from "~/server/movie-runtimes.server"
import {
	type PickerChoice,
	type PickerGroup,
	hasChoice,
	masksOf,
	pickerCounts,
} from "~/server/taste-picker-counts"
import { type Taste, loadTaste } from "~/server/taste/index.server"
import {
	type CardService,
	MAX_KEYS,
	type TitleCard,
	getDisplayFields,
	getServiceCards,
	getTitleCards,
} from "~/server/title-cards.server"
import {
	type TitleSnapshot,
	getTitleSnapshot,
} from "~/server/title-snapshot/index.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import type { ViewerContext } from "~/server/viewer.server"
import type { TasteGroups } from "~/server/watch-next-taste-picker.server"
import { query } from "~/utils/crate"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"

import { recPersonalOrder } from "./features.server.ts"
import { createWatchNextPlanStore } from "./watch-next-plans.server.ts"
import {
	loadPersonalOrder,
	personalOrderExposure,
	orderPersonalOrder,
	mixPersonalOrderFitting,
	logPersonalOrder,
	type PersonalOrderRead,
} from "./personal-order/reader.server.ts"

export interface WatchNextOptions {
	/** Null or unavailable (Best match without taste): the default sort. */
	sort?: WatchNextSort | null
	moods?: MoodKey[]
	/** The taste picker's themes, styles, and taste groups (#677): up to three picks in all, moods included. */
	themes?: ThemeKey[]
	styles?: StyleKey[]
	taste?: number[]
	/** Ignored for a viewer without services. */
	onMyServices?: boolean
	/** Titles passed over with Not tonight during this visit: they go to the end of the view. */
	notTonight?: TitleKey[]
	/** My movies (#385): only the Wishlist's movies, and one group for what does not fit tonight. */
	kind?: "movie"
	/** My movies' "How long?": the minutes the person has. A movie that runs longer does not fit. */
	time?: number | null
}

/** A Wishlist title as Watch next shows it. */
export interface WatchNextTitle extends TitleCard {
	/** When the title was added to the Wishlist (ISO). */
	addedAt: string
	/** A film's release date or a show's last air date (YYYY-MM-DD). */
	releaseDate: string | null
	moods: MoodKey[]
	/** Passes On my services (when on) and has the picks (when any); on My movies, runs no longer than the time too. */
	fits: boolean
	/** On My movies: why the movie does not fit tonight. Left out when it fits, and on Watch next. */
	misfit?: Misfit
}

export interface WatchNextTier {
	key: WatchNextTierKey
	size: WatchNextTierSize
	/** Every title of the tier, in order. */
	keys: TitleKey[]
	/** Cards for the first two tiers, up to the tier's cap; null for later tiers (load them from /api/watch-next/cards). */
	titles: WatchNextTitle[] | null
}

export interface WatchNext {
	/** Opaque identity of the ordering plan used for all later member card batches. */
	planId: string | null
	/** Exposure record for the cards in this member's initial view; null for guests or a dropped write. */
	listId: string | null
	sort: WatchNextSort
	defaultSort: WatchNextSort
	moods: MoodKey[]
	/** The taste picker's picks besides the moods (#677). */
	themes: ThemeKey[]
	styles: StyleKey[]
	taste: number[]
	/** The taste picker's choices and counts (#677). */
	picker: WatchNextPicker
	onMyServices: boolean
	hasServices: boolean
	/** The viewer's own services, one per name, for the On my services control. */
	myServices: CardService[]
	/** The country's availability is still loading: On my services doesn't narrow yet, and mood counts ignore it. */
	servicesPending: boolean
	bestMatch: { available: boolean; prompt: BestMatchPrompt | null }
	/** Titles on the Wishlist. */
	total: number
	/** Titles that fit the moods and On my services. */
	fitting: number
	hero: WatchNextTitle | null
	/** Why the hero doesn't fit, when nothing fits: "closestToMoods" or "nothingOnServices". */
	heroNote: "closestToMoods" | "nothingOnServices" | "nothingInTime" | null
	/** The Then column: the next three titles after the hero. */
	thenColumn: WatchNextTitle[]
	tiers: WatchNextTier[]
	/** Wishlist titles per mood under the current services choice, whatever other moods are picked. */
	moodCounts: Record<MoodKey, number>
	/** Each mood's picture: a backdrop no other mood uses, from its first title in Best match order. */
	moodPictures: Record<MoodKey, { key: TitleKey; backdropPath: string } | null>
	/** With an empty Wishlist: "Start with this?", the best worthwhile suggestion for the moods and services. */
	start: TitleCard | null
	/** With fewer than SMALL_WISHLIST titles: a "Worth adding" row. */
	worthAdding: TitleCard[]
	/** On My movies: the minutes chosen under "How long?", null for any length. Left out on Watch next. */
	time?: number | null
}

/** The taste picker's choices on this list (#677). */
export interface WatchNextPicker {
	/** The picks as choice ids ("g1", "m:funny", "t:crime"), taste groups first. */
	picks: string[]
	/** Titles with the picks, under the services choice. */
	fitting: number
	/** The member's taste groups, largest first. */
	groups: Omit<PickerGroup, "carries">[]
	/** The taste groups, every mood, and the themes and styles the list holds (or that are picked), with counts. */
	choices: (PickerChoice & { picture: string | null })[]
	/** The tiles under "For you". */
	forYou: string[]
	/** After a pick: choices of another kind that would leave fewer titles. */
	narrow: string[]
}

const THEN = 3
export const SMALL_WISHLIST = 12
const WORTH_ADDING = 18
const DAY_MS = 86_400_000
// The snapshot's value for a fingerprint key without a score.
const MISSING_SCORE = 255

// Titles worth suggesting: well rated, voted on enough to be known, with a poster and a backdrop.
const SUGGEST_MIN_SCORE = 70
const SUGGEST_MIN_VOTES = 1000

type Plan = ReturnType<typeof planWatchNext>
const plans = createWatchNextPlanStore<Plan>()
const planChoice = (options: WatchNextOptions) =>
	JSON.stringify([
		options.sort ?? null,
		options.moods ?? [],
		options.themes ?? [],
		options.styles ?? [],
		options.taste ?? [],
		options.onMyServices ?? true,
		options.notTonight ?? [],
		options.kind ?? null,
		options.time ?? null,
	])

interface Entry {
	key: TitleKey
	addedAt: number
	moodMask: number
	/** The taste picker's words (null without a title analysis) and taste group (#677). */
	masks: WordMasks | null
	group: number | null
	hasBackdrop: boolean
	releaseDay: number | null
	score: number | null
	popularity: number
	/** null while the country's availability loads. */
	onServices: boolean | null
	/** Where the title falls in the person's range (Taste.percentile): what Best match sorts by. */
	percentile: number | null
	value: number | null
	fit: number
	/** My movies: minutes the movie runs over the chosen time; 0 when it fits or no time is chosen. */
	over: number
}

// What the sorts read, for Wishlist titles the snapshot lacks (no title analysis yet).
interface SortFacts {
	releaseDay: number | null
	score: number | null
	popularity: number
}

const OUTSIDE_KEEP_MS = 6 * 60 * 60 * 1000
const OUTSIDE_MAX_KEPT = 50_000
const OUTSIDE_BATCH = 500
const outsideKept = new Map<TitleKey, { at: number; facts: SortFacts | null }>()

/**
 * Sort facts for titles outside the title snapshot, from Crate by primary key and kept in memory for 6 hours, so
 * Newest release, Top rated, and Popular now also place Wishlist titles without a title analysis (about 2% of the
 * owner's Wishlist). Null marks a title Crate no longer has (deleted on TMDB): Watch next leaves it out, having
 * nothing to show for it. Only titles not kept yet are read.
 */
export async function sortFactsOutsideSnapshot(
	keys: Iterable<TitleKey>,
): Promise<Map<TitleKey, SortFacts | null>> {
	const snapshot = getTitleSnapshot()
	const now = Date.now()
	const found = new Map<TitleKey, SortFacts | null>()
	const toRead = { movie: [] as number[], show: [] as number[] }
	for (const key of keys) {
		if (snapshot?.has(key)) continue
		const kept = outsideKept.get(key)
		if (kept && now - kept.at < OUTSIDE_KEEP_MS) {
			found.set(key, kept.facts)
			continue
		}
		const { mediaType, tmdbId } = parseTitleKey(key)
		toRead[mediaType].push(tmdbId)
	}
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = toRead[type]
			for (let i = 0; i < ids.length; i += OUTSIDE_BATCH) {
				const batch = ids.slice(i, i + OUTSIDE_BATCH)
				const rows = await query<{
					tmdb_id: number
					day: number | null
					score: number | null
					popularity: number | null
				}>(
					`SELECT tmdb_id, ${type === "movie" ? "release_date" : "last_air_date"} AS day,
					 goodwatch_overall_score_normalized_percent AS score, popularity
					 FROM ${type} WHERE tmdb_id IN (${batch.map(() => "?").join(",")})
					 LIMIT ${batch.length}`,
					batch,
				)
				const read = new Map(rows.map((r) => [Number(r.tmdb_id), r]))
				for (const id of batch) {
					const row = read.get(id)
					const facts = row
						? {
								releaseDay:
									row.day === null
										? null
										: Math.floor(Number(row.day) / DAY_MS),
								// As the snapshot stores it: rounded down.
								score: row.score === null ? null : Math.floor(row.score),
								popularity: row.popularity ?? 0,
							}
						: null
					const key = titleKey(type, id)
					outsideKept.set(key, { at: now, facts })
					found.set(key, facts)
				}
			}
		}),
	)
	if (outsideKept.size > OUTSIDE_MAX_KEPT) outsideKept.clear()
	return found
}

/** Best match needs taste; guests hear why and are asked to sign up. */
export function bestMatchOf(
	ctx: ViewerContext,
	taste: Taste,
): WatchNext["bestMatch"] {
	const guest = ctx.viewer.kind === "guest"
	if (taste.signal === "some")
		return { available: true, prompt: guest ? "signUpToKeep" : null }
	if (guest && taste.ratings < 5)
		return { available: false, prompt: "signUpToLearn" }
	return { available: false, prompt: "rateMore" }
}

function sortValue(
	sort: WatchNextSort,
	entry: Omit<Entry, "value" | "fit" | "over" | "masks" | "group">,
	today: number,
): number | null {
	switch (sort) {
		case "match":
			return entry.percentile
		case "waiting":
			return -entry.addedAt
		case "added":
			return entry.addedAt
		case "newest":
			return entry.releaseDay === null || entry.releaseDay > today
				? null
				: entry.releaseDay
		case "top":
			return entry.score
		case "popular":
			return entry.popularity || null
	}
}

// Missing values go last; ties go to the newest added, then to the lower key.
function compareEntries(a: Entry, b: Entry): number {
	if (a.value === null || b.value === null) {
		if (a.value !== b.value) return a.value === null ? 1 : -1
	} else if (a.value !== b.value) return b.value - a.value
	return b.addedAt - a.addedAt || a.key - b.key
}

/**
 * The Wishlist in the requested order, with fits and tiers, all in memory. No Crate reads: `outside` holds the sort
 * facts of titles the snapshot lacks (see sortFactsOutsideSnapshot).
 */
export function planWatchNext(
	ctx: ViewerContext,
	taste: Taste,
	options: WatchNextOptions,
	outside: ReadonlyMap<TitleKey, SortFacts | null> = new Map(),
	/** Minutes per movie, for My movies with a time chosen (see movieRuntimes). */
	runtimes: ReadonlyMap<TitleKey, number | null> = new Map(),
	personalOrderRead?: PersonalOrderRead,
	/** The member's taste groups for the taste picker (#677); null for a guest or a member with fewer than two. */
	groups: TasteGroups | null = null,
) {
	const movies = options.kind === "movie"
	const time = movies ? (options.time ?? null) : null
	const snapshot = getTitleSnapshot()
	const bestMatch = bestMatchOf(ctx, taste)
	const defaultSort: WatchNextSort = bestMatch.available ? "match" : "added"
	const sort =
		options.sort && (options.sort !== "match" || bestMatch.available)
			? options.sort
			: defaultSort
	// Up to three picks of any kind; a taste group the member doesn't have is left out.
	const picks: Picks = trimPicks({
		moods: options.moods ?? [],
		themes: options.themes ?? [],
		styles: options.styles ?? [],
		taste: (options.taste ?? []).filter(
			(n) => n <= (groups?.groups.length ?? 0),
		),
	})
	const { moods } = picks
	const ids = pickIds(picks)
	const hasServices = ctx.services.length > 0
	const onMyServices = (options.onMyServices ?? true) && hasServices
	const today = Math.floor(Date.now() / DAY_MS)

	const keys = [...ctx.wishlist.keys()].filter(
		(key) =>
			outside.get(key) !== null &&
			(!movies || parseTitleKey(key).mediaType === "movie"),
	)
	const percentiles = taste.percentile(keys)
	let servicesPending = false
	const entries: Entry[] = keys.map((key, i) => {
		const facts = snapshot?.facts(key) ?? null
		const sortFacts = facts ?? outside.get(key) ?? null
		const onServices = hasServices
			? isOnServices(ctx.country, ctx.services, key)
			: false
		if (hasServices && onServices === null) servicesPending = true
		const base = {
			key,
			addedAt: ctx.wishlist.get(key)?.getTime() ?? 0,
			moodMask: facts ? maskOfMoods(facts.moods) : 0,
			masks: snapshot ? masksOf(snapshot, key) : null,
			group: groups?.groupOf(key) ?? null,
			hasBackdrop: facts?.hasBackdrop ?? false,
			releaseDay: sortFacts?.releaseDay ?? null,
			score: sortFacts?.score ?? null,
			popularity: sortFacts?.popularity ?? 0,
			onServices,
			percentile: percentiles[i],
		}
		return {
			...base,
			value: sortValue(sort, base, today),
			// One for each kind picked the title meets (any mood picked, any theme...), one for On my services. While
			// availability loads, On my services doesn't narrow.
			fit:
				kindsMet(ids, (id) => hasChoice(base, id)).met +
				(onMyServices && onServices !== false ? 1 : 0),
			over: minutesOver(runtimes.get(key) ?? null, time),
		}
	})
	entries.sort(compareEntries)

	const kindsPicked = kindsMet(ids, () => true).picked
	// Picks beyond moods: the tiers and captions speak of picks, not moods.
	const beyondMoods = ids.length > moods.length
	const need = kindsPicked + (onMyServices ? 1 : 0)
	const passed = new Set(options.notTonight ?? [])
	const order = [
		...entries.filter((e) => !passed.has(e.key)),
		...entries.filter((e) => passed.has(e.key)),
	]
	// Titles that fit come first, then those one condition short, then the rest; each in the sort's order. On My
	// movies a movie that runs over the chosen time comes after every movie that doesn't, the least over first.
	let ranked = [...order].sort(
		(a, b) =>
			Math.sign(a.over) - Math.sign(b.over) || b.fit - a.fit || a.over - b.over,
	)
	// The snapshot may reload while planFor awaits Valkey; never use mapping from another version.
	if (
		personalOrderRead?.data &&
		personalOrderRead.data.payload.snapshotVersion !== snapshot?.version
	)
		personalOrderRead = {
			data: null,
			fallbackReason: snapshot ? "snapshot-mismatch" : "snapshot-unavailable",
		}
	const flag = recPersonalOrder(
		ctx.viewer.kind === "member" ? ctx.viewer.userId : null,
	)
	const personalOrder = personalOrderExposure(
		flag,
		personalOrderRead ?? { data: null, fallbackReason: null },
	)
	if (sort === "match" && personalOrderRead && (flag.enabled || flag.shadow)) {
		const today = ranked.map((e) => e.key)
		if (personalOrderRead.data && snapshot) {
			const franchiseGroups = orderPersonalOrder(
				entries.map((e) => e.key),
				personalOrderRead.data,
				snapshot,
				false,
			)
			const byKey = new Map(entries.map((e) => [e.key, e]))
			let next = franchiseGroups.keys
				.map((k) => byKey.get(k)!)
				.sort(
					(a, b) =>
						Math.sign(a.over) - Math.sign(b.over) ||
						b.fit - a.fit ||
						a.over - b.over ||
						Number(passed.has(a.key)) - Number(passed.has(b.key)),
				)
			const fittingKeys = next
				.filter((e) => e.fit === need && !e.over && !passed.has(e.key))
				.map((e) => e.key)
			const mix = mixPersonalOrderFitting(
				fittingKeys,
				personalOrderRead.data,
				snapshot,
				franchiseGroups.ranks,
			)
			const replace = new Set(fittingKeys)
			let i = 0
			next = next.map((e) =>
				replace.has(e.key) ? byKey.get(mix.keys[i++])! : e,
			)
			// The composed franchise grouping metadata is cached. This plan's fitting mix must not mutate it.
			personalOrder.titles = new Map(
				[...franchiseGroups.titles].map(([key, value]) => [key, { ...value }]),
			)
			for (const key of mix.placed)
				personalOrder.titles.get(key)!.mixPlaced = true
			logPersonalOrder(
				ctx.viewer.kind === "member" ? ctx.viewer.userId : "",
				"watch-next",
				personalOrder,
				today,
				next.map((e) => e.key),
			)
			if (flag.enabled) {
				personalOrder.todayFirst100 = today.slice(0, 100)
				ranked = next
			} else
				personalOrder.personalOrderFirst100 = next
					.slice(0, 100)
					.map((e) => e.key)
		} else
			logPersonalOrder(
				ctx.viewer.kind === "member" ? ctx.viewer.userId : "",
				"watch-next",
				personalOrder,
				today,
			)
	}
	const fitting = ranked.filter((e) => e.fit === need && !e.over)
	const heroFits = fitting.length > 0 || ranked.length === 0
	const head = (heroFits ? fitting : ranked).slice(0, 1 + THEN)
	const inHead = new Set(head.map((e) => e.key))
	const rest = ranked.filter((e) => !inHead.has(e.key))

	const tier = (
		key: WatchNextTierKey,
		size: WatchNextTierSize,
		list: Entry[],
	) => ({ key, size, keys: list.map((e) => e.key) })
	let tiers: {
		key: WatchNextTierKey
		size: WatchNextTierSize
		keys: TitleKey[]
	}[]
	if (movies) {
		// My movies: what fits in three steps, then one group for everything that doesn't, each movie saying why.
		const fits = rest.filter((e) => e.fit === need && !e.over)
		tiers = [
			tier("upNext", "xl", fits.slice(0, 4)),
			tier("soon", "lg", fits.slice(4, 16)),
			tier("later", "md", fits.slice(16)),
			tier(
				"notTonightsFit",
				"md",
				rest.filter((e) => e.fit !== need || e.over),
			),
		]
	} else if (!need) {
		tiers = [
			tier("upNext", "xl", rest.slice(0, 4)),
			tier("soon", "lg", rest.slice(4, 12)),
			tier("later", "md", rest.slice(12, 32)),
			tier("someday", "sm", rest.slice(32)),
		]
	} else {
		const fits = rest.filter((e) => e.fit === need)
		const close = rest.filter((e) => e.fit === need - 1)
		const neither = rest.filter((e) => e.fit < need - 1)
		tiers = [
			tier("upNext", "xl", fits.slice(0, 4)),
			tier("soon", "lg", fits.slice(4, 16)),
			tier("later", "md", fits.slice(16)),
			tier(
				kindsPicked && onMyServices
					? "close"
					: kindsPicked
						? beyondMoods
							? "otherPicks"
							: "otherMoods"
						: "elsewhere",
				"md",
				close,
			),
			tier("notTonight", "sm", neither),
		]
	}
	tiers = tiers.filter((t) => t.keys.length)

	// Mood counts and pictures follow the services choice but not the other picked moods.
	const counted = entries.filter((e) => !onMyServices || e.onServices !== false)
	const moodCounts = Object.fromEntries(
		MOOD_KEYS.map((mood, bit) => [
			mood,
			counted.filter((e) => e.moodMask & (1 << bit)).length,
		]),
	) as Record<MoodKey, number>
	// Pictures in Best match order; without taste, in the default sort's (Last added), which needs no facts.
	const pictureOrder =
		sort === defaultSort
			? counted
			: counted
					.map((e) => ({
						...e,
						value: sortValue(defaultSort, e, today),
					}))
					.sort(compareEntries)

	return {
		sort,
		personalOrder,
		defaultSort,
		moods,
		picks,
		pickIds: ids,
		beyondMoods,
		groups,
		onMyServices,
		hasServices,
		servicesPending,
		bestMatch,
		total: entries.length,
		fitting: fitting.length,
		need,
		heroFits,
		heroNote: heroFits
			? null
			: // Only the time keeps every movie out: the hero is the one that runs over the least.
				ranked.some((e) => e.fit === need)
				? ("nothingInTime" as const)
				: ids.length
					? ("closestToMoods" as const)
					: ("nothingOnServices" as const),
		movies,
		time,
		head,
		tiers,
		entries: new Map(entries.map((e) => [e.key, e])),
		moodCounts,
		pictureOrder,
	}
}

// ---------------------------------------------------------------------------------------------------------------------
// Worthwhile suggestions: well-rated, known titles the person hasn't seen, skipped, or wished for, that fit the moods
// and services. Ranked by taste; without taste, by closeness to the Wishlist; with neither, by popularity.

interface SuggestionPool {
	version: string
	rows: Int32Array // snapshot rows, most popular first
	keys: Float64Array
	moodMasks: Uint16Array
}

let pool: SuggestionPool | null = null

function suggestionPool(snapshot: TitleSnapshot): SuggestionPool {
	if (pool?.version === snapshot.version) return pool
	const found: {
		row: number
		key: TitleKey
		mask: number
		popularity: number
	}[] = []
	snapshot.forEach((key, row) => {
		const facts = snapshot.factsAt(row)
		if (
			facts.hasPoster &&
			facts.hasBackdrop &&
			!facts.adult &&
			facts.votes >= SUGGEST_MIN_VOTES &&
			(facts.score ?? 0) >= SUGGEST_MIN_SCORE
		)
			found.push({
				row,
				key,
				mask: maskOfMoods(facts.moods),
				popularity: facts.popularity,
			})
	})
	found.sort((a, b) => b.popularity - a.popularity || a.key - b.key)
	pool = {
		version: snapshot.version,
		rows: Int32Array.from(found, (f) => f.row),
		keys: Float64Array.from(found, (f) => f.key),
		moodMasks: Uint16Array.from(found, (f) => f.mask),
	}
	return pool
}

// The mean of the Wishlist's unit-length fingerprints, as a unit vector; null without any.
function wishlistDirection(
	snapshot: TitleSnapshot,
	keys: Iterable<TitleKey>,
): Float32Array | null {
	const sum = new Float64Array(VALID_FINGERPRINT_KEYS.length)
	let n = 0
	for (const key of keys) {
		const fp = snapshot.fingerprint(key)
		if (!fp) continue
		let squares = 0
		for (let k = 0; k < fp.length; k++)
			if (fp[k] !== MISSING_SCORE) squares += fp[k] ** 2
		if (!squares) continue
		const inverse = 1 / Math.sqrt(squares)
		for (let k = 0; k < fp.length; k++)
			if (fp[k] !== MISSING_SCORE) sum[k] += fp[k] * inverse
		n++
	}
	if (!n) return null
	const norm = Math.hypot(...sum)
	return norm ? Float32Array.from(sum, (v) => v / norm) : null
}

/** Up to `count` worthwhile suggestions for the moods (any of them) and, when on, the viewer's services. */
export function worthwhileSuggestions(
	ctx: ViewerContext,
	taste: Taste,
	options: {
		moods: MoodKey[]
		onMyServices: boolean
		count: number
		/** My movies suggests movies only. */
		kind?: "movie"
	},
): TitleKey[] {
	const snapshot = getTitleSnapshot()
	if (!snapshot || options.count <= 0) return []
	const { rows, keys, moodMasks } = suggestionPool(snapshot)
	const moodMask = maskOfMoods(options.moods)
	const onMyServices = options.onMyServices && ctx.services.length > 0
	const eligible: number[] = []
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i]
		if (moodMask && !(moodMasks[i] & moodMask)) continue
		if (options.kind && parseTitleKey(key).mediaType !== options.kind) continue
		if (
			ctx.hidden.has(key) ||
			ctx.wishlist.has(key) ||
			ctx.seen.has(key) ||
			ctx.skipped.has(key)
		)
			continue
		// While the country's availability loads, services don't narrow.
		if (onMyServices && isOnServices(ctx.country, ctx.services, key) === false)
			continue
		eligible.push(i)
	}
	const direction =
		taste.vector ?? wishlistDirection(snapshot, ctx.wishlist.keys())
	if (!direction) return eligible.slice(0, options.count).map((i) => keys[i])
	const scored = eligible.map((i) => ({
		key: keys[i],
		cosine: snapshot.cosineAt(rows[i], direction) ?? -1,
	}))
	scored.sort((a, b) => b.cosine - a.cosine || a.key - b.key)
	return scored.slice(0, options.count).map((s) => s.key)
}

// ---------------------------------------------------------------------------------------------------------------------

function pictureKeys(plan: Plan, snapshot: TitleSnapshot | null) {
	const pictures: Partial<Record<MoodKey, TitleKey>> = {}
	const used = new Set<TitleKey>()
	const fallback = snapshot ? suggestionPool(snapshot) : null
	MOOD_KEYS.forEach((mood, bit) => {
		const candidates: TitleKey[] = []
		for (const e of plan.pictureOrder)
			if (e.moodMask & (1 << bit) && e.hasBackdrop) candidates.push(e.key)
		// A mood without Wishlist titles shows its most popular worthwhile title.
		if (fallback)
			for (let i = 0; i < fallback.keys.length && candidates.length < 40; i++)
				if (fallback.moodMasks[i] & (1 << bit))
					candidates.push(fallback.keys[i])
		const pick = candidates.find((key) => !used.has(key)) ?? candidates[0]
		if (pick !== undefined) {
			used.add(pick)
			pictures[mood] = pick
		}
	})
	return pictures
}

/**
 * The taste picker's choices with their counts, and a picture for each theme, style, and taste group: the first title
 * of the list with it in Best match order (as the moods'), a backdrop no mood or other choice uses where one is left.
 * A taste group with none of its titles on the list shows one of its loved titles.
 */
function pickerOf(plan: Plan, moodPictures: Set<TitleKey>) {
	const counted = plan.pictureOrder
	const groups = plan.groups?.groups ?? []
	const counts = pickerCounts(counted, plan.pickIds, groups)
	const used = new Set(moodPictures)
	const pictures = new Map<string, TitleKey>()
	for (const choice of counts.choices) {
		if (choice.id.startsWith("m:")) continue
		const candidates = counted
			.filter((e) => e.hasBackdrop && hasChoice(e, choice.id))
			.map((e) => e.key)
		const number = groupNumber(choice.id)
		const loved =
			number === null ? null : (plan.groups?.lovedPicture(number) ?? null)
		if (loved !== null) candidates.push(loved)
		const pick = candidates.find((key) => !used.has(key)) ?? candidates[0]
		if (pick === undefined) continue
		used.add(pick)
		pictures.set(choice.id, pick)
	}
	return { counts, groups, pictures }
}

const isoDay = (day: number | null) =>
	day === null ? null : new Date(day * DAY_MS).toISOString().slice(0, 10)

// The card of a title on the Wishlist, with what Watch next knows about it.
function wishlistTitle(plan: Plan, card: TitleCard): WatchNextTitle {
	const entry = plan.entries.get(card.key) as Entry
	const title: WatchNextTitle = {
		...card,
		addedAt: new Date(entry.addedAt).toISOString(),
		releaseDate: isoDay(entry.releaseDay),
		moods: MOOD_KEYS.filter((_, bit) => entry.moodMask & (1 << bit)),
		fits: entry.fit === plan.need && !entry.over,
	}
	if (!plan.movies) return title
	const misfit = misfitOf({
		over: entry.over,
		inMood:
			kindsMet(plan.pickIds, (id) => hasChoice(entry, id)).met ===
			kindsMet(plan.pickIds, () => true).picked,
		onServices: !plan.onMyServices || entry.onServices !== false,
		beyondMoods: plan.beyondMoods,
	})
	return misfit ? { ...title, misfit } : title
}

/** The plan for the viewer's options, with the reads it needs: sort facts outside the snapshot, and, once a time is chosen on My movies, the runtimes. */
async function planFor(
	ctx: ViewerContext,
	taste: Taste,
	options: WatchNextOptions,
) {
	const timed = options.kind === "movie" && options.time
	const [outside, runtimes] = await Promise.all([
		sortFactsOutsideSnapshot(ctx.wishlist.keys()),
		timed ? movieRuntimes(ctx.wishlist.keys()) : undefined,
	])
	const member = ctx.viewer.kind === "member" ? ctx.viewer.userId : null
	const flag = recPersonalOrder(member)
	const match =
		(!options.sort || options.sort === "match") &&
		bestMatchOf(ctx, taste).available
	const snapshot = getTitleSnapshot()
	const [personalOrderRead, groups] = await Promise.all([
		member && match && (flag.enabled || flag.shadow)
			? loadPersonalOrder(member, snapshot)
			: undefined,
		// Members' taste groups, loaded on first use (they pull in the Taste page's engine). Without them the picker
		// still offers moods, themes, and styles, so a failure leaves Watch next working.
		member && snapshot
			? import("./watch-next-taste-picker.server")
					.then((m) => m.tasteGroupsFor(ctx, taste, snapshot))
					.catch((error: unknown) => {
						console.warn("Watch next: taste groups unavailable", error)
						return null
					})
			: null,
	])
	return planWatchNext(
		ctx,
		taste,
		options,
		outside,
		runtimes,
		personalOrderRead,
		groups,
	)
}

/** Watch next for the viewer: the hero, its Then column, the tiers, mood counts and pictures, and suggestions. */
export async function getWatchNext(
	ctx: ViewerContext,
	options: WatchNextOptions,
	givenTaste?: Taste,
): Promise<WatchNext> {
	const taste = givenTaste ?? (await loadTaste(ctx.viewer))
	const plan = await planFor(ctx, taste, options)
	const snapshot = getTitleSnapshot()

	// Cards for what the page shows first: the hero, Then, and the first two tiers up to their caps.
	const shown = plan.tiers
		.slice(0, 2)
		.map((t) => t.keys.slice(0, Math.min(TIER_CAPS[t.size], MAX_KEYS)))
	const suggestions =
		plan.total < SMALL_WISHLIST
			? worthwhileSuggestions(ctx, taste, {
					moods: plan.moods,
					onMyServices: plan.onMyServices,
					count: WORTH_ADDING + (plan.total === 0 ? 1 : 0),
					...(plan.movies ? { kind: "movie" as const } : {}),
				})
			: []
	const pictures = pictureKeys(plan, snapshot)
	const picker = pickerOf(plan, new Set(Object.values(pictures)))
	const cardKeys = [
		...plan.head.map((e) => e.key),
		...shown.flat(),
		...suggestions,
	].slice(0, MAX_KEYS)
	const [cards, backdrops, myServices] = await Promise.all([
		getTitleCards(cardKeys, ctx, taste),
		getDisplayFields([...Object.values(pictures), ...picker.pictures.values()]),
		getServiceCards(ctx.services),
	])
	const cardOf = new Map(cards.map((card) => [card.key, card]))
	const titles = (keys: TitleKey[]) =>
		keys.flatMap((key) => {
			const card = cardOf.get(key)
			return card ? [wishlistTitle(plan, card)] : []
		})

	const headTitles = titles(plan.head.map((e) => e.key))
	const suggested = suggestions
		.map((key) => cardOf.get(key))
		.filter((card): card is TitleCard => !!card)
	const start = plan.total === 0 ? (suggested[0] ?? null) : null
	const tiers = plan.tiers.map((t, i) => ({
		...t,
		titles: i < 2 ? titles(shown[i]) : null,
	}))
	const worthAdding = suggested.filter((card) => card !== start)
	const listId = watchNextExposure(
		ctx,
		options,
		plan,
		[
			...headTitles,
			...tiers.flatMap((t) => t.titles ?? []),
			...(start ? [start] : []),
			...worthAdding,
		],
		"page",
	)

	return {
		listId,
		planId:
			ctx.viewer.kind === "member" &&
			(plan.personalOrder.flag.enabled || plan.personalOrder.flag.shadow)
				? plans.put(
						ctx.viewer.userId,
						planChoice(options),
						plan,
						plan.entries.size,
					)
				: null,
		sort: plan.sort,
		defaultSort: plan.defaultSort,
		moods: plan.moods,
		onMyServices: plan.onMyServices,
		hasServices: plan.hasServices,
		myServices,
		servicesPending: plan.servicesPending,
		bestMatch: plan.bestMatch,
		total: plan.total,
		fitting: plan.fitting,
		hero: headTitles[0] ?? null,
		heroNote: plan.heroNote,
		thenColumn: headTitles.slice(1),
		tiers,
		themes: plan.picks.themes,
		styles: plan.picks.styles,
		taste: plan.picks.taste,
		picker: {
			picks: plan.pickIds,
			fitting: picker.counts.fitting,
			groups: picker.groups.map(({ carries: _, ...g }) => g),
			choices: picker.counts.choices.map((choice) => {
				const key = choice.id.startsWith("m:")
					? pictures[WORD_BY_ID[choice.id].key as MoodKey]
					: picker.pictures.get(choice.id)
				return {
					...choice,
					picture:
						key === undefined
							? null
							: (backdrops.get(key)?.backdrop_path ?? null),
				}
			}),
			forYou: picker.counts.forYou,
			narrow: picker.counts.narrow,
		},
		moodCounts: plan.moodCounts,
		moodPictures: Object.fromEntries(
			MOOD_KEYS.map((mood) => {
				const key = pictures[mood]
				const backdropPath =
					key === undefined ? null : backdrops.get(key)?.backdrop_path
				return [
					mood,
					key !== undefined && backdropPath ? { key, backdropPath } : null,
				]
			}),
		) as WatchNext["moodPictures"],
		start,
		worthAdding,
		...(plan.movies ? { time: plan.time } : {}),
	}
}

/** Cards for Wishlist titles of later tiers, as they scroll into view. Keys not on the Wishlist are left out. */
export async function getWatchNextTitles(
	ctx: ViewerContext,
	keys: TitleKey[],
	options: WatchNextOptions,
	givenTaste?: Taste,
): Promise<WatchNextTitle[]> {
	return (await readWatchNextTitles(ctx, keys, options, givenTaste)).titles
}

/** One later batch for /api/watch-next/cards, with its own exposure id. */
export async function getWatchNextCardsPage(
	ctx: ViewerContext,
	keys: TitleKey[],
	options: WatchNextOptions,
	planId?: string | null,
): Promise<{
	titles: WatchNextTitle[]
	listId: string | null
	refreshRequired: boolean
}> {
	let retained: Plan | null = null
	const flag = recPersonalOrder(
		ctx.viewer.kind === "member" ? ctx.viewer.userId : null,
	)
	if (ctx.viewer.kind === "member" && (planId || flag.enabled || flag.shadow)) {
		retained = planId
			? plans.get(planId, ctx.viewer.userId, planChoice(options))
			: null
		// Fail closed: never attach a newly composed plan's provenance to old browser keys.
		if (!retained || keys.some((key) => !retained!.entries.has(key)))
			return { titles: [], listId: null, refreshRequired: true }
	}
	const { plan, titles } = await readWatchNextTitles(
		ctx,
		keys,
		options,
		undefined,
		retained ?? undefined,
	)
	return {
		titles,
		listId: watchNextExposure(ctx, options, plan, titles, "cards"),
		refreshRequired: false,
	}
}

async function readWatchNextTitles(
	ctx: ViewerContext,
	keys: TitleKey[],
	options: WatchNextOptions,
	givenTaste?: Taste,
	retained?: Plan,
) {
	const taste = givenTaste ?? (await loadTaste(ctx.viewer))
	const plan = retained ?? (await planFor(ctx, taste, options))
	const wanted = keys
		.filter((key) => plan.entries.has(key) && ctx.wishlist.has(key))
		.slice(0, MAX_KEYS)
	const cards = await getTitleCards(wanted, ctx, taste)
	return { plan, titles: cards.map((card) => wishlistTitle(plan, card)) }
}

function watchNextExposure(
	ctx: ViewerContext,
	options: WatchNextOptions,
	plan: Plan,
	titles: TitleCard[],
	batch: "page" | "cards",
) {
	return recordListExposure(ctx, {
		surface: "watch-next",
		ordering: plan.personalOrder.todayFirst100 ? "personal-order" : "taste-v2",
		flags: { REC_G1_ORDER: plan.personalOrder.flag.enabled },
		personalOrder: plan.personalOrder,
		watchNextTiers: new Map([
			...plan.head.map((e, i) => [e.key, i === 0 ? "hero" : "then"] as const),
			...plan.tiers.flatMap((t) => t.keys.map((k) => [k, t.key] as const)),
		]),
		sort: plan.sort,
		sortRequested: options.sort ?? null,
		// Watch next has no For you switch: its Best match sort already orders by taste.
		forYou: false,
		forYouApplied: false,
		filters: {
			type: options.kind ?? "all",
			onMyServices: plan.onMyServices,
			moods: plan.moods,
			themes: plan.picks.themes,
			styles: plan.picks.styles,
			taste: plan.picks.taste,
			minMatch: 0,
			notTonight: options.notTonight ?? [],
			time: plan.time,
		},
		page: null,
		batch,
		titles,
	})
}
