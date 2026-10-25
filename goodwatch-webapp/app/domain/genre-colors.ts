/**
 * One fixed color per TMDB genre, so a genre reads the same wherever it's drawn and whatever the filter. TMDB's TV-only
 * genre pairs fold into a movie genre first (`movieGenre`), so "Sci-Fi & Fantasy" shares Science Fiction's color.
 */
export const GENRE_COLOR: Record<string, string> = {
	Action: "#ef4444",
	Adventure: "#f97316",
	Animation: "#22c55e",
	Comedy: "#eab308",
	Crime: "#a8a29e",
	Documentary: "#64748b",
	Drama: "#3b82f6",
	Family: "#84cc16",
	Fantasy: "#d946ef",
	History: "#b45309",
	Horror: "#be123c",
	Music: "#f472b6",
	Mystery: "#6366f1",
	Romance: "#fb7185",
	"Science Fiction": "#8b5cf6",
	"TV Movie": "#94a3b8",
	Thriller: "#14b8a6",
	War: "#78716c",
	Western: "#d97706",
	Kids: "#4ade80",
	Reality: "#c084fc",
	Soap: "#f9a8d4",
	Talk: "#7dd3fc",
	News: "#cbd5e1",
}

/** TMDB's TV genre pairs, each folded into the movie genre it's closest to. */
const TV_PAIRS: Record<string, string> = {
	"Sci-Fi & Fantasy": "Science Fiction",
	"Action & Adventure": "Action",
	"War & Politics": "War",
}

/** The movie genre a TV genre pair counts as; any other genre as is. */
export const movieGenre = (name: string) => TV_PAIRS[name] ?? name

export const genreColor = (name: string) =>
	GENRE_COLOR[movieGenre(name)] ?? "#9ca3af"
