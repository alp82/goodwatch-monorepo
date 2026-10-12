// PROTOTYPE - throwaway. The sample member of /prototype/arrival-mark and what each variation makes of a landing:
// whether a title still carries its mark, and what the mark says. A landing is a title that was on none of the
// member's services and is now on one (#456, domain/newly-available.ts); here the days are made up and live in the
// browser. Only the titles and the image paths are TMDB's. Nothing is read from or written to a service.

const DAY = 86_400_000

/** The day the prototype starts on. "Next day" moves it. */
export const START_DAY = "2026-10-12"
const at = (day: string) => Date.parse(`${day}T00:00:00Z`)
export const addDays = (day: string, n: number) =>
	new Date(at(day) + n * DAY).toISOString().slice(0, 10)
const DM = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
})
export const dayMonth = (day: string) => DM.format(at(day))

// ---------------------------------------------------------------------------------------------------------
// Services

export const SERVICES = {
	netflix: { name: "Netflix", logo: "/rK1KljqmbvO9HQa1PBFLILWah72.png" },
	max: { name: "Max", logo: "/skypuy7SXuugIQeYg0IglmzoKaS.png" },
	disney: { name: "Disney+", logo: "/5eZ872CghnHFLB1j8grszbrx0dx.png" },
	apple: { name: "Apple TV+", logo: "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png" },
	prime: { name: "Prime Video", logo: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png" },
} as const
export type ServiceKey = keyof typeof SERVICES
/** The services the sample member saved. Prime Video is not one of them. */
export const MINE: ServiceKey[] = ["netflix", "max", "disney", "apple"]
export const logoUrl = (service: ServiceKey) =>
	`https://image.tmdb.org/t/p/w92${SERVICES[service].logo}`

// ---------------------------------------------------------------------------------------------------------
// Titles

export interface Title {
	key: string
	kind: "movie" | "show"
	id: number
	title: string
	year: number
	poster: string
	backdrop: string
	/** Taste match, which orders My movies and the Start group of My shows. */
	match: number
	score: number
	/** A movie's length in minutes. */
	runtime?: number
	/** Subscription services that carry it now. */
	on: ServiceKey[]
	/** Days since the member added it to Want to See. */
	added: number
}

const movie = (
	key: string,
	id: number,
	title: string,
	year: number,
	runtime: number,
	match: number,
	score: number,
	on: ServiceKey[],
	added: number,
	poster: string,
	backdrop: string,
): Title => ({
	key,
	kind: "movie",
	id,
	title,
	year,
	runtime,
	match,
	score,
	on,
	added,
	poster,
	backdrop,
})

export const MOVIES: Title[] = [
	movie(
		"eeaao",
		545611,
		"Everything Everywhere All at Once",
		2022,
		139,
		98,
		88,
		["netflix"],
		40,
		"/u68AjlvlutfEIcpmbYpKcdi09ut.jpg",
		"/fIwiFha3WPu5nHkBeMQ4GzEk0Hv.jpg",
	),
	movie(
		"aftersun",
		965150,
		"Aftersun",
		2022,
		102,
		97,
		84,
		["netflix", "disney"],
		61,
		"/evKz85EKouVbIr51zy5fOtpNRPg.jpg",
		"/4jdduww9j5RyzO4ITRcuBFhqNN1.jpg",
	),
	movie(
		"dune2",
		693134,
		"Dune: Part Two",
		2024,
		167,
		96,
		89,
		["max"],
		14,
		"/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg",
		"/eZ239CUp1d6OryZEBPnO2n87gMG.jpg",
	),
	movie(
		"parasite",
		496243,
		"Parasite",
		2019,
		133,
		94,
		91,
		["netflix"],
		300,
		"/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
		"/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg",
	),
	movie(
		"perfect",
		976893,
		"Perfect Days",
		2023,
		124,
		93,
		83,
		["disney"],
		18,
		"/tvUHVSTJV9ITON3oyHaWp7oaAc8.jpg",
		"/hjWxngV6tidwDkfJDEgMjHD2KEz.jpg",
	),
	movie(
		"drive",
		758866,
		"Drive My Car",
		2021,
		179,
		92,
		82,
		["max"],
		95,
		"/znXps7wPyYq8UDCfeyO2vfEIeRS.jpg",
		"/r6aqhlmJmu8Dv5E7QYEruaEXKYm.jpg",
	),
	movie(
		"holdovers",
		840430,
		"The Holdovers",
		2023,
		133,
		91,
		85,
		["netflix"],
		20,
		"/VHSzNBTwxV8vh7wylo7O9CLdac.jpg",
		"/57fhbxl9is7W7ur5v6UuvlNsoSg.jpg",
	),
	movie(
		"anatomy",
		915935,
		"Anatomy of a Fall",
		2023,
		151,
		90,
		84,
		["netflix"],
		28,
		"/1ho0d4LNZw3Y0voeKmSvPSgJOJ2.jpg",
		"/lDVl2jf6VB8ODl1olZ6FLvOV1gX.jpg",
	),
	movie(
		"banshees",
		674324,
		"The Banshees of Inisherin",
		2022,
		114,
		89,
		83,
		["disney"],
		220,
		"/4yFG6cSPaCaPhyJ1vtGOtMD1lgh.jpg",
		"/1vXD5HXqkhvsXFHE7KmCPZGPR1e.jpg",
	),
	movie(
		"zone",
		467244,
		"The Zone of Interest",
		2023,
		105,
		88,
		80,
		["max"],
		75,
		"/hUu9zyZmDd8VZegKi1iK1Vk0RYS.jpg",
		"/pnTSOKcYnvdpQNQElAtJM1rWOxH.jpg",
	),
	movie(
		"poor",
		792307,
		"Poor Things",
		2023,
		141,
		87,
		84,
		["disney"],
		160,
		"/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg",
		"/zh6IdheEYinU4TPtorWsjx6qPQE.jpg",
	),
	movie(
		"sinners",
		1233413,
		"Sinners",
		2025,
		138,
		86,
		86,
		["max"],
		12,
		"/fWPgbnt2LSqkQ6cdQc0SZN9CpLm.jpg",
		"/nAxGnGHOsfzufThz20zgmRwKur3.jpg",
	),
	movie(
		"oppenheimer",
		872585,
		"Oppenheimer",
		2023,
		180,
		84,
		88,
		["netflix"],
		400,
		"/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
		"/neeNHeXjMF5fXoCJRsOmkNGC7q.jpg",
	),
	movie(
		"killers",
		466420,
		"Killers of the Flower Moon",
		2023,
		206,
		82,
		81,
		["apple"],
		330,
		"/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg",
		"/acvE3RWjDLgvbL2RtcyzkrsAyNV.jpg",
	),
	movie(
		"furiosa",
		786892,
		"Furiosa: A Mad Max Saga",
		2024,
		148,
		81,
		79,
		["netflix"],
		55,
		"/iADOJ8Zymht2JPMoy3R7xceZprc.jpg",
		"/raph7qjAGTMXaIjVxt6ZDSXRzUr.jpg",
	),
	movie(
		"past",
		666277,
		"Past Lives",
		2023,
		106,
		80,
		86,
		["netflix"],
		250,
		"/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
		"/7HR38hMBl23lf38MAN63y4pKsHz.jpg",
	),
	movie(
		"civil",
		929590,
		"Civil War",
		2024,
		109,
		78,
		76,
		["max"],
		44,
		"/sh7Rg8Er3tFcN9BpKIPOMvALgZd.jpg",
		"/t2SXZ7KLriaLyf5QT8Iar6fSOGp.jpg",
	),
	movie(
		"tar",
		817758,
		"TÁR",
		2022,
		158,
		77,
		79,
		["netflix"],
		500,
		"/dRVAlaU0vbG6hMf2K45NSiIyoUe.jpg",
		"/84XcRwKHAw4VXdKOYTSW5ARxFEt.jpg",
	),
	// On none of the member's services: only the Want to See list shows them.
	movie(
		"anora",
		1064213,
		"Anora",
		2024,
		139,
		86,
		82,
		[],
		9,
		"/cgXk2tNYhJZLXdBDO5DidAVzQ82.jpg",
		"/spGbtEo5sglgOb7OBevxzm5Agj8.jpg",
	),
	movie(
		"conclave",
		974576,
		"Conclave",
		2024,
		120,
		85,
		83,
		["prime"],
		21,
		"/m5x8D0bZ3eKqIVWZ5y7TnZ2oTVg.jpg",
		"/eZzNdjNDvaSoyywy9ICg2UmFwul.jpg",
	),
	movie(
		"challengers",
		937287,
		"Challengers",
		2024,
		131,
		83,
		80,
		["prime"],
		66,
		"/H6vke7zGiuLsz4v4RPeReb9rsv.jpg",
		"/4CcUgdiGe83MeqJW1NyJVmZqRrF.jpg",
	),
	movie(
		"brutalist",
		549509,
		"The Brutalist",
		2024,
		215,
		80,
		81,
		[],
		33,
		"/vP7Yd6couiAaw9jgMd5cjMRj3hQ.jpg",
		"/hmZnqijPaaACjenDkrbWcCmcADI.jpg",
	),
]

export interface Show extends Title {
	group: "continue" | "start"
	/** Continue: the Next episode and when it aired, in days before the start day. */
	next?: { code: string; name: string; aired: number }
	progress?: string
	lastWatch?: string
	/** Start: what starting the show costs, and whether it still runs. */
	cost?: string
	running?: boolean
}

const show = (
	key: string,
	id: number,
	title: string,
	year: number,
	match: number,
	on: ServiceKey[],
	added: number,
	poster: string,
	backdrop: string,
	rest: Partial<Show> & Pick<Show, "group">,
): Show => ({
	key,
	kind: "show",
	id,
	title,
	year,
	match,
	score: 84,
	on,
	added,
	poster,
	backdrop,
	...rest,
})

export const SHOWS: Show[] = [
	show(
		"bear",
		136315,
		"The Bear",
		2022,
		92,
		["disney"],
		420,
		"/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg",
		"/aJtG4txtmiRHwAAqENQHZvBs6kY.jpg",
		{
			group: "continue",
			next: { code: "S4 E4", name: "Scallop", aired: 109 },
			progress: "31 of 38 episodes",
			lastWatch: "Watched yesterday",
		},
	),
	// Watching, with a Next episode that aired three days ago. In the scenarios it also lands on Apple TV+.
	show(
		"slow",
		95480,
		"Slow Horses",
		2022,
		95,
		["apple"],
		380,
		"/AdYr4DjOgXvDUMwu6vEhZy1Rnxk.jpg",
		"/gPQppUnLx9vqPDLz3WwZ2HJsNbt.jpg",
		{
			group: "continue",
			next: { code: "S6 E4", name: "Bad Tradecraft", aired: 3 },
			progress: "33 of 36 episodes",
			lastWatch: "Watched 4 days ago",
		},
	),
	show(
		"industry",
		90812,
		"Industry",
		2020,
		88,
		["max"],
		300,
		"/mZ7YFEOxAKfjXJKWm0sYFXQ8n8A.jpg",
		"/qcV7ebwtZcoRxBufUmXQl0KKdht.jpg",
		{
			group: "continue",
			next: { code: "S3 E2", name: "Smoke and Mirrors", aired: 400 },
			progress: "17 of 24 episodes",
			lastWatch: "Watched 3 weeks ago",
		},
	),
	show(
		"severance",
		95396,
		"Severance",
		2022,
		97,
		["apple"],
		70,
		"/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
		"/ixgFmf1X59PUZam2qbAfskx2gQr.jpg",
		{
			group: "start",
			cost: "2 seasons · 19 episodes · about 16 hours",
			running: true,
		},
	),
	show(
		"pitt",
		250307,
		"The Pitt",
		2025,
		94,
		["max"],
		10,
		"/kvFSpESyBZMjaeOJDx7RS3P1jey.jpg",
		"/z3BkMbCy5ajZPMyKEUwsPHuz2cV.jpg",
		{
			group: "start",
			cost: "1 season · 15 episodes · about 12 hours",
			running: true,
		},
	),
	show(
		"adolescence",
		249042,
		"Adolescence",
		2025,
		91,
		["netflix"],
		30,
		"/20i4nShZZg1g1VFHSB8xpaYM4r7.jpg",
		"/llZodlkVKRkTdUsiRxvn8h80hhx.jpg",
		{
			group: "start",
			cost: "1 season · 4 episodes · about 4 hours",
			running: false,
		},
	),
	show(
		"andor",
		83867,
		"Andor",
		2022,
		89,
		["disney"],
		200,
		"/khZqmwHQicTYoS7Flreb9EddFZC.jpg",
		"/quCeAmVQHfsdcYkicbxZWVauCVb.jpg",
		{
			group: "start",
			cost: "2 seasons · 24 episodes · about 19 hours",
			running: false,
		},
	),
	show(
		"dark",
		70523,
		"Dark",
		2017,
		86,
		["netflix"],
		510,
		"/wSXJHO9WHLb0aCwvQrtco7vOmWA.jpg",
		"/3jDXL4Xvj3AzDOF6UH1xeyHW8MH.jpg",
		{
			group: "start",
			cost: "3 seasons · 26 episodes · about 24 hours",
			running: false,
		},
	),
	show(
		"fallout",
		106379,
		"Fallout",
		2024,
		84,
		["prime"],
		150,
		"/c15BtJxCXMrISLVmysdsnZUPQft.jpg",
		"/coaPCIqQBPUZsOnJcWZxhaORcDT.jpg",
		{
			group: "start",
			cost: "1 season · 8 episodes · about 8 hours",
			running: true,
		},
	),
]

export const TITLES: Title[] = [...MOVIES, ...SHOWS]
export const titleOf = (key: string) =>
	TITLES.find((title) => title.key === key) as Title

// ---------------------------------------------------------------------------------------------------------
// The sample members: which titles landed, on which of the member's services, how many days before the start day

type Landed = Record<string, { on: ServiceKey[]; ago: number }>

export const MEMBERS: Record<string, { label: string; landed: Landed }> = {
	several: {
		label: "Several arrived (1 to 12 days old)",
		landed: {
			dune2: { on: ["max"], ago: 1 },
			holdovers: { on: ["netflix"], ago: 3 },
			// One title, two of the member's services on the same day.
			aftersun: { on: ["netflix", "disney"], ago: 5 },
			past: { on: ["netflix"], ago: 12 },
			pitt: { on: ["max"], ago: 1 },
			// A show with a new episode that also landed.
			slow: { on: ["apple"], ago: 2 },
			andor: { on: ["disney"], ago: 12 },
		},
	},
	one: {
		label: "One movie arrived",
		landed: { dune2: { on: ["max"], ago: 1 } },
	},
	both: {
		label: "A show with a new episode that also arrived",
		landed: { slow: { on: ["apple"], ago: 2 } },
	},
	none: { label: "Nothing arrived", landed: {} },
}
export type MemberKey = keyof typeof MEMBERS

// ---------------------------------------------------------------------------------------------------------
// The variations: how long a mark lasts and how it goes

export const VARIANTS = {
	A: {
		name: "Shelf",
		bet: "A row above the list, and a tag that names the service. 14 days, then gone.",
	},
	B: {
		name: "Chip",
		bet: "A filter chip, and the service's logo ringed in sky on the poster. 7 days, then gone.",
	},
	C: {
		name: "Order",
		bet: "A sort and a group of the list itself; the mark is a line of words. Loud for 7 days, quiet until day 14.",
	},
	D: {
		name: "Log",
		bet: "One row that opens to a dated list, and a dot on the poster. Stays until you open the title, 30 days at most.",
	},
} as const
export type VariantKey = keyof typeof VARIANTS

export interface Mark {
	title: Title
	/** The member's services the title landed on, the first one first. */
	on: ServiceKey[]
	/** Days since it landed. */
	age: number
	/** The day it landed. */
	day: string
	/** "fresh": the full mark. "quiet": the mark after its loud days (variation C only). */
	state: "fresh" | "quiet"
}

/** Why a title that landed carries no mark any more, or null while it does. */
export function goneWhy(
	variant: VariantKey,
	age: number,
	opened: boolean,
): string | null {
	if (variant === "A") return age >= 14 ? "older than 14 days" : null
	if (variant === "B") return age >= 7 ? "older than 7 days" : null
	if (variant === "C") return age >= 14 ? "older than 14 days" : null
	if (opened) return "you opened the title"
	return age >= 30 ? "older than 30 days" : null
}

/** The marks a variation shows today, the latest landing first. */
export function marksOf(
	variant: VariantKey,
	member: MemberKey,
	dayOffset: number,
	opened: ReadonlySet<string>,
): Map<string, Mark> {
	const today = addDays(START_DAY, dayOffset)
	const marks: Mark[] = []
	for (const [key, { on, ago }] of Object.entries(MEMBERS[member].landed)) {
		const age = ago + dayOffset
		if (goneWhy(variant, age, opened.has(key))) continue
		marks.push({
			title: titleOf(key),
			on,
			age,
			day: addDays(today, -age),
			state: variant === "C" && age >= 7 ? "quiet" : "fresh",
		})
	}
	marks.sort((a, b) => a.age - b.age || b.title.match - a.title.match)
	return new Map(marks.map((mark) => [mark.title.key, mark]))
}

// ---------------------------------------------------------------------------------------------------------
// Words

export const serviceNames = (on: ServiceKey[]) => {
	const names = on.map((service) => SERVICES[service].name)
	return names.length < 3
		? names.join(" and ")
		: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}
/** "today", "yesterday", "5 days ago". */
export const ageWords = (age: number) =>
	age <= 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`
export const capital = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1)
/** "New on Netflix", "New on Netflix and Disney+". */
export const newOn = (mark: Mark) => `New on ${serviceNames(mark.on)}`
/** Variation C: "New on Netflix · yesterday", and after its loud days "On Netflix since 30 Sep". */
export const lineOf = (mark: Mark) =>
	mark.state === "quiet"
		? `On ${serviceNames(mark.on)} since ${dayMonth(mark.day)}`
		: `${newOn(mark)} · ${ageWords(mark.age)}`

export const runtimeWords = (minutes: number) =>
	`${Math.floor(minutes / 60)}h ${minutes % 60}m`
export const addedWords = (days: number) =>
	days === 0
		? "Added today"
		: days === 1
			? "Added yesterday"
			: days < 30
				? `Added ${days} days ago`
				: days < 60
					? "Added a month ago"
					: days < 365
						? `Added ${Math.floor(days / 30)} months ago`
						: "Added over a year ago"
