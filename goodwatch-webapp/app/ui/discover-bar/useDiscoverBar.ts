// The Discover bar's state for the page that shows it: which tab is open and on which sub-tab (panel-state.ts), and
// the `counts=` flags its results request sends for the sub-tab on screen. The page creates it before it asks for
// results, and hands it to DiscoverControls.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { FilterName, FilterState } from "~/domain/filter-state"
import {
	type PanelState,
	closePanel,
	initialPanel,
	openAtGroup,
	openTab,
	panelCounts,
	pickSubTab,
	setFind,
} from "./panel-state"
import type { MainTab, SubTabId } from "./tabs"

export interface DiscoverBarState {
	panel: PanelState
	/** The opt-in counts for the open sub-tab, for useDiscoverResults' `counts`. */
	counts: string[]
	open: (tab: MainTab, sub?: SubTabId) => void
	/** Opens where a filter group's choices are made (a chip's place). */
	openAt: (group: FilterName) => void
	pickSub: (id: SubTabId) => void
	setFind: (text: string) => void
	close: () => void
}

export function useDiscoverBar(state: FilterState): DiscoverBarState {
	const [panel, setPanel] = useState(() => initialPanel(state))
	// The transitions read the filter state as it is when they run (Mood's default sub-tab).
	const latest = useRef(state)
	latest.current = state
	const countsKey = panelCounts(panel, state).join(",")
	const counts = useMemo(
		() => (countsKey ? countsKey.split(",") : []),
		[countsKey],
	)
	return {
		panel,
		counts,
		open: useCallback(
			(tab: MainTab, sub?: SubTabId) =>
				setPanel((p) => openTab(p, tab, latest.current, sub)),
			[],
		),
		openAt: useCallback(
			(group: FilterName) =>
				setPanel((p) => openAtGroup(p, group, latest.current)),
			[],
		),
		pickSub: useCallback(
			(id: SubTabId) => setPanel((p) => pickSubTab(p, id)),
			[],
		),
		setFind: useCallback(
			(text: string) => setPanel((p) => setFind(p, text)),
			[],
		),
		close: useCallback(() => setPanel(closePanel), []),
	}
}

/** Whether the viewport is desktop width (Tailwind's lg). False on the server and until hydration. */
export function useDesktop(): boolean {
	const [desktop, setDesktop] = useState(false)
	useEffect(() => {
		const query = window.matchMedia("(min-width: 1024px)")
		const update = () => setDesktop(query.matches)
		update()
		query.addEventListener("change", update)
		return () => query.removeEventListener("change", update)
	}, [])
	return desktop
}

/** "/" anywhere outside a text field. */
export function useSlashKey(onSlash: () => void) {
	const latest = useRef(onSlash)
	latest.current = onSlash
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
				return
			const target = event.target as HTMLElement | null
			if (
				target?.closest(
					"input, textarea, select, [contenteditable=''], [contenteditable=true]",
				)
			)
				return
			// Taken at the window before the site header's own "/" (the search dialog) sees it.
			event.preventDefault()
			event.stopPropagation()
			latest.current()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
}

/** Elements whose presses never close the panel: menus, listboxes and dialogs of their own. */
const OWN_LAYERS =
	"[role=dialog], [role=menu], [role=listbox], [data-headlessui-portal]"

/**
 * While `open`: Escape, or a pointer down outside `inside` and `keep` (and outside any menu, listbox or other dialog),
 * calls `onClose`.
 */
export function useOutsideClose(
	open: boolean,
	onClose: () => void,
	inside: React.RefObject<HTMLElement>,
	keep: React.RefObject<HTMLElement>,
) {
	const latest = useRef(onClose)
	latest.current = onClose
	useEffect(() => {
		if (!open) return
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !event.defaultPrevented) latest.current()
		}
		const onDown = (event: Event) => {
			const target = event.target as HTMLElement | null
			if (!target?.isConnected) return
			if (inside.current?.contains(target) || keep.current?.contains(target))
				return
			if (target.closest(OWN_LAYERS)) return
			latest.current()
		}
		document.addEventListener("keydown", onKey)
		document.addEventListener("pointerdown", onDown)
		return () => {
			document.removeEventListener("keydown", onKey)
			document.removeEventListener("pointerdown", onDown)
		}
	}, [open, inside, keep])
}

/**
 * Clear all: the search goes first, then the filters, so the two URL writes don't overwrite each other. The filters
 * clear once the URL has no search any more.
 */
export function useClearAll({
	query,
	clearSearch,
	clearFilters,
}: {
	query: string | null
	clearSearch: () => void
	clearFilters: () => void
}) {
	const [pending, setPending] = useState(false)
	const searching = Boolean(query?.trim())
	const filters = useRef(clearFilters)
	filters.current = clearFilters
	useEffect(() => {
		if (!pending || searching) return
		setPending(false)
		filters.current()
	}, [pending, searching])
	return useCallback(() => {
		if (searching) {
			setPending(true)
			clearSearch()
		} else filters.current()
	}, [searching, clearSearch])
}
