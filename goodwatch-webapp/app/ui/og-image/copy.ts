// Every piece of text the Open Graph cards show, in one place to review and edit.
// After changing anything here, bump CACHE_PREFIX in app/server/og-image/og-image.server.tsx,
// or cached cards keep the old text for up to a day.
//
// Text that comes from elsewhere:
// - Mood, streaming, and genre names and subtitles: app/ui/explore/category/*.ts and
//   app/ui/explore/main-nav.ts (shared with the pages themselves).
// - Score words such as "Masterpiece": scoreLabels in app/utils/ratings.ts.
// - Titles, names, years, and runtimes: the database.

export const BRAND_NAME = "GoodWatch"

// Subtexts longer than this are left off the card, because they can't be read at a glance.
export const SUBTEXT_MAX_LENGTH = 40

type PageCopy = { tag: string; title: string; subtitle: string }

// Movies and shows: the tag above the title, such as "Movie · 2010 · 2h 28m".
export const MEDIA_LABELS = { movie: "Movie", show: "TV Show" } as const
export const seasonsLabel = (count: number) =>
	`${count} season${count > 1 ? "s" : ""}`

// People: the tag above the name, such as "Actor · 198 titles".
export const DEPARTMENT_LABELS: Record<string, string> = {
	Acting: "Actor",
	Directing: "Director",
	Writing: "Writer",
	Production: "Producer",
}
export const personTag = (department: string, titles: number) =>
	`${department} · ${titles} titles`

// /movies and /shows. typeLabel is "Movies" or "TV Shows".
export const typeIndexCopy = (typeLabel: string): PageCopy => ({
	tag: typeLabel,
	title: `The best ${typeLabel.toLowerCase()} to watch right now`,
	subtitle:
		"By genre, mood, or streaming service. Scored from IMDb, Rotten Tomatoes, and Metacritic.",
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
	title: "What should you watch tonight?",
	subtitle:
		"Every streaming service, every rating, one place. Find movies and shows by mood, vibe, and where they stream.",
}

// Main pages, keyed by path.
export const STATIC_PAGE_COPY: Record<string, PageCopy> = {
	"/": HOME_COPY,
	"/discover": {
		tag: "Discover",
		title: "Find your next favorite",
		subtitle: "Filter by streaming service, score, mood, cast, and more.",
	},
	"/search": {
		tag: "Search",
		title: "Describe it. We'll find it.",
		subtitle: "Search movies and shows by title, person, or feeling.",
	},
	"/how-it-works": {
		tag: "How it works",
		title: "Ratings, vibes, and fingerprints",
		subtitle: "How GoodWatch scores and understands every title.",
	},
	"/about": {
		tag: "About",
		title: "Made by people who watch too much",
		subtitle: "Why GoodWatch exists and who builds it.",
	},
	"/taste": {
		tag: "Taste profile",
		title: "Your taste",
		subtitle:
			"See what you really love in movies and shows, and get picks that fit.",
	},
	"/taste/quiz": {
		tag: "Taste quiz",
		title: "Rate 5 movies. Get great picks.",
		subtitle: "Recommendations that fit your taste, in 30 seconds. No signup.",
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
		title: "Save what you love",
		subtitle: "Track, rate, and get picks tailored to your taste.",
	},
	"/privacy": {
		tag: "Privacy",
		title: "Privacy policy",
		subtitle: "What we collect and why.",
	},
	"/disclaimer": {
		tag: "Disclaimer",
		title: "Disclaimer",
		subtitle: "Data sources and attributions.",
	},
	"/settings": {
		tag: "Settings",
		title: "Your settings",
		subtitle: "Country, streaming services, and account.",
	},
}
