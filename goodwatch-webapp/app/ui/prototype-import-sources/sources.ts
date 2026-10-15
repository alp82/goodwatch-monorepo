// PROTOTYPE - throwaway (#617). Every import source on map #365, with the steps to get its file from the research
// notes (#608, #609, #611-#615, the inventory), how long it takes, and what GoodWatch gets from it. Waves are the
// owner's of 2026-10-15; `?built=` decides how far the prototype pretends they are built.
import type { ImportKind, ImportOutcome } from "~/domain/imports"

export type SourceId =
	| "imdb"
	| "letterboxd"
	| "trakt"
	| "tmdb"
	| "csv"
	| "simkl"
	| "netflix"
	| "tvtime"
	| "kodi"
	| "tautulli"
	| "plex"
	| "jellyfin"
	| "emby"
	| "mal"
	| "anilist"
	| "kitsu"
	| "criticker"
	| "movielens"
	| "sofa"

export type Group =
	| "diaries"
	| "ratings"
	| "streaming"
	| "servers"
	| "anime"
	| "other"
export const GROUPS: { id: Group; label: string; detail: string }[] = [
	{
		id: "diaries",
		label: "Trackers and diaries",
		detail: "Where you logged what you watched",
	},
	{
		id: "ratings",
		label: "Rating sites",
		detail: "Where you rated films and shows",
	},
	{
		id: "streaming",
		label: "Streaming services",
		detail: "What you watched on the service",
	},
	{ id: "servers", label: "Media servers", detail: "Your own library at home" },
	{ id: "anime", label: "Anime", detail: "Anime lists and trackers" },
	{
		id: "other",
		label: "Anything else",
		detail: "A file in a standard format",
	},
]

export type Gets =
	| "ratings"
	| "dated"
	| "watches"
	| "rewatches"
	| "episodes"
	| "want"
	| "favorites"
	| "reviews"
export const GETS_LABELS: Record<Gets, string> = {
	ratings: "Ratings",
	dated: "Watches with dates",
	watches: "Watches",
	rewatches: "Rewatches",
	episodes: "Episodes",
	want: "Want to See",
	favorites: "Favorites",
	reviews: "Reviews",
}

export interface ImportRoute {
	label: string
	wait: "now" | "minutes" | "days"
	waitText: string
	where: string
	steps: { text: string; link?: { label: string; href: string } }[]
	gets: Gets[]
	misses?: string
	fileHint: string
	fileKind: string
}

export interface Source {
	id: SourceId
	name: string
	mark: string
	color: string
	group: Group
	/** 0 is live today; 1-3 the owner's waves; 4 is undecided (Emby). */
	wave: 0 | 1 | 2 | 3 | 4
	method: "upload" | "connect"
	/** Smaller is more common; "Where are you coming from?" shows the first six. */
	popular: number
	aliases: string
	routes: ImportRoute[]
	caveat?: string
	notBuiltWhy?: string
	fallback?: string
	alternative?: string
	/** A finished import, to show how the list looks for a member who already imported. */
	history?: string
	sample: {
		counts: Record<ImportOutcome, number>
		kinds: Record<ImportKind, number>
		warnings: string[]
	}
}

export type Built = "today" | "wave1" | "wave2" | "all"
export const BUILT_LABELS: Record<Built, string> = {
	today: "Today",
	wave1: "Wave 1",
	wave2: "Waves 1-2",
	all: "All waves",
}
const BUILT_WAVE: Record<Built, number> = {
	today: 0,
	wave1: 1,
	wave2: 2,
	all: 3,
}
export const isBuilt = (source: Source, built: Built) =>
	source.wave <= BUILT_WAVE[built]

const counts = (
	n: number,
	conflict = 0,
	unmatched = 0,
	unsupported = 0,
	unchanged = 0,
) => ({
	new: n,
	unchanged,
	conflict,
	unmatched,
	unsupported,
	invalid: 0,
})
const kinds = (rating = 0, watch = 0, want = 0, favorite = 0, review = 0) => ({
	rating,
	watch,
	want,
	favorite,
	review,
})

export const SOURCES: Source[] = [
	{
		id: "imdb",
		name: "IMDb",
		mark: "IMDb",
		color: "bg-yellow-400 !text-black",
		group: "ratings",
		wave: 0,
		method: "upload",
		popular: 1,
		aliases: "internet movie database",
		routes: [
			{
				label: "Ratings",
				wait: "minutes",
				waitText: "A few minutes",
				where: "On imdb.com in a browser",
				steps: [
					{
						text: "Open your ratings on IMDb and choose Export.",
						link: {
							label: "Open your IMDb ratings",
							href: "https://www.imdb.com/list/ratings",
						},
					},
					{
						text: "Wait while IMDb prepares your file. You can leave this page and come back.",
					},
					{
						text: "Open your exports on IMDb and download the CSV file.",
						link: {
							label: "Open IMDb exports",
							href: "https://www.imdb.com/exports",
						},
					},
				],
				gets: ["ratings"],
				misses:
					"watch dates and reviews. IMDb's date rated isn't a watch date.",
				fileHint: "the CSV file from IMDb",
				fileKind: "CSV file",
			},
			{
				label: "Watchlist, lists, and check-ins",
				wait: "minutes",
				waitText: "A few minutes each",
				where: "On imdb.com in a browser",
				steps: [
					{
						text: "Open your Watchlist, a list, or your Check-ins on IMDb and choose Export.",
						link: {
							label: "Open your IMDb watchlist",
							href: "https://www.imdb.com/list/watchlist",
						},
					},
					{ text: "Repeat for each list you want to bring." },
					{
						text: "Open your exports on IMDb and download each CSV file.",
						link: {
							label: "Open IMDb exports",
							href: "https://www.imdb.com/exports",
						},
					},
				],
				gets: ["want", "ratings", "watches"],
				misses:
					"the lists themselves. GoodWatch has no place for custom lists yet.",
				fileHint: "the CSV files from IMDb",
				fileKind: "CSV files",
			},
		],
		history: "October 2",
		sample: {
			counts: counts(812, 14, 3, 21, 40),
			kinds: kinds(890),
			warnings: [],
		},
	},
	{
		id: "letterboxd",
		name: "Letterboxd",
		mark: "Lb",
		color: "bg-emerald-600",
		group: "diaries",
		wave: 0,
		method: "upload",
		popular: 2,
		aliases: "lb boxd",
		routes: [
			{
				label: "Export ZIP",
				wait: "now",
				waitText: "Right away",
				where: "On letterboxd.com in a browser",
				steps: [
					{
						text: "Sign in to Letterboxd, open Settings, then Data, and choose Export Data.",
						link: {
							label: "Open Letterboxd export settings",
							href: "https://letterboxd.com/user/exportdata/",
						},
					},
					{
						text: "Wait for the download. Keep the ZIP as it is; don't extract it.",
					},
				],
				gets: ["ratings", "dated", "rewatches", "want", "favorites", "reviews"],
				misses: "tags and custom lists.",
				fileHint: "the ZIP file from Letterboxd",
				fileKind: "ZIP file",
			},
		],
		history: "October 11",
		sample: {
			counts: counts(412, 6, 9, 0, 3),
			kinds: kinds(301, 388, 64, 22, 12),
			warnings: [],
		},
	},
	{
		id: "trakt",
		name: "Trakt",
		mark: "Tr",
		color: "bg-red-600",
		group: "diaries",
		wave: 0,
		method: "upload",
		popular: 4,
		aliases: "trakt.tv",
		routes: [
			{
				label: "Export ZIP",
				wait: "now",
				waitText: "About a minute",
				where: "On trakt.tv in a browser, free and VIP",
				steps: [
					{
						text: "Sign in to Trakt, open Profile, then Settings, then Data, and choose Export now.",
						link: {
							label: "Open Trakt export settings",
							href: "https://app.trakt.tv/settings/data",
						},
					},
					{
						text: "Wait while Trakt builds the ZIP in your browser. Keep it as it is.",
					},
				],
				gets: [
					"ratings",
					"dated",
					"rewatches",
					"episodes",
					"want",
					"favorites",
				],
				misses: "season and episode ratings, custom lists, and dropped shows.",
				fileHint: "the ZIP file from Trakt",
				fileKind: "ZIP file",
			},
		],
		history: "October 11",
		sample: {
			counts: counts(2980, 12, 31, 12, 0),
			kinds: kinds(188, 2802, 41, 4, 0),
			warnings: [
				"412 plays share the same minute. Trakt writes the rating date as the play date for some imports.",
			],
		},
	},
	{
		id: "tmdb",
		name: "TMDB",
		mark: "TMDB",
		color: "bg-sky-700",
		group: "ratings",
		wave: 1,
		method: "connect",
		popular: 5,
		aliases: "the movie database themoviedb",
		routes: [
			{
				label: "Connect",
				wait: "now",
				waitText: "Seconds",
				where: "Any browser, no file",
				steps: [
					{ text: "Choose Connect TMDB. TMDB opens in a new tab." },
					{ text: "Approve GoodWatch on TMDB within 15 minutes." },
					{
						text: "Come back here. GoodWatch reads your account once and shows what it found.",
					},
				],
				gets: ["ratings", "want", "favorites"],
				misses:
					"watch history (TMDB keeps none), episode ratings, and custom lists.",
				fileHint: "",
				fileKind: "",
			},
		],
		alternative:
			'Prefer a file? TMDB also emails a CSV from the "..." button on your ratings, watchlist, and favorites pages.',
		sample: {
			counts: counts(1960, 22, 0, 0, 32),
			kinds: kinds(2014, 0, 186, 54, 0),
			warnings: ["TMDB ratings in half steps are rounded up: 7.5 becomes 8."],
		},
	},
	{
		id: "csv",
		name: "Any other site (CSV)",
		mark: "CSV",
		color: "bg-slate-600",
		group: "other",
		wave: 1,
		method: "upload",
		popular: 19,
		aliases:
			"generic csv mubi filmweb csfd senscritique douban kinopoisk filmaffinity moviepilot rotten tomatoes icheckmovies spreadsheet",
		routes: [
			{
				label: "CSV in Letterboxd's import format",
				wait: "now",
				waitText: "Depends on the tool",
				where: "From a site's own exporter or a community tool",
				steps: [
					{
						text: "Get a CSV with columns such as Title, Year, Rating10, WatchedDate, tmdbID, or imdbID. Tools for MUBI, Filmweb, ČSFD, SensCritique, Douban, Kinopoisk, and FilmAffinity produce one.",
					},
					{
						text: "Upload it as it is. The preview lists any column GoodWatch doesn't use.",
					},
				],
				gets: ["ratings", "dated", "reviews"],
				misses: "tags, and anything in columns GoodWatch doesn't know.",
				fileHint: "the CSV file",
				fileKind: "CSV file",
			},
		],
		sample: {
			counts: counts(233, 2, 18, 0, 0),
			kinds: kinds(240, 96, 0, 0, 4),
			warnings: ["Columns GoodWatch doesn't use: Tags, Directors."],
		},
	},
	{
		id: "simkl",
		name: "Simkl",
		mark: "Sk",
		color: "bg-zinc-600",
		group: "diaries",
		wave: 2,
		method: "upload",
		popular: 6,
		aliases: "simkl.com",
		routes: [
			{
				label: "Backup ZIP",
				wait: "now",
				waitText: "A minute or two",
				where: "On simkl.com in a browser, not the app",
				steps: [
					{
						text: "Sign in on simkl.com. In the top navigation choose APPS, then the Export tab.",
						link: {
							label: "Open Simkl export",
							href: "https://simkl.com/apps/backup/",
						},
					},
					{
						text: 'Under ".zip archive with .json file", choose DOWNLOAD BACKUP. Free once a month.',
					},
					{
						text: "If Simkl asks you to join instead, your account can't download it this month.",
					},
				],
				gets: ["ratings", "dated", "episodes", "want"],
				misses: "On hold and Dropped, and memos.",
				fileHint: "the ZIP file from Simkl",
				fileKind: "ZIP file",
			},
		],
		sample: {
			counts: counts(1844, 4, 27, 0, 0),
			kinds: kinds(220, 1650, 58, 0, 0),
			warnings: [
				"96 watches have no real date (Simkl stores 1970-01-01). They import without a date.",
				"Simkl counts episodes like TVDB; 14 episodes were mapped to TMDB's numbering.",
			],
		},
	},
	{
		id: "netflix",
		name: "Netflix",
		mark: "N",
		color: "bg-red-700",
		group: "streaming",
		wave: 2,
		method: "upload",
		popular: 3,
		aliases: "netflix viewing activity",
		routes: [
			{
				label: "Viewing activity",
				wait: "now",
				waitText: "Right away",
				where: "On netflix.com in a browser, one profile at a time",
				steps: [
					{
						text: "On netflix.com, open Account, then Profiles, choose your profile, then Viewing activity.",
						link: {
							label: "Open Netflix viewing activity",
							href: "https://www.netflix.com/viewingactivity",
						},
					},
					{ text: "Scroll to the bottom and choose Download all." },
					{ text: "Repeat for each profile you want to bring." },
				],
				gets: ["watches", "episodes"],
				misses: "the time of day, rewatches, thumbs, and My List.",
				fileHint: "NetflixViewingHistory.csv",
				fileKind: "CSV file",
			},
			{
				label: "Full account archive",
				wait: "days",
				waitText: "Up to 30 days",
				where: "On netflix.com, account owner only",
				steps: [
					{
						text: "As the account owner, open Get my info on netflix.com and submit the request.",
						link: {
							label: "Open Netflix Get my info",
							href: "https://www.netflix.com/account/getmyinfo",
						},
					},
					{ text: 'Open the "Confirm Your Request" email and confirm.' },
					{ text: "Wait. Netflix allows up to 30 days." },
					{
						text: 'Open the link in the "ready" email within a few days and download the ZIP. Upload it as it is.',
					},
				],
				gets: ["dated", "rewatches", "episodes", "want"],
				misses: "thumbs. They aren't scores.",
				fileHint: "the ZIP file from Netflix",
				fileKind: "ZIP file",
			},
		],
		caveat:
			"Netflix gives titles without ids, so a few episodes may not be found. The preview lists them.",
		sample: {
			counts: counts(1320, 0, 44, 61, 0),
			kinds: kinds(0, 1320, 0, 0, 0),
			warnings: ["61 rows are trailers or previews and are left out."],
		},
	},
	{
		id: "tvtime",
		name: "TV Time",
		mark: "TV",
		color: "bg-yellow-300 !text-black",
		group: "diaries",
		wave: 2,
		method: "upload",
		popular: 9,
		aliases: "tvtime",
		routes: [
			{
				label: "A file you saved before July 15, 2026",
				wait: "now",
				waitText: "Only a saved file",
				where: "TV Time shut down on July 15, 2026",
				steps: [
					{
						text: "Find the file you saved from TV Time: gdpr-data.zip, tv-time-export.zip, or a tvtime file from an extension.",
					},
					{
						text: "Upload it as it is. If the ZIP asks for a password, use the one TV Time sent you.",
					},
				],
				gets: ["episodes", "rewatches", "want", "favorites"],
				misses:
					"Dropped shows, lists, and episode ratings. Movies without ids may not be found.",
				fileHint: "your saved TV Time file",
				fileKind: "file",
			},
		],
		caveat:
			"No new TV Time export can be made. If you moved to Trakt, the Trakt export brings the same history.",
		sample: {
			counts: counts(3402, 0, 58, 0, 0),
			kinds: kinds(12, 3380, 60, 8, 0),
			warnings: [
				"TV Time counts episodes like TVDB; 120 episodes were mapped to TMDB's numbering.",
			],
		},
	},
	{
		id: "kodi",
		name: "Kodi",
		mark: "K",
		color: "bg-sky-500",
		group: "servers",
		wave: 3,
		method: "upload",
		popular: 12,
		aliases: "xbmc",
		routes: [
			{
				label: "Library export",
				wait: "now",
				waitText: "Right away",
				where: "In the Kodi app on your device",
				steps: [
					{
						text: "In Kodi, switch the settings level from Standard to Advanced. Otherwise the export is hidden.",
					},
					{
						text: "Go to Settings, Media, Library, Video library, and choose Export library.",
					},
					{
						text: "Choose Single file and pick a folder you can reach from this device.",
					},
					{
						text: "Upload videodb.xml from the kodi_videodb folder, not the artwork.",
					},
				],
				gets: ["ratings", "watches", "episodes"],
				misses: "play history: only the last day each title was played.",
				fileHint: "videodb.xml",
				fileKind: "XML file",
			},
		],
		notBuiltWhy: "It's in the third wave of sources.",
		sample: {
			counts: counts(640, 0, 4, 0, 0),
			kinds: kinds(80, 600, 0, 0, 0),
			warnings: [],
		},
	},
	{
		id: "tautulli",
		name: "Tautulli",
		mark: "Ta",
		color: "bg-orange-500",
		group: "servers",
		wave: 3,
		method: "upload",
		popular: 16,
		aliases: "plex stats",
		routes: [
			{
				label: "Library metadata export",
				wait: "minutes",
				waitText: "A few minutes",
				where: "In Tautulli, server admin only",
				steps: [
					{
						text: "In Tautulli, open Libraries, pick your Movies or TV library, and open the Export tab.",
					},
					{ text: "Choose Export metadata, JSON, and metadata level 3." },
					{
						text: "Download it from Metadata Exports when it appears. Repeat for each library.",
					},
				],
				gets: ["ratings", "watches", "episodes"],
				misses: "play history: one count and one date per title.",
				fileHint: "the JSON file from Tautulli",
				fileKind: "JSON file",
			},
		],
		notBuiltWhy: "It's in the third wave and waits for the Plex decision.",
		sample: {
			counts: counts(820, 0, 6, 0, 0),
			kinds: kinds(40, 800, 0, 0, 0),
			warnings: [],
		},
	},
	{
		id: "plex",
		name: "Plex",
		mark: "Px",
		color: "bg-amber-500 !text-black",
		group: "servers",
		wave: 3,
		method: "connect",
		popular: 7,
		aliases: "plex.tv",
		routes: [
			{
				label: "Sign in with Plex",
				wait: "now",
				waitText: "Seconds",
				where: "Any browser, no file",
				steps: [
					{
						text: "On Plex, turn on Settings, Account, Sync My Watch State and Ratings.",
					},
					{ text: "Choose Sign in with Plex and sign in on plex.tv." },
					{ text: "Come back here. GoodWatch reads your history once." },
				],
				gets: ["ratings", "dated", "episodes", "want"],
				misses: "plays from before you turned on sync.",
				fileHint: "",
				fileKind: "",
			},
		],
		notBuiltWhy:
			"Plex has no export file, and the owner hasn't decided on the sign-in route yet.",
		sample: {
			counts: counts(900, 0, 8, 0, 0),
			kinds: kinds(120, 760, 30, 0, 0),
			warnings: [],
		},
	},
	{
		id: "jellyfin",
		name: "Jellyfin",
		mark: "Jf",
		color: "bg-purple-600",
		group: "servers",
		wave: 3,
		method: "connect",
		popular: 11,
		aliases: "",
		routes: [
			{
				label: "Quick Connect",
				wait: "now",
				waitText: "Seconds",
				where: "This browser must reach your server",
				steps: [
					{ text: "Type your Jellyfin server address." },
					{
						text: "In a signed-in Jellyfin app, open Settings, Quick Connect, and enter the code GoodWatch shows.",
					},
					{
						text: "If your browser asks to reach your local network, allow it.",
					},
				],
				gets: ["watches", "episodes", "favorites"],
				misses: "play history, ratings, and a watchlist.",
				fileHint: "",
				fileKind: "",
			},
		],
		notBuiltWhy:
			"Jellyfin has no export file, and the owner hasn't decided on the connect route yet.",
		sample: {
			counts: counts(500, 0, 2, 0, 0),
			kinds: kinds(0, 480, 0, 20, 0),
			warnings: [],
		},
	},
	{
		id: "emby",
		name: "Emby",
		mark: "Em",
		color: "bg-green-600",
		group: "servers",
		wave: 4,
		method: "connect",
		popular: 17,
		aliases: "",
		routes: [
			{
				label: "Sign in",
				wait: "now",
				waitText: "Seconds",
				where: "Needs your Emby password",
				steps: [
					{
						text: "Emby has no way to approve GoodWatch without typing your password here.",
					},
				],
				gets: ["watches", "episodes", "favorites"],
				fileHint: "",
				fileKind: "",
			},
		],
		notBuiltWhy: "Emby would need your password, so it's on hold.",
		sample: { counts: counts(0), kinds: kinds(), warnings: [] },
	},
	{
		id: "mal",
		name: "MyAnimeList",
		mark: "MAL",
		color: "bg-blue-700",
		group: "anime",
		wave: 3,
		method: "upload",
		popular: 8,
		aliases: "mal anime",
		routes: [
			{
				label: "Anime list export",
				wait: "now",
				waitText: "Right away",
				where: "On myanimelist.net in a browser",
				steps: [
					{
						text: "Sign in on MyAnimeList and open the export page.",
						link: {
							label: "Open MyAnimeList export",
							href: "https://myanimelist.net/panel.php?go=export",
						},
					},
					{ text: "Choose Anime List, then Export My List." },
					{ text: "Upload the .xml.gz file as it is." },
				],
				gets: ["ratings", "episodes", "want"],
				misses:
					"On hold and Dropped, tags, and comments. Rewatches only as a count.",
				fileHint: "the animelist .xml.gz file",
				fileKind: "file",
			},
		],
		notBuiltWhy: "Anime needs a way to match anime seasons to TMDB first.",
		sample: {
			counts: counts(312, 0, 40, 0, 0),
			kinds: kinds(280, 300, 52, 0, 0),
			warnings: [],
		},
	},
	{
		id: "anilist",
		name: "AniList",
		mark: "AL",
		color: "bg-sky-900",
		group: "anime",
		wave: 3,
		method: "upload",
		popular: 10,
		aliases: "anime",
		routes: [
			{
				label: "GDPR data download",
				wait: "now",
				waitText: "Right away",
				where: "On anilist.co in a browser",
				steps: [
					{
						text: "Sign in on AniList and open Settings, then Account.",
						link: {
							label: "Open AniList account settings",
							href: "https://anilist.co/settings/account",
						},
					},
					{ text: "Under GDPR Data Download, choose Download." },
					{ text: "Upload the JSON file as it is." },
				],
				gets: ["ratings", "dated", "episodes", "want", "favorites", "reviews"],
				misses: "paused and dropped, and custom lists.",
				fileHint: "the JSON file from AniList",
				fileKind: "JSON file",
			},
		],
		notBuiltWhy: "Anime needs a way to match anime seasons to TMDB first.",
		sample: {
			counts: counts(280, 0, 35, 0, 0),
			kinds: kinds(240, 260, 40, 12, 3),
			warnings: [],
		},
	},
	{
		id: "kitsu",
		name: "Kitsu",
		mark: "Ki",
		color: "bg-orange-600",
		group: "anime",
		wave: 3,
		method: "upload",
		popular: 15,
		aliases: "anime",
		routes: [
			{
				label: "Anime library download",
				wait: "now",
				waitText: "Right away",
				where: "On kitsu.app in a browser",
				steps: [
					{ text: "On Kitsu, open Settings, then Export." },
					{
						text: "Choose Download Anime Library. Kitsu saves it in MyAnimeList's format.",
					},
					{ text: "Upload the XML file as it is." },
				],
				gets: ["ratings", "episodes", "want"],
				misses:
					"On hold and Dropped, and anime Kitsu can't match to MyAnimeList.",
				fileHint: "the XML file from Kitsu",
				fileKind: "XML file",
			},
		],
		notBuiltWhy:
			"Anime needs a way to match anime seasons to TMDB first, and Kitsu's permission.",
		sample: {
			counts: counts(150, 0, 22, 0, 0),
			kinds: kinds(120, 140, 30, 0, 0),
			warnings: [],
		},
	},
	{
		id: "criticker",
		name: "Criticker",
		mark: "Cr",
		color: "bg-rose-700",
		group: "ratings",
		wave: 3,
		method: "upload",
		popular: 13,
		aliases: "",
		routes: [
			{
				label: "All your ratings",
				wait: "now",
				waitText: "Right away",
				where: "On criticker.com in a browser",
				steps: [
					{
						text: "Sign in on Criticker and open Resources, then Feeds & exports.",
						link: {
							label: "Open Criticker exports",
							href: "https://www.criticker.com/resources/",
						},
					},
					{ text: "Choose All Your Ratings as CSV." },
				],
				gets: ["ratings", "reviews"],
				misses:
					"watch dates and your watchlist. Scores out of 100 become 1 to 10.",
				fileHint: "the CSV file from Criticker",
				fileKind: "CSV file",
			},
		],
		notBuiltWhy:
			"It waits for a real Criticker file and a rule for turning 0 to 100 into 1 to 10.",
		sample: {
			counts: counts(540, 8, 6, 0, 0),
			kinds: kinds(554, 0, 0, 0, 40),
			warnings: ["Scores out of 100 were converted: 85 becomes 9."],
		},
	},
	{
		id: "movielens",
		name: "MovieLens",
		mark: "ML",
		color: "bg-orange-700",
		group: "ratings",
		wave: 3,
		method: "upload",
		popular: 14,
		aliases: "",
		routes: [
			{
				label: "Ratings and wishlist",
				wait: "now",
				waitText: "Right away",
				where: "On movielens.org in a browser",
				steps: [
					{
						text: "Sign in on MovieLens and open settings, then import or export.",
						link: {
							label: "Open MovieLens export",
							href: "https://movielens.org/profile/settings/import-export",
						},
					},
					{ text: "Choose export ratings and export wishlist." },
					{ text: "Upload each CSV file." },
				],
				gets: ["ratings", "want"],
				misses: "dates and shows. MovieLens has movies only.",
				fileHint: "movielens-ratings.csv or movielens-wishlist.csv",
				fileKind: "CSV file",
			},
		],
		notBuiltWhy: "It's in the third wave of sources.",
		sample: {
			counts: counts(1100, 30, 2, 0, 0),
			kinds: kinds(1080, 0, 52, 0, 0),
			warnings: [],
		},
	},
	{
		id: "sofa",
		name: "Sofa",
		mark: "So",
		color: "bg-indigo-500",
		group: "diaries",
		wave: 3,
		method: "upload",
		popular: 18,
		aliases: "sofa app",
		routes: [
			{
				label: "Export all data",
				wait: "now",
				waitText: "Right away",
				where: "In the Sofa app on iPhone, iPad, or Mac",
				steps: [
					{ text: "In Sofa, open the Lists tab, then •••, then Settings." },
					{ text: "Choose Data Management, Export All Data, then Export." },
					{ text: "Choose Save Export and keep the ZIP as it is." },
				],
				gets: ["dated", "rewatches", "want"],
				misses:
					"ratings unless you tell GoodWatch which of your fields is the rating.",
				fileHint: "the ZIP file from Sofa",
				fileKind: "ZIP file",
			},
		],
		notBuiltWhy:
			"It waits for a real Sofa file, because Sofa has no built-in rating.",
		sample: {
			counts: counts(410, 0, 12, 0, 0),
			kinds: kinds(0, 380, 42, 0, 0),
			warnings: [],
		},
	},
]

export const sourceById = (id: SourceId) =>
	SOURCES.find((source) => source.id === id) as Source
export const byPopularity = [...SOURCES].sort((a, b) => a.popular - b.popular)

export function searchSources(query: string) {
	const q = query.trim().toLowerCase()
	if (!q) return byPopularity
	return byPopularity.filter((source) =>
		`${source.name} ${source.aliases} ${source.group}`
			.toLowerCase()
			.includes(q),
	)
}
