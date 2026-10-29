export const GENRE_FOLDS: { label: string; names: string[] }[] = [
	{ label: "Action", names: ["Action", "Action & Adventure"] },
	{ label: "Adventure", names: ["Adventure", "Action & Adventure"] },
	{ label: "Sci-Fi", names: ["Science Fiction", "Sci-Fi & Fantasy"] },
	{ label: "Fantasy", names: ["Fantasy", "Sci-Fi & Fantasy"] },
	{ label: "War", names: ["War", "War & Politics"] },
]

const TV_GENRES: Record<string, readonly string[]> = {
	"Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
	"Action & Adventure": ["Action", "Adventure"],
	"War & Politics": ["War"],
	Kids: [],
	Soap: [],
	News: [],
	Reality: [],
	Talk: [],
}

// Count each title once per movie genre, including folded TV genres.
export function foldGenres(genres: readonly string[]): string[] {
	return [...new Set(genres.flatMap((genre) => TV_GENRES[genre] ?? [genre]))]
}
