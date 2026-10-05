// PROTOTYPE - throwaway. Data for /prototype/rec-explorer-7 (#180, round 7). Round 7 is round 6's map with one new
// read-only answer, computed in memory from round 4's viewer context (no new queries):
//   blend  the titles two islands share, laid out as a fractal like any island (round 5's tree, nearest first).
//          Where a title can sit on both islands (a horror comedy under Genre, a title on two services under
//          Streaming), the bridge holds the titles that are on both. Where a grouping puts every title on exactly one
//          island (mood, decade, country, taste distance), it holds the titles of either island whose title analysis
//          sits closest to both, "between" them.
// Everything else (map, tree, door, peek) is round 5's API as is.
import { explorer4Api } from "~/server/prototype-rec-explorer-4.server"
import { explorer5Api } from "~/server/prototype-rec-explorer-5.server"
import { GROUPINGS, type GroupId, type W } from "~/ui/prototype-rec-explorer-4/wire4"
import { firstCount } from "~/ui/prototype-rec-explorer-5/wire5"
import type { BlendRes } from "~/ui/prototype-rec-explorer-7/wire7"
import { getUserIdFromRequest } from "~/utils/auth"
import { duplicateProviderMapping } from "~/utils/streaming-links"

// ---------------------------------------------------------------- round 4's context, read-only

type Title = { k: string; t: string; yr: number; p: string; b: string; g: string[]; s: number; svc: number[] }
type Ctx4 = {
	key: string
	pool: { country: string; titles: Title[]; index: Map<string, number>; n: number; U: Float32Array }
	relevant: Set<number>
	match: Uint8Array
	seen: Uint8Array
	rating: Uint8Array
	want: Uint8Array
	onMine: Uint8Array
	q: Float32Array
	groups: Map<string, Groups>
}
type Groups = { gid: Int16Array; defs: { id: string; name: string }[] }
type R4 = { ctx: Map<string, { at: number; p: Promise<Ctx4> }>; groups: Map<string, Groups> }
const r4 = () => (globalThis as unknown as { __rx4?: R4 }).__rx4

type Filters = { mine: boolean; notSeen: boolean }

const groupOf = (q: URLSearchParams): GroupId => {
	const g = q.get("group") as GroupId
	return GROUPINGS.some((x) => x.id === g) ? g : "genre"
}

async function viewerKey(request: Request) {
	const url = new URL(request.url)
	const as = url.searchParams.get("as") ?? "me"
	const dev = /^[0-9a-f-]{36}$/.test(as) && url.hostname === "localhost" && process.env.NODE_ENV !== "production"
	const signedIn = await getUserIdFromRequest({ request }).catch(() => undefined)
	const userId = dev ? as : as === "demo" ? undefined : signedIn
	return `|${userId ?? "demo"}|${url.searchParams.get("country") ?? ""}`
}

async function context(request: Request, group: GroupId, f: Filters) {
	const url = new URL(request.url)
	const q = new URLSearchParams()
	for (const k of ["as", "country"]) {
		const v = url.searchParams.get(k)
		if (v) q.set(k, v)
	}
	q.set("op", "map")
	q.set("group", group)
	q.set("mine", f.mine ? "1" : "0")
	q.set("ns", f.notSeen ? "1" : "0")
	await explorer4Api(new Request(new URL(`/prototype/rec-explorer-4/api?${q}`, url), { headers: request.headers }))
	const tail = await viewerKey(request)
	const cache = r4()
	const hit = cache && [...cache.ctx.entries()].reverse().find(([k]) => k.endsWith(tail))
	if (!cache || !hit) throw new Error("Round 4 context unavailable")
	const ctx = await hit[1].p
	const groups = group === "service" || group === "taste" ? ctx.groups.get(group) : cache.groups.get(`${ctx.pool.country}|${group}`)
	if (!groups) throw new Error("Round 4 grouping unavailable")
	return { ctx, groups }
}

const eligible = (ctx: Ctx4, i: number, f: Filters) => ctx.seen[i] !== 2 && !(f.notSeen && ctx.seen[i] === 1) && !(f.mine && !ctx.onMine[i])

const DUP_TO_BASE = new Map(
	Object.entries(duplicateProviderMapping as Record<string, number[]>).flatMap(([base, dups]) => dups.map((d) => [d, Number(base)] as const)),
)
const baseService = (id: number) => DUP_TO_BASE.get(id) ?? id

function wire(ctx: Ctx4, i: number): W {
	const t = ctx.pool.titles[i]
	const w: W = {
		k: t.k,
		t: t.t,
		yr: t.yr,
		p: t.p,
		b: t.b,
		g: t.g.slice(0, 2),
		s: t.s,
		m: ctx.match[i],
		a: [...new Set(t.svc.map(baseService))].filter((id) => ctx.relevant.has(id)),
		f: (ctx.onMine[i] ? 1 : 0) | (ctx.seen[i] === 1 ? 2 : 0) | (ctx.want[i] ? 4 : 0),
	}
	if (ctx.rating[i]) w.r = ctx.rating[i]
	return w
}

// Round 4's genre islands and the TMDB genres each takes in (a title counts for every island it touches here,
// not only the most specific one round 4 files it under).
const GENRE_FROM: Record<string, string[]> = {
	animation: ["Animation"],
	docs: ["Documentary", "Reality", "Talk", "News"],
	horror: ["Horror"],
	scifi: ["Science Fiction", "Sci-Fi & Fantasy"],
	fantasy: ["Fantasy", "Sci-Fi & Fantasy"],
	war: ["War", "History", "War & Politics", "Western"],
	crime: ["Crime"],
	thriller: ["Mystery", "Thriller"],
	romance: ["Romance"],
	family: ["Family", "Kids"],
	action: ["Action", "Adventure", "Action & Adventure"],
	comedy: ["Comedy"],
	drama: ["Drama", "Soap", "Music", "TV Movie"],
}

// ---------------------------------------------------------------- the bridge's fractal

type Tree = { idx: number[]; par: number[]; gen: number[]; count: number; kind: BlendRes["kind"] }
const G = globalThis as unknown as { __rx7?: { blends: Map<string, Tree> } }
if (!G.__rx7) G.__rx7 = { blends: new Map() }
const cache7 = G.__rx7

/** Round 5's fractal over a given set of titles: the best first, then around each its closest, breadth first. */
function tree(ctx: Ctx4, members: number[], first: number, branch: number[]) {
	const { pool } = ctx
	const DD = pool.U.length / pool.n
	const taken = new Set<number>()
	const names = new Set<string>()
	const idx: number[] = []
	const par: number[] = []
	const gen: number[] = []
	const take = (i: number, p: number, g: number) => {
		taken.add(i)
		names.add(pool.titles[i].t)
		idx.push(i)
		par.push(p)
		gen.push(g)
	}
	for (const i of members) {
		if (idx.length >= first) break
		if (!names.has(pool.titles[i].t)) take(i, -1, 1)
	}
	for (let at = 0; at < idx.length; at++) {
		const b = branch[gen[at] - 1]
		if (!b) continue
		const from = idx[at] * DD
		const best: [number, number][] = []
		for (const pass of [55, 0]) {
			for (const i of members) {
				if (taken.has(i) || pool.titles[i].s < pass || names.has(pool.titles[i].t)) continue
				let c = 0
				const o = i * DD
				for (let d = 0; d < DD; d++) c += pool.U[from + d] * pool.U[o + d]
				const v = c + 0.2 * ctx.q[i]
				if (best.length < b || v > best[best.length - 1][1]) {
					let k = best.length
					while (k > 0 && best[k - 1][1] < v) k--
					best.splice(k, 0, [i, v])
					if (best.length > b) best.pop()
				}
			}
			if (best.length >= b) break
		}
		for (const [i] of best) if (!names.has(pool.titles[i].t)) take(i, at, gen[at] + 1)
	}
	return { idx, par, gen }
}

function blend(ctx: Ctx4, groups: Groups, group: GroupId, a: string, b: string, f: Filters, branch: number[]): Tree | null {
	const ja = groups.defs.findIndex((d) => d.id === a)
	const jb = groups.defs.findIndex((d) => d.id === b)
	if (ja < 0 || jb < 0 || ja === jb) return null
	const { pool } = ctx
	const n = pool.n
	// Titles that sit on both islands, where the grouping allows it.
	let both: number[] = []
	if (group === "genre" && GENRE_FROM[a] && GENRE_FROM[b]) {
		const A = new Set(GENRE_FROM[a])
		const B = new Set(GENRE_FROM[b])
		for (let i = 0; i < n; i++) {
			if (!eligible(ctx, i, f)) continue
			const g = pool.titles[i].g
			if (g.some((x) => A.has(x)) && g.some((x) => B.has(x))) both.push(i)
		}
	} else if (group === "service" && a !== "none" && b !== "none") {
		const sa = Number(a)
		const sb = Number(b)
		for (let i = 0; i < n; i++) {
			if (!eligible(ctx, i, f)) continue
			const s = pool.titles[i].svc.map(baseService)
			if (s.includes(sa) && s.includes(sb)) both.push(i)
		}
	}
	let kind: Tree["kind"] = "both"
	let members = both
	if (both.length < 6) {
		// Between: titles of either island whose title analysis is close to both islands' middles.
		kind = "between"
		both = []
		const DD = pool.U.length / n
		const ca = new Float64Array(DD)
		const cb = new Float64Array(DD)
		const cand: number[] = []
		for (let i = 0; i < n; i++) {
			const j = groups.gid[i]
			if ((j !== ja && j !== jb) || !eligible(ctx, i, f)) continue
			cand.push(i)
			const c = j === ja ? ca : cb
			for (let d = 0; d < DD; d++) c[d] += pool.U[i * DD + d]
		}
		const norm = (v: Float64Array) => {
			let l = 0
			for (let d = 0; d < DD; d++) l += v[d] * v[d]
			l = Math.sqrt(l) || 1
			for (let d = 0; d < DD; d++) v[d] /= l
		}
		norm(ca)
		norm(cb)
		const sc = cand.map((i) => {
			let x = 0
			let y = 0
			for (let d = 0; d < DD; d++) {
				x += pool.U[i * DD + d] * ca[d]
				y += pool.U[i * DD + d] * cb[d]
			}
			return [i, Math.min(x, y)] as [number, number]
		})
		sc.sort((p, q) => q[1] - p[1])
		// As many from each island, best picks first, taking turns, so the bridge leans to neither side.
		const half = Math.max(20, Math.min(200, Math.round(cand.length * 0.075)))
		const fromA = sc.filter(([i]) => groups.gid[i] === ja).slice(0, half).map(([i]) => i)
		const fromB = sc.filter(([i]) => groups.gid[i] === jb).slice(0, half).map(([i]) => i)
		fromA.sort((x, y) => ctx.q[y] - ctx.q[x])
		fromB.sort((x, y) => ctx.q[y] - ctx.q[x])
		members = []
		for (let k = 0; k < Math.max(fromA.length, fromB.length); k++) {
			if (fromA[k] != null) members.push(fromA[k])
			if (fromB[k] != null) members.push(fromB[k])
		}
	} else members.sort((x, y) => ctx.q[y] - ctx.q[x])
	const t = tree(ctx, members, firstCount(members.length), branch)
	return { ...t, count: members.length, kind }
}

// ---------------------------------------------------------------- public

export async function explorer7Api(request: Request) {
	const url = new URL(request.url)
	const q = url.searchParams
	if (q.get("op") !== "blend") return explorer5Api(request)
	const t0 = performance.now()
	const f: Filters = { mine: q.get("mine") === "1", notSeen: q.get("ns") !== "0" }
	const group = groupOf(q)
	const { ctx, groups } = await context(request, group, f)
	const branch = (q.get("br") ?? "6,2,2")
		.split(",")
		.map(Number)
		.filter((n) => n > 0 && n <= 8)
		.slice(0, 4)
	const [a, b] = [q.get("a") ?? "", q.get("b") ?? ""].sort()
	const key = `v2|${ctx.key}|${group}|${f.mine ? 1 : 0}${f.notSeen ? 1 : 0}|${a}+${b}|${branch.join(".")}`
	let t = cache7.blends.get(key)
	if (!t) {
		const made = blend(ctx, groups, group, a, b, f, branch)
		if (made) {
			t = made
			cache7.blends.set(key, t)
			if (cache7.blends.size > 200) cache7.blends.delete(cache7.blends.keys().next().value as string)
		}
	}
	const res: BlendRes = t
		? {
				id: `${a}+${b}`,
				kind: t.kind,
				items: t.idx.map((i) => wire(ctx, i)),
				par: t.par,
				gen: t.gen,
				count: t.count,
				ms: Math.round((performance.now() - t0) * 10) / 10,
			}
		: { id: `${a}+${b}`, kind: "both", items: [], par: [], gen: [], count: 0 }
	return res
}
