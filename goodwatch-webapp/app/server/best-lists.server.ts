import {
	type TitleKind,
	parsePeopleSitemap,
	parseTitleSitemap,
	rankTitles,
} from "~/domain/best-lists"
import { query } from "~/utils/crate"
import type { PresentedMedia } from "~/utils/media-presentation"
// The data of the best-of lists and the people list (domain/best-lists.ts): the sitemap cohort joined with the catalog.
// The sitemap files are bundled into the server build, so a deploy lists exactly the files it ships under /sitemaps/.
import movieSitemap from "../../public/sitemaps/sitemap_movie_detail_0.xml?raw"
import peopleSitemap from "../../public/sitemaps/sitemap_people.xml?raw"
import showSitemap from "../../public/sitemaps/sitemap_show_detail_0.xml?raw"

/** A list entry. The loader's title overlay adds the viewer's language (`presentation`). */
export interface ListTitle extends PresentedMedia {
	tmdb_id: number
	media_type: TitleKind
	title: string
	release_year: number | null
	poster_path: string | null
	/** The first two. */
	genres: string[]
	goodwatch_overall_score_normalized_percent: number | null
	/** The sitemap's address of the title. */
	path: string
}

export interface ListPerson {
	tmdb_id: number
	name: string
	profile_path: string | null
	department: string | null
	path: string
	/** Up to four of the person's cohort titles (top-five billing or director), most-rated first. */
	knownFor: (PresentedMedia & {
		tmdb_id: number
		media_type: TitleKind
		title: string
		path: string
	})[]
	/** How many cohort titles the person has in all. */
	knownForCount: number
}

export interface RankedList {
	titles: ListTitle[]
	/** Of them, the titles chosen because they are popular right now. */
	popular: number
}

const KNOWN_FOR = 4
// Scores move daily at most; the page cache in front keeps the pages themselves.
const LIFETIME_MS = 60 * 60 * 1000

const cohorts = {
	movie: parseTitleSitemap(movieSitemap, "movie"),
	show: parseTitleSitemap(showSitemap, "show"),
}
const peoplePaths = parsePeopleSitemap(peopleSitemap)

interface TitleRow {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	genres: string[] | null
	goodwatch_overall_score_normalized_percent: number | null
	goodwatch_overall_score_voting_count: number | null
}

async function readTitles(kind: TitleKind) {
	const { paths } = cohorts[kind]
	return query<TitleRow>(
		`SELECT tmdb_id, title, release_year, poster_path, genres,
		        goodwatch_overall_score_normalized_percent, goodwatch_overall_score_voting_count
		   FROM ${kind} WHERE tmdb_id = ANY(?)`,
		// node-crate sends arrays as JSON arrays; its parameter type only names scalars.
		[[...paths.keys()] as never],
	)
}

async function readLists() {
	const [movieRows, showRows] = await Promise.all([
		readTitles("movie"),
		readTitles("show"),
	])
	const lists = {} as Record<TitleKind, RankedList>
	const votes = new Map<string, number>()
	const titles = new Map<string, ListTitle>()
	for (const [kind, rows] of [
		["movie", movieRows],
		["show", showRows],
	] as const) {
		const { paths, attention } = cohorts[kind]
		// A title the catalog no longer has is left out; the sitemap's next run drops it too.
		const ranked = rankTitles(rows).map(
			(row): ListTitle => ({
				tmdb_id: row.tmdb_id,
				media_type: kind,
				title: row.title,
				release_year: row.release_year,
				poster_path: row.poster_path,
				genres: (row.genres ?? []).slice(0, 2),
				goodwatch_overall_score_normalized_percent:
					row.goodwatch_overall_score_normalized_percent,
				path: paths.get(row.tmdb_id) as string,
			}),
		)
		for (const row of rows)
			votes.set(
				`${kind}:${row.tmdb_id}`,
				row.goodwatch_overall_score_voting_count ?? 0,
			)
		for (const title of ranked) titles.set(`${kind}:${title.tmdb_id}`, title)
		lists[kind] = {
			titles: ranked,
			popular: ranked.filter((t) => attention.has(t.tmdb_id)).length,
		}
	}
	return { lists, people: await readPeople(titles, votes) }
}

// The same credits the sitemap's person selection counts (scripts/sitemap_people.py).
async function readPeople(
	titles: Map<string, ListTitle>,
	votes: Map<string, number>,
): Promise<ListPerson[]> {
	const ids = [...peoplePaths.keys()]
	const [people, cast, directed] = await Promise.all([
		query<{
			tmdb_id: number
			name: string
			profile_path: string | null
			known_for_department: string | null
		}>(
			"SELECT tmdb_id, name, profile_path, known_for_department FROM person WHERE tmdb_id = ANY(?)",
			[ids as never],
		),
		query<{ pid: number; media_type: string; mid: number }>(
			`SELECT person_tmdb_id AS pid, media_type, media_tmdb_id AS mid FROM person_appeared_in
			  WHERE person_tmdb_id = ANY(?) AND order_default >= 0 AND order_default < 5 LIMIT 50000`,
			[ids as never],
		),
		query<{ pid: number; media_type: string; mid: number }>(
			`SELECT person_tmdb_id AS pid, media_type, media_tmdb_id AS mid FROM person_worked_on
			  WHERE person_tmdb_id = ANY(?) AND job = 'Director' LIMIT 50000`,
			[ids as never],
		),
	])
	const credits = new Map<number, Set<string>>()
	for (const credit of [...cast, ...directed]) {
		const key = `${credit.media_type}:${credit.mid}`
		if (!titles.has(key)) continue
		const own = credits.get(credit.pid) ?? new Set<string>()
		own.add(key)
		credits.set(credit.pid, own)
	}
	const byId = new Map(people.map((p) => [p.tmdb_id, p]))
	return ids.flatMap((id): ListPerson[] => {
		const person = byId.get(id)
		if (!person) return []
		const keys = [...(credits.get(id) ?? [])].sort(
			(a, b) => (votes.get(b) ?? 0) - (votes.get(a) ?? 0) || a.localeCompare(b),
		)
		return [
			{
				tmdb_id: id,
				name: person.name,
				profile_path: person.profile_path,
				department: person.known_for_department,
				path: peoplePaths.get(id) as string,
				knownFor: keys.slice(0, KNOWN_FOR).map((key) => {
					const t = titles.get(key) as ListTitle
					return {
						tmdb_id: t.tmdb_id,
						media_type: t.media_type,
						title: t.title,
						path: t.path,
					}
				}),
				knownForCount: keys.length,
			},
		]
	})
}

let cached: { at: number; value: ReturnType<typeof readLists> } | null = null

function lists() {
	if (!cached || Date.now() - cached.at > LIFETIME_MS) {
		const value = readLists()
		cached = { at: Date.now(), value }
		// A failed read is tried again on the next request, not kept for an hour.
		value.catch(() => {
			if (cached?.value === value) cached = null
		})
	}
	return cached.value
}

/** The cohort's movies or shows, best first. */
export const getRankedList = async (kind: TitleKind) =>
	(await lists()).lists[kind]

/** The cohort's people, in the sitemap's order. */
export const getListPeople = async () => (await lists()).people
