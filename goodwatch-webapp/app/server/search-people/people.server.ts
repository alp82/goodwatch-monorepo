// People in search results. Keeps the index of popular people in memory, loads the credits a named person narrows a
// search to, and the known-for titles of people the title lookup didn't return. Every query is keyed by person id;
// search text never reaches Crate here.
import { query } from "~/utils/crate"
import { searchStatement } from "../combined-search/catalog.server"
import {
	type IndexedPerson,
	type PeopleIndex,
	buildPeopleIndex,
	gatePeople,
	isOwnActingCredit,
	peopleInQuery,
} from "./matching.server"

export interface KnownForTitle {
	type: "movie" | "show"
	id: number
	title: string
	year: string
	poster: string | null
	backdrop: string | null
}

export interface SearchPerson {
	id: number
	name: string
	department: string
	profile: string | null
	knownFor: KnownForTitle[]
}

/** A person row of the title lookup. */
export type LookupPerson = SearchPerson & { popularity: number }

/** Set when names in the query narrowed the titles to those people's credits. */
export interface CreditScope {
	people: { id: number; name: string }[]
	/** The words the titles were ranked by. */
	text: string
}

export interface PeopleReading {
	named: IndexedPerson[]
	offered: IndexedPerson[]
	scope: (CreditScope & { titles: string[] }) | null
}

// About 55k people pass. Below this TMDB popularity a name is too obscure to take over a search.
const INDEX_MIN_POPULARITY = 1
// Popularity drifts and new people arrive daily; an older index is replaced in the background.
const INDEX_MAX_AGE_MS = 24 * 60 * 60 * 1000
// A known-for title: a role billed this high, or one of these jobs.
const LEAD_BILLING = 4
const KEY_JOBS = new Set(["Director", "Screenplay", "Writer", "Creator"])
const KNOWN_FOR_TITLES = 3
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_ENTRIES = 1000

let index: { value: PeopleIndex; at: number } | null = null
let indexLoad: Promise<void> | null = null

/** Loads the index, or replaces an old one, in the background. Searches don't wait for it. */
export function startPeopleIndex() {
	if (indexLoad || (index && Date.now() - index.at < INDEX_MAX_AGE_MS)) return
	const started = performance.now()
	// Row arrays straight from Crate's HTTP endpoint: the general client turns 55k rows into objects and logs them.
	indexLoad = searchStatement(
		`SELECT tmdb_id, name, popularity, profile_path, known_for_department FROM person
		WHERE popularity >= ${INDEX_MIN_POPULARITY} AND NOT coalesce(adult, false) LIMIT 200000`,
	)
		.then(({ rows }) => {
			index = {
				value: buildPeopleIndex(
					(
						rows as [number, string, number, string | null, string | null][]
					).map(([id, name, popularity, profile, department]) => ({
						id,
						name,
						popularity,
						profile,
						department: department ?? "",
					})),
				),
				at: Date.now(),
			}
			console.log(
				`People index ready: ${rows.length} people in ${Math.round(performance.now() - started)} ms`,
			)
		})
		.catch((error) => console.error("People index failed to load", error))
		.finally(() => {
			indexLoad = null
		})
}

/** A small in-process cache: entries expire after CACHE_TTL_MS, the least recently used go first. */
function cache<T>() {
	const entries = new Map<number, { at: number; value: T }>()
	return {
		get(key: number): T | undefined {
			const hit = entries.get(key)
			if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return undefined
			entries.delete(key)
			entries.set(key, hit)
			return hit.value
		},
		set(key: number, value: T) {
			entries.set(key, { at: Date.now(), value })
			while (entries.size > CACHE_ENTRIES)
				entries.delete(entries.keys().next().value as number)
		},
		delete(key: number) {
			entries.delete(key)
		},
	}
}

interface Credits {
	/** Title keys ("movie:550") of every own credit, in front of or behind the camera. */
	all: Set<string>
	/** The leading roles and key jobs among them. */
	lead: Set<string>
}
const creditCache = cache<Promise<Credits>>()

function creditsOf(id: number): Promise<Credits> {
	const hit = creditCache.get(id)
	if (hit) return hit
	const load = Promise.all([
		query<{
			media_tmdb_id: number
			media_type: string
			character: string | null
			order_default: number | null
		}>(
			"SELECT media_tmdb_id, media_type, character, order_default FROM person_appeared_in WHERE person_tmdb_id = ? LIMIT 3000",
			[id],
		),
		query<{ media_tmdb_id: number; media_type: string; job: string | null }>(
			"SELECT media_tmdb_id, media_type, job FROM person_worked_on WHERE person_tmdb_id = ? LIMIT 3000",
			[id],
		),
	]).then(([acting, crew]) => {
		const credits: Credits = { all: new Set(), lead: new Set() }
		for (const c of acting) {
			if (!isOwnActingCredit(c)) continue
			const key = `${c.media_type}:${c.media_tmdb_id}`
			credits.all.add(key)
			if ((c.order_default ?? LEAD_BILLING + 1) <= LEAD_BILLING)
				credits.lead.add(key)
		}
		for (const c of crew) {
			const key = `${c.media_type}:${c.media_tmdb_id}`
			credits.all.add(key)
			if (c.job && KEY_JOBS.has(c.job)) credits.lead.add(key)
		}
		return credits
	})
	creditCache.set(id, load)
	// Only successes are kept.
	load.catch(() => creditCache.delete(id))
	return load
}

/** Title keys every one of the people is credited on. */
async function sharedCredits(ids: number[]): Promise<string[]> {
	const credits = await Promise.all(ids.map(creditsOf))
	return [...credits[0].all].filter((key) =>
		credits.every((c) => c.all.has(key)),
	)
}

/**
 * The people a query names inside a longer phrase, and the titles they narrow the search to. Narrowing needs words
 * left to rank by and at least one title all the people share. Without a loaded index, nobody is found.
 */
export async function readPeople(
	q: string,
	narrow: boolean,
): Promise<PeopleReading> {
	startPeopleIndex()
	if (!index) return { named: [], offered: [], scope: null }
	const { named, offered, rest } = peopleInQuery(q, index.value)
	if (!narrow || !named.length || rest.length < 2)
		return { named, offered, scope: null }
	const titles = await sharedCredits(named.map((p) => p.id))
	if (!titles.length) return { named, offered, scope: null }
	return {
		named,
		offered,
		scope: {
			people: named.map((p) => ({ id: p.id, name: p.name })),
			text: rest,
			titles,
		},
	}
}

const knownForCache = cache<KnownForTitle[]>()

/** Known-for titles from the catalog: the leading roles and key jobs with the most votes. */
async function knownForOf(
	ids: number[],
): Promise<Map<number, KnownForTitle[]>> {
	const result = new Map<number, KnownForTitle[]>()
	const missing: number[] = []
	for (const id of ids) {
		const hit = knownForCache.get(id)
		if (hit) result.set(id, hit)
		else missing.push(id)
	}
	if (!missing.length) return result
	const credits = await Promise.all(missing.map(creditsOf))
	const titles = new Map<string, KnownForTitle & { votes: number }>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const tmdbIds = [
				...new Set(
					credits.flatMap((c) =>
						[...c.lead]
							.filter((key) => key.startsWith(`${type}:`))
							.map((key) => Number(key.slice(type.length + 1))),
					),
				),
			]
			if (!tmdbIds.length) return
			const rows = await query<{
				tmdb_id: number
				title: string
				release_year: number | null
				poster_path: string
				backdrop_path: string | null
				votes: number | null
			}>(
				`SELECT tmdb_id, title, release_year, poster_path, backdrop_path, goodwatch_overall_score_voting_count AS votes
				FROM ${type} WHERE tmdb_id IN (${tmdbIds.map(() => "?").join(",")})
				AND poster_path IS NOT NULL AND title IS NOT NULL AND NOT coalesce(adult, false)`,
				tmdbIds,
			)
			for (const r of rows)
				titles.set(`${type}:${r.tmdb_id}`, {
					type,
					id: r.tmdb_id,
					title: r.title,
					year: r.release_year ? String(r.release_year) : "",
					poster: r.poster_path,
					backdrop: r.backdrop_path,
					votes: r.votes ?? 0,
				})
		}),
	)
	missing.forEach((id, i) => {
		const knownFor = [...credits[i].lead]
			.flatMap((key) => titles.get(key) ?? [])
			.sort((a, b) => b.votes - a.votes)
			.slice(0, KNOWN_FOR_TITLES)
			.map(({ votes, ...title }) => title)
		knownForCache.set(id, knownFor)
		result.set(id, knownFor)
	})
	return result
}

/**
 * The people to show above the titles. `lookup` holds the title lookup's people; when names narrowed the search, the
 * lookup ran on the leftover words, so its people don't count. People from the index get known-for titles from the
 * catalog; without them they still show.
 */
export async function peopleToShow(
	q: string,
	reading: PeopleReading,
	lookup: LookupPerson[],
): Promise<SearchPerson[]> {
	const shown = gatePeople<IndexedPerson | LookupPerson>(q, {
		named: reading.named,
		offered: reading.offered,
		lookup: reading.scope ? [] : lookup.filter((p) => p.knownFor.length),
	})
	const fromIndex = shown.filter((p) => !("knownFor" in p)).map((p) => p.id)
	const knownFor = fromIndex.length
		? await knownForOf(fromIndex).catch(
				() => new Map<number, KnownForTitle[]>(),
			)
		: new Map<number, KnownForTitle[]>()
	return shown.map((p) => ({
		id: p.id,
		name: p.name,
		department: p.department,
		profile: p.profile,
		knownFor: "knownFor" in p ? p.knownFor : (knownFor.get(p.id) ?? []),
	}))
}
