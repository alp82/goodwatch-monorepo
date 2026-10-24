// PROTOTYPE - throwaway. Stub data and a simulated import for /prototype/import-flow. Nothing is sent anywhere:
// every phase, count, and delay below is made up so each variant can be driven through the happy path and the
// edge cases the real import has to handle.
import { useEffect, useRef, useState } from "react"
import type { ImportSourceId } from "~/ui/imports/ImportSources"

const IMG = "https://image.tmdb.org/t/p/w185/"

export interface Title {
	id: string
	name: string
	year: number
	poster: string
	kind: "movie" | "show"
}
const t = (id: string, name: string, year: number, path: string, kind: Title["kind"] = "movie"): Title => ({
	id,
	name,
	year,
	poster: `${IMG}${path}.jpg`,
	kind,
})

export const TITLES = {
	godfather: t("movie:238", "The Godfather", 1972, "3bhkrj58Vtu7enYsRolD1fZdja1"),
	angryMen: t("movie:389", "12 Angry Men", 1957, "zhG3vKWyDRaZYoaww1UVAi29T9h"),
	samurai: t("movie:346", "Seven Samurai", 1954, "lOMGc8bnSwQhS4XyE1S99uH8NXf"),
	schindler: t("movie:424", "Schindler's List", 1993, "sF1U4EUQS8YHUYjNl3pMGNIQyr0"),
	casablanca: t("movie:289", "Casablanca", 1943, "lGCEKlJo2CnWydQj7aamY7s1S7Q"),
	rearWindow: t("movie:567", "Rear Window", 1954, "ILVF0eJxHMddjxeQhswFtpMtqx"),
	m: t("movie:832", "M", 1931, "bTdZk3q2DWpBRnLiaaItKFWOVhI"),
	theKid: t("movie:10098", "The Kid", 1921, "drgMcyTsySQBnUPGaBThCHGdlWT"),
	dunes: t("movie:16672", "Woman in the Dunes", 1964, "xiBr3bIT2xpbuIKo5bLK7ebP4O1"),
	violet: t("movie:533514", "Violet Evergarden: The Movie", 2020, "bajajkoErDst0JxdFyBkABiF9rW"),
	parasite: t("movie:496243", "Parasite", 2019, "7IiTTgloJzvGI1TAYymCfbfl3vT"),
	spirited: t("movie:129", "Spirited Away", 2001, "jUo8cNmU400WtZiJss45HNXlQ2e"),
	gbu: t("movie:429", "The Good, the Bad and the Ugly", 1966, "bX2xnavhMYjWDoZp1VM6VnU1xwe"),
	psycho: t("movie:539", "Psycho", 1960, "yz4QVqPx3h1hD1DfqqQkCq3rmxW"),
	strangelove: t("movie:935", "Dr. Strangelove", 1964, "gHm96BRW4GoI339rF1vYoYTB6Qe"),
	singin: t("movie:872", "Singin' in the Rain", 1952, "zjrpWniKbzu0zFR5sUI1Ptdfl9y"),
	modernTimes: t("movie:3082", "Modern Times", 1936, "AthaPakkuCLROdKxtRbKWclkDBK"),
	cityLights: t("movie:901", "City Lights", 1931, "bXNvzjULc9jrOVhGfjcc64uKZmZ"),
	bicycle: t("movie:5156", "Bicycle Thieves", 1948, "iPdVqIpmR3bRvOQJPrn4pr2KR3q"),
	eve: t("movie:705", "All About Eve", 1950, "blBzZaatPWVuWpXEnPscMA4Xp6m"),
	hailMary: t("movie:687163", "Project Hail Mary", 2026, "iOb2fjXLbpJgyQXe46n1WtGCnaa"),
	odyssey: t("movie:1368337", "The Odyssey", 2026, "5rhTDKUhPYvpdQIijFIs5VoWsON"),
	spiderman: t("movie:969681", "Spider-Man: Brand New Day", 2026, "bjiS5ipwxb9JFy3XRRN4OAilSeX"),
	breakingBad: t("show:1396", "Breaking Bad", 2008, "anFx9aTOOYqgS3v7x3R84Kz67ly", "show"),
	bear: t("show:136315", "The Bear", 2022, "eKfVzzEazSIjJMrw9ADa2x8ksLz", "show"),
	slowHorses: t("show:95480", "Slow Horses", 2022, "AdYr4DjOgXvDUMwu6vEhZy1Rnxk", "show"),
	shadows: t("show:83631", "What We Do in the Shadows", 2019, "wa3ZQE9kLnqwN3vQ0NNjg1NPsCa", "show"),
	poi: t("show:1411", "Person of Interest", 2011, "f8aIvYk5h7Z8EP3dinCmVgQFYow", "show"),
	luther: t("show:1426", "Luther", 2010, "hDxOMX8zzH1FiqKWVBzNaYGBkle", "show"),
	reacher: t("show:108978", "Reacher", 2022, "f1VCQIG2iCyOookdgOzwtUpwWC0", "show"),
	supernatural: t("show:1622", "Supernatural", 2005, "8iixmfGx5EIFPdpNvB2JvI3VIqX", "show"),
	mobland: t("show:247718", "MobLand", 2025, "5Xc7WpWsgflfgEMoBlf9TmWhfbH", "show"),
	torchwood: t("show:424", "Torchwood", 2006, "bv7C5r7QyXGsaMxvU40FVY7SvrD", "show"),
	simpsons: t("show:456", "The Simpsons", 1989, "tf0CUEynk6GfmrlHIQKQ5mfFP5P", "show"),
	mentalist: t("show:5920", "The Mentalist", 2008, "acYXu4KaDj1NIkMgObnhe4C4a0T", "show"),
	visionquest: t("show:213375", "VisionQuest", 2026, "xK27l5uwaVyZSlENWnmLlWwDQNS", "show"),
} satisfies Record<string, Title>
const T = TITLES

const MOVIES = [T.godfather, T.parasite, T.spirited, T.rearWindow, T.casablanca, T.psycho, T.samurai, T.angryMen, T.gbu, T.strangelove, T.singin, T.m, T.eve, T.bicycle, T.cityLights, T.modernTimes, T.dunes, T.theKid, T.violet, T.schindler]
const SHOWS = [T.breakingBad, T.bear, T.slowHorses, T.shadows, T.poi, T.luther, T.reacher, T.supernatural, T.mobland, T.torchwood, T.simpsons, T.mentalist]

/** What the file or account brings, by kind. Counts are titles (or episodes for `episodes`). */
export interface Kinds {
	ratings: number
	watches: number
	episodes: number
	want: number
	favorites: number
	reviews: number
	lists: number
	statuses: number
}
const kinds = (k: Partial<Kinds>): Kinds => ({ ratings: 0, watches: 0, episodes: 0, want: 0, favorites: 0, reviews: 0, lists: 0, statuses: 0, ...k })

/** A score in the file that differs from the one already in GoodWatch (both 1-10). */
export interface Conflict {
	title: Title
	theirs: number
	yours: number
	/** When the member changed it in GoodWatch. */
	yoursAt: string
}
/** A row GoodWatch couldn't tie to one title. */
export interface Unmatched {
	raw: string
	/** Possible titles, best first. Empty when GoodWatch has no guess. */
	suggestions: Title[]
	what: "rating" | "watch" | "want"
}
/** Titles an import would take off a list, because they get a watch or a status. */
export interface SideEffects {
	offWantToSee: Title[]
	offNotInterested: Title[]
}

export type FileProblem = "unknown" | "password" | "too_big" | "streaming" | "empty"

export interface Scenario {
	key: string
	label: string
	/** One line on what this case checks, for the scenario panel. */
	note: string
	group: "Happy path" | "Decisions" | "File problems" | "Running" | "After"
	source: ImportSourceId
	/** How the member starts: dropping a file, connecting an account, or opening an earlier import. */
	entry: "file" | "connect" | "history"
	fileName: string
	fileProblem?: FileProblem
	/** Rows in the file. */
	rows: number
	kinds: Kinds
	/** Titles already exactly the same in GoodWatch. */
	unchanged: number
	conflicts: Conflict[]
	unmatched: Unmatched[]
	/** Rows the file has but GoodWatch can't use (e.g. podcasts, games). */
	unsupported: number
	/** Watches without a date in the file. */
	undatedWatches: number
	sideEffects: SideEffects
	/** Want to See entries for titles already Seen in GoodWatch. */
	alreadySeenWants: Title[]
	/** TV Time: GoodWatch is still matching rows in the background. */
	matching?: { done: number; total: number; uncertain: Title[] }
	/** An earlier import from the same source. */
	previous?: { at: string; added: number; fileName: string }
	/** How the run ends. */
	run: "ok" | "fails"
	/** Why a failing run stopped, in the member's words (a deploy restarted the server, a source timed out, ...). */
	failReason?: string
	/** Seconds the run takes in the simulation. */
	runSeconds: number
	/** Posters of what comes in, for variants that show them. */
	sample: Title[]
	/** Undo: titles changed since the import that Undo will leave as they are. */
	undoLeaves?: Title[]
}

const none: SideEffects = { offWantToSee: [], offNotInterested: [] }
const base = {
	conflicts: [] as Conflict[],
	unmatched: [] as Unmatched[],
	unsupported: 0,
	undatedWatches: 0,
	sideEffects: none,
	alreadySeenWants: [] as Title[],
	run: "ok" as const,
	runSeconds: 4,
	unchanged: 0,
}

export const SCENARIOS: Scenario[] = [
	{
		...base,
		key: "happy",
		label: "Letterboxd, clean",
		note: "842 titles, every one matched, nothing in GoodWatch yet. Should be one tap.",
		group: "Happy path",
		source: "letterboxd",
		entry: "file",
		fileName: "letterboxd-alper-2026-10-24-09-12-utc.zip",
		rows: 1964,
		kinds: kinds({ ratings: 612, watches: 842, want: 137, favorites: 4, reviews: 23 }),
		sample: [...MOVIES, ...SHOWS.slice(0, 4)],
	},
	{
		...base,
		key: "connect",
		label: "TMDB account",
		note: "No file: Connect, approve on TMDB, come back, check, import.",
		group: "Happy path",
		source: "tmdb",
		entry: "connect",
		fileName: "Your TMDB account",
		rows: 214,
		kinds: kinds({ ratings: 188, want: 22, favorites: 4 }),
		runSeconds: 3,
		sample: MOVIES.slice(4, 16),
	},
	{
		...base,
		key: "newer",
		label: "Newer export of a source",
		note: "Letterboxd imported before. The newer file brings 23 new titles; 819 are unchanged.",
		group: "Happy path",
		source: "letterboxd",
		entry: "file",
		fileName: "letterboxd-alper-2026-10-24-09-12-utc.zip",
		rows: 1990,
		kinds: kinds({ ratings: 14, watches: 23, want: 6 }),
		unchanged: 819,
		previous: { at: "2026-09-02T18:20:00Z", added: 819, fileName: "letterboxd-alper-2026-09-02.zip" },
		runSeconds: 2,
		sample: [T.hailMary, T.odyssey, T.spiderman, T.parasite, T.violet, T.dunes],
	},
	{
		...base,
		key: "conflicts",
		label: "Scores differ",
		note: "Trakt: 9 ratings differ from scores you changed in GoodWatch. Which wins?",
		group: "Decisions",
		source: "trakt",
		entry: "file",
		fileName: "trakt-export-2026-10-24.zip",
		rows: 1104,
		kinds: kinds({ ratings: 64, watches: 838, episodes: 4120, want: 12, favorites: 4 }),
		unchanged: 41,
		conflicts: [
			{ title: T.parasite, theirs: 8, yours: 10, yoursAt: "2026-08-14" },
			{ title: T.breakingBad, theirs: 10, yours: 9, yoursAt: "2026-07-02" },
			{ title: T.psycho, theirs: 7, yours: 8, yoursAt: "2026-06-21" },
			{ title: T.bear, theirs: 9, yours: 7, yoursAt: "2026-09-30" },
			{ title: T.gbu, theirs: 8, yours: 9, yoursAt: "2026-05-11" },
			{ title: T.slowHorses, theirs: 8, yours: 9, yoursAt: "2026-10-01" },
			{ title: T.casablanca, theirs: 9, yours: 8, yoursAt: "2026-04-18" },
			{ title: T.reacher, theirs: 6, yours: 7, yoursAt: "2026-03-09" },
			{ title: T.m, theirs: 9, yours: 10, yoursAt: "2026-02-27" },
		],
		runSeconds: 5,
		sample: [...SHOWS, ...MOVIES.slice(0, 8)],
	},
	{
		...base,
		key: "unmatched",
		label: "Titles not found",
		note: "IMDb ratings: 12 rows GoodWatch can't tie to one title. 3 have a likely match.",
		group: "Decisions",
		source: "imdb",
		entry: "file",
		fileName: "ratings.csv",
		rows: 1311,
		kinds: kinds({ ratings: 1299 }),
		unmatched: [
			{ raw: "Spirited Away (2002)", suggestions: [T.spirited], what: "rating" },
			{ raw: "The Kid (1921)", suggestions: [T.theKid], what: "rating" },
			{ raw: "Shadows (2019)", suggestions: [T.shadows, T.supernatural], what: "rating" },
			{ raw: "Untitled Kubrick Doc (2024)", suggestions: [], what: "rating" },
			{ raw: "Eurovision Song Contest 2023 (2023)", suggestions: [], what: "rating" },
			{ raw: "Short Film #4 (2011)", suggestions: [], what: "rating" },
			{ raw: "Bandersnatch Extras (2018)", suggestions: [], what: "rating" },
			{ raw: "Lecture: Film Noir (2015)", suggestions: [], what: "rating" },
			{ raw: "The Making of M (2004)", suggestions: [], what: "rating" },
			{ raw: "Tour Diary (2016)", suggestions: [], what: "rating" },
			{ raw: "Behind the Scenes: Eve (2008)", suggestions: [], what: "rating" },
			{ raw: "Concert Special (1999)", suggestions: [], what: "rating" },
		],
		unsupported: 3,
		sample: MOVIES,
	},
	{
		...base,
		key: "dates",
		label: "Watches without dates",
		note: "Kodi: 312 watches, 140 of them have no date in the file.",
		group: "Decisions",
		source: "kodi",
		entry: "file",
		fileName: "videodb.xml",
		rows: 520,
		kinds: kinds({ ratings: 96, watches: 312, episodes: 1880 }),
		undatedWatches: 140,
		sample: [...SHOWS.slice(0, 6), ...MOVIES.slice(0, 6)],
	},
	{
		...base,
		key: "side-effects",
		label: "Takes titles off lists",
		note: "Plex: new watches take 6 titles off Want to See and 2 off Not interested.",
		group: "Decisions",
		source: "plex",
		entry: "connect",
		fileName: "Your Plex server",
		rows: 2140,
		kinds: kinds({ watches: 410, episodes: 1730, want: 19 }),
		sideEffects: {
			offWantToSee: [T.hailMary, T.slowHorses, T.dunes, T.violet, T.mobland, T.odyssey],
			offNotInterested: [T.simpsons, T.mentalist],
		},
		sample: [...SHOWS, ...MOVIES.slice(6, 12)],
	},
	{
		...base,
		key: "rewatch",
		label: "Wishlist has Seen titles",
		note: "Watcharr: 5 titles on the wishlist are already Seen in GoodWatch. Leave off, or Want to rewatch?",
		group: "Decisions",
		source: "wishlist",
		entry: "file",
		fileName: "watcharr-export.json",
		rows: 88,
		kinds: kinds({ want: 88 }),
		alreadySeenWants: [T.godfather, T.parasite, T.bear, T.casablanca, T.spirited],
		runSeconds: 2,
		sample: [T.hailMary, T.odyssey, T.visionquest, T.mobland, T.spiderman, T.dunes, T.violet, T.torchwood],
	},
	{
		...base,
		key: "everything",
		label: "Everything at once",
		note: "Trakt with conflicts, unmatched rows, undated watches, list side effects, and Seen wishlist titles.",
		group: "Decisions",
		source: "trakt",
		entry: "file",
		fileName: "trakt-export-2026-10-24.zip",
		rows: 3412,
		kinds: kinds({ ratings: 402, watches: 1290, episodes: 9820, want: 74, favorites: 12, lists: 3, statuses: 0 }),
		unchanged: 210,
		conflicts: [
			{ title: T.parasite, theirs: 8, yours: 10, yoursAt: "2026-08-14" },
			{ title: T.breakingBad, theirs: 10, yours: 9, yoursAt: "2026-07-02" },
			{ title: T.bear, theirs: 9, yours: 7, yoursAt: "2026-09-30" },
		],
		unmatched: [
			{ raw: "Shadows (2019)", suggestions: [T.shadows], what: "watch" },
			{ raw: "Sherlock Special (2016)", suggestions: [], what: "watch" },
			{ raw: "Doctor Who Christmas (2008)", suggestions: [T.torchwood], what: "watch" },
			{ raw: "Untitled (2021)", suggestions: [], what: "want" },
		],
		unsupported: 7,
		undatedWatches: 38,
		sideEffects: { offWantToSee: [T.hailMary, T.slowHorses], offNotInterested: [T.simpsons] },
		alreadySeenWants: [T.godfather, T.casablanca],
		runSeconds: 6,
		sample: [...SHOWS, ...MOVIES],
	},
	{
		...base,
		key: "same-file",
		label: "Same file again",
		note: "Letterboxd file already imported. Nothing is new; there's nothing to do.",
		group: "Decisions",
		source: "letterboxd",
		entry: "file",
		fileName: "letterboxd-alper-2026-09-02.zip",
		rows: 1964,
		kinds: kinds({}),
		unchanged: 842,
		previous: { at: "2026-09-02T18:20:00Z", added: 842, fileName: "letterboxd-alper-2026-09-02.zip" },
		sample: [],
	},
	{
		...base,
		key: "streaming",
		label: "Netflix file",
		note: "NetflixViewingHistory.csv: GoodWatch can't read streaming histories yet. Point to what works.",
		group: "File problems",
		source: "csv",
		entry: "file",
		fileName: "NetflixViewingHistory.csv",
		fileProblem: "streaming",
		rows: 0,
		kinds: kinds({}),
		sample: [],
	},
	{
		...base,
		key: "unknown",
		label: "Unknown file",
		note: "holiday-photos.zip: not an export GoodWatch knows.",
		group: "File problems",
		source: "csv",
		entry: "file",
		fileName: "holiday-photos.zip",
		fileProblem: "unknown",
		rows: 0,
		kinds: kinds({}),
		sample: [],
	},
	{
		...base,
		key: "password",
		label: "Locked ZIP",
		note: "TV Time gdpr-data.zip asks for a password. Explain how to unlock it.",
		group: "File problems",
		source: "tvtime",
		entry: "file",
		fileName: "gdpr-data.zip",
		fileProblem: "password",
		rows: 0,
		kinds: kinds({}),
		sample: [],
	},
	{
		...base,
		key: "too-big",
		label: "File too big",
		note: "34 MB Trakt ZIP; the limit is 20 MB.",
		group: "File problems",
		source: "trakt",
		entry: "file",
		fileName: "trakt-export-full.zip",
		fileProblem: "too_big",
		rows: 0,
		kinds: kinds({}),
		sample: [],
	},
	{
		...base,
		key: "empty",
		label: "Empty export",
		note: "MovieLens ratings.csv with only a header row.",
		group: "File problems",
		source: "movielens",
		entry: "file",
		fileName: "ratings.csv",
		fileProblem: "empty",
		rows: 0,
		kinds: kinds({}),
		sample: [],
	},
	{
		...base,
		key: "matching",
		label: "Still matching",
		note: "TV Time: GoodWatch is still matching 1,240 rows; 4 movies are uncertain.",
		group: "Running",
		source: "tvtime",
		entry: "file",
		fileName: "gdpr-data.zip",
		rows: 1240,
		kinds: kinds({ watches: 96, episodes: 6410, want: 41, statuses: 58, ratings: 33 }),
		matching: { done: 312, total: 1240, uncertain: [T.theKid, T.m, T.eve, T.dunes] },
		runSeconds: 5,
		sample: [...SHOWS, ...MOVIES.slice(0, 6)],
	},
	{
		...base,
		key: "large",
		label: "Huge import",
		note: "14,200 rows. Takes a while; you can leave the page and come back.",
		group: "Running",
		source: "trakt",
		entry: "file",
		fileName: "trakt-export-2026-10-24.zip",
		rows: 14200,
		kinds: kinds({ ratings: 2210, watches: 5120, episodes: 38400, want: 640, favorites: 40, lists: 12 }),
		runSeconds: 20,
		sample: [...SHOWS, ...MOVIES],
	},
	{
		...base,
		key: "fails",
		label: "Stops partway",
		note: "The run stops at 62%. What was saved stays; Continue picks up where it stopped.",
		group: "Running",
		source: "letterboxd",
		entry: "file",
		fileName: "letterboxd-alper-2026-10-24-09-12-utc.zip",
		rows: 1964,
		kinds: kinds({ ratings: 612, watches: 842, want: 137, favorites: 4, reviews: 23 }),
		run: "fails",
		failReason: "GoodWatch restarted for an update while your import was running.",
		runSeconds: 5,
		sample: MOVIES,
	},
	{
		...base,
		key: "undo",
		label: "Undo an import",
		note: "Open last week's import from history and undo it. 2 titles you changed since stay as they are.",
		group: "After",
		source: "letterboxd",
		entry: "history",
		fileName: "letterboxd-alper-2026-10-17.zip",
		rows: 1964,
		kinds: kinds({ ratings: 612, watches: 842, want: 137, favorites: 4, reviews: 23 }),
		previous: { at: "2026-10-17T20:05:00Z", added: 842, fileName: "letterboxd-alper-2026-10-17.zip" },
		undoLeaves: [T.parasite, T.rearWindow],
		sample: MOVIES,
	},
]

export const scenarioByKey = (key: string | null) => SCENARIOS.find((s) => s.key === key) ?? SCENARIOS[0]

/** Earlier imports shown in every variant's history, newest first. */
export const HISTORY = [
	{ id: "h1", source: "letterboxd" as ImportSourceId, at: "2026-10-17T20:05:00Z", line: "842 added, 12 updated" },
	{ id: "h2", source: "imdb" as ImportSourceId, at: "2026-09-02T18:20:00Z", line: "1,204 ratings added" },
	{ id: "h3", source: "tmdb" as ImportSourceId, at: "2026-08-11T07:44:00Z", line: "Undone" },
]

/* ------------------------------------------------------------------------------------------------------------------ */
/* Choices                                                                                                            */

export interface Choices {
	/** Kinds the member left in. All kinds with a count are in by default. */
	include: Record<keyof Kinds, boolean>
	/** Differing scores: keep GoodWatch's (default) or take the file's. Per title overrides the default. */
	conflictDefault: "keep" | "file"
	conflictPerTitle: Record<string, "keep" | "file">
	/** Unmatched rows: the chosen title id, or "skip". A row with a likely suggestion starts unset. */
	matches: Record<string, string | "skip">
	/** Watches without dates: import them undated (default) or leave them out. */
	undated: "import" | "skip"
	/** Wishlist titles already Seen: leave off (default) or add as Want to rewatch. */
	rewatch: "leave" | "rewatch"
}

export const defaultChoices = (s: Scenario): Choices => ({
	include: Object.fromEntries(Object.entries(s.kinds).map(([k, n]) => [k, n > 0])) as Choices["include"],
	conflictDefault: "keep",
	conflictPerTitle: {},
	matches: {},
	undated: "import",
	rewatch: "leave",
})

/** Everything that wants the member's eyes before import, in the order a variant should ask. */
export type Question = "conflicts" | "unmatched" | "undated" | "rewatch" | "side-effects" | "matching"
export const questionsFor = (s: Scenario): Question[] =>
	[
		s.matching ? ("matching" as const) : null,
		s.conflicts.length ? ("conflicts" as const) : null,
		s.unmatched.length ? ("unmatched" as const) : null,
		s.undatedWatches ? ("undated" as const) : null,
		s.alreadySeenWants.length ? ("rewatch" as const) : null,
		s.sideEffects.offWantToSee.length + s.sideEffects.offNotInterested.length ? ("side-effects" as const) : null,
	].filter((q): q is Question => q !== null)

/** Titles that will change: new plus conflicts taken from the file. */
export const newTitles = (s: Scenario) => Math.max(s.kinds.watches, s.kinds.ratings) + s.kinds.want + s.kinds.favorites

/* ------------------------------------------------------------------------------------------------------------------ */
/* Simulation                                                                                                         */

export type Phase =
	| { at: "start" } // nothing chosen yet: drop zone, sources, history
	| { at: "reading" } // a file is being read in the browser
	| { at: "problem"; problem: FileProblem } // the file can't be used
	| { at: "connecting" } // away at TMDB or Plex (simulated)
	| { at: "checking"; progress: number } // server builds the preview
	| { at: "preview" } // what's in it; decisions if any
	| { at: "running"; progress: number }
	| { at: "failed"; progress: number }
	| { at: "done" }
	| { at: "undoing"; progress: number }
	| { at: "undone" }

export interface Sim {
	scenario: Scenario
	phase: Phase
	choices: Choices
	setChoices: (next: Choices) => void
	/** TV Time: matching progress while in preview. */
	matched: number
	/** Drop or choose a file (any file; the scenario decides what it is). */
	takeFile: () => void
	/** Connect an account source. */
	connect: () => void
	/** Open the scenario's earlier import from history (lands on done). */
	openPast: () => void
	confirm: () => void
	resume: () => void
	undo: () => void
	reset: () => void
}

/** Drives one scenario through its phases on timers. A new scenario key starts over. */
export function useImportSim(scenario: Scenario): Sim {
	const [phase, setPhase] = useState<Phase>({ at: "start" })
	const [choices, setChoices] = useState<Choices>(() => defaultChoices(scenario))
	const [matched, setMatched] = useState(scenario.matching?.done ?? 0)
	const timers = useRef<number[]>([])
	const clear = () => {
		for (const id of timers.current) window.clearTimeout(id), window.clearInterval(id)
		timers.current = []
	}
	const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
	const every = (ms: number, fn: () => void) => timers.current.push(window.setInterval(fn, ms))

	useEffect(() => {
		clear()
		setPhase(scenario.entry === "history" ? { at: "start" } : { at: "start" })
		setChoices(defaultChoices(scenario))
		setMatched(scenario.matching?.done ?? 0)
		return clear
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scenario.key])

	// TV Time keeps matching while the preview is open.
	useEffect(() => {
		if (phase.at !== "preview" || !scenario.matching) return
		const id = window.setInterval(() => setMatched((n) => Math.min(scenario.matching?.total ?? n, n + 37)), 400)
		return () => window.clearInterval(id)
	}, [phase.at, scenario.matching])

	const check = () => {
		let p = 0
		setPhase({ at: "checking", progress: 0 })
		every(120, () => {
			p = Math.min(1, p + 0.12)
			if (p >= 1) {
				clear()
				setPhase({ at: "preview" })
			} else setPhase({ at: "checking", progress: p })
		})
	}
	const run = (from: number, undoing = false) => {
		let p = from
		const step = 1 / ((scenario.runSeconds * 1000) / 100)
		setPhase(undoing ? { at: "undoing", progress: p } : { at: "running", progress: p })
		every(100, () => {
			p = Math.min(1, p + step)
			if (!undoing && scenario.run === "fails" && from === 0 && p >= 0.62) {
				clear()
				setPhase({ at: "failed", progress: 0.62 })
			} else if (p >= 1) {
				clear()
				setPhase(undoing ? { at: "undone" } : { at: "done" })
			} else setPhase(undoing ? { at: "undoing", progress: p } : { at: "running", progress: p })
		})
	}

	return {
		scenario,
		phase,
		choices,
		setChoices,
		matched,
		takeFile: () => {
			clear()
			setPhase({ at: "reading" })
			later(700, () => (scenario.fileProblem ? setPhase({ at: "problem", problem: scenario.fileProblem }) : check()))
		},
		connect: () => {
			clear()
			setPhase({ at: "connecting" })
			later(1400, check)
		},
		openPast: () => {
			clear()
			setPhase({ at: "done" })
		},
		confirm: () => {
			clear()
			run(0)
		},
		resume: () => {
			clear()
			run(phase.at === "failed" ? phase.progress : 0.62)
		},
		undo: () => {
			clear()
			run(0, true)
		},
		reset: () => {
			clear()
			setChoices(defaultChoices(scenario))
			setMatched(scenario.matching?.done ?? 0)
			setPhase({ at: "start" })
		},
	}
}

export const fmt = (n: number) => n.toLocaleString("en-US")
export const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`
