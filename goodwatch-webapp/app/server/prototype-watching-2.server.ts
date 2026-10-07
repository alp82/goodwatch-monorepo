// PROTOTYPE - throwaway. Sample data for /prototype/watching-2 (#371, round 2).
// Round 1's fixture (prototype-watching.server.ts) is reused as it is: the same sample members, shows and films. This
// adds what the two pages need on top: more Wishlist shows to start, and for every title the facts a choice rests on
// (seasons, episodes, total time, whether the show has ended, genres). Everything is read from TMDB with the server's
// key and kept in memory. Moods are made up from TMDB's genres, "added" days and the member's services are made up.
// Nothing is read from or written to Crate, Valkey, or any user table.
import { getWatchingFixture } from "~/server/prototype-watching.server"
import type { Episode, Member, MemberKey, Show, Title } from "~/ui/prototype-watching/model"
import type { Facts, Fixture2 } from "~/ui/prototype-watching-2/model"

const API = "https://api.themoviedb.org/3"

// Shows the sample members want to see and have not started, besides round 1's three.
const MORE_WISHLIST_SHOWS = [67070, 154385, 67744, 110382, 54344]
// Round 1's Wishlist films all run long. A page for picking a film needs short ones and other moods too.
const MORE_WISHLIST_FILMS = [666277, 965150, 419430, 346648, 76341, 120467]

/** The sample member's saved services, as TMDB spells them after round 1's clean-up. */
const MY_SERVICES = /netflix|max|apple tv|disney|hulu|prime|youtube/i

// biome-ignore lint/suspicious/noExplicitAny: TMDB's responses are read loosely in this throwaway
type Raw = Record<string, any>
const cache = new Map<string, Promise<Raw | null>>()
function tmdb(path: string): Promise<Raw | null> {
	let hit = cache.get(path)
	if (!hit) {
		const url = `${API}${path}${path.includes("?") ? "&" : "?"}api_key=${process.env.TMDB_API_KEY}`
		hit = fetch(url)
			.then((r) => (r.ok ? (r.json() as Promise<Raw>) : null))
			.catch(() => null)
		cache.set(path, hit)
	}
	return hit
}

async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = []
	for (let i = 0; i < items.length; i += 12) out.push(...(await Promise.all(items.slice(i, i + 12).map(run))))
	return out
}

const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

// Made up: the real moods are rules over a title's fingerprint. Genres are close enough to look at a page.
const GENRE_MOOD: [RegExp, string][] = [
	[/Comedy/, "funny"],
	[/Horror/, "scary"],
	[/Crime|Mystery/, "crime"],
	[/Romance/, "romance"],
	[/History|War/, "history"],
	[/Science Fiction|Sci-Fi|Fantasy/, "worlds"],
	[/Action|Adventure/, "action"],
	[/Thriller/, "mind"],
	[/Family|Animation|Music/, "feelgood"],
	[/Drama/, "heavy"],
]

function factsOf(raw: Raw, service: string | null): Facts {
	const genres: string[] = (raw.genres ?? []).map((g: Raw) => String(g.name))
	const moods: string[] = []
	for (const [test, mood] of GENRE_MOOD) if (genres.some((g) => test.test(g)) && !moods.includes(mood)) moods.push(mood)
	const episodes: number = raw.number_of_episodes ?? 0
	const minutes: number | null = raw.runtime ?? raw.episode_run_time?.[0] ?? raw.last_episode_to_air?.runtime ?? null
	return {
		genres: genres.slice(0, 3),
		moods: moods.slice(0, 2),
		seasons: raw.number_of_seasons ?? 0,
		episodes,
		ended: raw.status ? /Ended|Canceled/.test(raw.status) : true,
		hours: episodes && minutes ? Math.round((episodes * minutes) / 60) : null,
		added: (raw.id * 13) % 380,
		mine: !!service && MY_SERVICES.test(service),
	}
}

const offerOf = (raw: Raw) => {
	const offers: Raw[] = raw["watch/providers"]?.results?.US?.flatrate ?? []
	const offer = offers.find((o) => !/Channel|with Ads|Premium/i.test(o.provider_name)) ?? offers[0]
	return offer ? { name: String(offer.provider_name).replace(/ Plus$/, "+"), logo: offer.logo_path } : null
}

async function loadFilm(id: number): Promise<Title | null> {
	const raw = await tmdb(`/movie/${id}?append_to_response=watch/providers`)
	if (!raw) return null
	return {
		key: `movie:${raw.id}`,
		type: "movie",
		id: raw.id,
		title: raw.title,
		year: raw.release_date ? Number(String(raw.release_date).slice(0, 4)) : null,
		poster: raw.poster_path ?? null,
		backdrop: raw.backdrop_path ?? null,
		runtime: raw.runtime ?? null,
		score: raw.vote_average ? Math.round(raw.vote_average * 10) : null,
		service: offerOf(raw),
		match: 71 + ((raw.id * 7) % 26),
		tagline: raw.tagline || "",
	}
}

/** A show nobody has started: its first season's episodes, as round 1's Show. */
async function loadUnstarted(id: number, today: number): Promise<Show | null> {
	const raw = await tmdb(`/tv/${id}?append_to_response=watch/providers,season/1`)
	const eps: Raw[] = raw?.["season/1"]?.episodes ?? []
	if (!raw || !eps.length) return null
	const episodes: Episode[] = eps.map((e, i) => ({
		s: 1,
		e: e.episode_number,
		name: e.name || `Episode ${e.episode_number}`,
		air: e.air_date && e.air_date <= iso(today) ? e.air_date : iso(today - (eps.length - i) * 7 * DAY),
	}))
	return {
		key: `show:${raw.id}`,
		type: "show",
		id: raw.id,
		title: raw.name,
		year: raw.first_air_date ? Number(String(raw.first_air_date).slice(0, 4)) : null,
		poster: raw.poster_path ?? null,
		backdrop: raw.backdrop_path ?? null,
		runtime: raw.episode_run_time?.[0] ?? raw.last_episode_to_air?.runtime ?? null,
		score: raw.vote_average ? Math.round(raw.vote_average * 10) : null,
		service: offerOf(raw),
		match: 71 + ((raw.id * 7) % 26),
		tagline: raw.tagline || "",
		episodes,
		before: 0,
		total: raw.number_of_episodes ?? episodes.length,
		more: (raw.number_of_seasons ?? 1) > 1,
	}
}

export async function getWatchingFixture2(): Promise<Fixture2> {
	const round1 = await getWatchingFixture()
	const today = Date.parse(`${round1.today}T00:00:00Z`)
	const titles = { ...round1.titles }
	const more = (await inBatches(MORE_WISHLIST_SHOWS, (id) => loadUnstarted(id, today))).filter((s): s is Show => !!s)
	for (const show of more) titles[show.key] = show

	const films = (await inBatches(MORE_WISHLIST_FILMS, loadFilm)).filter((t): t is Title => !!t)
	for (const film of films) titles[film.key] = film

	// The same Wishlist for every sample member: round 1's, with a show to start after every second title.
	const base = round1.members.six.wishlist
	const wishlist: string[] = []
	let next = 0
	base.forEach((key, i) => {
		wishlist.push(key)
		if (i % 2 === 1 && more[next]) wishlist.push(more[next++].key)
		if (i % 2 === 0 && films[i / 2]) wishlist.push(films[i / 2].key)
	})

	// TMDB lists no US subscription for several of the films, which would leave On my services with little to show.
	// Those get a made-up service from the ones other titles have, except two that stay without one.
	const known = new Map<string, NonNullable<Title["service"]>>()
	for (const t of Object.values(titles)) if (t.service && MY_SERVICES.test(t.service.name)) known.set(t.service.name, t.service)
	const pool = [...known.values()]
	const KEEP_WITHOUT = new Set(["movie:244786", "movie:27205"])
	for (const [key, t] of Object.entries(titles))
		if (t.type === "movie" && !t.service && pool.length && !KEEP_WITHOUT.has(key)) titles[key] = { ...t, service: pool[t.id % pool.length] }

	const facts: Fixture2["facts"] = {}
	await inBatches(Object.values(titles), async (t) => {
		const raw = await tmdb(`/${t.type === "show" ? "tv" : "movie"}/${t.id}`)
		if (raw) facts[t.key] = factsOf(raw, t.service?.name ?? null)
	})

	const members = Object.fromEntries(
		Object.entries(round1.members).map(([key, m]) => [key, { ...m, wishlist }]),
	) as Record<MemberKey, Member>
	return { ...round1, titles, members, facts }
}
