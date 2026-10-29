import { MOOD_BY_KEY } from "~/domain/moods"
// What the start page's Where to start section shows (StartBrowse.tsx), shared by its loader (server/start-page/
// browse.server.ts) and the browser. Every rail's links are real pages of the site, in the server HTML.
//
// The section is part of the guest's HTML, which has a byte budget (goodwatch-benchmark/urls/budget.json), so the
// data is small: the cards a rail draws as poster cards are start titles, and the posters drawn as decoration (mood
// fans, service stacks, genre chips and peeks) are bare poster paths, with names only where a peek shows them.
import type { StartTitle } from "~/ui/living-room/living-room-data"

export type BrowseKind = "movie" | "show"

/** A poster drawn as decoration inside a link that names its page. */
export type BrowsePoster = { title: string; poster_path: string }

export type BrowseMood = {
	/** The mood page's address part: `/movies/moods/<path>`. */
	path: string
	/** Poster paths, the most popular first. */
	posters: string[]
}

export type BrowseService = {
	name: string
	/** The service's page: its streaming hub page, or its New on page in the country. */
	href: string
	/** The logo's TMDB path. */
	logo: string | null
	/** Poster paths, the most popular first. */
	posters: string[]
}

export type BrowseGenre = {
	name: string
	/** The genre page's address part: `/movies/genres/<path>`. */
	path: string
	titles: BrowsePoster[]
}

export type StartBrowseData = {
	/** The best of all time (the best-of lists), ten each. */
	top: Record<BrowseKind, StartTitle[]>
	/** What arrived on the big services in the country lately, the best first. */
	arrivals: StartTitle[]
	moods: BrowseMood[]
	services: BrowseService[]
	genres: Record<BrowseKind, BrowseGenre[]>
}

export const EMPTY_BROWSE: StartBrowseData = {
	top: { movie: [], show: [] },
	arrivals: [],
	moods: [],
	services: [],
	genres: { movie: [], show: [] },
}

/** How many of each the section shows. */
export const BROWSE_LIMITS = {
	top: 10,
	arrivals: 12,
	moodPosters: 3,
	servicePosters: 4,
	services: 6,
	genreTitles: 3,
} as const

/**
 * The moods of the mood rail, in its order: the mood pages under `/movies/moods/` (ui/explore/category/moods.ts), each
 * with a plain line and a color. The colors are the matching Discover moods' (domain/moods.ts).
 */
export const BROWSE_MOODS = [
	{
		path: "feel-good",
		name: MOOD_BY_KEY.feelgood.name,
		line: "Warm and hopeful, with nothing grim.",
		hue: "#fb923c",
	},
	{
		path: "funny",
		name: "Funny",
		line: "Wit, slapstick, or the absurd.",
		hue: "#facc15",
	},
	{
		path: "romantic",
		name: MOOD_BY_KEY.romance.name,
		line: "A love story at the center.",
		hue: "#f472b6",
	},
	{
		path: "adrenaline",
		name: "Adrenaline",
		line: "Big set pieces, no time to breathe.",
		hue: "#ef4444",
	},
	{
		path: "suspense",
		name: "Suspense",
		line: "Tension that keeps you guessing.",
		hue: "#60a5fa",
	},
	{
		path: "scary",
		name: "Scary",
		line: "Dread, frights, and horror.",
		hue: "#a3e635",
	},
	{
		path: "mind-bending",
		name: MOOD_BY_KEY.mind.name,
		line: "Layered stories that keep you thinking.",
		hue: "#c084fc",
	},
	{
		path: "epic",
		name: "Epic",
		line: "Grand adventures on a huge scale.",
		hue: "#2dd4bf",
	},
	{
		path: "melancholic",
		name: "Melancholic",
		line: "Quiet, sad, and beautiful.",
		hue: "#94a3b8",
	},
	{
		path: "whimsical",
		name: "Whimsical",
		line: "Playful and dreamlike.",
		hue: "#f5d0fe",
	},
] as const

/** The genres of the genre cloud, by their pages' address parts (ui/explore/category/genres.ts). */
export const BROWSE_GENRES: Record<BrowseKind, readonly string[]> = {
	movie: [
		"comedy",
		"drama",
		"science-fiction",
		"animation",
		"horror",
		"thriller",
		"romance",
		"documentary",
	],
	show: [
		"comedy",
		"drama",
		"crime",
		"scifi-and-fantasy",
		"animation",
		"mystery",
		"documentary",
	],
}

const PLURAL = { movie: "movies", show: "shows" } as const

export const moodHref = (path: string) => `/movies/moods/${path}`
export const genreHref = (kind: BrowseKind, path: string) =>
	`/${PLURAL[kind]}/genres/${path}`

/** The section's hub links: the rails' See all, and the ways to browse that no rail leads to. */
export const BROWSE_HUBS = {
	bestMovies: "/movies/best",
	bestShows: "/shows/best",
	arrivals: "/new",
	moods: "/movies/moods",
	services: "/shows/streaming",
	movieGenres: "/movies/genres",
	showGenres: "/shows/genres",
} as const

/** Every way to browse the site, as plain links at the section's end: there whether or not the rails have titles. */
export const MORE_HUBS = [
	{ href: "/discover", label: "Discover" },
	{ href: "/movies", label: "Movies" },
	{ href: "/shows", label: "TV shows" },
	{ href: "/movies/best", label: "Best movies" },
	{ href: "/shows/best", label: "Best shows" },
	{ href: "/new", label: "New on streaming" },
	{ href: "/movies/moods", label: "Movies by mood" },
	{ href: "/shows/moods", label: "Shows by mood" },
	{ href: "/movies/genres", label: "Movies by genre" },
	{ href: "/shows/genres", label: "Shows by genre" },
	{ href: "/movies/streaming", label: "Movies by service" },
	{ href: "/shows/streaming", label: "Shows by service" },
	{ href: "/explorer", label: "Explorer" },
	{ href: "/taste", label: "Your taste" },
	{ href: "/how-it-works", label: "How it works" },
] as const
