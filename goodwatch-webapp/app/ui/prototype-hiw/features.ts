// PROTOTYPE - throwaway. The /how-it-works rows: one feature each, in the intro film's order, with the scene that
// shows it (living-room/intro/film.ts ids). Facts checked 2026-10-18:
// - Score: goodwatch-flows/windmill/f/sync/copy/all_ratings.py:248-287 (audience average of TMDB, IMDb, Metacritic
//   users, RT audience; critic average of Metascore and Tomatometer; the score is the mean of the two).
// - 74 analysis attributes: server/utils/fingerprint.ts VALID_FINGERPRINT_KEYS.
// - 325 services, 139 countries, 1,497,602 titles: server/living-room/intro/content.json (capturedAt 2026-10-17).
// - Match 50-99, 90 = top 1%: domain/taste-match.ts:23-30.

export type Feature = {
	id: string
	/** The intro scene that shows it, or "ai" for the /use-with-ai chat demo. */
	scene: string
	kicker: string
	title: string
	line: string
	link: { to: string; label: string }
}

export const HIW_FEATURES: Feature[] = [
	{
		id: "score",
		scene: "one-score",
		kicker: "Score",
		title: "One score you can trust",
		line: "IMDb, Rotten Tomatoes, Metacritic and TMDB in one number. Critics count half, audiences the other half.",
		link: { to: "/discover", label: "Best rated now" },
	},
	{
		id: "streaming",
		scene: "streaming",
		kicker: "Streaming",
		title: "Where it streams",
		line: "325 services in 139 countries. See which of yours has it tonight.",
		link: { to: "/movies/streaming", label: "By service" },
	},
	{
		id: "for-you",
		scene: "picked-for-you",
		kicker: "For you",
		title: "Picked for your taste",
		line: "Rate titles you loved. Your match shows how well the rest fit: 90% is your top 1%.",
		link: { to: "/taste", label: "Find your taste" },
	},
	{
		id: "title-analysis",
		scene: "how-it-feels",
		kicker: "Title analysis",
		title: "How it feels",
		line: "Every title is read on 74 traits, from tense to heartwarming. Pick by the evening you want.",
		link: { to: "/explorer", label: "Browse by feeling" },
	},
	{
		id: "search",
		scene: "search",
		kicker: "Search",
		title: "Search by mood",
		line: "Type the evening you want, and get the titles that fit it.",
		link: { to: "/search", label: "Try a search" },
	},
	{
		id: "filters",
		scene: "filters",
		kicker: "Discover",
		title: "From everything to tonight",
		line: "1.5 million titles down to a few: your services, not seen yet, the mood, the score.",
		link: { to: "/discover", label: "Open Discover" },
	},
	{
		id: "explorer",
		scene: "explorer",
		kicker: "Explorer",
		title: "A map of how movies feel",
		line: "Islands of titles that feel alike. Mix two to see what they share.",
		link: { to: "/explorer", label: "Open the Explorer" },
	},
	{
		id: "tracking",
		scene: "tracking",
		kicker: "Tracking",
		title: "It keeps track for you",
		line: "Your Wishlist and your shows in one place, and a heads-up when a title lands on your service.",
		link: { to: "/watch-next", label: "See Watch next" },
	},
	{
		id: "ratings",
		scene: "ratings",
		kicker: "Imports",
		title: "Bring your ratings",
		line: "From IMDb, Letterboxd, Trakt, Plex and more. Your taste is ready on day one.",
		link: { to: "/settings/imports", label: "Import ratings" },
	},
	{
		id: "ai",
		scene: "ai",
		kicker: "AI apps",
		title: "Ask in your AI chat",
		line: "Claude, ChatGPT and other AI apps can find, log and rate titles for you.",
		link: { to: "/use-with-ai", label: "Set it up" },
	},
]

export const HIW_INTRO = {
	title: "How GoodWatch works",
	line: "Every score, every service, one place. Here's what that looks like.",
}
