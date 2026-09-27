// PROTOTYPE - throwaway. Data for /prototype/rec-explorer-5 (#180, round 5). Round 5 is round 4's islands with richer
// content, so it reuses round 4 for the page data and the map (which reuses round 2's in-memory pool of ~12,000
// titles with their title analysis): no new queries. It adds two read-only answers, computed in memory:
//   tree  one island's fractal: its best picks first, then around each title its closest titles in that island
//         (by title analysis, nudged toward good picks), breadth first, never repeating a title;
//   door  where a step toward each neighboring island lands: the title on that island's fractal closest to this one.
// It reaches round 4's viewer context (ratings, services, taste match) through round 4's own cache, after asking
// round 4 for the map, so the two rounds always agree on who is looking and what passes the filters.
import {
	explorer4Api,
	getExplorer4,
} from "~/server/prototype-rec-explorer-4.server"
import {
	GROUPINGS,
	type GroupId,
	type Loaded4,
	type W,
} from "~/ui/prototype-rec-explorer-4/wire4"
import type { DoorRes, TreeRes } from "~/ui/prototype-rec-explorer-5/wire5"
import { getUserIdFromRequest } from "~/utils/auth"
import { duplicateProviderMapping } from "~/utils/streaming-links"

// ---------------------------------------------------------------- round 4's context, read-only

type Title = {
	k: string
	t: string
	yr: number
	p: string
	b: string
	g: string[]
	s: number
	svc: number[]
}
type Ctx4 = {
	key: string
	pool: {
		country: string
		titles: Title[]
		index: Map<string, number>
		n: number
		U: Float32Array
	}
	relevant: Set<number>
	match: Uint8Array
	seen: Uint8Array
	rating: Uint8Array
	want: Uint8Array
	onMine: Uint8Array
	q: Float32Array
	groups: Map<string, Groups>
}
type Groups = { gid: Int16Array; defs: { id: string }[] }
type R4 = {
	ctx: Map<string, { at: number; p: Promise<Ctx4> }>
	groups: Map<string, Groups>
}
const r4 = () => (globalThis as unknown as { __rx4?: R4 }).__rx4

type Filters = { mine: boolean; notSeen: boolean }

const groupOf = (q: URLSearchParams): GroupId => {
	const g = q.get("group") as GroupId
	return GROUPINGS.some((x) => x.id === g) ? g : "genre"
}

/** The same viewer round 4 resolves: ?as=<uuid> on localhost in development, ?as=demo, or the signed-in member. */
async function viewerKey(request: Request) {
	const url = new URL(request.url)
	const as = url.searchParams.get("as") ?? "me"
	const dev =
		/^[0-9a-f-]{36}$/.test(as) &&
		url.hostname === "localhost" &&
		process.env.NODE_ENV !== "production"
	const signedIn = await getUserIdFromRequest({ request }).catch(
		() => undefined,
	)
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
	// Round 4 builds (or reuses) the viewer, the grouping, and the map.
	await explorer4Api(
		new Request(new URL(`/prototype/rec-explorer-4/api?${q}`, url), {
			headers: request.headers,
		}),
	)
	const tail = await viewerKey(request)
	const cache = r4()
	const hit =
		cache && [...cache.ctx.entries()].reverse().find(([k]) => k.endsWith(tail))
	if (!cache || !hit) throw new Error("Round 4 context unavailable")
	const ctx = await hit[1].p
	const groups =
		group === "service" || group === "taste"
			? ctx.groups.get(group)
			: cache.groups.get(`${ctx.pool.country}|${group}`)
	if (!groups) throw new Error("Round 4 grouping unavailable")
	return { ctx, groups }
}

const eligible = (ctx: Ctx4, i: number, f: Filters) =>
	ctx.seen[i] !== 2 &&
	!(f.notSeen && ctx.seen[i] === 1) &&
	!(f.mine && !ctx.onMine[i])

const DUP_TO_BASE = new Map(
	Object.entries(duplicateProviderMapping as Record<string, number[]>).flatMap(
		([base, dups]) => dups.map((d) => [d, Number(base)] as const),
	),
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
		a: [...new Set(t.svc.map(baseService))].filter((id) =>
			ctx.relevant.has(id),
		),
		f:
			(ctx.onMine[i] ? 1 : 0) |
			(ctx.seen[i] === 1 ? 2 : 0) |
			(ctx.want[i] ? 4 : 0),
	}
	if (ctx.rating[i]) w.r = ctx.rating[i]
	return w
}

// ---------------------------------------------------------------- fractal trees

type Tree = { idx: number[]; par: number[]; gen: number[]; count: number }
const G = globalThis as unknown as { __rx5?: { trees: Map<string, Tree> } }
if (!G.__rx5) G.__rx5 = { trees: new Map() }
const cache5 = G.__rx5

function buildTree(
	ctx: Ctx4,
	groups: Groups,
	j: number,
	f: Filters,
	first: number,
	branch: number[],
): Tree {
	const { pool } = ctx
	const DD = pool.U.length / pool.n
	const members: number[] = []
	for (let i = 0; i < pool.n; i++)
		if (groups.gid[i] === j && eligible(ctx, i, f)) members.push(i)
	members.sort((a, b) => ctx.q[b] - ctx.q[a])
	const taken = new Uint8Array(pool.n)
	const names = new Set<string>()
	const idx: number[] = []
	const par: number[] = []
	const gen: number[] = []
	const take = (i: number, p: number, g: number) => {
		taken[i] = 1
		names.add(pool.titles[i].t)
		idx.push(i)
		par.push(p)
		gen.push(g)
	}
	// The first posters: the island's best picks, as round 4's map shows them.
	for (const i of members) {
		if (idx.length >= first) break
		if (!names.has(pool.titles[i].t)) take(i, -1, 1)
	}
	// Around each title, breadth first: its closest titles in the island that are also good picks.
	for (let at = 0; at < idx.length; at++) {
		const g = gen[at]
		const b = branch[g - 1]
		if (!b) continue
		const from = idx[at] * DD
		const best: [number, number][] = []
		for (const pass of [55, 0]) {
			for (const i of members) {
				if (taken[i] || pool.titles[i].s < pass || names.has(pool.titles[i].t))
					continue
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
		for (const [i] of best) {
			if (names.has(pool.titles[i].t)) continue
			take(i, at, g + 1)
		}
	}
	return { idx, par, gen, count: members.length }
}

function treeFor(
	ctx: Ctx4,
	groups: Groups,
	group: GroupId,
	id: string,
	f: Filters,
	first: number,
	branch: number[],
): Tree | null {
	const j = groups.defs.findIndex((d) => d.id === id)
	if (j < 0) return null
	const key = `${ctx.key}|${group}|${f.mine ? 1 : 0}${f.notSeen ? 1 : 0}|${id}|${first}|${branch.join(".")}`
	let t = cache5.trees.get(key)
	if (!t) {
		t = buildTree(ctx, groups, j, f, first, branch)
		cache5.trees.set(key, t)
		if (cache5.trees.size > 400)
			cache5.trees.delete(cache5.trees.keys().next().value as string)
	}
	return t
}

// ---------------------------------------------------------------- public

export async function getExplorer5(request: Request): Promise<Loaded4> {
	return getExplorer4(request)
}

export async function explorer5Api(request: Request) {
	const url = new URL(request.url)
	const q = url.searchParams
	const op = q.get("op")
	if (op !== "tree" && op !== "door") return explorer4Api(request)
	const t0 = performance.now()
	const f: Filters = {
		mine: q.get("mine") === "1",
		notSeen: q.get("ns") !== "0",
	}
	const group = groupOf(q)
	const { ctx, groups } = await context(request, group, f)
	const branch = (q.get("br") ?? "4,3,3")
		.split(",")
		.map(Number)
		.filter((n) => n > 0 && n <= 8)
		.slice(0, 4)
	const ms = () => Math.round((performance.now() - t0) * 10) / 10
	if (op === "tree") {
		const id = q.get("id") ?? ""
		const t = treeFor(
			ctx,
			groups,
			group,
			id,
			f,
			Math.min(6, Math.max(1, Number(q.get("n1") ?? 4))),
			branch,
		)
		const res: TreeRes = t
			? {
					id,
					items: t.idx.map((i: number) => wire(ctx, i)),
					par: t.par,
					gen: t.gen,
					count: t.count,
					ms: ms(),
				}
			: { id, items: [], par: [], gen: [], count: 0, ms: ms() }
		return res
	}
	// door: from one title toward each named island ("id:first,id:first").
	const from = ctx.pool.index.get(q.get("k") ?? "")
	const shown = new Set(
		(q.get("shown") ?? "").split(",").filter(Boolean).slice(0, 300),
	)
	const DD = ctx.pool.U.length / ctx.pool.n
	const doors: DoorRes["doors"] = []
	for (const spec of (q.get("to") ?? "")
		.split(",")
		.filter(Boolean)
		.slice(0, 6)) {
		const [to, n1] = spec.split(":")
		const t = treeFor(
			ctx,
			groups,
			group,
			to,
			f,
			Math.min(6, Math.max(1, Number(n1 ?? 4))),
			branch,
		)
		if (!t || from == null) {
			doors.push({ to, idx: -1, item: null })
			continue
		}
		let best = -1
		let bs = Number.NEGATIVE_INFINITY
		t.idx.forEach((i: number, n: number) => {
			if (
				i === from ||
				shown.has(ctx.pool.titles[i].k) ||
				ctx.pool.titles[i].s < 55
			)
				return
			let c = 0
			for (let d = 0; d < DD; d++)
				c += ctx.pool.U[from * DD + d] * ctx.pool.U[i * DD + d]
			const v = c + 0.15 * ctx.q[i]
			if (v > bs) {
				bs = v
				best = n
			}
		})
		doors.push({
			to,
			idx: best,
			item: best >= 0 ? wire(ctx, t.idx[best]) : null,
		})
	}
	const res: DoorRes = { doors, ms: ms() }
	return res
}
