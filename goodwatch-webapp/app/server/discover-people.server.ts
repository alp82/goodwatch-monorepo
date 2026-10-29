// Discover people: featured sitemap cohorts and adult-safe credit aggregates for filtered title results.
// Public credit results share a best-effort Redis cache; viewer state stays in the panel.
import { createHash } from "node:crypto"
import { parsePeopleSitemap } from "~/domain/best-lists"
import { getRedisCluster, withRedisDeadline } from "~/utils/cache"
import { query } from "~/utils/crate"
import { parseTitleKey, type TitleKey } from "~/utils/title-key"
import peopleSitemap from "../../public/sitemaps/sitemap_people.xml?raw"

interface Person {
	tmdb_id: number
	name: string
	profile_path: string | null
	known_for_department: string | null
}
export interface PanelPerson extends Person {
	role: string
	count: number | null
	note: string
}
export interface DiscoverPeople {
	mode: "featured" | "results"
	actors: PanelPerson[]
	crew: PanelPerson[]
}
interface Credit {
	person_tmdb_id: number
	count: number
	job?: string
}
const PEOPLE_TITLES = 100
const JOBS = [
	"Director",
	"Screenplay",
	"Writer",
	"Novel",
	"Original Music Composer",
	"Director of Photography",
]
const roleOf = (job: string) =>
	["Screenplay", "Novel", "Writer"].includes(job) ? "Writer" : job

/** Reject malformed keys before any ID can become a SQL literal. */
function validKeys(keys: readonly TitleKey[]) {
	return [
		...new Set(
			keys.filter((key) => {
				if (!Number.isSafeInteger(key) || key <= 1e12 || key >= 3e12)
					return false
				const { tmdbId } = parseTitleKey(key)
				return Number.isSafeInteger(tmdbId) && tmdbId > 0
			}),
		),
	]
}

/** Public title sets alone identify public credit aggregates, including for a member's filtered list. */
export function peopleCacheKey(keys: readonly TitleKey[]) {
	const sorted = validKeys(keys).slice(0, PEOPLE_TITLES).sort((a, b) => a - b)
	return `discover-people:v1:${createHash("sha256").update(JSON.stringify(sorted)).digest("base64url")}`
}

/** Two grouped reads per nonempty kind, followed by one adult-safe person read. */
export async function readPeopleInResults(
	keys: readonly TitleKey[],
	run: typeof query = query,
): Promise<DiscoverPeople> {
	const safe = validKeys(keys).slice(0, PEOPLE_TITLES)
	const groups = await Promise.all(
		(["movie", "show"] as const).map(async (kind) => {
			const ids = safe.flatMap((key) => {
				const parsed = parseTitleKey(key)
				return parsed.mediaType === kind ? [parsed.tmdbId] : []
			})
			if (!ids.length) return { actors: [], crew: [] }
			// Like legacyTitles: only parsed positive integer IDs are inlined; values stay bound.
			const where = `media_type = ? AND media_tmdb_id IN (${ids.join(",")})`
			const [actors, crew] = await Promise.all([
				run<Credit>(
					`SELECT person_tmdb_id, COUNT(*) AS count FROM person_appeared_in WHERE ${where} AND order_default < 15 GROUP BY person_tmdb_id ORDER BY 2 DESC LIMIT 60`,
					[kind],
				),
				run<Credit>(
					`SELECT person_tmdb_id, job, COUNT(*) AS count FROM person_worked_on WHERE ${where} AND job IN (${JOBS.map(() => "?").join(",")}) GROUP BY person_tmdb_id, job ORDER BY 3 DESC LIMIT 60`,
					[kind, ...JOBS],
				),
			])
			return { actors, crew }
		}),
	)
	const aggregate = (credits: Credit[], acting: boolean) => {
		const totals = new Map<
			string,
			{ id: number; role: string; count: number }
		>()
		for (const credit of credits) {
			const role = acting ? "Actor" : roleOf(credit.job ?? "")
			const id = Number(credit.person_tmdb_id)
			if (!Number.isSafeInteger(id) || id <= 0) continue
			const key = `${id}:${role}`
			const row = totals.get(key) ?? { id, role, count: 0 }
			row.count += Number(credit.count)
			totals.set(key, row)
		}
		return [...totals.values()].sort(
			(a, b) =>
				b.count - a.count || a.id - b.id || a.role.localeCompare(b.role),
		)
	}
	const actors = aggregate(
		groups.flatMap((group) => group.actors),
		true,
	)
	const crew = aggregate(
		groups.flatMap((group) => group.crew),
		false,
	)
	const ids = [...new Set([...actors, ...crew].map((row) => row.id))]
	const people = ids.length
		? await run<Person>(
				`SELECT tmdb_id, name, profile_path, known_for_department FROM person WHERE adult = false AND tmdb_id IN (${ids.join(",")}) LIMIT ${ids.length}`,
			)
		: []
	const byId = new Map(people.map((person) => [Number(person.tmdb_id), person]))
	const rows = (credits: typeof actors, acting: boolean) => {
		const seen = new Set<number>()
		return credits
			.flatMap(({ id, role, count }): PanelPerson[] => {
				const person = byId.get(id)
				if (!person || seen.has(id)) return []
				seen.add(id)
				return [
					{
						...person,
						role,
						count,
						note: acting
							? `${count} ${count === 1 ? "title" : "titles"}`
							: `${role} · ${count}`,
					},
				]
			})
			.slice(0, 10)
	}
	return {
		mode: "results",
		actors: rows(actors, true),
		crew: rows(crew, false),
	}
}

const loading = new Map<string, Promise<DiscoverPeople>>()
export function peopleInResults(
	keys: readonly TitleKey[],
): Promise<DiscoverPeople> {
	if (!keys.length)
		return Promise.resolve({ mode: "results", actors: [], crew: [] })
	const key = peopleCacheKey(keys)
	const pending = loading.get(key)
	if (pending) return pending
	const load = (async () => {
		const redis = getRedisCluster()
		try {
			const hit = redis && (await withRedisDeadline(redis.get(key)))
			if (hit) return JSON.parse(hit) as DiscoverPeople
		} catch {
			/* Cache failures fall through to the read. */
		}
		const result = await readPeopleInResults(keys)
		if (redis) {
			void withRedisDeadline(
				redis.set(key, JSON.stringify(result), "EX", 30 * 60),
			).catch(() => {})
		}
		return result
	})().finally(() => loading.delete(key))
	loading.set(key, load)
	return load
}

/** Preserve the people list's sitemap order within each department. */
export function selectFeaturedPeople(
	people: readonly Person[],
): DiscoverPeople {
	const pick = (department: string, limit: number, role: string) =>
		people
			.filter((person) => person.known_for_department === department)
			.slice(0, limit)
			.map((person) => ({ ...person, role, count: null, note: role }))
	const other = people
		.filter(
			(person) =>
				person.known_for_department &&
				!["Acting", "Directing", "Writing"].includes(
					person.known_for_department,
				),
		)
		.slice(0, 2)
		.map((person) => ({
			...person,
			role: person.known_for_department!,
			count: null,
			note: person.known_for_department!,
		}))
	return {
		mode: "featured",
		actors: pick("Acting", 8, "Actor"),
		crew: [
			...pick("Directing", 4, "Director"),
			...pick("Writing", 4, "Writer"),
			...other,
		],
	}
}

let featured: Promise<DiscoverPeople> | undefined
export function featuredPeople(): Promise<DiscoverPeople> {
	featured ??= (async () => {
		// Equivalent to getListPeople's cohort and ordering, without loading titles and known-for credits.
		const ids = [...parsePeopleSitemap(peopleSitemap).keys()]
		const people = await query<Person>(
			`SELECT tmdb_id, name, profile_path, known_for_department FROM person WHERE adult = false AND tmdb_id IN (${ids.join(",")}) LIMIT ${ids.length}`,
		)
		const byId = new Map(
			people.map((person) => [Number(person.tmdb_id), person]),
		)
		return selectFeaturedPeople(ids.flatMap((id) => byId.get(id) ?? []))
	})().catch((error) => {
		featured = undefined
		throw error
	})
	return featured
}
