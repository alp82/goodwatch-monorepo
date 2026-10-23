import type { TastePerson, TasteStats } from "../../domain/profile-taste.ts"
// The numbers of a profile's Taste tab (genres, people, eras, world, tags, facts, rating style, badges) from plain
// per-title records. Pure: taste-stats.server.ts reads the records from Crate and the member's data.
import type { ProfileTitle } from "../../domain/profile.ts"

import type { TitleKind as Kind } from "../../domain/taste-attributes.ts"

export type { Kind }

/** One title the member rated or watched, with what the stats read. */
export interface StatsTitle {
	title: ProfileTitle
	kind: Kind
	/** The member's score, 1 to 10; null for a title watched but not rated. */
	score: number | null
	genres: string[]
	/** Minutes: a movie's runtime, a show's usual episode runtime. */
	runtime: number | null
	budget: number | null
	revenue: number | null
	countries: string[]
	language: string | null
	essence: string[]
	tropes: string[]
	/** Shows: regular episodes watched in the current pass. */
	episodesWatched: number
}

export interface StatsCredit {
	personId: number
	/** The title's key ("movie-550"). */
	key: string
	role: "director" | "actor" | "composer" | "writer"
}

export interface StatsPerson {
	id: number
	name: string
	profile: string | null
}

export interface StatsInput {
	titles: StatsTitle[]
	credits: StatsCredit[]
	people: ReadonlyMap<number, StatsPerson>
	/** Shows in the state Watching. */
	watching: number
	/** The current year, for "classics" (25 years or older). */
	year: number
}

export const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]) =>
	values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0
const byScore = (a: StatsTitle, b: StatsTitle) =>
	(b.score ?? 0) - (a.score ?? 0) || (b.title.year ?? 0) - (a.title.year ?? 0)
const withPoster = (t: StatsTitle) => t.title.poster !== null

/** The people with the most titles in a role, up to `top`, each with their best titles. Needs at least 2 titles. */
export function rankPeople(
	input: StatsInput,
	role: StatsCredit["role"],
	top: number,
	order: "count" | "average" = "count",
	minimum = order === "average" ? 3 : 2,
): TastePerson[] {
	const byKey = new Map(input.titles.map((t) => [t.title.key, t]))
	const titlesOf = new Map<number, StatsTitle[]>()
	for (const credit of input.credits) {
		if (credit.role !== role) continue
		const title = byKey.get(credit.key)
		if (!title || title.score === null) continue
		const own = titlesOf.get(credit.personId) ?? []
		if (!own.includes(title)) own.push(title)
		titlesOf.set(credit.personId, own)
	}
	const ranked = [...titlesOf.entries()]
		.filter(([id, titles]) => titles.length >= minimum && input.people.has(id))
		.map(([id, titles]) => ({
			id,
			titles,
			average: mean(titles.map((t) => t.score ?? 0)),
		}))
		.sort((a, b) =>
			order === "count"
				? b.titles.length - a.titles.length ||
					b.average - a.average ||
					a.id - b.id
				: b.average - a.average ||
					b.titles.length - a.titles.length ||
					a.id - b.id,
		)
		.slice(0, top)
	return ranked.map(({ id, titles, average }) => {
		const person = input.people.get(id) as StatsPerson
		return {
			id,
			name: person.name,
			profile: person.profile,
			count: titles.length,
			average: round1(average),
			hours: round1(
				titles.reduce(
					(s, t) => s + (t.title.mediaType === "movie" ? (t.runtime ?? 0) : 0),
					0,
				) / 60,
			),
			titles: [...titles]
				.sort(byScore)
				.filter(withPoster)
				.slice(0, 6)
				.map((t) => t.title),
		}
	})
}

export function tasteStats(input: StatsInput): TasteStats {
	const rated = input.titles.filter((t) => t.score !== null)
	const scores = rated.map((t) => t.score as number)

	// Genres: a title counts once for each of its genres.
	const genre = new Map<
		string,
		{ count: number; sum: number; kinds: Partial<Record<Kind, number>> }
	>()
	for (const t of rated)
		for (const name of t.genres) {
			const g = genre.get(name) ?? { count: 0, sum: 0, kinds: {} }
			g.count++
			g.sum += t.score as number
			g.kinds[t.kind] = (g.kinds[t.kind] ?? 0) + 1
			genre.set(name, g)
		}
	const genres = [...genre.entries()]
		.map(([name, g]) => ({
			name,
			count: g.count,
			average: round1(g.sum / g.count),
			kinds: g.kinds,
		}))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

	// Eras.
	const decade = new Map<number, number[]>()
	for (const t of rated)
		if (t.title.year) {
			const d = Math.floor(t.title.year / 10) * 10
			decade.set(d, [...(decade.get(d) ?? []), t.score as number])
		}
	const years = rated.flatMap((t) => (t.title.year ? [t.title.year] : []))
	const classics = rated
		.filter(
			(t) =>
				t.title.year !== null &&
				t.title.year <= input.year - 25 &&
				(t.score ?? 0) >= 9 &&
				withPoster(t),
		)
		.sort(
			(a, b) =>
				(b.score ?? 0) - (a.score ?? 0) ||
				(a.title.year ?? 0) - (b.title.year ?? 0),
		)
		.slice(0, 14)
		.map((t) => t.title)

	// World: a co-production counts for each country.
	const country = new Map<string, number[]>()
	const language = new Map<string, number>()
	for (const t of rated) {
		for (const code of new Set(t.countries))
			country.set(code, [...(country.get(code) ?? []), t.score as number])
		if (t.language)
			language.set(t.language, (language.get(t.language) ?? 0) + 1)
	}

	// Tags from the titles scored 8 or more.
	const essence = new Map<string, number[]>()
	const trope = new Map<string, number>()
	for (const t of rated) {
		if ((t.score ?? 0) < 8) continue
		for (const tag of new Set(t.essence))
			essence.set(tag, [...(essence.get(tag) ?? []), t.score as number])
		for (const name of new Set(t.tropes))
			trope.set(name, (trope.get(name) ?? 0) + 1)
	}

	// Facts over everything watched or rated.
	const movies = input.titles.filter((t) => t.title.mediaType === "movie")
	const timed = movies.filter((t) => (t.runtime ?? 0) >= 40)
	const dated = input.titles.filter((t) => t.title.year !== null)
	const pick = <T>(list: T[], better: (a: T, b: T) => boolean) =>
		list.reduce<T | null>(
			(best, t) => (best === null || better(t, best) ? t : best),
			null,
		)
	const longest = pick(timed, (a, b) => (a.runtime ?? 0) > (b.runtime ?? 0))
	const shortest = pick(timed, (a, b) => (a.runtime ?? 0) < (b.runtime ?? 0))
	const oldest = pick(
		dated,
		(a, b) => (a.title.year ?? 0) < (b.title.year ?? 0),
	)
	const newest = pick(
		dated,
		(a, b) => (a.title.year ?? 0) > (b.title.year ?? 0),
	)
	const episodic = pick(
		input.titles.filter(
			(t) => t.title.mediaType === "show" && t.episodesWatched > 0,
		),
		(a, b) => a.episodesWatched > b.episodesWatched,
	)

	// Rating style against the GoodWatch score.
	const crowd = rated.filter((t) => t.title.gw !== null)
	const offset = mean(
		crowd.map((t) => (t.score as number) - (t.title.gw as number) / 10),
	)
	const label = offset > 0.4 ? "Generous" : offset < -0.4 ? "Tough" : "Balanced"
	const kindScores = new Map<Kind, number[]>()
	for (const t of rated)
		kindScores.set(t.kind, [
			...(kindScores.get(t.kind) ?? []),
			t.score as number,
		])
	const byKind: Partial<Record<Kind, number>> = {}
	for (const [kind, list] of kindScores) byKind[kind] = round1(mean(list))
	const steady = genres.filter((g) => g.count >= 15)
	const kindest = steady.length
		? steady.reduce((a, b) => (b.average > a.average ? b : a))
		: null
	const harshest = steady.length
		? steady.reduce((a, b) => (b.average < a.average ? b : a))
		: null

	// Badges.
	const badges: TasteStats["badges"] = []
	if (rated.length) {
		const movieShare =
			rated.filter((t) => t.title.mediaType === "movie").length / rated.length
		badges.push({
			id: "medium",
			name:
				movieShare > 0.65
					? "Movie person"
					: movieShare < 0.35
						? "Series person"
						: "Best of both",
			line: `${Math.round(movieShare * 100)}% of rated titles are movies`,
		})
	}
	const averageYear = years.length ? Math.round(mean(years)) : null
	if (averageYear !== null)
		badges.push({
			id: "era",
			name:
				averageYear < 2005
					? "Time traveler"
					: averageYear > 2015
						? "Fresh hunter"
						: "Modern classicist",
			line: `Titles average ${averageYear}`,
		})
	if (crowd.length >= 10)
		badges.push({
			id: "style",
			name:
				label === "Generous"
					? "Big heart"
					: label === "Tough"
						? "Tough crowd"
						: "Fair judge",
			line:
				Math.abs(offset) < 0.1
					? "Scores right in line with the crowd"
					: `${Math.abs(offset).toFixed(1)} points ${offset > 0 ? "above" : "below"} the crowd`,
		})
	const anime = kindScores.get("anime") ?? []
	if (anime.length >= 10)
		badges.push({
			id: "anime",
			name: "Anime regular",
			line: `${anime.length} anime rated, averaging ${round1(mean(anime))}`,
		})
	if (input.watching >= 4)
		badges.push({
			id: "plates",
			name: "Plate spinner",
			line: `${input.watching} shows on the go`,
		})

	const budgets = movies.filter((t) => (t.budget ?? 0) > 0)
	return {
		genres: genres.slice(0, 14),
		people: {
			directors: rankPeople(input, "director", 8),
			bestDirectors: rankPeople(input, "director", 6, "average"),
			actors: rankPeople(input, "actor", 10),
			composers: rankPeople(input, "composer", 6),
			writers: rankPeople(input, "writer", 6),
		},
		eras: {
			decades: [...decade.entries()]
				.sort((a, b) => a[0] - b[0])
				.map(([d, list]) => ({
					decade: d,
					count: list.length,
					average: round1(mean(list)),
				})),
			averageYear,
			classics,
		},
		world: {
			countries: [...country.entries()]
				.map(([code, list]) => ({
					code,
					count: list.length,
					share: Math.round((list.length / rated.length) * 1000) / 1000,
					average: round1(mean(list)),
				}))
				.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
				.slice(0, 12),
			totalCountries: country.size,
			languages: [...language.entries()]
				.map(([code, count]) => ({ code, count }))
				.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
				.slice(0, 8),
			totalLanguages: language.size,
		},
		tags: {
			essence: [...essence.entries()]
				.map(([name, list]) => ({
					name,
					count: list.length,
					average: round1(mean(list)),
				}))
				.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
				.slice(0, 28),
			tropes: [...trope.entries()]
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
				.slice(0, 28),
		},
		facts: {
			budget: budgets.reduce((s, t) => s + (t.budget ?? 0), 0),
			revenue: movies.reduce((s, t) => s + (t.revenue ?? 0), 0),
			longest: longest
				? { ...longest.title, minutes: longest.runtime ?? undefined }
				: null,
			shortest: shortest
				? { ...shortest.title, minutes: shortest.runtime ?? undefined }
				: null,
			oldest: oldest?.title ?? null,
			newest: newest?.title ?? null,
			mostEpisodes: episodic
				? { ...episodic.title, episodes: episodic.episodesWatched }
				: null,
			averageRuntime: timed.length
				? Math.round(mean(timed.map((t) => t.runtime as number)))
				: null,
		},
		style: {
			average: round1(mean(scores)),
			crowdAverage: round1(mean(crowd.map((t) => (t.title.gw as number) / 10))),
			offset: Math.round(offset * 100) / 100,
			label,
			share8: scores.length
				? Math.round(
						(scores.filter((s) => s >= 8).length / scores.length) * 100,
					) / 100
				: 0,
			byKind,
			kindest: kindest
				? { genre: kindest.name, average: kindest.average }
				: null,
			harshest: harshest
				? { genre: harshest.name, average: harshest.average }
				: null,
		},
		badges,
	}
}
