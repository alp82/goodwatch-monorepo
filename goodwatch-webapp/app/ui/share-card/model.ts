// Types, color themes, and list prompts for share cards. Keys here are stored in user_list and are
// part of card image cache keys: never rename one after it ships.

export type MediaType = "movie" | "show"

// One title as a share card shows it.
export interface CardTitle {
	key: string // "movie:603"
	type: MediaType
	title: string
	year: number | null
	poster: string | null
	backdrop: string | null
	genre: string | null
	score: number | null
}

export interface CardProps {
	title: string
	items: CardTitle[]
	name: string
	theme: ThemeKey
	date: string
	// Editor only: show placeholders for empty ranks. Never set when rendering the image.
	editing?: boolean
}

export interface CardDesign {
	key: string
	name: string
	format: string
	w: number
	h: number
	Card: (p: CardProps) => JSX.Element
}

// Every share list has exactly this many titles.
export const LIST_SIZE = 5

export const TITLE_MAX_LENGTH = 80

export interface ListPrompt {
	id: string
	title: string
	type: MediaType | "all"
	movieGenre?: string
	showGenre?: string
}

export const LIST_PROMPTS: ListPrompt[] = [
	{ id: "all-time", title: "My top 5 movies of all time", type: "movie" },
	{ id: "scifi-shows", title: "The best sci-fi shows", type: "show", showGenre: "Sci-Fi & Fantasy" },
	{ id: "comfort", title: "Comfort rewatches", type: "all" },
	{ id: "wrecked", title: "Movies that wrecked me", type: "movie", movieGenre: "Drama" },
	{ id: "scared", title: "Horror that actually scared me", type: "movie", movieGenre: "Horror" },
	{ id: "binge", title: "Shows I'd rewatch forever", type: "show" },
	{ id: "animated", title: "Animation for grown-ups", type: "all", movieGenre: "Animation", showGenre: "Animation" },
	{ id: "date-night", title: "Perfect date-night movies", type: "movie", movieGenre: "Romance" },
]
export const DEFAULT_PROMPT_ID = "all-time"
export const isPromptId = (id: unknown): id is string => typeof id === "string" && LIST_PROMPTS.some((p) => p.id === id)

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
export const DEFAULT_THEME: ThemeKey = "ember"
export const isThemeKey = (key: unknown): key is ThemeKey => typeof key === "string" && key in THEMES

// Deterministic string hash. Cards use it for decoration (order numbers, barcodes), so the
// browser preview and the rendered image always agree.
export const hash = (s: string) => {
	let h = 2166136261
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
	return h >>> 0
}

/** How a card is signed: always the owner's @handle, so nobody can sign as someone else. */
export const listByline = (handle: string) => `@${handle}`

/** What a guest's draft card shows before sharing, when there is no handle yet. */
export const GUEST_BYLINE = "@you"

export const titleKey = (type: MediaType, tmdbId: number) => `${type}:${tmdbId}`

// The date a card prints, like "Sep 25, 2026".
export const cardDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
