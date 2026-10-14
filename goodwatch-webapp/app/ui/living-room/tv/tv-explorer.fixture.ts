// For the mini Explorer's tests: the real mood map's twelve islands as a guest in the United States had them on
// October 13, 2026 (ids, names, colours, counts, positions and what sets each apart), with made-up titles.
import type {
	ExplorerIsland,
	ExplorerMap,
	ExplorerTitle,
} from "~/domain/explorer"

export const mapTitle = (
	tmdbId: number,
	rest: Partial<ExplorerTitle> = {},
): ExplorerTitle => ({
	key: 1_000_000_000_000 + tmdbId,
	mediaType: "movie",
	anime: false,
	tmdbId,
	title: `Title ${tmdbId}`,
	year: 1990,
	poster: `/poster-${tmdbId}.jpg`,
	backdrop: `/backdrop-${tmdbId}.jpg`,
	genres: [],
	score: 80,
	match: null,
	services: [],
	seen: false,
	wantToSee: false,
	notInterested: false,
	rating: null,
	...rest,
})

const ISLANDS: [
	id: string,
	name: string,
	color: string,
	count: number,
	x: number,
	y: number,
	apart: string,
][] = [
	[
		"funny",
		"Funny",
		"#e2cf55",
		2616,
		0.993,
		0.26,
		"Comic situations and slapstick",
	],
	["cozy", "Cozy", "#8ccf4d", 1908, 1, -0.233, "Wholesome warmth and hope"],
	[
		"romantic",
		"Romantic",
		"#e0607e",
		1307,
		0.755,
		-0.5,
		"Romance and sensuality",
	],
	[
		"thrilling",
		"Thrilling",
		"#e8793d",
		2228,
		0.036,
		-0.063,
		"Adrenaline and breakneck pace",
	],
	["tense", "Tense", "#5b7fa8", 1287, -0.557, -0.297, "Suspense and crime"],
	[
		"scary",
		"Scary",
		"#7fae3a",
		1329,
		-0.546,
		0.349,
		"Real scares and the grotesque",
	],
	[
		"sad",
		"Sad",
		"#7cc4e8",
		2025,
		-0.199,
		-0.492,
		"Deeply moving stories and melancholy",
	],
	[
		"dark",
		"Dark",
		"#6a5aa8",
		1943,
		-0.721,
		-0.03,
		"A bleak outlook and suspense",
	],
	[
		"trippy",
		"Trippy",
		"#9b7bea",
		906,
		-0.036,
		0.994,
		"The surreal and the psychedelic",
	],
	[
		"deep",
		"Deep",
		"#3fc1b0",
		450,
		-0.55,
		0.132,
		"Big questions and the spiritual",
	],
	[
		"magical",
		"Magical",
		"#e9a23b",
		906,
		0.508,
		0.03,
		"A sense of wonder and fantasy worlds",
	],
	[
		"quirky",
		"Quirky",
		"#b98a5a",
		851,
		0.549,
		0.867,
		"Eccentrics and absurd humor",
	],
]

/** Twelve titles per island, as a guest without taste gets them: island `n`'s are `n * 100 + 1` to `+ 12`. */
export const MOOD_ISLANDS: ExplorerIsland[] = ISLANDS.map(
	([id, name, color, count, x, y, apart], n) => ({
		id,
		name,
		color,
		count,
		medianMatch: null,
		bands: null,
		x,
		y,
		apart,
		titles: Array.from({ length: 12 }, (_, at) =>
			mapTitle((n + 1) * 100 + at + 1),
		),
	}),
)

export const MOOD_MAP: Pick<ExplorerMap, "islands" | "services"> = {
	islands: MOOD_ISLANDS,
	services: [],
}

/** The six largest, at the places the mini map gives them (`MAP_PLACES`). */
export const SIX = ["dark", "sad", "cozy", "scary", "thrilling", "funny"]
