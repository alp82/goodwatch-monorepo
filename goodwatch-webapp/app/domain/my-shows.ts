// My shows (#385): where each of a member's shows goes on the page, in which order, its Next episode, and Tonight's
// pick. Pure and shared by the server and the browser. Everything is derived on every read from the member data's
// `watchState` entries and the catalog's side of each show; nothing here is stored
// (docs/implementation/tracking/data-model.md, "Stored versus derived" and "Reads").
import type { WatchStateEntry } from "./tracking/storage"

/** "Watched in the last 30 days" (C3) goes by the entry's `lastActivityAt`. */
export const ACTIVE_DAYS = 30
const DAY_MS = 86_400_000

/** What the catalog says about a show: `show.aired_episode_count`, and whether `show.status` is neither Ended nor Canceled. */
export interface ShowCatalogFacts {
	/** Null while the catalog has no count for the show. */
	airedEpisodes: number | null
	running: boolean
}

/** TMDB's statuses of a show that has no more episodes to come. */
export const isRunning = (status: string | null | undefined) =>
	Boolean(status) && status !== "Ended" && status !== "Canceled"

export interface TrackedShow {
	id: number
	entry: WatchStateEntry
	/** Null when the catalog has no row for the show. */
	catalog: ShowCatalogFacts | null
}

/** A Want to See show. One that the member has started is left out of Start. */
export interface StartCandidate {
	id: number
	/** Taste match, 50 to 99; null without taste or without a fingerprint. */
	match: number | null
	/** When it was added to the Wishlist, in milliseconds. */
	addedAt: number
}

export interface ShowRow {
	id: number
	state: WatchStateEntry["state"]
	/** `next`: a Watching show to continue. `seenNew`: a Seen show with new episodes. `quiet`: every other group. */
	kind: "next" | "seenNew" | "quiet"
	/** Different regular episodes watched in the current pass, never more than have aired. */
	watched: number
	/** Null while the catalog has no count. */
	aired: number | null
	/** Aired episodes not watched yet: what is left of a Watching show, what is new on a Seen one. */
	left: number
	running: boolean
	furthest: [number, number] | null
	/** C3, in milliseconds; null when the member's watches of the show say nothing about when. */
	lastActivityAt: number | null
}

export interface StartRow {
	id: number
	match: number | null
}

export interface MyShowsPlan {
	/** Watching with a Next episode and activity in the last 30 days, most recent first; then Seen with new episodes. */
	continue: ShowRow[]
	/** Want to See shows not started, best taste match first. */
	start: StartRow[]
	/** Watching with a Next episode, not watched for 30 days. */
	older: ShowRow[]
	/** Nothing to watch right now: Seen and still running, or Watching with every aired episode watched. */
	waiting: ShowRow[]
	onHold: ShowRow[]
	dropped: ShowRow[]
	/** Shows on the page. */
	total: number
}

const time = (value: Date | string | number | null) =>
	value === null ? null : new Date(value).getTime()

// Most recent first; shows without an activity date last, then by id so the order never flickers.
const byActivity = (a: ShowRow, b: ShowRow) =>
	(b.lastActivityAt ?? Number.NEGATIVE_INFINITY) -
		(a.lastActivityAt ?? Number.NEGATIVE_INFINITY) || a.id - b.id

export function planMyShows(input: {
	shows: readonly TrackedShow[]
	starts: readonly StartCandidate[]
	now: number
}): MyShowsPlan {
	const plan: MyShowsPlan = {
		continue: [],
		start: [],
		older: [],
		waiting: [],
		onHold: [],
		dropped: [],
		total: 0,
	}
	const seenNew: ShowRow[] = []
	const since = input.now - ACTIVE_DAYS * DAY_MS
	const tracked = new Set<number>()
	for (const { id, entry, catalog } of input.shows) {
		tracked.add(id)
		const aired = catalog?.airedEpisodes ?? null
		// A device ahead of UTC can hold one watched episode more than has aired (C4): lists cap the count.
		const watched =
			aired === null
				? entry.episodesWatched
				: Math.min(entry.episodesWatched, aired)
		const row: ShowRow = {
			id,
			state: entry.state,
			kind: "quiet",
			watched,
			aired,
			left: aired === null ? 0 : aired - watched,
			running: catalog?.running ?? false,
			furthest: entry.furthest,
			lastActivityAt: time(entry.lastActivityAt),
		}
		if (entry.state === "on_hold") plan.onHold.push(row)
		else if (entry.state === "dropped") plan.dropped.push(row)
		else if (entry.state === "seen") {
			if (row.left > 0) seenNew.push({ ...row, kind: "seenNew" })
			else if (row.running) plan.waiting.push(row)
			// Seen, ended and nothing new: not on this page. It is in My library.
		} else if (aired !== null && row.left === 0) plan.waiting.push(row)
		else if (row.lastActivityAt !== null && row.lastActivityAt >= since)
			plan.continue.push({ ...row, kind: "next" })
		else plan.older.push({ ...row, kind: "next" })
	}
	plan.continue.sort(byActivity)
	plan.continue.push(...seenNew.sort(byActivity))
	for (const group of [plan.older, plan.waiting, plan.onHold, plan.dropped])
		group.sort(byActivity)
	plan.start = input.starts
		.filter((show) => !tracked.has(show.id))
		.sort(
			(a, b) =>
				(b.match ?? -1) - (a.match ?? -1) ||
				b.addedAt - a.addedAt ||
				a.id - b.id,
		)
		.map(({ id, match }) => ({ id, match }))
	plan.total =
		plan.continue.length +
		plan.start.length +
		plan.older.length +
		plan.waiting.length +
		plan.onHold.length +
		plan.dropped.length
	return plan
}

// ---------------------------------------------------------------------------------------------------------
// The Next episode, from a show's cached episode list

export interface ListedShowEpisode {
	season: number
	number: number
	name: string | null
	/** TMDB's calendar date, "YYYY-MM-DD"; null when unknown, and then the episode has not aired. */
	airDate: string | null
}

const airedRegular = <E extends ListedShowEpisode>(
	episodes: readonly E[],
	utcToday: string,
) =>
	episodes
		.filter((e) => e.season > 0 && e.airDate !== null && e.airDate <= utcToday)
		.sort((a, b) => a.season - b.season || a.number - b.number)

/**
 * The first aired regular episode after the furthest one watched in the current pass. Nothing after `furthest` is
 * watched in the pass, by what furthest means, so this is the Next episode whenever it finds one. Null: nothing has
 * aired after it, and the Next episode, if there is one, is in a gap (`nextEpisodeInGap`).
 */
export function nextEpisodeAfter<E extends ListedShowEpisode>(
	episodes: readonly E[],
	furthest: readonly [number, number] | null,
	utcToday: string,
): E | null {
	const aired = airedRegular(episodes, utcToday)
	if (!furthest) return aired[0] ?? null
	const [season, number] = furthest
	return (
		aired.find(
			(e) => e.season > season || (e.season === season && e.number > number),
		) ?? null
	)
}

/** The key of an episode in a set of watched episodes: `<season>-<number>`. */
export const episodeKey = (season: number, number: number) =>
	`${season}-${number}`

/** The earliest aired regular episode the member has not watched in the current pass. */
export function nextEpisodeInGap<E extends ListedShowEpisode>(
	episodes: readonly E[],
	watched: ReadonlySet<string>,
	utcToday: string,
): E | null {
	return (
		airedRegular(episodes, utcToday).find(
			(e) => !watched.has(episodeKey(e.season, e.number)),
		) ?? null
	)
}

// ---------------------------------------------------------------------------------------------------------
// Tonight's pick

export type TonightChoice =
	| { kind: "episode"; showId: number }
	| { kind: "movie"; movieId: number }
	| { kind: "start"; showId: number }

/**
 * Tonight's pick: the Next episode of the Watching show the member was last active on in the last 30 days; without
 * one, the first movie of My movies; without one, the first show to start. A Seen show with new episodes is in
 * Continue and is never the pick.
 */
export function tonightsPickOf(
	plan: Pick<MyShowsPlan, "continue" | "start">,
	firstMovie: number | null,
): TonightChoice | null {
	const first = plan.continue[0]
	if (first?.kind === "next") return { kind: "episode", showId: first.id }
	if (firstMovie !== null) return { kind: "movie", movieId: firstMovie }
	const start = plan.start[0]
	return start ? { kind: "start", showId: start.id } : null
}

// ---------------------------------------------------------------------------------------------------------
// Words

/** "S2 E3". */
export const episodeCode = (episode: { season: number; number: number }) =>
	`S${episode.season} E${episode.number}`

const plural = (n: number, one: string, many = `${one}s`) =>
	`${n} ${n === 1 ? one : many}`

/** The fact that places a row in Continue: "Watched yesterday". */
export function activityWords(at: number | null, now: number): string {
	if (at === null) return "No date for your last watch"
	// By the calendar (UTC), as a watch's day reads elsewhere: last evening is yesterday, not "today".
	const days = Math.max(0, Math.floor(now / DAY_MS) - Math.floor(at / DAY_MS))
	if (days < 1) return "Watched today"
	if (days < 2) return "Watched yesterday"
	if (days < 30) return `Watched ${days} days ago`
	if (days < 90) return `Watched ${plural(Math.floor(days / 7), "week")} ago`
	if (days < 365) return `Watched ${plural(Math.round(days / 30), "month")} ago`
	return `Watched ${plural(Math.floor(days / 365), "year")} ago`
}

/** "12 of 40 episodes"; "12 episodes watched" while the catalog has no count. */
export const progressWords = (row: Pick<ShowRow, "watched" | "aired">) =>
	row.aired === null
		? `${plural(row.watched, "episode")} watched`
		: `${row.watched} of ${plural(row.aired, "episode")}`

/** What starting a show costs: "2 seasons · 12 episodes · about 9 h". */
export function costWords(show: {
	seasons: number | null
	episodes: number | null
	episodeMinutes: number | null
}): string {
	const hours =
		show.episodes && show.episodeMinutes
			? Math.max(1, Math.round((show.episodes * show.episodeMinutes) / 60))
			: null
	return [
		show.seasons ? plural(show.seasons, "season") : null,
		show.episodes ? plural(show.episodes, "episode") : null,
		hours ? `about ${hours} h` : null,
	]
		.filter(Boolean)
		.join(" · ")
}
