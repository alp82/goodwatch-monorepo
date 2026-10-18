// Prototype only (branch prototype/best-of-lists): the sitemap cohort read from the committed sitemap files, joined
// with Crate for the cards. The production build reads the same files.
import { readFile } from "node:fs/promises"
import path from "node:path"
import { query } from "~/utils/crate"

export interface CohortTitle {
	id: number
	type: "movie" | "show"
	/** The sitemap's own address, so a list link never needs a redirect. */
	href: string
	core: boolean
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	release_year: number | null
	poster_path: string | null
	genres: string[]
	goodwatch_overall_score_normalized_percent: number | null
	goodwatch_overall_score_voting_count: number | null
}

export interface CohortPerson {
	id: number
	href: string
	name: string
	profile_path: string | null
	department: string | null
	/** Cohort titles where the person is in the top-5 cast or directed, most-rated first. */
	knownFor: CohortTitle[]
	knownForCount?: number
}

const SITEMAPS = path.join(process.cwd(), "public/sitemaps")

const locs = (xml: string) =>
	[...xml.matchAll(/<loc>https:\/\/goodwatch\.app(\/[^<]+)<\/loc>/g)].map(
		(m) => m[1],
	)

async function cohortOf(type: "movie" | "show") {
	const xml = await readFile(
		path.join(SITEMAPS, `sitemap_${type}_detail_0.xml`),
		"utf8",
	)
	const state = JSON.parse(
		/<!--goodwatch-selection (.*?)-->/.exec(xml)?.[1] ?? "{}",
	) as { core: number[]; attention: number[] }
	const hrefs = new Map(
		locs(xml).map((href) => [Number(/\/(\d+)/.exec(href)?.[1]), href]),
	)
	return { core: new Set(state.core), hrefs }
}

let cached: Promise<{
	movies: CohortTitle[]
	shows: CohortTitle[]
	people: CohortPerson[]
}> | null = null

export const loadCohort = () => {
	cached ??= readCohort().catch((error) => {
		cached = null
		throw error
	})
	return cached
}

async function readCohort() {
	const lists = await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const { core, hrefs } = await cohortOf(type)
			const rows = await query<
				Omit<CohortTitle, "id" | "type" | "href" | "core">
			>(
				`SELECT tmdb_id, title, release_year, poster_path, genres,
				        goodwatch_overall_score_normalized_percent, goodwatch_overall_score_voting_count
				   FROM ${type} WHERE tmdb_id = ANY(?)`,
				[[...hrefs.keys()] as never],
			)
			return rows.map(
				(row): CohortTitle => ({
					...row,
					genres: row.genres ?? [],
					id: row.tmdb_id,
					type,
					media_type: type,
					href: hrefs.get(row.tmdb_id) as string,
					core: core.has(row.tmdb_id),
				}),
			)
		}),
	)
	const [movies, shows] = lists

	const peopleXml = await readFile(
		path.join(SITEMAPS, "sitemap_people.xml"),
		"utf8",
	)
	const peopleHrefs = new Map(
		locs(peopleXml).map((href) => [Number(/\/(\d+)/.exec(href)?.[1]), href]),
	)
	const ids = [...peopleHrefs.keys()]
	const people = await query<{
		tmdb_id: number
		name: string
		profile_path: string | null
		known_for_department: string | null
	}>(
		"SELECT tmdb_id, name, profile_path, known_for_department FROM person WHERE tmdb_id = ANY(?)",
		[ids as never],
	)
	const titleByKey = new Map(
		[...movies, ...shows].map((t) => [`${t.type}:${t.id}`, t]),
	)
	const credits = new Map<number, Set<string>>()
	for (const [table, role] of [
		["person_appeared_in", "order_default >= 0 AND order_default < 5"],
		["person_worked_on", "job = 'Director'"],
	]) {
		const rows = await query<{
			pid: number
			media_type: string
			mid: number
		}>(
			`SELECT person_tmdb_id AS pid, media_type, media_tmdb_id AS mid FROM ${table}
			  WHERE person_tmdb_id = ANY(?) AND ${role} LIMIT 20000`,
			[ids as never],
		)
		for (const r of rows) {
			const key = `${r.media_type}:${r.mid}`
			if (!titleByKey.has(key)) continue
			if (!credits.has(r.pid)) credits.set(r.pid, new Set())
			credits.get(r.pid)?.add(key)
		}
	}
	const byId = new Map(people.map((p) => [p.tmdb_id, p]))
	const cohortPeople = ids.flatMap((id): CohortPerson[] => {
		const p = byId.get(id)
		if (!p) return []
		const knownFor = [...(credits.get(id) ?? [])]
			.map((key) => titleByKey.get(key) as CohortTitle)
			.sort(
				(a, b) =>
					(b.goodwatch_overall_score_voting_count ?? 0) -
					(a.goodwatch_overall_score_voting_count ?? 0),
			)
		return [
			{
				id,
				href: peopleHrefs.get(id) as string,
				name: p.name,
				profile_path: p.profile_path,
				department: p.known_for_department,
				knownFor,
			},
		]
	})
	return { movies, shows, people: cohortPeople }
}
