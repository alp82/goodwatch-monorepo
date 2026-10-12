// PROTOTYPE - throwaway. The sample members of /prototype/new-episodes and everything the page derives from them:
// the groups of My shows (by the real planner, `planMyShows`), when a waiting show's next episode airs, and the
// signal outside My shows. Every show's episodes, dates and watches are made up; only the titles and the image paths
// are TMDB's. Nothing is read from or written to a service.
import {
	type MyShowsPlan,
	type ShowRow,
	episodeCode,
	planMyShows,
} from "~/domain/my-shows"
import type { WatchStateEntry } from "~/domain/tracking/storage"

const DAY = 86_400_000

/** The day the prototype starts on, a Sunday. "Next day" moves it. */
export const START_DAY = "2026-10-11"

export const at = (day: string) => Date.parse(`${day}T00:00:00Z`)
export const addDays = (day: string, n: number) =>
	new Date(at(day) + n * DAY).toISOString().slice(0, 10)
export const daysFrom = (from: string, to: string) =>
	Math.round((at(to) - at(from)) / DAY)
/** The evening of a day: the moment the page is looked at. */
export const evening = (day: string) => at(day) + 21 * 3_600_000

export interface Episode {
	season: number
	number: number
	name: string | null
	/** "YYYY-MM-DD"; null when TMDB lists the episode without a date. */
	airDate: string | null
}

export type Status = "watching" | "seen" | "on_hold" | "dropped"

export interface Show {
	key: string
	id: number
	title: string
	poster: string
	backdrop: string
	status: Status
	/** The catalog's status is neither Ended nor Canceled. */
	running: boolean
	/** Regular episodes of the earlier seasons, all aired. */
	earlier: number
	/** The latest season, aired and to come, in order; episodes without a date come last. */
	episodes: Episode[]
	/** Regular episodes the member watched, in order from the first. */
	watched: number
	lastWatch: string | null
	runtime: number
}

export interface StartShow {
	id: number
	title: string
	poster: string
	backdrop: string
	match: number
	cost: string
	meta: string
}

// ---------------------------------------------------------------------------------------------------------
// Sample data

const weekly = (
	season: number,
	first: string,
	count: number,
	names: (string | null)[] = [],
): Episode[] =>
	Array.from({ length: count }, (_, i) => ({
		season,
		number: i + 1,
		name: names[i] ?? null,
		airDate: addDays(first, i * 7),
	}))

/** A whole season on one day. */
const dropped = (
	season: number,
	date: string | null,
	count: number,
	names: (string | null)[] = [],
): Episode[] =>
	Array.from({ length: count }, (_, i) => ({
		season,
		number: i + 1,
		name: names[i] ?? null,
		airDate: date,
	}))

type Seed = Omit<Show, "key">

const SEEDS: Record<string, Seed> = {
	bear: {
		id: 136315,
		title: "The Bear",
		poster: "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
		backdrop: "/aJtG4txtmiRHwAAqENQHZvBs6kY.jpg",
		status: "watching",
		running: true,
		earlier: 28,
		episodes: dropped(4, "2026-06-25", 10, [
			null,
			null,
			null,
			"Scallop",
			"Replacements",
		]),
		watched: 31,
		lastWatch: "2026-10-10",
		runtime: 34,
	},
	// Watching, and its Next episode aired after the last visit.
	slow: {
		id: 95480,
		title: "Slow Horses",
		poster: "/AdYr4DjOgXvDUMwu6vEhZy1Rnxk.jpg",
		backdrop: "/gPQppUnLx9vqPDLz3WwZ2HJsNbt.jpg",
		status: "watching",
		running: true,
		earlier: 30,
		episodes: weekly(6, "2026-09-16", 6, [
			null,
			null,
			null,
			"Bad Tradecraft",
			"Cover Story",
			"Clown Town",
		]),
		watched: 33,
		lastWatch: "2026-10-08",
		runtime: 48,
	},
	// Watching and nine episodes behind: an episode aired after the last visit, but it is not the Next episode.
	industry: {
		id: 90812,
		title: "Industry",
		poster: "/mZ7YFEOxAKfjXJKWm0sYFXQ8n8A.jpg",
		backdrop: "/qcV7ebwtZcoRxBufUmXQl0KKdht.jpg",
		status: "watching",
		running: true,
		earlier: 32,
		episodes: weekly(5, "2026-08-07", 10, [null, "Paper Hands"]),
		watched: 33,
		lastWatch: "2026-09-20",
		runtime: 58,
	},
	// Seen, and a new season opened with two episodes.
	omitb: {
		id: 107113,
		title: "Only Murders in the Building",
		poster: "/1yjFVQZuW8aofZ5Cgol8iImsVFp.jpg",
		backdrop: "/WCnEPf4ZNPjszndmrFlDxZ5Uvd.jpg",
		status: "seen",
		running: true,
		earlier: 50,
		episodes: [
			{ season: 6, number: 1, name: "Across the Pond", airDate: "2026-10-08" },
			...weekly(6, "2026-10-01", 10).slice(1),
		],
		watched: 50,
		lastWatch: "2025-10-28",
		runtime: 35,
	},
	// Seen, and a whole season dropped at once.
	wednesday: {
		id: 119051,
		title: "Wednesday",
		poster: "/9PFonBhy4cQy7Jz20NpMygczOkv.jpg",
		backdrop: "/iHSwvRVsRyxpX7FE7GbviaDvgGZ.jpg",
		status: "seen",
		running: true,
		earlier: 16,
		episodes: dropped(3, "2026-10-09", 8, ["Woe Is the Third Year"]),
		watched: 16,
		lastWatch: "2025-09-05",
		runtime: 52,
	},
	// Seen, and this week's episode airs today.
	lotus: {
		id: 111803,
		title: "The White Lotus",
		poster: "/gbSaK9v1CbcYH1ISgbM7XObD2dW.jpg",
		backdrop: "/qVBIAcZkK5j6WRq7JehJcOMbdgb.jpg",
		status: "seen",
		running: true,
		earlier: 21,
		episodes: weekly(4, "2026-09-27", 8, [null, null, "Low Season"]),
		watched: 23,
		lastWatch: "2026-10-05",
		runtime: 61,
	},
	shrinking: {
		id: 136311,
		title: "Shrinking",
		poster: "/zEFKMNPBKq6JG7uuDkzTQ9WwErn.jpg",
		backdrop: "/hI9z1UuNhBthvkm3iJ8m3zv43Pf.jpg",
		status: "seen",
		running: true,
		earlier: 24,
		episodes: weekly(3, "2026-09-07", 11, [
			null,
			null,
			null,
			null,
			null,
			"Boundaries",
		]),
		watched: 29,
		lastWatch: "2026-10-05",
		runtime: 33,
	},
	abbott: {
		id: 125935,
		title: "Abbott Elementary",
		poster: "/nBe1e3JJEZ6veGrVXNF0fRoLu56.jpg",
		backdrop: "/asDINJT3b7tEa76uWI1rZ5TWdJF.jpg",
		status: "seen",
		running: true,
		earlier: 93,
		episodes: weekly(6, "2026-09-30", 22, [null, null, "Picture Day"]),
		watched: 95,
		lastWatch: "2026-10-08",
		runtime: 22,
	},
	pitt: {
		id: 250307,
		title: "The Pitt",
		poster: "/kvFSpESyBZMjaeOJDx7RS3P1jey.jpg",
		backdrop: "/z3BkMbCy5ajZPMyKEUwsPHuz2cV.jpg",
		status: "seen",
		running: true,
		earlier: 30,
		episodes: weekly(3, "2026-10-08", 15, [null, "8:00 A.M."]),
		watched: 31,
		lastWatch: "2026-10-09",
		runtime: 50,
	},
	severance: {
		id: 95396,
		title: "Severance",
		poster: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
		backdrop: "/ixgFmf1X59PUZam2qbAfskx2gQr.jpg",
		status: "seen",
		running: true,
		earlier: 19,
		episodes: weekly(3, "2026-11-20", 10),
		watched: 19,
		lastWatch: "2025-03-21",
		runtime: 50,
	},
	// Watching with every aired episode watched: the page calls it "Up to date".
	diplomat: {
		id: 203857,
		title: "The Diplomat",
		poster: "/cOKXV0FalCYixNmZYCfHXgyQ0VX.jpg",
		backdrop: "/v6f9FUDDQfGIv8MLRQwlL0zvRjI.jpg",
		status: "watching",
		running: true,
		earlier: 22,
		episodes: dropped(4, "2026-12-03", 8),
		watched: 22,
		lastWatch: "2026-09-14",
		runtime: 49,
	},
	fallout: {
		id: 106379,
		title: "Fallout",
		poster: "/c15BtJxCXMrISLVmysdsnZUPQft.jpg",
		backdrop: "/coaPCIqQBPUZsOnJcWZxhaORcDT.jpg",
		status: "seen",
		running: true,
		earlier: 16,
		episodes: weekly(3, "2027-01-14", 8),
		watched: 16,
		lastWatch: "2026-02-04",
		runtime: 59,
	},
	// An episode is listed, without a date.
	dragon: {
		id: 94997,
		title: "House of the Dragon",
		poster: "/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg",
		backdrop: "/577eXC8wFQT0eUrJcgznSiFPRmk.jpg",
		status: "seen",
		running: true,
		earlier: 26,
		episodes: dropped(4, null, 1),
		watched: 26,
		lastWatch: "2026-08-03",
		runtime: 62,
	},
	// Still running, and no episode is listed.
	silo: {
		id: 125988,
		title: "Silo",
		poster: "/r2QXomqKjkKHVtYGGtkf2l2Y7go.jpg",
		backdrop: "/4XccmjsOmQZw8S2iW1wvlvmb5v1.jpg",
		status: "seen",
		running: true,
		earlier: 30,
		episodes: [],
		watched: 30,
		lastWatch: "2026-01-16",
		runtime: 51,
	},
	yellowjackets: {
		id: 117488,
		title: "Yellowjackets",
		poster: "/xRnGrn7Z7SC0KIBodocoU1QgDZF.jpg",
		backdrop: "/ibFWJDWS8cTO6s2vZVd2uKDm8p.jpg",
		status: "watching",
		running: true,
		earlier: 19,
		episodes: weekly(3, "2025-02-14", 10),
		watched: 21,
		lastWatch: "2026-06-30",
		runtime: 58,
	},
	// On hold from Seen, and its new season has begun.
	lastofus: {
		id: 100088,
		title: "The Last of Us",
		poster: "/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg",
		backdrop: "/lY2DhbA7Hy44fAKddr06UrXWWaQ.jpg",
		status: "on_hold",
		running: true,
		earlier: 16,
		episodes: weekly(3, "2026-10-04", 7),
		watched: 16,
		lastWatch: "2025-05-26",
		runtime: 57,
	},
	mankind: {
		id: 87917,
		title: "For All Mankind",
		poster: "/JP3DItWMbrrLiKR5AYUfpsNf2b.jpg",
		backdrop: "/9OQ5BIITkJwRJo9JA6AlCfJIGBQ.jpg",
		status: "on_hold",
		running: true,
		earlier: 40,
		episodes: [],
		watched: 23,
		lastWatch: "2025-12-01",
		runtime: 60,
	},
	rings: {
		id: 84773,
		title: "The Lord of the Rings: The Rings of Power",
		poster: "/kf5Hz70tjNAHg4swGDzOr9BfoZ1.jpg",
		backdrop: "/o2wg8QiSCQrhj91tBfxunE3O5Ba.jpg",
		status: "dropped",
		running: true,
		earlier: 16,
		episodes: [],
		watched: 5,
		lastWatch: "2024-09-12",
		runtime: 68,
	},
	// The rest are Seen shows with new episodes, for the member who was away for three weeks.
	invincible: {
		id: 95557,
		title: "Invincible",
		poster: "/4tblBrslcKSifMVZ3TmtT2ukMor.jpg",
		backdrop: "/9qrroces8C6R9aKr08hACNPVXdZ.jpg",
		status: "seen",
		running: true,
		earlier: 25,
		episodes: weekly(4, "2026-09-24", 8),
		watched: 25,
		lastWatch: "2025-03-13",
		runtime: 47,
	},
	poker: {
		id: 120998,
		title: "Poker Face",
		poster: "/8Xm5dyMQC9whMJKnGdFugUAW73C.jpg",
		backdrop: "/ccOzCmrglAjRGtqv5ClTaBEsWt8.jpg",
		status: "seen",
		running: true,
		earlier: 22,
		episodes: weekly(3, "2026-09-24", 10),
		watched: 22,
		lastWatch: "2025-07-10",
		runtime: 55,
	},
	boys: {
		id: 76479,
		title: "The Boys",
		poster: "/in1R2dDc421JxsoRWaIIAqVI2KE.jpg",
		backdrop: "/bq28ajZaoMyzEIm6REelqyqtEDZ.jpg",
		status: "seen",
		running: true,
		earlier: 32,
		episodes: [
			...dropped(5, "2026-10-02", 3),
			...weekly(5, "2026-09-18", 8).slice(3),
		],
		watched: 32,
		lastWatch: "2024-07-18",
		runtime: 62,
	},
	mirror: {
		id: 42009,
		title: "Black Mirror",
		poster: "/seN6rRfN0I6n8iDXjlSMk1QjNcq.jpg",
		backdrop: "/dg3OindVAGZBjlT3xYKqIAdukPL.jpg",
		status: "seen",
		running: true,
		earlier: 33,
		episodes: dropped(8, "2026-09-25", 6),
		watched: 33,
		lastWatch: "2025-04-12",
		runtime: 64,
	},
	hacks: {
		id: 124101,
		title: "Hacks",
		poster: "/ca5XiEFgyGsI38QT3wEKa1QVGX.jpg",
		backdrop: "/bbAR4qKxjnjyKAt4YMrL725Mtfw.jpg",
		status: "seen",
		running: true,
		earlier: 37,
		episodes: weekly(5, "2026-09-24", 10),
		watched: 37,
		lastWatch: "2025-05-29",
		runtime: 33,
	},
	paradise: {
		id: 245927,
		title: "Paradise",
		poster: "/l8RqfhqEk04W5sSOjQ9zeWU1DyM.jpg",
		backdrop: "/5QsLvWh8J1mXl1W05wNJknMmhzR.jpg",
		status: "seen",
		running: true,
		earlier: 8,
		episodes: dropped(2, "2026-10-02", 8),
		watched: 8,
		lastWatch: "2025-03-04",
		runtime: 52,
	},
	pluribus: {
		id: 225171,
		title: "Pluribus",
		poster: "/z7Nga7Q9IGFWs5OEduY2gGFxnX3.jpg",
		backdrop: "/ulm1ex4JFYJByyaPyqTr47MFyEQ.jpg",
		status: "seen",
		running: true,
		earlier: 9,
		episodes: weekly(2, "2026-09-25", 9),
		watched: 9,
		lastWatch: "2025-12-26",
		runtime: 54,
	},
}

export const STARTS: StartShow[] = [
	{
		id: 83867,
		title: "Andor",
		poster: "/khZqmwHQicTYoS7Flreb9EddFZC.jpg",
		backdrop: "/quCeAmVQHfsdcYkicbxZWVauCVb.jpg",
		match: 94,
		cost: "2 seasons · 24 episodes · about 18 h",
		meta: "Has ended · on Disney Plus",
	},
	{
		id: 249042,
		title: "Adolescence",
		poster: "/20i4nShZZg1g1VFHSB8xpaYM4r7.jpg",
		backdrop: "/llZodlkVKRkTdUsiRxvn8h80hhx.jpg",
		match: 91,
		cost: "1 season · 4 episodes · about 4 h",
		meta: "Has ended · on Netflix",
	},
	{
		id: 70523,
		title: "Dark",
		poster: "/wSXJHO9WHLb0aCwvQrtco7vOmWA.jpg",
		backdrop: "/3jDXL4Xvj3AzDOF6UH1xeyHW8MH.jpg",
		match: 88,
		cost: "3 seasons · 26 episodes · about 24 h",
		meta: "Has ended · on Netflix",
	},
]

/** The fan of the A movie door on home. */
export const MOVIE_POSTERS = [
	"/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
	"/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
	"/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg",
]

const QUIET = [
	"bear",
	"shrinking",
	"abbott",
	"pitt",
	"severance",
	"diplomat",
	"fallout",
	"dragon",
	"silo",
	"yellowjackets",
	"mankind",
	"rings",
]
const MIXED = [
	...QUIET,
	"slow",
	"industry",
	"omitb",
	"wednesday",
	"lotus",
	"lastofus",
]

export const MEMBERS = {
	mixed: {
		label: "4 shows, 12 episodes new",
		shows: MIXED,
		lastOpened: "2026-10-06",
	},
	none: { label: "Nothing new", shows: QUIET, lastOpened: "2026-10-06" },
	one: {
		label: "1 show, 1 episode new",
		shows: [...QUIET, "slow"],
		lastOpened: "2026-10-06",
	},
	season: {
		label: "1 show, a whole season new",
		shows: [...QUIET, "wednesday"],
		lastOpened: "2026-10-06",
	},
	many: {
		label: "11 shows, 42 episodes new (away 3 weeks)",
		shows: [
			...MIXED,
			"invincible",
			"poker",
			"boys",
			"mirror",
			"hacks",
			"paradise",
			"pluribus",
		],
		lastOpened: "2026-09-18",
	},
} as const
export type MemberKey = keyof typeof MEMBERS

export const showsOf = (member: MemberKey): Show[] =>
	MEMBERS[member].shows.map((key) => ({ key, ...SEEDS[key] }))

// ---------------------------------------------------------------------------------------------------------
// One show on one day

export interface ShowFacts {
	/** Regular episodes aired by today. An episode airs on its date: one dated today has aired. */
	aired: number
	watched: number
	left: number
	/** The Next episode; null when nothing is left, or when it is in an earlier season the sample does not list. */
	next: Episode | null
	/** The aired episodes from the Next episode on. */
	unwatched: Episode[]
	/** The first episode that has not aired; null when none is listed. */
	upcoming: Episode | null
}

export function factsOf(show: Show, today: string): ShowFacts {
	const listed = show.episodes.filter(
		(e) => e.airDate !== null && e.airDate <= today,
	).length
	const aired = show.earlier + listed
	const watched = Math.min(show.watched, aired)
	const from = watched - show.earlier
	const unwatched = from >= 0 ? show.episodes.slice(from, listed) : []
	return {
		aired,
		watched,
		left: aired - watched,
		next: unwatched[0] ?? null,
		unwatched,
		upcoming: show.episodes[listed] ?? null,
	}
}

// ---------------------------------------------------------------------------------------------------------
// My shows, by the real planner

export interface PlannedShow {
	row: ShowRow
	show: Show
	facts: ShowFacts
}
export type Planned = Record<
	"continue" | "older" | "waiting" | "onHold" | "dropped",
	PlannedShow[]
>

export function planOf(shows: readonly Show[], today: string): Planned {
	const byId = new Map(shows.map((show) => [show.id, show]))
	const plan: MyShowsPlan = planMyShows({
		shows: shows.map((show) => {
			const facts = factsOf(show, today)
			const last = show.episodes[facts.watched - show.earlier - 1]
			const entry: WatchStateEntry = {
				state: show.status,
				watchedAt: null,
				precision: "unknown",
				count: facts.watched,
				pass: 1,
				episodesWatched: facts.watched,
				furthest: last ? [last.season, last.number] : null,
				lastActivityAt: show.lastWatch
					? new Date(evening(show.lastWatch))
					: null,
			}
			return {
				id: show.id,
				entry,
				catalog: { airedEpisodes: facts.aired, running: show.running },
			}
		}),
		starts: [],
		now: evening(today),
	})
	const fill = (rows: ShowRow[]): PlannedShow[] =>
		rows.map((row) => {
			const show = byId.get(row.id) as Show
			return { row, show, facts: factsOf(show, today) }
		})
	return {
		continue: fill(plan.continue),
		older: fill(plan.pickUp),
		waiting: sortWaiting(fill(plan.waiting)),
		onHold: fill(plan.onHold),
		dropped: fill(plan.dropped),
	}
}

/** Soonest first; then the shows with an episode listed without a date; then the shows with none listed. */
export function sortWaiting(rows: PlannedShow[]): PlannedShow[] {
	const rank = ({ facts }: PlannedShow) =>
		facts.upcoming?.airDate
			? at(facts.upcoming.airDate)
			: facts.upcoming
				? Number.MAX_SAFE_INTEGER - 1
				: Number.MAX_SAFE_INTEGER
	return [...rows].sort(
		(a, b) => rank(a) - rank(b) || a.show.title.localeCompare(b.show.title),
	)
}

// ---------------------------------------------------------------------------------------------------------
// When the next episode airs

const DM = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
})
const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
	weekday: "short",
	timeZone: "UTC",
})

/** "12 Oct"; with the year when it is not today's: "14 Jan 2027". */
export const dateWords = (day: string, today: string) =>
	day.slice(0, 4) === today.slice(0, 4)
		? DM.format(at(day))
		: `${DM.format(at(day))} ${day.slice(0, 4)}`

/** "Mon 12 Oct". */
export const weekdayDate = (day: string, today: string) =>
	`${WEEKDAY.format(at(day))} ${dateWords(day, today)}`

/** "tomorrow", "in 4 days", and from a week out the date. "today" is for a member whose day is ahead of the list's. */
export function whenWords(airDate: string, today: string): string {
	const days = daysFrom(today, airDate)
	if (days <= 0) return "today"
	if (days === 1) return "tomorrow"
	if (days < 7) return `in ${days} days`
	return dateWords(airDate, today)
}

export interface Upcoming {
	/** "S3 E6"; null when no episode is listed. */
	code: string | null
	name: string | null
	/** "tomorrow", "in 4 days", "20 Nov"; null without a date. */
	when: string | null
	/** "Mon 12 Oct"; null without a date. */
	date: string | null
	/** Days until it airs; null without a date. */
	days: number | null
	/** One sentence for a row: "S3 E6 airs tomorrow", "S4 E1 has no date yet", "No new episodes announced". */
	sentence: string
}

export function upcomingOf(facts: ShowFacts, today: string): Upcoming {
	const e = facts.upcoming
	if (!e)
		return {
			code: null,
			name: null,
			when: null,
			date: null,
			days: null,
			sentence: "No new episodes announced",
		}
	const code = episodeCode(e)
	if (!e.airDate)
		return {
			code,
			name: e.name,
			when: null,
			date: null,
			days: null,
			sentence: `${code} has no date yet`,
		}
	const when = whenWords(e.airDate, today)
	return {
		code,
		name: e.name,
		when,
		date: weekdayDate(e.airDate, today),
		days: daysFrom(today, e.airDate),
		sentence: `${code} airs ${/^\d/.test(when) ? "on " : ""}${when}`,
	}
}

// ---------------------------------------------------------------------------------------------------------
// The signal outside My shows

/** `open`: new since My shows was last opened. `watched`: aired in the last seven days and not watched. */
export type Clears = "open" | "watched"
export type Look = "dot" | "shows" | "episodes"

export interface NewShow {
	show: Show
	episodes: Episode[]
}
export interface Signal {
	shows: NewShow[]
	episodes: number
	/** The first day that does not count: the last visit, or seven days back. */
	since: string
}

export const sinceOf = (clears: Clears, today: string, lastOpened: string) =>
	clears === "open" ? lastOpened : addDays(today, -7)

/** Why a show counts or does not, for the state panel. */
export function countsOf(
	show: Show,
	today: string,
	since: string,
): { counts: boolean; why: string } {
	const facts = factsOf(show, today)
	if (show.status === "on_hold" || show.status === "dropped")
		return {
			counts: false,
			why: `${show.status === "dropped" ? "Dropped" : "On hold"}: never counted`,
		}
	if (!facts.left) return { counts: false, why: "Nothing to watch" }
	const next = facts.next
	if (!next?.airDate)
		return { counts: false, why: "Next episode is an old one" }
	const aired = `${episodeCode(next)} aired ${dateWords(next.airDate, today)}`
	return next.airDate > since
		? { counts: true, why: `Next episode ${aired}` }
		: { counts: false, why: `Next episode ${aired}, not new` }
}

/**
 * The shows whose Next episode aired after `since`, and with each every aired episode from it on. A show the member
 * is behind on does not count when one more episode airs; neither does an On hold or a Dropped show.
 */
export function signalOf(
	shows: readonly Show[],
	today: string,
	since: string,
): Signal {
	const fresh: NewShow[] = []
	for (const show of shows)
		if (countsOf(show, today, since).counts)
			fresh.push({ show, episodes: factsOf(show, today).unwatched })
	// The latest to air first.
	fresh.sort(
		(a, b) =>
			at(b.episodes[0].airDate as string) -
				at(a.episodes[0].airDate as string) ||
			a.show.title.localeCompare(b.show.title),
	)
	return {
		shows: fresh,
		episodes: fresh.reduce((n, s) => n + s.episodes.length, 0),
		since,
	}
}

/** The wider rule, for comparison: every Watching or Seen show with an unwatched episode that aired after `since`. */
export const anyNewOf = (
	shows: readonly Show[],
	today: string,
	since: string,
) =>
	shows.filter(
		(show) =>
			(show.status === "watching" || show.status === "seen") &&
			factsOf(show, today).unwatched.some(
				(e) => e.airDate !== null && e.airDate > since,
			),
	)

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

export interface SignalWords {
	/** What the mark on a navigation entry holds: nothing for a dot, else a number. */
	badge: string | null
	/** The line of the My shows tile: it has to fit one line of a phone's tile. */
	tile: string
	/** For the door on a desktop. */
	long: string
	/** For the door on a phone. */
	short: string
}

export function signalWords(signal: Signal, look: Look): SignalWords | null {
	const n = signal.shows.length
	if (!n) return null
	const m = signal.episodes
	const cap = (count: number) => (count > 99 ? "99+" : String(count))
	const first = signal.shows[0]
	// One show is named, whatever is counted.
	const single =
		n === 1
			? m === 1
				? `New: ${first.show.title} ${episodeCode(first.episodes[0])}`
				: `New: ${first.show.title}, ${m} episodes`
			: null
	if (look === "dot")
		return {
			badge: null,
			tile: single ?? "New episodes",
			long: single ?? "New episodes",
			short: "New",
		}
	if (look === "shows")
		return {
			badge: cap(n),
			tile: single ?? `New in ${n} shows`,
			long: single ?? `${n} shows have new episodes`,
			short: plural(n, "show"),
		}
	return {
		badge: cap(m),
		tile: single ?? plural(m, "new episode"),
		long: single ?? plural(m, "new episode"),
		short: `${m} new`,
	}
}
