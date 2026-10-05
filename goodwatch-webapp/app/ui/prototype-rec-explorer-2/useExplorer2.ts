// PROTOTYPE - throwaway. Page state shared by the round-2 Explorer variants: the two shared filters, the in-memory
// actions (Want to See, Watch next, Seen it change only this page), the peek, and a small client for the read-only API.
import { useSearchParams } from "@remix-run/react"
import { useCallback, useMemo, useRef, useState } from "react"
import type { Item } from "./store"
import type { Loaded, W } from "./wire"

export type Ex = ReturnType<typeof useExplorer2>
export type PeekInfo = { why: string; people: string[]; role: string }

export function useExplorer2(data: Loaded) {
	const [params] = useSearchParams()
	const hasServices = data.services.some((s) => s.mine)
	const [onlyMine, setOnlyMine] = useState(hasServices)
	const [notSeen, setNotSeen] = useState(true)
	const [queue, setQueue] = useState<Set<string>>(() => new Set())
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
		async <T = { items: W[] }>(
			op: string,
			args: Record<string, string | number> = {},
		): Promise<T> => {
			const q = new URLSearchParams(base)
			q.set("op", op)
			q.set("mine", onlyMine ? "1" : "0")
			q.set("ns", notSeen ? "1" : "0")
			for (const [k, v] of Object.entries(args)) q.set(k, String(v))
			const r = await fetch(`/prototype/rec-explorer-2/api?${q}`)
			if (!r.ok) throw new Error(`API ${op} ${r.status}`)
			return r.json() as Promise<T>
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
		want: (it: Item) => {
			it.f ^= 4
			bump((x) => x + 1)
			say(it.f & 4 ? "Added to Wishlist" : "Removed from Wishlist")
		},
		next: (it: Item) => {
			const on = queue.has(it.k)
			setQueue((q) => {
				const n = new Set(q)
				if (on) n.delete(it.k)
				else n.add(it.k)
				return n
			})
			say(on ? "Removed from Watch next" : "Added to Watch next")
		},
		seen: (it: Item) => {
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
		queue,
		actions,
		toast,
		say,
		api,
		peekInfo,
	}
}
