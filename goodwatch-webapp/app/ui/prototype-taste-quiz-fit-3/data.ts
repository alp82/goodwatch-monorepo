// PROTOTYPE - throwaway (#220 round 3). Mock titles and the in-browser taste for the living room quiz.
// Nothing reads a database and nothing persists.
import type { Score } from "~/server/scores.server"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"

export type QTitle = {
	key: string
	title: string
	year: string
	poster: string
	backdrop: string | null
	genres: string[]
	// A few plain feel words; the taste below is built from them.
	feel: string[]
	gw: number
	runtime: string
	on: string
}

const T = (
	key: string,
	title: string,
	year: string,
	poster: string,
	backdrop: string | null,
	genres: string[],
	feel: string[],
	gw: number,
	runtime: string,
	on: string,
): QTitle => ({
	key,
	title,
	year,
	poster,
	backdrop,
	genres,
	feel,
	gw,
	runtime,
	on,
})

export const TITLES: QTitle[] = [
	T(
		"movie:155",
		"The Dark Knight",
		"2008",
		"/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
		"/9FE5eD92WfVCiivM9Pq9GVSrlWk.jpg",
		["Action", "Crime"],
		["dark", "tense", "crime", "big"],
		90,
		"2h 32m",
		"Max",
	),
	T(
		"movie:27205",
		"Inception",
		"2010",
		"/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
		"/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
		["Science Fiction", "Action"],
		["puzzle", "big", "other worlds"],
		88,
		"2h 28m",
		"Netflix",
	),
	T(
		"show:1396",
		"Breaking Bad",
		"2008",
		"/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg",
		"/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
		["Drama", "Crime"],
		["dark", "tense", "crime", "real life"],
		95,
		"5 seasons",
		"Netflix",
	),
	T(
		"movie:13",
		"Forrest Gump",
		"1994",
		"/Cw4hIUIAmSYfK9QfaUW5igp9La.jpg",
		"/66Kn4XWhkuPkJxOJyPEx4U2CUfN.jpg",
		["Comedy", "Drama"],
		["warm", "heart", "real life"],
		86,
		"2h 22m",
		"Prime Video",
	),
	T(
		"movie:603",
		"The Matrix",
		"1999",
		"/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg",
		"/tlm8UkiQsitc8rSuIAscQDCnP8d.jpg",
		["Action", "Science Fiction"],
		["big", "other worlds", "puzzle"],
		87,
		"2h 16m",
		"Max",
	),
	T(
		"show:1399",
		"Game of Thrones",
		"2011",
		"/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
		"/zZqpAXxVSBtxV9qPBcscfXBcL2w.jpg",
		["Drama", "Fantasy"],
		["other worlds", "dark", "big"],
		84,
		"8 seasons",
		"Max",
	),
	T(
		"movie:157336",
		"Interstellar",
		"2014",
		"/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg",
		"/8sNiAPPYU14PUepFNeSNGUTiHW.jpg",
		["Science Fiction", "Drama"],
		["other worlds", "heart", "big"],
		89,
		"2h 49m",
		"Prime Video",
	),
	T(
		"show:66732",
		"Stranger Things",
		"2016",
		"/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
		"/9P4IIMYY3HifqeruZq0ZZ9g7YUi.jpg",
		["Drama", "Mystery"],
		["other worlds", "tense", "warm"],
		83,
		"4 seasons",
		"Netflix",
	),
	T(
		"movie:496243",
		"Parasite",
		"2019",
		"/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
		"/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg",
		["Thriller", "Drama"],
		["tense", "puzzle", "real life", "dark"],
		92,
		"2h 13m",
		"Max",
	),
	T(
		"movie:807",
		"Se7en",
		"1995",
		"/191nKfP0ehp3uIvWqgPbFmI4lv9.jpg",
		"/i5H7zusQGsysGQ8i6P361Vnr0n2.jpg",
		["Crime", "Mystery"],
		["dark", "tense", "crime"],
		86,
		"2h 7m",
		"Netflix",
	),
	T(
		"movie:8966",
		"Twilight",
		"2008",
		"/3Gkb6jm6962ADUPaCBqzz9CTbn9.jpg",
		"/weAYfu6FfrNxEDJ3xH1XpgQcqUv.jpg",
		["Fantasy", "Romance"],
		["love", "other worlds"],
		52,
		"2h 2m",
		"Prime Video",
	),
	T(
		"movie:11036",
		"The Notebook",
		"2004",
		"/rNzQyW4f8B8cQeg7Dgj3n6eT5k9.jpg",
		"/zdXnJqBaGFVtLoPNuMeKfEYUViZ.jpg",
		["Romance", "Drama"],
		["love", "heart"],
		72,
		"2h 3m",
		"Netflix",
	),
	T(
		"movie:949",
		"Heat",
		"1995",
		"/umSVjVdbVwtx5ryCA2QXL44Durm.jpg",
		"/uI22JkEMediWyiRqhllNqeeGtW0.jpg",
		["Crime", "Thriller"],
		["crime", "tense", "big"],
		87,
		"2h 50m",
		"Disney+",
	),
	T(
		"movie:1949",
		"Zodiac",
		"2007",
		"/6YmeO4pB7XTh8P8F960O1uA14JO.jpg",
		"/3zCPI4JFc54xvLaJ71oI2KoP3az.jpg",
		["Crime", "Mystery"],
		["crime", "puzzle", "dark"],
		84,
		"2h 37m",
		"Prime Video",
	),
	T(
		"movie:670",
		"Oldboy",
		"2003",
		"/pWDtjs568ZfOTMbURQBYuT4Qxka.jpg",
		"/rwf5SUTiEsmfkXAgy15R0UtJUtv.jpg",
		["Thriller", "Mystery"],
		["dark", "tense", "puzzle"],
		85,
		"2h",
		"Netflix",
	),
	T(
		"movie:129",
		"Spirited Away",
		"2001",
		"/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
		"/Ab8mkHmkYADjU7wQiOkia9BzGvS.jpg",
		["Animation", "Fantasy"],
		["other worlds", "warm", "heart"],
		93,
		"2h 5m",
		"Max",
	),
	T(
		"movie:346648",
		"Paddington 2",
		"2017",
		"/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg",
		null,
		["Comedy", "Family"],
		["warm", "laugh", "heart"],
		88,
		"1h 44m",
		"Netflix",
	),
	T(
		"show:2316",
		"The Office",
		"2005",
		"/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg",
		null,
		["Comedy"],
		["laugh", "warm", "real life"],
		86,
		"9 seasons",
		"Prime Video",
	),
	T(
		"movie:546554",
		"Knives Out",
		"2019",
		"/pThyQovXQrw2m0s9x82twj48Jq4.jpg",
		null,
		["Mystery", "Comedy"],
		["puzzle", "laugh", "crime"],
		85,
		"2h 10m",
		"Prime Video",
	),
	T(
		"movie:545611",
		"Everything Everywhere All at Once",
		"2022",
		"/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
		null,
		["Science Fiction", "Comedy"],
		["other worlds", "laugh", "heart"],
		88,
		"2h 19m",
		"Prime Video",
	),
	T(
		"movie:329865",
		"Arrival",
		"2016",
		"/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg",
		null,
		["Science Fiction", "Drama"],
		["quiet", "puzzle", "heart"],
		86,
		"1h 56m",
		"Netflix",
	),
	T(
		"show:136315",
		"The Bear",
		"2022",
		"/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg",
		null,
		["Drama", "Comedy"],
		["real life", "tense", "heart"],
		87,
		"3 seasons",
		"Disney+",
	),
	T(
		"show:95396",
		"Severance",
		"2022",
		"/lFf6LLrQjYldcZItzOkGmMMigP7.jpg",
		null,
		["Drama", "Mystery"],
		["puzzle", "quiet", "dark"],
		90,
		"2 seasons",
		"Apple TV+",
	),
	T(
		"movie:680",
		"Pulp Fiction",
		"1994",
		"/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
		null,
		["Crime", "Thriller"],
		["crime", "laugh", "dark"],
		88,
		"2h 34m",
		"Netflix",
	),
	T(
		"movie:238",
		"The Godfather",
		"1972",
		"/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
		null,
		["Crime", "Drama"],
		["crime", "dark", "big"],
		93,
		"2h 55m",
		"Paramount+",
	),
	T(
		"movie:550",
		"Fight Club",
		"1999",
		"/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
		null,
		["Drama"],
		["dark", "puzzle", "tense"],
		86,
		"2h 19m",
		"Hulu",
	),
	T(
		"movie:244786",
		"Whiplash",
		"2014",
		"/7fn624j5lj3xTme2SgiLCeuedmO.jpg",
		null,
		["Drama", "Music"],
		["tense", "real life"],
		87,
		"1h 47m",
		"Netflix",
	),
	T(
		"movie:419430",
		"Get Out",
		"2017",
		"/tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg",
		null,
		["Horror", "Mystery"],
		["tense", "puzzle", "dark"],
		85,
		"1h 44m",
		"Peacock",
	),
	T(
		"movie:76341",
		"Mad Max: Fury Road",
		"2015",
		"/hA2ple9q4qnwxp3hKVNhroipsir.jpg",
		null,
		["Action"],
		["big", "tense", "other worlds"],
		86,
		"2h 1m",
		"Max",
	),
	T(
		"show:87108",
		"Chernobyl",
		"2019",
		"/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg",
		null,
		["Drama", "History"],
		["real life", "dark", "tense"],
		94,
		"1 season",
		"Max",
	),
	T(
		"show:67070",
		"Fleabag",
		"2016",
		"/27vEYsRKa3eAniwmoccOoluEXQ1.jpg",
		null,
		["Comedy", "Drama"],
		["laugh", "heart", "real life"],
		89,
		"2 seasons",
		"Prime Video",
	),
	T(
		"movie:438631",
		"Dune",
		"2021",
		"/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
		null,
		["Sci-Fi", "Adventure"],
		["other worlds", "big", "quiet"],
		83,
		"2h 35m",
		"Max",
	),
]

export const BY: Record<string, QTitle> = Object.fromEntries(
	TITLES.map((t) => [t.key, t]),
)
export const poster = (t: QTitle, w = "w342") =>
	`https://image.tmdb.org/t/p/${w}${t.poster}`
export const backdrop = (t: QTitle, w = "w780") =>
	t.backdrop ? `https://image.tmdb.org/t/p/${w}${t.backdrop}` : null

// Widely seen first, like smart-titles serves them.
export const RATE_DECK = [
	"movie:155",
	"movie:27205",
	"show:1396",
	"movie:13",
	"movie:603",
	"show:1399",
	"movie:157336",
	"show:66732",
	"movie:496243",
	"show:2316",
	"movie:8966",
	"movie:129",
	"movie:546554",
	"movie:807",
	"movie:11036",
	"movie:346648",
]

// This or that: two well-known titles from opposite ends of one axis. No need to have seen either.
export const PAIRS = [
	{
		a: "movie:807",
		b: "movie:346648",
		left: "Dark and tense",
		right: "Warm and hopeful",
	},
	{
		a: "show:1399",
		b: "show:136315",
		left: "Other worlds",
		right: "Real life",
	},
	{
		a: "show:2316",
		b: "movie:11036",
		left: "Make me laugh",
		right: "Make me feel",
	},
	{
		a: "movie:603",
		b: "movie:329865",
		left: "Big and loud",
		right: "Quiet and close",
	},
	{ a: "movie:27205", b: "movie:13", left: "A puzzle", right: "Easy comfort" },
	{
		a: "movie:546554",
		b: "movie:8966",
		left: "Crime and secrets",
		right: "Love and longing",
	},
]

// ------------------------------------------------------------------ the four levels over the ten scores

export type Band = 0 | 1 | 2 | 3
export const BANDS: {
	name: string
	lo: number
	hi: number
	pick: Score
	hue: string
}[] = [
	{ name: "Dislike", lo: 1, hi: 4, pick: 3, hue: getVibeColorValue(3) },
	{ name: "Okay", lo: 5, hi: 6, pick: 6, hue: getVibeColorValue(6) },
	{ name: "Good", lo: 7, hi: 8, pick: 7, hue: getVibeColorValue(7) },
	{ name: "Great", lo: 9, hi: 10, pick: 9, hue: getVibeColorValue(9) },
]
export const bandOf = (s: number): Band =>
	s <= 4 ? 0 : s <= 6 ? 1 : s <= 8 ? 2 : 3
export const fineOf = (b: Band) =>
	Array.from(
		{ length: BANDS[b].hi - BANDS[b].lo + 1 },
		(_, i) => BANDS[b].lo + i,
	)
export const hue = (s: number) => getVibeColorValue(s as Score)
export const label = (s: number) => scoreLabels[s] ?? ""

// ------------------------------------------------------------------ answers and the taste they make

export type Answer =
	| { key: string; kind: "score"; score: number }
	| { key: string; kind: "want" | "nope" | "skip" }
	| { key: string; kind: "duel"; other: string }

export function tasteOf(answers: Answer[]) {
	const w: Record<string, number> = {}
	const add = (key: string, by: number) => {
		for (const f of BY[key]?.feel ?? []) w[f] = (w[f] ?? 0) + by
	}
	for (const a of answers) {
		if (a.kind === "score") add(a.key, (a.score - 5.5) / 2.25)
		else if (a.kind === "want") add(a.key, 0.9)
		else if (a.kind === "nope") add(a.key, -0.9)
		else if (a.kind === "duel") add(a.key, 1.2), add(a.other, -0.5)
	}
	return w
}

export type Pick = QTitle & { match: number | null; because: string | null }

// The best three not yet answered: the GoodWatch score, pulled toward the answers' feel words.
export function picksFor(
	answers: Answer[],
	n = 3,
	exclude: string[] = [],
): Pick[] {
	const w = tasteOf(answers)
	const has = Object.keys(w).length > 0
	const done = new Set([...answers.map((a) => a.key), ...exclude])
	const loved = answers.filter(
		(a) =>
			(a.kind === "score" && a.score >= 8) ||
			a.kind === "duel" ||
			a.kind === "want",
	)
	return TITLES.filter((t) => !done.has(t.key))
		.map((t) => {
			const aff = t.feel.reduce((s, f) => s + (w[f] ?? 0), 0) / t.feel.length
			const rank = t.gw / 100 + (has ? aff * 0.35 : 0)
			const from = loved
				.map((a) => ({
					a,
					n: BY[a.key].feel.filter((f) => t.feel.includes(f)),
				}))
				.sort((x, y) => y.n.length - x.n.length)[0]
			const because =
				has && from?.n.length
					? `${from.a.kind === "duel" ? "You chose" : from.a.kind === "want" ? "You want" : "You loved"} ${BY[from.a.key].title}: ${from.n.slice(0, 2).join(", ")}`
					: null
			return {
				...t,
				rank,
				match: has
					? Math.max(48, Math.min(97, Math.round(64 + aff * 9)))
					: null,
				because,
			}
		})
		.sort((a, b) => b.rank - a.rank)
		.slice(0, n)
}

export function leanings(answers: Answer[]) {
	return Object.entries(tasteOf(answers))
		.filter(([, v]) => v > 0.4)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([k]) => k)
}
