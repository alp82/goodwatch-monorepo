// PROTOTYPE - throwaway. Read-only data for /prototype/rec-home (#178): the start page for three audiences.
//   guest: no ratings, no services, first visit. The page gets fingerprints so taste builds in the browser.
//   new:   a member with 5 ratings, three services (Netflix, Prime Video, Disney+) and a 3-title Wishlist.
//   me:    the signed-in member (or, on localhost in development, ?as=<user uuid>), read-only.
// Everything builds on Watch next round 7's loader (Wishlist, ratings, services, pool, offers, moods) and adds
// fingerprints for the pool, loaded once per process. Results are cached per audience so reloads and variant
// switches don't touch Crate. Nothing is written anywhere.
import { getWatchNext7, type LoaderData7 } from "~/server/prototype-rec-watch-next-7.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { W, encodeFp, leanings, makeSpace, matches, scoreWeight, vector, why } from "~/ui/prototype-rec-home/taste"
import { MOODS, type MoodKey } from "~/ui/prototype-rec-watch-next-7/moods"
import { getUserIdFromRequest } from "~/utils/auth"
import { query } from "~/utils/crate"

export type Audience = "guest" | "new" | "me"
export type Pair = { a: string; b: string; left: string; right: string }
export type HomeData = LoaderData7 & {
	audience: Audience
	who: { label: string; ratings: number; wishlist: number; real: boolean }
	keys: string[]
	// Guests only: encoded fingerprints of the pool, for the in-browser taste.
	fp: Record<string, string>
	// Members: up to two attribute phrases per pool title that pull it toward the person.
	why: Record<string, string[]>
	// Members: what the person goes for, and the moods their high scores lean to.
	leans: string[]
	loved: MoodKey[]
	// Guests: this-or-that pairs, a wall of well-known titles, and the services to choose from.
	pairs: Pair[]
	favorites: string[]
	catalog: { name: string; logo: string }[]
}

const KEYS = [...VALID_FINGERPRINT_KEYS] as string[]

// ------------------------------------------------------------------ fingerprints, cached per title

const fpCache = new Map<string, string>()
async function loadFp(keys: string[]) {
	const missing = keys.filter((k) => !fpCache.has(k))
	for (const type of ["movie", "show"] as const) {
		const ids = missing.filter((k) => k.startsWith(`${type}:`)).map((k) => Number(k.split(":")[1]))
		for (let i = 0; i < ids.length; i += 500) {
			const chunk = ids.slice(i, i + 500)
			const rows = await query<{ tmdb_id: number; fp: Record<string, number> | null }>(
				`SELECT tmdb_id, fingerprint_scores AS fp FROM ${type} WHERE tmdb_id IN (${chunk.map(() => "?").join(",")}) LIMIT ${chunk.length}`,
				chunk,
			)
			const got = new Set<number>()
			for (const r of rows) {
				got.add(r.tmdb_id)
				fpCache.set(`${type}:${r.tmdb_id}`, encodeFp(r.fp && Object.keys(r.fp).length > 10 ? r.fp : null, KEYS))
			}
			for (const id of chunk) if (!got.has(id)) fpCache.set(`${type}:${id}`, "")
		}
	}
	const out: Record<string, string> = {}
	for (const k of keys) {
		const s = fpCache.get(k)
		if (s) out[k] = s
	}
	return out
}

// ------------------------------------------------------------------ guest helpers

// Each pair pulls two well-known titles from opposite ends of one taste axis.
const AXES: { plus: string[]; minus: string[]; left: string; right: string }[] = [
	{ plus: ["tension", "bleakness", "violence"], minus: ["wholesome", "hopefulness"], left: "Dark and tense", right: "Warm and hopeful" },
	{ plus: ["fantasy", "futuristic", "world_immersion"], minus: ["contemporary_realism", "biographical"], left: "Other worlds", right: "Real life" },
	{ plus: ["situational_comedy", "wit_wordplay", "absurdist_humor"], minus: ["pathos", "melancholy", "bleakness"], left: "Make me laugh", right: "Make me feel" },
	{ plus: ["spectacle", "adrenaline", "fast_pace"], minus: ["character_depth", "slow_burn", "dialogue_centrality"], left: "Big and loud", right: "Quiet and close" },
	{ plus: ["complexity", "non_linear_narrative", "ambiguity"], minus: ["rewatchability", "wholesome"], left: "A puzzle", right: "Easy comfort" },
	{ plus: ["crime", "intrigue", "mystery"], minus: ["romance", "family_dynamics"], left: "Crime and secrets", right: "Love and family" },
]

function makePairs(data: LoaderData7, fps: Record<string, string>): Pair[] {
	const T = new Map(data.titles.map((t) => [t.key, t]))
	const cands = data.pool.filter((k) => fps[k] && (T.get(k)?.score ?? 0) >= 70 && T.get(k)?.backdrop).slice(0, 220)
	const at = (k: string, key: string) => fps[k].charCodeAt(KEYS.indexOf(key)) - 48
	const used = new Set<string>()
	const out: Pair[] = []
	for (const ax of AXES) {
		const val = (k: string) => ax.plus.reduce((s, p) => s + at(k, p), 0) / ax.plus.length - ax.minus.reduce((s, p) => s + at(k, p), 0) / ax.minus.length
		// Among the 120 best-known, the extremes; popularity breaks ties so both sides are recognizable.
		const ranked = cands.filter((k) => !used.has(k)).slice(0, 120).map((k, i) => ({ k, v: val(k), i }))
		const a = [...ranked].sort((x, y) => y.v - y.i * 0.004 - (x.v - x.i * 0.004))[0]
		const b = ranked.filter((x) => x.k !== a?.k).sort((x, y) => x.v + x.i * 0.004 - (y.v + y.i * 0.004))[0]
		if (!a || !b) continue
		used.add(a.k)
		used.add(b.k)
		out.push({ a: a.k, b: b.k, left: ax.left, right: ax.right })
	}
	return out
}

// A wall of well-known titles that covers every mood, for "tap three you love".
function makeFavorites(data: LoaderData7, n = 18) {
	const T = new Map(data.titles.map((t) => [t.key, t]))
	const top = data.pool.filter((k) => (T.get(k)?.score ?? 0) >= 75 && T.get(k)?.poster && data.extra[k]?.m.length && !T.get(k)?.genres.includes("Talk")).slice(0, 90)
	const out: string[] = []
	for (const m of MOODS) for (const k of top.filter((k) => data.extra[k]?.m.includes(m.key) && !out.includes(k)).slice(0, 2)) out.push(k)
	for (const k of top) if (out.length < n && !out.includes(k)) out.push(k)
	// Keep the wall's order by popularity so the best-known titles come first.
	return top.filter((k) => out.includes(k)).slice(0, n)
}

function catalogOf(data: LoaderData7) {
	const count = new Map<string, { name: string; logo: string; n: number }>()
	for (const k of data.pool.slice(0, 400))
		for (const o of data.titles.find((t) => t.key === k)?.offers ?? []) {
			const c = count.get(o.name) ?? { name: o.name, logo: o.logo, n: 0 }
			c.n++
			count.set(o.name, c)
		}
	return [...count.values()].sort((a, b) => b.n - a.n).slice(0, 8).map(({ name, logo }) => ({ name, logo }))
}

// Moods the person's high scores lean to, compared with how common each mood is in the pool.
function lovedMoods(data: LoaderData7, ratings: Record<string, number>, min: number): MoodKey[] {
	const liked = Object.entries(ratings).filter(([k, s]) => s >= 8 && data.extra[k])
	if (!liked.length) return []
	const base = (m: MoodKey) => (data.pool.filter((k) => data.extra[k]?.m.includes(m)).length + 1) / (data.pool.length + 11)
	return MOODS.map((m) => ({ m: m.key, n: liked.filter(([k]) => data.extra[k].m.includes(m.key)).length }))
		.filter((x) => x.n >= min)
		.map((x) => ({ ...x, lift: x.n / liked.length / base(x.m) }))
		.sort((a, b) => b.lift - a.lift)
		.slice(0, 3)
		.map((x) => x.m)
}

// ------------------------------------------------------------------ loader

const cache = new Map<string, { at: number; p: Promise<HomeData> }>()

export async function getHome(request: Request): Promise<HomeData> {
	const url = new URL(request.url)
	const as = url.searchParams.get("as") ?? ""
	const local = url.hostname === "localhost" && process.env.NODE_ENV !== "production"
	const uuid = /^[0-9a-f-]{36}$/.test(as) && local ? as : null
	const session = uuid ? undefined : await getUserIdFromRequest({ request }).catch(() => undefined)
	const audience: Audience = as === "guest" || as === "new" || as === "me" ? as : uuid || session ? "me" : "guest"
	const country = url.searchParams.get("country") ?? ""
	const key = `${audience}:${uuid ?? (audience === "me" ? (session ?? "demo") : "")}:${country}`
	const hit = cache.get(key)
	if (hit && Date.now() - hit.at < (audience === "me" ? 10 : 30) * 60000) return hit.p
	const p = build(audience, url, request, uuid, !!session).catch((e) => {
		cache.delete(key)
		throw e
	})
	cache.set(key, { at: Date.now(), p })
	return p
}

async function build(audience: Audience, url: URL, request: Request, uuid: string | null, signedIn: boolean): Promise<HomeData> {
	const u = new URL(url)
	for (const k of ["as", "variant"]) u.searchParams.delete(k)
	let req: Request
	if (audience === "me") {
		if (uuid) u.searchParams.set("as", uuid)
		u.searchParams.set("wishlist", "me")
		req = new Request(u, { headers: request.headers })
	} else {
		// No cookies: the demo states never read the signed-in person.
		u.searchParams.set("wishlist", audience === "new" ? "few" : "empty")
		req = new Request(u)
	}
	const base = await getWatchNext7(req)
	const pickKeys = [...new Set([...base.pool, ...base.fresh])]

	const empty = { fp: {}, why: {}, leans: [], loved: [] as MoodKey[], pairs: [], favorites: [], catalog: [] }

	if (audience === "guest") {
		const fp = await loadFp(pickKeys)
		const data: LoaderData7 = {
			...base,
			signedIn: false,
			services: [],
			ratings: {},
			seen: [],
			wishlist: [],
			titles: base.titles.map((t) => ({ ...t, match: null, offers: t.offers.map((o) => ({ ...o, owned: false })) })),
		}
		return { ...data, ...empty, audience, who: { label: "Guest, first visit", ratings: 0, wishlist: 0, real: false }, keys: KEYS, fp, pairs: makePairs(data, fp), favorites: makeFavorites(data), catalog: catalogOf(base) }
	}

	if (audience === "new") {
		// Five scores from the demo member: four favorites and one miss.
		const sorted = Object.entries(base.ratings).sort((a, b) => b[1] - a[1])
		const ratings = Object.fromEntries([...sorted.slice(0, 4), ...sorted.slice(-1)])
		const fp = await loadFp([...new Set([...pickKeys, ...base.wishlist.map((w) => w.key)])])
		const space = makeSpace(fp, KEYS)
		const sig: Record<string, number> = {}
		for (const [k, s] of Object.entries(ratings)) sig[k] = scoreWeight(s)
		for (const w of base.wishlist) sig[w.key] = W.want
		const v = vector(space, sig)
		const m = matches(space, v)
		const whyMap = Object.fromEntries(pickKeys.map((k) => [k, why(space, v, k)]))
		return {
			...base,
			ratings,
			seen: Object.keys(ratings),
			titles: base.titles.map((t) => ({ ...t, match: m.get(t.key) ?? null })),
			...empty,
			audience,
			who: { label: "New member: 5 ratings, 3 on the Wishlist", ratings: 5, wishlist: base.wishlist.length, real: false },
			keys: KEYS,
			why: whyMap,
			leans: leanings(space, v),
			loved: lovedMoods(base, ratings, 1),
		}
	}

	// me: the match stays round 3's (it also drives the Watch next hero); the vector here only explains it.
	const rated = Object.keys(base.ratings).filter((k) => base.titles.some((t) => t.key === k))
	const fp = await loadFp([...new Set([...pickKeys, ...rated, ...base.wishlist.map((w) => w.key)])])
	const space = makeSpace(fp, KEYS)
	const sig: Record<string, number> = {}
	for (const k of rated) sig[k] = scoreWeight(base.ratings[k])
	for (const w of base.wishlist.slice(0, 60)) sig[w.key] ??= W.want
	const v = vector(space, sig)
	const real = base.mode === "me"
	return {
		...base,
		...empty,
		audience,
		who: {
			label: real ? (uuid ? `Member ${uuid.slice(0, 8)} (dev)` : "You") : "Demo member (sign in to see yours)",
			ratings: Object.keys(base.ratings).length,
			wishlist: base.wishlist.length,
			real: real && (signedIn || !!uuid),
		},
		keys: KEYS,
		why: Object.fromEntries(pickKeys.map((k) => [k, why(space, v, k)])),
		leans: leanings(space, v),
		loved: lovedMoods(base, base.ratings, 3),
	}
}
