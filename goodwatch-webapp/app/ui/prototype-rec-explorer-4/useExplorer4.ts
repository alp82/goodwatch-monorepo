// PROTOTYPE - throwaway. Page state for the round-4 Explorer: the grouping, the two shared filters (hide, never dim),
// the maps per grouping and filter (fetched once, kept), in-memory actions (Want to See and Seen it change only this
// page), the peek reason, and the history (every place you stood; the page shows the last two and a dropdown).
import { useSearchParams } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { GROUPINGS, type GroupId, type Loaded4, type MapRes, type PeekInfo4, type W } from "./wire4"

export type Ex4 = ReturnType<typeof useExplorer4>

export type Step = {
	id: number
	kind: "map" | "group" | "region" | "title"
	label: string
	group: GroupId
	cell?: string
	title?: W
}

let stepId = 0

export function useExplorer4(data: Loaded4, groups: GroupId[]) {
	const [params] = useSearchParams()
	const hasServices = data.services.some((s) => s.mine)
	const [onlyMine, setOnlyMine] = useState(hasServices)
	const [notSeen, setNotSeen] = useState(true)
	const [group, setGroupState] = useState<GroupId>(data.map.group)
	const [toast, setToast] = useState<string | null>(null)
	const [rev, bump] = useState(0)
	const peekCache = useRef(new Map<string, Promise<PeekInfo4>>())
	const filterKey = `${onlyMine ? 1 : 0}${notSeen ? 1 : 0}`
	const maps = useRef(new Map<string, Promise<MapRes>>())
	const [map, setMap] = useState<MapRes>(data.map)
	const [loading, setLoading] = useState(false)
	const mapKey = useRef(`${data.map.group}|${hasServices ? 1 : 0}1`)

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
			q.set("group", group)
			for (const [k, v] of Object.entries(args)) q.set(k, String(v))
			const r = await fetch(`/prototype/rec-explorer-4/api?${q}`)
			if (!r.ok) throw new Error(`API ${op} ${r.status}`)
			return (await r.json()) as T
		},
		[base, onlyMine, notSeen, group],
	)

	const mapFor = useCallback(
		(g: GroupId, fk: string) => {
			const key = `${g}|${fk}`
			if (key === `${data.map.group}|${hasServices ? 1 : 0}1`) maps.current.set(key, Promise.resolve(data.map))
			let p = maps.current.get(key)
			if (!p) {
				const q = new URLSearchParams(base)
				q.set("op", "map")
				q.set("group", g)
				q.set("mine", fk[0])
				q.set("ns", fk[1])
				p = fetch(`/prototype/rec-explorer-4/api?${q}`).then((r) => {
					if (!r.ok) throw new Error(`map ${r.status}`)
					return r.json() as Promise<MapRes>
				})
				p.catch(() => maps.current.delete(key))
				maps.current.set(key, p)
			}
			return p
		},
		[base, data.map, hasServices],
	)

	// Whenever the grouping or filters change, fetch (or reuse) that map.
	useEffect(() => {
		let live = true
		const key = `${group}|${filterKey}`
		if (key === mapKey.current) return
		setLoading(true)
		mapFor(group, filterKey)
			.then((m) => {
				if (!live) return
				mapKey.current = key
				setMap(m)
			})
			.finally(() => live && setLoading(false))
		return () => {
			live = false
		}
	}, [group, filterKey])
	// Warm the other groupings once the page is idle, so switching feels instant.
	useEffect(() => {
		const t = setTimeout(() => {
			for (const g of groups) void mapFor(g, filterKey).catch(() => {})
		}, 1200)
		return () => clearTimeout(t)
	}, [filterKey])

	/** Whether a title passes "On my services" and "Not seen yet". Filtered titles are hidden, never dimmed. */
	const pass = useCallback(
		(it: W) => !(onlyMine && !(it.f & 1)) && !(notSeen && it.f & 2),
		// rev: a title marked as seen on this page disappears right away.
		[onlyMine, notSeen, rev],
	)

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
			p = api<PeekInfo4>("peek", { k }).catch(() => ({ why: "", people: [], role: "" }))
			peekCache.current.set(k, p)
		}
		return p
	}

	// ------------------------------------------------------------ history

	const groupName = (g: GroupId) => GROUPINGS.find((x) => x.id === g)?.name ?? g
	const [steps, setSteps] = useState<Step[]>(() => [
		{ id: stepId++, kind: "map", label: `All by ${groupName(data.map.group).toLowerCase()}`, group: data.map.group },
	])
	const stepsRef = useRef(steps)
	stepsRef.current = steps
	const push = useCallback((s: Omit<Step, "id">, replaceSameKind = false) => {
		setSteps((xs) => {
			const top = xs[xs.length - 1]
			if (top && top.kind === s.kind && top.label === s.label && top.cell === s.cell) return xs
			const base = replaceSameKind && top?.kind === s.kind && top.cell === s.cell ? xs.slice(0, -1) : xs
			return [...base, { ...s, id: stepId++ }].slice(-40)
		})
	}, [])
	/** Jump back to a step: later steps are dropped, as a browser does when you go back and take a new turn. */
	const backTo = useCallback((id: number) => {
		const xs = stepsRef.current
		const n = xs.findIndex((s) => s.id === id)
		if (n < 0) return null
		setSteps(xs.slice(0, n + 1))
		return xs[n]
	}, [])

	const setGroup = (g: GroupId) => {
		if (g === group) return
		setGroupState(g)
		push({ kind: "group", label: `All by ${groupName(g).toLowerCase()}`, group: g })
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
		filterKey,
		pass,
		rev,
		actions,
		toast,
		say,
		api,
		peekInfo,
		group,
		setGroup,
		setGroupQuiet: setGroupState,
		groupName,
		map,
		loading,
		steps,
		push,
		backTo,
	}
}
