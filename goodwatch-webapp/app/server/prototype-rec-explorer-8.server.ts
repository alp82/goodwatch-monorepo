// PROTOTYPE - throwaway. Data for /prototype/rec-explorer-8 (#180, round 8). Round 7's answers, plus two, computed
// in memory from round 4's viewer context (no new queries, nothing written):
//   blend  round 7's bridge for two islands, or three: the titles on all of them (a horror comedy with romance), or
//          where a grouping puts every title on one island, the titles whose title analysis sits closest to all;
//   pairs  for every pair of islands in the grouping, how many titles the bridge would hold and how interesting it
//          is (how much more they share than their sizes suggest), so the map can preview a bridge and suggest one
//          before anyone commits.
// Everything else (map, tree, door, peek) is round 7's API, which is round 5's.
import { explorer4Api } from "~/server/prototype-rec-explorer-4.server"
import { explorer7Api } from "~/server/prototype-rec-explorer-7.server"
import { GROUPINGS, type GroupId, type W } from "~/ui/prototype-rec-explorer-4/wire4"
import { firstCount } from "~/ui/prototype-rec-explorer-5/wire5"
import type { BlendRes, Pair, PairsRes } from "~/ui/prototype-rec-explorer-8/wire8"
import { getUserIdFromRequest } from "~/utils/auth"
import { duplicateProviderMapping } from "~/utils/streaming-links"

// ---------------------------------------------------------------- round 4's context, read-only (as in round 7)

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

/** Which islands a title sits on, where a grouping lets it sit on several (genres, services); null otherwise. */
function memberships(group: GroupId, ids: string[]): ((t: Title) => number[]) | null {
	if (group === "genre") {
		const byGenre = new Map<string, number[]>()
		ids.forEach((id, j) => {
			for (const g of GENRE_FROM[id] ?? []) byGenre.set(g, [...(byGenre.get(g) ?? []), j])
		})
		return (t) => [...new Set(t.g.flatMap((g) => byGenre.get(g) ?? []))]
	}
	if (group === "service") {
		const at = new Map(ids.map((id, j) => [Number(id), j]))
		return (t) => [...new Set(t.svc.map(baseService).flatMap((s) => (at.has(s) ? [at.get(s) as number] : [])))]
	}
	return null
}

// ---------------------------------------------------------------- the bridge's fractal (round 7's)

type Tree = { idx: number[]; par: number[]; gen: number[]; count: number; kind: BlendRes["kind"] }
type Cache8 = { blends: Map<string, Tree>; pairs: Map<string, Record<string, Pair>>; mids: Map<string, Float64Array[]> }
const G = globalThis as unknown as { __rx8?: Cache8 }
if (!G.__rx8) G.__rx8 = { blends: new Map(), pairs: new Map(), mids: new Map() }
const cache8 = G.__rx8
const cap = <K, V>(m: Map<K, V>, n: number) => {
	if (m.size > n) m.delete(m.keys().next().value as K)
}

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

/** Every island's middle in title-analysis space (normalized), for "between" bridges and their scores. */
function middles(ctx: Ctx4, groups: Groups, group: GroupId, f: Filters) {
	const key = `${ctx.key}|${group}|${f.mine ? 1 : 0}${f.notSeen ? 1 : 0}`
	const hit = cache8.mids.get(key)
	if (hit) return hit
	const { pool } = ctx
	const DD = pool.U.length / pool.n
	const out = groups.defs.map(() => new Float64Array(DD))
	for (let i = 0; i < pool.n; i++) {
		const j = groups.gid[i]
		if (j < 0 || !out[j] || !eligible(ctx, i, f)) continue
		const v = out[j]
		for (let d = 0; d < DD; d++) v[d] += pool.U[i * DD + d]
	}
	for (const v of out) {
		let l = 0
		for (let d = 0; d < DD; d++) l += v[d] * v[d]
		l = Math.sqrt(l) || 1
		for (let d = 0; d < DD; d++) v[d] /= l
	}
	cache8.mids.set(key, out)
	cap(cache8.mids, 40)
	return out
}

const halfOf = (total: number, n: number) => Math.round((Math.max(20, Math.min(200, Math.round(total * 0.075))) * 2) / n)

/** Round 7's blend, for two or three islands. */
function blend(ctx: Ctx4, groups: Groups, group: GroupId, ids: string[], f: Filters, branch: number[]): Tree | null {
	const js = ids.map((id) => groups.defs.findIndex((d) => d.id === id))
	if (js.some((j) => j < 0) || new Set(js).size !== js.length || js.length < 2 || js.length > 3) return null
	const { pool } = ctx
	const n = pool.n
	let members: number[] = []
	let kind: Tree["kind"] = "both"
	const on = memberships(
		group,
		groups.defs.map((d) => d.id),
	)
	if (on && !ids.includes("none")) {
		for (let i = 0; i < n; i++) {
			if (!eligible(ctx, i, f)) continue
			const m = on(pool.titles[i])
			if (js.every((j) => m.includes(j))) members.push(i)
		}
	}
	if (members.length < 6) {
		// Between: titles of these islands whose title analysis is close to every island's middle.
		kind = "between"
		const DD = pool.U.length / n
		const mids = middles(ctx, groups, group, f)
		const cand: number[] = []
		for (let i = 0; i < n; i++) if (js.includes(groups.gid[i]) && eligible(ctx, i, f)) cand.push(i)
		const sc = new Map<number, number>()
		for (const i of cand) {
			let lo = Number.POSITIVE_INFINITY
			for (const j of js) {
				let x = 0
				const m = mids[j]
				for (let d = 0; d < DD; d++) x += pool.U[i * DD + d] * m[d]
				lo = Math.min(lo, x)
			}
			sc.set(i, lo)
		}
		const half = halfOf(cand.length, js.length)
		// As many from each island, best picks first, taking turns, so the bridge leans to none of them.
		const from = js.map((j) =>
			cand
				.filter((i) => groups.gid[i] === j)
				.sort((a, b) => (sc.get(b) ?? 0) - (sc.get(a) ?? 0))
				.slice(0, half)
				.sort((a, b) => ctx.q[b] - ctx.q[a]),
		)
		members = []
		for (let k = 0; k < Math.max(...from.map((x) => x.length)); k++) for (const x of from) if (x[k] != null) members.push(x[k])
	} else members.sort((x, y) => ctx.q[y] - ctx.q[x])
	const t = tree(ctx, members, firstCount(members.length), branch)
	return { ...t, count: members.length, kind }
}

/** What every pair of islands would share. */
function pairs(ctx: Ctx4, groups: Groups, group: GroupId, f: Filters): Record<string, Pair> {
	const key = `${ctx.key}|${group}|${f.mine ? 1 : 0}${f.notSeen ? 1 : 0}`
	const hit = cache8.pairs.get(key)
	if (hit) return hit
	const { pool } = ctx
	const ids = groups.defs.map((d) => d.id)
	const J = ids.length
	const both = new Float64Array(J * J)
	const fit = new Float64Array(J * J)
	const size = new Float64Array(J)
	const own = new Float64Array(J)
	const on = memberships(group, ids)
	for (let i = 0; i < pool.n; i++) {
		if (!eligible(ctx, i, f)) continue
		const gj = groups.gid[i]
		if (gj >= 0 && gj < J) own[gj]++
		if (!on) continue
		const m = on(pool.titles[i])
		for (const a of m) size[a]++
		for (let x = 0; x < m.length; x++)
			for (let y = x + 1; y < m.length; y++) {
				const a = Math.min(m[x], m[y])
				const b = Math.max(m[x], m[y])
				both[a * J + b]++
				fit[a * J + b] += ctx.match[i]
			}
	}
	const DD = pool.U.length / pool.n
	const mids = middles(ctx, groups, group, f)
	const out: Record<string, Pair> = {}
	for (let a = 0; a < J; a++)
		for (let b = a + 1; b < J; b++) {
			const c = both[a * J + b]
			const k = [ids[a], ids[b]].sort().join("+")
			if (on && c >= 6 && ids[a] !== "none" && ids[b] !== "none") {
				// Overlap against the islands' sizes (Ochiai), so small islands that share a lot rank high too.
				out[k] = { c, kind: "both", s: c / Math.sqrt(Math.max(1, size[a] * size[b])), fit: Math.round(fit[a * J + b] / c) }
				continue
			}
			let cos = 0
			for (let d = 0; d < DD; d++) cos += mids[a][d] * mids[b][d]
			const half = halfOf(own[a] + own[b], 2)
			out[k] = { c: Math.min(half, own[a]) + Math.min(half, own[b]), kind: "between", s: Math.max(0, cos), fit: null }
		}
	cache8.pairs.set(key, out)
	cap(cache8.pairs, 40)
	return out
}

// ---------------------------------------------------------------- public

export async function explorer8Api(request: Request) {
	const url = new URL(request.url)
	const q = url.searchParams
	const op = q.get("op")
	if (op !== "blend" && op !== "pairs") return explorer7Api(request)
	const t0 = performance.now()
	const f: Filters = { mine: q.get("mine") === "1", notSeen: q.get("ns") !== "0" }
	const group = groupOf(q)
	const { ctx, groups } = await context(request, group, f)
	if (op === "pairs") {
		const res: PairsRes = { pairs: pairs(ctx, groups, group, f), ms: Math.round((performance.now() - t0) * 10) / 10 }
		return res
	}
	const branch = (q.get("br") ?? "6,2,2")
		.split(",")
		.map(Number)
		.filter((n) => n > 0 && n <= 8)
		.slice(0, 4)
	const ids = (q.get("ids") ?? "").split(",").filter(Boolean).sort().slice(0, 3)
	const key = `v1|${ctx.key}|${group}|${f.mine ? 1 : 0}${f.notSeen ? 1 : 0}|${ids.join("+")}|${branch.join(".")}`
	let t = cache8.blends.get(key)
	if (!t) {
		const made = blend(ctx, groups, group, ids, f, branch)
		if (made) {
			t = made
			cache8.blends.set(key, t)
			cap(cache8.blends, 200)
		}
	}
	const res: BlendRes = t
		? {
				id: ids.join("+"),
				kind: t.kind,
				items: t.idx.map((i) => wire(ctx, i)),
				par: t.par,
				gen: t.gen,
				count: t.count,
				ms: Math.round((performance.now() - t0) * 10) / 10,
			}
		: { id: ids.join("+"), kind: "both", items: [], par: [], gen: [], count: 0 }
	return res
}
