// PROTOTYPE - throwaway. All taste state lives in memory; nothing is saved or sent.
import { useCallback, useMemo, useRef, useState } from "react"
import { type Dials, type GenreDials, type Pick, createEngine } from "./engine"
import { DEMO_RATINGS, type PoolItem, type Signal, type TastePool } from "./model"

export type Taste = ReturnType<typeof useTaste>

export function useTaste(pool: TastePool) {
	const engine = useMemo(() => createEngine(pool), [pool])
	const [signals, setSignals] = useState<Record<string, Signal>>(DEMO_RATINGS)
	const [dials, setDials] = useState<Dials>({})
	const [genreDials, setGenreDials] = useState<GenreDials>({})
	const [onlyMine, setOnlyMine] = useState(true)
	const [history, setHistory] = useState<{ key: string; before: Signal | undefined; after: Signal | undefined }[]>([])
	const myServices = useMemo(() => pool.services.filter((s) => s.mine).map((s) => s.id), [pool])

	const opts = { dials, genres: genreDials, services: onlyMine ? myServices : null }
	const picks = useMemo(() => engine.rank(signals, opts), [engine, signals, dials, genreDials, onlyMine])
	const everywhere = useMemo(() => engine.rank(signals, { ...opts, services: null }), [engine, signals, dials, genreDials])
	const profile = useMemo(() => engine.profile(signals, dials), [engine, signals, dials])

	// Watch next: the Wishlist, best match first, with what's streamable on your services up top.
	const watchNext = useMemo(() => {
		const all = engine.rank(signals, { ...opts, services: null, includeWant: true }).filter((p) => signals[p.item.key]?.kind === "want")
		const onMine = (p: Pick) => p.item.services.some((s) => myServices.includes(s))
		return [...all.filter(onMine), ...(onlyMine ? [] : all.filter((p) => !onMine(p)))]
	}, [engine, signals, dials, genreDials, onlyMine])

	// Rank before the last change, so views can show what moved.
	const prevRanks = useRef<Map<string, number>>(new Map())
	const snapshot = () => {
		prevRanks.current = new Map(picks.slice(0, 40).map((p, i) => [p.item.key, i]))
	}
	const [changeId, setChangeId] = useState(0)

	const set = useCallback(
		(key: string, sig: Signal | undefined) => {
			snapshot()
			setHistory((h) => [...h, { key, before: signals[key], after: sig }])
			setSignals((cur) => {
				const next = { ...cur }
				if (sig) next[key] = sig
				else delete next[key]
				return next
			})
			setChangeId((c) => c + 1)
		},
		[picks, signals],
	)
	const undo = () => {
		const last = history[history.length - 1]
		if (!last) return
		snapshot()
		setHistory((h) => h.slice(0, -1))
		setSignals((cur) => {
			const next = { ...cur }
			if (last.before) next[last.key] = last.before
			else delete next[last.key]
			return next
		})
		setChangeId((c) => c + 1)
	}
	const dial = (key: string, step: number) => {
		snapshot()
		setDials((d) => ({ ...d, [key]: Math.max(-2, Math.min(2, step)) }))
		setChangeId((c) => c + 1)
	}
	const genreDial = (genre: string, step: number) => {
		snapshot()
		setGenreDials((d) => ({ ...d, [genre]: step }))
		setChangeId((c) => c + 1)
	}
	const toggleMine = () => {
		snapshot()
		setOnlyMine((v) => !v)
		setChangeId((c) => c + 1)
	}

	// Rank movement since the last change: positive = moved up, null = new in the top 40.
	const moved = (key: string, rank: number): number | null => {
		const prev = prevRanks.current.get(key)
		return prev == null ? (prevRanks.current.size ? null : 0) : prev - rank
	}

	// Titles to triage: what we are about to recommend, everywhere, so each answer cleans the picks.
	const triage = useMemo(() => everywhere.filter((p) => !signals[p.item.key]), [everywhere])

	const counts = {
		rated: Object.values(signals).filter((s) => s.kind === "score").length,
		seen: Object.values(signals).filter((s) => s.kind === "seen").length,
		no: Object.values(signals).filter((s) => s.kind === "no").length,
		want: Object.values(signals).filter((s) => s.kind === "want").length,
		unseen: Object.values(signals).filter((s) => s.kind === "unseen").length,
		session: history.length,
	}

	return {
		pool,
		engine,
		signals,
		set,
		undo,
		history,
		dials,
		dial,
		genreDials,
		genreDial,
		onlyMine,
		toggleMine,
		myServices,
		services: pool.services,
		picks,
		everywhere,
		triage,
		watchNext,
		profile,
		moved,
		changeId,
		counts,
		item: (key: string) => engine.byKey.get(key) as PoolItem,
	}
}
