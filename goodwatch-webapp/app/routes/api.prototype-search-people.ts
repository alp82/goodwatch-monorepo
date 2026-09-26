// PROTOTYPE - throwaway. People for the search results prototype (?people=<variant> on /search).
// Calls the TMDB person search directly; production would take the people from the title lookup.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { peopleInQuery } from "~/server/prototype-people-in-query.server"

export interface PrototypePerson {
	id: number
	name: string
	department: string
	profile: string | null
	popularity: number
	// Found as a full name inside a longer phrase, not by the whole-query person search.
	embedded?: boolean
	// One word of the phrase could name this famous person ("tom" in "funny tom"). Offered only.
	offered?: boolean
	knownFor: {
		id: number
		type: "movie" | "show"
		title: string
		year: string
		poster: string | null
		backdrop: string | null
	}[]
}

const cache = new Map<string, PrototypePerson[]>()

// biome-ignore lint/suspicious/noExplicitAny: prototype
const toPerson = (p: any): PrototypePerson => ({
	id: p.id,
	name: p.name,
	department: p.known_for_department ?? "",
	profile: p.profile_path ?? null,
	popularity: p.popularity ?? 0,
	knownFor: (p.known_for ?? [])
		// biome-ignore lint/suspicious/noExplicitAny: prototype
		.filter((t: any) => t.media_type === "movie" || t.media_type === "tv")
		// biome-ignore lint/suspicious/noExplicitAny: prototype
		.map((t: any) => ({
			id: t.id,
			type: t.media_type === "tv" ? "show" : "movie",
			title: t.title || t.name,
			year: (t.release_date || t.first_air_date || "").slice(0, 4),
			poster: t.poster_path ?? null,
			backdrop: t.backdrop_path ?? null,
		})),
})

// biome-ignore lint/suspicious/noExplicitAny: prototype
async function tmdbPeople(query: string): Promise<any[]> {
	const params = new URLSearchParams({
		api_key: process.env.TMDB_API_KEY || "",
		query,
		language: "en-US",
		include_adult: "false",
	})
	const response = await fetch(
		`https://api.themoviedb.org/3/search/person?${params}`,
		{ signal: AbortSignal.timeout(8000) },
	)
	if (!response.ok) return []
	// biome-ignore lint/suspicious/noExplicitAny: prototype
	return ((await response.json()) as { results?: any[] }).results ?? []
}

export async function loader({ request }: LoaderFunctionArgs) {
	const q = (new URL(request.url).searchParams.get("q") ?? "").trim()
	if (q.length < 2) return json({ people: [] })
	const key = q.toLowerCase()
	if (!cache.has(key)) {
		const [whole, inside] = await Promise.all([
			tmdbPeople(q),
			peopleInQuery(q).catch(() => ({ people: [], rest: q, offered: [] })),
		])
		// Names inside a longer phrase; TMDB supplies the known-for titles.
		const embedded = await Promise.all(
			inside.people
				.filter(() => inside.rest.length > 0)
				.map(async (n) => {
					const hit = (await tmdbPeople(n.name)).find((p) => p.id === n.id)
					return { ...toPerson(hit ?? { ...n, known_for: [] }), embedded: true }
				}),
		)
		// A single name inside a phrase; skipped when the whole query is that name ("tom").
		const offered =
			inside.rest.split(" ").length > 1
				? await Promise.all(
						inside.offered.map(async (n) => {
							const hit = (await tmdbPeople(n.name)).find(
								(p) => p.id === n.id,
							)
							return {
								...toPerson(hit ?? { ...n, known_for: [] }),
								offered: true,
							}
						}),
					)
				: []
		const ids = new Set([...embedded, ...offered].map((p) => p.id))
		const people = [
			...embedded,
			...offered,
			...whole
				.filter((p) => p.known_for?.length && !ids.has(p.id))
				.slice(0, 12)
				.map(toPerson),
		]
		cache.set(key, people)
	}
	return json({ people: cache.get(key) })
}
