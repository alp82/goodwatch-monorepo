// PROTOTYPE - throwaway. Explorer state: taste vector, steering, filters, and in-memory actions.
// Want to See, Watch next, and Seen it change only this page's memory. Nothing is saved or sent.
import { useCallback, useMemo, useState } from "react"
import { createEngine, phrase } from "~/ui/prototype-rec-taste/engine"
import { CRAFT_KEYS, type PoolItem, type Signal } from "~/ui/prototype-rec-taste/model"
import { type Pt, type Vec, cos, percentiles } from "./math"
import { type ExplorerData, hydrate } from "./model"

export type Explorer = ReturnType<typeof useExplorer>
export type FilterMode = "dim" | "hide"

export function useExplorer(data: ExplorerData, opts: { filterMode?: FilterMode } = {}) {
	const pool = useMemo(() => hydrate(data), [data])
	const engine = useMemo(() => createEngine(pool), [pool])
	const n = pool.keys.length
	const items = pool.items
	const index = useMemo(() => new Map(items.map((it, i) => [it.key, i])), [items])
	const zs = useMemo(() => items.map((it) => engine.z.get(it.key) as number[]), [items, engine])

	const [signals, setSignals] = useState<Record<string, Signal>>(data.signals)
	const [queue, setQueue] = useState<string[]>([])
	const [steer, setSteer] = useState<Vec>(() => new Array(n).fill(0))
	const hasServices = pool.services.some((s) => s.mine)
	const [onlyMine, setOnlyMine] = useState(hasServices)
	const [notSeen, setNotSeen] = useState(true)
	const [filterMode, setFilterMode] = useState<FilterMode>(opts.filterMode ?? "dim")
	const [toast, setToast] = useState<string | null>(null)
	const myServices = useMemo(() => pool.services.filter((s) => s.mine).map((s) => s.id), [pool])

	const base = useMemo(() => engine.vector(signals), [engine, signals])
	const taste = useMemo(() => base.map((x, i) => x + steer[i]), [base, steer])

	// Cosine to every title, then a per-person percentile shown as 50-99 (the #174 calibration).
	const sims = useMemo(() => Float32Array.from(zs, (z) => cos(z, taste)), [zs, taste])
	const match = useMemo(() => {
		const pct = percentiles(sims)
		return Uint8Array.from(pct, (p) => Math.round(50 + 0.49 * p))
	}, [sims])

	const isSeen = useCallback((key: string) => {
		const s = signals[key]
		return s?.kind === "score" || s?.kind === "seen"
	}, [signals])
	const onMine = useCallback((it: PoolItem) => it.services.some((s) => myServices.includes(s)), [myServices])

	// Why a title passes or fails the shared filters.
	const pass = useMemo(
		() =>
			Uint8Array.from(items, (it) => {
				const s = signals[it.key]
				if (s?.kind === "no") return 0
				if (notSeen && (s?.kind === "score" || s?.kind === "seen")) return 0
				if (onlyMine && !onMine(it)) return 0
				return 1
			}),
		[items, signals, notSeen, onlyMine, onMine],
	)

	// Best first, among titles that pass the filters and aren't the person's own history.
	const ranked = useMemo(() => {
		const idx: number[] = []
		for (let i = 0; i < items.length; i++) if (pass[i] && !pool.extra.has(items[i].key)) idx.push(i)
		return idx.sort((a, b) => sims[b] - sims[a] + 0.12 * ((items[b].score - items[a].score) / 100))
	}, [pass, sims, items, pool.extra])
	const rankOf = useMemo(() => {
		const m = new Int32Array(items.length).fill(-1)
		ranked.forEach((i, r) => {
			m[i] = r
		})
		return m
	}, [ranked, items.length])

	const reasons = (i: number, v: Vec = taste) => {
		const z = zs[i]
		return pool.keys
			.map((key, k) => ({ key, pull: z[k] * v[k], zk: z[k] }))
			.filter((r) => r.zk > 0.4 && r.pull > 0 && !CRAFT_KEYS.has(r.key))
			.sort((a, b) => b.pull - a.pull)
			.slice(0, 3)
			.map((r) => r.key)
	}
	const loved = useMemo(
		() =>
			Object.entries(signals)
				.filter(([, s]) => s.kind === "score" && s.score >= 8)
				.map(([k]) => index.get(k))
				.filter((i): i is number => i != null),
		[signals, index],
	)
	const favorites = useMemo(
		() =>
			Object.entries(signals)
				.filter(([, s]) => s.kind === "score" && s.score >= 9)
				.map(([k]) => index.get(k))
				.filter((i): i is number => i != null),
		[signals, index],
	)
	const closestLoved = (i: number) => {
		let best = -1
		let bi: number | null = null
		for (const l of loved) {
			if (l === i) continue
			const c = cos(zs[i], zs[l])
			if (c > best) {
				best = c
				bi = l
			}
		}
		return bi
	}
	const why = (i: number) => {
		const r = reasons(i).slice(0, 2).map(phrase).join(" and ")
		const like = closestLoved(i)
		const text = [r, like != null ? `like ${items[like].title}` : ""].filter(Boolean).join(", ")
		return text.charAt(0).toUpperCase() + text.slice(1)
	}

	/** Where "You" sits in a layout: the densest cluster among your best matches there, not their average,
	 *  which can land in empty space between islands. */
	const youIn = (pos: Pt[], top = 16, radius = 70): Pt => {
		const pts = ranked.slice(0, top).map((i) => pos[i]).filter(Boolean)
		if (!pts.length) return { x: 0, y: 0 }
		let best = pts[0]
		let bestN = -1
		for (const a of pts) {
			const nAround = pts.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < radius).length
			if (nAround > bestN) {
				bestN = nAround
				best = a
			}
		}
		const near = pts.filter((b) => Math.hypot(best.x - b.x, best.y - b.y) < radius)
		return { x: near.reduce((s, p) => s + p.x, 0) / near.length, y: near.reduce((s, p) => s + p.y, 0) / near.length }
	}

	/** Nearest titles to a point in fingerprint space, skipping some. */
	const nearest = (target: Vec, count: number, skip: Set<number> = new Set(), onlyPassing = true) => {
		const out: { i: number; c: number }[] = []
		for (let i = 0; i < items.length; i++) {
			if (skip.has(i) || (onlyPassing && !pass[i]) || pool.extra.has(items[i].key)) continue
			const c = cos(zs[i], target) + 0.05 * sims[i]
			if (out.length < count || c > out[out.length - 1].c) {
				out.push({ i, c })
				out.sort((a, b) => b.c - a.c)
				if (out.length > count) out.pop()
			}
		}
		return out.map((o) => o.i)
	}

	const say = (text: string) => {
		setToast(text)
		setTimeout(() => setToast((t) => (t === text ? null : t)), 2200)
	}
	const setSignal = (key: string, sig: Signal | undefined) =>
		setSignals((cur) => {
			const next = { ...cur }
			if (sig) next[key] = sig
			else delete next[key]
			return next
		})
	const actions = {
		want: (key: string) => {
			const on = signals[key]?.kind === "want"
			setSignal(key, on ? undefined : { kind: "want" })
			say(on ? "Removed from Wishlist" : "Added to Wishlist")
		},
		next: (key: string) => {
			const on = queue.includes(key)
			setQueue((q) => (on ? q.filter((k) => k !== key) : [...q, key]))
			say(on ? "Removed from Watch next" : "Added to Watch next")
		},
		seen: (key: string) => {
			const on = signals[key]?.kind === "seen"
			setSignal(key, on ? undefined : { kind: "seen" })
			say(on ? "Unmarked as seen" : "Marked as seen")
		},
	}

	return {
		data,
		who: data.who,
		pool,
		items,
		engine,
		zs,
		index,
		n,
		signals,
		queue,
		steer,
		setSteer,
		base,
		taste,
		sims,
		match,
		pass,
		ranked,
		rankOf,
		reasons,
		why,
		closestLoved,
		loved,
		favorites,
		youIn,
		nearest,
		isSeen,
		onMine,
		services: pool.services,
		myServices,
		hasServices,
		onlyMine,
		setOnlyMine,
		notSeen,
		setNotSeen,
		filterMode,
		setFilterMode,
		actions,
		toast,
		say,
	}
}
