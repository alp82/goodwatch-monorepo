// DEVELOPMENT HARNESS (issue #385), not a prototype of a design: what /prototype/my-library-real reads. The REAL
// server reads of My shows, My movies, My library, the TV's Tonight and My shows, and Tonight's pick run here
// against an in-memory Crate that holds a member who does not exist. It is how the pages are driven in a headless browser without a
// signed-in session or a database.
//
// The stand-in takes the place of the Crate client of the dev server it runs in, and refuses to do so when that
// server has a Crate configured. The member's rows (watch state, watch log, Wishlist, scores, settings) are in the
// in-memory Crate of the tracking tests; the catalog (titles, runtimes, aired counts, services) is answered from the
// fixture below. Titles are made up or borrowed by name only: nothing is read from TMDB, and posters are paths that
// lead nowhere.
import type { LibraryChoice } from "~/domain/my-library"
import { utcDay } from "~/domain/tracking/machine"
import {
	availabilityLoaded,
	forgetAvailabilityForTest,
	servicesFor,
} from "~/server/availability-index.server"
import { getLibraryPage } from "~/server/my-library.server"
import { getMyShows } from "~/server/my-shows.server"
import {
	MY_SHOWS_VISIT_KEY,
	getNewShows,
	recordMyShowsVisit,
} from "~/server/new-episodes.server"
import {
	getNewOn,
	getNewlyAvailable,
	getRecentlyLanded,
	recordMyMoviesVisit,
} from "~/server/newly-available.server"
import { updateScores } from "~/server/scores.server"
import {
	type ShowAction,
	applyShowTrackingAction,
	getShowTrackingPage,
} from "~/server/show-tracking.server"
import type { Taste } from "~/server/taste/index.server"
import { getTonightsPick } from "~/server/tonight.server"
import { FakeTrackingCrate } from "~/server/tracking-fake-crate"
import { getUserData } from "~/server/userData.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import { getWatchNext, getWatchNextTitles } from "~/server/watch-next.server"
import {
	HARNESS_MEMBER,
	type LandedKey,
	type MemberKey,
	type SeenSize,
} from "~/ui/prototype-my-library/setup"
import { setCrateClientForTest } from "~/utils/crate"
import { seededRandomSin } from "~/utils/random"
import { parseTitleKey } from "~/utils/title-key"

type Row = Record<string, unknown>
const DAY = 86_400_000

// ---------------------------------------------------------------------------------------------------------
// The catalog

const SHOW_NAMES = [
	"Slow Horses",
	"Severance",
	"The Bear",
	"Shōgun",
	"Andor",
	"Fallout",
	"Only Murders in the Building",
	"The White Lotus",
	"Dark",
	"The Idol",
	"Hacks",
	"The Diplomat",
	"Silo",
	"Foundation",
	"Yellowjackets",
	"Poker Face",
	"The Last of Us",
	"House of the Dragon",
	"For All Mankind",
	"Reservation Dogs",
	"Abbott Elementary",
	"The Rehearsal",
	"Barry",
	"Industry",
	"Bad Sisters",
	"Shrinking",
	"Pluribus",
	"Dept. Q",
	"Task",
]
/** The names of the member with 25 Watching shows: all but the four that have another status here. */
const WATCHING_NAMES = SHOW_NAMES.filter((_, i) => i < 6 || i > 9)
const START_NAMES = [
	"Chernobyl",
	"Mr. Robot",
	"Station Eleven",
	"The Leftovers",
	"Fleabag",
	"Succession",
	"Better Call Saul",
	"Dark Matter",
	"Pachinko",
	"Mindhunter",
	"Halt and Catch Fire",
	"The Americans",
]
const MOVIE_NAMES: [string, number][] = [
	["Past Lives", 106],
	["Dune: Part Two", 167],
	["The Holdovers", 133],
	["Anatomy of a Fall", 152],
	["Perfect Days", 124],
	["Aftersun", 102],
	["The Zone of Interest", 105],
	["Poor Things", 141],
	["Oppenheimer", 181],
	["Decision to Leave", 139],
	["The Banshees of Inisherin", 114],
	["Tár", 158],
	["Drive My Car", 179],
	["Petite Maman", 73],
	["The Worst Person in the World", 128],
	["Licorice Pizza", 134],
	["Spider-Man: Across the Spider-Verse", 140],
	["Killers of the Flower Moon", 206],
	["Godzilla Minus One", 125],
	["The Boy and the Heron", 124],
	["Challengers", 131],
	["Civil War", 109],
	["Furiosa: A Mad Max Saga", 148],
	["Conclave", 120],
	["Anora", 139],
	["The Substance", 141],
	["Flow", 85],
	["A Real Pain", 90],
	["Nickel Boys", 140],
	["The Brutalist", 215],
]
const ADJECTIVES =
	"Silent Crimson Hollow Distant Burning Frozen Golden Broken Hidden Last Wild Quiet Lost Midnight Paper Glass Iron Velvet Electric Savage Gentle Northern Southern Endless Borrowed Stolen Restless Scarlet Pale Bitter Sweet Wandering Sleeping Falling Rising Secret Empty Crooked Blue Sudden".split(
		" ",
	)
const NOUNS =
	"Harbor Garden Empire Station Summer Winter Letters Kingdom River Mountain Horizon Orchard Highway Lantern Harvest Mirror Carnival Frontier Lighthouse Cathedral Island Desert Voyage Parade Symphony Theory Promise Shadow Tide Engine Meadow Avenue Signal Archive Ritual Compass Fortune Monsoon Republic Machine Verdict".split(
		" ",
	)
const EPISODE_NAMES = [
	"Pilot",
	"Failure's Contagious",
	"Bad Tradecraft",
	"Visiting Hours",
	"Fiasco",
	"Follies",
	"Hello, Ms. Cobel",
	"Half Loop",
	"The You You Are",
	"Defiant Jazz",
	"What's for Dinner?",
	"The We We Are",
	"Old Money",
	"Cleaning House",
]

/** Netflix and Disney Plus are the member's; Max carries titles they can't play. */
const SERVICES = [
	{ id: 8, name: "Netflix", logo_path: "/harness-netflix.jpg" },
	{ id: 337, name: "Disney Plus", logo_path: "/harness-disney.jpg" },
	{ id: 1899, name: "Max", logo_path: "/harness-max.jpg" },
]
const serviceOf = (id: number) => SERVICES[id % 4]?.id ?? null

/** An offer that first appeared lately (#456): the title was on Max or nowhere, and is now on a service of the member's. */
interface LandedOffer {
	type: "movie" | "show"
	id: number
	service: number
	at: number
}
// Each with the days since it appeared.
const LANDED_OFFERS: Record<
	LandedKey,
	[type: "movie" | "show", id: number, service: number, days: number][]
> = {
	none: [],
	// Dune: Part Two.
	movie: [["movie", 1002, 8, 1]],
	// Station Eleven.
	show: [["show", 303, 337, 1]],
	several: [
		["movie", 1002, 8, 1],
		["movie", 1003, 8, 3],
		["movie", 1006, 337, 5],
		["movie", 1007, 8, 12],
		["show", 303, 337, 1],
		["show", 302, 8, 2],
	],
	// Slow Horses, which the member `new` watches and whose Next episode aired since their visit.
	episode: [["show", 202, 8, 2]],
	// The Holdovers, which the member added 19 days ago: before it landed, as the rule asks.
	old: [["movie", 1003, 8, 12]],
	gone: [["movie", 1003, 8, 15]],
}

interface Fixture {
	rows: Record<string, Row[]>
	movies: Map<number, Row>
	shows: Map<number, Row>
	landed: LandedOffer[]
}

const title = (id: number, name: string, year: number, rest: Row): Row => ({
	tmdb_id: id,
	title: name,
	poster_path: `/harness-poster-${id}.jpg`,
	backdrop_path: `/harness-backdrop-${id}.jpg`,
	release_year: year,
	tagline: null,
	goodwatch_overall_score_normalized_percent: 62 + ((id * 13) % 33),
	goodwatch_overall_score_voting_count: 4000 + id,
	popularity: 10 + (id % 90),
	...rest,
})

function build(
	member: MemberKey,
	seen: SeenSize,
	landed: LandedKey,
	now: number,
): Fixture {
	const today = Math.floor(now / DAY) * DAY
	const daysAgo = (days: number) => today - days * DAY + 20 * 3_600_000
	const fixture: Fixture = {
		// At noon of its day, so that the days since read the same at any hour; the first of a day is the latest.
		landed: LANDED_OFFERS[landed].map(([type, id, service, days], i) => ({
			type,
			id,
			service,
			at: today - days * DAY + 12 * 3_600_000 - i * 60_000,
		})),
		rows: {
			user_watch_state: [],
			user_watch_log: [],
			user_wishlist: [],
			user_score: [],
			user_setting: [
				{ user_id: HARNESS_MEMBER, key: "country_default", value: "US" },
				{
					user_id: HARNESS_MEMBER,
					key: "streaming_providers_default",
					value: "8,337",
				},
			],
			episode: [],
		},
		movies: new Map(),
		shows: new Map(),
	}
	const { rows } = fixture
	let watches = 0
	const mine = (mediaType: string, id: number, at: number): Row => ({
		user_id: HARNESS_MEMBER,
		tmdb_id: id,
		media_type: mediaType,
		created_at: at,
		updated_at: at,
	})
	const state = (mediaType: string, id: number, value: string, at: number) =>
		rows.user_watch_state.push({
			...mine(mediaType, id, at),
			state: value,
			state_changed_at: at,
			pass: 1,
			seen_press_group: null,
			seen_press_from: null,
			rate_prompt_dismissed_at: null,
			seen_question: "not_asked",
		})
	const watch = (
		mediaType: string,
		id: number,
		at: number | null,
		rest: Row = {},
	) =>
		rows.user_watch_log.push({
			user_id: HARNESS_MEMBER,
			watch_id: `harness-${++watches}`,
			media_type: mediaType,
			tmdb_id: id,
			episode_tmdb_id: null,
			season_number: null,
			episode_number: null,
			watched_at: at,
			watched_at_precision: at === null ? "unknown" : "day",
			origin: "single",
			group_id: null,
			import_id: null,
			pass: 1,
			created_at: at ?? daysAgo(700),
			updated_at: at ?? daysAgo(700),
			...rest,
		})
	const wish = (mediaType: string, id: number, days: number) =>
		rows.user_wishlist.push(mine(mediaType, id, daysAgo(days)))

	/**
	 * A show with `aired` aired episodes in seasons of `perSeason`, the last one aired `lastAir` days ago, and two to
	 * come while it runs. Returns the aired episodes in order.
	 */
	const show = (
		id: number,
		name: string,
		aired: number,
		options: { running?: boolean; perSeason?: number; lastAir?: number } = {},
	) => {
		const { running = true, perSeason = 8, lastAir = 3 } = options
		const total = aired + (running ? 2 : 0)
		const episodes: { season: number; number: number }[] = []
		for (let i = 0; i < total; i++) {
			const season = Math.floor(i / perSeason) + 1
			const number = (i % perSeason) + 1
			// Weekly, the last aired one `lastAir` days ago; what is to come follows week by week.
			const airDate = today - (lastAir + (aired - 1 - i) * 7) * DAY
			rows.episode.push({
				show_id: id,
				tmdb_id: id * 1000 + i,
				season_number: season,
				episode_number: number,
				name: EPISODE_NAMES[(id + i) % EPISODE_NAMES.length],
				air_date: airDate,
				runtime: 42 + (id % 14),
				still_path: null,
				episode_type: "standard",
				removed_at: null,
			})
			if (i < aired) episodes.push({ season, number })
		}
		fixture.shows.set(
			id,
			title(id, name, 2018 + (id % 8), {
				status: running ? "Returning Series" : "Ended",
				aired_episode_count: aired,
				number_of_seasons: Math.ceil(total / perSeason),
				number_of_episodes: total,
				episode_runtime: [42 + (id % 14)],
				last_air_date: today - lastAir * DAY,
			}),
		)
		return episodes
	}
	/** The member watched the first `count` episodes, the last of them `last` days ago, one a day before that. */
	const watched = (
		id: number,
		episodes: { season: number; number: number }[],
		count: number,
		last: number,
	) =>
		episodes.slice(0, count).forEach((episode, i) =>
			watch("show", id, daysAgo(last + (count - 1 - i)), {
				episode_tmdb_id: id * 1000 + i,
				season_number: episode.season,
				episode_number: episode.number,
				watched_at_precision: i === count - 1 ? "moment" : "day",
			}),
		)
	const tracked = (
		id: number,
		name: string,
		value: string,
		aired: number,
		seenCount: number,
		last: number,
		options: { running?: boolean; perSeason?: number; lastAir?: number } = {},
	) => {
		watched(id, show(id, name, aired, options), seenCount, last)
		state("show", id, value, daysAgo(last))
	}

	/**
	 * A show whose episodes air on the days given: `aired` in days ago, the oldest first, and `coming` in days from
	 * today. Returns the aired episodes in order.
	 */
	const showAt = (
		id: number,
		name: string,
		aired: number[],
		coming: number[],
		perSeason = 8,
	) => {
		const days = [...aired.map((ago) => -ago), ...coming]
		const place = (i: number) => ({
			season: Math.floor(i / perSeason) + 1,
			number: (i % perSeason) + 1,
		})
		days.forEach((offset, i) =>
			rows.episode.push({
				show_id: id,
				tmdb_id: id * 1000 + i,
				season_number: place(i).season,
				episode_number: place(i).number,
				name: EPISODE_NAMES[(id + i) % EPISODE_NAMES.length],
				air_date: today + offset * DAY,
				runtime: 42 + (id % 14),
				still_path: null,
				episode_type: "standard",
				removed_at: null,
			}),
		)
		fixture.shows.set(
			id,
			title(id, name, 2018 + (id % 8), {
				status: "Returning Series",
				aired_episode_count: aired.length,
				number_of_seasons: Math.ceil(days.length / perSeason),
				number_of_episodes: days.length,
				episode_runtime: [42 + (id % 14)],
				last_air_date: today - (aired.at(-1) ?? 0) * DAY,
			}),
		)
		return aired.map((_, i) => place(i))
	}
	/** `count` episodes a week apart, the last one `last` days ago. */
	const weekly = (count: number, last: number) =>
		Array.from({ length: count }, (_, i) => last + (count - 1 - i) * 7)

	// The member of #442: the last visit of My shows was five days ago.
	if (member === "new") {
		rows.user_setting.push({
			user_id: HARNESS_MEMBER,
			key: MY_SHOWS_VISIT_KEY,
			value: new Date(daysAgo(5)).toISOString(),
		})
		const follow = (
			id: number,
			name: string,
			value: string,
			aired: number[],
			coming: number[],
			seenCount: number,
			last: number,
			perSeason = 8,
		) => {
			watched(id, showAt(id, name, aired, coming, perSeason), seenCount, last)
			state("show", id, value, daysAgo(last))
		}
		// To continue. Tonight's pick, with nothing new.
		follow(201, "The Bear", "watching", weekly(38, 110), [], 31, 1, 10)
		// Watching, and its Next episode aired since the visit.
		follow(
			202,
			"Slow Horses",
			"watching",
			[...weekly(33, 11), 4],
			[3, 10],
			33,
			3,
			6,
		)
		// Nine behind: one more aired since the visit, and the show is not new.
		follow(203, "Industry", "watching", weekly(42, 2), [], 33, 21, 10)
		// Seen, and a new season opened with two episodes.
		follow(
			204,
			SHOW_NAMES[6],
			"seen",
			[...weekly(50, 330), 3, 3],
			[4, 11],
			50,
			340,
			10,
		)
		// Seen, and a whole season dropped at once.
		follow(
			205,
			"Wednesday",
			"seen",
			[...weekly(16, 400), ...Array(8).fill(2)],
			[],
			16,
			400,
		)
		// Seen, and this week's episode airs today.
		follow(
			206,
			SHOW_NAMES[7],
			"seen",
			[...weekly(21, 200), 14, 7, 0],
			[7],
			23,
			6,
			7,
		)
		// Waiting: the next episode tomorrow, in three and in four days, further out, and without a date.
		follow(
			207,
			"Shrinking",
			"seen",
			[...weekly(24, 300), ...weekly(5, 6)],
			[1, 8],
			29,
			6,
			12,
		)
		// Its episode of four days ago aired since the visit and is watched: not new.
		follow(
			208,
			SHOW_NAMES[20],
			"seen",
			[...weekly(93, 200), 11, 4],
			[3],
			95,
			3,
			22,
		)
		follow(
			209,
			SHOW_NAMES[10],
			"seen",
			[...weekly(37, 250), 3],
			[4, 11],
			38,
			2,
			10,
		)
		follow(210, "Severance", "seen", weekly(20, 200), [40, 47], 20, 190, 10)
		follow(211, SHOW_NAMES[11], "watching", weekly(22, 150), [53], 22, 140)
		follow(212, "Fallout", "seen", weekly(16, 240), [95], 16, 230)
		follow(213, SHOW_NAMES[17], "seen", weekly(26, 80), [], 26, 70, 10)
		follow(214, SHOW_NAMES[12], "seen", weekly(30, 260), [], 30, 250, 10)
		follow(215, SHOW_NAMES[14], "watching", weekly(29, 500), [], 21, 100, 10)
		// On hold, and its new season has begun: never new.
		follow(
			216,
			SHOW_NAMES[16],
			"on_hold",
			[...weekly(16, 500), 7, 0],
			[7],
			16,
			500,
		)
		follow(217, SHOW_NAMES[18], "on_hold", weekly(40, 300), [], 23, 300, 10)
		follow(218, SHOW_NAMES[9], "dropped", weekly(5, 600), [], 2, 300, 5)
		// Put on hold long ago with watches without dates, and resumed two days ago: the member's own move to
		// Watching puts it in Continue.
		showAt(219, "Star Trek: Picard", weekly(30, 400), [], 10)
			.slice(0, 20)
			.forEach((episode, i) =>
				watch("show", 219, null, {
					episode_tmdb_id: 219_000 + i,
					season_number: episode.season,
					episode_number: episode.number,
					origin: "seen",
					group_id: "mig-seen-219",
					created_at: daysAgo(500),
					updated_at: daysAgo(500),
				}),
			)
		state("show", 219, "watching", daysAgo(2))
		// To pick up: not watched for 90 days.
		follow(220, "Lost", "watching", weekly(24, 300), [], 9, 200, 8)
		follow(221, "Mad Men", "watching", weekly(36, 500), [], 30, 400, 12)
		// An import made it Watching two days ago, by watches without a date: the import is no activity.
		showAt(222, "The Leftovers", weekly(20, 700), [], 10)
			.slice(0, 12)
			.forEach((episode, i) =>
				watch("show", 222, null, {
					episode_tmdb_id: 222_000 + i,
					season_number: episode.season,
					episode_number: episode.number,
					origin: "import",
					import_id: "harness-import",
					created_at: daysAgo(2),
					updated_at: daysAgo(2),
				}),
			)
		state("show", 222, "watching", daysAgo(2))
	}

	// The shows the member tracks.
	if (member === "six" || member === "one") {
		tracked(101, SHOW_NAMES[0], "watching", 6, 3, 1, { perSeason: 6 })
		if (member === "six") {
			tracked(102, SHOW_NAMES[1], "watching", 19, 14, 4, {
				perSeason: 10,
				lastAir: 2,
			})
			tracked(103, SHOW_NAMES[2], "watching", 28, 9, 12, {
				perSeason: 10,
				lastAir: 90,
			})
			tracked(104, SHOW_NAMES[3], "watching", 10, 4, 26, {
				perSeason: 10,
				lastAir: 200,
			})
			// Not watched for 90 days: to pick up.
			tracked(105, SHOW_NAMES[4], "watching", 24, 5, 120, {
				perSeason: 12,
				lastAir: 150,
			})
			tracked(106, SHOW_NAMES[5], "watching", 8, 2, 200, { lastAir: 300 })
			tracked(107, SHOW_NAMES[6], "seen", 42, 40, 60, {
				perSeason: 10,
				lastAir: 5,
			})
			tracked(108, SHOW_NAMES[7], "seen", 21, 21, 150, {
				perSeason: 7,
				lastAir: 180,
			})
			tracked(109, SHOW_NAMES[8], "on_hold", 26, 10, 200, {
				running: false,
				perSeason: 10,
				lastAir: 900,
			})
			tracked(110, SHOW_NAMES[9], "dropped", 5, 2, 300, {
				running: false,
				perSeason: 5,
				lastAir: 600,
			})
		}
	}
	if (member === "many") {
		// 25 Watching: 8 watched in the last 90 days, 17 not. One Seen show has new episodes.
		for (let i = 0; i < 25; i++)
			tracked(
				101 + i,
				WATCHING_NAMES[i],
				"watching",
				16 + (i % 5) * 4,
				2 + (i % 9),
				i < 8 ? 1 + i * 10 : 91 + (i - 8) * 23,
				{ perSeason: 8 + (i % 3), lastAir: 2 + i * 3 },
			)
		tracked(130, SHOW_NAMES[6], "seen", 42, 40, 60, {
			perSeason: 10,
			lastAir: 5,
		})
		tracked(131, SHOW_NAMES[8], "on_hold", 26, 10, 200, {
			running: false,
			perSeason: 10,
			lastAir: 900,
		})
	}

	// The Wishlist: shows to start and movies.
	const starts = { six: 9, one: 3, many: 12, none: 4, empty: 0, new: 3 }[member]
	for (let i = 0; i < starts; i++) {
		const id = 301 + i
		show(id, START_NAMES[i], 5 + i * 7, {
			running: i % 3 === 2,
			perSeason: i === 0 ? 5 : 10,
			lastAir: 400 + i * 50,
		})
		// The episode lists of shows nobody started are not read.
		rows.episode = rows.episode.filter((episode) => episode.show_id !== id)
		wish("show", id, 3 + i * 11)
	}
	const movies = { six: 17, one: 5, many: 30, none: 6, empty: 0, new: 17 }[
		member
	]
	for (let i = 0; i < movies; i++) {
		const id = 1001 + i
		const [name, runtime] = MOVIE_NAMES[i]
		fixture.movies.set(
			id,
			title(id, name, 2021 + (i % 4), {
				runtime,
				release_date: today - (200 + i * 40) * DAY,
			}),
		)
		wish("movie", id, 1 + i * 9)
	}

	// What the member has Seen.
	const seenTitle = (i: number, isShow: boolean) => {
		const id = (isShow ? 9000 : 5000) + i
		const name = `${i % 3 === 0 ? "The " : ""}${ADJECTIVES[i % ADJECTIVES.length]} ${NOUNS[i % NOUNS.length]}`
		const year = 1975 + ((i * 7) % 50)
		if (isShow)
			fixture.shows.set(
				id,
				title(id, name, year, {
					status: "Ended",
					aired_episode_count: 8,
					number_of_seasons: 1,
					number_of_episodes: 8,
					episode_runtime: [50],
					last_air_date: today - 2000 * DAY,
				}),
			)
		else
			fixture.movies.set(
				id,
				title(id, name, year, {
					runtime: 85 + ((i * 11) % 80),
					release_date: Date.UTC(year, 5, 1),
				}),
			)
		return id
	}
	const rnd = (i: number, salt: number) =>
		seededRandomSin(i * 12.9898 + salt * 78.233 + 0.5)
	/** One Seen title: its watches, then its score. A show's watch is its eight episodes on one day. */
	const seenOne = (
		i: number,
		isShow: boolean,
		first: { at: number | null; rest?: Row },
		again: { at: number | null; rest?: Row } | null,
		score: number | null,
	) => {
		const id = seenTitle(i, isShow)
		const type = isShow ? "show" : "movie"
		for (const each of again ? [first, again] : [first])
			if (isShow)
				for (let n = 1; n <= 8; n++)
					watch("show", id, each.at, {
						...each.rest,
						episode_tmdb_id: id * 1000 + n,
						season_number: 1,
						episode_number: n,
					})
			else watch("movie", id, each.at, each.rest)
		state(type, id, "seen", first.at ?? daysAgo(700))
		if (score !== null)
			rows.user_score.push({
				...mine(type, id, first.at ?? daysAgo(700)),
				score,
				review: null,
			})
	}
	const imported = (source: string): Row => ({
		origin: "import",
		import_id: `harness-${source}`,
	})
	if (seen === "30")
		for (let i = 0; i < 30; i++) {
			const at = daysAgo(Math.round(1 + i * i * 0.9 + i * 3))
			const first =
				i < 14
					? { at, rest: { watched_at_precision: "moment" } }
					: i < 23
						? { at }
						: i < 27
							? { at, rest: imported("letterboxd") }
							: { at: null, rest: imported("imdb") }
			const again =
				i === 2 || i === 9
					? { at: at - (380 + i * 40) * DAY }
					: i === 5
						? { at: null, rest: imported("imdb") }
						: null
			const score = [0, 4, 11, 19, 27].includes(i)
				? null
				: Math.min(10, 5 + Math.floor(rnd(i, 4) * 6))
			seenOne(i, i % 5 === 3, first, again, score)
		}
	if (seen === "1500")
		for (let i = 0; i < 1500; i++) {
			const p = rnd(i, 1)
			const first =
				p < 0.38
					? { at: null, rest: imported("imdb") }
					: p < 0.9
						? {
								at: daysAgo(30 + Math.floor(rnd(i, 2) ** 1.5 * 4400)),
								rest: imported(rnd(i, 6) < 0.6 ? "letterboxd" : "trakt"),
							}
						: {
								at: daysAgo(Math.floor(rnd(i, 2) ** 2 * 700)),
								rest: { watched_at_precision: "moment" },
							}
			const again =
				rnd(i, 5) < 0.07 && !(i % 9 === 4)
					? {
							at:
								(first.at ?? daysAgo(600)) -
								(200 + Math.floor(rnd(i, 7) * 2000)) * DAY,
							rest: imported("letterboxd"),
						}
					: null
			const score =
				rnd(i, 3) < 0.14 ? null : Math.min(10, 3 + Math.floor(rnd(i, 4) * 8))
			seenOne(i, i % 9 === 4, first, again, score)
		}
	// Two shows the member rated without marking anything: Seen through their score alone.
	if (seen !== "0")
		for (const [id, name, score] of [
			[9900, "Fargo", 9],
			[9901, "True Detective", 7],
		] as const) {
			fixture.shows.set(
				id,
				title(id, name, 2014, {
					status: "Returning Series",
					aired_episode_count: 30,
					number_of_seasons: 4,
					number_of_episodes: 30,
					episode_runtime: [55],
				}),
			)
			rows.user_score.push({
				...mine("show", id, daysAgo(400)),
				score,
				review: null,
			})
		}
	return fixture
}

// ---------------------------------------------------------------------------------------------------------
// The stand-in Crate

class HarnessCrate {
	db = new FakeTrackingCrate()
	constructor(private fixture: Fixture) {
		for (const [table, rows] of Object.entries(fixture.rows))
			this.db.seed(table, rows)
	}

	private catalog(type: string) {
		return type === "show" ? this.fixture.shows : this.fixture.movies
	}

	async execute(raw: string, params: unknown[] = []) {
		const sql = raw.trim().replace(/\s+/g, " ")
		const answer = (json: Row[], rest: Row = {}) => ({
			json,
			rowcount: json.length,
			...rest,
		})
		// The title cards' display fields: one statement over both tables, the ids as two arrays.
		if (sql.includes("UNION ALL")) {
			const [movieIds, showIds] = params as [number[], number[]]
			const pick = (type: "movie" | "show", ids: number[]) =>
				ids.flatMap((id) => {
					const row = this.catalog(type).get(id)
					if (!row) return []
					const runtime =
						type === "show"
							? ((row.episode_runtime as number[] | undefined)?.[0] ?? null)
							: row.runtime
					return [{ ...row, media_type: type, runtime }]
				})
			return answer([...pick("movie", movieIds), ...pick("show", showIds)])
		}
		const table = sql.match(/FROM (\w+)/)?.[1]
		if (table === "streaming_service") return answer(SERVICES)
		// The availability index of the member's country: one row per title with its services. It is loaded once
		// and kept, so it covers the Wishlist of every sample member.
		if (table === "streaming_availability") {
			const ids = (from: number, count: number) =>
				Array.from({ length: count }, (_, i) => from + i)
			const { landed } = this.fixture
			const lately = (type: string, id: number) =>
				landed.filter((offer) => offer.type === type && offer.id === id)
			const titles: (readonly ["movie" | "show", number])[] = [
				...ids(301, START_NAMES.length).map((id) => ["show", id] as const),
				...ids(1001, MOVIE_NAMES.length).map((id) => ["movie", id] as const),
				// A show the member watches has no offer here unless one landed.
				...landed
					.filter(({ type, id }) => type === "show" && id < 301)
					.map(({ type, id }) => [type, id] as const),
			]
			// When the offers that landed first appeared (#456): the titles with one, then every service of those.
			let rows: unknown[][]
			if (sql.startsWith("SELECT DISTINCT"))
				rows = landed.map(({ type, id }) => [type, id])
			else if (sql.includes("min(created_at)")) {
				const [type, ...wanted] = params.slice(4) as [string, ...number[]]
				rows = wanted.flatMap((id) => {
					const service = serviceOf(id)
					return [
						...(service === null ? [] : [[id, service, 0]]),
						...lately(type, id).map((offer) => [id, offer.service, offer.at]),
					]
				})
			} else
				rows = titles.flatMap(([type, id]) => {
					const service = serviceOf(id)
					const services = [
						...(service === null ? [] : [service]),
						...lately(type, id).map((offer) => offer.service),
					]
					return services.length ? [[type, id, services]] : []
				})
			return answer([], { rows, rowcount: rows.length })
		}
		// A read of the catalog by key: the columns it names, from the fixture.
		if (table === "movie" || table === "show") {
			const select = sql.match(
				/^SELECT (.+?) FROM \w+ WHERE tmdb_id (?:IN \(|= )/,
			)
			if (!select) throw new Error(`The harness does not know: ${sql}`)
			const columns = select[1].split(", ").map((text) => {
				const [column, name = column] = text.split(" AS ")
				return { column, name }
			})
			return answer(
				(params as number[]).flatMap((id) => {
					const row = this.catalog(table).get(Number(id))
					return row
						? [
								Object.fromEntries(
									columns.map(({ column, name }) => [
										name,
										row[column] ?? null,
									]),
								),
							]
						: []
				}),
			)
		}
		return this.db.execute(raw, params)
	}
}

let installed: { key: string; crate: HarnessCrate; now: number } | null = null

/**
 * Puts the sample member in place of the dev server's Crate. The same member and Seen history keep their rows, so
 * a score given in the harness stays; `reset` starts them over.
 */
export function installHarnessMember(
	member: MemberKey,
	seen: SeenSize,
	landed: LandedKey = "none",
	reset = false,
): number {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	if (process.env.CRATE_HOSTS)
		throw new Response(
			"This harness replaces the Crate client. Start the dev server without CRATE_HOSTS (without .env).",
			{ status: 503 },
		)
	const key = `${member}-${seen}-${landed}`
	if (!installed || installed.key !== key || reset) {
		const now = Date.now()
		installed = {
			key,
			crate: new HarnessCrate(build(member, seen, landed, now)),
			now,
		}
		setCrateClientForTest(installed.crate)
		// The offers that landed appeared a day ago, which the launch of "newly available" must not be after. And the
		// availability index is kept for hours: it is read again from this fixture.
		process.env.NEWLY_AVAILABLE_SINCE = new Date(now - 30 * DAY).toISOString()
		forgetAvailabilityForTest()
	}
	return installed.now
}

// ---------------------------------------------------------------------------------------------------------
// The member's taste: made up, the same for every sample member

const matchOf = (key: number) => 55 + ((parseTitleKey(key).tmdbId * 37) % 44)
export const HARNESS_TASTE: Taste = {
	signal: "some",
	ratings: 40,
	liked: 25,
	vector: null,
	match: (keys) => keys.map(matchOf),
	percentile: (keys) => keys.map(matchOf),
	reasons: () => [],
	leanings: () => [],
}

const viewer = () => getMemberViewerContext(HARNESS_MEMBER, "US")

// ---------------------------------------------------------------------------------------------------------
// What the harness asks for, each through the app's own server function

export const harness = {
	/** The availability of the member's country is loaded: what is on their services, and what landed there. */
	async ready() {
		servicesFor("US", [])
		await availabilityLoaded("US", 5000)
	},
	userData: () => getUserData({ user_id: HARNESS_MEMBER }),
	async library(choice: LibraryChoice, offset = 0) {
		return getLibraryPage(
			HARNESS_MEMBER,
			choice,
			offset,
			choice.status === "want" ? await getNewOn(await viewer()) : undefined,
		)
	},
	async shows(now: number) {
		const ctx = await viewer()
		return getMyShows(
			{
				userId: HARNESS_MEMBER,
				country: ctx.country,
				services: ctx.services,
				taste: HARNESS_TASTE,
			},
			{ now },
		)
	},
	/** What is new for the member's shows, and the visit of My shows that clears it. */
	newShows: (now: number) => getNewShows(HARNESS_MEMBER, { now }),
	visit: (now: number) => recordMyShowsVisit(HARNESS_MEMBER, now),
	/** What landed on the member's services (#456), and the visit of My movies that clears its movies. */
	landed: async () => getNewlyAvailable(await viewer()),
	/** What landed in the last 14 days (#489): the row and the marks of My movies and My shows. */
	recent: async (now: number) => getRecentlyLanded(await viewer(), now),
	visitMovies: () => recordMyMoviesVisit(HARNESS_MEMBER),
	async movies(options: Parameters<typeof getWatchNext>[1]) {
		return getWatchNext(
			await viewer(),
			{ ...options, kind: "movie" },
			HARNESS_TASTE,
		)
	},
	async movieCards(
		keys: number[],
		options: Parameters<typeof getWatchNext>[1],
	) {
		return getWatchNextTitles(
			await viewer(),
			keys,
			{ ...options, kind: "movie" },
			HARNESS_TASTE,
		)
	},
	async tonight() {
		return getTonightsPick(await viewer(), true, HARNESS_TASTE)
	},
	rate: (tmdbId: number, mediaType: "movie" | "show", score: number | null) =>
		updateScores({
			user_id: HARNESS_MEMBER,
			tmdb_id: tmdbId,
			media_type: mediaType,
			score: score as never,
		}),
	today: (now: number) => utcDay(now),
	/**
	 * A show's tracking as its page and the new TV's title screen read it, and one action on it, as
	 * /api/tracking/show answers a member. The episodes have no IMDb ratings here.
	 */
	tracking: (showId: number) =>
		getShowTrackingPage(HARNESS_MEMBER, showId, async () => null),
	track: (action: ShowAction) =>
		applyShowTrackingAction(HARNESS_MEMBER, action),
}
