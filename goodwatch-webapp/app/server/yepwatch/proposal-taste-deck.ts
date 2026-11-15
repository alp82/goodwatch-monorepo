import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
import type { Answer } from "./proposal-taste.ts"
interface Entry {
	key: number
	unit: Float32Array
	likely: number
	votes: number
	movie: boolean
}
export interface TasteCluster {
	id: number
	titles: Entry[]
	votes: number
}
const cache = new WeakMap<TitleSnapshot, Promise<TasteCluster[]>>()
const ready = new WeakMap<TitleSnapshot, TasteCluster[]>()
const fallbacks = new WeakMap<TitleSnapshot, TasteCluster[]>()
/** Never waits for k-means: the first request for a snapshot starts it and gets the fallback until it is built. */
export function readyTasteClusters(snapshot: TitleSnapshot): TasteCluster[] {
	void tasteClusters(snapshot).catch(() => {})
	const built = ready.get(snapshot)
	if (built) return built
	const cached = fallbacks.get(snapshot)
	if (cached) return cached
	const buckets = new Map<string, Entry[]>()
	for (let row = 0; row < snapshot.count; row++) {
		const f = snapshot.factsAt(row)
		if (f.adult || !f.hasPoster || f.score === null || f.votes < 1000) continue
		const movie = f.mediaType === "movie"
		const decade = f.releaseDay === null
			? 0
			: Math.floor(new Date(f.releaseDay * 86400000).getUTCFullYear() / 10)
		const bucket = `${movie}:${f.genres[0] ?? "unknown"}:${decade}`
		const titles = buckets.get(bucket) ?? []
		titles.push({
			key: (movie ? 1e12 : 2e12) + f.tmdbId,
			movie,
			votes: f.votes,
			likely: Math.log(f.votes),
			unit: new Float32Array(),
		})
		buckets.set(bucket, titles)
	}
	const groups = [...buckets.values()]
	for (const titles of groups) titles.sort((a, b) => b.votes - a.votes || a.key - b.key)
	groups.sort((a, b) => b[0].votes - a[0].votes || a[0].key - b[0].key)
	const clusters: TasteCluster[] = Array.from({ length: 10 }, (_, id) => ({
		id, titles: [], votes: 0,
	}))
	// Spread the most popular title from each genre/decade/type before repeating a bucket.
	let index = 0
	let active = groups
	for (let depth = 0; active.length; depth++) {
		active = active.filter(group => group.length > depth)
		for (const group of active) {
			const entry = group[depth]
			if (!entry) continue
			const cluster = clusters[index++ % clusters.length]
			cluster.titles.push(entry)
			cluster.votes += entry.votes
		}
	}
	const result = clusters.filter((c) => c.titles.length)
	fallbacks.set(snapshot, result)
	return result
}
const dot = (a: Float32Array, b: Float32Array) =>
	a.reduce((s, v, k) => s + v * b[k], 0)
const unit = (v: Float32Array) => {
	const n = Math.hypot(...v)
	return n ? v.map((x) => x / n) : v
}
const yieldSlice = () => new Promise<void>((resolve) => setImmediate(resolve))
/** Fixed-seed spherical k-means, 10 clusters, 20 iterations; cached per snapshot and sliced off the request thread. */
export function tasteClusters(
	snapshot: TitleSnapshot
): Promise<TasteCluster[]> {
	let pending = cache.get(snapshot)
	if (pending) return pending
	pending = build(snapshot).then((clusters) => {
		ready.set(snapshot, clusters)
		return clusters
	})
	cache.set(snapshot, pending)
	pending.catch(() => cache.delete(snapshot))
	return pending
}
async function build(snapshot: TitleSnapshot): Promise<TasteCluster[]> {
	await yieldSlice()
	const entries: Entry[] = []
	const year = new Date(snapshot.builtAt).getUTCFullYear()
	for (let row = 0; row < snapshot.count; row++) {
		if (row % 500 === 499) await yieldSlice()
		const f = snapshot.factsAt(row)
		const key = (f.mediaType === "movie" ? 1e12 : 2e12) + f.tmdbId
		if (f.adult || !f.hasPoster || f.score === null || f.votes < 1000) continue
		const raw = snapshot.fingerprintAt(row)
		const fp = unit(Float32Array.from(raw, (x) => (x === 255 ? 0 : x)))
		if (!fp.some((x) => x !== 0)) continue
		const releaseYear =
			f.releaseDay === null
				? 0
				: new Date(f.releaseDay * 86400000).getUTCFullYear()
		entries.push({
			key,
			unit: fp,
			votes: f.votes,
			movie: key < 2e12,
			likely: Math.log(f.votes) + (releaseYear >= year - 15 ? 1 : 0),
		})
	}
	entries.sort((a, b) => b.votes - a.votes || a.key - b.key)
	if (!entries.length) return []
	// Deterministic farthest-first seeds avoid collapsing popular, near-identical starting titles.
	const centers = [entries[0].unit]
	while (centers.length < Math.min(10, entries.length)) {
		let farthest = entries[0],
			distance = -Infinity
		for (let i = 0; i < entries.length; i++) {
			if (i % 500 === 499) await yieldSlice()
			const e = entries[i]
			const d = 1 - Math.max(...centers.map((c) => dot(e.unit, c)))
			if (d > distance) {
				distance = d
				farthest = e
			}
		}
		centers.push(farthest.unit)
		await yieldSlice()
	}
	const assignments = new Int32Array(entries.length)
	for (let iteration = 0; iteration < 20; iteration++) {
		const sums = centers.map((c) => new Float32Array(c.length))
		const counts = centers.map(() => 0)
		for (let i = 0; i < entries.length; i++) {
			const e = entries[i]
			let best = 0,
				similarity = -Infinity
			for (let c = 0; c < centers.length; c++) {
				const s = dot(e.unit, centers[c])
				if (s > similarity) {
					best = c
					similarity = s
				}
			}
			assignments[i] = best
			counts[best]++
			e.unit.forEach((v, k) => {
				sums[best][k] += v
			})
			if (i % 500 === 499) await yieldSlice()
		}
		sums.forEach((s, c) => {
			if (counts[c]) centers[c] = unit(s)
		})
		await yieldSlice()
	}
	const clusters: TasteCluster[] = centers.map((_, id) => ({
		id,
		titles: [],
		votes: 0,
	}))
	entries.forEach((e, i) => {
		clusters[assignments[i]].titles.push(e)
		clusters[assignments[i]].votes += e.votes
	})
	for (const c of clusters)
		c.titles.sort((a, b) => b.likely - a.likely || a.key - b.key)
	return clusters
		.filter((c) => c.titles.length)
		.sort((a, b) => b.votes - a.votes || a.id - b.id)
}
/** Maximum 10: one unanswered title per cluster, targeting 6 movies / 4 shows when the pool permits it. */
export function calibrationKeys(
	clusters: TasteCluster[],
	answers: readonly Answer[],
	count = 10
): number[] {
	const answered = new Map(
		answers.filter((a) => a.answer !== null).map((a) => [a.key, a.answer])
	)
	const info = (c: TasteCluster) => {
		const a = c.titles
			.map((t) => answered.get(t.key))
			.filter((a) => a === "loved" || a === "not_for_me")
		return a.length === 0 ? 0 : new Set(a).size > 1 ? 1 : 2
	}
	const ordered = [...clusters].sort(
		(a, b) => info(a) - info(b) || b.votes - a.votes || a.id - b.id
	)
	// Solve the small movie/show assignment once per cluster. Precompute options before the dynamic program;
	// scanning/sorting thousands of titles inside each search branch would make later calibration requests slow.
	const target = Math.round(count * 0.6)
	type Selection = { keys: number[]; movies: number; cost: number }
	let states = new Map<string, Selection>([
		["0:0", { keys: [], movies: 0, cost: 0 }],
	])
	for (let i = 0; i < ordered.length; i++) {
		const c = ordered[i]
		const titles = c.titles.some((t) => answered.get(t.key) === "unseen")
			? [...c.titles].sort((a, b) => b.votes - a.votes || a.key - b.key)
			: c.titles
		const options = [true, false].flatMap((movie) => {
			const title = titles.find(
				(t) => t.movie === movie && !answered.has(t.key)
			)
			return title ? [title] : []
		})
		const next = new Map(states)
		for (const s of states.values()) {
			if (s.keys.length >= count) continue
			for (const e of options) {
				const value = {
					keys: [...s.keys, e.key],
					movies: s.movies + Number(e.movie),
					cost: s.cost + i * 100 - e.likely,
				}
				const id = `${value.keys.length}:${value.movies}`
				if (!next.has(id) || next.get(id)!.cost > value.cost)
					next.set(id, value)
			}
		}
		states = next
	}
	const cost = (s: Selection) =>
		s.cost + Math.abs(s.movies - target) * 1e6 + (count - s.keys.length) * 1e9
	return [...states.values()].sort((a, b) => cost(a) - cost(b))[0].keys
}
