// PROTOTYPE - throwaway. Sample data for the TV screen flow prototype (/prototype/tv-screen-flow). Made up: the
// scores, taste matches, services, islands and what the sample member watches. Nothing here is read from Crate.

export type Kind = "movie" | "show"
export type MoodKey = "funny" | "cozy" | "thrilling" | "mind" | "dark"
export type IslandKey = "heists" | "whodunits" | "found-family" | "workplace" | "time-loops" | "space"

export type Title = {
	key: string
	title: string
	year: number
	kind: Kind
	runtime: string
	score: number
	match: number
	service: string
	moods: MoodKey[]
	island: IslandKey
	line: string
	hue: number
}

const t = (key: string, title: string, year: number, kind: Kind, runtime: string, score: number, match: number, service: string, moods: MoodKey[], island: IslandKey, line: string, hue: number): Title => ({ key, title, year, kind, runtime, score, match, service, moods, island, line, hue })

export const TITLES: Title[] = [
	t("severance", "Severance", 2022, "show", "2 seasons", 91, 96, "Apple TV+", ["mind", "thrilling", "dark"], "workplace", "Work and life, cut apart by surgery.", 200),
	t("knives-out", "Knives Out", 2019, "movie", "2h 10m", 86, 92, "Prime Video", ["funny", "thrilling"], "whodunits", "A family, a fortune, and one very polite detective.", 28),
	t("arrival", "Arrival", 2016, "movie", "1h 56m", 87, 94, "Netflix", ["mind"], "space", "A linguist learns to talk with visitors.", 215),
	t("paddington-2", "Paddington 2", 2017, "movie", "1h 44m", 90, 88, "Netflix", ["cozy", "funny"], "found-family", "A bear, a pop-up book, and a prison bakery.", 12),
	t("the-bear", "The Bear", 2022, "show", "3 seasons", 89, 90, "Disney+", ["thrilling", "dark"], "workplace", "A fine-dining chef takes over a sandwich shop.", 5),
	t("oceans-eleven", "Ocean's Eleven", 2001, "movie", "1h 56m", 82, 89, "Netflix", ["funny", "thrilling"], "heists", "Eleven people, three casinos, one night.", 40),
	t("ted-lasso", "Ted Lasso", 2020, "show", "3 seasons", 88, 85, "Apple TV+", ["cozy", "funny"], "found-family", "A coach who knows nothing about football.", 225),
	t("palm-springs", "Palm Springs", 2020, "movie", "1h 30m", 80, 91, "Prime Video", ["funny", "mind"], "time-loops", "Two wedding guests stuck in the same day.", 320),
	t("russian-doll", "Russian Doll", 2019, "show", "2 seasons", 84, 87, "Netflix", ["mind", "funny", "dark"], "time-loops", "She keeps dying at her own birthday party.", 350),
	t("only-murders", "Only Murders in the Building", 2021, "show", "4 seasons", 85, 90, "Disney+", ["cozy", "funny"], "whodunits", "Three neighbours, one podcast, one murder.", 150),
	t("interstellar", "Interstellar", 2014, "movie", "2h 49m", 88, 86, "Prime Video", ["mind", "thrilling"], "space", "A farmer leaves Earth to find a new one.", 235),
	t("logan-lucky", "Logan Lucky", 2017, "movie", "1h 58m", 79, 84, "Prime Video", ["funny"], "heists", "Two brothers rob a speedway.", 18),
	t("slow-horses", "Slow Horses", 2022, "show", "4 seasons", 87, 93, "Apple TV+", ["thrilling", "funny", "dark"], "workplace", "The spies nobody wanted.", 170),
	t("the-martian", "The Martian", 2015, "movie", "2h 24m", 84, 83, "Disney+", ["funny", "thrilling"], "space", "One man, one planet, a lot of potatoes.", 15),
	t("broadchurch", "Broadchurch", 2013, "show", "3 seasons", 86, 82, "Netflix", ["thrilling", "dark"], "whodunits", "A small town, and everyone is a suspect.", 205),
	t("edge-of-tomorrow", "Edge of Tomorrow", 2014, "movie", "1h 53m", 81, 85, "Netflix", ["thrilling", "mind"], "time-loops", "Live, die, repeat.", 190),
	t("spirited-away", "Spirited Away", 2001, "movie", "2h 5m", 92, 88, "Netflix", ["cozy", "mind"], "found-family", "A girl works in a bathhouse for spirits.", 160),
	t("baby-driver", "Baby Driver", 2017, "movie", "1h 53m", 80, 81, "Netflix", ["thrilling"], "heists", "A getaway driver with a playlist.", 340),
	t("andor", "Andor", 2022, "show", "2 seasons", 90, 89, "Disney+", ["thrilling", "dark"], "space", "How a thief becomes a rebel.", 25),
	t("groundhog-day", "Groundhog Day", 1993, "movie", "1h 41m", 85, 87, "Prime Video", ["funny", "cozy"], "time-loops", "The same day, again and again.", 210),
	t("gilmore-girls", "Gilmore Girls", 2000, "show", "7 seasons", 80, 78, "Netflix", ["cozy"], "found-family", "A mother, a daughter, a town of oddballs.", 300),
	t("the-office", "The Office", 2005, "show", "9 seasons", 86, 84, "Netflix", ["funny", "cozy"], "workplace", "A paper company, filmed for no clear reason.", 45),
	t("the-good-place", "The Good Place", 2016, "show", "4 seasons", 87, 91, "Netflix", ["funny", "mind", "cozy"], "found-family", "She is in heaven by mistake.", 130),
	t("inside-man", "Inside Man", 2006, "movie", "2h 9m", 81, 86, "Netflix", ["thrilling", "dark"], "heists", "The perfect bank robbery, told by the robber.", 0),
	t("glass-onion", "Glass Onion", 2022, "movie", "2h 19m", 80, 86, "Netflix", ["funny", "thrilling"], "whodunits", "A murder game on a private island.", 185),
]

export const titleOf = (key: string): Title => TITLES.find((x) => x.key === key) ?? TITLES[0]
const titles = (...keys: string[]) => keys.map(titleOf)

export const MOODS: { key: MoodKey; name: string; line: string; hue: number }[] = [
	{ key: "funny", name: "Funny", line: "Light, quick, silly.", hue: 45 },
	{ key: "cozy", name: "Cozy", line: "Warm, safe, unhurried.", hue: 20 },
	{ key: "thrilling", name: "Thrilling", line: "Tense, fast, on the edge.", hue: 350 },
	{ key: "mind", name: "Mind-bending", line: "Big ideas, strange rules.", hue: 265 },
	{ key: "dark", name: "Dark", line: "Heavy, grim, honest.", hue: 215 },
]
export const moodName = (key: string | null | undefined) => MOODS.find((m) => m.key === key)?.name ?? "Any mood"

export const ISLANDS: { key: IslandKey; name: string; hue: number; next: [IslandKey, IslandKey]; at: { x: number; y: number } }[] = [
	{ key: "heists", name: "Heists", hue: 40, next: ["whodunits", "workplace"], at: { x: 30, y: 12 } },
	{ key: "whodunits", name: "Whodunits", hue: 150, next: ["heists", "found-family"], at: { x: 336, y: 40 } },
	{ key: "found-family", name: "Found family", hue: 15, next: ["whodunits", "time-loops"], at: { x: 640, y: 6 } },
	{ key: "workplace", name: "Workplace", hue: 200, next: ["heists", "time-loops"], at: { x: 96, y: 196 } },
	{ key: "time-loops", name: "Time loops", hue: 320, next: ["found-family", "space"], at: { x: 400, y: 214 } },
	{ key: "space", name: "Space", hue: 235, next: ["time-loops", "found-family"], at: { x: 668, y: 184 } },
]
export const islandOf = (key: string) => ISLANDS.find((i) => i.key === key) ?? ISLANDS[0]
export const islandTitles = (key: string) => TITLES.filter((x) => x.island === key).slice(0, 4)
/** The lines on the mini map: each pair of neighbouring islands once. */
export const BRIDGES: [IslandKey, IslandKey][] = [
	["heists", "whodunits"],
	["whodunits", "found-family"],
	["heists", "workplace"],
	["workplace", "time-loops"],
	["time-loops", "found-family"],
	["time-loops", "space"],
	["space", "found-family"],
]

/** The sides of a person's taste (the mini Taste). */
export const SIDES = [
	{ key: "dark-crime", name: "Dark crime", line: "Tense, grim, clever.", hue: 215, titles: titles("slow-horses", "broadchurch", "inside-man", "knives-out") },
	{ key: "gentle-comedy", name: "Gentle comedy", line: "Warm, kind, funny.", hue: 25, titles: titles("paddington-2", "ted-lasso", "only-murders", "the-good-place") },
	{ key: "big-ideas", name: "Big ideas", line: "Strange rules, big questions.", hue: 265, titles: titles("arrival", "severance", "interstellar", "russian-doll") },
]
export const sideOf = (key: string) => SIDES.find((s) => s.key === key) ?? SIDES[0]

/** What the taste quiz asks about, in order. */
export const QUIZ = titles("the-office", "interstellar", "knives-out", "ted-lasso", "groundhog-day", "the-martian", "spirited-away", "oceans-eleven")
export const QUIZ_GOAL = 5
export const LEVELS = ["Loved it", "Liked it", "It was fine", "Not for me"]

/** The sample member: shows with a Next episode, shows to start, and Want to See movies. */
export const NEXT_EPISODES = [
	{ title: titleOf("severance"), code: "S2 E4", name: "Woe's Hollow", runtime: "50 min" },
	{ title: titleOf("slow-horses"), code: "S3 E2", name: "Hard Lessons", runtime: "44 min" },
	{ title: titleOf("the-bear"), code: "S2 E7", name: "Forks", runtime: "36 min" },
]
export const nextEpisodeOf = (key: string) => NEXT_EPISODES.find((e) => e.title.key === key) ?? null
export const TO_START = titles("andor", "only-murders", "russian-doll")
export const WISHLIST_MOVIES = titles("arrival", "knives-out", "palm-springs", "spirited-away")
/** A guest's titles: the best rated right now. */
export const POPULAR = titles("paddington-2", "knives-out", "severance", "interstellar")
export const NEW_FOR_YOU = titles("slow-horses", "the-good-place", "glass-onion", "edge-of-tomorrow")

/** Up to four titles for a mood and a kind, best taste match first, narrowed to one service when a streaming key is on. */
export function discover(mood: string | null, kind: Kind | null, service: string | null): Title[] {
	return TITLES.filter((x) => (!mood || x.moods.includes(mood as MoodKey)) && (!kind || x.kind === kind) && (!service || x.service === service))
		.sort((a, b) => b.match - a.match)
		.slice(0, 4)
}

export function search(query: string): Title[] {
	const q = query.toLowerCase()
	const hits = TITLES.filter((x) => `${x.title} ${x.line} ${x.moods.join(" ")} ${islandOf(x.island).name}`.toLowerCase().includes(q.split(" ")[0]))
	return (hits.length ? hits : TITLES).slice(0, 4)
}
export const SEARCH_IDEAS = ["cozy", "heist", "space", "funny"]

/** TMDB ids of the sample titles, for the address of a title page (`/movie/546554-knives-out`). */
const TMDB_ID: Record<string, number> = { "severance": 95396, "knives-out": 546554, "arrival": 329865, "paddington-2": 346648, "the-bear": 136315, "oceans-eleven": 161, "ted-lasso": 97546, "palm-springs": 587792, "russian-doll": 84977, "only-murders": 107113, "interstellar": 157336, "logan-lucky": 399170, "slow-horses": 95480, "the-martian": 286217, "broadchurch": 1427, "edge-of-tomorrow": 137113, "spirited-away": 129, "baby-driver": 339403, "andor": 83867, "groundhog-day": 137, "gilmore-girls": 4586, "the-office": 2316, "the-good-place": 66573, "inside-man": 388, "glass-onion": 661374 }

/** A real page the TV expands into. The addresses are those of the pages with every REC_* flag on. `carries` is what the page keeps from the TV. */
export type Dest = { name: string; href: string; carries?: string }
export const DEST = {
	discover: (mood?: string | null, kind?: string | null): Dest => {
		const q = new URLSearchParams()
		if (mood) q.set("moods", mood)
		if (kind) q.set("type", kind)
		const carries = [mood && moodName(mood), kind === "movie" ? "Movies" : kind === "show" ? "Shows" : null].filter(Boolean).join(", ")
		return { name: "Discover", href: `/discover${q.size ? `?${q}` : ""}`, carries: carries || undefined }
	},
	explorer: (island?: string): Dest => ({ name: "Explorer", href: island ? `/explorer?island=${island}` : "/explorer", carries: island ? `the island ${islandOf(island).name}` : undefined }),
	taste: (): Dest => ({ name: "Taste", href: "/taste" }),
	shows: (): Dest => ({ name: "My shows", href: "/my-shows" }),
	movies: (): Dest => ({ name: "My movies", href: "/my-movies" }),
	title: (x: Title): Dest => ({ name: x.title, href: `/${x.kind}/${TMDB_ID[x.key]}-${x.key}` }),
	search: (q: string): Dest => ({ name: "Search", href: `/discover?q=${encodeURIComponent(q)}`, carries: `the search "${q}"` }),
}
