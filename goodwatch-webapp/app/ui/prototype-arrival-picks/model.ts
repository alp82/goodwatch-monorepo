// PROTOTYPE - throwaway (issue #489, part B: picks). A made-up member, six prepared cases of titles that landed on
// their services, and four ways for Tonight's pick and home's doors to prefer such a title. Everything is in memory.
//
// What is real: which landings are still news (the sky blue pill and the count) is decided by the app's own rule,
// `newlyAvailableOf`, and said with the app's own words (domain/newly-available-words.ts). What is made up: the
// member, the times, and the four pick rules below. The normal pick copies `tonightsPickOf` (domain/my-shows.ts):
// the Next episode of the show the member was last active on, else the first movie, else the first show to start.
import type { NewEpisodes, SignalWords } from "~/domain/new-episodes-signal"
import { type Candidate, newlyAvailableOf } from "~/domain/newly-available"
import type { Landings, NewOnServices } from "~/domain/newly-available-signal"
import { landedWords, showsWords } from "~/domain/newly-available-words"
import { titleKey } from "~/utils/title-key"

const DAY = 86_400_000
/** An evening two weeks after the launch of #456, so that a landing 12 days ago is after it. */
export const NOW = Date.UTC(2026, 9, 26, 19, 30)
const LAUNCH = Date.UTC(2026, 9, 12)

export type Kind = "movie" | "show"
export type DoorKey = "continue" | "start" | "movie"

export interface Title {
	id: number
	kind: Kind
	title: string
	poster: string
	backdrop: string
	/** Taste match, percent. */
	match: number
	runtime?: number
}

const movie = (
	id: number,
	title: string,
	poster: string,
	backdrop: string,
	match: number,
	runtime: number,
): Title => ({ id, kind: "movie", title, poster, backdrop, match, runtime })
const show = (
	id: number,
	title: string,
	poster: string,
	backdrop: string,
	match: number,
): Title => ({ id, kind: "show", title, poster, backdrop, match })

const T = {
	dune: movie(
		693134,
		"Dune: Part Two",
		"/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg",
		"/eZ239CUp1d6OryZEBPnO2n87gMG.jpg",
		93,
		167,
	),
	holdovers: movie(
		840430,
		"The Holdovers",
		"/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
		"/A99WMiz0ASpH9coOFrxSEuwTWx0.jpg",
		88,
		133,
	),
	aftersun: movie(
		965150,
		"Aftersun",
		"/evKz85EKouVbIr51zy5fOtpNRPg.jpg",
		"/4jdduww9j5RyzO4ITRcuBFhqNN1.jpg",
		84,
		101,
	),
	pastLives: movie(
		666277,
		"Past Lives",
		"/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
		"/7HR38hMBl23lf38MAN63y4pKsHz.jpg",
		90,
		106,
	),
	anatomy: movie(
		915935,
		"Anatomy of a Fall",
		"/kQs6keheMwCxJxrzV83VUwFtHkB.jpg",
		"/lDVl2jf6VB8ODl1olZ6FLvOV1gX.jpg",
		86,
		151,
	),
	bear: show(
		136315,
		"The Bear",
		"/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
		"/aJtG4txtmiRHwAAqENQHZvBs6kY.jpg",
		92,
	),
	slowHorses: show(
		95480,
		"Slow Horses",
		"/AdYr4DjOgXvDUMwu6vEhZy1Rnxk.jpg",
		"/gPQppUnLx9vqPDLz3WwZ2HJsNbt.jpg",
		91,
	),
	andor: show(
		83867,
		"Andor",
		"/khZqmwHQicTYoS7Flreb9EddFZC.jpg",
		"/quCeAmVQHfsdcYkicbxZWVauCVb.jpg",
		94,
	),
	adolescence: show(
		249042,
		"Adolescence",
		"/20i4nShZZg1g1VFHSB8xpaYM4r7.jpg",
		"/llZodlkVKRkTdUsiRxvn8h80hhx.jpg",
		90,
	),
	severance: show(
		95396,
		"Severance",
		"/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
		"/ixgFmf1X59PUZam2qbAfskx2gQr.jpg",
		89,
	),
	fallout: show(
		106379,
		"Fallout",
		"/c15BtJxCXMrISLVmysdsnZUPQft.jpg",
		"/coaPCIqQBPUZsOnJcWZxhaORcDT.jpg",
		87,
	),
}

/** The member's services, by the id the availability index uses. */
const SERVICES = { Netflix: 8, "Prime Video": 9, "Disney Plus": 337 } as const
type Service = keyof typeof SERVICES

// The member without any landing: what the doors show today.
const MOVIES_ON_SERVICES: { title: Title; service: Service }[] = [
	{ title: T.pastLives, service: "Netflix" },
	{ title: T.anatomy, service: "Prime Video" },
]
const SHOWS_TO_START = [T.andor, T.adolescence, T.severance]
export const MOVIE_COUNT = 17
export const SOMETHING_NEW = [
	T.fallout.poster,
	T.aftersun.poster,
	T.slowHorses.poster,
]

// ---------------------------------------------------------------------------------------------------------
// The prepared cases

interface Landing {
	title: Title
	service: Service
	daysAgo: number
	/** A show the member watches whose new episode aired as well. */
	episode?: { season: number; number: number; name: string }
}

export const CASES = {
	none: { label: "Nothing", about: "Nothing landed.", landed: [] },
	one: {
		label: "One",
		about: "One Want to See movie landed on Netflix 2 days ago.",
		landed: [{ title: T.dune, service: "Netflix", daysAgo: 2 }],
	},
	several: {
		label: "Several",
		about: "Three movies and a show landed on three services, 1 to 9 days ago.",
		landed: [
			{ title: T.fallout, service: "Prime Video", daysAgo: 1 },
			{ title: T.dune, service: "Netflix", daysAgo: 2 },
			{ title: T.holdovers, service: "Prime Video", daysAgo: 4 },
			{ title: T.aftersun, service: "Disney Plus", daysAgo: 9 },
		],
	},
	both: {
		label: "Episode + landed",
		about:
			"Slow Horses, a show the member watches, has a new episode and landed on Prime Video, both 2 days ago.",
		landed: [
			{
				title: T.slowHorses,
				service: "Prime Video",
				daysAgo: 2,
				episode: { season: 5, number: 3, name: "Tall Tales" },
			},
		],
	},
	fresh: {
		label: "1 day old",
		about: "One movie landed on Netflix yesterday.",
		landed: [{ title: T.dune, service: "Netflix", daysAgo: 1 }],
	},
	old: {
		label: "12 days old",
		about: "One movie landed on Netflix 12 days ago.",
		landed: [{ title: T.dune, service: "Netflix", daysAgo: 12 }],
	},
} satisfies Record<string, { label: string; about: string; landed: Landing[] }>
export type CaseKey = keyof typeof CASES

/** How lately the member watched The Bear, the show they are in the middle of. */
export const WATCHING = {
	yesterday: { label: "yesterday", days: 1 },
	earlier: { label: "9 days ago", days: 9 },
	none: { label: "no show to continue", days: null },
} as const
export type WatchingKey = keyof typeof WATCHING

export interface Setup {
	case: CaseKey
	watching: WatchingKey
	/** The member opened My movies and My shows after everything landed: the signal of #456 has cleared. */
	visited: boolean
}

// ---------------------------------------------------------------------------------------------------------
// What landed, and what of it is still news by the real rule

export interface Arrival {
	title: Title
	service: Service
	at: number
	days: number
	/** Still news by the rule of #456: the pill and the count show it until the member opens the page. */
	unseen: boolean
	episode?: { season: number; number: number; code: string; name: string }
}

function arrivalsOf(setup: Setup): Arrival[] {
	const landed: Landing[] = CASES[setup.case].landed
	const candidates: Candidate[] = landed.map(({ title, service, daysAgo }) => ({
		key: titleKey(title.kind, title.id),
		// Added to Want to See long before; a show the member watches has no such time.
		addedAt: title === T.slowHorses ? null : LAUNCH - 30 * DAY,
		landing: { at: NOW - daysAgo * DAY, service: SERVICES[service] },
	}))
	const visit = setup.visited ? NOW - 3_600_000 : null
	const news = newlyAvailableOf(candidates, {
		launch: LAUNCH,
		visits: { movie: visit, show: visit },
	})
	const unseen = new Set(
		[...news.movies, ...news.shows].map(({ tmdbId }) => tmdbId),
	)
	return landed.map(({ title, service, daysAgo, episode }) => ({
		title,
		service,
		at: NOW - daysAgo * DAY,
		days: daysAgo,
		unseen: unseen.has(title.id),
		...(episode
			? {
					episode: {
						...episode,
						code: `S${episode.season} E${episode.number}`,
					},
				}
			: {}),
	}))
}

const landingsOf = (arrivals: Arrival[]): Landings => ({
	count: arrivals.length,
	ids: arrivals.map(({ title }) => title.id),
	only:
		arrivals.length === 1
			? { title: arrivals[0].title.title, service: arrivals[0].service }
			: null,
})

/**
 * What `/api/tonight` and `/api/new-episodes` would tell the navigation: the real signal. `landings` are the ones
 * to count as landed, where a variation says some of them in another way.
 */
export function signalOf(
	arrivals: Arrival[],
	landings = arrivals,
): {
	landed: NewOnServices | null
	episodes: NewEpisodes | null
} {
	const unseen = landings.filter((a) => a.unseen)
	const aired = arrivals.filter((a) => a.unseen && a.episode)
	return {
		landed: unseen.length
			? {
					movies: landingsOf(unseen.filter((a) => a.title.kind === "movie")),
					shows: landingsOf(unseen.filter((a) => a.title.kind === "show")),
				}
			: null,
		episodes: aired.length
			? {
					shows: aired.length,
					ids: aired.map((a) => a.title.id),
					only: {
						title: aired[0].title.title,
						season: aired[0].episode?.season ?? 1,
						number: aired[0].episode?.number ?? 1,
						episodes: 1,
					},
				}
			: null,
	}
}

// ---------------------------------------------------------------------------------------------------------
// Words

export const ago = (days: number) =>
	days < 1 ? "today" : days === 1 ? "yesterday" : `${days} days ago`
const since = (at: number) =>
	new Date(at).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	})
/** "2h 47m", "2h", "45 min". */
export const duration = (minutes: number) =>
	minutes < 60
		? `${minutes} min`
		: minutes % 60
			? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
			: `${minutes / 60}h`

export type VariantKey = "A" | "B" | "C" | "D"
export const VARIANTS: Record<VariantKey, string> = {
	A: "The door names it",
	B: "It takes tonight",
	C: "A bonus that fades",
	D: "A row of its own",
}

/** Why a title is put forward, in each variation's own wording. `short` is for a phone's door. */
export function reasonOf(
	variant: VariantKey,
	arrival: Arrival,
): { long: string; short: string } {
	const { service, days, at, episode } = arrival
	if (variant === "B")
		return episode
			? {
					long: `New episode, and now on ${service}`,
					short: `New episode, now on ${service}`,
				}
			: {
					long: `You wanted this: now on ${service}`,
					short: `Now on ${service}`,
				}
	if (variant === "C") {
		if (episode)
			return {
				long: `New episode · now on ${service}`,
				short: "New + landed",
			}
		if (days <= 2)
			return { long: `Just landed on ${service}`, short: "Just landed" }
		if (days <= 7)
			return { long: `New on ${service} this week`, short: "New this week" }
		return {
			long: `On ${service} since ${since(at)}`,
			short: `Since ${since(at)}`,
		}
	}
	if (variant === "D")
		return { long: `${service} · ${ago(days)}`, short: service }
	return { long: `New on ${service}`, short: `New on ${service}` }
}

// ---------------------------------------------------------------------------------------------------------
// The four pick rules

/** What a door puts first. `arrival` is set when the title is there because it landed. */
export interface Lead {
	title: Title
	arrival: Arrival | null
	/** Further arrivals behind this door that still have their preference, which the lead does not name. */
	more: Arrival[]
	episode?: { code: string; name: string }
	/** "Watched yesterday": the Continue door's fact. */
	fact?: string
	service?: Service
}

/** A line of the debug panel: one candidate for tonight, and what the rule made of it. */
export interface Row {
	title: string
	what: string
	/** The rank or the points the rule gave it. */
	value: string
	won: boolean
	note: string
}

export interface Decision {
	variant: VariantKey
	/** Tonight's pick. */
	pick: { door: DoorKey; lead: Lead }
	/** True when the pick differs from the pick without any landing. */
	changed: boolean
	doors: { continue: Lead | null; start: Lead; movie: Lead }
	/** The door drawn as the wide one (B). */
	hero: DoorKey | null
	/** The arrivals listed in a row of their own (D). */
	row: Arrival[]
	rows: Row[]
	rule: string
	/** How long a landing keeps its preference. */
	lasts: string
	/** What becomes of the sky blue pill of #456. */
	pill: string
	pills: Pills
}

/** A door's pill. `quiet` is the outlined one of C, for a landing the member has seen on its page. */
export interface Pill {
	long: string
	short: string
	quiet?: boolean
}
export type Pills = Record<DoorKey, Pill | null>

const pillOf = (words: SignalWords | null): Pill | null =>
	words && { long: words.door, short: words.doorShort }

/**
 * Today's pills, by the app's own words, for the landings in `landings` that are still news: shows on the door that
 * opens My shows (Continue, or Start a show without one), movies on A movie. New episodes are always said.
 */
function todaysPills(
	arrivals: Arrival[],
	normal: Normal,
	landings = arrivals,
): Pills {
	const { landed, episodes } = signalOf(arrivals, landings)
	const shows = pillOf(showsWords(episodes, landed?.shows ?? null))
	return {
		continue: normal.continue ? shows : null,
		start: normal.continue ? null : shows,
		movie: pillOf(landedWords("movie", landed?.movies ?? null)),
	}
}

interface Normal {
	continue: Lead | null
	start: Lead
	movie: Lead
	pick: DoorKey
}

function normalOf(setup: Setup): Normal {
	const days = WATCHING[setup.watching].days
	const next: Lead | null =
		days === null
			? null
			: {
					title: T.bear,
					arrival: null,
					more: [],
					episode: { code: "S4 E2", name: "Soubise" },
					fact: days === 1 ? "Watched yesterday" : `Watched ${days} days ago`,
				}
	return {
		continue: next,
		start: { title: SHOWS_TO_START[0], arrival: null, more: [] },
		movie: {
			title: MOVIES_ON_SERVICES[0].title,
			arrival: null,
			more: [],
			service: MOVIES_ON_SERVICES[0].service,
		},
		pick: next ? "continue" : "movie",
	}
}

const doorOf = (arrival: Arrival): DoorKey =>
	arrival.title.kind === "movie"
		? "movie"
		: arrival.episode
			? "continue"
			: "start"
const leadOf = (arrival: Arrival, more: Arrival[] = []): Lead => ({
	title: arrival.title,
	arrival,
	more,
	service: arrival.service,
	...(arrival.episode
		? { episode: arrival.episode, fact: "Watched 6 days ago" }
		: {}),
})
const NORMAL_NOTE: Record<DoorKey, string> = {
	continue: "The show you are in comes first, as today",
	movie: "First of My movies, as today",
	start: "First show to start, as today",
}
const WHAT: Record<DoorKey, string> = {
	continue: "Next episode",
	movie: "Movie",
	start: "Show to start",
}
const normalRow = (
	normal: Normal,
	door: DoorKey,
	value: string,
	won: boolean,
	note = NORMAL_NOTE[door],
): Row | null => {
	const lead = normal[door]
	return lead && { title: lead.title.title, what: WHAT[door], value, won, note }
}
const landedRow = (
	arrival: Arrival,
	value: string,
	won: boolean,
	note: string,
): Row => ({
	title: arrival.title.title,
	what: `Landed ${ago(arrival.days)}, ${arrival.service}${arrival.episode ? ", new episode" : ""}`,
	value,
	won,
	note,
})
const rowsOf = (rows: (Row | null)[]) => rows.filter((row) => row !== null)
/** A door's place in the normal order: "1st", "2nd", "3rd". */
const rankOf = (normal: Normal, door: DoorKey) =>
	["1st", "2nd", "3rd"][
		(normal.continue
			? ["continue", "movie", "start"]
			: ["movie", "start"]
		).indexOf(door)
	]
const latestFirst = (a: Arrival, b: Arrival) => a.days - b.days
const bestFirst = (a: Arrival, b: Arrival) =>
	Number(Boolean(b.episode)) - Number(Boolean(a.episode)) ||
	b.title.match - a.title.match

// A. The arrival leads its own door for 7 days, and never beats the show the member is in.
const A_DAYS = 7
function gentle(setup: Setup, arrivals: Arrival[], normal: Normal): Decision {
	const inside = arrivals
		.filter((a) => a.days <= A_DAYS && !a.episode)
		.sort(latestFirst)
	const lead = (door: "movie" | "start"): Lead => {
		const mine = inside.filter((a) => doorOf(a) === door)
		return mine.length ? leadOf(mine[0], mine.slice(1)) : normal[door]
	}
	const doors = {
		continue: normal.continue,
		start: lead("start"),
		movie: lead("movie"),
	}
	const pick = normal.pick
	const place = (a: Arrival) =>
		doors.movie.arrival === a ? 0 : doors.start.arrival === a ? 1 : 2
	// The door's line names its lead, so today's pill only counts what is left.
	const named = [doors.movie.arrival, doors.start.arrival]
	const pills = todaysPills(
		arrivals,
		normal,
		arrivals.filter((a) => !named.includes(a)),
	)
	if (doors.movie.arrival) {
		const others = arrivals.filter(
			(a) => a.unseen && a.title.kind === "movie" && a !== doors.movie.arrival,
		).length
		pills.movie = others
			? { long: `and ${others} more`, short: `+${others}` }
			: null
	}
	return {
		variant: "A",
		pick: { door: pick, lead: doors[pick] as Lead },
		changed: doors[pick]?.title !== normal[pick]?.title,
		doors,
		hero: null,
		row: [],
		rows: rowsOf([
			normalRow(
				normal,
				"continue",
				rankOf(normal, "continue"),
				pick === "continue",
			),
			...[...arrivals]
				.sort((a, b) => place(a) - place(b))
				.map((a) => {
					const door = doorOf(a)
					const leads = doors[door]?.arrival === a
					if (a.episode)
						return landedRow(
							a,
							"-",
							false,
							"A show you watch: its new episode is said, the landing is not",
						)
					if (a.days > A_DAYS)
						return landedRow(
							a,
							"-",
							false,
							`Past ${A_DAYS} days: back in its normal place`,
						)
					return landedRow(
						a,
						leads ? rankOf(normal, door) : "-",
						leads && pick === door,
						leads
							? `Leads ${door === "movie" ? "A movie" : "Start a show"}`
							: "Behind the newer landing of its door",
					)
				}),
			doors.movie.arrival
				? normalRow(normal, "movie", "-", false, "Moved to second in A movie")
				: normalRow(normal, "movie", rankOf(normal, "movie"), pick === "movie"),
			doors.start.arrival
				? normalRow(
						normal,
						"start",
						"-",
						false,
						"Moved to second in Start a show",
					)
				: normalRow(normal, "start", rankOf(normal, "start"), false),
		]),
		rule: "The normal order decides tonight. A landed title only moves to the front of its own door.",
		lasts: `${A_DAYS} days from the landing, also after the page was opened`,
		pill: "Only for what the door's line does not name: no pill for one, “and 2 more” for several.",
		pills,
	}
}

// B. The arrival is Tonight's pick for 3 days, over everything.
const B_DAYS = 3
function strong(setup: Setup, arrivals: Arrival[], normal: Normal): Decision {
	const inside = arrivals.filter((a) => a.days <= B_DAYS).sort(bestFirst)
	const winner = inside[0]
	const doors = {
		continue: normal.continue,
		start: normal.start,
		movie: normal.movie,
	}
	// The wide door speaks for everything else that landed, inside the days or still news.
	if (winner)
		doors[doorOf(winner)] = leadOf(
			winner,
			arrivals.filter((a) => a !== winner && (a.days <= B_DAYS || a.unseen)),
		)
	const pick = winner ? doorOf(winner) : normal.pick
	const pills = todaysPills(arrivals, normal, winner ? [] : arrivals)
	if (winner?.episode) pills.continue = null
	return {
		variant: "B",
		pick: { door: pick, lead: doors[pick] as Lead },
		changed: Boolean(winner),
		doors,
		hero: winner ? pick : null,
		row: [],
		rows: rowsOf([
			...[...inside, ...arrivals.filter((a) => a.days > B_DAYS)].map((a) =>
				a.days > B_DAYS
					? landedRow(a, "-", false, `Past ${B_DAYS} days: no preference left`)
					: landedRow(
							a,
							`${a.title.match}%`,
							a === winner,
							a === winner
								? inside.length > 1
									? "Best taste match of what landed"
									: "Landed: beats everything"
								: "Landed too, a lower taste match",
						),
			),
			normalRow(
				normal,
				"continue",
				winner ? "after" : rankOf(normal, "continue"),
				!winner && normal.pick === "continue",
				winner ? "Loses to a landing, even in the middle of a show" : undefined,
			),
			normalRow(
				normal,
				"movie",
				winner ? "after" : rankOf(normal, "movie"),
				!winner && normal.pick === "movie",
			),
			normalRow(
				normal,
				"start",
				winner ? "after" : rankOf(normal, "start"),
				false,
			),
		]),
		rule: "A landed title is Tonight's pick, whatever else is going on. Of several, the best taste match; a show with a new episode first.",
		lasts: `${B_DAYS} days from the landing, also after the page was opened`,
		pill: "None while a landing has the wide door, which says “and 2 more”. Without one, today's pill.",
		pills,
	}
}

// C. Points. A landing adds a bonus that fades over 14 days.
const C_DAYS = 14
const bonusOf = (days: number) =>
	days <= 2 ? 60 : days <= 7 ? 25 : days <= C_DAYS ? 10 : 0
const BASE = { movie: 50, start: 30 }
function fading(setup: Setup, arrivals: Arrival[], normal: Normal): Decision {
	const watched = WATCHING[setup.watching].days
	const episodePoints = watched === null ? 0 : watched <= 2 ? 120 : 80
	interface Scored {
		door: DoorKey
		lead: Lead
		points: number
		row: Row
	}
	const scored: Scored[] = []
	const add = (door: DoorKey, lead: Lead, points: number, row: Row) =>
		scored.push({ door, lead, points, row })
	if (normal.continue)
		add("continue", normal.continue, episodePoints, {
			title: normal.continue.title.title,
			what: "Next episode",
			value: String(episodePoints),
			won: false,
			note:
				episodePoints === 120
					? "Watched in the last 2 days: 120"
					: "Watched longer ago: 80",
		})
	add("movie", normal.movie, BASE.movie, {
		title: normal.movie.title.title,
		what: "Movie",
		value: String(BASE.movie),
		won: false,
		note: "First of My movies: 50",
	})
	add("start", normal.start, BASE.start, {
		title: normal.start.title.title,
		what: "Show to start",
		value: String(BASE.start),
		won: false,
		note: "First show to start: 30",
	})
	for (const a of arrivals) {
		const door = doorOf(a)
		const bonus = bonusOf(a.days)
		if (!bonus) {
			scored.push({
				door,
				lead: leadOf(a),
				points: -1,
				row: landedRow(a, "-", false, `Past ${C_DAYS} days: no bonus left`),
			})
			continue
		}
		// A show the member watches counts as an episode watched longer ago, with 20 for the new episode.
		const base = door === "continue" ? 80 + 20 : BASE[door]
		const points = base + bonus
		add(
			door,
			leadOf(a),
			points,
			landedRow(
				a,
				String(points),
				false,
				`${door === "continue" ? "80 + 20 new episode" : base} + ${bonus} landed ${ago(a.days)}`,
			),
		)
	}
	const ranked = scored
		.filter((s) => s.points >= 0)
		.sort(
			(a, b) => b.points - a.points || b.lead.title.match - a.lead.title.match,
		)
	const top = (door: DoorKey) => ranked.find((s) => s.door === door)
	const doorLead = (door: DoorKey): Lead | null => {
		const first = top(door)
		if (!first) return null
		const more = ranked
			.filter((s) => s.door === door && s !== first && s.lead.arrival)
			.map((s) => s.lead.arrival as Arrival)
		return { ...first.lead, more: first.lead.arrival ? more : [] }
	}
	const winner = ranked[0]
	winner.row.won = true
	const doors = {
		continue: doorLead("continue"),
		start: doorLead("start") as Lead,
		movie: doorLead("movie") as Lead,
	}
	const pills = todaysPills(arrivals, normal, [])
	for (const door of ["continue", "start", "movie"] as const) {
		const lead = doors[door]
		if (!lead?.arrival) continue
		const words = reasonOf("C", lead.arrival)
		const more = lead.more.length ? ` +${lead.more.length}` : ""
		pills[door] = {
			long: words.long + more,
			short: words.short + more,
			quiet: !lead.arrival.unseen,
		}
	}
	return {
		variant: "C",
		pick: { door: winner.door, lead: doors[winner.door] as Lead },
		changed: winner.lead.title !== normal[normal.pick]?.title,
		doors,
		hero: null,
		row: [],
		rows: [
			...ranked.map((s) => s.row),
			...scored.filter((s) => s.points < 0).map((s) => s.row),
		],
		rule: "Every candidate has points and the most points win. A landing adds 60 for 2 days, 25 for a week, 10 for two weeks.",
		lasts: `${C_DAYS} days, weaker each week; the wording follows the age`,
		pill: "The pill is the reason: filled until the page was opened, outlined afterwards. No second mark.",
		pills,
	}
}

// D. No preference. What landed is listed in a row of its own.
const D_DAYS = 14
function listed(setup: Setup, arrivals: Arrival[], normal: Normal): Decision {
	const row = arrivals.filter((a) => a.days <= D_DAYS).sort(latestFirst)
	return {
		variant: "D",
		pick: { door: normal.pick, lead: normal[normal.pick] as Lead },
		changed: false,
		doors: {
			continue: normal.continue,
			start: normal.start,
			movie: normal.movie,
		},
		hero: null,
		row,
		rows: rowsOf([
			normalRow(
				normal,
				"continue",
				rankOf(normal, "continue"),
				normal.pick === "continue",
			),
			normalRow(
				normal,
				"movie",
				rankOf(normal, "movie"),
				normal.pick === "movie",
			),
			normalRow(normal, "start", rankOf(normal, "start"), false),
			...arrivals.map((a) =>
				landedRow(
					a,
					"-",
					false,
					a.days <= D_DAYS
						? "Listed in the row, not preferred"
						: `Past ${D_DAYS} days: off the row`,
				),
			),
		]),
		rule: "The pick and the doors stay as they are. What landed gets a row of its own on the TV, newest first.",
		lasts: `${D_DAYS} days on the row, or until the title is watched`,
		pill: "None for landings: the row says it. The pill for new episodes stays.",
		pills: todaysPills(arrivals, normal, []),
	}
}

export function decide(variant: VariantKey, setup: Setup) {
	const arrivals = arrivalsOf(setup)
	const normal = normalOf(setup)
	const rule = { A: gentle, B: strong, C: fading, D: listed }[variant]
	return {
		arrivals,
		normal,
		signal: signalOf(arrivals),
		decision: rule(setup, arrivals, normal),
	}
}

/** The posters of a door's fan, the lead last so that it is drawn on top. */
export function fanOf(door: "movie" | "start", lead: Lead): string[] {
	const rest = (
		door === "movie" ? MOVIES_ON_SERVICES.map((m) => m.title) : SHOWS_TO_START
	).filter((title) => title !== lead.title)
	const behind = [...lead.more.map((a) => a.title), ...rest]
		.filter((title, i, all) => all.indexOf(title) === i)
		.slice(0, 2)
	return [...behind.reverse().map((title) => title.poster), lead.title.poster]
}
export const START_COUNT = (lead: Lead) =>
	SHOWS_TO_START.length + (lead.arrival ? 1 + lead.more.length : 0)
