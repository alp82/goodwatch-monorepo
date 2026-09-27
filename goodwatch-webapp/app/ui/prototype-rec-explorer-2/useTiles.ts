// PROTOTYPE - throwaway. Streams zoom-pyramid tiles for the map layouts: whatever the camera can see, at the levels
// its zoom allows, a batch per camera settle. Tiles already fetched are never asked for again.
import { type RefObject, useEffect, useRef } from "react"
import type { StageHandle } from "./Stage"
import type { Store } from "./store"
import type { Ex } from "./useExplorer2"
import { LMAX, type LayoutId, S0, type W, tileSize } from "./wire"

export function useTiles(
	stage: RefObject<StageHandle>,
	store: Store,
	ex: Ex,
	layout: LayoutId,
	accept?: (w: W) => boolean,
) {
	const fetched = useRef(new Set<string>())
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const exRef = useRef(ex)
	exRef.current = ex
	const acceptRef = useRef(accept)
	acceptRef.current = accept
	const stats = useRef({ requests: 0, items: 0, lastMs: 0 })

	const run = async () => {
		timer.current = null
		const cam = stage.current?.camera()
		if (!cam || !cam.w) return
		const camLevel = Math.log2(cam.scale / S0)
		const maxL = Math.max(0, Math.min(LMAX, Math.floor(camLevel + 0.6)))
		const hw = (cam.w / 2 / cam.scale) * 1.3
		const hh = (cam.h / 2 / cam.scale) * 1.3
		const keys: string[] = []
		for (let L = 0; L <= maxL; L++) {
			const T = tileSize(L)
			for (
				let tx = Math.floor((cam.x - hw) / T);
				tx <= Math.floor((cam.x + hw) / T);
				tx++
			)
				for (
					let ty = Math.floor((cam.y - hh) / T);
					ty <= Math.floor((cam.y + hh) / T);
					ty++
				) {
					const k = `${L}_${tx}_${ty}`
					if (!fetched.current.has(k)) keys.push(k)
				}
		}
		if (!keys.length) return
		const batch = keys.slice(0, 60)
		for (const k of batch) fetched.current.add(k)
		const t0 = performance.now()
		try {
			const r = await exRef.current.api<{ items: W[] }>("tiles", {
				layout,
				t: batch.join(","),
			})
			const items = acceptRef.current
				? r.items.filter(acceptRef.current)
				: r.items
			store.add(items, performance.now())
			store.filter(exRef.current.pass)
			stats.current.requests++
			stats.current.items += items.length
			stats.current.lastMs = performance.now() - t0
			;(window as unknown as { __ex2Tiles?: unknown }).__ex2Tiles = {
				...stats.current,
				stored: store.n,
			}
			stage.current?.redraw()
		} catch {
			for (const k of batch) fetched.current.delete(k)
		}
		if (keys.length > batch.length) schedule()
	}
	const schedule = () => {
		if (!timer.current) timer.current = setTimeout(run, 70)
	}
	// Filters changed: ask again, so the representatives at each level are ones that pass.
	useEffect(() => {
		fetched.current.clear()
		store.filter(ex.pass)
		stage.current?.redraw()
		schedule()
	}, [ex.filterKey])
	useEffect(() => {
		store.filter(ex.pass)
		stage.current?.redraw()
	}, [ex.rev])
	return { onView: schedule, reset: () => fetched.current.clear(), stats }
}
