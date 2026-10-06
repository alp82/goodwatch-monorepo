// PROTOTYPE, not production code. Answers "Tracking rules as runnable scenarios" (issue #368).
//
// The settled rules for episode tracking and show statuses (map #365, CONTEXT.md, ADR 0008) as one pure module:
// no storage, no interface, no network. A world is a show's episode list, one member's data for that show, and a
// clock. `step` applies one action and returns the next world; `view` derives everything a surface would show.
//
// Every rule that could go more than one way is a field of `Rules`. `SETTLED` holds the settled reading where
// the map, the glossary, or ADR 0008 speak, and this prototype's proposal where they are silent. To try the
// other reading, pass a changed copy. The report in docs/prototypes/tracking-rules says which is which.

// ---------------------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------------------

export type EpisodeType = "standard" | "mid_season" | "finale"

export interface Episode {
	tmdbId: number
	/** 0 holds the specials. */
	season: number
	number: number
	/** TMDB's date, `YYYY-MM-DD`, without a time or a time zone. Null when TMDB has none. */
	airDate: string | null
	type: EpisodeType
	/** TMDB no longer lists it. The row stays so a watch can still name it. */
	removed: boolean
}

export type TmdbStatus =
	| "Returning Series"
	| "Ended"
	| "Canceled"
	| "In Production"
	| "Planned"

export interface Show {
	name: string
	tmdbStatus: TmdbStatus
	episodes: Episode[]
}

export type WatchDate =
	| { precision: "moment"; at: string }
	| { precision: "day"; day: string }
	| { precision: "unknown" }

export type WatchOrigin =
	| { by: "hand" }
	/** Which bulk action made it: Seen on the show, a whole season, or "up to here". */
	| { by: "bulk"; action: "show" | "season" | "up-to" }
	| { by: "import"; importId: string }

export interface Watch {
	of:
		| { kind: "film" }
		| { kind: "episode"; tmdbId: number; season: number; number: number }
	date: WatchDate
	origin: WatchOrigin
	pass: number
	/** When the row was written. Not the watch's date. */
	recordedAt: string
}

export type ShowStatus = "watching" | "on_hold" | "dropped"

export interface Member {
	watches: Watch[]
	rating: { score: number; at: string } | null
	wantToSee: boolean
	notInterested: boolean
	status: { value: ShowStatus; changedAt: string } | null
	/** The per-title summary row of ADR 0008: the show counts as Seen since then, by a press or by watching. */
	seen: { since: string; by: "press" | "watching" } | null
	ratePromptDismissed: boolean
}

export interface Clock {
	/** An instant, ISO 8601 in UTC. */
	now: string
	/** The member's offset from UTC in minutes: Los Angeles in summer is -420, Auckland in summer 780. */
	utcOffsetMinutes: number
}

export interface World {
	show: Show
	member: Member
	clock: Clock
	/** True: the title is a film. The episode list is unused, and a film never gets a status. */
	film?: boolean
}

// ---------------------------------------------------------------------------------------------------------
// Rules that could go more than one way
// ---------------------------------------------------------------------------------------------------------

export interface Rules {
	/** Whose calendar decides "today" for "aired". Map: the member's. Research: UTC. */
	airedBy: "member-date" | "utc-date"
	/** A watch whose episode id TMDB no longer lists. ADR 0008: kept, never counts. */
	goneEpisode: "never-counts" | "same-number"
	/** Glossary: the earliest aired regular episode without a watch. */
	nextEpisode: "earliest-unwatched" | "after-furthest"
	/** Map: removing Seen removes only bulk watches. Whether that means every bulk watch or only Seen's own. */
	removeSeenRemoves: "all-bulk" | "show-bulk"
	/** Research: the highest season with an aired or dated episode is the one judged, so a dated premiere counts. */
	upcomingSeason: "airing" | "not-airing"
	/** Research: an episode without a date has not aired, so it keeps its season airing. */
	undatedEpisode: "keeps-airing" | "ignored"
	/** Research: status Ended or Canceled means no season is airing, whatever is listed. */
	endedStatus: "closes-season" | "ignored-while-episodes-ahead"
	/** Research: 45 days after the last aired episode, a season without a finale is over. */
	airingGapDays: number
	/** The same gap when the last aired episode is marked `mid_season`. Research: no difference. */
	midSeasonGapDays: number
	/** Map: a show stays Seen when later episodes air. `reopen`: not when they belong to a season already begun. */
	laterEpisodes: "stay-seen" | "reopen"
	/** Proposal. Pressing Seen while a season is airing. The glossary's Seen needs "no season still airing". */
	seenPressWhileAiring: "caught-up" | "seen"
	/** Proposal. Unmarking an episode that had aired when the show became Seen. */
	unmarkOnSeen: "removes-seen" | "keeps-seen"
	/** Proposal. Seen is decided when somebody looks, or worked out from the dates of the watches. */
	seenEvaluation: "when-looked-at" | "from-history"
	/** Proposal. Whether watching a special starts the show (Watching, clears Want to See and Not interested). */
	specialStartsShow: boolean
	/** Proposal. Whether a listed episode that has not aired can be marked by hand. */
	markUnaired: "allowed" | "refused"
	/** Proposal. A show marked Seen without an episode list gets bulk watches when the list appears. */
	backfillWhenListAppears: boolean
}

export const SETTLED: Rules = {
	airedBy: "member-date",
	goneEpisode: "never-counts",
	nextEpisode: "earliest-unwatched",
	removeSeenRemoves: "all-bulk",
	upcomingSeason: "airing",
	undatedEpisode: "keeps-airing",
	endedStatus: "closes-season",
	airingGapDays: 45,
	midSeasonGapDays: 45,
	laterEpisodes: "stay-seen",
	seenPressWhileAiring: "caught-up",
	unmarkOnSeen: "removes-seen",
	seenEvaluation: "when-looked-at",
	specialStartsShow: false,
	markUnaired: "allowed",
	backfillWhenListAppears: true,
}

// ---------------------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------------------

const DAY_MS = 86_400_000
const dayOf = (instant: string) => instant.slice(0, 10)
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`)

export const addDays = (day: string, days: number) =>
	new Date(dayMs(day) + days * DAY_MS).toISOString().slice(0, 10)

const daysBetween = (from: string, to: string) =>
	Math.round((dayMs(to) - dayMs(from)) / DAY_MS)

/** The calendar day that counts as today for "aired". */
export function todayOf(clock: Clock, rules: Rules): string {
	if (rules.airedBy === "utc-date") return dayOf(clock.now)
	return new Date(Date.parse(clock.now) + clock.utcOffsetMinutes * 60_000)
		.toISOString()
		.slice(0, 10)
}

// ---------------------------------------------------------------------------------------------------------
// Episodes
// ---------------------------------------------------------------------------------------------------------

const isRegular = (episode: Episode) => episode.season > 0
const inOrder = (a: Episode, b: Episode) =>
	a.season - b.season || a.number - b.number
const listed = (show: Show) => show.episodes.filter((e) => !e.removed)

export const episodeLabel = (e: { season: number; number: number }) =>
	e.season === 0 ? `Special ${e.number}` : `S${e.season}E${e.number}`

/** Aired: listed, dated, and the date is today or earlier. An episode without a date has not aired. */
export const hasAired = (episode: Episode, today: string) =>
	!episode.removed && episode.airDate !== null && episode.airDate <= today

/** The listed episode a watch counts for, or null when it counts for none. */
export function episodeOfWatch(
	show: Show,
	watch: Watch,
	rules: Rules,
): Episode | null {
	if (watch.of.kind !== "episode") return null
	const of = watch.of
	const live = listed(show)
	const byId = live.find((e) => e.tmdbId === of.tmdbId)
	if (byId) return byId
	if (rules.goneEpisode === "never-counts") return null
	const sameNumber = live.filter(
		(e) => e.season === of.season && e.number === of.number,
	)
	return sameNumber.length === 1 ? sameNumber[0] : null
}

/**
 * The season that is still airing, or null. The research's rule: the highest regular season with an aired or
 * dated episode, unless the show is Ended or Canceled, when it lists an episode that has not aired, or its
 * last aired episode is not a finale and aired within the gap.
 */
export function seasonStillAiring(
	show: Show,
	today: string,
	rules: Rules,
): number | null {
	const regular = listed(show).filter(isRegular)
	const judgedSeasons = regular
		.filter((e) =>
			rules.upcomingSeason === "airing"
				? e.airDate !== null
				: hasAired(e, today),
		)
		.map((e) => e.season)
	if (judgedSeasons.length === 0) return null
	const judged = Math.max(...judgedSeasons)
	const season = regular.filter((e) => e.season === judged)
	const datedAhead = season.some((e) => e.airDate !== null && e.airDate > today)
	const over = show.tmdbStatus === "Ended" || show.tmdbStatus === "Canceled"
	if (over && !(rules.endedStatus === "ignored-while-episodes-ahead" && datedAhead))
		return null
	if (datedAhead) return judged
	if (
		rules.undatedEpisode === "keeps-airing" &&
		season.some((e) => e.airDate === null)
	)
		return judged
	const aired = season
		.filter((e) => hasAired(e, today))
		.sort((a, b) => (a.airDate as string).localeCompare(b.airDate as string) || inOrder(a, b))
	const last = aired[aired.length - 1]
	if (!last || last.type === "finale") return null
	const gap =
		last.type === "mid_season" ? rules.midSeasonGapDays : rules.airingGapDays
	return daysBetween(last.airDate as string, today) <= gap ? judged : null
}

// ---------------------------------------------------------------------------------------------------------
// Facts: what the watches and the episode list say on one day
// ---------------------------------------------------------------------------------------------------------

/** The day a watch is known to have happened by: its own date, or the day the row was written. */
const knownDay = (watch: Watch) =>
	watch.date.precision === "moment"
		? dayOf(watch.date.at)
		: watch.date.precision === "day"
			? watch.date.day
			: dayOf(watch.recordedAt)

interface Facts {
	today: string
	airedRegular: Episode[]
	watchedIds: Set<number>
	/** Watched regular episodes, aired or not. */
	watchedRegular: number
	/** Every aired regular episode has a watch, and there is at least one. */
	watchedThrough: boolean
	airingSeason: number | null
}

/** `asOf`: the facts as they stood on an earlier day, from today's episode list and the watches known by then. */
function factsOf(world: World, rules: Rules, asOf?: string): Facts {
	const today = asOf ?? todayOf(world.clock, rules)
	const watchedIds = new Set<number>()
	for (const watch of world.member.watches) {
		if (asOf && knownDay(watch) > asOf) continue
		const episode = episodeOfWatch(world.show, watch, rules)
		if (episode) watchedIds.add(episode.tmdbId)
	}
	const regular = listed(world.show).filter(isRegular).sort(inOrder)
	const airedRegular = regular.filter((e) => hasAired(e, today))
	return {
		today,
		airedRegular,
		watchedIds,
		watchedRegular: regular.filter((e) => watchedIds.has(e.tmdbId)).length,
		watchedThrough:
			airedRegular.length > 0 &&
			airedRegular.every((e) => watchedIds.has(e.tmdbId)),
		airingSeason: seasonStillAiring(world.show, today, rules),
	}
}

// ---------------------------------------------------------------------------------------------------------
// Derived view
// ---------------------------------------------------------------------------------------------------------

export interface SeasonProgress {
	season: number
	watched: number
	aired: number
	listed: number
}

export interface View {
	seen: boolean
	/** A Seen show with an unwatched regular episode that aired after it became Seen. */
	hasNewEpisodes: boolean
	status: ShowStatus | null
	caughtUp: boolean
	nextEpisode: Episode | null
	/** Watched and aired count regular episodes only; a watched episode that has not aired is not counted. */
	progress: {
		watched: number
		aired: number
		listed: number
		seasons: SeasonProgress[]
		specialsWatched: number
		hasEpisodeList: boolean
	}
	seasonStillAiring: number | null
	hiddenByNotSeenYet: boolean
	hiddenFromRecommendations: boolean
	wantToSee: boolean
	notInterested: boolean
	offered: {
		seen: boolean
		notInterested: boolean
		onHold: boolean
		dropped: boolean
		wantToSee: boolean
	}
	promptToRate: boolean
	/** Films only: how many watches the film has. */
	filmWatches: number
}

export function view(world: World, rules: Rules = SETTLED): View {
	const { member } = world
	if (world.film) return filmView(member)

	const facts = factsOf(world, rules)
	const { airedRegular, watchedIds } = facts
	const live = listed(world.show)
	const regular = live.filter(isRegular)
	const unwatched = airedRegular.filter((e) => !watchedIds.has(e.tmdbId))

	const seen = member.rating !== null || member.seen !== null
	const seenSince = [member.seen?.since, member.rating?.at]
		.filter((at): at is string => !!at)
		.sort()[0]
	const status = member.status?.value ?? null

	const started = facts.watchedRegular > 0
	// Open: there is something left to watch, now or soon.
	const open = unwatched.length > 0 || facts.airingSeason !== null

	const seasons = [...new Set(regular.map((e) => e.season))]
		.sort((a, b) => a - b)
		.map((season) => {
			const episodes = regular.filter((e) => e.season === season)
			const aired = episodes.filter((e) => hasAired(e, facts.today))
			return {
				season,
				watched: aired.filter((e) => watchedIds.has(e.tmdbId)).length,
				aired: aired.length,
				listed: episodes.length,
			}
		})

	return {
		seen,
		hasNewEpisodes:
			seen &&
			!!seenSince &&
			unwatched.some((e) => (e.airDate as string) > dayOf(seenSince)),
		status,
		caughtUp:
			status === "watching" &&
			facts.watchedThrough &&
			facts.airingSeason !== null,
		nextEpisode: nextEpisodeOf(airedRegular, watchedIds, rules),
		progress: {
			watched: airedRegular.length - unwatched.length,
			aired: airedRegular.length,
			listed: regular.length,
			seasons,
			specialsWatched: live.filter(
				(e) => !isRegular(e) && watchedIds.has(e.tmdbId),
			).length,
			hasEpisodeList: live.length > 0,
		},
		seasonStillAiring: facts.airingSeason,
		hiddenByNotSeenYet: seen || status !== null,
		hiddenFromRecommendations: member.notInterested || status === "dropped",
		wantToSee: member.wantToSee,
		notInterested: member.notInterested,
		offered: {
			// Not while the list says nothing has aired yet. A show without a list can still be marked as a whole.
			seen: !(regular.length > 0 && airedRegular.length === 0),
			notInterested: !seen && !started && status === null,
			onHold: started && open && status !== "on_hold",
			dropped: started && open && status !== "dropped",
			wantToSee: !(started && open),
		},
		promptToRate:
			member.seen !== null &&
			member.rating === null &&
			!member.ratePromptDismissed,
		filmWatches: 0,
	}
}

function nextEpisodeOf(
	airedRegular: Episode[],
	watchedIds: Set<number>,
	rules: Rules,
): Episode | null {
	const earliest = airedRegular.find((e) => !watchedIds.has(e.tmdbId)) ?? null
	if (rules.nextEpisode === "earliest-unwatched") return earliest
	let furthest = -1
	airedRegular.forEach((e, index) => {
		if (watchedIds.has(e.tmdbId)) furthest = index
	})
	// Nothing left after the furthest watched episode: an earlier gap is the next one after all.
	return (
		airedRegular.slice(furthest + 1).find((e) => !watchedIds.has(e.tmdbId)) ??
		earliest
	)
}

function filmView(member: Member): View {
	const filmWatches = member.watches.filter((w) => w.of.kind === "film").length
	const seen = member.rating !== null || filmWatches > 0
	return {
		seen,
		hasNewEpisodes: false,
		status: null,
		caughtUp: false,
		nextEpisode: null,
		progress: {
			watched: 0,
			aired: 0,
			listed: 0,
			seasons: [],
			specialsWatched: 0,
			hasEpisodeList: false,
		},
		seasonStillAiring: null,
		hiddenByNotSeenYet: seen,
		hiddenFromRecommendations: member.notInterested,
		wantToSee: member.wantToSee,
		notInterested: member.notInterested,
		offered: {
			seen: true,
			notInterested: !seen,
			onHold: false,
			dropped: false,
			wantToSee: true,
		},
		promptToRate: false,
		filmWatches,
	}
}

// ---------------------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------------------

type EpisodeRef = { season: number; number: number }

export type Action =
	// The member
	| ({ do: "markEpisode" } & EpisodeRef)
	| ({ do: "unmarkEpisode" } & EpisodeRef)
	| { do: "markSeason"; season: number }
	| ({ do: "markUpTo" } & EpisodeRef)
	| { do: "pressSeen" }
	| { do: "removeSeen" }
	| { do: "rate"; score: number }
	| { do: "removeRating" }
	| { do: "setOnHold" }
	| { do: "setDropped" }
	| { do: "addWantToSee" }
	| { do: "removeWantToSee" }
	| { do: "setNotInterested" }
	| { do: "dismissRatePrompt" }
	| { do: "markFilm"; date?: WatchDate }
	| { do: "removeFilmWatches" }
	// An import
	| {
			do: "importWatches"
			importId: string
			watches: (EpisodeRef & { date: WatchDate })[]
			status?: ShowStatus
	  }
	// Time: `to` is the new instant. Nothing else happens; episodes air because the day changes.
	| { do: "timePasses"; to: string }
	// TMDB
	| { do: "tmdbLists"; episodes: Episode[] }
	| { do: "tmdbRemoves"; tmdbId: number }
	| { do: "tmdbChanges"; changes: { tmdbId: number; to: Partial<Episode> }[] }
	| { do: "tmdbSetsStatus"; status: TmdbStatus }

export interface StepResult {
	world: World
	/** What the action did, in a sentence, for the report. */
	note: string
}

const copyOf = (world: World): World => ({
	...world,
	show: { ...world.show, episodes: world.show.episodes.map((e) => ({ ...e })) },
	member: { ...world.member, watches: [...world.member.watches] },
	clock: { ...world.clock },
})

const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : word.endsWith("ch") ? "es" : "s"}`

export function step(
	before: World,
	action: Action,
	rules: Rules = SETTLED,
): StepResult {
	const world = copyOf(before)
	const { member, show, clock } = world
	const now = clock.now
	const facts = () => factsOf(world, rules)
	const find = (ref: EpisodeRef) =>
		listed(show).find((e) => e.season === ref.season && e.number === ref.number)

	const addWatch = (episode: Episode, date: WatchDate, origin: WatchOrigin) =>
		member.watches.push({
			of: {
				kind: "episode",
				tmdbId: episode.tmdbId,
				season: episode.season,
				number: episode.number,
			},
			date,
			origin,
			pass: 1,
			recordedAt: now,
		})

	const setStatus = (value: ShowStatus | null) => {
		if ((member.status?.value ?? null) === value) return
		member.status = value ? { value, changedAt: now } : null
	}

	/** A watch of a regular episode by the member: starts the show or returns to it. */
	const watchedByMember = () => {
		member.wantToSee = false
		member.notInterested = false
		setStatus("watching")
	}

	/** Bulk watches, date unknown, for the given episodes that have aired and have no watch yet. */
	const bulkMark = (episodes: Episode[], bulk: "show" | "season" | "up-to") => {
		const { today, watchedIds } = facts()
		const fresh = episodes.filter(
			(e) => hasAired(e, today) && !watchedIds.has(e.tmdbId),
		)
		for (const episode of fresh)
			addWatch(episode, { precision: "unknown" }, { by: "bulk", action: bulk })
		return fresh
	}

	/** After watches were taken away: a show with no watched episode is not Watching; one with some is. */
	const afterRemoval = () => {
		const { watchedRegular } = facts()
		if (watchedRegular === 0 && member.status?.value === "watching")
			setStatus(null)
		if (watchedRegular > 0 && member.status === null && member.seen === null)
			setStatus("watching")
	}

	let note = ""
	const refused = (why: string) => ({ world: before, note: `Refused: ${why}` })

	switch (action.do) {
		case "markEpisode": {
			const episode = find(action)
			if (!episode) return refused("the episode is not listed.")
			const { today, watchedIds } = facts()
			if (watchedIds.has(episode.tmdbId)) return refused("already watched.")
			if (!hasAired(episode, today) && rules.markUnaired === "refused")
				return refused("the episode has not aired.")
			addWatch(episode, { precision: "moment", at: now }, { by: "hand" })
			note = "One watch by hand, dated now."
			if (isRegular(episode) || rules.specialStartsShow) watchedByMember()
			else note += " A special: nothing else changes."
			break
		}
		case "unmarkEpisode": {
			const episode = find(action)
			if (!episode) return refused("the episode is not listed.")
			const kept = member.watches.filter(
				(w) => episodeOfWatch(show, w, rules)?.tmdbId !== episode.tmdbId,
			)
			const removed = member.watches.length - kept.length
			if (removed === 0) return refused("the episode has no watch.")
			member.watches = kept
			note = `${plural(removed, "watch")} removed.`
			if (
				isRegular(episode) &&
				member.seen !== null &&
				rules.unmarkOnSeen === "removes-seen" &&
				episode.airDate !== null &&
				episode.airDate <= dayOf(member.seen.since)
			) {
				member.seen = null
				note += " The show is no longer Seen by watching."
			}
			afterRemoval()
			break
		}
		case "markSeason": {
			const fresh = bulkMark(
				listed(show).filter((e) => e.season === action.season),
				"season",
			)
			note = `${plural(fresh.length, "bulk watch")}, date unknown.`
			if (fresh.some(isRegular)) watchedByMember()
			break
		}
		case "markUpTo": {
			const target = find(action)
			if (!target || !isRegular(target))
				return refused("not a listed regular episode.")
			const fresh = bulkMark(
				listed(show).filter((e) => isRegular(e) && inOrder(e, target) <= 0),
				"up-to",
			)
			note = `${plural(fresh.length, "bulk watch")}, date unknown.`
			if (fresh.length > 0) watchedByMember()
			break
		}
		case "pressSeen": {
			if (!view(world, rules).offered.seen)
				return refused("Seen is not offered before the first episode has aired.")
			const fresh = bulkMark(listed(show).filter(isRegular), "show")
			note = `${plural(fresh.length, "bulk watch")}, date unknown.`
			member.wantToSee = false
			member.notInterested = false
			const { airingSeason } = facts()
			if (airingSeason !== null && rules.seenPressWhileAiring === "caught-up") {
				setStatus("watching")
				note += ` Season ${airingSeason} is still airing, so the show is Watching and not Seen.`
			} else {
				member.seen = { since: now, by: "press" }
				setStatus(null)
			}
			break
		}
		case "removeSeen": {
			const kept = member.watches.filter(
				(w) =>
					w.origin.by !== "bulk" ||
					(rules.removeSeenRemoves === "show-bulk" && w.origin.action !== "show"),
			)
			note = `${plural(member.watches.length - kept.length, "bulk watch")} removed.`
			member.watches = kept
			member.seen = null
			afterRemoval()
			break
		}
		case "rate":
			member.rating = { score: action.score, at: now }
			member.notInterested = false
			note = world.film
				? `Rated ${action.score}.`
				: `Rated ${action.score}. No episode is marked.`
			break
		case "removeRating":
			member.rating = null
			note = "Rating removed."
			break
		case "setOnHold":
			if (facts().watchedRegular === 0)
				return refused("On hold needs a watched episode.")
			setStatus("on_hold")
			break
		case "setDropped":
			setStatus("dropped")
			member.wantToSee = false
			member.notInterested = false
			break
		case "addWantToSee": {
			member.notInterested = false
			const offered = view(world, rules).offered
			if (!offered.wantToSee) {
				setStatus("watching")
				note =
					"The show is started and has episodes left: wanting to see it means Watching again, not the Wishlist."
			} else {
				member.wantToSee = true
				if (member.status?.value === "dropped") setStatus(null)
			}
			break
		}
		case "removeWantToSee":
			member.wantToSee = false
			break
		case "setNotInterested":
			if (!view(world, rules).offered.notInterested)
				return refused("Not interested is not offered here.")
			member.notInterested = true
			member.wantToSee = false
			break
		case "dismissRatePrompt":
			member.ratePromptDismissed = true
			break
		case "markFilm":
			member.watches.push({
				of: { kind: "film" },
				date: action.date ?? { precision: "moment", at: now },
				origin: { by: "hand" },
				pass: 1,
				recordedAt: now,
			})
			member.wantToSee = false
			member.notInterested = false
			note = "One watch."
			break
		case "removeFilmWatches":
			member.watches = member.watches.filter((w) => w.of.kind !== "film")
			note = "Every watch of the film removed."
			break
		case "importWatches": {
			let added = 0
			let regular = 0
			for (const item of action.watches) {
				const episode = find(item)
				if (!episode) continue
				addWatch(episode, item.date, { by: "import", importId: action.importId })
				added++
				if (isRegular(episode)) regular++
			}
			note = `${plural(added, "imported watch")}.`
			if (action.status) setStatus(action.status)
			// An imported watch starts a show that has no status. It never overrides On hold or Dropped.
			else if (regular > 0 && member.status === null && member.seen === null)
				setStatus("watching")
			if (regular > 0) {
				member.wantToSee = false
				member.notInterested = false
			}
			break
		}
		case "timePasses":
			clock.now = action.to
			break
		case "tmdbLists": {
			const hadRegular = listed(show).some(isRegular)
			show.episodes.push(...action.episodes.map((e) => ({ ...e })))
			note = `TMDB lists ${plural(action.episodes.length, "more episode")}.`
			if (
				!hadRegular &&
				member.seen?.by === "press" &&
				rules.backfillWhenListAppears
			) {
				const since = dayOf(member.seen.since)
				const covered = action.episodes.filter(
					(e) => isRegular(e) && hasAired(e, since),
				)
				for (const episode of covered)
					addWatch(
						episode,
						{ precision: "unknown" },
						{ by: "bulk", action: "show" },
					)
				note += ` ${plural(covered.length, "bulk watch")} for the episodes that had aired when the show was marked Seen.`
			}
			break
		}
		case "tmdbRemoves": {
			const episode = show.episodes.find((e) => e.tmdbId === action.tmdbId)
			if (episode) episode.removed = true
			break
		}
		case "tmdbChanges":
			for (const change of action.changes) {
				const episode = show.episodes.find((e) => e.tmdbId === change.tmdbId)
				if (episode) Object.assign(episode, change.to)
			}
			break
		case "tmdbSetsStatus":
			show.tmdbStatus = action.status
			break
	}

	if (!world.film) settle(world, rules)
	return { world, note }
}

/**
 * What the writer keeps in step after every action and whenever somebody looks: a Watching show that is
 * watched through with no season still airing becomes Seen, and a Seen show that is watched through has no
 * status. On hold and Dropped are the member's decisions and never change here.
 */
function settle(world: World, rules: Rules) {
	const { member } = world
	const now = factsOf(world, rules)

	// An episode that aired after `day` in a season the member has watched from: that season was not over.
	const reopenedAfter = (day: string) =>
		rules.laterEpisodes === "reopen" &&
		now.airedRegular.some(
			(e) =>
				!now.watchedIds.has(e.tmdbId) &&
				(e.airDate as string) > day &&
				listed(world.show).some(
					(other) =>
						other.season === e.season && now.watchedIds.has(other.tmdbId),
				),
		)
	if (member.seen !== null && reopenedAfter(dayOf(member.seen.since))) {
		member.seen = null
		if (member.status === null)
			member.status = { value: "watching", changedAt: world.clock.now }
	}

	const mayBecomeSeen =
		member.seen === null &&
		(member.status === null || member.status.value === "watching")

	if (mayBecomeSeen) {
		const days =
			rules.seenEvaluation === "from-history"
				? daysWorthChecking(world, now.today, rules)
				: [now.today]
		for (const day of days) {
			const then = day === now.today ? now : factsOf(world, rules, day)
			if (!then.watchedThrough || then.airingSeason !== null) continue
			if (reopenedAfter(day)) continue
			member.seen = {
				since: day === now.today ? world.clock.now : `${day}T00:00:00Z`,
				by: "watching",
			}
			// Found in the past and nothing watched since: the show was left as Seen, so it has no status.
			const watchedSince = member.watches.some((w) => knownDay(w) > day)
			if (day !== now.today && !watchedSince) member.status = null
			break
		}
	}

	if (
		member.seen !== null &&
		member.status?.value === "watching" &&
		now.watchedThrough &&
		now.airingSeason === null
	)
		member.status = null
}

/** The days on which a show can turn Seen by watching: a watch became known, or a season stopped airing. */
function daysWorthChecking(world: World, today: string, rules: Rules): string[] {
	const days = new Set<string>([today])
	for (const watch of world.member.watches) days.add(knownDay(watch))
	for (const episode of listed(world.show)) {
		if (episode.airDate === null) continue
		days.add(episode.airDate)
		days.add(addDays(episode.airDate, rules.airingGapDays + 1))
		days.add(addDays(episode.airDate, rules.midSeasonGapDays + 1))
	}
	return [...days].filter((day) => day <= today).sort()
}

export const newMember = (overrides: Partial<Member> = {}): Member => ({
	watches: [],
	rating: null,
	wantToSee: false,
	notInterested: false,
	status: null,
	seen: null,
	ratePromptDismissed: false,
	...overrides,
})
