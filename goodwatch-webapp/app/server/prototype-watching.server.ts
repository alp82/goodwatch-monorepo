// PROTOTYPE - throwaway. Sample data for /prototype/watching (#371).
// Posters, backdrops, episode names and the first US subscription service are read from TMDB with the server's key
// and kept in memory. What each sample member has watched, and when episodes air, is made up here relative to today,
// so the page always shows a show that is caught up, one with new episodes, and one whose season starts next week.
// Nothing is read from or written to Crate, Valkey, or any user table.
import type {
	Episode,
	Fixture,
	Member,
	MemberKey,
	Show,
	Title,
	Track,
} from "~/ui/prototype-watching/model"

const API = "https://api.themoviedb.org/3"

type Plan = {
	id: number
	/** The season the member is in. Earlier seasons count as watched. */
	season: number
	/** Regular episodes of that season the member has watched. */
	watched: number
	/** "all": the season has aired. A number: that many episodes have aired, one a week. */
	aired: number | "all"
	/** With a number in `aired`: how many days ago the newest episode aired. */
	newestDays?: number
	/** The season starts in this many days; nothing of it has aired. */
	startsIn?: number
	status: Track["status"]
	lastWatch: number | null
}

// A member in the middle of a handful of shows.
const SIX: Plan[] = [
	{ id: 95396, season: 2, watched: 3, aired: "all", status: "watching", lastWatch: 1 }, // Severance
	{ id: 136315, season: 3, watched: 6, aired: "all", status: "watching", lastWatch: 4 }, // The Bear
	{ id: 100088, season: 2, watched: 4, aired: 5, newestDays: 0, status: "watching", lastWatch: 7 }, // The Last of Us: new today
	{ id: 95480, season: 4, watched: 1, aired: "all", status: "watching", lastWatch: 23 }, // Slow Horses
	{ id: 126308, season: 1, watched: 8, aired: "all", status: "watching", lastWatch: 64 }, // Shogun: not for a while
	{ id: 83867, season: 2, watched: 6, aired: 6, newestDays: 4, status: "watching", lastWatch: 3 }, // Andor: caught up
	{ id: 107113, season: 5, watched: 0, aired: 2, newestDays: 2, status: "seen", lastWatch: 310 }, // Only Murders: Seen, new episodes
	{ id: 111803, season: 4, watched: 0, aired: 0, startsIn: 7, status: "seen", lastWatch: 200 }, // The White Lotus: season starts next week
	{ id: 65494, season: 4, watched: 3, aired: "all", status: "on-hold", lastWatch: 150 }, // The Crown
	{ id: 70523, season: 2, watched: 2, aired: "all", status: "on-hold", lastWatch: 420 }, // Dark
]

const MANY_IDS = [
	1396, 1399, 66732, 60059, 76479, 94997, 84773, 97546, 76331, 93405, 71912, 82856, 119051, 60625, 60574, 85552,
	124364, 108978, 106379, 125988, 90802, 62560, 46648, 2316, 1668,
]
const MANY_DAYS = [0, 1, 2, 5, 9, 13, 20, 27, 35, 48, 60, 75, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450]
// Twenty-five Watching shows with a next episode, from watched today to not touched in over a year, plus the
// six member's caught-up show and other groups.
const MANY: Plan[] = [
	...MANY_IDS.map(
		(id, i): Plan => ({ id, season: 1 + (i % 3), watched: 1 + ((i * 3) % 6), aired: "all", status: "watching", lastWatch: MANY_DAYS[i] }),
	),
	...SIX.filter((p) => p.status !== "watching" || p.id === 83867),
	{ id: 63174, season: 2, watched: 5, aired: "all", status: "on-hold", lastWatch: 500 },
	{ id: 1402, season: 3, watched: 9, aired: "all", status: "on-hold", lastWatch: 700 },
]

const WISHLIST_MOVIES = [693134, 792307, 915935, 545611, 872585, 496243, 414906, 244786, 438631, 157336, 27205]
// Shows on the Wishlist are not started: starting one sets Watching and clears Want to See.
const WISHLIST_SHOWS = [87108, 94605, 1438]
const SUGGESTIONS = [603, 680, 129]

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

const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

function base(type: "movie" | "show", raw: Raw): Title {
	const offers: Raw[] = raw["watch/providers"]?.results?.US?.flatrate ?? []
	const offer = offers.find((o) => !/Channel|with Ads|Premium/i.test(o.provider_name)) ?? offers[0]
	const date: string = raw.release_date ?? raw.first_air_date ?? ""
	return {
		key: `${type}:${raw.id}`,
		type,
		id: raw.id,
		title: raw.title ?? raw.name,
		year: date ? Number(date.slice(0, 4)) : null,
		poster: raw.poster_path ?? null,
		backdrop: raw.backdrop_path ?? null,
		runtime: raw.runtime ?? raw.episode_run_time?.[0] ?? raw.last_episode_to_air?.runtime ?? null,
		score: raw.vote_average ? Math.round(raw.vote_average * 10) : null,
		service: offer ? { name: String(offer.provider_name).replace(/ Plus$/, "+"), logo: offer.logo_path } : null,
		// A made-up taste match, stable per title.
		match: 71 + ((raw.id * 7) % 26),
		tagline: raw.tagline || "",
	}
}

async function loadMovie(id: number): Promise<Title | null> {
	const raw = await tmdb(`/movie/${id}?append_to_response=watch/providers`)
	return raw ? base("movie", raw) : null
}

async function loadShow(plan: Plan, today: number): Promise<{ show: Show; track: Track } | null> {
	const raw = await tmdb(`/tv/${plan.id}?append_to_response=watch/providers`)
	if (!raw) return null
	const seasons: { season_number: number; episode_count: number }[] = (raw.seasons ?? []).filter(
		(s: Raw) => s.season_number >= 1 && s.episode_count > 0,
	)
	if (!seasons.length) return null
	const last = seasons[seasons.length - 1].season_number
	const season = Math.min(plan.season, last)
	const synthetic = plan.aired !== "all" || plan.startsIn != null
	const wanted = synthetic || season === last ? [season] : [season, season + 1]
	const detail = await tmdb(`/tv/${plan.id}?append_to_response=${wanted.map((n) => `season/${n}`).join(",")}`)
	const regular: Raw[] = wanted.flatMap((n) => detail?.[`season/${n}`]?.episodes ?? [])
	if (!regular.length) return null
	const inSeason = regular.filter((e) => e.season_number === season).length
	const episodes: Episode[] = regular.map((e, i) => {
		let air: string
		if (plan.startsIn != null) air = iso(today + (plan.startsIn + i * 7) * DAY)
		else if (plan.aired !== "all") air = iso(today + (-(plan.newestDays ?? 0) + (i - (plan.aired - 1)) * 7) * DAY)
		// An aired season keeps TMDB's dates; a date TMDB has in the future is moved into the past.
		else air = e.air_date && e.air_date <= iso(today) ? e.air_date : iso(today - (regular.length - i) * 7 * DAY)
		return { s: e.season_number, e: e.episode_number, name: e.name || `Episode ${e.episode_number}`, air }
	})
	const before = seasons.filter((s) => s.season_number < season).reduce((n, s) => n + s.episode_count, 0)
	const show: Show = {
		...base("show", raw),
		episodes,
		before,
		total: synthetic ? before + episodes.length : seasons.reduce((n, s) => n + s.episode_count, 0),
		// Whether a season after the loaded ones exists; then finishing the loaded episodes doesn't end the show.
		more: !synthetic && wanted[wanted.length - 1] < last,
	}
	const watched = Math.min(plan.watched, Math.max(0, inSeason - 1))
	return { show, track: { status: plan.status, watched, lastWatch: plan.lastWatch } }
}

async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = []
	for (let i = 0; i < items.length; i += 12) out.push(...(await Promise.all(items.slice(i, i + 12).map(run))))
	return out
}

export async function getWatchingFixture(): Promise<Fixture> {
	// Midnight UTC, so the server and the browser agree on "today".
	const today = Math.floor(Date.now() / DAY) * DAY
	const titles: Fixture["titles"] = {}
	const plans = new Map<number, Plan>()
	for (const p of [...SIX, ...MANY]) plans.set(p.id, p)
	const loaded = new Map<number, Track>()
	for (const hit of await inBatches([...plans.values()], (p) => loadShow(p, today))) {
		if (!hit) continue
		titles[hit.show.key] = hit.show
		loaded.set(hit.show.id, hit.track)
	}
	const wishlist: string[] = []
	const unstarted = await inBatches(WISHLIST_SHOWS, (id) =>
		loadShow({ id, season: 1, watched: 0, aired: "all", status: null, lastWatch: null }, today),
	)
	const movies = await inBatches(WISHLIST_MOVIES, loadMovie)
	movies.forEach((m, i) => {
		if (m) {
			titles[m.key] = m
			wishlist.push(m.key)
		}
		// A show every fourth place.
		const show = i % 4 === 1 ? unstarted[(i - 1) / 4]?.show : null
		if (show) {
			titles[show.key] = show
			wishlist.push(show.key)
		}
	})
	const suggestions: string[] = []
	for (const m of await inBatches(SUGGESTIONS, loadMovie)) {
		if (!m) continue
		titles[m.key] = m
		suggestions.push(m.key)
	}

	const member = (key: MemberKey, label: string, list: Plan[]): Member => ({
		key,
		label,
		wishlist,
		tracks: Object.fromEntries(list.filter((p) => loaded.has(p.id)).map((p) => [`show:${p.id}`, loaded.get(p.id) as Track])),
	})
	return {
		today: iso(today),
		titles,
		suggestions,
		members: {
			six: member("six", "6 Watching", SIX),
			one: member("one", "1 Watching", SIX.slice(0, 1)),
			many: member("many", "25 Watching", MANY),
			none: member("none", "Tracks nothing", []),
		},
	}
}
