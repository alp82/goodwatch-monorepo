// The sub-tabs' content as one chunk loaded on demand, so the page's first load carries only the closed bar. The
// chunk starts loading when the person reaches for the bar (preloadSubTabs) or when the panel opens; until it arrives
// the content area shows its empty slot of the final height, so nothing shifts.
import { useEffect, useState } from "react"

type SubTabs = typeof import("./index")

let loaded: SubTabs | null = null
let loading: Promise<SubTabs> | null = null

/** Starts loading the sub-tabs' content; later calls reuse the first load. A failed load is tried again next time. */
export function preloadSubTabs(): Promise<SubTabs> {
	loading ??= import("./index").then(
		(module) => {
			loaded = module
			return module
		},
		(error) => {
			loading = null
			throw error
		},
	)
	return loading
}

/**
 * DiscoverControls' `renderSubTab` and `renderFind` once the content has loaded, else undefined (the panel shows its
 * empty slots).
 * Loads it while `wanted` (the panel is open).
 */
export function useSubTabContent(wanted: boolean): {
	renderSubTab: SubTabs["renderSubTab"] | undefined
	renderFind: SubTabs["renderFind"] | undefined
} {
	const [module, setModule] = useState<SubTabs | null>(loaded)
	useEffect(() => {
		if (module || !wanted) return
		let live = true
		preloadSubTabs().then(
			(next) => live && setModule(next),
			// Stays on the empty slots; the next open tries again.
			() => {},
		)
		return () => {
			live = false
		}
	}, [module, wanted])
	return { renderSubTab: module?.renderSubTab, renderFind: module?.renderFind }
}
