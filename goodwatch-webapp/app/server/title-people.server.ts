import { canonicalTitleId } from "../utils/title-identity"
import {
	type CastRaw,
	type CrewRaw,
	type PeopleData,
	type PeopleParams,
	buildCast,
	buildCrew,
	peoplePage,
} from "../utils/title-people"
import { applyCorrections } from "./feedback/apply-corrections.server"

type TitlePeopleKey = Pick<PeopleParams, "type" | "id" | "kind">

type Query = typeof import("~/utils/crate").query
type CastCredit = Omit<
	CastRaw,
	"id" | "name" | "profile_path" | "popularity"
> & {
	person_tmdb_id: number
	credit_id: string
}
type CrewCredit = Omit<
	CrewRaw,
	"id" | "name" | "profile_path" | "popularity"
> & {
	person_tmdb_id: number
	credit_id: string
}
type Person = Pick<CastRaw, "name" | "profile_path" | "popularity"> & {
	tmdb_id: number
}

// Import the database client only on a cache miss. Tests supply an offline reader.
const readPeopleQuery: Query = async (sql, params) => {
	const { query } = await import("~/utils/crate")
	return query(sql, params)
}

export async function fetchTitleCastCredits(
	{ type, id }: TitlePeopleKey,
	query = readPeopleQuery,
) {
	return query<CastCredit>(
		`SELECT person_tmdb_id, character, credit_id, order_default, episode_count_character, episode_count_total
FROM person_appeared_in WHERE media_type = ? AND media_tmdb_id = ? LIMIT 100000`,
		[type, id],
	)
}

export async function fetchTitleCrewCredits(
	{ type, id }: TitlePeopleKey,
	query = readPeopleQuery,
) {
	return query<CrewCredit>(
		`SELECT person_tmdb_id, job, department, credit_id, episode_count_job, episode_count_total
FROM person_worked_on WHERE media_type = ? AND media_tmdb_id = ? LIMIT 100000`,
		[type, id],
	)
}

export async function fetchPeopleByIds(ids: number[], query = readPeopleQuery) {
	const distinct = [...new Set(ids)]
	const people = new Map<number, Person>()
	for (let offset = 0; offset < distinct.length; offset += 5000) {
		const rows = await query<Person>(
			"SELECT tmdb_id, name, profile_path, popularity FROM person WHERE tmdb_id = ANY(?) LIMIT 100000",
			// Crate accepts an array parameter, though the query helper's type omits it.
			[distinct.slice(offset, offset + 5000) as never],
		)
		for (const person of rows) people.set(person.tmdb_id, person)
	}
	return people
}

function joinCredits<T extends CastCredit | CrewCredit>(
	credits: T[],
	people: Map<number, Person>,
) {
	return credits.flatMap((credit) => {
		const person = people.get(credit.person_tmdb_id)
		return person ? [{ ...credit, ...person, id: person.tmdb_id }] : []
	})
}

export async function fetchTitleCast(
	key: TitlePeopleKey,
	query = readPeopleQuery,
): Promise<CastRaw[]> {
	const credits = await fetchTitleCastCredits(key, query)
	const people = await fetchPeopleByIds(
		credits.map((credit) => credit.person_tmdb_id),
		query,
	)
	return joinCredits(credits, people)
}

export async function fetchTitleCrew(
	key: TitlePeopleKey,
	query = readPeopleQuery,
): Promise<CrewRaw[]> {
	const credits = await fetchTitleCrewCredits(key, query)
	const people = await fetchPeopleByIds(
		credits.map((credit) => credit.person_tmdb_id),
		query,
	)
	return joinCredits(credits, people)
}

export async function fetchShowEpisodes(id: number): Promise<number | null> {
	const { query } = await import("~/utils/crate")
	const rows = await query<{ number_of_episodes: number | null }>(
		"SELECT number_of_episodes FROM show WHERE tmdb_id = ? LIMIT 1",
		[id],
	)
	return rows[0]?.number_of_episodes ?? null
}

async function fetchTitlePeople(key: TitlePeopleKey): Promise<PeopleData> {
	const episodes =
		key.type === "show" ? fetchShowEpisodes(key.id) : Promise.resolve(null)
	if (key.kind === "cast") {
		const [rows, showEpisodes] = await Promise.all([
			fetchTitleCast(key),
			episodes,
		])
		return buildCast(key.type, rows, showEpisodes)
	}
	const [rows, showEpisodes] = await Promise.all([
		fetchTitleCrew(key),
		episodes,
	])
	return buildCrew(key.type, rows, showEpisodes)
}

// Each process keeps complete lists, independent of search, sort, and paging.
// Bound both entry count and serialized size. Concurrent misses share one load.
export function createPeopleCache(
	fetch: (key: TitlePeopleKey) => Promise<PeopleData>,
	{
		ttlMs = 24 * 60 * 60 * 1000,
		maxEntries = 128,
		maxBytes = 16 * 1024 * 1024,
		now = Date.now,
	} = {},
) {
	const entries = new Map<
		string,
		{ data: PeopleData; expires: number; bytes: number }
	>()
	const pending = new Map<string, Promise<PeopleData>>()
	let bytes = 0
	const remove = (key: string) => {
		bytes -= entries.get(key)?.bytes ?? 0
		entries.delete(key)
	}
	const refresh = (key: TitlePeopleKey, name: string) => {
		const loading = pending.get(name)
		if (loading) return loading
		const promise = Promise.resolve()
			.then(() => fetch(key))
			.then((data) => {
				const size = Buffer.byteLength(JSON.stringify(data))
				remove(name)
				if (size <= maxBytes) {
					while (
						entries.size > 0 &&
						(entries.size >= maxEntries || bytes + size > maxBytes)
					) {
						const oldest = entries.keys().next().value
						if (oldest !== undefined) remove(oldest)
					}
					entries.set(name, { data, expires: now() + ttlMs, bytes: size })
					bytes += size
				}
				return data
			})
			.finally(() => pending.delete(name))
		pending.set(name, promise)
		return promise
	}
	return async (key: TitlePeopleKey): Promise<PeopleData> => {
		const name = `${key.type}:${key.id}:${key.kind}`
		const entry = entries.get(name)
		if (entry) {
			entries.delete(name)
			entries.set(name, entry)
			if (entry.expires <= now()) {
				// Keep stale data on failure; the next request may retry the shared refresh.
				void refresh(key, name).catch(() => {})
			}
			return entry.data
		}
		return refresh(key, name)
	}
}

const loadTitlePeople = createPeopleCache(fetchTitlePeople)

export async function getTitlePeoplePage(
	input: PeopleParams,
	{ load = loadTitlePeople, apply = applyCorrections } = {},
) {
	const params = { ...input, id: canonicalTitleId(input.type, input.id) }
	const data = await load(params)
	if (params.kind !== "cast") return peoplePage(data, params)
	// Use the existing cast overlay shape, over the full list and after the cache.
	const corrected = await apply(
		{ kind: params.type, id: params.id },
		{
			cast: data.all.map(({ roles, ...row }) => ({
				...row,
				characters: roles,
			})),
		},
	)
	return peoplePage(
		{
			...data,
			all: corrected.cast.map(({ characters, ...row }) => ({
				...row,
				roles: characters,
			})),
		},
		params,
		data.all,
	)
}
