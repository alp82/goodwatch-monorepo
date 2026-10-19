// The streaming study's four charts: which countries each shows, and the question, answer and note around it. Every
// sentence is built from the data file (scripts/streaming_study.py writes it), so the text and the bars always agree.
import type { BarRow } from "./ranked-bars-layout.ts"

export type CountryCounts = {
	subscription: number
	free_with_ads: number
	library: number
	biggest_service: string | null
	biggest_service_titles: number
	netflix: number
	top_subscription: number
}

export type StudyCountry = {
	code: string
	name: string
	major: boolean
	movies: CountryCounts | null
	shows: CountryCounts | null
	netflix_catalogue: { movies: number; shows: number } | null
}

export type TitleRef = {
	tmdb_id: number
	kind: "movie" | "show"
	title: string
	name: string
	year: number | null
}

export type StudyData = {
	slug: string
	snapshot: { read_at: string; date: string }
	movies: {
		titles: number
		deleted: number
		top_cut: number
		netflix: Record<string, number>
	}
	shows: {
		titles: number
		deleted: number
		top_cut: number
		netflix: Record<string, number>
	}
	countries: StudyCountry[]
	findings: Record<string, number | [number, number] | null>
	lists: {
		ghibli: (TitleRef & { countries: number; netflix: number })[]
		/** Ghibli films licensed apart from the others, such as Grave of the Fireflies. */
		ghibli_apart: (TitleRef & {
			countries: number
			netflix: number
			in_japan: boolean
		})[]
		nowhere: (TitleRef & { first_country: string | null })[]
		widest_best_rated: (TitleRef & { countries: number })[]
		nowhere_indian: TitleRef[]
	}
	/** The CSV files: base is their folder on the site, such as /downloads/<slug>. */
	csv: { base: string; countries: string; titles: string }
}

export type ChartSpec = {
	id: ChartId
	question: string
	answer: string
	note: string
	rows: BarRow[]
	scale: number
	steps: number
	/** Says what the bars show, for a screen reader. */
	description: string
}

export const CHART_IDS = [
	"movies-by-country",
	"one-subscription",
	"netflix",
	"shows-by-country",
] as const
export type ChartId = (typeof CHART_IDS)[number]

export const fmt = (n: number) => n.toLocaleString("en-US")

const FRACTIONS: [number, number][] = [
	[1, 2],
	[1, 3],
	[2, 3],
	[1, 4],
	[3, 4],
	[1, 5],
	[2, 5],
	[3, 5],
	[4, 5],
	[1, 6],
	[1, 7],
	[1, 8],
	[1, 9],
	[1, 10],
	[9, 10],
]

/** A share in words a reader gets at once, such as "about 3 in 4" for 3,478 of 4,683. */
export function aboutShare(part: number, whole: number) {
	const share = whole > 0 ? part / whole : 0
	const [p, q] = FRACTIONS.reduce((best, f) =>
		Math.abs(f[0] / f[1] - share) < Math.abs(best[0] / best[1] - share)
			? f
			: best,
	)
	return `about ${p} in ${q}`
}

/** Countries the CSV has but the charts leave out: very small territories often show a neighbor's catalogue. */
export const majors = (data: StudyData) => data.countries.filter((c) => c.major)

// Charts 2 to 4 show the highest and lowest countries and these, so most readers find their own.
const ALWAYS = ["US", "GB", "DE", "FR", "JP", "IN", "BR"]

export function pickCountries(
	countries: readonly StudyCountry[],
	value: (c: StudyCountry) => number,
	{ top = 8, bottom = 4 } = {},
) {
	const sorted = [...countries].sort(
		(a, b) => value(b) - value(a) || a.code.localeCompare(b.code),
	)
	const chosen = new Set([
		...sorted.slice(0, top).map((c) => c.code),
		...sorted.slice(-bottom).map((c) => c.code),
		...ALWAYS,
	])
	return sorted.filter((c) => chosen.has(c.code))
}

// Pay-TV apps whose film catalogue is mostly other services' titles, sold inside the app as add-ons. Movistar TV
// in Chile: about 97% of its film items are Prime Video, Disney+, HBO Max and Paramount+ titles (its catalogue API,
// read 2026-10-19; docs/launch/streaming-study-proposal.md, hand checks).
export const APPS_OF_OTHER_SERVICES = new Set(["Movistar TV"])

const source = (date: string) => `Source: JustWatch via TMDB, ${date}.`
const SELECTED = "Selected countries."

export function chartSpec(data: StudyData, id: ChartId): ChartSpec {
	const M = data.movies.titles
	const S = data.shows.titles
	const date = data.snapshot.date
	const all = majors(data)
	const byCode = new Map(data.countries.map((c) => [c.code, c]))
	const us = byCode.get("US")
	const movies = (c: StudyCountry) => c.movies?.subscription ?? 0
	const shows = (c: StudyCountry) => c.shows?.subscription ?? 0
	const biggest = (c: StudyCountry) => c.movies?.biggest_service_titles ?? 0
	const netflix = (c: StudyCountry) => c.movies?.netflix ?? 0
	const row = (
		c: StudyCountry,
		value: number,
		extra: Partial<BarRow> = {},
	): BarRow => ({
		code: c.code,
		label: c.name,
		value,
		...extra,
	})

	if (id === "movies-by-country") {
		const sorted = [...all].sort(
			(a, b) => movies(b) - movies(a) || a.code.localeCompare(b.code),
		)
		const first = sorted[0]
		const last = sorted[sorted.length - 1]
		return {
			id,
			question: "How many of these movies can you stream in your country?",
			answer: `${first.name === "United States" ? "The United States" : first.name} leads with ${fmt(movies(first))} of the ${fmt(M)}, ${aboutShare(movies(first), M)}. In ${last.name} it's ${fmt(movies(last))}, ${aboutShare(movies(last), M)}.`,
			note: `${fmt(M)} movies with at least 50,000 IMDb votes, counted when they're on any subscription in that country. ${source(date)}`,
			rows: sorted.map((c) => row(c, movies(c))),
			scale: 4000,
			steps: 2,
			description: `Bar chart of ${sorted.length} countries, highest first: ${sorted
				.slice(0, 3)
				.map((c) => `${c.name} ${fmt(movies(c))}`)
				.join(", ")}. Lowest: ${sorted
				.slice(-3)
				.map((c) => `${c.name} ${fmt(movies(c))}`)
				.join(", ")}.`,
		}
	}

	if (id === "one-subscription") {
		const picked = pickCountries(all, biggest)
		// The answer names the biggest service that is a library of its own. A pay-TV app that shows other services'
		// titles inside it (Movistar TV) is in the bars, with the note saying what its count holds.
		const standalone = picked.find(
			(c) => !APPS_OF_OTHER_SERVICES.has(c.movies?.biggest_service ?? ""),
		)
		const lead = standalone
			? `In ${standalone.name}, ${standalone.movies?.biggest_service} alone carries ${aboutShare(biggest(standalone), M)} of them.`
			: ""
		const apps = picked.filter((c) =>
			APPS_OF_OTHER_SERVICES.has(c.movies?.biggest_service ?? ""),
		)
		const appNote = apps.length
			? ` ${[...new Set(apps.map((c) => c.movies?.biggest_service))].join(" and ")} shows Prime Video, Disney+, HBO Max and Paramount+ titles inside its app; most of its count needs one of those as an add-on.`
			: ""
		return {
			id,
			question:
				"If you kept only one subscription, how many of these movies would you get?",
			answer: us
				? `${lead} In the US, the biggest one has ${fmt(biggest(us))}, ${aboutShare(biggest(us), M)}.`
				: lead,
			note: `The service with the most of the ${fmt(M)} movies in each country. Pay-TV apps such as Movistar TV and Lepsi TV count as subscriptions.${appNote} ${SELECTED} ${source(date)}`,
			rows: picked.map((c) =>
				row(c, biggest(c), { sub: c.movies?.biggest_service }),
			),
			scale: 2000,
			steps: 2,
			description: `Bar chart of ${picked.length} countries, each with its biggest service: ${picked
				.slice(0, 3)
				.map(
					(c) => `${c.name}, ${c.movies?.biggest_service}, ${fmt(biggest(c))}`,
				)
				.join("; ")}.`,
		}
	}

	if (id === "netflix") {
		const withNetflix = all.filter((c) => netflix(c) > 0)
		const picked = pickCountries(withNetflix, netflix)
		const ranked = [...withNetflix].sort(
			(a, b) => netflix(b) - netflix(a) || a.code.localeCompare(b.code),
		)
		const usRank = ranked.findIndex((c) => c.code === "US") + 1
		const first = ranked[0]
		return {
			id,
			question: "How many of these movies are on Netflix in your country?",
			answer: `Netflix ${first.name} has ${fmt(netflix(first))}. Netflix US has ${fmt(us ? netflix(us) : 0)}. That's fewer than Netflix in ${usRank - 1} of the ${ranked.length - 1} other countries we looked at.`,
			note: `${fmt(M)} movies with at least 50,000 IMDb votes. Russia has no Netflix. ${SELECTED} ${source(date)}`,
			rows: picked.map((c) =>
				row(c, netflix(c), { highlight: c.code === "US" }),
			),
			scale: 800,
			steps: 4,
			description: `Bar chart of ${picked.length} countries with the United States highlighted at ${fmt(us ? netflix(us) : 0)}. Highest: ${first.name}, ${fmt(netflix(first))}.`,
		}
	}

	const picked = pickCountries(all, shows, { bottom: 5 })
	const last = picked[picked.length - 1]
	return {
		id,
		question: "How many of these shows can you stream in your country?",
		answer: us
			? `Most of the ${fmt(S)} are easy to find: ${fmt(shows(us))} in the US, ${aboutShare(shows(us), S)}. ${last.name} has ${fmt(shows(last))}.`
			: `${last.name} has ${fmt(shows(last))} of the ${fmt(S)}.`,
		note: `${fmt(S)} shows with at least 50,000 IMDb votes. ${SELECTED} ${source(date)}`,
		rows: picked.map((c) => row(c, shows(c))),
		scale: 800,
		steps: 4,
		description: `Bar chart of ${picked.length} countries: ${picked
			.slice(0, 3)
			.map((c) => `${c.name} ${fmt(shows(c))}`)
			.join(", ")}; lowest ${last.name} ${fmt(shows(last))}.`,
	}
}
