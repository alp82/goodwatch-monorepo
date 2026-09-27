// PROTOTYPE - throwaway. A client-side stand-in for a stored taste vector.
// Every signal and dial recomputes the vector and re-ranks the pool in a few milliseconds,
// which is what a real per-user vector in Qdrant would give us without per-request fan-out.
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import { CRAFT_KEYS, PHRASES, type PoolItem, type Signal, type TastePool } from "./model"

export type Dials = Record<string, number> // attribute key -> -2..2
export type GenreDials = Record<string, number> // genre -> -1 | 1

export type Pick = {
	item: PoolItem
	match: number // 40-99
	value: number // ranking value
	reasons: string[] // attribute keys that pull this pick toward the person
	like: PoolItem | null // the closest title they rated highly
}

export type Engine = ReturnType<typeof createEngine>

export function createEngine(pool: TastePool) {
	const n = pool.keys.length
	const mean = new Array(n).fill(0)
	const sd = new Array(n).fill(0)
	for (const it of pool.items) for (let k = 0; k < n; k++) mean[k] += it.fp[k] / pool.items.length
	for (const it of pool.items) for (let k = 0; k < n; k++) sd[k] += (it.fp[k] - mean[k]) ** 2 / pool.items.length
	for (let k = 0; k < n; k++) sd[k] = Math.sqrt(sd[k]) || 1
	const z = new Map(pool.items.map((it) => [it.key, it.fp.map((v, k) => (v - mean[k]) / sd[k])]))
	const byKey = new Map(pool.items.map((it) => [it.key, it]))
	const keyIndex = new Map(pool.keys.map((k, i) => [k, i]))

	const weight = (s: Signal) => (s.kind === "score" ? (s.score - 5.5) / 4.5 : s.kind === "no" ? -0.35 : s.kind === "want" ? 0.35 : s.kind === "unseen" ? 0.08 : 0)
	const cos = (a: number[], b: number[]) => {
		let d = 0
		let na = 0
		let nb = 0
		for (let k = 0; k < a.length; k++) {
			d += a[k] * b[k]
			na += a[k] * a[k]
			nb += b[k] * b[k]
		}
		return na && nb ? d / Math.sqrt(na * nb) : 0
	}

	function vector(signals: Record<string, Signal>, dials: Dials = {}) {
		const v = new Array(n).fill(0)
		let total = 0
		for (const [key, sig] of Object.entries(signals)) {
			const w = weight(sig)
			const zi = z.get(key)
			if (!w || !zi) continue
			total += Math.abs(w)
			for (let k = 0; k < n; k++) v[k] += w * zi[k]
		}
		if (total) for (let k = 0; k < n; k++) v[k] /= total
		// Normalize so dials have a predictable pull whatever the number of ratings.
		const len = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1
		for (let k = 0; k < n; k++) v[k] = (v[k] / len) * 2
		for (const [key, step] of Object.entries(dials)) {
			const i = keyIndex.get(key)
			if (i != null && step) v[i] += step * 0.9
		}
		return v
	}

	function rank(signals: Record<string, Signal>, opts: { dials?: Dials; genres?: GenreDials; services?: number[] | null; includeWant?: boolean } = {}): Pick[] {
		const v = vector(signals, opts.dials)
		const liked = Object.entries(signals)
			.filter(([, s]) => s.kind === "score" && s.score >= 8)
			.map(([k]) => byKey.get(k))
			.filter((i): i is PoolItem => !!i)
		const picks: Pick[] = []
		for (const item of pool.items) {
			const sig = signals[item.key]
			if (sig && sig.kind !== "unseen" && !(opts.includeWant && sig.kind === "want")) continue
			if (opts.services && !item.services.some((s) => opts.services?.includes(s))) continue
			const zi = z.get(item.key) as number[]
			const sim = cos(zi, v)
			let genre = 0
			for (const g of item.genres) genre += (opts.genres?.[g] ?? 0) * 0.18
			const value = sim + 0.4 * ((item.score - 72) / 100) + genre
			picks.push({ item, value, match: Math.max(40, Math.min(99, Math.round(52 + sim * 58 + genre * 30))), reasons: [], like: null })
		}
		picks.sort((a, b) => b.value - a.value)
		// Explanations only for what anyone will see.
		for (const p of picks.slice(0, 60)) {
			const zi = z.get(p.item.key) as number[]
			p.reasons = pool.keys
				.map((key, k) => ({ key, pull: zi[k] * v[k], zk: zi[k] }))
				.filter((r) => r.zk > 0.4 && r.pull > 0 && !CRAFT_KEYS.has(r.key))
				.sort((a, b) => b.pull - a.pull)
				.slice(0, 3)
				.map((r) => r.key)
			let best = -1
			for (const l of liked) {
				const c = cos(zi, z.get(l.key) as number[])
				if (c > best) {
					best = c
					p.like = l
				}
			}
		}
		return picks
	}

	// The attributes that define the person, strongest first, with craft attributes left out.
	function profile(signals: Record<string, Signal>, dials: Dials = {}) {
		const v = vector(signals, dials)
		const attrs = pool.keys
			.map((key, k) => ({ key, label: label(key), phrase: phrase(key), emoji: FINGERPRINT_META[key]?.emoji ?? "", weight: v[k] }))
			.filter((a) => !CRAFT_KEYS.has(a.key))
			.sort((a, b) => b.weight - a.weight)
		const scored = Object.entries(signals)
			.filter(([, s]) => s.kind === "score")
			.map(([k, s]) => ({ item: byKey.get(k), score: (s as { score: number }).score }))
			.filter((r): r is { item: PoolItem; score: number } => !!r.item)
		const agg = (keyOf: (i: PoolItem) => string[]) => {
			const m = new Map<string, { count: number; sum: number; items: PoolItem[] }>()
			for (const r of scored)
				for (const g of keyOf(r.item)) {
					const e = m.get(g) ?? { count: 0, sum: 0, items: [] }
					e.count++
					e.sum += r.score
					e.items.push(r.item)
					m.set(g, e)
				}
			return [...m.entries()].map(([name, e]) => ({ name, count: e.count, avg: e.sum / e.count, items: e.items })).sort((a, b) => b.avg * Math.sqrt(b.count) - a.avg * Math.sqrt(a.count))
		}
		const genres = agg((i) => i.genres)
		const decades = agg((i) => (i.year ? [`${Math.floor(i.year / 10) * 10}s`] : []))
		const directors = agg((i) => i.directors).filter((d) => d.avg >= 7)
		const favorites = scored.filter((r) => r.score >= 9).map((r) => r.item)
		const dislikes = scored.filter((r) => r.score <= 4).map((r) => r.item)
		return {
			loves: attrs.slice(0, 6),
			avoids: attrs.slice(-5).reverse(),
			attrs,
			genres,
			decades,
			directors,
			favorites,
			dislikes,
			rated: scored.length,
			sentence: sentence(attrs.slice(0, 3).map((a) => a.phrase), attrs.slice(-2).map((a) => a.phrase)),
		}
	}

	return { rank, profile, vector, byKey, z, cos, keyIndex }
}

export const label = (key: string) => FINGERPRINT_META[key]?.label ?? key
export const phrase = (key: string) => PHRASES[key] ?? label(key).toLowerCase()

function sentence(loves: string[], avoids: string[]) {
	const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "")
	return { loves: `You go for ${list(loves)}.`, avoids: `You tune out ${list(avoids)}.` }
}

export const reasonText = (p: Pick) => {
	const why = p.reasons.slice(0, 2).map(phrase).join(" and ")
	const text = [why, p.like ? `like ${p.like.title}` : ""].filter(Boolean).join(", ")
	return text.charAt(0).toUpperCase() + text.slice(1)
}
