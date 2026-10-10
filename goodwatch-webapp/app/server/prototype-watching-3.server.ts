// PROTOTYPE - throwaway. Sample data for /prototype/watching-3 (#371, round 3).
// Round 2's fixture (prototype-watching-2.server.ts) is reused as it is. This adds a pool of well-known titles a
// sample member could have Seen: 25 list pages from TMDB (20 pages of movies, 5 of shows, the most voted first), read
// once with the server's key and kept in memory. Which of them a sample member has Seen, when, and how they scored
// them is made up in the browser from seeds (ui/prototype-watching-3/model.ts).
// Nothing is read from or written to Crate, Valkey, or any user table.
import { getWatchingFixture2 } from "~/server/prototype-watching-2.server"
import type { Member, MemberKey } from "~/ui/prototype-watching/model"
import type { Fixture3, SeenTitle } from "~/ui/prototype-watching-3/model"

const API = "https://api.themoviedb.org/3"
const MOVIE_PAGES = 20
const SHOW_PAGES = 5

// biome-ignore lint/suspicious/noExplicitAny: TMDB's responses are read loosely in this throwaway
type Raw = Record<string, any>

async function page(type: "movie" | "tv", n: number): Promise<SeenTitle[]> {
	const url = `${API}/discover/${type}?sort_by=vote_count.desc&include_adult=false&language=en-US&page=${n}&api_key=${process.env.TMDB_API_KEY}`
	const raw: Raw | null = await fetch(url)
		.then((r) => (r.ok ? (r.json() as Promise<Raw>) : null))
		.catch(() => null)
	return ((raw?.results ?? []) as Raw[])
		.filter((t) => t.poster_path)
		.map((t) => {
			const date: string = t.release_date ?? t.first_air_date ?? ""
			return {
				key: `${type === "tv" ? "show" : "movie"}:${t.id}`,
				type: type === "tv" ? ("show" as const) : ("movie" as const),
				title: String(t.title ?? t.name),
				year: date ? Number(date.slice(0, 4)) : null,
				poster: t.poster_path as string,
				score: t.vote_average ? Math.round(t.vote_average * 10) : null,
			}
		})
}

let pool: Promise<SeenTitle[]> | null = null
function loadPool(): Promise<SeenTitle[]> {
	if (!pool) {
		pool = (async () => {
			const wanted: ["movie" | "tv", number][] = [
				...Array.from({ length: MOVIE_PAGES }, (_, i): ["movie", number] => ["movie", i + 1]),
				...Array.from({ length: SHOW_PAGES }, (_, i): ["tv", number] => ["tv", i + 1]),
			]
			const out: SeenTitle[] = []
			for (let i = 0; i < wanted.length; i += 9) {
				const lists = await Promise.all(wanted.slice(i, i + 9).map(([type, n]) => page(type, n)))
				out.push(...lists.flat())
			}
			return out
		})()
		// A failed read is tried again on the next request.
		pool.then((list) => {
			if (!list.length) pool = null
		})
	}
	return pool
}

/** A show the sample members gave up on, so Dropped has something in it. In round 2 it is On hold. */
const DROPPED = "show:70523"

export async function getWatchingFixture3(): Promise<Fixture3> {
	const [round2, all] = await Promise.all([getWatchingFixture2(), loadPool()])
	// A title the sample member wants to see or is tracking can't also be in the made-up Seen history.
	const taken = new Set(Object.keys(round2.titles))
	const members = Object.fromEntries(
		Object.entries(round2.members).map(([key, m]) => {
			const tracks = { ...m.tracks }
			if (tracks[DROPPED]) tracks[DROPPED] = { ...tracks[DROPPED], status: "dropped" }
			return [key, { ...m, tracks }]
		}),
	) as Record<MemberKey, Member>
	return { ...round2, members, pool: all.filter((t) => !taken.has(t.key)) }
}
