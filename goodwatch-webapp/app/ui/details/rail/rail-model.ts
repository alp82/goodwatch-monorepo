// What the rail's "On this page" shows that lives in other trees: small external stores that a section or a sub-page
// publishes and the rail reads (RailNav.tsx, TitleRail.tsx, SubPageRail.tsx).
// - More like this's shelves (more-like-this/expanded-view.tsx), for the rail of its expanded view.
// - The tropes sub-page's state (tropes/TropesPage.tsx): its two panes, the open trope and the letters.
// - The At a glance sub-page's rows (at-a-glance/AtAGlancePage.tsx).
// - The title page's entries, kept for its sub-pages' rail, and the title bar's meta line.
import { type ComponentType, useEffect, useSyncExternalStore } from "react"

/** One of a sub-page's parts, as its rail lists it. */
export interface RailPart {
	id: string
	label: string
	meta?: string | null
}

// --- A tiny external store -------------------------------------------------------------------------------------------

function store<T>(initial: T) {
	let value = initial
	const subs = new Set<() => void>()
	return {
		get: () => value,
		set: (v: T) => {
			value = v
			for (const f of subs) f()
		},
		subscribe: (f: () => void) => {
			subs.add(f)
			return () => {
				subs.delete(f)
			}
		},
	}
}

function useStore<T>(s: ReturnType<typeof store<T>>, server: T): T {
	return useSyncExternalStore(s.subscribe, s.get, () => server)
}

// --- More like this's shelves ----------------------------------------------------------------------------------------

export interface ShelfLink {
	id: string
	kind: string
	title: string
	count: number
	posters: (string | null)[]
}

export interface ShelfBridge {
	shelves: ShelfLink[]
	/** The shelf open in the expanded view, or null. */
	opened: string | null
	open: (id: string) => void
	hop: (id: string) => void
	close: () => void
}

export const shelfBridge = store<ShelfBridge | null>(null)
export const useShelves = () => useStore(shelfBridge, null)

// --- The tropes sub-page's state --------------------------------------------------------------------------------------

export interface TropesBridge {
	signature: number
	total: number
	/** The trope open in the reading pane, or null (the signature cards show). */
	open: { id: string; name: string } | null
	letters: Set<string>
	showSignature: () => void
	openFirst: () => void
	jumpLetter: (l: string) => void
}

export const tropesBridge = store<TropesBridge | null>(null)
export const useTropesBridge = () => useStore(tropesBridge, null)

// --- The At a glance sub-page's rows ---------------------------------------------------------------------------------

export const glanceBridge = store<RailPart[] | null>(null)
export const useGlanceParts = () => useStore(glanceBridge, null)

// --- The title page's index, kept for its sub-pages' rail -------------------------------------------------------------

export interface KeptEntry {
	id: string
	label: string
	peek?: string | null
}

const KEPT = "rail-entries:"

/** The title page's entry icons by id (a module's memory: there for a sub-page opened from the page). */
export const keptIcons = new Map<
	string,
	ComponentType<{ className?: string }>
>()

export function keepEntries(key: string, entries: KeptEntry[]) {
	try {
		sessionStorage.setItem(KEPT + key, JSON.stringify(entries))
	} catch {}
}

export function keptEntries(key: string): KeptEntry[] | null {
	try {
		const raw = sessionStorage.getItem(KEPT + key)
		return raw ? (JSON.parse(raw) as KeptEntry[]) : null
	} catch {
		return null
	}
}

// --- The title bar's meta line, for the header of More like this's expanded view -------------------------------------

const pageMetaStore = store<string[] | null>(null)
export const usePageMeta = () => useStore(pageMetaStore, null)

/** The title page publishes its bar's meta line options (title-words.ts fitMeta). */
export function usePublishPageMeta(meta: string[]) {
	const sig = meta.join("|")
	useEffect(() => {
		pageMetaStore.set(meta)
		return () => pageMetaStore.set(null)
	}, [sig])
}
