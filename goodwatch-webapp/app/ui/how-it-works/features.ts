import { TASTE_FALLBACK_PATH } from "~/domain/member-paths"
import { WATCH_PATHS } from "../../domain/member-paths.ts"
// The /how-it-works rows: one feature each, in the start page intro's order, each with a picture made from the
// intro's parts (pictures.tsx) or, for AI apps, the /use-with-ai chat demo. Facts checked on 2026-10-18:
// - Score: goodwatch-flows/windmill/f/sync/copy/all_ratings.py (the mean of an audience average of TMDB, IMDb,
//   Metacritic users and Rotten Tomatoes audience, and a critic average of Metascore and Tomatometer).
// - 325 services, 139 countries, 1.5 million titles: server/living-room/intro/content.json (captured 2026-10-17).
// - A 90% match is the top 1%: domain/taste-match.ts.

export type PictureId =
	| "score"
	| "streaming"
	| "for-you"
	| "taste"
	| "discord"
	| "search"
	| "filters"
	| "explorer"
	| "tracking"
	| "ratings"

export type Feature = {
	/** The row's anchor: /how-it-works#score. */
	id: string
	/** Its picture, or "chat" for the AI chat demo. */
	picture: PictureId | "chat"
	/** The picture's box on phones (on wider screens every box is 2:1). */
	phone: "square" | "tall"
	kicker: string
	title: string
	line: string
	link: { to: string; label: string }
}

export const HOW_IT_WORKS_FEATURES: Feature[] = [
	{
		id: "score",
		picture: "score",
		phone: "tall",
		kicker: "Score",
		title: "One score you can trust",
		line: "IMDb, Rotten Tomatoes, Metacritic and TMDB in one number. Critics count half, audiences the other half.",
		link: { to: "/movies", label: "Browse movies" },
	},
	{
		id: "streaming",
		picture: "streaming",
		phone: "square",
		kicker: "Streaming",
		title: "Where it streams",
		line: "325 services in 139 countries. See which of yours has it tonight.",
		link: { to: "/movies/streaming", label: "By service" },
	},
	{
		id: "for-you",
		picture: "for-you",
		phone: "square",
		kicker: "For you",
		title: "Picked for your taste",
		line: "Rate titles you loved. Your match shows how well the rest fit: 90% is your top 1%.",
		link: { to: TASTE_FALLBACK_PATH, label: "Find your taste" },
	},
	{
		id: "title-analysis",
		picture: "taste",
		phone: "square",
		kicker: "Your taste",
		title: "Your taste fingerprint",
		line: "Your ratings draw your taste fingerprint. Tune it for more laughs or more tension, and your picks change with it.",
		link: { to: WATCH_PATHS.forYou, label: "Tune your picks" },
	},
	{
		id: "search",
		picture: "search",
		phone: "square",
		kicker: "Search",
		title: "Search by mood",
		line: "Type the evening you want, and get the titles that fit it.",
		link: { to: "/search", label: "Try a search" },
	},
	{
		id: "filters",
		picture: "filters",
		phone: "tall",
		kicker: "Discover",
		title: "From everything to tonight",
		line: "1.5 million titles down to a few: your services, not seen yet, the mood, the score.",
		link: { to: "/discover", label: "Open Discover" },
	},
	{
		id: "explorer",
		picture: "explorer",
		phone: "square",
		kicker: "Explorer",
		title: "A map of how movies feel",
		line: "Islands of titles that feel alike. Mix two to see what they share.",
		link: { to: "/map", label: "Open the Explorer" },
	},
	{
		id: "tracking",
		picture: "tracking",
		phone: "square",
		kicker: "Tracking",
		title: "It keeps track for you",
		line: "Your Wishlist and your shows in one place, and a heads-up when a title lands on your service.",
		link: { to: WATCH_PATHS.tonight, label: "See Watch next" },
	},
	{
		id: "ratings",
		picture: "ratings",
		phone: "square",
		kicker: "Imports",
		title: "Bring your ratings",
		line: "From IMDb, Letterboxd, Trakt, Plex and more. Your taste is ready on day one.",
		link: { to: "/settings/imports", label: "Import ratings" },
	},
	{
		id: "ai",
		picture: "chat",
		phone: "square",
		kicker: "AI apps",
		title: "Use with AI",
		line: "Ask ChatGPT, Claude and other AI apps what to start tonight, compare scores, or log the episode you just watched.",
		link: { to: "/use-with-ai", label: "Set it up" },
	},
	{
		id: "discord",
		picture: "discord",
		phone: "square",
		kicker: "Discord",
		title: "Discord bot",
		line: "Type /watch for a pick, its score and where it streams. Let everyone vote on what to watch together.",
		link: { to: "/discord", label: "Add the Discord bot" },
	},
]
