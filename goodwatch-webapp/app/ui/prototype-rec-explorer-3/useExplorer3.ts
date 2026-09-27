// PROTOTYPE - throwaway. Page state for the round-3 Explorer variants: the two shared filters, the in-memory
// actions (Want to See and Seen it change only this page), the peek, a client for the read-only API, and the walk:
// every title this session has shown (never shown again) and the path the person took.
import { useSearchParams } from "@remix-run/react"
import { useCallback, useMemo, useRef, useState } from "react"
import type { Loaded3, PeekInfo, W } from "./wire"

export type Ex3 = ReturnType<typeof useExplorer3>

/** Numbers the verification scripts read: what each turn offered and how far apart it was. */
type Dbg = {
	turns: { offered: string[]; spread: number; took?: string }[]
	shown: string[]
	repeats: number
	path: string[]
}
const dbg = (): Dbg => {
	const w = window as unknown as { __ex3?: Dbg }
	w.__ex3 ??= { turns: [], shown: [], repeats: 0, path: [] }
	return w.__ex3
}

export function useExplorer3(data: Loaded3) {
	const [params] = useSearchParams()
	const hasServices = data.services.some((s) => s.mine)
	const [onlyMine, setOnlyMine] = useState(hasServices)
	const [notSeen, setNotSeen] = useState(true)
	const [toast, setToast] = useState<string | null>(null)
	const [rev, bump] = useState(0)
	const peekCache = useRef(new Map<string, Promise<PeekInfo>>())

	const base = useMemo(() => {
		const q = new URLSearchParams()
		for (const k of ["as", "country"]) {
			const v = params.get(k)
			if (v) q.set(k, v)
		}
		return q.toString()
	}, [params])

	const api = useCallback(
		async <T>(op: string, args: Record<string, string | number> = {}) => {
			const q = new URLSearchParams(base)
			q.set("op", op)
			q.set("mine", onlyMine ? "1" : "0")
			q.set("ns", notSeen ? "1" : "0")
			for (const [k, v] of Object.entries(args)) q.set(k, String(v))
			const r = await fetch(`/prototype/rec-explorer-3/api?${q}`)
			if (!r.ok) throw new Error(`API ${op} ${r.status}`)
			return (await r.json()) as T
		},
		[base, onlyMine, notSeen],
	)

	/** Whether a title passes "On my services" and "Not seen yet". Filtered titles are hidden, never dimmed. */
	const pass = useCallback(
		(it: W) => !(onlyMine && !(it.f & 1)) && !(notSeen && it.f & 2),
		[onlyMine, notSeen],
	)
	const filterKey = `${onlyMine ? 1 : 0}${notSeen ? 1 : 0}`

	const say = (text: string) => {
		setToast(text)
		setTimeout(() => setToast((t) => (t === text ? null : t)), 2200)
	}
	const actions = {
		want: (it: W) => {
			it.f ^= 4
			bump((x) => x + 1)
			say(it.f & 4 ? "Added to Wishlist" : "Removed from Wishlist")
		},
		seen: (it: W) => {
			it.f ^= 2
			bump((x) => x + 1)
			say(it.f & 2 ? "Marked as seen" : "Unmarked as seen")
		},
	}

	const peekInfo = (k: string) => {
		let p = peekCache.current.get(k)
		if (!p) {
			p = api<PeekInfo>("peek", { k }).catch(() => ({
				why: "",
				people: [],
				role: "",
			}))
			peekCache.current.set(k, p)
		}
		return p
	}

	return {
		data,
		who: data.who,
		services: data.services,
		hasServices,
		onlyMine,
		setOnlyMine,
		notSeen,
		setNotSeen,
		pass,
		filterKey,
		rev,
		actions,
		toast,
		say,
		api,
		peekInfo,
	}
}

export type Step = { w: W; label: string }

/** The walk: titles already shown (so the server never offers them again) and the steps taken. */
export function useWalk() {
	const shown = useRef(new Set<string>())
	const [path, setPath] = useState<Step[]>([])
	const pathRef = useRef<Step[]>([])
	const show = useCallback((ws: W[]) => {
		const d = dbg()
		for (const w of ws) {
			if (shown.current.has(w.k)) d.repeats++
			shown.current.add(w.k)
			d.shown.push(w.k)
		}
	}, [])
	const offered = useCallback((ws: W[], spread: number) => {
		dbg().turns.push({ offered: ws.map((w) => w.k), spread })
	}, [])
	const step = useCallback((w: W, label: string) => {
		const d = dbg()
		const last = d.turns[d.turns.length - 1]
		if (last) last.took = w.k
		d.path.push(w.k)
		pathRef.current = [...pathRef.current, { w, label }]
		setPath(pathRef.current)
	}, [])
	/** Go back to an earlier step; titles shown since stay shown, so the way forward is new ground. */
	const backTo = useCallback((n: number) => {
		pathRef.current = pathRef.current.slice(0, n + 1)
		dbg().path.push(`back:${pathRef.current[n]?.w.k ?? ""}`)
		setPath(pathRef.current)
	}, [])
	const params = useCallback(
		() => ({
			shown: [...shown.current].slice(-400).join(","),
			path: pathRef.current
				.slice(-8)
				.map((s) => s.w.k)
				.join(","),
		}),
		[],
	)
	return { shown, path, pathRef, show, offered, step, backTo, params }
}
