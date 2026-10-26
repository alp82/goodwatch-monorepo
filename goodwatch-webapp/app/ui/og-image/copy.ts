// Every piece of text the Open Graph cards show, in one place to review and edit.
// After changing anything here, bump CACHE_PREFIX in app/server/og-image/og-image.server.tsx,
// or cached cards keep the old text for up to a day.
//
// Text that comes from elsewhere:
// - Mood, streaming, and genre names and subtitles: app/ui/explore/category/*.ts and
//   app/ui/explore/main-nav.ts (shared with the pages themselves).
// - Score words such as "Masterpiece": scoreLabels in app/utils/ratings.ts.
// - Titles, names, years, and runtimes: the database.

// Relative with the extension, because copy.test.ts runs this file in plain Node.
import { type ListKind, listName, listNoun } from "../../domain/best-lists.ts"
import { TONIGHT_ASK } from "../connector/example-prompts.ts"

export const BRAND_NAME = "GoodWatch"

// Subtexts longer than this are left off the card, because they can't be read at a glance.
export const SUBTEXT_MAX_LENGTH = 40

type PageCopy = { tag: string; title: string; subtitle: string }

// Movies and shows: the tag above the title, such as "Movie · 2010 · 2h 28m".
export const MEDIA_LABELS = { movie: "Movie", show: "TV Show" } as const
/** A movie's length, such as "2h 16m", "1h", or "45m". Empty without a positive whole number of minutes. */
export const runtimeLabel = (minutes: number | null | undefined) => {
	if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return ""
	const whole = Math.round(minutes)
	const hours = Math.floor(whole / 60)
	const rest = whole % 60
	return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""]
		.filter(Boolean)
		.join(" ")
}

export const seasonsLabel = (count: number) =>
	`${count} season${count > 1 ? "s" : ""}`

// People: the tag above the name, such as "Actor · 198 titles".
export const DEPARTMENT_LABELS: Record<string, string> = {
	Acting: "Actor",
	Directing: "Director",
	Writing: "Writer",
	Production: "Producer",
}
// TMDB leaves the department empty for some people: the tag is then the title count alone.
export const personTag = (department: string | null, titles: number) =>
	[department, `${titles} titles`].filter(Boolean).join(" · ")

// /movies and /shows. typeLabel is "Movies" or "TV Shows".
export const typeIndexCopy = (typeLabel: string): PageCopy => ({
	tag: typeLabel,
	title: `The best ${typeLabel.toLowerCase()} to watch right now`,
	subtitle:
		"By genre, mood, or streaming service. Scored from IMDb, Rotten Tomatoes, and Metacritic.",
})

// /movies/best and /shows/best.
export const bestListCopy = (kind: ListKind): PageCopy => ({
	tag: listName(kind),
	title: `The best ${listNoun(kind)} of all time`,
	subtitle: "Ranked by GoodWatch score",
})

// /movies/moods, /shows/genres, and so on. categoryLabel is "Moods", "Streaming", "Genres".
export const categoryIndexCopy = (
	typeLabel: string,
	categoryLabel: string,
) => ({
	tag: `Browse ${typeLabel}`,
	title: `${typeLabel} by ${categoryLabel.toLowerCase()}`,
})

// /movies/moods/scary and so on. pageLabel is "Scary", "Netflix", "Comedy".
export const collectionCopy = (
	typeLabel: string,
	categoryLabel: string,
	pageLabel: string,
) => ({
	tag: `${categoryLabel} · ${typeLabel}`,
	title: `${pageLabel} ${typeLabel}`,
})

// Home, and every page without its own entry below.
export const HOME_COPY: PageCopy = {
	tag: "GoodWatch",
	title: "What should you watch next?",
	subtitle:
		"Every streaming service, every rating, one place. Find movies and shows by mood, vibe, and where they stream.",
}

// Main pages, keyed by path.
export const STATIC_PAGE_COPY: Record<string, PageCopy> = {
	"/": HOME_COPY,
	"/discover": {
		tag: "Discover",
		title: "Discover your next favorite",
		subtitle: "Filter by streaming service, score, mood, cast, and more.",
	},
	"/people": {
		tag: "People",
		title: "Popular actors",
		subtitle: "Their best-known movies and shows",
	},
	"/how-it-works": {
		tag: "How it works",
		title: "How GoodWatch works",
		subtitle: "One score, every service, picks for your taste.",
	},
	"/about": {
		tag: "About",
		title: "Why GoodWatch exists",
		subtitle: "Made by people who watch too much.",
	},
	// The blog and one entry per post in app/content/blog/posts.json (copy.test.ts checks that each has one).
	"/blog": {
		tag: "Blog",
		title: "Studies and notes",
		subtitle: "Data studies and how GoodWatch is built.",
	},
	"/blog/streaming-by-country-2026": {
		tag: "Data study",
		title: "Spirited Away has a better passport than you",
		subtitle: "On Netflix in 129 countries. Not Japan.",
	},
	"/taste": {
		tag: "Taste profile",
		title: "Your taste",
		subtitle: "We understand what you really love in movies and shows.",
	},
	"/taste/quiz": {
		tag: "Taste quiz",
		title: "Rate 5 movies. Get great picks.",
		subtitle: "Recommendations that fit your taste, in 30 seconds.",
	},
	"/lists/new": {
		tag: "Top 5",
		title: "Rank your top 5. Share it.",
		subtitle:
			"Pick five movies or shows, choose a card design, and share the link.",
	},
	"/wishlist": {
		tag: "Wishlist",
		title: "Your watch-next list",
		subtitle: "Everything you want to watch, and where it streams.",
	},
	"/sign-in": {
		tag: "Sign in",
		title: "Welcome back",
		subtitle: "Pick up where you left off.",
	},
	"/sign-up": {
		tag: "Sign up",
		title: "Watch what you love",
		subtitle: "Track, rate, and get picks tailored to your taste.",
	},
	"/privacy": {
		tag: "Privacy",
		title: "Privacy policy",
		subtitle: "Why your taste is safe with us.",
	},
	// Drawn as the chat card (AI_CHAT_COPY). Listed here so the path has a card of its own.
	"/use-with-ai": {
		tag: "Use with AI",
		title: "Ask your AI what to watch",
		subtitle: "GoodWatch in Claude, ChatGPT and more. It knows your taste.",
	},
	"/discord": {
		tag: "Discord bot",
		title: "GoodWatch in Discord",
		subtitle: "Pick what to watch, right in the chat.",
	},
	"/support": {
		tag: "Support",
		title: "How can we help?",
		subtitle: "Write to us, fix an AI app, or get back into your account.",
	},
	"/disclaimer": {
		tag: "Disclaimer",
		title: "Disclaimer",
		subtitle: "GoodWatch sources and attributions.",
	},
	"/settings": {
		tag: "Settings",
		title: "Your settings",
		subtitle: "Country, streaming services, and account.",
	},
}

// /discover and /explorer: headline lines are set as written, one per line.
export const DISCOVERY_COPY = {
	discover: {
		tag: "Discover",
		lines: ["What’s good", "next?"],
		subtitle: "Only the good stuff, on the services you have.",
	},
	explorer: {
		tag: "Explorer",
		lines: ["Get lost in", "good movies"],
		subtitle: "Every mood is an island. The best finds are in between.",
		// Keys into moods in app/ui/explore/category/moods.ts. The bridge shows titles in both.
		islands: [
			// Preferred picks, as TMDB ids: Inception and The Matrix.
			{ label: "Mind-Bending", mood: "mind-bending", picks: [27205, 603] },
			// The Grand Budapest Hotel and Back to the Future, so the island isn't family animation.
			{ label: "Funny", mood: "funny", picks: [120467, 105] },
		],
		bridge: { label: "Mind-Bending + Funny" },
	},
} as const

// /use-with-ai: the pitch, and the chat on the dark panel. The prompt is the page's own example, in the casual voice
// example-prompts.ts keeps; the posters are top-scored titles on the service it names (STREAMING_PROVIDER_ID).
export const AI_CHAT_COPY = {
	tag: "Use with AI",
	lines: ["Ask your AI", "what to watch"],
	subtitle: "In Claude, ChatGPT and more.",
	prompt: TONIGHT_ASK,
	// TMDB watch provider id of the service the prompt names: Netflix.
	providerId: "8",
	toolLine: "Used GoodWatch",
	reply: "Top picks on Netflix for your taste.",
} as const

// The /for-you card. The family words match the pills on the page.
export const FOR_YOU_CARD_COPY = {
	title: ["For", "you"],
	line: "Recommendations for your taste",
	families: {
		feel: "Feel",
		humor: "Humor",
		world: "World",
		story: "Story",
		craft: "Craft",
	},
} as const

// The member profile cards (/u/<handle> and its tabs). No counts and no viewer type: lines use shares and words.
// The cards of the "New on your services" pages (/new): a service in a country, a country, the member's own page, and
// the share link that sends each viewer to their own country.
export const NEW_SERVICES_CARD_COPY = {
	service: (brand: string) => `New on ${brand}`,
	country: "New on streaming",
	member: "New on your services",
	shareTag: "In your country",
	tally: (count: number) =>
		count === 1 ? "1 new movie or show" : `${count.toLocaleString("en-US")} new movies and shows`,
	// The member card's wall marks a few services as the viewer's own, the rest step back.
	memberPicks: ["netflix", "hulu", "paramount-plus"],
	// The share card's disc: a few countries' flags stand for "yours, wherever you are".
	shareFlags: ["US", "DE", "GB", "JP"],
} as const

export const PROFILE_CARD_COPY = {
	/** Under the picks on the main card: the question a visitor answers by opening the profile. */
	teaser: "How well does your taste match?",
	tabs: {
		seen: "Seen",
		scores: "Scores",
		wishlist: "Wishlist",
		shows: "Shows",
		lists: "Lists",
		stats: "Stats",
	},
	/** Header names of the Stats tab sections with a card of their own (/u/<handle>/stats/<view>). */
	views: {
		everyone: "Vs everyone",
		sides: "Taste groups",
	},
	/** The everyone card's legend. */
	theirScore: "Their score",
	everyoneScore: "Everyone",
	/** The taste groups card: "Loves X", "And just as much Y". */
	loves: "Loves",
	justAsMuch: "And just as much",
	topScores: "Top scores",
	latestAdditions: "Latest additions",
	wishlistLine: "Next on their list",
	watchingLine: "What they're watching now",
	followingLine: "The shows they follow",
	tasteGroups: "Their taste groups",
	seenLine: (medium: string, decade: string | null) =>
		decade ? `${medium} · leans ${decade}` : medium,
	tasteLine: (pulls: string) => `Drawn to ${pulls}`,
	movies: "Movies",
	shows: "Shows",
} as const
