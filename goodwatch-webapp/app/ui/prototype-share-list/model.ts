// PROTOTYPE - throwaway. Shared types and presets for the share-list prototype.

export interface ListItem {
	key: string
	type: "movie" | "show"
	title: string
	year: number | null
	poster: string | null
	backdrop: string | null
	genre: string | null
	score: number | null
}

export interface CardProps {
	title: string
	items: ListItem[]
	name: string
	theme: ThemeKey
	date: string
	// Editor only: show placeholders for empty slots. Never set when exporting.
	editing?: boolean
}

export interface Design {
	key: string
	name: string
	format: string
	w: number
	h: number
	// Most ranks the card shows. The editor dims list entries past it.
	max: number
	Card: (p: CardProps) => JSX.Element
}

export interface Prompt {
	id: string
	title: string
	type: "movie" | "show" | "all"
	movieGenre?: string
	showGenre?: string
}

export const PROMPTS: Prompt[] = [
	{ id: "all-time", title: "My top 5 movies of all time", type: "movie" },
	{ id: "scifi-shows", title: "The best sci-fi shows", type: "show", showGenre: "Sci-Fi & Fantasy" },
	{ id: "comfort", title: "Comfort rewatches", type: "all" },
	{ id: "wrecked", title: "Movies that wrecked me", type: "movie", movieGenre: "Drama" },
	{ id: "scared", title: "Horror that actually scared me", type: "movie", movieGenre: "Horror" },
	{ id: "binge", title: "Shows I'd rewatch forever", type: "show" },
	{ id: "animated", title: "Animation for grown-ups", type: "all", movieGenre: "Animation", showGenre: "Animation" },
	{ id: "date-night", title: "Perfect date-night movies", type: "movie", movieGenre: "Romance" },
]

export const THEMES = {
	ember: { label: "Ember", accent: "#ff5a1f", accent2: "#ffc53d", ink: "#120804", paper: "#fff4e6" },
	neon: { label: "Neon", accent: "#ff3dd8", accent2: "#7c5cff", ink: "#0b0514", paper: "#fbefff" },
	acid: { label: "Acid", accent: "#c8ff1a", accent2: "#19e6a4", ink: "#07100a", paper: "#f4ffe0" },
	ice: { label: "Ice", accent: "#4cc9ff", accent2: "#b8f1ff", ink: "#030b14", paper: "#eaf7ff" },
	rose: { label: "Rose", accent: "#ff4d6d", accent2: "#ffb3c6", ink: "#14050a", paper: "#fff0f3" },
	emerald: { label: "Emerald", accent: "#10b981", accent2: "#a7f3d0", ink: "#03120c", paper: "#ecfdf5" },
	royal: { label: "Royal", accent: "#4f6bff", accent2: "#b4c0ff", ink: "#05071a", paper: "#eef1ff" },
} as const
export type ThemeKey = keyof typeof THEMES

export const MAX_ITEMS = 5

// Deterministic string hash (no Math.random: SSR and PNG must match the preview).
export const hash = (s: string) => {
	let h = 2166136261
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
	return h >>> 0
}

export const fromSearchResult = (r: {
	id: number
	media_type: string
	title?: string
	name?: string
	release_date?: string
	first_air_date?: string
	poster_path?: string | null
	backdrop_path?: string | null
	vote_average?: number
}): ListItem => ({
	key: `${r.media_type}:${r.id}`,
	type: r.media_type as ListItem["type"],
	title: r.title ?? r.name ?? "",
	year: Number((r.release_date ?? r.first_air_date ?? "").slice(0, 4)) || null,
	poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
	backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : null,
	genre: null,
	score: null,
})

// The query that identifies a card image. The PNG endpoint caches by it and the view page puts
// it in og:image, so both must build it the same way.
export const cardQuery = (p: { design: string; title: string; keys: string[]; name: string; theme: string }) =>
	new URLSearchParams({ design: p.design, t: p.title, l: p.keys.join(","), n: p.name, theme: p.theme }).toString()

// Every font the card designs use, for the browser preview. The PNG renderer loads the same set.
export const CARD_FONTS =
	"https://fonts.googleapis.com/css2?family=Anton&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,800&family=Gabarito:wght@400;700;900&family=Instrument+Serif:ital@0;1&family=Space+Mono:wght@400;700&family=Playfair+Display:ital,wght@0,900;1,400;1,900&family=VT323&family=Permanent+Marker&family=Rubik+Mono+One&display=swap"
