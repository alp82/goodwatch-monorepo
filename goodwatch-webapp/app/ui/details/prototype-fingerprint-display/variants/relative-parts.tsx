// PROTOTYPE - throwaway.
// Slider scales (copied from round-1 Sliders.tsx) plus genre-typical ranges and comparison words for Relative.
import type { Pillar } from "~/ui/details/DetailsFingerprint"
import type * as F from "~/ui/fingerprint/fingerprintText"
import { type GenreTypical, type Quartiles, RELATIVE_MEDIANS } from "../relative-medians"

type Scores = F.TitleInput["fingerprint"]["scores"]

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const top2 = (xs: number[]) => {
	const b = [...xs].sort((x, y) => y - x)
	return (b[0] + (b[1] ?? 0)) / 2
}

export type ScaleId = "pace" | "tone" | "setting" | "attention"

export interface Scale {
	id: ScaleId
	name: string
	area: Pillar
	left: string
	right: string
	words: [string, string, string, string, string]
	/** Comparatives toward the right pole and toward the left pole. */
	more: string
	less: string
	value: (s: Scores) => number
}

// Same formulas as Sliders.tsx; relative-medians.ts was computed with them, so keep them in step.
export const SCALES: Scale[] = [
	{
		id: "pace",
		name: "Pace",
		area: "Energy",
		left: "Slow burn",
		right: "Fast",
		words: ["Very slow", "Slow burn", "Steady", "Fast", "Breakneck"],
		more: "faster",
		less: "slower",
		value: (s) => clamp((s.fast_pace - s.slow_burn) / 16 + 0.5),
	},
	{
		id: "tone",
		name: "Tone",
		area: "Heart",
		left: "Bleak",
		right: "Hopeful",
		words: ["Bleak", "Mostly dark", "Mixed", "Mostly hopeful", "Uplifting"],
		more: "more hopeful",
		less: "darker",
		value: (s) => clamp((s.hopefulness - s.bleakness) / 16 + 0.5),
	},
	{
		id: "setting",
		name: "Setting",
		area: "World",
		left: "Everyday",
		right: "Otherworldly",
		words: ["Real world", "Grounded", "Heightened", "Otherworldly", "Fantastical"],
		more: "more otherworldly",
		less: "more down to earth",
		value: (s) =>
			clamp(
				(Math.max(s.fantasy, s.futuristic, s.surrealism) - Math.max(s.contemporary_realism, s.historical, s.biographical)) / 16 + 0.5,
			),
	},
	{
		id: "attention",
		name: "Attention",
		area: "Craft",
		left: "Easy watch",
		right: "Demanding",
		words: ["Easy watch", "Easy to follow", "Some focus", "Demanding", "Very demanding"],
		more: "more demanding",
		less: "easier to follow",
		value: (s) => clamp((top2([s.complexity, s.philosophical, s.non_linear_narrative, s.ambiguity, s.meta_narrative]) - 2) / 8),
	},
]

export const wordAt = (sc: Scale, v: number) => sc.words[v < 0.15 ? 0 : v < 0.38 ? 1 : v <= 0.62 ? 2 : v <= 0.85 ? 3 : 4]

// Plural nouns for TMDB genres. Shows use TMDB's TV genres.
const MOVIE_NOUN: Record<string, string> = {
	Drama: "dramas",
	Comedy: "comedies",
	Action: "action movies",
	Documentary: "documentaries",
	Adventure: "adventure movies",
	Animation: "animated movies",
	Mystery: "mysteries",
	Horror: "horror movies",
	"Science Fiction": "sci-fi movies",
	Western: "westerns",
	Crime: "crime movies",
	Romance: "romances",
	Fantasy: "fantasy movies",
	History: "historical movies",
	Thriller: "thrillers",
	Family: "family movies",
	Music: "music movies",
	War: "war movies",
	"TV Movie": "TV movies",
}
const SHOW_NOUN: Record<string, string> = {
	Drama: "drama series",
	Animation: "animated series",
	Comedy: "comedy series",
	Mystery: "mystery series",
	Talk: "talk shows",
	Kids: "kids' shows",
	"Sci-Fi & Fantasy": "sci-fi and fantasy series",
	Reality: "reality shows",
	"Action & Adventure": "action series",
	Crime: "crime series",
	Family: "family shows",
	Soap: "soaps",
	News: "news shows",
	Western: "western series",
	Documentary: "documentary series",
	"War & Politics": "war and politics series",
}

/** The title's main genre (the first one it lists) with its typical readings, or all titles of its kind. */
export function typicalFor(t: F.TitleInput): { noun: string; typical: GenreTypical } {
	const table = RELATIVE_MEDIANS[t.mediaType]
	const nouns = t.mediaType === "movie" ? MOVIE_NOUN : SHOW_NOUN
	const g = t.genres[0]
	if (g && table[g] && nouns[g]) return { noun: nouns[g], typical: table[g] }
	return { noun: t.mediaType === "movie" ? "movies" : "series", typical: table.all }
}

// Readings move in steps of 1/16, so "about typical" allows one step either side of the median.
const STEP = 0.07

/** Words for where `v` sits against the genre's quartiles: beyond the middle half reads as "than most". */
export function compare(sc: Scale, v: number, q: Quartiles, noun: string) {
	const [p25, med, p75] = q
	if (v > p75) return `${cap(sc.more)} than most ${noun}`
	if (v < p25) return `${cap(sc.less)} than most ${noun}`
	if (v - med >= STEP) return `A little ${sc.more} than usual for ${noun}`
	if (med - v >= STEP) return `A little ${sc.less} than usual for ${noun}`
	return `About typical for ${noun}`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
